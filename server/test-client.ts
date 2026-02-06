import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('[Test] Connected to server');
  
  ws.send(JSON.stringify({
    type: 'user_input',
    payload: { text: '你好，测试连接' },
    timestamp: Date.now(),
    id: 'test-001'
  }));

  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'heartbeat',
      payload: { ping_time: Date.now() },
      timestamp: Date.now(),
      id: 'test-002'
    }));
  }, 1000);
});

ws.on('message', (data: Buffer) => {
  const message = JSON.parse(data.toString());
  console.log('[Test] Received:', JSON.stringify(message, null, 2));
});

ws.on('close', () => {
  console.log('[Test] Disconnected from server');
});

ws.on('error', (error) => {
  console.error('[Test] Error:', error);
});
