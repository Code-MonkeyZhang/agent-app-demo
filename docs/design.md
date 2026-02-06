# LLM Remote Bridge MVP - Design Document

## 1. 项目概述 (Project Overview)

**项目名称**: LLM Remote Bridge MVP
**目标**: 验证本地大模型服务（Local LLM）与移动端（Mobile App）之间通过公网隧道进行实时通信的可行性与稳定性。
**核心价值**: 这是一个最小可行性产品（MVP），旨在打通“手机 -> 公网 -> 隧道 -> 本地电脑”的数据链路，不涉及复杂的业务逻辑，专注于连接质量测试。

## 2. 系统架构 (System Architecture)

系统采用 C/S（客户端/服务端）架构，通过 WebSocket 实现全双工通信，利用 Cloudflare Tunnel 进行内网穿透。

```mermaid
graph TD
    Mobile[📱 Mobile App (React Native)] <-->|WebSocket (WSS)| Internet((☁️ Public Internet))
    Internet <-->|Cloudflare Tunnel| Tunnel[🚇 Local Cloudflared]
    Tunnel <-->|Localhost:8080| Server[💻 Node.js Bridge Server]
    Server <-->|Function Call| MockLLM[🤖 Mock LLM Adapter]
```

### 2.1 核心组件

1.  **Mobile Client (React Native/Expo)**
    *   用户界面：简单的聊天窗口。
    *   网络层：WebSocket 客户端，负责维持连接、发送心跳、接收消息。
    *   配置：支持动态输入/扫描 WebSocket 地址。

2.  **Bridge Server (Node.js)**
    *   WebSocket Server：监听本地端口，管理客户端连接。
    *   Mock Adapter：模拟 LLM 行为（接收文本 -> 模拟延迟 -> 返回文本），用于排除模型推理性能干扰，专注于网络测试。
    *   Tunnel Manager：负责启动和管理 Cloudflare Tunnel 进程。

## 3. 技术选型 (Tech Stack)

### 3.1 服务端 (Server)
*   **Runtime**: Node.js (v18+)
*   **Language**: JavaScript / TypeScript
*   **核心依赖**:
    *   `ws`: 轻量级、高性能的 WebSocket 库，用于处理长连接。
    *   `cloudflared`: (Binary/Wrapper) 用于创建临时公网隧道。
    *   `dotenv`: 环境变量管理。
    *   `winston` (可选): 用于记录详细的连接日志和心跳日志。

### 3.2 客户端 (Client)
*   **Framework**: React Native (推荐使用 **Expo** 框架，便于快速真机调试)。
*   **Language**: TypeScript / JavaScript
*   **核心依赖**:
    *   `react-native-gifted-chat` 或 `FlatList` + Input: 快速构建聊天 UI。
    *   原生 WebSocket API: React Native 自带，无需额外重型库。
    *   `expo-status-bar`: 状态栏控制。

## 4. 通信协议 (Communication Protocol)

所有数据传输采用 JSON 格式。

### 4.1 消息结构

**通用字段**:
```json
{
  "type": "string",      // 消息类型
  "payload": "object",   // 消息内容
  "timestamp": "number", // 时间戳
  "id": "string"         // 消息唯一ID (UUID)
}
```

### 4.2 消息类型定义

#### A. 客户端发送 (Client -> Server)

1.  **用户输入 (`user_input`)**
    ```json
    {
      "type": "user_input",
      "payload": {
        "text": "你好，测试连接"
      },
      "timestamp": 1704067200000,
      "id": "msg-001"
    }
    ```

2.  **心跳包 (`heartbeat`)**
    *   用于保活和延迟检测。
    ```json
    {
      "type": "heartbeat",
      "payload": {
        "ping_time": 1704067200000
      }
    }
    ```

#### B. 服务端发送 (Server -> Client)

1.  **LLM 响应 (`llm_output`)**
    ```json
    {
      "type": "llm_output",
      "payload": {
        "text": "收到：你好，测试连接 (Echo)"
      },
      "timestamp": 1704067201000,
      "reply_to": "msg-001"
    }
    ```

2.  **心跳回执 (`heartbeat_ack`)**
    ```json
    {
      "type": "heartbeat_ack",
      "payload": {
        "ping_time": 1704067200000, // 原样返回客户端发送的时间
        "server_time": 1704067200100
      }
    }
    ```

3.  **系统状态 (`system_status`)**
    ```json
    {
      "type": "system_status",
      "payload": {
        "status": "connected",
        "message": "Tunnel established successfully."
      }
    }
    ```

## 5. 功能模块规划

### 5.1 服务端 (Server-Side)
1.  **Server Initialization**:
    *   启动 WebSocket Server (Port 3000)。
    *   启动 Cloudflare Tunnel，获取公网 URL。
    *   在控制台打印二维码或 URL 供客户端连接。
2.  **Connection Handling**:
    *   监听 `connection` 事件。
    *   维护连接池（虽然 MVP 可能只是单连接）。
3.  **Message Routing**:
    *   收到 `heartbeat` -> 立即返回 `heartbeat_ack`。
    *   收到 `user_input` -> 转发给 Mock Adapter。
4.  **Mock Adapter**:
    *   模拟 `setTimeout` (1~2秒)。
    *   返回固定格式回复（如 "Echo: [User Message]"）。

### 5.2 客户端 (Client-Side)
1.  **Connection Setup**:
    *   输入框：输入 `wss://...` 地址。
    *   连接按钮：发起 WebSocket 连接。
2.  **Chat Interface**:
    *   消息列表：渲染“我”和“AI”的消息气泡。
    *   输入框：发送文本消息。
3.  **Stability Monitor**:
    *   **连接指示灯**: 🟢已连接 / 🔴断开 / 🟡重连中。
    *   **RTT 显示**: 计算 `heartbeat_ack` 返回时间 - 发送时间，在界面角落显示延迟（ms）。
    *   **自动重连**: 网络断开后尝试自动重连。

## 6. 测试与验证流程

1.  **本地回环测试**:
    *   电脑启动 Server。
    *   电脑启动模拟器 (iOS Simulator / Android Emulator)。
    *   连接 `ws://localhost:3000` 验证基本逻辑。
2.  **局域网测试**:
    *   手机与电脑连同一 WiFi。
    *   连接 `ws://[电脑IP]:3000` 验证 WebSocket 逻辑。
3.  **公网穿透测试 (核心)**:
    *   Server 启动 Tunnel。
    *   手机**关闭 WiFi，使用 5G/4G**。
    *   连接 `wss://[cloudflared-url]`。
    *   发送消息，观察延迟和连通性。

## 7. 目录结构预览

```text
agent-app-demo/
├── server/                 # Node.js 后端
│   ├── package.json
│   ├── src/
│   │   ├── index.ts        # 入口
│   │   ├── tunnel.ts       # Cloudflare 管理
│   │   └── websocket.ts    # WS 逻辑
│   └── .env
└── client/                 # React Native (Expo) 前端
    ├── package.json
    ├── app.json
    ├── App.tsx             # 主逻辑
    └── src/
        ├── components/     # 聊天组件
        └── services/       # WebSocket 服务
```
