import React, { useState, useRef } from 'react';
import { StatusBar, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, SafeAreaProvider } from 'react-native-safe-area-context';
import wsService from './src/services/WebSocketService';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
}

function AppContent() {
  const [screen, setScreen] = useState<'connection' | 'chat'>('connection');
  const [url, setUrl] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [rtt, setRTT] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // 初始化 WebSocketService 回调
  React.useEffect(() => {
    wsService.onMessage((message) => {
      if (message.type === 'llm_output') {
        addMessage(message.payload.text, false);
      } else if (message.type === 'pong') {
        // Pong 消息已经在 WebSocketService 中处理
        console.log('[App] Pong received');
      }
    });

    wsService.onStatusChange((statusInfo) => {
      switch (statusInfo.status) {
        case 'connected':
          setConnectionStatus('connected');
          addMessage('连接成功！', false);
          setTimeout(() => setScreen('chat'), 500);
          break;
        case 'connecting':
          setConnectionStatus('connecting');
          addMessage('正在连接...', false);
          break;
        case 'disconnected':
          setConnectionStatus('disconnected');
          addMessage('连接已断开', false);
          break;
        case 'error':
          setConnectionStatus('disconnected');
          addMessage(statusInfo.error || '连接错误', false);
          break;
        case 'reconnecting':
          setConnectionStatus('connecting');
          addMessage('重新连接中...', false);
          break;
      }
    });

    return () => {
      wsService.offMessage((message) => {
        if (message.type === 'llm_output') {
          addMessage(message.payload.text, false);
        }
      });
    };
  }, []);

  const connect = async () => {
    try {
      await wsService.connect(url);
    } catch (error: any) {
      addMessage(`连接失败: ${error.message}`, false);
    }
  };

  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, newMessage]);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;

    addMessage(inputText, true);
    wsService.send(inputText);
    setInputText('');
  };

  const disconnect = () => {
    wsService.disconnect();
    setConnectionStatus('disconnected');
    setMessages([]);
    setScreen('connection');
    setRTT(0);
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      default:
        return '🔴';
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      default:
        return '未连接';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FFC107';
      default:
        return '#FF3B30';
    }
  };

  const getRTTColor = () => {
    if (rtt < 100) return '#4CAF50';
    if (rtt < 300) return '#FFC107';
    return '#FF3B30';
  };

  if (screen === 'connection') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <Text style={styles.title}>📱 LLM Remote Bridge</Text>
          <Text style={styles.subtitle}>WebSocket 连接配置</Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>{getConnectionIcon()}</Text>
          <Text style={styles.statusText}>{getConnectionText()}</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>WebSocket URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="wss://xxx.trycloudflare.com/ws"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={connectionStatus === 'disconnected'}
          />
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, connectionStatus === 'connecting' ? styles.disabledButton : styles.primaryButton]}
            onPress={connect}
            disabled={connectionStatus === 'connecting'}
          >
            <Text style={styles.buttonText}>
              {connectionStatus === 'connecting' ? '连接中...' : '连接'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            提示：连接成功后将跳转到聊天页面
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.statusBar, { paddingTop: insets.top }]}>
        <View style={styles.statusLeft}>
          <Text style={styles.statusIcon}>{getConnectionIcon()}</Text>
          <Text style={styles.statusText}>{getConnectionText()}</Text>
        </View>
        {rtt > 0 && (
          <View style={styles.rttContainer}>
            <Text style={[styles.rttText, { color: getRTTColor() }]}>
              RTT: {rtt}ms
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={disconnect} style={[styles.backButton, { marginTop: insets.top }]}>
          <Text style={styles.backButtonText}>← 断开</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.messagesContainer}>
        <ScrollView 
          style={styles.messagesScroll}
          ref={scrollRef}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map(message => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.isUser ? styles.userMessage : styles.aiMessage,
              ]}
            >
              <Text style={[styles.messageText, message.isUser ? styles.userMessageText : styles.aiMessageText]}>
                {message.text}
              </Text>
              <Text style={styles.messageTime}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom }]}>
        <TextInput
          style={styles.messageInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { opacity: inputText.trim() ? 1 : 0.5 }]}
          onPress={sendMessage}
        >
          <Text style={styles.sendButtonText}>发送</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 10,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  label: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  buttonSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoSection: {
    padding: 20,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: '#999999',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rttContainer: {
    marginLeft: 20,
  },
  rttText: {
    fontSize: 12,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 15,
    marginBottom: 4,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#333333',
  },
  messageTime: {
    fontSize: 11,
    color: '#999999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
