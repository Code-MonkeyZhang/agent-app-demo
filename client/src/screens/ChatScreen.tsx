import React from 'react';
import { GiftedChat, IMessage, Send } from 'react-native-gifted-chat';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  ConnectionStatus,
} from '../types/connection';
import {
  APP_CONFIG,
} from '../constants/config';

export const ChatScreen: React.FC = ({ navigation }: any) => {
  const { rtt, messages, isConnected, isConnecting, isReconnecting, sendMessage } =
    useWebSocket('');

  const handleSend = (messages: IMessage[] = []) => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.text) {
      sendMessage(lastMessage.text);
    }
  };

  const getRTTColor = () => {
    if (rtt === 0) return '#999';
    if (rtt < APP_CONFIG.RTT_LEVELS.EXCELLENT) return '#4CAF50'; // 绿色
    if (rtt < APP_CONFIG.RTT_LEVELS.GOOD) return '#FFC107'; // 黄色
    return '#FF3B30'; // 红色
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

      <GiftedChat
        messages={messages.map(msg => ({
          _id: msg._id,
          text: msg.text,
          createdAt: msg.createdAt,
          user: msg.user,
        }))}
        onSend={handleSend}
        user={{
          _id: 'user',
          name: '我',
          avatar: 'https://i.pravatar.cc/150?img=user',
        }}
        renderUsernameOnMessage={true}
        alwaysShowSend={true}
        scrollToBottom
        disableComposer={!isConnected}
      />
    </SafeAreaView>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  statusBar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusLeft: {
    flexDirection: 'row' as const,
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
};
