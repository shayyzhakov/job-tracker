/** Where Claude should connect. In dev the API runs on its own port; in production it serves this app (same origin). */
export function mcpUrl(origin: string, dev: boolean): string {
  return dev ? 'http://localhost:3000/mcp' : `${origin}/mcp`;
}
