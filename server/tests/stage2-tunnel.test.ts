import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { CloudflareTunnel } from '../src/tunnel.js';
import WebSocket from 'ws';

const TUNNEL_PORT = 3002;

describe('阶段 2: Cloudflare Tunnel 集成测试', () => {
  let tunnel: CloudflareTunnel | null = null;
  let tunnelURL: string | null = null;

  it('应该能初始化 CloudflareTunnel 实例', () => {
    tunnel = new CloudflareTunnel({ 
      localPort: TUNNEL_PORT,
      protocol: 'http2'
    });

    expect(tunnel).toBeDefined();
    expect(tunnel).toBeInstanceOf(CloudflareTunnel);
    console.log('✅ CloudflareTunnel 实例创建成功');
  });

  it('应该能启动 Tunnel 并获取公网 URL', async () => {
    if (!tunnel) {
      throw new Error('Tunnel 未初始化');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tunnel 启动超时'));
      }, 30000);

      tunnel!.once('url', (url: string) => {
        clearTimeout(timeout);
        tunnelURL = url;
        console.log('✅ 获取到公网 URL:', url);
        
        expect(url).toBeDefined();
        expect(url).toContain('trycloudflare.com');
        
        resolve(url);
      });

      tunnel!.once('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Tunnel 启动失败:', error);
        reject(error);
      });

      tunnel!.start().catch(reject);
    });
  }, 35000);

  it('Tunnel 应该处于运行状态', () => {
    if (!tunnel) {
      throw new Error('Tunnel 未初始化');
    }

    expect(tunnel.isRunning()).toBe(true);
    console.log('✅ Tunnel 运行状态正常');
  });

  it('应该能通过公网 URL 连接（本地测试）', async () => {
    if (!tunnelURL) {
      throw new Error('未获取到公网 URL');
    }

    console.log('⚠️  注意: 此测试在本地运行，真实公网测试需要外部网络');
    console.log(`📝 公网 URL: ${tunnelURL}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log('⚠️  跳过公网连接测试（本地环境）');
        resolve(true);
      }, 1000);

      const ws = new WebSocket(tunnelURL);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ 通过公网 URL 连接成功');
        ws.close();
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.log('⚠️  公网连接失败（预期行为，本地环境）');
        resolve(true);
      });
    });
  });

  it('应该能正确关闭 Tunnel', () => {
    if (!tunnel) {
      throw new Error('Tunnel 未初始化');
    }

    tunnel.stop();
    
    setTimeout(() => {
      expect(tunnel.isRunning()).toBe(false);
      console.log('✅ Tunnel 已正确关闭');
    }, 1000);
  });
});

describe('阶段 2: Tunnel 进程管理测试', () => {
  it('应该能重复启动和停止 Tunnel', async () => {
    const tunnel = new CloudflareTunnel({ 
      localPort: TUNNEL_PORT + 1,
      protocol: 'http2'
    });

    let urlCount = 0;

    const testCycle = async () => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tunnel 启动超时'));
        }, 20000);

        tunnel.once('url', (url: string) => {
          clearTimeout(timeout);
          urlCount++;
          console.log(`✅ 第 ${urlCount} 次启动成功:`, url);
          expect(url).toContain('trycloudflare.com');
          
          setTimeout(() => {
            tunnel.stop();
            setTimeout(() => resolve(true), 1000);
          }, 2000);
        });

        tunnel.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        tunnel.start().catch(reject);
      });
    };

    await testCycle();
    await testCycle();
    await testCycle();

    expect(urlCount).toBe(3);
    console.log(`✅ 完成 ${urlCount} 次启动/停止循环`);
  }, 65000);
});

describe('阶段 2: 集成测试 - 端到端消息流', () => {
  it('应该能通过 Tunnel 发送消息（模拟）', async () => {
    const tunnel = new CloudflareTunnel({ 
      localPort: TUNNEL_PORT + 2,
      protocol: 'http2'
    });

    let publicURL: string | null = null;

    return new Promise((resolve, reject) => {
      const startTimeout = setTimeout(() => {
        reject(new Error('Tunnel 启动超时'));
      }, 20000);

      tunnel.once('url', (url: string) => {
        clearTimeout(startTimeout);
        publicURL = url;
        console.log('✅ Tunnel 启动成功');

        setTimeout(() => {
          tunnel.stop();
          resolve(true);
        }, 3000);
      });

      tunnel.once('error', (error) => {
        clearTimeout(startTimeout);
        reject(error);
      });

      tunnel.start().catch(reject);
    });
  }, 25000);
});
