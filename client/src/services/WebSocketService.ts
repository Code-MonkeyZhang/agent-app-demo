import {
  WS_CONFIG,
  ERROR_MESSAGES,
} from '../constants/config';
import {
  ConnectionStatus,
  IWebSocketService,
  ConnectionStatusInfo,
} from '../types/connection';
import { Message } from '../types/message';
import { ConnectionLogger } from './Logger';

/**
 * WebSocket 服务类
 * 殡理连接、消息收发、心跳和自动重连
 */
export class WebSocketService implements IWebSocketService {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private rtt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private url: string = '';
  private logger: ConnectionLogger | null = null;
  private connId: string = '';
  private lastPingTime: number = 0;

  private messageCallbacks: ((message: Message) => void)[] = [];
  private statusCallbacks: ((status: ConnectionStatusInfo) => void)[] = [];
  private rttCallbacks: ((rtt: number) => void)[] = [];

  constructor() {
    // Event polyfill for React Native
    this.ws = null;
  }

  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 连接到 WebSocket 服务器
   */
  async connect(url: string): Promise<void> {
    if (this.status === ConnectionStatus.CONNECTED) {
      console.warn('[WS] Already connected');
      return;
    }

    this.url = url;
    this.connId = this.generateConnectionId();
    this.logger = new ConnectionLogger(this.connId);
    
    await this.logger.logConnection(url);
    
    this.setStatus(ConnectionStatus.CONNECTING);

    try {
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      await this.logger?.logError(error as Error);
      console.error('[WS] Connection error:', error);
      this.setStatus(ConnectionStatus.ERROR, ERROR_MESSAGES.CONNECTION_FAILED);
      this.startReconnect();
    }
  }

  /**
   * 设置 WebSocket 事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    // 连接超时
    const timeout = setTimeout(() => {
      if (this.status === ConnectionStatus.CONNECTING) {
        console.error('[WS] Connection timeout');
        this.ws?.close();
        this.setStatus(ConnectionStatus.ERROR, ERROR_MESSAGES.CONNECTION_TIMEOUT);
      }
    }, WS_CONFIG.CONNECT_TIMEOUT);

    this.ws.onopen = () => {
      clearTimeout(timeout);
      console.log('[WS] Connected');
      this.logger?.logConnected();
      
      if (this.logger && this.ws) {
        this.logger.setSendCallback((logs) => {
          this.sendLogsToServer(logs);
        });
      }
      
      this.setStatus(ConnectionStatus.CONNECTED);
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data) as Message;
        
        // 处理 Pong 消息（计算 RTT）
        if (message.type === 'pong' && this.lastPingTime > 0) {
          const rtt = message.timestamp - this.lastPingTime;
          this.rtt = rtt;
          this.rttCallbacks.forEach(callback => callback(rtt));
          console.log(`[WS] Pong received, RTT: ${rtt}ms`);
          await this.logger?.logHeartbeatReceived(message, rtt);
        } else {
          await this.logger?.logMessageReceived(message.type, message.id, event.data.length);
        }
        
        this.handleMessage(message);
      } catch (error) {
        console.error('[WS] Failed to parse message:', error);
      }
    };

    this.ws.onclose = async (event) => {
      clearTimeout(timeout);
      console.log('[WS] Closed:', event.code, event.reason);
      await this.logger?.logDisconnected(event.code, event.reason || '');
      this.logger?.flush();
      this.logger?.close();
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.stopPing();
      this.startReconnect();
    };

    this.ws.onerror = async (error) => {
      console.error('[WS] Error:', error);
      const errorObj = new Error(error?.toString?.() || 'Unknown error');
      await this.logger?.logError(errorObj);
      this.setStatus(ConnectionStatus.ERROR, errorObj.message);
    };
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'system_status':
        console.log('[WS] System status:', message.payload);
        break;
      
      case 'llm_output':
        this.messageCallbacks.forEach(callback => callback(message));
        console.log('[WS] Received LLM output:', message.payload.text);
        break;
      
      case 'pong':
        // Pong 已经在 onmessage 中处理，这里不做任何事情
        break;
      
      default:
        console.log('[WS] Unknown message type:', message.type);
    }
  }

  /**
   * 开始 Ping（简单的心跳机制）
   */
  private startPing(): void {
    this.stopPing();

    const sendPing = () => {
      if (!this.ws || this.status !== ConnectionStatus.CONNECTED) return;

      const ping: Message = {
        type: 'ping',
        timestamp: Date.now(),
        id: `ping-${Date.now()}`,
      };

      this.lastPingTime = ping.timestamp;
      this.ws.send(JSON.stringify(ping));
      console.log('[WS] Ping sent');
      this.logger?.logPingSent(ping.timestamp);
    };

    // 立即发送第一次
    sendPing();

    // 然后定期发送
    this.pingTimer = setInterval(
      sendPing,
      WS_CONFIG.HEARTBEAT_INTERVAL,
    );
  }

