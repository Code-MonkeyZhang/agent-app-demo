# LLM Remote Bridge - Real LLM API Integration

## 配置真实 LLM API

### 1. 编辑 `.env` 文件

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-openai-api-key
LLM_MODEL=gpt-3.5-turbo

# DeepSeek
# LLM_BASE_URL=https://api.deepseek.com/v1
# LLM_API_KEY=sk-your-deepseek-api-key
# LLM_MODEL=deepseek-chat

# 本地 Ollama
# LLM_BASE_URL=http://localhost:11434/v1
# LLM_API_KEY=ollama
# LLM_MODEL=llama2
```

### 2. 重启服务器

```bash
npm run dev
```

服务器会自动检测是否有 API KEY：
- 有 API KEY：使用真实 LLM API
- 无 API KEY：使用 Mock 模式（Echo 响应）

## 使用说明

1. **启动服务器**:
   ```bash
   cd server
   npm run dev
   ```

2. **启动客户端**:
   ```bash
   cd ../client
   npm start
   ```

3. **在手机上测试**:
   - 扫描 Expo QR 码
   - 输入服务器 URL（公网 URL 或 `ws://localhost:3000`）
   - 开始对话

## 支持的 API 格式

所有支持 **OpenAI Chat Completions API 格式**的 API 都可以使用：

- OpenAI (`gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`)
- DeepSeek (`deepseek-chat`)
- Anthropic (需要通过代理)
- 本地 Ollama (`llama2`, `mistral`, 等)
- 其他 OpenAI 兼容的 API

## API 请求格式

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "你的问题"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

## 注意事项

1. **API KEY 安全**:
   - 不要提交 `.env` 到版本控制
   - 使用环境变量或密钥管理服务

2. **成本控制**:
   - 注意 API 调用量和费用
   - 可以设置 `max_tokens` 控制响应长度

3. **网络延迟**:
   - 使用 Cloudflare Tunnel 时会有额外延迟
   - 本地网络测试可使用 `ws://localhost:3000`
