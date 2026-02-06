# LLM Remote Bridge MVP - 分阶段实现计划

## 阶段 1: 基础服务端搭建（本地回环验证） ✅ 已完成

### 目标
验证核心通信逻辑在本地环境是否可行

### 实现内容
- ✅ 初始化 Node.js 项目，配置 TypeScript
- ✅ 实现 WebSocket Server（使用 `ws` 库）
- ✅ 实现基础消息协议（user_input, heartbeat, llm_output）
- ✅ 实现简单的 Mock LLM Adapter（固定延迟 + Echo 回复）

### 测试
✅ 使用测试客户端验证所有消息协议正常工作
- system_status: 连接建立后自动发送
- heartbeat_ack: 服务器正确回复心跳包
- llm_output: Mock LLM 返回 Echo 回复，包含 reply_to 字段

✅ **自动化测试（Vitest）**
- 使用 Vitest 测试框架实现完整的自动化测试
- 测试范围：
  - WebSocket 连接测试
  - 消息收发测试
  - 心跳机制测试
  - Mock LLM 延迟测试
  - 批量消息处理测试

运行测试命令：
```bash
npm run test:stage1    # 运行阶段 1 测试
npm test              # 运行所有测试
npm run test:ui       # 使用 UI 界面查看测试
```

### 关键产出
✅ 可运行的本地 WebSocket 服务
- 项目位置: `server/`
- 启动命令: `npm run dev`
- 端口: 3000
- 测试框架: Vitest
- 测试文件: `tests/stage1-websocket.test.ts`

---

## 阶段 2: Cloudflare Tunnel 集成 ✅ 已完成

### 目标
建立内网穿透能力

### 实现内容
- ✅ 使用 `cloudflared` npm 包集成二进制文件
- ✅ 使用 `child_process.spawn` 启动 tunnel 进程（参数：`--protocol http2 --no-autoupdate`）
- ✅ 解析 stderr 输出，提取 `trycloudflare.com` URL
- ✅ 在控制台打印公网 URL（方便客户端输入）
- ✅ 实现 Tunnel 进程管理（启动、关闭、异常处理）
- ✅ 首次运行时自动下载对应平台的 cloudflared 二进制文件

### 关键产出
✅ 公网可访问的 WebSocket URL
- Cloudflare Tunnel 类：`server/src/tunnel.ts`
- 使用 npm 包：`cloudflared@0.7.1`
- 自动下载：`cloudflared.install()`

✅ **自动化测试（Vitest）**
- 使用 Vitest 测试框架实现 Tunnel 自动化测试
- 测试范围：
  - Tunnel 初始化测试
  - Tunnel 启动和公网 URL 获取测试
  - Tunnel 进程管理测试
  - 重复启动/停止测试
  - 端到端消息流测试

运行测试命令：
```bash
npm run test:stage2    # 运行阶段 2 测试
npm test               # 运行所有测试
npm run test:ui        # 使用 UI 界面查看测试
```

---

## 阶段 3: 移动端客户端开发（React Native/Expo） ✅ 已完成

### 目标
实现完整的聊天 UI 和连接管理

### 实现内容
- ✅ 创建 Expo 项目（TypeScript + 空白模板）
- ✅ 实现聊天界面（使用 react-native-gifted-chat）
  - 消息列表（用户/AI 消息区分）
  - 底部输入框
  - 发送按钮
- ✅ 实现 WebSocket 连接服务
  - 连接管理（连接、断开、重连）
  - 消息收发（JSON 格式化）
  - 事件驱动的状态更新
- ✅ 实现心跳机制
  - 定时心跳（30 秒间隔）
  - RTT 延迟计算
  - 心跳超时检测
- ✅ 实现连接状态指示器
  - 🟢 已连接
  - 🔴 断开/错误
  - 🟡 连接中/重连中
  - RTT 实时显示（带颜色等级）
- ✅ 实现自动重连逻辑
  - 指数退避策略（1s → 2s → 4s → ... → 30s）
  - 最大重试次数限制（10 次）
  - 手动取消重连支持

### 额外功能
- ✅ 连接配置界面（URL 输入 + 历史记录）
- ✅ URL 格式自动转换（https:// → wss://）
- ✅ 连接历史记录（最近 5 个 URL，本地存储）
- ✅ 一键粘贴（从剪贴板）
- ✅ React Navigation v6 路由集成
- ✅ Safe Area Context 适配
- ✅ 启动动画

### 关键产出
✅ 可连接服务端的移动应用
- 项目位置: `client/`
- 技术栈: Expo + TypeScript + React Navigation
- UI 组件: react-native-gifted-chat
- 运行命令: `npm run web` / `npm run ios` / `npm run android`

### 文件结构
```
client/
├── App.tsx                      # 主入口 + 导航配置
├── src/
│   ├── screens/
│   │   ├── ConnectionScreen.tsx   # 连接配置页
│   │   └── ChatScreen.tsx        # 聊天主页
│   ├── services/
│   │   ├── WebSocketService.ts    # WebSocket 核心服务
│   │   └── StorageService.ts     # 本地存储服务
│   ├── hooks/
│   │   └── useWebSocket.ts         # WebSocket 状态 Hook
│   ├── types/
│   │   ├── message.ts             # 消息类型定义
│   │   └── connection.ts          # 连接状态类型
│   ├── utils/
│   │   └── url.ts                  # URL 处理工具
│   └── constants/
│       └── config.ts              # 配置常量
```

---

## 阶段 4: 端到端测试与优化

### 目标
验证完整链路的稳定性和性能

### 测试内容
- 本地回环测试
- 局域网测试（手机 + 同 WiFi）
- 公网穿透测试（手机 + 4G/5G，关闭 WiFi）

### 优化项
- 心跳间隔调优
- 连接超时和重连策略
- 日志记录（使用 winston）
- 错误处理和异常恢复

### 关键产出
MVP 完整验证报告

---

### 阶段划分逻辑
- 阶段 1-2 先建立服务端能力，确保服务可用
- 阶段 3 开发客户端，与服务端联调
- 阶段 4 进行完整测试，验证 MVP 目标
