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
    'search_companies',
    {
      title: 'Search companies',
      description: 'Find companies by name (case-insensitive substring). Omit q to list them all.',
      inputSchema: { q: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ q }) => s.companies.search(q?.trim() || undefined),
    logger,
  );

  defineTool(
    server,
    'get_overview',
    {
      title: 'Get overview',
      description:
        'Dashboard figures: active applications, counts by status, response rate, offers, upcoming interviews, applications per week and average expected salary (monthly ILS).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => s.overview.get(),
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
