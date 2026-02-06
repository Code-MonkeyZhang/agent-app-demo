# Halo Cloudflare Tunnel 核心通信机制研究

> **注意**：本文档仅作为 `hello-halo` 项目中 Cloudflare Tunnel 实现机制的**研究分析**，用于指导后续开发，**当前暂不进行实际代码实现**。

基于 `reference/hello-halo` 源码，详细解析其核心通信流程。

## 1. 服务器端如何建立连接 (Server Setup)

Halo 的服务器端启动分为两步：先启动本地 HTTP/WebSocket 服务，再启动 Cloudflare Tunnel 将其暴露到公网。

### A. 启动本地 HTTP & WebSocket 服务
位于 `src/main/http/server.ts` 和 `src/main/http/websocket.ts`。
Halo 使用 `express` 处理 API 请求，使用 `ws` 处理实时消息，并让它们共享同一个 HTTP 端口。

**关键代码逻辑 (`server.ts` & `websocket.ts`):**

```typescript
// src/main/http/server.ts
// 1. 查找可用端口
const listenPort = await findAvailablePort(DEFAULT_PORT)

// 2. 创建 Express 应用
expressApp = express()
// ... 配置中间件 ...

// 3. 创建 HTTP Server 实例
httpServer = createServer(expressApp)

// 4. 初始化 WebSocket (挂载在同一个 Server 上)
initWebSocket(httpServer)

// 5. 启动监听
httpServer.listen(listenPort, '0.0.0.0', () => {
    console.log(`[HTTP] Server started on port ${listenPort}`)
})
```

### B. 启动 Cloudflare Tunnel
位于 `src/main/services/tunnel.service.ts`。
这是核心部分。Halo 不依赖全局安装的 `cloudflared`，而是直接调用二进制文件，并通过 `spawn` 启动子进程。

**关键代码逻辑 (`tunnel.service.ts`):**

```typescript
// src/main/services/tunnel.service.ts
import { spawn } from 'child_process'

export async function startTunnel(localPort: number): Promise<string> {
    // 1. 获取 cloudflared 二进制路径 (处理 Electron asar 路径问题)
    const binPath = await getBinaryPath()

    // 2. 启动子进程
    // 关键参数:
    // --url http://localhost:xxxx : 指向本地服务
    // --protocol http2 : 强制使用 HTTP/2 协议 (比默认的 QUIC 更稳定，穿透性更好)
    // --no-autoupdate : 禁止自动更新
    const proc = spawn(binPath, [
        'tunnel', 
        '--url', `http://localhost:${localPort}`, 
        '--protocol', 'http2', 
        '--no-autoupdate'
    ], {
        stdio: ['ignore', 'pipe', 'pipe'] // 忽略 stdin，捕获 stdout 和 stderr
    })

    // 3. 解析 Quick Tunnel URL
    // Cloudflare 不会通过 API 返回 URL，而是打印在 stderr 日志中
    proc.stderr?.on('data', (data: Buffer) => {
        const output = data.toString()
        // 正则匹配: https://xxxx-xxxx.trycloudflare.com
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/)
        if (urlMatch) {
             const url = urlMatch[0]
             console.log('[Tunnel] Got URL:', url)
             resolve(url) // 返回公网地址
        }
    })
}
```

## 2. 手机端如何接收连接 (Client Connection)

手机端（Web/WebView）拿到 `https://<随机ID>.trycloudflare.com` 后，建立两种连接。

### A. HTTP 连接 (REST API)
直接通过 HTTPS 访问 API 接口，例如登录验证。
*   **URL**: `https://<tunnel-url>/api/remote/login`
*   **Method**: `POST`

### B. WebSocket 连接
通过标准的 WebSocket 协议连接。Cloudflare Tunnel 会自动处理协议升级。
*   **URL**: `wss://<tunnel-url>/ws` (注意：Cloudflare 自动支持 HTTPS -> WSS)

**服务端处理逻辑 (`websocket.ts`):**
```typescript
// src/main/http/websocket.ts
export function initWebSocket(server: any): WebSocketServer {
    // 路径指定为 /ws
    wss = new WebSocketServer({ server, path: '/ws' })

    wss.on('connection', (ws: WebSocket) => {
        // 客户端连接成功
        console.log(`[WS] Client connected`)
        
        ws.on('message', (data) => {
            // 处理客户端发来的消息 (鉴权、订阅等)
            const message = JSON.parse(data.toString())
            handleClientMessage(client, message)
        })
    })
}
```

## 3. 双方之间如何传输数据 (Data Transmission)

Halo 采用 **基于事件的发布/订阅模式**。数据包通常是 JSON 格式。

### A. 通信协议格式
```json
{
    "type": "event",       // 消息类型
    "channel": "agent:token", // 频道 (例如: agent 产生的 token)
    "data": {              // 实际载荷
        "conversationId": "uuid-123",
        "text": "Hello"
    }
}
```

### B. 服务端广播数据 (Server -> Client)
当 AI 生成内容时，服务端通过 `broadcastToWebSocket` 函数将数据推送到对应的客户端。

**关键代码逻辑 (`websocket.ts`):**
```typescript
// src/main/http/websocket.ts
export function broadcastToWebSocket(channel: string, data: Record<string, unknown>): void {
    const conversationId = data.conversationId
    
    // 遍历所有连接的客户端
    for (const client of Array.from(clients.values())) {
        // 过滤:
        // 1. 客户端已鉴权 (authenticated)
        // 2. 客户端订阅了该对话 (subscriptions.has(conversationId))
        if (client.authenticated && client.subscriptions.has(conversationId)) {
            client.ws.send(JSON.stringify({
                type: 'event',
                channel,
                data
            }))
        }
    }
}
```

### C. 客户端发送指令 (Client -> Server)
客户端通过 WebSocket 发送控制指令（如订阅、鉴权）。

```json
// 鉴权
{ "type": "auth", "payload": { "token": "access-token-123" } }

// 订阅特定对话的更新
{ "type": "subscribe", "payload": { "conversationId": "uuid-123" } }
```

### 总结
1.  **启动**: Node.js `spawn` 启动 `cloudflared`，参数 `--protocol http2` 是稳定性的关键。
2.  **获取地址**: 通过正则解析 `stderr` 获取 `trycloudflare.com` 链接。
3.  **传输**: 使用 Express 处理控制流，WebSocket 处理数据流。服务端通过 `conversationId` 过滤，实现精准的消息推送。
