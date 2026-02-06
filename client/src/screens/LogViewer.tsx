import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  [key: string]: any;
}

export default function LogViewer() {
  const [logFiles, setLogFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const loadLogFiles = async () => {
    try {
      setLoading(true);
      const logsDir = `${FileSystem.documentDirectory}logs`;
      const dirInfo = await FileSystem.getInfoAsync(logsDir);
      
      if (!dirInfo.exists) {
        setLogFiles([]);
        return;
      }
      
      const files = await FileSystem.readDirectoryAsync(logsDir);
      const logFiles = files.filter(file => file.endsWith('.log'));
      
      // 按修改时间排序，最新的在前面
      const fileDetails = await Promise.all(
        logFiles.map(async (file) => {
          const fileInfo = await FileSystem.getInfoAsync(`${logsDir}/${file}`);
          return { name: file, modificationTime: fileInfo.modificationTime || 0 };
        })
      );
      
      fileDetails.sort((a, b) => b.modificationTime - a.modificationTime);
      setLogFiles(fileDetails.map(f => f.name));
    } catch (error) {
      console.error('Failed to load log files:', error);
      Alert.alert('错误', '加载日志文件失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogFile = async (fileName: string) => {
    try {
      setLoading(true);
      const filePath = `${FileSystem.documentDirectory}logs/${fileName}`;
      const content = await FileSystem.readAsStringAsync(filePath);
      const lines = content.trim().split('\n');
      const entries = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { level: 'info', message: line, timestamp: new Date().toISOString() };
        }
      });
      setLogContent(entries);
      setSelectedFile(fileName);
    } catch (error) {
      console.error('Failed to load log file:', error);
      Alert.alert('错误', '加载日志内容失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteLogFile = async (fileName: string) => {
    try {
      const filePath = `${FileSystem.documentDirectory}logs/${fileName}`;
      await FileSystem.deleteAsync(filePath);
      
      if (selectedFile === fileName) {
        setSelectedFile(null);
        setLogContent([]);
      }
      
      await loadLogFiles();
      Alert.alert('成功', `已删除日志文件: ${fileName}`);
    } catch (error) {
      console.error('Failed to delete log file:', error);
      Alert.alert('错误', '删除日志文件失败');
    }
  };

  const copyLogToClipboard = async () => {
    if (!selectedFile || logContent.length === 0) return;
    
    const content = logContent.map(entry => JSON.stringify(entry)).join('\n');
    
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert('成功', '日志已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      Alert.alert('错误', '复制失败');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return '#ff3b30';
      case 'warn': return '#ffcc00';
      case 'info': return '#007aff';
      case 'debug': return '#8e8e93';
      default: return '#000000';
    }
  };

  useEffect(() => {
    loadLogFiles();
  }, []);

  return (
    <View style={styles.container}>
      {!selectedFile ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>日志文件</Text>
            <TouchableOpacity onPress={loadLogFiles} style={styles.button}>
              <Text style={styles.buttonText}>刷新</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color="#007aff" />
          ) : logFiles.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>暂无日志文件</Text>
            </View>
          ) : (
            <ScrollView style={styles.fileList}>
              {logFiles.map((fileName) => (
                <View key={fileName} style={styles.fileItem}>
                  <TouchableOpacity
                    style={styles.fileInfo}
                    onPress={() => loadLogFile(fileName)}
                  >
                    <Text style={styles.fileName}>{fileName}</Text>
                    <Text style={styles.fileAction}>查看</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteLogFile(fileName)}
                  >
                    <Text style={styles.deleteText}>删除</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.button}>
              <Text style={styles.buttonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{selectedFile}</Text>
            <TouchableOpacity onPress={copyLogToClipboard} style={styles.button}>
              <Text style={styles.buttonText}>复制</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color="#007aff" />
          ) : (
            <ScrollView style={styles.logContainer}>
              {logContent.map((entry, index) => (
                <View key={index} style={styles.logEntry}>
                  <View style={styles.logHeader}>
                    <Text style={[styles.logLevel, { color: getLevelColor(entry.level) }]}>
                      [{entry.level.toUpperCase()}]
                    </Text>
                    <Text style={styles.logTime}>
                      {new Date(entry.timestamp).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                  <Text style={styles.logMessage}>{entry.message}</Text>
                  {Object.entries(entry).filter(([key]) => !['level', 'message', 'timestamp'].includes(key)).map(([key, value]) => (
                    <Text key={key} style={styles.logMeta}>
                      {key}: {JSON.stringify(value)}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007aff',
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8e8e93',
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 14,
    color: '#000',
  },
  fileAction: {
    fontSize: 12,
    color: '#007aff',
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff3b30',
    borderRadius: 6,
    marginLeft: 8,
  },
  deleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    padding: 12,
  },
  logEntry: {
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  logTime: {
    fontSize: 11,
    color: '#8e8e93',
  },
  logMessage: {
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
  },
  logMeta: {
    fontSize: 11,
    color: '#8e8e93',
    marginLeft: 16,
  },
});
