import { COMPANY_PRIORITIES, CompanyInputSchema, CompanyUpdateSchema } from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defineTool, type ToolLogger } from '../tool.js';
import { isPublic, priority, size } from './applications.js';

const id = z.uuid().describe('Company id');
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export function registerCompanyTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'search_companies',
    {
      title: 'Search companies',
      description:
        'Find companies by name (case-insensitive substring). Omit q to list them all. Use list_companies when you also need application counts.',
      inputSchema: { q: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ q }) => s.companies.search(q?.trim() || undefined),
    logger,
  );

  defineTool(
    server,
    'list_companies',
    {
      title: 'List companies',
      description:
        'List the companies the user tracks (including ones with no application yet), by name, with its scout priority, openApplications and totalApplications. Returns every priority unless you pass a priority filter. Open means not accepted, rejected, withdrawn or ghosted (initial or active status group).',
      inputSchema: {
        q: z.string().optional().describe('Filter by name (substring)'),
        priority: z
          .array(z.enum(COMPANY_PRIORITIES))
          .optional()
          .describe(
            'Only companies in these scout priority buckets, e.g. ["top","high"]. Leave out to get every priority.',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    ({ q, priority }) => s.companies.list(q?.trim() || undefined, priority),
    logger,
  );

  defineTool(
    server,
    'get_company',
    {
      title: 'Get company',
      description:
        'Get one company with its application counts and the id, role and status of each of its applications.',
      inputSchema: { id },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => s.companies.get(id),
    logger,
  );

  defineTool(
    server,
    'create_company',
    {
      title: 'Create company',
      description:
        'Add a company the user wants to track, with or without an application. Fails if a company with the same name (case-insensitive) already exists. New companies start at moderate scout priority; pass priority only when the user states a preference. Fill in size, isPublic, website and location whenever you know them or can find them online.',
      inputSchema: {
        name: z.string(),
        size: size.optional(),
        priority: priority.optional(),
        isPublic: isPublic.optional(),
        website: z.string().optional().describe('Company website URL. Fill in when known.'),
        location: z
          .string()
          .optional()
          .describe('Headquarters or main office city/country. Fill in when known.'),
      },
    },
    (args) => s.companies.create(CompanyInputSchema.parse(args)),
    logger,
  );

  defineTool(
    server,
    'update_company',
    {
      title: 'Update company',
      description:
        'Change a company. Only the fields you send change; send null to clear size, website or location. The change applies to every application of that company. Fails if the new name belongs to another company.',
      inputSchema: {
        id,
        name: z.string().optional(),
        size: nullable(size),
        priority: priority.optional(),
        isPublic: isPublic.optional(),
        website: nullable(z.string()),
        location: nullable(z.string()),
      },
    },
    ({ id, ...patch }) => s.companies.update(id, CompanyUpdateSchema.parse(patch)),
    logger,
  );

  defineTool(
    server,
    'delete_company',
    {
      title: 'Delete company',
      description:
        'Permanently delete a company. Only possible when it has no applications at all (open or closed); otherwise it fails with the application count. Confirm with the user first.',
      inputSchema: { id },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      await s.companies.remove(id);
      return { deleted: id };
    },
    logger,
  );
}
