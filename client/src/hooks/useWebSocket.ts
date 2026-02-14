import { useState, useEffect, useCallback } from 'react';
import wsService from '../services/WebSocketService';
import { ConnectionStatus, ConnectionStatusInfo } from '../types/connection';
import { Message } from '../types/message';
import { USER, AI_USER, ChatMessage } from '../types/message';

/**
 * 使用 WebSocket 的 Hook
 */
export const useWebSocket = (url: string) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [rtt, setRTT] = useState<number>(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string>('');

  const connect = useCallback(async () => {
    setError('');
    try {
      await wsService.connect(url);
    } catch (error: any) {
      setError(error.message || 'Connection failed');
    }
  }, [url]);

  const disconnect = useCallback(() => {
    wsService.disconnect();
  }, []);

  const sendMessage = useCallback((text: string) => {
    const userMessage: ChatMessage = {
      _id: `msg-${Date.now()}`,
      text,
      createdAt: new Date(),
      user: USER,
    };

    setMessages((prev) => [...prev, userMessage]);
    wsService.send(text);
  }, []);

  useEffect(() => {
    // 监听状态变化
    const handleStatusChange = (info: ConnectionStatusInfo) => {
      setStatus(info.status);
      setRTT(info.rtt || 0);
      setError(info.error || '');
    };

    // 监听消息
    const handleMessage = (message: Message) => {
      if (message.type === 'llm_output') {
        const aiMessage: ChatMessage = {
          _id: message.id,
          text: message.payload.text,
          createdAt: new Date(message.timestamp),
          user: AI_USER,
          reply_to: message.reply_to,
          messageType: 'ai',
        };

        setMessages((prev) => [...prev, aiMessage]);
      } else if (message.type === 'thinking') {
        const thinkingMessage: ChatMessage = {
          _id: message.id,
          text: `💭 ${message.payload.text}`,
          createdAt: new Date(message.timestamp),
          user: AI_USER,
          messageType: 'thinking',
        };

        setMessages((prev) => [...prev, thinkingMessage]);
      } else if (message.type === 'tool_call') {
        const toolCallMessage: ChatMessage = {
          _id: message.id,
          text: `🔧 调用工具: ${message.payload.name}`,
          createdAt: new Date(message.timestamp),
          user: AI_USER,
          messageType: 'tool_call',
          toolName: message.payload.name,
        };

        setMessages((prev) => [...prev, toolCallMessage]);
      } else if (message.type === 'tool_result') {
        const statusText = message.payload.success ? '✅ 成功' : '❌ 失败';
        const toolResultMessage: ChatMessage = {
          _id: message.id,
          text: `${statusText}: ${message.payload.tool_name}\n${message.payload.content}`,
          createdAt: new Date(message.timestamp),
          user: AI_USER,
          messageType: 'tool_result',
          toolName: message.payload.tool_name,
          toolSuccess: message.payload.success,
          toolError: message.payload.error,
        };

        setMessages((prev) => [...prev, toolResultMessage]);
      }
    };

    wsService.onStatusChange(handleStatusChange);
    wsService.onMessage(handleMessage);

    return () => {
      wsService.disconnect();
    };
  }, []);

  return {
    status,
    rtt,
    messages,
    error,
    connect,
    disconnect,
    sendMessage,
    isConnected: status === ConnectionStatus.CONNECTED,
    isConnecting: status === ConnectionStatus.CONNECTING,
    isReconnecting: status === ConnectionStatus.RECONNECTING,
  };
};
