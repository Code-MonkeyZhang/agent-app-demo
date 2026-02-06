# 客户端日志发送到服务端 - 使用说明

## ✅ 实现完成

### 服务端改动

| 文件 | 改动内容 |
|------|----------|
| `src/types.ts` | 新增 `ClientLogMessage` 类型 |
| `src/logger.ts` | 新增 `ClientLogger` 类，保存客户端日志到 `client-{connId}.log` |
| `src/websocket.ts` | 处理 `client_log` 消息，保存客户端日志 |

### 客户端改动

| 文件 | 改动内容 |
|------|----------|
| `src/services/Logger.ts` | 改为缓冲日志，定期发送到服务端 |
| `src/services/WebSocketService.ts` | 集成日志发送，断开前发送剩余日志 |

---

## 📁 日志文件结构

```
server/logs/
├── conn-xxx.log            # 服务端日志
└── client-conn-xxx.log     # 客户端日志
```

每个连接产生两个日志文件：
- `conn-xxx.log` - 服务端视角的日志
- `client-conn-xxx.log` - 客户端视角的日志

---

## 📋 日志记录内容

### 客户端日志（client-conn-xxx.log）

| 事件 | 说明 |
|------|------|
| Connection started | 连接开始 |
| Connecting to server | 连接到服务器 |
| Connected to server | 连接成功 |
| Heartbeat sent | 心跳发送 |
| Heartbeat received | 心跳接收 |
| Message sent/received | 消息收发 |
| Disconnected from server | 断开连接 |
| Connection closed | 连接关闭 |

示例：
```json
{
  "source": "client",
  "level": "info",
  "message": "Heartbeat sent",
  "timestamp": "2026-02-04T20:22:34.471Z",
  "connectionId": "conn-xxx",
  "pingTime": 1738686154471,
  "heartbeatsSent": 1,
  "uptime": "15.000s"
}
```

### 服务端日志（conn-xxx.log）

| 事件 | 说明 |
|------|------|
| Connection started | 连接开始 |
| Client connected | 客户端连接 |
| Heartbeat received | 心跳接收 |
| Message sent/received | 消息收发 |
| Client disconnected | 客户端断开 |
| Connection closed | 连接关闭 |

示例：
```json
{
  "level": "info",
  "message": "Heartbeat received",
  "timestamp": "2026-02-04 20:22:34.485",
  "connectionId": "conn-xxx",
  "pingTime": 1738686154471,
  "serverTime": 1738686154485,
  "rtt": "14ms"
}
```

---

## 🔍 查看日志

### 方法1：直接查看文件

```bash
# 查看所有服务端日志
cat server/logs/conn-*.log

# 查看所有客户端日志
cat server/logs/client-conn-*.log
```

### 方法2：对比同一连接的日志

```bash
# 找到特定连接的日志
CONN_ID="conn-1770206908777-ochl6sdmy"

# 服务端日志
cat server/logs/${CONN_ID}.log

# 客户端日志
cat server/logs/client-${CONN_ID}.log
```

### 方法3：实时查看最新连接

```bash
# 找到最新的连接日志
LATEST_CONN=$(ls -t server/logs/conn-*.log | head -1 | xargs basename)

# 同时查看服务端和客户端日志
tail -f server/logs/${LATEST_CONN} &
tail -f server/logs/client-${LATEST_CONN} &
```

---

## 📊 日志对比分析

### 对比心跳

**服务端日志：**
```bash
grep "Heartbeat received" server/logs/client-conn-xxx.log | head -5
```

**客户端日志：**
```bash
grep "Heartbeat sent" server/logs/conn-xxx.log | head -5
```

### 对比消息数

```bash
# 客户端发送数
grep '"heartbeatsSent"' server/logs/client-conn-xxx.log | tail -1

# 服务端接收数（可以从心跳数推断）
grep "Heartbeat received" server/logs/conn-xxx.log | wc -l
```

