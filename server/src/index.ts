import dotenv from 'dotenv';
import { WebSocketHandler } from './websocket.js';
import { CloudflareTunnel } from './tunnel.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL !== 'false';

async function main() {
  console.log('[Server] Starting LLM Remote Bridge Server...');
  console.log(`[Server] Local port: ${PORT}`);
  console.log(`[Server] Tunnel enabled: ${ENABLE_TUNNEL}`);

  const wsHandler = new WebSocketHandler(PORT);
  let tunnel: CloudflareTunnel | null = null;

  if (ENABLE_TUNNEL) {
    try {
      tunnel = new CloudflareTunnel({ localPort: PORT, protocol: 'http2' });
      
      console.log('[Server] Starting Cloudflare Tunnel (this may take a few seconds)...');
      const publicUrl = await tunnel.start();
      
      console.log('');
      console.log('='.repeat(60));
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log('');
      console.log('📡 Local URL:');
      console.log(`   ws://localhost:${PORT}`);
      console.log('');
      console.log('🌐 Public URL (Tunnel):');
      console.log(`   ${publicUrl}/ws`);
      console.log('');
      console.log('📱 Connect your mobile app to the Public URL');
      console.log('='.repeat(60));
      console.log('');
      
      tunnel.on('error', (error) => {
        console.error('[Tunnel] Error:', error);
      });
      
    } catch (error) {
      console.error('[Server] Failed to start tunnel:', error);
      console.log('[Server] Continuing with local mode only...');
      console.log(`[Server] Local URL: ws://localhost:${PORT}`);
    }
  } else {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 SERVER STARTED (LOCAL MODE)');
    console.log('='.repeat(60));
    console.log('');
    console.log('📡 Local URL:');
    console.log(`   ws://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('');
  }
  
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    
    if (tunnel) {
      console.log('[Server] Stopping tunnel...');
      tunnel.stop();
    }
    
    wsHandler.close();
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});
