import dotenv from 'dotenv';
import * as fs from 'node:fs';
import { WebSocketHandler } from './websocket.js';
import { CloudflareTunnel } from './tunnel.js';
import { Config } from './config.js';
import { Agent } from './agent.js';
import { LLMClient } from './llm-client/index.js';
import { loadMcpToolsAsync, setMcpTimeoutConfig, cleanupMcpConnections } from './tools/mcp/index.js';
import { SkillLoader, GetSkillTool } from './skills/index.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL !== 'false';

async function initializeAgent(): Promise<Agent> {
  console.log('[Server] Initializing Agent...');

  const configPath = Config.findConfigFile('config.yaml');
  if (!configPath) {
    throw new Error('Configuration file not found: config.yaml');
  }

  console.log(`[Server] Loading config from: ${configPath}`);
  const config = Config.fromYaml(configPath);
  console.log(`[Server] Model: ${config.llm.model}`);
  console.log(`[Server] Provider: ${config.llm.provider}`);

  const llmClient = new LLMClient(
    config.llm.apiKey,
    config.llm.apiBase,
    config.llm.model
  );

  console.log('[Server] Checking API connection...');
  const isConnected = await llmClient.checkConnection();
  if (isConnected) {
    console.log('[Server] ✅ API connection OK');
  } else {
    console.log('[Server] ⚠️  API connection failed (Check API Key/Network)');
  }

  let systemPrompt: string;
  const systemPromptPath = Config.findConfigFile(config.agent.systemPromptPath);
  if (systemPromptPath && fs.existsSync(systemPromptPath)) {
    systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
    console.log('[Server] ✅ Loaded system prompt');
  } else {
    systemPrompt =
      'You are Mini-Agent, an intelligent assistant that can help users complete various tasks.';
    console.log('[Server] ⚠️  System prompt not found, using default');
  }

  const tools = [];

  console.log('[Server] Loading MCP tools...');
  setMcpTimeoutConfig({
    connectTimeout: config.tools.mcp.connectTimeout,
    executeTimeout: config.tools.mcp.executeTimeout,
    sseReadTimeout: config.tools.mcp.sseReadTimeout,
  });

  const mcpConfigPath = Config.findConfigFile(config.tools.mcpConfigPath);
  if (mcpConfigPath) {
    const mcpTools = await loadMcpToolsAsync(mcpConfigPath);
    if (mcpTools.length > 0) {
      tools.push(...mcpTools);
    } else {
      console.log('[Server] ⚠️  No MCP tools found');
    }
  } else {
    console.log(`[Server] ⚠️  MCP config file not found: ${config.tools.mcpConfigPath}`);
  }

  console.log('[Server] Loading Claude Skills...');
  const skillsDir = config.tools.skillsDir;

  if (!fs.existsSync(skillsDir)) {
    console.log(`[Server] ⚠️  Skills directory does not exist: ${skillsDir}`);
    fs.mkdirSync(skillsDir, { recursive: true });
    console.log(`[Server] ✅ Created skills directory: ${skillsDir}`);
  }

  try {
    const skillLoader = new SkillLoader(skillsDir);
    const discoveredSkills = skillLoader.discoverSkills();

    if (discoveredSkills.length > 0) {
      tools.push(new GetSkillTool(skillLoader));

      const skillsMetadata = skillLoader.getSkillsMetadataPrompt();
      systemPrompt += `\n\n${skillsMetadata}`;

      console.log(`[Server] ✅ Loaded ${discoveredSkills.length} skill(s)`);
    } else {
      console.log('[Server] ⚠️  No skills found in skills directory');
    }
  } catch (error) {
    console.error(`[Server] ❌ Failed to load skills: ${error}`);
  }

  const agent = new Agent(llmClient, systemPrompt);

  for (const tool of tools) {
    agent.registerTool(tool);
  }

  const loadedTools = agent.getTools();
  console.log(`[Server] ✅ Agent initialized successfully with ${loadedTools.length} tools:`);
  loadedTools.forEach((tool, index) => {
    console.log(`[Server]   ${index + 1}. ${tool.name}`);
  });

  return agent;
}

async function main() {
  console.log('[Server] Starting LLM Remote Bridge Server...');
  console.log(`[Server] Local port: ${PORT}`);
  console.log(`[Server] Tunnel enabled: ${ENABLE_TUNNEL}`);

  const agent = await initializeAgent();
  const wsHandler = new WebSocketHandler(PORT, agent);
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
      console.log('📱 Connect your mobile app to Public URL');
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

  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');

    if (tunnel) {
      console.log('[Server] Stopping tunnel...');
      tunnel.stop();
    }

    console.log('[Server] Cleaning up MCP connections...');
    await cleanupMcpConnections();

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
