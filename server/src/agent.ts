import { LLMClient, Message, ToolCall } from './llm-client/index.js';
import type { Tool, ToolResult, ToolInput } from './tools/base.js';

export interface AgentProgress {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'completion';
  data: any;
}

export type ProgressCallback = (progress: AgentProgress) => void;

export class Agent {
  private llm: LLMClient;
  private messages: Message[] = [];
  private tools: Map<string, Tool> = new Map();
  private progressCallback?: ProgressCallback;

  constructor(llm: LLMClient, systemPrompt: string) {
    this.llm = llm;
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  setProgressCallback(callback: ProgressCallback | undefined): void {
    this.progressCallback = callback;
  }

  private notifyProgress(type: AgentProgress['type'], data: any): void {
    if (this.progressCallback) {
      this.progressCallback({ type, data });
    }
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTools(): any[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema || t.parameters,
    }));
  }

  async chat(userMessage: string): Promise<string> {
    this.messages.push({ role: 'user', content: userMessage });

    const tools = this.getTools();
    let finalResponse = '';
    let step = 0;
    const maxSteps = 100;

    this.notifyProgress('thinking', { text: '正在思考中...', step: 0 });

    while (step < maxSteps) {
      step++;
      this.notifyProgress('thinking', { text: `第 ${step} 步：调用 LLM...`, step });

      const response = await this.llm.chat(this.messages, tools);

      let toolCalls: ToolCall[] | null = null;
      let assistantContent = '';

      try {
        const parsed = JSON.parse(response);
        if (parsed.tool_calls) {
          toolCalls = parsed.tool_calls;
          assistantContent = parsed.content || '';
        } else {
          assistantContent = response;
        }
      } catch {
        assistantContent = response;
      }

      this.messages.push({
        role: 'assistant',
        content: assistantContent,
        tool_calls: toolCalls || undefined,
      });

      if (!toolCalls || toolCalls.length === 0) {
        finalResponse = assistantContent;
        this.notifyProgress('completion', { text: finalResponse });
        break;
      }

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        let toolArgs: Record<string, unknown>;

        try {
          const argsStr = toolCall.function.arguments;
          if (typeof argsStr === 'string') {
            toolArgs = JSON.parse(argsStr);
          } else if (typeof argsStr === 'object') {
            toolArgs = argsStr as Record<string, unknown>;
          } else {
            toolArgs = {};
          }
        } catch (parseError) {
          console.error(`[Agent] Failed to parse tool arguments:`, toolCall.function.arguments);
          toolArgs = {};
        }

        this.notifyProgress('tool_call', {
          id: toolCall.id,
          name: toolName,
          arguments: toolArgs,
          step,
        });

        const tool = this.tools.get(toolName);
        if (tool) {
          try {
            const result: ToolResult = await tool.execute(toolArgs);
            const resultContent = result.success ? result.content : `Error: ${result.error}`;

            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: resultContent,
            });

            this.notifyProgress('tool_result', {
              tool_call_id: toolCall.id,
              tool_name: toolName,
              success: result.success,
              content: resultContent,
              error: result.error,
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[Agent] Tool execution error for ${toolName}:`, errorMsg);
            
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Tool execution error: ${errorMsg}`,
            });

            this.notifyProgress('tool_result', {
              tool_call_id: toolCall.id,
              tool_name: toolName,
              success: false,
              content: '',
              error: errorMsg,
            });
          }
        } else {
          const errorMsg = `Tool not found: ${toolName}`;
          console.error(`[Agent] ${errorMsg}`);
          
          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: errorMsg,
          });

          this.notifyProgress('tool_result', {
            tool_call_id: toolCall.id,
            tool_name: toolName,
            success: false,
            content: '',
            error: errorMsg,
          });
        }
      }
    }

    return finalResponse;
  }
}
