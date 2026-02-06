// 消息类型
export type MessageType = 'user_input' | 'ping' | 'pong' | 'llm_output' | 'system_status' | 'client_log';

// 通用消息格式
export interface BaseMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  id: string;
}

// 用户输入
export interface UserInputPayload {
  text: string;
}

export interface UserInputMessage extends BaseMessage {
  type: 'user_input';
  payload: UserInputPayload;
}

// Ping
export interface PingMessage extends BaseMessage {
  type: 'ping';
}

// Pong
export interface PongMessage extends BaseMessage {
  type: 'pong';
}

// LLM 输出
export interface LLMOutputPayload {
  text: string;
}

export interface LLMOutputMessage extends BaseMessage {
  type: 'llm_output';
  payload: LLMOutputPayload;
  reply_to?: string;
}

// 系统状态
export interface SystemStatusPayload {
  status: 'connected' | 'disconnected' | 'error';
  message: string;
}

export interface SystemStatusMessage extends BaseMessage {
  type: 'system_status';
  payload: SystemStatusPayload;
}

export interface ClientLogEntry {
  source: 'client';
  level: string;
  message: string;
  timestamp: string;
  [key: string]: any;
}

export interface ClientLogPayload {
  connectionId: string;
  logs: ClientLogEntry[];
}

export interface ClientLogMessage extends BaseMessage {
  type: 'client_log';
  payload: ClientLogPayload;
}

// 所有消息类型
export type Message = UserInputMessage | PingMessage | PongMessage | LLMOutputMessage | SystemStatusMessage | ClientLogMessage;

// 聊天消息（用于 UI 显示）
export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: User;
  reply_to?: string;
}

export interface User {
  _id: string;
  name: string;
  avatar: string;
}

export const USER = {
  _id: 'user',
  name: '我',
  avatar: 'https://i.pravatar.cc/150?img=user',
};

export const AI_USER = {
  _id: 'ai',
  name: 'AI',
  avatar: 'https://i.pravatar.cc/150?img=bot',
};
