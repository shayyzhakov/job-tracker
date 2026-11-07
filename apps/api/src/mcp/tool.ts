import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { ZodError, type z } from 'zod';
import { ConflictError, NotFoundError } from '../errors.js';

export interface ToolLogger {
  error(obj: unknown, msg?: string): void;
}

const text = (value: string): CallToolResult['content'] => [{ type: 'text', text: value }];

/** Successful result: compact JSON so the model can reuse ids in follow-up calls. */
export const ok = (data: unknown): CallToolResult => ({
  content: text(JSON.stringify(data ?? { ok: true })),
});

export const fail = (message: string): CallToolResult => ({
  isError: true,
  content: text(message),
});

/** Turns domain and validation errors into tool errors the model can act on. */
export function toToolError(err: unknown, logger?: ToolLogger): CallToolResult {
  if (err instanceof NotFoundError || err instanceof ConflictError) return fail(err.message);
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`);
    return fail(`Invalid input. ${issues.join('; ')}`);
  }
  logger?.error(err, 'MCP tool failed');
  return fail(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
}

export interface ToolConfig<Shape extends z.ZodRawShape> {
  title: string;
  description: string;
  inputSchema: Shape;
  annotations?: ToolAnnotations;
}

/**
 * Registers a tool whose handler returns plain data (wrapped with `ok`) or throws
 * (mapped with `toToolError`). Handlers re-validate with the shared schemas, so the
 * input shape here only needs to describe the arguments to the model.
 */
export function defineTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: ToolConfig<Shape>,
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
  logger?: ToolLogger,
) {
  const run = async (args: unknown): Promise<CallToolResult> => {
    try {
      return ok(await handler(args as z.infer<z.ZodObject<Shape>>));
    } catch (err) {
      return toToolError(err, logger);
    }
  };
  server.registerTool(name, config as Parameters<McpServer['registerTool']>[1], run as never);
}

/** Drops keys whose value is undefined (so a partial update only touches what was sent). */
export const defined = <T extends Record<string, unknown>>(obj: T): Partial<T> =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
