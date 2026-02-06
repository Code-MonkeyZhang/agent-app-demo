// 连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// 连接状态信息
export interface ConnectionStatusInfo {
  status: ConnectionStatus;
  rtt?: number;
  error?: string;
  url?: string;
}

// WebSocket 服务接口
export interface IWebSocketService {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(text: string): void;
  getStatus(): ConnectionStatus;
  getRTT(): number;
  onMessage(callback: (message: any) => void): void;
  onStatusChange(callback: (status: ConnectionStatusInfo) => void): void;
}

// 心跳配置
export interface HeartbeatConfig {
  interval: number; // 心跳间隔（毫秒）
  timeout: number; // 超时时间（毫秒）
}
