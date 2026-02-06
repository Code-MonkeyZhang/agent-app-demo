import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import wsService from '../services/WebSocketService';
import storageService from '../services/StorageService';
import {
  ConnectionStatus,
} from '../types/connection';
import {
  DEFAULT_WS_URL,
  APP_CONFIG,
} from '../constants/config';
import {
  formatWebSocketURL,
  isValidWebSocketURL,
} from '../utils/url';

export const ConnectionScreen: React.FC = ({ navigation }: any) => {
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadConnectionHistory();
    loadCurrentURL();
  }, []);

  const loadConnectionHistory = async () => {
    const urls = await storageService.getConnectionURLs();
    setHistory(urls);
  };

  const loadCurrentURL = async () => {
    const current = await storageService.getCurrentURL();
    if (current) {
      setUrl(current);
    } else if (history.length > 0) {
      setUrl(history[0]);
    }
  };

  const handleConnect = async () => {
    if (!url.trim()) {
      Alert.alert('错误', '请输入 WebSocket URL');
      return;
    }

    if (!isValidWebSocketURL(url)) {
      Alert.alert('错误', '无效的 URL 格式，请使用 ws:// 或 wss://');
      return;
    }

    const formattedURL = formatWebSocketURL(url);
    setIsConnecting(true);

    try {
      await wsService.connect(formattedURL);
      await storageService.saveConnectionURL(formattedURL);
      await storageService.setCurrentURL(formattedURL);
      
      // 连接成功后跳转到聊天页面
      setTimeout(() => {
        navigation.replace('Chat');
      }, 500);
    } catch (error: any) {
      Alert.alert('连接失败', error.message || '未知错误');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleHistoryItemPress = (item: string) => {
    setUrl(item);
  };

  const handleRemoveHistoryItem = async (item: string) => {
    await storageService.removeConnectionURL(item);
    const updated = history.filter(u => u !== item);
    setHistory(updated);
    
    if (url === item) {
      setUrl(updated[0] || DEFAULT_WS_URL);
    }
  };

  const handleClearHistory = async () => {
    Alert.alert(
      '清空历史',
      '确定要清空所有连接历史吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearConnectionURLs();
            setHistory([]);
            setUrl(DEFAULT_WS_URL);
          },
        },
      ],
    );
  };

  const handlePaste = async () => {
    const clipboard = await import('expo-clipboard');
    const text = await clipboard.Clipboard.getStringAsync();
    if (text) {
      setUrl(text.trim());
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return '🟢';
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.RECONNECTING:
        return '🟡';
      default:
        return '🔴';
    }
  };

  const getStatusText = () => {
    if (isConnecting) return '连接中...';
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return '已连接';
      case ConnectionStatus.CONNECTING:
      case ConnectionStatus.RECONNECTING:
        return '连接中';
      case ConnectionStatus.ERROR:
        return '连接错误';
      default:
        return '未连接';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 LLM Remote Bridge</Text>
        <Text style={styles.subtitle}>配置 WebSocket 连接</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="wss://xxx.trycloudflare.com"
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          editable={!isConnecting}
        />
        <TouchableOpacity
          style={[styles.iconButton, { opacity: isConnecting ? 0.5 : 1 }]}
          onPress={handlePaste}
          disabled={isConnecting}
        >
          <Text style={styles.iconButton}>📋</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.connectButton, { opacity: isConnecting ? 0.5 : 1 }]}
        onPress={handleConnect}
        disabled={isConnecting}
      >
        <Text style={styles.connectButtonText}>
          {isConnecting ? '连接中...' : '连接'}
        </Text>
      </TouchableOpacity>

      {history.length > 0 && (
        <View style={styles.historyContainer}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>最近连接</Text>
            <TouchableOpacity onPress={handleClearHistory}>
              <Text style={styles.clearButton}>清空</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.historyList}>
            {history.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.historyItem}
                onPress={() => handleHistoryItemPress(item)}
              >
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyItemText} numberOfLines={1}>
                    {item}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveHistoryItem(item)}
                  >
                    <Text style={styles.removeButton}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          提示：连接成功后将跳转到聊天页面
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  iconButton: {
    padding: 15,
    fontSize: 20,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyContainer: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    fontSize: 14,
    color: '#FF3B30',
  },
  historyList: {
    flex: 1,
  },
  historyItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyItemText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  removeButton: {
    fontSize: 20,
    padding: 5,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
