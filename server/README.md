# LLM Remote Bridge Server

基于 WebSocket 的本地 LLM 桥接服务端，用于验证移动端与本地 LLM 之间的实时通信。

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并根据需要修改配置：

```bash
cp .env.example .env
```

配置项：
- `PORT`: WebSocket 服务器端口（默认 3000）
- `MOCK_DELAY_MIN`: Mock LLM 最小延迟（毫秒）
- `MOCK_DELAY_MAX`: Mock LLM 最大延迟（毫秒）
- `ENABLE_TUNNEL`: 是否启用 Cloudflare Tunnel（默认 true）

### Cloudflare Tunnel 说明

服务器使用 `cloudflared` npm 包实现内网穿透，首次启动时会自动下载对应平台的二进制文件，无需手动配置。

### 运行服务器

开发模式（自动重载）：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

### 服务器启动后

如果启用 Cloudflare Tunnel（`ENABLE_TUNNEL=true`），服务器启动后会显示：

```
============================================================
🚀 SERVER STARTED SUCCESSFULLY
============================================================

📡 Local URL:
   ws://localhost:3000

🌐 Public URL (Tunnel):
   https://xxxx-xxxx.trycloudflare.com/ws

📱 Connect your mobile app to Public URL
============================================================
```

将 `https://xxxx-xxxx.trycloudflare.com/ws` 中的 `wss://xxxx-xxxx.trycloudflare.com` 用于客户端连接。

## 日志功能

服务器集成了 **Winston** 日志库，提供完善的日志记录和分析功能。

### 日志文件位置

所有日志文件保存在 `logs/` 目录下（相对 server 目录）：

```
logs/
├── combined-2026-02-04.log       # 所有日志
├── error-2026-02-04.log          # 仅错误日志
└── websocket-2026-02-04.log      # WebSocket 专用日志
```

### 日志轮转

- 每天自动创建新的日志文件（文件名包含日期）
- 单个文件最大 20MB
- `combined` 和 `websocket` 日志保留 14 天
- `error` 日志保留 30 天

### 日志级别

- **error**: 错误信息（WebSocket 错误、服务器错误）
- **warn**: 警告信息（未知消息类型、连接超时）
- **info**: 一般信息（连接、断开、心跳、统计）
- **debug**: 调试信息（消息详细内容）

### 环境变量配置

```bash
# 日志级别（默认: info）
LOG_LEVEL=info

# 开发环境会在控制台输出彩色日志
NODE_ENV=development
```

### 记录的信息