  /**
   * 停止 Ping
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * 开始重连（指数退避策略）
   */
  private startReconnect(): void {
    if (this.reconnectAttempts >= WS_CONFIG.RECONNECT_MAX_ATTEMPTS) {
      console.log('[WS] Max reconnection attempts reached');
      this.setStatus(ConnectionStatus.ERROR, ERROR_MESSAGES.MAX_RECONNECT_ATTEMPTS);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      WS_CONFIG.RECONNECT_INITIAL_INTERVAL * Math.pow(2, this.reconnectAttempts - 1),
      WS_CONFIG.RECONNECT_MAX_INTERVAL,
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      if (this.status !== ConnectionStatus.CONNECTED) {
        this.setStatus(ConnectionStatus.RECONNECTING);
        await this.connect(this.url);
      }
    }, delay);
  }

  /**
   * 停止重连
   */
  stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }

  /**
   * 设置连接状态
   */
  private setStatus(
    status: ConnectionStatus,
    error?: string,
  ): void {
    this.status = status;
    const info = {
      status,
      rtt: this.rtt,
      error,
      url: this.url,
    } as ConnectionStatusInfo;
    this.statusCallbacks.forEach(callback => callback(info));
  }

  /**
   * 发送文本消息
   */
  async send(text: string): Promise<void> {
    if (!this.ws || this.status !== ConnectionStatus.CONNECTED) {
      console.warn('[WS] Cannot send message: not connected');
      return;
    }

    const message = {
      type: 'user_input',
      payload: { text },
      timestamp: Date.now(),
      id: `msg-${Date.now()}`,
    };

    const messageStr = JSON.stringify(message);
    this.ws.send(messageStr);
    console.log('[WS] Sent:', text);
    await this.logger?.logMessageSent('user_input', message.id, messageStr.length);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopReconnect();
    this.stopPing();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus(ConnectionStatus.DISCONNECTED);
    console.log('[WS] Disconnected');
    this.logger = null;
  }

  /**
   * 发送日志到服务器
   */
  private sendLogsToServer(logs: any[]): void {
    if (!this.ws || this.status !== ConnectionStatus.CONNECTED) return;

    const logMessage = {
      type: 'client_log',
      payload: {
        connectionId: this.connId,
        logs,
      },
      timestamp: Date.now(),
      id: `log-${Date.now()}`,
    };

    try {
      this.ws.send(JSON.stringify(logMessage));
    } catch (error) {
      console.error('[WS] Failed to send logs:', error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopReconnect();
    this.stopHeartbeat();
    
    this.logger?.flush();
    this.logger?.close();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus(ConnectionStatus.DISCONNECTED);
    console.log('[WS] Disconnected');
    this.logger = null;
  }

  /**
   * 获取当前状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 获取当前 RTT
   */
  getRTT(): number {
    return this.rtt;
  }

  /**
   * 注册消息回调
   */
  onMessage(callback: (message: any) => void): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: Message): void {
    switch (message.type) {
      case 'user_input':
        // 不处理，这是客户端发送的
        break;
      
      case 'llm_output':
        this.messageCallbacks.forEach(callback => callback(message));
        console.log('[WS] Received LLM output:', message.payload.text);
        break;
      
      case 'pong':
        // Pong 消息已经在上面的 onmessage 中处理
        break;
      
      case 'system_status':
        console.log('[WS] System status:', message.payload);
        break;
      
      default:
        console.log('[WS] Unknown message type:', message.type);
    }
  }

  /**
   * 注册状态变化回调
   */
  onStatusChange(callback: (status: ConnectionStatusInfo) => void): void {
    this.statusCallbacks.push(callback);
  }

  /**
   * 取消注册状态变化回调
   */
  offStatusChange(callback: (status: ConnectionStatusInfo) => void): void {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  /**
   * 注册 RTT 更新回调
   */
  onRTTUpdate(callback: (rtt: number) => void): void {
    this.rttCallbacks.push(callback);
  }

  /**
   * 取消注册 RTT 更新回调
   */
  offRTTUpdate(callback: (rtt: number) => void): void {
    this.rttCallbacks = this.rttCallbacks.filter(cb => cb !== callback);
  }
}

// 导出单例
const wsService = new WebSocketService();
export default wsService;
