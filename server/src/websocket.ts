import { WebSocketServer, WebSocket } from 'ws';
import { Message, UserInputMessage, ClientLogMessage, PingMessage, PongMessage } from './types.js';
import { MockLLMAdapter } from './mock-adapter.js';
import { LLMAdapter } from './llm-adapter.js';
import { ConnectionLogger, ClientLogger, serverLogger } from './logger.js';

interface ConnectionMetadata {
  id: string;
  startTime: number;
  messagesSent: number;
  messagesReceived: number;
  lastActivity: number;
  lastHeartbeat: number;
  remoteAddress: string;
  userAgent?: string;
  logger: ConnectionLogger;
  clientLogger: ClientLogger;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private llmAdapter: MockLLMAdapter | LLMAdapter;
  private connections: Map<WebSocket, ConnectionMetadata>;
  private totalConnections: number = 0;
  private totalMessagesSent: number = 0;
  private totalMessagesReceived: number = 0;
  
  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.connections = new Map();
    
    const baseUrl = process.env.LLM_BASE_URL;
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL;
    
    if (baseUrl && apiKey && apiKey !== 'your-api-key-here') {
      serverLogger.info('[WS] Using real LLM API');
      this.llmAdapter = new LLMAdapter(baseUrl, apiKey, model);
    } else {
      serverLogger.info('[WS] Using mock LLM (no API key provided)');
      this.llmAdapter = new MockLLMAdapter();
    }
    
    this.setupHandlers();
    serverLogger.info(`[WS] Server started on port ${port}`);
    
