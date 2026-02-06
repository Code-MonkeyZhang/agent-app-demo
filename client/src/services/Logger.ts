import { Platform } from 'react-native';

export interface ClientLogEntry {
  source: 'client';
  level: string;
  message: string;
  timestamp: string;
  [key: string]: any;
}

export class ConnectionLogger {
  private connId: string;
  private startTime: number;
  private messagesSent: number = 0;
  private messagesReceived: number = 0;
  private heartbeatsSent: number = 0;
  private heartbeatsReceived: number = 0;
  private isConnected: boolean = false;
  private logBuffer: ClientLogEntry[] = [];
  private sendCallback?: (logs: ClientLogEntry[]) => void;
  private timer: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor(connId: string) {
    this.connId = connId;
    this.startTime = Date.now();
    
    this.log('info', 'Connection started', {
      connectionId: connId,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
    });
  }

  setSendCallback(callback: (logs: ClientLogEntry[]) => void): void {
    this.sendCallback = callback;
    this.startPeriodicFlush();
  }

  private log(level: string, message: string, meta?: any): void {
    const logEntry: ClientLogEntry = {
      source: 'client',
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    this.logBuffer.push(logEntry);

    if (this.logBuffer.length >= this.BUFFER_SIZE) {
      this.flush();
    }
  }

  async info(message: string, meta?: any): Promise<void> {
    this.log('info', message, meta);
  }

  async error(message: string, meta?: any): Promise<void> {
    this.log('error', message, meta);
  }

  async warn(message: string, meta?: any): Promise<void> {
    this.log('warn', message, meta);
  }

  async debug(message: string, meta?: any): Promise<void> {
    this.log('debug', message, meta);
  }

  async logConnection(url: string): Promise<void> {
    await this.info('Connecting to server', { url });
  }

  async logConnected(): Promise<void> {
    this.isConnected = true;
    await this.info('Connected to server', {
      connectionDuration: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  async logPingSent(pingTime: number): Promise<void> {
    this.heartbeatsSent++;
    await this.info('Ping sent', {
      pingTime,
      pingsSent: this.heartbeatsSent,
      uptime: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  async logPongReceived(pongData: any, rtt: number): Promise<void> {
    this.heartbeatsReceived++;
    await this.info('Pong received', {
      pongTime: pongData.timestamp,
      rtt: `${rtt}ms`,
      pongsReceived: this.heartbeatsReceived,
      uptime: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  async logMessageSent(type: string, messageId: string, contentLength?: number): Promise<void> {
    this.messagesSent++;
    await this.debug('Message sent', {
      messageType: type,
      messageId,
      contentLength,
      messagesSent: this.messagesSent,
      uptime: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  async logMessageReceived(type: string, messageId: string, contentLength?: number): Promise<void> {
    this.messagesReceived++;
    await this.debug('Message received', {
      messageType: type,
      messageId,
      contentLength,
      messagesReceived: this.messagesReceived,
      uptime: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  async logDisconnected(code: number, reason: string): Promise<void> {
    const duration = Date.now() - this.startTime;
    
    await this.info('Disconnected from server', {
      closeCode: code,
      closeReason: reason,
      connectionDuration: `${(duration / 1000).toFixed(2)}s`,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      heartbeatsSent: this.heartbeatsSent,
      heartbeatsReceived: this.heartbeatsReceived,
      wasConnected: this.isConnected,
    });
    
    await this.log('info', 'Connection closed', {
      connectionId: this.connId,
    });
  }

  async logError(error: Error): Promise<void> {
    await this.error('Error occurred', {
      errorName: error.name,
      errorMessage: error.message,
      uptime: `${(Date.now() - this.startTime) / 1000}s`,
    });
  }

  private startPeriodicFlush(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.FLUSH_INTERVAL);
  }

  flush(): void {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    if (this.sendCallback) {
      this.sendCallback(logsToSend);
    }
  }

  close(): void {
    this.flush();
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
