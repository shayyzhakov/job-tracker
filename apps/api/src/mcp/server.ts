import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Services } from '../services.js';
import type { ToolLogger } from './tool.js';
import { registerApplicationTools } from './tools/applications.js';
import { registerChildTools } from './tools/children.js';
import { registerMiscTools } from './tools/misc.js';
import { registerSuggestionTools } from './tools/suggestions.js';

const INSTRUCTIONS = `Personal job-search tracker for the Israeli tech market (one user).
Salaries are expected monthly gross base salary in ILS. The user is in Israel (Asia/Jerusalem); send dates as ISO 8601 with an offset.
Look up ids with list_applications, get_application or list_suggestions before changing anything.
Status changes go through change_application_status so they are recorded in the history.
When creating or updating a company, fill in size, isPublic, website and location whenever the information is known or findable online (e.g. Meta and Amazon are public corporates). Do not guess: omit a field when it cannot be determined.`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#4f46e5"/><rect x="14" y="22" width="36" height="26" rx="4" fill="#fff"/><path d="M25 22v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><rect x="14" y="32" width="36" height="3" fill="#4f46e5"/></svg>`;

/** Same briefcase as the web favicon, inlined so clients need no extra request. */
const ICONS = [
  {
    src: `data:image/svg+xml;base64,${Buffer.from(ICON_SVG).toString('base64')}`,
    mimeType: 'image/svg+xml',
    sizes: ['any'],
  },
];

/** Builds an MCP server exposing the tracker's operations as tools, on top of the shared services. */
export function createMcpServer(services: Services, logger?: ToolLogger): McpServer {
  const server = new McpServer(
    { name: 'job-tracker', title: 'Job Tracker', version: '0.1.0', icons: ICONS },
    { instructions: INSTRUCTIONS },
  );
  registerApplicationTools(server, services, logger);
  registerChildTools(server, services, logger);
  registerSuggestionTools(server, services, logger);
  registerMiscTools(server, services, logger);
  return server;
}
