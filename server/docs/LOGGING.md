# 日志系统说明

## 📁 日志文件结构

### 每个连接一个独立日志文件

```
server/logs/
├── conn-1738686158123-abc123.log    # 连接 1 的所有日志
├── conn-1738686258456-def456.log    # 连接 2 的所有日志
├── conn-1738686359012-ghi789.log    # 连接 3 的所有日志
└── ...
```

## 📋 日志文件内容示例

每个日志文件包含该连接从建立到断开的**所有日志**：

```json
{"level":"info","message":"Connection started","timestamp":"2026-02-04 19:58:23.123"}
{"level":"info","message":"Client connected","remoteAddress":"192.168.1.100","userAgent":"Mozilla/5.0...","timestamp":"2026-02-04 19:58:23.125"}
{"level":"debug","message":"Message received","messageType":"heartbeat","messageId":"heartbeat-123","contentLength":45,"timestamp":"2026-02-04 19:58:23.130"}
{"level":"debug","message":"Heartbeat received","pingTime":1738686158000,"serverTime":1738686158005,"rtt":"5ms","timestamp":"2026-02-04 19:58:23.131"}
{"level":"debug","message":"Message sent","messageType":"heartbeat_ack","messageId":"msg-123-abc","timestamp":"2026-02-04 19:58:23.132"}
{"level":"debug","message":"Message received","messageType":"user_input","messageId":"msg-456-def","contentLength":120,"timestamp":"2026-02-04 19:58:25.234"}
{"level":"debug","message":"Message sent","messageType":"llm_output","messageId":"msg-789-ghi","contentLength":350,"timestamp":"2026-02-04 19:58:26.456"}
{"level":"info","message":"Client disconnected","closeCode":1000,"closeReason":"","connectionDuration":"5.50s","messagesSent":3,"messagesReceived":2,"lastActivityAge":"0.10s","timestamp":"2026-02-04 19:58:28.654"}
{"level":"info","message":"Connection closed","timestamp":"2026-02-04 19:58:28.655"}
```

## 🔍 查看连接日志

### 查看所有连接日志文件

```bash
ls -lh logs/conn-*.log
```

### 查看特定连接的完整日志

```bash
cat logs/conn-1738686158123-abc123.log
```

### 实时查看最新连接的日志

```bash
tail -f logs/$(ls -t logs/conn-*.log | head -1)
```

### 查看连接开始和结束

```bash
grep -E "Connection (started|closed)" logs/conn-1738686158123-abc123.log
```

### 查看连接统计信息

```bash
cat logs/conn-1738686158123-abc123.log | jq -r 'select(.message == "Client disconnected") | .connectionDuration, .messagesSent, .messagesReceived'
```

## 📊 日志级别

| 级别 | 用途 | 示例 |
|------|------|------|
| **info** | 重要事件 | 连接建立、断开、系统状态 |
| **warn** | 警告信息 | 未知消息类型 |
| **error** | 错误信息 | WebSocket 错误、LLM 错误 |
| **debug** | 调试信息 | 消息收发、心跳详情 |

## 🎯 终端输出

服务器启动时，**仅在终端输出关键信息**：

```
19:58:23.123 [info] [WS] Using real LLM API
19:58:23.124 [info] [WS] Server started on port 3000
19:58:25.456 [info] [WS] Connection started: conn-1738686158123-abc123 -> /path/to/logs/conn-1738686158123-abc123.log
19:58:28.654 [info] [WS] Connection closed: conn-1738686158123-abc123
```

## 🔧 日志配置

### 修改日志级别

在 `.env` 文件中添加：

```bash
LOG_LEVEL=debug   # 输出所有日志
LOG_LEVEL=info    # 默认
LOG_LEVEL=warn    # 只输出警告和错误
LOG_LEVEL=error   # 只输出错误
```

### 日志文件清理

清理所有旧连接日志：

```bash
rm logs/conn-*.log
```

清理超过 7 天的日志：

```bash
find logs/ -name "conn-*.log" -mtime +7 -delete
```

## 📈 诊断示例

### 场景：连接立即断开

**日志文件：** `logs/conn-xxx.log`

**查看断开原因：**
```bash
cat logs/conn-xxx.log | jq -r 'select(.message == "Client disconnected") | .closeCode, .closeReason, .connectionDuration'
```

**输出：**
```
1006
"Connection abnormal"
"0.25s"
```

### 场景：查看心跳延迟

**查找所有心跳日志：**
```bash
cat logs/conn-xxx.log | jq 'select(.message == "Heartbeat received")'
```

**输出：**
```json
{"level":"debug","message":"Heartbeat received","pingTime":1738686158000,"serverTime":1738686158005,"rtt":"5ms","timestamp":"..."}
{"level":"debug","message":"Heartbeat received","pingTime":1738686168000,"serverTime":1738686168015,"rtt":"15ms","timestamp":"..."}
```

### 场景：统计消息吞吐量

**查看发送/接收消息数：**
```bash
cat logs/conn-xxx.log | jq -r 'select(.message == "Client disconnected") | "\(.messagesSent) sent, \(.messagesReceived) received"'
```

**输出：**
```
10 sent, 8 received
```

### 场景：查看错误信息

**查找错误日志：**
```bash
cat logs/conn-xxx.log | jq 'select(.level == "error")'
```

**输出：**
```json
{"level":"error","message":"WebSocket error","errorType":"ECONNRESET","errorMessage":"Connection reset by peer","stack":"...","timestamp":"..."}
```

## 🎯 使用建议

1. **开发调试**：设置 `LOG_LEVEL=debug` 查看详细消息流
2. **生产环境**：设置 `LOG_LEVEL=info` 只记录关键事件
3. **问题诊断**：直接打开对应的 `conn-xxx.log` 文件查看完整日志
4. **性能分析**：统计多个连接的 `connectionDuration` 和消息数
5. **定期清理**：避免日志文件占用过多磁盘空间