    setInterval(() => this.logMetrics(), 60000);
  }
  
  private setupHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const connId = this.generateConnectionId();
      const remoteAddress = req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'];
      
      const logger = new ConnectionLogger(connId);
      const clientLogger = new ClientLogger(connId);
      
      const metadata: ConnectionMetadata = {
        id: connId,
        startTime: Date.now(),
        messagesSent: 0,
        messagesReceived: 0,
        lastActivity: Date.now(),
        lastHeartbeat: 0,
        remoteAddress,
        userAgent,
        logger,
        clientLogger,
      };
      
      this.connections.set(ws, metadata);
      this.totalConnections++;
      
      logger.info('Client connected', {
        remoteAddress,
        userAgent,
      });
      
      this.sendSystemStatus(ws, 'connected', 'Connection established successfully.');
      
      ws.on('message', async (data: Buffer) => {
        const meta = this.connections.get(ws);
        if (meta) {
          meta.lastActivity = Date.now();
          meta.messagesReceived++;
          this.totalMessagesReceived++;
        }
        
        try {
          const message: Message = JSON.parse(data.toString());
          meta?.logger.debug('Message received', {
            messageType: message.type,
            messageId: message.id,
            contentLength: data.length,
          });
          await this.handleMessage(ws, message, connId);
        } catch (error) {
          meta?.logger.error('Error parsing message', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      
      ws.on('close', (code: number, reason: Buffer) => {
        const meta = this.connections.get(ws);
        if (meta) {
          const duration = Date.now() - meta.startTime;
          const lastActivityAge = Date.now() - meta.lastActivity;
          
          meta.logger.info('Client disconnected', {
            closeCode: code,
            closeReason: reason.toString(),
            connectionDuration: `${(duration / 1000).toFixed(2)}s`,
            messagesSent: meta.messagesSent,
            messagesReceived: meta.messagesReceived,
            lastActivityAge: `${(lastActivityAge / 1000).toFixed(2)}s`,
          });
          
          meta.logger.close();
          this.connections.delete(ws);
        }
      });
      
      ws.on('error', (error: Error) => {
        const meta = this.connections.get(ws);
        meta?.logger.error('WebSocket error', {
          errorType: error.name,
          errorMessage: error.message,
          stack: error.stack,
        });
      });
      
      ws.on('pong', () => {
        const meta = this.connections.get(ws);
        if (meta) {
          meta.lastActivity = Date.now();
        }
      });
    });
    
    this.wss.on('error', (error: Error) => {
      serverLogger.error('[WS] Server error', {
        errorType: error.name,
        errorMessage: error.message,
        stack: error.stack,
      });
    });
  }
  
  private async handleMessage(ws: WebSocket, message: Message, connId: string): Promise<void> {
    const timestamp = Date.now();
    const meta = this.connections.get(ws);
    
    switch (message.type) {
      case 'user_input':
        await this.handleUserInput(ws, message as UserInputMessage, connId);
        break;
      
      case 'ping':
        await this.handlePing(ws, message as PingMessage, connId);
        break;
      
      case 'client_log':
        await this.handleClientLog(ws, message as ClientLogMessage, connId);
        break;
      
      default:
        meta?.logger.warn('Unknown message type', {
          messageType: message.type,
        });
    }
  }
  
  private async handleUserInput(ws: WebSocket, message: UserInputMessage, connId: string): Promise<void> {
    const meta = this.connections.get(ws);
    try {
      const responseText = await this.llmAdapter.generateResponse(message.payload.text);
      
      const response: Message = {
        type: 'llm_output',
        payload: { text: responseText },
        timestamp: Date.now(),
        id: this.generateId(),
        reply_to: message.id
      };
      
      const messageStr = JSON.stringify(response);
      ws.send(messageStr);
      
      if (meta) {
        meta.messagesSent++;
        this.totalMessagesSent++;
        meta.lastActivity = Date.now();
        
        meta.logger.debug('Message sent', {
          messageType: 'llm_output',
          messageId: response.id,
          contentLength: messageStr.length,
        });
      }
    } catch (error) {
      meta?.logger.error('LLM generation error', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      const errorMessage: Message = {
        type: 'llm_output',
        payload: { text: '抱歉，AI 服务暂时不可用，请稍后再试。' },
        timestamp: Date.now(),
        id: this.generateId(),
        reply_to: message.id
      };
      
      const messageStr = JSON.stringify(errorMessage);
      ws.send(messageStr);
      
      if (meta) {
        meta.messagesSent++;
        this.totalMessagesSent++;
        
        meta.logger.debug('Message sent (error)', {
          messageType: 'llm_output',
          messageId: errorMessage.id,
          contentLength: messageStr.length,
        });
      }
    }
  }
  
  
  private async handlePing(ws: WebSocket, message: PingMessage, connId: string): Promise<void> {
    const response: Message = {
      type: 'pong',
      timestamp: Date.now(),
      id: this.generateId()
    };
    
    ws.send(JSON.stringify(response));
    
    const metaAfter = this.connections.get(ws);
    if (metaAfter) {
      metaAfter.messagesSent++;
      this.totalMessagesSent++;
      
      metaAfter.logger.debug('Pong sent', {
        messageId: response.id,
      });
    }
  }
  
  private async handleClientLog(ws: WebSocket, message: ClientLogMessage, connId: string): Promise<void> {
    const meta = this.connections.get(ws);
    if (!meta) return;
    
    try {
      await meta.clientLogger.saveLogs(message.payload.logs);
    } catch (error) {
      meta.logger.error('Failed to save client logs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  private sendSystemStatus(ws: WebSocket, status: 'connected' | 'disconnected' | 'error', message: string): void {
    const meta = this.connections.get(ws);
    const statusMessage: Message = {
      type: 'system_status',
      payload: { status, message },
      timestamp: Date.now(),
      id: this.generateId()
    };
    
    ws.send(JSON.stringify(statusMessage));
    
    if (meta) {
      meta.messagesSent++;
      meta.logger.debug('Message sent', {
        messageType: 'system_status',
        messageId: statusMessage.id,
      });
    }
  }
  
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private logMetrics(): void {
    serverLogger.info('[WS] Connection metrics', {
      totalConnections: this.totalConnections,
      activeConnections: this.connections.size,
      totalMessagesSent: this.totalMessagesSent,
      totalMessagesReceived: this.totalMessagesReceived,
    });
  }
  
  public close(): void {
    this.wss.close();
    serverLogger.info('[WS] Server closed');
  }
}
