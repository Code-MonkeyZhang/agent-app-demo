export type MessageType = 'user_input' | 'ping' | 'pong' | 'llm_output' | 'system_status' | 'client_log' | 'thinking' | 'tool_call' | 'tool_result';

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
  id: string;
}

export interface UserInputPayload {
  text: string;
}

export interface UserInputMessage extends BaseMessage {
  type: 'user_input';
  payload: UserInputPayload;
}

export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

export interface LLMOutputPayload {
  text: string;
}

export interface LLMOutputMessage extends BaseMessage {
  type: 'llm_output';
  payload: LLMOutputPayload;
  reply_to?: string;
}

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

export interface ThinkingPayload {
  text: string;
}

export interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
  payload: ThinkingPayload;
}

export interface ToolCallPayload {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallMessage extends BaseMessage {
  type: 'tool_call';
  payload: ToolCallPayload;
}

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

export type Message = UserInputMessage | PingMessage | PongMessage | LLMOutputMessage | SystemStatusMessage | ClientLogMessage | ThinkingMessage | ToolCallMessage | ToolResultMessage;
