import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { TestWebSocketServer } from './test-server';

const WS_PORT = parseInt(process.env.TEST_PORT || '3001', 10);
const WS_URL = `ws://localhost:${WS_PORT}`;

describe('阶段 1: 基础 WebSocket 通信测试', () => {
  let testServer: TestWebSocketServer;
  let ws: WebSocket | null = null;

  beforeAll(async () => {
    console.log('\n🚀 启动测试服务器...');
    testServer = new TestWebSocketServer(WS_PORT);
    await testServer.start();
    console.log('✅ 测试服务器已启动\n');
  }, 10000);

  it('应该能连接到 WebSocket 服务器', async () => {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(WS_URL);

      ws.on('open', () => {
        console.log('✅ WebSocket 连接成功');
        resolve(true);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket 连接失败:', error);
        reject(error);
      });

      setTimeout(() => reject(new Error('连接超时')), 5000);
    });
  });

  it('应该能发送用户输入并收到 Echo 回复', async () => {
    return new Promise((resolve, reject) => {
      if (!ws) {
        reject(new Error('WebSocket 未初始化'));
        return;
      }

      const testText = `测试消息-${Date.now()}`;
      const messageId = `test-${Date.now()}`;
      const timestamp = Date.now();

      const userMessage = {
        type: 'user_input',
        payload: { text: testText },
        timestamp,
        id: messageId
      };

      ws.send(JSON.stringify(userMessage));
      console.log('📤 发送消息:', testText);

      const timeout = setTimeout(() => {
        reject(new Error('未收到 Echo 回复'));
      }, 5000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'llm_output' && message.reply_to === messageId) {
            clearTimeout(timeout);
            console.log('📥 收到回复:', message.payload.text);
            
            expect(message.payload.text).toBe(`Echo: ${testText}`);
            expect(message.reply_to).toBe(messageId);
            resolve(true);
          }
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      });
    });
  });

  it('应该能发送心跳并收到确认', async () => {
    return new Promise((resolve, reject) => {
      if (!ws) {
        reject(new Error('WebSocket 未初始化'));
        return;
      }

      const pingTime = Date.now();
      const messageId = `heartbeat-${Date.now()}`;

      const heartbeatMessage = {
        type: 'heartbeat',
        payload: { ping_time: pingTime },
        timestamp: pingTime,
        id: messageId
      };

      ws.send(JSON.stringify(heartbeatMessage));
      console.log('💓 发送心跳');

      const timeout = setTimeout(() => {
        reject(new Error('未收到心跳确认'));
      }, 3000);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'heartbeat_ack') {
            clearTimeout(timeout);
            console.log('💗 收到心跳确认');
            
            expect(message.payload.ping_time).toBe(pingTime);
            expect(message.payload.server_time).toBeGreaterThanOrEqual(pingTime);
            resolve(true);
          }
        } catch (error) {
          console.error('解析消息失败:', error);
        }
      });
    });
  });

  it('Echo 回复应该在 1-2 秒内返回', async () => {
    return new Promise((resolve, reject) => {
      const testWs = new WebSocket(WS_URL);

      testWs.on('open', () => {
        const testText = '延迟测试';
        const messageId = `latency-${Date.now()}`;
        const startTime = Date.now();

        const userMessage = {
          type: 'user_input',
          payload: { text: testText },
          timestamp: startTime,
          id: messageId
        };

        testWs.send(JSON.stringify(userMessage));
        console.log('📤 发送延迟测试消息');

        const timeout = setTimeout(() => {
          reject(new Error('Echo 回复超时'));
        }, 5000);

        testWs.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'llm_output' && message.reply_to === messageId) {
              const endTime = Date.now();
              const latency = endTime - startTime;
              
              clearTimeout(timeout);
              console.log(`⏱️  Echo 延迟: ${latency}ms`);
              
              expect(latency).toBeGreaterThanOrEqual(1000);
              expect(latency).toBeLessThanOrEqual(2000);
              
              testWs.close();
              resolve(true);
            }
          } catch (error) {
            console.error('解析消息失败:', error);
          }
        });
      });

      testWs.on('error', (error) => {
        reject(error);
      });
    });
  });

  it('应该能发送多条消息并全部收到回复', async () => {
    const messageCount = 5;
    const promises: Promise<any>[] = [];

    return new Promise((resolve, reject) => {
      const testWs = new WebSocket(WS_URL);

      testWs.on('open', () => {
        console.log(`📤 发送 ${messageCount} 条消息`);

        for (let i = 0; i < messageCount; i++) {
          const testText = `批量测试-${i}`;
          const messageId = `batch-${Date.now()}-${i}`;
          const startTime = Date.now();

          const userMessage = {
            type: 'user_input',
            payload: { text: testText },
            timestamp: startTime,
            id: messageId
          };

          testWs.send(JSON.stringify(userMessage));

          const promise = new Promise((res, rej) => {
            const timeout = setTimeout(() => {
              rej(new Error(`消息 ${i} 超时`));
            }, 5000);

            const messageHandler = (data: Buffer) => {
              try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'llm_output' && message.reply_to === messageId) {
                  clearTimeout(timeout);
                  console.log(`📥 收到回复 ${i}:`, message.payload.text);
                  testWs.removeListener('message', messageHandler);
                  res(true);
                }
              } catch (error) {
                rej(error);
              }
            };

            testWs.on('message', messageHandler);
          });

          promises.push(promise);
        }

        Promise.all(promises)
          .then(() => {
            setTimeout(() => {
              testWs.close();
              resolve(true);
            }, 1000);
          })
          .catch(reject);
      });

      testWs.on('error', reject);
    });
  });

  afterAll(() => {
    if (ws) {
      ws.close();
      console.log('🔌 WebSocket 已关闭');
    }
    if (testServer) {
      testServer.stop();
      console.log('🛑 测试服务器已停止');
    }
  });
});
