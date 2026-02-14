import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  ConnectionStatus,
} from '../types/connection';
import {
  APP_CONFIG,
} from '../constants/config';
import { ChatMessage } from '../types/message';

interface MessageItemProps {
  message: ChatMessage;
}

const AgentThinkingMessage = React.memo(({ message }: MessageItemProps) => (
  <View style={styles.agentContainer}>
    <View style={styles.agentHeader}>
      <Text style={styles.agentIcon}>🤖</Text>
      <Text style={styles.agentLabel}>Agent 思考中...</Text>
    </View>
    <View style={styles.thinkingContainer}>
      <Text style={styles.thinkingText}>{message.text.replace('💭 ', '')}</Text>
    </View>
  </View>
));

const AgentToolCallMessage = React.memo(({ message }: MessageItemProps) => {
  let argsText = '';
  try {
    const match = message.text.match(/\{.*\}/s);
    if (match) {
      argsText = JSON.stringify(JSON.parse(match[0]), null, 2);
    }
  } catch (e) {}

  return (
    <View style={styles.agentContainer}>
      <View style={styles.agentHeader}>
        <Text style={styles.agentIcon}>🔧</Text>
        <Text style={styles.agentLabel}>工具调用</Text>
      </View>
      <View style={styles.toolCallContainer}>
        <Text style={styles.toolName}>{message.toolName}</Text>
        {argsText ? (
          <Text style={styles.toolArgs}>{argsText}</Text>
        ) : null}
      </View>
    </View>
  );
});

const AgentToolResultMessage = React.memo(({ message }: MessageItemProps) => (
  <View style={styles.agentContainer}>
    <View style={styles.agentHeader}>
      <Text style={styles.agentIcon}>
        {message.toolSuccess ? '✅' : '❌'}
      </Text>
      <Text style={styles.agentLabel}>
        {message.toolSuccess ? '工具执行成功' : '工具执行失败'}
      </Text>
    </View>
    <View style={message.toolSuccess ? styles.successContainer : styles.errorContainer}>
      <Text style={styles.toolName}>{message.toolName}</Text>
      {message.toolError ? (
        <Text style={styles.toolError}>{message.toolError}</Text>
      ) : null}
      {message.text ? (
        <Text style={styles.toolContent}>{message.text.split('\n').slice(1).join('\n')}</Text>
      ) : null}
    </View>
  </View>
));

const UserMessage = React.memo(({ message }: MessageItemProps) => (
  <View style={styles.userMessageContainer}>
    <View style={styles.userMessageBubble}>
      <Text style={styles.userMessageText}>{message.text}</Text>
    </View>
    <Text style={styles.userMessageTime}>
      {message.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
    </Text>
  </View>
));

const AIMessage = React.memo(({ message }: MessageItemProps) => (
  <View style={styles.aiMessageContainer}>
    <View style={styles.aiMessageBubble}>
      <Text style={styles.aiMessageText}>{message.text}</Text>
    </View>
    <Text style={styles.aiMessageTime}>
      {message.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
    </Text>
  </View>
));

const MessageItem = React.memo(({ message }: MessageItemProps) => {
  switch (message.messageType) {
    case 'thinking':
      return <AgentThinkingMessage message={message} />;
    case 'tool_call':
      return <AgentToolCallMessage message={message} />;
    case 'tool_result':
      return <AgentToolResultMessage message={message} />;
    case 'ai':
      return <AIMessage message={message} />;
    default:
      return <UserMessage message={message} />;
  }
});

export const ChatScreen: React.FC = ({ navigation }: any) => {
  const { rtt, messages, isConnected, isConnecting, isReconnecting, sendMessage } =
    useWebSocket('');
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = useCallback(() => {
    if (inputText.trim() && isConnected) {
      sendMessage(inputText.trim());
      setInputText('');
    }
  }, [inputText, isConnected, sendMessage]);

  const getRTTColor = () => {
    if (rtt === 0) return '#999';
    if (rtt < APP_CONFIG.RTT_LEVELS.EXCELLENT) return '#4CAF50';
    if (rtt < APP_CONFIG.RTT_LEVELS.GOOD) return '#FFC107';
    return '#FF3B30';
  };

  const getStatusText = () => {
    if (isConnecting || isReconnecting) return '连接中...';
    if (!isConnected) return '未连接';
    return '';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusIcon}>
            {!isConnected ? '🔴' : isConnecting || isReconnecting ? '🟡' : '🟢'}
          </Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {rtt > 0 && isConnected && (
          <View style={styles.rttContainer}>
            <Text style={[styles.rttText, { color: getRTTColor() }]}>
              RTT: {rtt}ms
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg, index) => (
          <MessageItem key={`${msg._id}-${index}`} message={msg} />
        ))}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          placeholderTextColor="#999"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            !isConnected || !inputText.trim() ? styles.sendButtonDisabled : {}
          ]}
          onPress={handleSend}
          disabled={!isConnected || !inputText.trim()}
        >
          <Text style={[
            styles.sendText,
            !isConnected || !inputText.trim() ? styles.sendTextDisabled : {}
          ]}>
            发送
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  rttContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  rttText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContent: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
    marginVertical: 4,
  },
  userMessageBubble: {
    backgroundColor: '#007AFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
  },
  userMessageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    marginRight: 4,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  aiMessageBubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  aiMessageText: {
    color: '#333',
    fontSize: 15,
    lineHeight: 20,
  },
  aiMessageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
    marginLeft: 4,
  },
  agentContainer: {
    marginVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  agentIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  agentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#495057',
  },
  thinkingContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  thinkingText: {
    fontSize: 14,
    color: '#6c757d',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  toolCallContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff3cd',
  },
  successContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#d4edda',
  },
  errorContainer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f8d7da',
  },
  toolName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 6,
  },
  toolArgs: {
    fontSize: 12,
    color: '#6c757d',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  toolError: {
    fontSize: 13,
    color: '#dc3545',
    marginBottom: 6,
  },
  toolContent: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  sendTextDisabled: {
    color: '#999',
  },
});
