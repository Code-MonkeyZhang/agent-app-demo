// 消息类型
export type MessageType = 'user_input' | 'ping' | 'pong' | 'llm_output' | 'system_status' | 'client_log' | 'thinking' | 'tool_call' | 'tool_result';

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

// 思考状态
export interface ThinkingPayload {
  text: string;
}

export interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
  payload: ThinkingPayload;
}

// 工具调用
export interface ToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallMessage extends BaseMessage {
  type: 'tool_call';
  payload: ToolCallPayload;
}

// 工具执行结果
export interface ToolResultPayload {
  tool_call_id: string;
  tool_name: string;
  success: boolean;
  content: string;
  error?: string;
}

export interface ToolResultMessage extends BaseMessage {
  type: 'tool_result';
  payload: ToolResultPayload;
}

// 所有消息类型
export type Message = UserInputMessage | PingMessage | PongMessage | LLMOutputMessage | SystemStatusMessage | ClientLogMessage | ThinkingMessage | ToolCallMessage | ToolResultMessage;

// 聊天消息（用于 UI 显示）
export type ChatMessageType = 'user' | 'ai' | 'thinking' | 'tool_call' | 'tool_result';

export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: User;
  reply_to?: string;
  messageType?: ChatMessageType;
  toolName?: string;
  toolSuccess?: boolean;
  toolError?: string;
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
