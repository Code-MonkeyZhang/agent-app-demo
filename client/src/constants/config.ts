import { HeartbeatConfig } from '../types/connection';

// WebSocket 配置
export const WS_CONFIG = {
  // 心跳间隔：15 秒（降低以避免 Tunnel 超时）
  HEARTBEAT_INTERVAL: 15000,
  
  // 心跳超时：禁用（移除主动超时检测，依赖 WebSocket 协议层的关闭）
  HEARTBEAT_TIMEOUT: 0, // 设为 0 表示禁用
  
  // 连接超时：10 秒（给服务端更多时间响应）
  CONNECT_TIMEOUT: 10000,

  // 重连配置
  RECONNECT_MAX_ATTEMPTS: 10,
  RECONNECT_MAX_INTERVAL: 30000, // 最大重连间隔 30 秒
  RECONNECT_INITIAL_INTERVAL: 1000, // 初始重连间隔 1 秒
} as const;

// 本地存储键
export const STORAGE_KEYS = {
  CONNECTION_URLS: 'connection_urls',
  CURRENT_URL: 'current_url',
} as const;

// 应用配置
export const APP_CONFIG = {
  // 最多保存的 URL 数量
  MAX_URL_HISTORY: 5,
  
  // RTT 等级阈值（毫秒）
  RTT_LEVELS: {
    EXCELLENT: 100,
    GOOD: 300,
  },
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  CONNECTION_FAILED: '连接失败，请检查 URL',
  CONNECTION_TIMEOUT: '连接超时',
  DISCONNECTED: '连接已断开',
  MAX_RECONNECT_ATTEMPTS: '达到最大重连次数',
  INVALID_URL: '无效的 URL 格式',
} as const;

// 默认 WebSocket URL（本地测试）
export const DEFAULT_WS_URL = 'ws://localhost:3000';
