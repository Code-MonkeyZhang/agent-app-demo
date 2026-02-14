import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as cloudflared from 'cloudflared';

export interface TunnelOptions {
  localPort: number;
  protocol?: 'http2' | 'quic' | 'h2mux';
}

export class CloudflareTunnel extends EventEmitter {
  private process: ChildProcess | null = null;
  private url: string | null = null;
  private readonly localPort: number;
  private readonly protocol: string;

  constructor(options: TunnelOptions) {
    super();
    this.localPort = options.localPort;
    this.protocol = options.protocol || 'http2';
  }

  async start(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const binPath = cloudflared.bin;
        console.log(`[Tunnel] Using cloudflared from: ${binPath}`);

        if (!await this.ensureCloudflared()) {
          reject(new Error('Failed to download cloudflared binary'));
          return;
        }

        const args = [
          'tunnel',
          '--url', `localhost:${this.localPort}`,
          '--protocol', this.protocol,
          '--no-autoupdate'
        ];

        console.log('[Tunnel] Starting Cloudflare Tunnel...');
        console.log(`[Tunnel] Command: cloudflared ${args.join(' ')}`);

        this.process = spawn(binPath, args, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        if (!this.process.stdout || !this.process.stderr) {
          throw new Error('Failed to create stdio pipes');
        }

        this.process.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

          if (urlMatch) {
            this.url = urlMatch[0];
            console.log(`[Tunnel] Got URL: ${this.url}`);
            this.emit('url', this.url);
            resolve(this.url);
          }
        });

        this.process.stdout.on('data', (data: Buffer) => {
          console.log(`[Tunnel] stdout: ${data.toString().trim()}`);
        });

        this.process.stderr.on('data', (data: Buffer) => {
          const output = data.toString();
          if (!output.includes('trycloudflare.com')) {
            console.log(`[Tunnel] stderr: ${output.trim()}`);
          }
        });

        this.process.on('error', (error) => {
          console.error('[Tunnel] Process error:', error);
          reject(error);
        });

        this.process.on('exit', (code, signal) => {
          if (code !== 0) {
            console.error(`[Tunnel] Process exited with code ${code}, signal ${signal}`);
            this.emit('error', new Error(`Tunnel process exited with code ${code}`));
          } else {
            console.log('[Tunnel] Process exited normally');
            this.emit('closed');
          }
        });

        this.emit('started');

      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    if (this.process) {
      console.log('[Tunnel] Stopping Cloudflare Tunnel...');
      this.process.kill('SIGTERM');
      this.process = null;
      this.url = null;
    }
  }

  getURL(): string | null {
    return this.url;
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  private async ensureCloudflared(): Promise<boolean> {
    try {
      const binPath = cloudflared.bin;
      const fs = await import('fs');
      
      if (fs.existsSync(binPath)) {
        console.log('[Tunnel] cloudflared binary exists');
        return true;
      }
      
      console.log('[Tunnel] cloudflared binary not found, installing...');
      await cloudflared.install(binPath);
      console.log('[Tunnel] cloudflared installed successfully');
      return true;
    } catch (error) {
      console.error('[Tunnel] Failed to install cloudflared:', error);
      return false;
    }
  }
}
