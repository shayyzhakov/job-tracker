/** Redirect URIs a dynamically registered client may use out of the box: Claude's hosted callbacks and local CLIs. */
export const DEFAULT_REDIRECT_ALLOWLIST = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
  // ChatGPT: the connector callback (fixed, and per-connector ids), and the platform's app-testing callback.
  'https://chatgpt.com/connector_platform_oauth_redirect',
  'https://chatgpt.com/connector/oauth/*',
  'https://platform.openai.com/apps-manage/oauth',
  'http://localhost:*',
  'http://127.0.0.1:*',
];

/**
 * An entry is an exact URI; `scheme://host:*`, which accepts any port and path on that host (loopback redirects of
 * CLI clients use a random port); or `scheme://host/path/*`, which accepts any URI under that path prefix.
 */
export function isAllowedRedirect(uri: string, allowlist: string[]): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  return allowlist.some((entry) => {
    if (entry.endsWith('/*')) {
      const base = new URL(entry.slice(0, -1));
      return url.origin === base.origin && url.pathname.startsWith(base.pathname);
    }
    if (!entry.endsWith(':*')) return uri === entry;
    const base = new URL(entry.slice(0, -2));
    return url.protocol === base.protocol && url.hostname === base.hostname;
  });
}
