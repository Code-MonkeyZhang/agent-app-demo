# 移动端客户端日志功能 - 集成说明

## ✅ 已完成的工作

### 1. 安装的依赖

```bash
npm install expo-file-system
npm install expo-clipboard
```

### 2. 新增的文件

| 文件 | 说明 |
|------|------|
| `src/services/Logger.ts` | 日志记录类 |
| `src/screens/LogViewer.tsx` | 日志查看器 UI |
| `client/docs/CLIENT_LOGGING.md` | 完整日志文档 |

### 3. 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/services/WebSocketService.ts` | 集成日志记录功能 |
| `src/constants/config.ts` | 调整心跳间隔为 15 秒 |

---

## 🎯 当前状态

### WebSocketService 已集成日志功能

每次连接会：
1. 创建新的日志文件
2. 记录连接事件
3. 记录心跳发送/接收
4. 记录消息收发
5. 记录断开事件

---

## 📱 如何查看日志

### 方法1：使用 LogViewer 组件（推荐）

#### 步骤1：修改 App.tsx 添加日志入口

在 `App.tsx` 中添加：

```typescript
import LogViewer from './src/screens/LogViewer';

function AppContent() {
  const [screen, setScreen] = useState<'connection' | 'chat' | 'logs'>('connection');
  
  // ... 其他代码 ...
  
  return (
    <View style={styles.container}>
      {screen === 'logs' && <LogViewer />}
      
      {/* 其他屏幕 */}
    </View>
  );
}
```

#### 步骤2：添加日志入口按钮

在连接屏幕或聊天屏幕添加：

```typescript
<TouchableOpacity
  onPress={() => setScreen('logs')}
  style={styles.logButton}
>
  <Text>📋 查看日志</Text>
</TouchableOpacity>
```

### 方法2：通过开发工具查看

#### iOS (Safari)

1. 打开 Safari
2. 开发菜单 → 你的设备
3. 打开控制台
4. 执行：

```javascript
import * as FileSystem from 'expo-file-system';

// 列出所有日志文件
const files = await FileSystem.readDirectoryAsync(`${FileSystem.documentDirectory}logs`);
console.log('Log files:', files);

// 读取最新日志文件
const content = await FileSystem.readAsStringAsync(
  `${FileSystem.documentDirectory}logs/${files[0]}`
);
console.log('Log content:', content);
```

#### Android (Chrome)

1. 打开 Chrome
2. 访问 `chrome://inspect`
3. 找到你的设备
4. 执行相同的代码

---

## 📊 日志文件示例

### 完整日志内容

```json
{"level":"info","message":"Connection started","timestamp":"2026-02-04T20:22:19.468Z","connectionId":"conn-xxx","platform":"ios"}
{"level":"info","message":"Connecting to server","timestamp":"2026-02-04T20:22:19.469Z","url":"wss://xxx.trycloudflare.com/ws"}
{"level":"info","message":"Connected to server","timestamp":"2026-02-04T20:22:19.471Z","connectionDuration":"0.003s"}
{"level":"info","message":"Heartbeat sent","timestamp":"2026-02-04T20:22:34.471Z","pingTime":1738686154471,"heartbeatsSent":1,"uptime":"15.000s"}
{"level":"info","message":"Heartbeat received","timestamp":"2026-02-04T20:22:34.485Z","pingTime":1738686154471,"serverTime":1738686154485,"rtt":"14ms","heartbeatsReceived":1,"uptime":"15.014s"}
...
{"level":"info","message":"Disconnected from server","timestamp":"2026-02-04T20:24:34.403Z","closeCode":1006,"closeReason":"","connectionDuration":"134.935s","messagesSent":2,"messagesReceived":1,"heartbeatsSent":9,"heartbeatsReceived":9,"wasConnected":true}
{"level":"info","message":"Connection closed","timestamp":"2026-02-04T20:24:34.404Z","connectionId":"conn-xxx"}
```

---

## 🔍 关键信息解读

### 心跳统计

```json
"heartbeatsSent": 9,
"heartbeatsReceived": 9
```

- **heartbeatsSent**：客户端发送的心跳数
- **heartbeatsReceived**：收到服务端确认的心跳数

**正常情况：** 两个数字应该相等或相近

### 连接时长

```json
"connectionDuration": "134.935s"
```

- 正常连接应该在 10-30 秒内建立
- 长时间连接可能会被 Tunnel 超时

### RTT (往返时间)

```json
"rtt": "14ms"
```

- 正常：10-100ms
- 较慢：100-500ms（可能网络拥堵）
- 异常：> 500ms（网络问题）

### 断开代码

| 代码 | 含义 |
|------|------|
| 1000 | 正常关闭 |
| 1006 | 异常关闭（超时、网络断开）|
| 1001 | 服务器/客户端主动关闭 |

---

## 🧪 测试步骤

1. **启动 App**
2. **连接到服务端**
3. **等待 2-3 分钟**
4. **打开日志查看器**
5. **检查以下内容**：
   - ✓ 心跳是否正常发送（每 15 秒）
   - ✓ 心跳是否正常接收
   - ✓ RTT 是否在正常范围
   - ✓ 断开时的代码和原因

---

## 💡 预期结果

### 如果心跳正常工作

日志应该看到类似：

```
[Heartbeat sent] heartbeatsSent: 1, uptime: 15s
[Heartbeat received] rtt: 14ms
[Heartbeat sent] heartbeatsSent: 2, uptime: 30s
[Heartbeat received] rtt: 12ms
[Heartbeat sent] heartbeatsSent: 3, uptime: 45s
...
```

### 如果心跳没有发送

日志将显示：

```
[Connection started]
[Connected to server]
[Disconnected from server] heartbeatsSent: 0
```

**这说明 `startHeartbeat()` 没有被调用或失败。**

---

## 📝 下一步

### 测试后告诉我：

1. **日志文件中有心跳记录吗？**
2. **heartbeatsSent 和 heartbeatsReceived 的值是多少？**
3. **RTT 是多少？**
4. **连接持续了多长时间？**

根据这些信息，我可以进一步诊断问题！
