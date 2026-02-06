# 移动端客户端日志说明

## 📁 日志文件位置

日志文件保存在移动设备的 `documentDirectory/logs/` 目录下：

```
file:///data/user/0/com.yourapp/files/logs/
```

或 iOS:

```
file:///var/mobile/Containers/Data/Application/xxx/Documents/logs/
```

每个连接会创建一个新的日志文件，文件名格式：

```
connection-{connId}-{timestamp}.log
```

例如：
```
connection-1738686158123-abc123-2026-02-04T20-22-19-468Z.log
```

## 📋 日志内容

每个日志文件包含该连接的完整日志：

### 日志级别

| 级别 | 用途 |
|------|------|
| `info` | 重要事件（连接、心跳、断开） |
| `warn` | 警告信息 |
| `error` | 错误信息 |
| `debug` | 调试信息（消息收发） |

### 记录的事件

#### 1. 连接开始
```json
{
  "level": "info",
  "message": "Connection started",
  "timestamp": "2026-02-04T20:22:19.468Z",
  "connectionId": "conn-1738686158123-abc123",
  "platform": "ios"
}
```

#### 2. 连接到服务器
```json
{
  "level": "info",
  "message": "Connecting to server",
  "timestamp": "2026-02-04T20:22:19.469Z",
  "url": "wss://xxx.trycloudflare.com/ws"
}
```

#### 3. 连接成功
```json
{
  "level": "info",
  "message": "Connected to server",
  "timestamp": "2026-02-04T20:22:19.471Z",
  "connectionDuration": "0.003s"
}
```

#### 4. 心跳发送
```json
{
  "level": "info",
  "message": "Heartbeat sent",
  "timestamp": "2026-02-04T20:22:34.471Z",
  "pingTime": 1738686154471,
  "heartbeatsSent": 1,
  "uptime": "15.000s"
}
```

#### 5. 心跳接收
```json
{
  "level": "info",
  "message": "Heartbeat received",
  "timestamp": "2026-02-04T20:22:34.485Z",
  "pingTime": 1738686154471,
  "serverTime": 1738686154485,
  "rtt": "14ms",
  "heartbeatsReceived": 1,
  "uptime": "15.014s"
}
```

#### 6. 消息发送
```json
{
  "level": "debug",
  "message": "Message sent",
  "timestamp": "2026-02-04T20:22:40.234Z",
  "messageType": "user_input",
  "messageId": "msg-1738686160234",
  "contentLength": 120,
  "messagesSent": 1,
  "uptime": "20.763s"
}
```

#### 7. 消息接收
```json
{
  "level": "debug",
  "message": "Message received",
  "timestamp": "2026-02-04T20:22:42.456Z",
  "messageType": "llm_output",
  "messageId": "msg-1738686162456",
  "contentLength": 350,
  "messagesReceived": 1,
  "uptime": "22.985s"
}
```

#### 8. 断开连接
```json
{
  "level": "info",
  "message": "Disconnected from server",
  "timestamp": "2026-02-04T20:24:34.403Z",
  "closeCode": 1006,
  "closeReason": "",
  "connectionDuration": "134.935s",
  "messagesSent": 2,
  "messagesReceived": 1,
  "heartbeatsSent": 9,
  "heartbeatsReceived": 9,
  "wasConnected": true
}
```

#### 9. 连接关闭
```json
{
  "level": "info",
  "message": "Connection closed",
  "timestamp": "2026-02-04T20:24:34.404Z",
  "connectionId": "conn-1738686158123-abc123"
}
```

## 🔍 查看日志

### 方法1：通过应用内的日志查看功能

添加一个设置页面，显示所有日志文件：

```typescript
import * as FileSystem from 'expo-file-system';

async function getLogFiles(): Promise<string[]> {
  const logsDir = `${FileSystem.documentDirectory}logs`;
  const dirInfo = await FileSystem.getInfoAsync(logsDir);
  
  if (!dirInfo.exists) return [];
  
  const files = await FileSystem.readDirectoryAsync(logsDir);
  return files.filter(file => file.endsWith('.log'));
}

async function getLogFileContent(fileName: string): Promise<string> {
  const filePath = `${FileSystem.documentDirectory}logs/${fileName}`;
  return await FileSystem.readAsStringAsync(filePath);
}
```

### 方法2：通过 Expo Go 查看文件

1. 打开 Expo Go
2. 摇动设备
3. 点击 "Dev Tools" → "Open Debug"
4. 在浏览器控制台中执行：

```javascript
import * as FileSystem from 'expo-file-system';

const logsDir = `${FileSystem.documentDirectory}logs`;
const files = await FileSystem.readDirectoryAsync(logsDir);
console.log('Log files:', files);

const content = await FileSystem.readAsStringAsync(`${logsDir}/${files[0]}`);
console.log('Log content:', content);
```

### 方法3：通过 Android Studio/Xcode 查看文件

**Android:**
```
adb shell run-as com.yourapp ls -la files/logs/
adb shell run-as com.yourapp cat files/logs/xxx.log
```

**iOS:**
```
# 在 Xcode 中:
Window > Devices and Simulators > 选择设备 > Download Container
# 右键 .xcappdata > Show Package Contents > AppData > Documents > logs
```

### 方法4：通过文件共享功能

在 `app.json` 中配置文件共享：

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIFileSharingEnabled": true,
        "LSSupportsOpeningDocumentsInPlace": true
      }
    }
  }
}
```

然后可以在 Files 应用中查看。

## 📊 日志分析

### 检查心跳是否正常

```bash
# 统计心跳发送和接收次数
grep -c "Heartbeat sent" connection-xxx.log
grep -c "Heartbeat received" connection-xxx.log
```

### 查看连接时长

```bash
# 提取连接时长
grep "Connected to server" connection-xxx.log | jq -r '.connectionDuration'
grep "Disconnected from server" connection-xxx.log | jq -r '.connectionDuration'
```

### 查看心跳间隔

```bash
# 提取心跳发送的时间戳
grep "Heartbeat sent" connection-xxx.log | jq -r '.timestamp'
```

### 查看断开原因

```bash
# 提取断开代码和原因
grep "Disconnected from server" connection-xxx.log | jq -r '.closeCode, .closeReason'
```

## 🔧 故障排查

### 问题：没有日志文件

**检查：**
1. 是否有文件系统权限
2. `documentDirectory` 路径是否正确
3. `logs` 目录是否创建成功

**解决方案：**
```typescript
const dir = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}logs`);
console.log('Logs directory exists:', dir.exists);
```

### 问题：日志文件为空

**检查：**
1. 是否连接成功
2. 日志写入是否出错
3. 异步操作是否完成

**解决方案：**
```typescript
await logger.info('Test message');
console.log('Log file path:', await logger.getLogFilePath());
```

### 问题：心跳没有发送

**检查：**
1. `onopen` 事件是否触发
2. `startHeartbeat()` 是否被调用
3. `setInterval` 是否正常工作

**解决方案：**
在 `startHeartbeat()` 中添加更多日志。

## 📝 最佳实践

1. **每次连接都创建新日志文件**：避免日志混淆
2. **记录关键事件**：连接、心跳、消息、断开
3. **使用 JSON 格式**：便于解析和分析
4. **定期清理旧日志**：避免占用过多空间

## 📦 相关依赖

```json
{
  "dependencies": {
    "expo-file-system": "^17.0.1"
  }
}
```
