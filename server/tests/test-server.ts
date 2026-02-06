import { WebSocketServer } from 'ws';

export class TestWebSocketServer {
  private wss: WebSocketServer | null = null;
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port });

      this.wss.on('listening', () => {
        console.log(`[Test Server] 监听端口 ${this.port}`);
        resolve();
      });

      this.wss.on('connection', (ws: WebSocket) => {
        console.log('[Test Server] 客户端已连接');

        ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(ws, message);
          } catch (error) {
            console.error('[Test Server] 解析消息失败:', error);
          }
        });

        ws.on('close', () => {
          console.log('[Test Server] 客户端已断开');
        });
      });
    });
  }

  private async handleMessage(ws: any, message: any): Promise<void> {
    switch (message.type) {
      case 'user_input':
        await this.handleUserInput(ws, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(ws, message);
        break;
      default:
        console.log('[Test Server] 未知消息类型:', message.type);
    }
  }

  private async handleUserInput(ws: WebSocket, message: any): Promise<void> {
    const delay = this.randomDelay(1000, 2000);
    
    await new Promise(resolve => setTimeout(resolve, delay));

    const response = {
      type: 'llm_output',
      payload: { text: `Echo: ${message.payload.text}` },
      timestamp: Date.now(),
      id: this.generateId(),
      reply_to: message.id
    };

    ws.send(JSON.stringify(response));
  }

  private handleHeartbeat(ws: WebSocket, message: any): void {
    const response = {
      type: 'heartbeat_ack',
      payload: {
        ping_time: message.payload.ping_time,
        server_time: Date.now()
      },
      timestamp: Date.now(),
      id: this.generateId()
    };

    ws.send(JSON.stringify(response));
  }

  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      console.log('[Test Server] 已停止');
    }
  }
}
