# LLM Remote Bridge Client

基于 React Native/Expo 的移动端客户端，用于连接本地 LLM 服务端并通过公网隧道进行实时通信。

## 快速开始

### 安装依赖

依赖已在项目创建时自动安装。如需重新安装：

```bash
cd client
npm install
```

### 运行应用

#### Web 浏览器
```bash
npm run web
```

#### iOS 模拟器
```bash
npm run ios
```

#### Android 模拟器
```bash
npm run android
```

#### 真机调试
1. 安装 Expo Go 应用
2. 扫描二维码或输入开发服务器地址

---

## 功能特性

### 连接管理
- ✅ WebSocket 连接配置
- ✅ 连接历史记录（最近 5 个 URL）
- ✅ URL 格式自动转换（https:// → wss://）
- ✅ 一键粘贴（从剪贴板）

### 聊天界面
- ✅ 完整的聊天 UI（基于 react-native-gifted-chat）
- ✅ 消息气泡区分（用户/AI）
- ✅ 自动滚动到最新消息
- ✅ 时间戳显示

### 状态监控
- ✅ 连接状态指示器
  - 🟢 已连接
  - 🟡 连接中/重连中
  - 🔴 断开/错误
- ✅ RTT 延迟显示
  - 🟢 < 100ms: 优秀
  - 🟡 100-300ms: 良好
  - 🔴 > 300ms: 较差

### 自动重连
- ✅ 断线自动重连（指数退避策略）
- ✅ 最大重试次数限制（10 次）
- ✅ 重连间隔：1s → 2s → 4s → ... → 30s

### 心跳机制
- ✅ 定时心跳保活（30 秒间隔）
- ✅ RTT 自动计算和更新
- ✅ 心跳超时检测（10 秒）

---

## 使用说明

### 连接步骤

1. **打开应用**
   - 首次打开显示连接配置页面

2. **输入服务器 URL**
   - 本地测试：`ws://localhost:3000`
   - 公网测试：从服务端复制 `https://xxx.trycloudflare.com/ws`，自动转换为 `wss://xxx.trycloudflare.com`

3. **点击"连接"按钮**
   - 等待连接成功
   - 自动跳转到聊天页面

4. **开始聊天**
   - 在输入框输入消息
   - 点击发送
   - 1-2 秒后收到 Echo 回复

### URL 格式支持

应用支持以下 URL 格式（会自动转换）：

| 输入格式 | 转换后 |
|----------|---------|
| `ws://localhost:3000` | `ws://localhost:3000` |
| `https://xxx.trycloudflare.com/ws` | `wss://xxx.trycloudflare.com` |
| `wss://xxx.trycloudflare.com` | `wss://xxx.trycloudflare.com` |
| `http://localhost:3000` | `ws://localhost:3000` |

---

## 测试场景

### 本地回环测试
1. 启动服务端：`cd server && npm run dev`
2. 客户端连接：`ws://localhost:3000`
3. 发送消息验证

### 局域网测试
1. 电脑和手机连接同一 WiFi
2. 查看电脑 IP 地址（系统设置）
3. 客户端连接：`ws://[电脑IP]:3000`

### 公网穿透测试
1. 启动服务端并开启 Tunnel
2. 复制公网 URL（`https://xxx.trycloudflare.com/ws`）
3. 手机关闭 WiFi，使用 4G/5G
4. 客户端连接粘贴的 URL

---

## 项目结构

```
client/
├── App.tsx                    # 主入口和导航
├── package.json
├── app.json
├── src/
│   ├── screens/              # 页面
│   │   ├── ConnectionScreen.tsx   # 连接配置页
│   │   └── ChatScreen.tsx        # 聊天主页
│   ├── services/             # 服务层
│   │   ├── WebSocketService.ts    # WebSocket 核心服务
│   │   └── StorageService.ts     # 本地存储
│   ├── hooks/                # React Hooks
│   │   └── useWebSocket.ts         # WebSocket 状态管理
│   ├── types/                # 类型定义
│   │   ├── message.ts             # 消息类型
│   │   └── connection.ts          # 连接状态类型
│   ├── utils/                # 工具函数
│   │   └── url.ts                  # URL 处理
│   └── constants/            # 常量
│       └── config.ts              # 配置项
```

---

## 消息协议

客户端严格按照以下协议与服务端通信：

### 发送消息

**用户输入**:
```json
{
  "type": "user_input",
  "payload": { "text": "你好" },
  "timestamp": 1704067200000,
  "id": "msg-001"
}
```

**心跳包**:
```json
{
  "type": "heartbeat",
  "payload": { "ping_time": 1704067200000 },
  "timestamp": 1704067200000,
  "id": "heartbeat-001"
}
```

### 接收消息

**LLM 响应**:
```json
{
  "type": "llm_output",
  "payload": { "text": "Echo: 你好" },
  "timestamp": 1704067201000,
  "id": "msg-002",
  "reply_to": "msg-001"
}
```

**心跳确认**:
```json
{
  "type": "heartbeat_ack",
  "payload": {
    "ping_time": 1704067200000,
    "server_time": 1704067200010
  },
  "timestamp": 1704067200010,
  "id": "msg-003"
}
```

**系统状态**:
```json
{
  "type": "system_status",
  "payload": {
    "status": "connected",
    "message": "Connection established successfully."
  },
  "timestamp": 1704067200000,
  "id": "msg-004"
}
```

---

## 故障排查

### 连接失败

**问题**: 点击"连接"后提示"连接失败"
- 检查 URL 格式是否正确
- 确认服务端正在运行
- 检查网络连接

**问题**: RTT 延迟很高（> 300ms）
- 检查网络质量
- 公网连接时检查 Tunnel 状态
- 尝试切换网络（WiFi ↔ 4G/5G）

### 消息问题

**问题**: 发送消息后没有收到回复
- 检查连接状态
- 查看服务端日志
- 确认消息格式正确

**问题**: 消息顺序混乱
- 检查网络稳定性
- 应用会自动按时间戳排序

---

## 技术栈

- **框架**: React Native + Expo SDK 51+
- **语言**: TypeScript
- **导航**: React Navigation v6
- **UI 组件**: react-native-gifted-chat
- **本地存储**: @react-native-async-storage/async-storage
- **网络**: 原生 WebSocket API

---

## 性能优化

- ✅ 长列表虚拟化（gifted-chat 内置）
- ✅ 防抖输入事件
- ✅ 节流状态更新
- ✅ 自动清理过期历史记录

---

## 下一步

1. [ ] 添加消息队列（离线缓存）
2. [ ] RTT 延迟图表
3. [ ] 暗黑模式
4. [ ] 消息搜索
5. [ ] 多语言支持