#### 连接事件
```json
{
  "level": "info",
  "message": "[WS] Client connected",
  "connectionId": "conn-1738686158123-abc123",
  "remoteAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

#### 断开事件
```json
{
  "level": "info",
  "message": "[WS] Client disconnected",
  "connectionId": "conn-1738686158123-abc123",
  "closeCode": 1000,
  "closeReason": "",
  "connectionDuration": "5.23s",
  "messagesSent": 10,
  "messagesReceived": 8,
  "lastActivityAge": "1.20s"
}
```

#### 心跳事件
```json
{
  "level": "debug",
  "message": "[WS] Heartbeat",
  "connectionId": "conn-1738686158123-abc123",
  "pingTime": 1738686162123,
  "serverTime": 1738686162135,
  "rtt": "12ms"
}
```

#### 错误事件
```json
{
  "level": "error",
  "message": "[WS] WebSocket error",
  "connectionId": "conn-1738686158123-abc123",
  "errorType": "ECONNRESET",
  "errorMessage": "Connection reset by peer",
  "stack": "..."
}
```

#### 连接统计（每分钟自动记录）
```json
{
  "level": "info",
  "message": "[WS] Connection metrics",
  "totalConnections": 25,
  "activeConnections": 3,
  "totalMessagesSent": 150,
  "totalMessagesReceived": 120
}
```

### WebSocket 关闭代码参考

| 代码 | 含义 | 说明 |
|------|------|------|
| 1000 | Normal Closure | 正常关闭 |
| 1001 | Going Away | 服务器/客户端关闭 |
| 1002 | Protocol Error | 协议错误 |
| 1003 | Unsupported Data | 不支持的数据类型 |
| 1005 | No Status Received | 没有收到关闭状态 |
| 1006 | Abnormal Closure | 异常关闭（连接断开） |
| 1008 | Policy Violation | 违反策略 |
| 1009 | Message Too Big | 消息过大 |
| 1010 | Mandatory Extension | 缺少必需扩展 |
| 1011 | Internal Error | 服务器内部错误 |
| 1012 | Service Restart | 服务重启 |
| 1013 | Try Again Later | 稍后重试 |

### 查看日志

实时查看所有日志：
```bash
tail -f logs/combined-*.log
```

仅查看错误日志：
```bash
tail -f logs/error-*.log
```

查看 WebSocket 连接日志：
```bash
tail -f logs/websocket-*.log
```

### 日志分析

使用 `jq` 分析 JSON 格式日志：

统计断开原因分布：
```bash
cat logs/websocket-*.log | jq -r 'select(.message == "[WS] Client disconnected") | .closeCode' | sort | uniq -c
```

查找特定连接的所有日志：
```bash
cat logs/combined-*.log | jq 'select(.connectionId == "conn-1738686158123-abc123")'
```

统计连接时长分布：
```bash
cat logs/websocket-*.log | jq -r 'select(.message == "[WS] Client disconnected") | .connectionDuration' | sed 's/s$//' | awk '{if($1<10) count1++; else if($1<60) count2++; else count3++} END {print "<10s: "count1", 10-60s: "count2", >60s: "count3}'
```

## 消息协议

### 消息格式

所有消息遵循以下通用格式：

```typescript
{
  type: MessageType;
  payload: object;
  timestamp: number;
  id: string;
}
```

### 消息类型

#### 客户端 -> 服务端

**user_input**: 用户输入文本
```json
{
  "type": "user_input",
  "payload": { "text": "你好，测试连接" },
  "timestamp": 1704067200000,
  "id": "msg-001"
}
```

**heartbeat**: 心跳保活
```json
{
  "type": "heartbeat",
  "payload": { "ping_time": 1704067200000 }
}
```

#### 服务端 -> 客户端

**llm_output**: LLM 响应
```json
{
  "type": "llm_output",
  "payload": { "text": "Echo: 你好，测试连接" },
  "timestamp": 1704067201000,
  "reply_to": "msg-001"
}
```

**heartbeat_ack**: 心跳回执
```json
{
  "type": "heartbeat_ack",
  "payload": {
    "ping_time": 1704067200000,
    "server_time": 1704067200100
  }
}
```

**system_status**: 系统状态
```json
{
  "type": "system_status",
  "payload": {
    "status": "connected",
    "message": "Connection established successfully."
  }
}
```

## 测试

### 快速测试

运行测试客户端验证服务器功能：

```bash
npx tsx test-client.ts
```

### 自动化测试（Vitest）

本项目使用 **Vitest** 作为测试框架，包含完整的自动化测试用例。

**运行所有测试**:
```bash
npm test
```

**运行特定阶段测试**:
```bash
npm run test:stage1    # 阶段 1: WebSocket 通信测试
npm run test:stage2    # 阶段 2: Cloudflare Tunnel 测试
```

**使用 UI 界面查看测试**:
```bash
npm run test:ui
```

### 测试覆盖范围

#### 阶段 1: 基础 WebSocket 通信测试
- ✅ WebSocket 连接测试
- ✅ 用户输入消息发送和 Echo 回复测试
- ✅ 心跳机制测试
- ✅ Mock LLM 延迟测试（1-2秒）
- ✅ 批量消息处理测试

#### 阶段 2: Cloudflare Tunnel 集成测试
- ✅ Tunnel 初始化测试
- ✅ Tunnel 启动和公网 URL 获取测试
- ✅ Tunnel 进程管理测试
- ✅ 重复启动/停止测试
- ✅ 端到端消息流测试

### 测试输出示例

```
🚀 启动测试服务器...
[Test Server] 监听端口 3001
✅ 测试服务器已启动

✅ WebSocket 连接成功
📤 发送消息: 测试消息-123
📥 收到回复: Echo: 测试消息-123
💓 发送心跳
💗 收到心跳确认
⏱️  Echo 延迟: 1423ms

 Test Files  2 passed (2)
     Tests  10 passed (10)
  Start at  12:00:00
  Duration  5.23s (transform 1.23ms, setup 0ms, collect 0ms, tests 5.23s)
```

## 项目结构

```
server/
├── src/
│   ├── index.ts        # 入口文件
│   ├── types.ts        # 类型定义
│   ├── mock-adapter.ts # Mock LLM 适配器
│   ├── websocket.ts    # WebSocket 处理逻辑
│   └── tunnel.ts       # Cloudflare Tunnel 管理
├── test-client.ts      # 测试客户端
├── package.json
├── tsconfig.json
└── .env
```
