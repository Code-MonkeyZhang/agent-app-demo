# MCP and Skills Integration Guide

## Overview

The server has been successfully integrated with MCP (Model Context Protocol) and Skills support from Mini-Agent-TS. This allows the agent to use external tools and specialized skills.

## New Features

### 1. MCP Support

The server can now connect to MCP servers to access external tools. Configure MCP servers in `config/mcp.json`:

```json
{
  "mcpServers": {
    "time-server": {
      "command": "uvx",
      "args": ["mcp-server-time"],
      "description": "A simple example server that provides time tools"
    }
  }
}
```

Supported connection types:
- **stdio**: Execute MCP server as a subprocess
- **sse**: Connect via Server-Sent Events
- **http/streamable_http**: Connect via HTTP/HTTPS

### 2. Skills Support

Skills provide expert guidance for specific tasks. Create skills in the `skills/` directory:

1. Create a new directory, e.g., `skills/my-skill/`
2. Create a `SKILL.md` file with the following structure:

```markdown
---
name: my-skill
description: A brief description of what this skill does
---

# Skill Title

Detailed instructions and guidance for the agent...
```

3. The agent will automatically discover and load skills on startup
4. Use `get_skill` tool to load a skill when needed

## Configuration

### LLM Configuration

Edit `config/config.yaml` to configure your LLM:

```yaml
# OpenAI
apiKey: "sk-your-openai-api-key"
apiBase: "https://api.openai.com/v1"
model: "gpt-4o"
provider: "openai"

# Or Anthropic
# apiKey: "sk-ant-your-anthropic-api-key"
# apiBase: "https://api.anthropic.com"
# model: "claude-3-5-sonnet-20241022"
# provider: "anthropic"
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PORT=3000
ENABLE_TUNNEL=true

# LLM Configuration
LLM_API_KEY=sk-your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o
```

## Message Types

The WebSocket protocol now supports additional message types:

### Thinking Message

```json
{
  "type": "thinking",
  "payload": { "text": "I'm thinking about..." },
  "timestamp": 1234567890,
  "id": "msg-123"
}
```

### Tool Call Message

```json
{
  "type": "tool_call",
  "payload": {
    "id": "call-123",
    "name": "tool_name",
    "arguments": { "param": "value" }
  },
  "timestamp": 1234567890,
  "id": "msg-124"
}
```

### Tool Result Message

```json
{
  "type": "tool_result",
  "payload": {
    "tool_call_id": "call-123",
    "tool_name": "tool_name",
    "success": true,
    "content": "Tool output",
    "error": null
  },
  "timestamp": 1234567890,
  "id": "msg-125"
}
```

## Running the Server

```bash
# Install dependencies
cd server
npm install

# Build
npm run build

# Run
npm start

# Or run in development mode
npm run dev
```

## Example MCP Servers

### Time Server (built-in example)

Already configured in `config/mcp.json`. Requires `uvx` (part of uv):

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run server (will be automatically started by the agent)
uvx mcp-server-time
```

### TickTick MCP

Configure in `config/mcp.json`:

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "/path/to/ticktick-mcp",
      "env": {
        "TICKTICK_ACCOUNT_TYPE": "china",
        "TICKTICK_CLIENT_ID": "your-client-id",
        "TICKTICK_CLIENT_SECRET": "your-secret",
        "TICKTICK_REDIRECT_URI": "http://localhost:8000/callback"
      }
    }
  }
}
```

### File System MCP

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    }
  }
}
```

## Troubleshooting

### MCP Connection Fails

1. Check if the MCP server command/path is correct
2. Verify environment variables are set
3. Check timeout settings in `config.yaml` under `tools.mcp`
4. Ensure required dependencies are installed (e.g., `uvx` for Python MCP servers)

### Skills Not Loading

1. Ensure SKILL.md files have proper YAML frontmatter
2. Check that skill names are unique
3. Verify `skillsDir` path in `config.yaml`

### Agent Not Responding

1. Check LLM API key is correct
2. Verify API endpoint is accessible
3. Check network connectivity
4. Review logs in the `logs/` directory

## Next Steps

1. Configure your LLM API key in `config/config.yaml` or `.env`
2. Add MCP servers to `config/mcp.json`
3. Create custom skills in the `skills/` directory
4. Test the agent with your mobile client
5. Explore the available tools and skills

## Migration Notes

- The old `LLMAdapter` has been replaced with the new `Agent` class
- The server now uses ESM modules instead of CommonJS
- Configuration is now loaded from YAML files
- All tool calls are now streamed in real-time over WebSocket
