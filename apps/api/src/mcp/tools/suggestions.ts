import {
  OPPORTUNITY_STATUSES,
  OpportunityCreateSchema,
  OpportunityListQuerySchema,
} from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defineTool, type ToolLogger } from '../tool.js';

const id = z.uuid().describe('Suggestion id');

export function registerSuggestionTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'list_suggestions',
    {
      title: 'List suggestions',
      description:
        'List job listings found by the AI scout, best match first. Each has a 0–100 match score, a summary and reasons.',
      inputSchema: {
        status: z
          .enum(OPPORTUNITY_STATUSES)
          .optional()
          .describe(
            'new (default): awaiting review; filtered: screened out; dismissed; promoted: added to applications',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    (args) => s.opportunities.list(OpportunityListQuerySchema.parse(args)),
    logger,
  );

  defineTool(
    server,
    'add_suggestion',
    {
      title: 'Add suggestion',
      description:
        'Add a job listing as a new suggestion (e.g. one found while browsing). Fails if the listing URL is already stored. Promote it afterwards to track it as an application.',
      inputSchema: OpportunityCreateSchema.shape,
    },
    (args) => s.opportunities.add(OpportunityCreateSchema.parse(args)),
    logger,
  );

  defineTool(
    server,
    'promote_suggestion',
    {
      title: 'Add suggestion to applications',
      description:
        'Turn a new suggestion into a to_apply application. Returns the created application.',
      inputSchema: { id },
    },
    ({ id }) => s.opportunities.promote(id),
    logger,
  );

  defineTool(
    server,
    'dismiss_suggestion',
    {
      title: 'Dismiss suggestion',
      description: 'Hide a new suggestion the user is not interested in.',
      inputSchema: { id },
      annotations: { idempotentHint: false },
    },
    ({ id }) => s.opportunities.dismiss(id),
    logger,
  );
}
