import { WebSocketServer, WebSocket } from 'ws';
import { Message, UserInputMessage, ClientLogMessage, PingMessage, PongMessage, ThinkingMessage, ToolCallMessage, ToolResultMessage } from './types.js';
import { ConnectionLogger, ClientLogger, serverLogger } from './logger.js';
import type { Agent, AgentProgress } from './agent.js';

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
  private agent: Agent;
  private connections: Map<WebSocket, ConnectionMetadata>;
  private totalConnections: number = 0;
  private totalMessagesSent: number = 0;
  private totalMessagesReceived: number = 0;

  constructor(port: number, agent: Agent) {
    this.wss = new WebSocketServer({ port });
    this.agent = agent;
    this.connections = new Map();

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
        break;
    }
  }

  private async handleUserInput(ws: WebSocket, message: UserInputMessage, connId: string): Promise<void> {
    const meta = this.connections.get(ws);

    try {
      const handleProgress = (progress: AgentProgress) => {
        switch (progress.type) {
          case 'thinking':
            this.sendThinking(ws, progress.data.text, message.id);
            break;
          case 'tool_call':
            this.sendToolCall(ws, progress.data, message.id);
            break;
          case 'tool_result':
            this.sendToolResult(ws, progress.data, message.id);
            break;
          case 'completion':
            this.sendMessage(ws, {
              type: 'llm_output',
              payload: { text: progress.data.text },
              reply_to: message.id,
            });
            break;
        }

        if (meta) {
          meta.messagesSent++;
          this.totalMessagesSent++;
          meta.lastActivity = Date.now();
        }
      };

      this.agent.setProgressCallback(handleProgress);
      const response = await this.agent.chat(message.payload.text);
      this.agent.setProgressCallback(undefined);
    } catch (error) {
      meta?.logger.error('Agent execution error', {
        error: error instanceof Error ? error.message : String(error),
      });

      await this.sendMessage(ws, {
        type: 'llm_output',
        payload: { text: '抱歉，AI 服务暂时不可用，请稍后再试。' },
        reply_to: message.id,
      });
    }
  }

  private async sendMessage(ws: WebSocket, message: any): Promise<void> {
    const fullMessage: Message = {
      type: message.type as any,
      payload: message.payload,
      timestamp: Date.now(),
      id: this.generateId(),
      reply_to: message.reply_to,
    } as any;

    const messageStr = JSON.stringify(fullMessage);
    ws.send(messageStr);

    const meta = this.connections.get(ws);
    if (meta) {
      meta.logger.debug('Message sent', {
        messageType: fullMessage.type,
        messageId: fullMessage.id,
        contentLength: messageStr.length,
      });
    }
  }

  private sendThinking(ws: WebSocket, text: string, replyTo: string): void {
    const message: ThinkingMessage = {
      type: 'thinking',
      timestamp: Date.now(),
      id: this.generateId(),
      payload: { text },
    };

    ws.send(JSON.stringify(message));

    const meta = this.connections.get(ws);
    if (meta) {
      meta.logger.debug('Thinking sent', {
        messageId: message.id,
      });
    }
  }

  private sendToolCall(ws: WebSocket, data: any, replyTo: string): void {
    const message: ToolCallMessage = {
      type: 'tool_call',
      timestamp: Date.now(),
      id: this.generateId(),
      payload: {
        id: data.id,
        name: data.name,
        arguments: data.arguments,
      },
    };

    ws.send(JSON.stringify(message));

    const meta = this.connections.get(ws);
    if (meta) {
      meta.logger.debug('Tool call sent', {
        toolName: data.name,
        messageId: message.id,
      });
    }
  }

  private sendToolResult(ws: WebSocket, data: any, replyTo: string): void {
    const message: ToolResultMessage = {
      type: 'tool_result',
      timestamp: Date.now(),
      id: this.generateId(),
      payload: {
        tool_call_id: data.tool_call_id,
        tool_name: data.tool_name,
        success: data.success,
        content: data.content,
        error: data.error,
      },
    };

    ws.send(JSON.stringify(message));

    const meta = this.connections.get(ws);
    if (meta) {
      meta.logger.debug('Tool result sent', {
        toolName: data.tool_name,
        success: data.success,
        messageId: message.id,
      });
    }
  }

  private async handlePing(ws: WebSocket, message: PingMessage, connId: string): Promise<void> {
    const response: Message = {
      type: 'pong',
      timestamp: Date.now(),
      id: this.generateId()
    };

    ws.send(JSON.stringify(response));

    const meta = this.connections.get(ws);
    if (meta) {
      meta.messagesSent++;
      this.totalMessagesSent++;

      meta.logger.debug('Pong sent', {
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
