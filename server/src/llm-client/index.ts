/**
 * Simple LLM Client - With tool calling support
 */

import OpenAI from 'openai';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_calls?: ToolCall[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: any;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export class LLMClient {
  private client: OpenAI;

  constructor(
    apiKey: string,
    apiBase: string,
    model: string
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: apiBase,
    });
    this.model = model;
  }

  private model: string;

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  async chat(messages: Message[], tools: ToolDefinition[]): Promise<string> {
    const openAITools = tools.length > 0 ? tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    })) : undefined;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      tools: openAITools,
      stream: false,
      max_tokens: 4096,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) return '';

    const calls = message.tool_calls;
    const content = message.content || '';

    if (calls && calls.length > 0) {
      return JSON.stringify({ tool_calls: calls, content });
    }

    return content;
  }

  async executeToolCall(toolCall: ToolCall): Promise<string> {
    const toolName = toolCall.function.name;
    const toolArgs = JSON.parse(toolCall.function.arguments);

    return `[Tool Result: ${toolName}] ${JSON.stringify(toolArgs)}`;
  }
}
