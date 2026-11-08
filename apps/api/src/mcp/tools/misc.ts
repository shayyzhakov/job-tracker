import {
  COMPANY_SIZES,
  ROLE_TRACKS,
  ScoutCriteriaSchema,
  SENIORITY_LEVELS,
} from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defined, defineTool, type ToolLogger } from '../tool.js';

export function registerMiscTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'get_overview',
    {
      title: 'Get overview',
      description:
        'Dashboard figures: open applications (not closed), how many of them are active (interviewing or at offer), counts by status, response rate, offers, upcoming interviews, applications per week and average expected salary (monthly ILS).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => s.overview.get(),
    logger,
  );

  defineTool(
    server,
    'get_actions',
    {
      title: 'Get action list',
      description:
        'What needs the user right now. needsYou: ranked action cards (deadlines first, then overdue, soon, nudges); scheduled: interviews further out; waiting: applications waiting on the employer with their next check-in date. Use hand_over_application, snooze_application or change_application_status to resolve cards.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => s.actions.get(),
    logger,
  );

  defineTool(
    server,
    'get_scout_criteria',
    {
      title: 'Get scout criteria',
      description: 'What the AI scout looks for when it checks new job listings each day.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => s.scoutCriteria.get(),
    logger,
  );

  defineTool(
    server,
    'update_scout_criteria',
    {
      title: 'Update scout criteria',
      description:
        'Change the AI scout criteria. Only the fields you send change; lists replace the current list. Empty lists mean "no preference".',
      inputSchema: {
        roles: z.array(z.string()).optional().describe('Job titles, e.g. "Backend Engineer"'),
        seniorities: z.array(z.enum(SENIORITY_LEVELS)).optional(),
        track: z.enum(ROLE_TRACKS).optional(),
        locations: z.array(z.string()).optional(),
        companySizes: z.array(z.enum(COMPANY_SIZES)).optional(),
        excludedCompanies: z.array(z.string()).optional(),
        minScore: z.number().optional().describe('0–100; lower-scoring listings are hidden'),
      },
    },
    async (args) => {
      const { updatedAt: _updatedAt, ...current } = await s.scoutCriteria.get();
      return s.scoutCriteria.save(ScoutCriteriaSchema.parse({ ...current, ...defined(args) }));
    },
    logger,
  );
}
