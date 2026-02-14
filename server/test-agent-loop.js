import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('[Test] Connected to server');

  const testMessage = {
    type: 'user_input',
    payload: {
      text: '请帮我获取今日推荐歌曲，然后播放第一首'
    },
    timestamp: Date.now(),
    id: 'test-msg-1'
  };

  console.log('[Test] Sending test message:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'thinking':
        console.log('[Test] 💭 Thinking:', message.payload.text);
        break;
      case 'tool_call':
        console.log('[Test] 🔧 Tool Call:', message.payload.name, message.payload.arguments);
        break;
      case 'tool_result':
        console.log('[Test] ✅ Tool Result:', message.payload.success ? 'SUCCESS' : 'FAILED', message.payload.tool_name);
        break;
      case 'llm_output':
        console.log('[Test] 🤖 Final Response:', message.payload.text);
        ws.close();
        break;
      case 'system_status':
        console.log('[Test] ℹ️ System Status:', message.payload.status, message.payload.message);
        break;
      default:
        console.log('[Test] ℹ️ Other message:', message.type);
    }
  } catch (error) {
    console.error('[Test] Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('[Test] WebSocket error:', error);
});

ws.on('close', () => {
  console.log('[Test] Connection closed');
  process.exit(0);
});

setTimeout(() => {
  console.log('[Test] Test timeout');
  ws.close();
  process.exit(1);
}, 60000);
