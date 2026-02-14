export type JsonSchema = Record<string, unknown>;

export type ToolInput = Record<string, unknown>;

export interface ToolResult {
  success: boolean;
  content: string;
  error?: string | null;
}

export type ToolResultWithMeta<
  TMeta extends Record<string, unknown> = Record<string, never>,
> = ToolResult & TMeta;

export interface Tool<
  Input extends ToolInput = ToolInput,
  Output extends ToolResult = ToolResult,
> {
  name: string;
  description: string;
  parameters: any;
  input_schema?: any;
  execute(params: Input): Promise<Output>;
}