### 对比 RTT

```bash
# 客户端计算的 RTT
grep "rtt" server/logs/client-conn-xxx.log | head -5

# 服务端计算的 RTT
grep "rtt" server/logs/conn-xxx.log | head -5
```

---

## 🧪 测试步骤

1. **启动服务端**
   ```bash
   cd agent-app-demo/server
   npm run dev
   ```

2. **启动客户端 App**
   - 连接到服务端
   - 等待 2-3 分钟

3. **查看日志**
   ```bash
   # 查看最新连接
   ls -lt server/logs/conn-*.log | head -5
   ls -lt server/logs/client-conn-*.log | head -5
   ```

4. **检查日志内容**
   ```bash
   # 客户端心跳
   grep "Heartbeat sent" server/logs/client-conn-xxx.log
   
   # 客户端心跳接收
   grep "Heartbeat received" server/logs/client-conn-xxx.log
   
   # 服务端心跳接收
   grep "Heartbeat received" server/logs/conn-xxx.log
   ```

---

## 🔧 日志发送机制

### 发送时机

| 触发条件 | 说明 |
|----------|------|
| 缓冲区满（50条） | 自动发送，减少发送次数 |
| 定时发送（30秒） | 确保日志及时上传 |
| 连接断开前 | 确保最后日志不丢失 |

### 发送失败处理

- 发送失败直接丢弃（不重试）
- 新的日志继续缓冲
- 下次发送包含未发送的日志

---

## 📝 预期结果

### 正常连接

**客户端日志（client-conn-xxx.log）：**
```json
{"source":"client","level":"info","message":"Connection started",...}
{"source":"client","level":"info","message":"Connected to server",...}
{"source":"client","level":"info","message":"Heartbeat sent","heartbeatsSent":1,...}
{"source":"client","level":"info","message":"Heartbeat received","heartbeatsReceived":1,...}
{"source":"client","level":"info","message":"Heartbeat sent","heartbeatsSent":2,...}
...
{"source":"client","level":"info","message":"Disconnected from server","closeCode":1000,...}
```

**服务端日志（conn-xxx.log）：**
```json
{"level":"info","message":"Connection started",...}
{"level":"info","message":"Client connected",...}
{"level":"info","message":"Heartbeat received",...}
{"level":"info","message":"Heartbeat received",...}
...
{"level":"info","message":"Client disconnected","closeCode":1000,...}
```

### 异常断开

**客户端日志：**
```json
{"source":"client","level":"info","message":"Heartbeat sent","heartbeatsSent":3,...}
{"source":"client","level":"info","message":"Disconnected from server","closeCode":1006,"heartbeatsSent":3,"heartbeatsReceived":3,...}
```

**服务端日志：**
```json
{"level":"info","message":"Heartbeat received",...}
{"level":"info","message":"Client disconnected","closeCode":1006,...}
```

---

## 🎯 诊断问题

### 问题：心跳没有发送

**检查客户端日志：**
```bash
grep "Heartbeat sent" server/logs/client-conn-xxx.log | wc -l
```

如果为 0，说明客户端心跳机制没有工作。

### 问题：服务端没有收到心跳

**检查服务端日志：**
```bash
grep "Heartbeat received" server/logs/conn-xxx.log | wc -l
```

如果为 0，说明消息没有到达服务端。

### 问题：RTT 异常高

**查看 RTT 值：**
```bash
grep "rtt" server/logs/client-conn-xxx.log | head -10
```

正常值：10-100ms
异常值：> 500ms

---

## 💡 下一步

连接后请告诉我：

1. **客户端日志中是否有 `Heartbeat sent` 记录？**
2. **客户端日志中 `heartbeatsSent` 的值是多少？**
3. **服务端日志中是否有 `Heartbeat received` 记录？**
4. **连接持续了多长时间？**
5. **断开代码（closeCode）是多少？**

根据这些信息，我可以进一步诊断问题！
