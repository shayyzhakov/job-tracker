import {
  APPLICATION_METHODS,
  APPLICATION_STATUSES,
  ApplicationCreateSchema,
  ApplicationUpdateSchema,
  COMPANY_SIZES,
  REFERRAL_CHANNELS,
  StatusChangeSchema,
} from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defineTool, type ToolLogger } from '../tool.js';
import { contactFields } from './children.js';

const id = z.uuid().describe('Application id');
const status = z.enum(APPLICATION_STATUSES);
const size = z
  .enum(COMPANY_SIZES)
  .describe(
    'Company size bucket: early_stage_startup (seed/Series A, small team), startup (growth-stage), unicorn (privately held, $1B+ valuation), corporate (large established company, including big public ones like Meta or Amazon). Look it up if you do not know it; omit only if it cannot be found.',
  );
const isPublic = z
  .boolean()
  .describe(
    'true if the company is publicly traded (e.g. Meta, Amazon, Google, Wix), false if private. Look it up if you do not know it; omit only if it cannot be found.',
  );
const method = z
  .enum(APPLICATION_METHODS)
  .describe(`How the user applied: ${APPLICATION_METHODS.join(' | ')}`);
const channel = z
  .enum(REFERRAL_CHANNELS)
  .describe(`How the user and the referrer spoke: ${REFERRAL_CHANNELS.join(' | ')}`);
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export function registerApplicationTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'list_applications',
    {
      title: 'List applications',
      description:
        'List job applications, most recently updated first. Returns a compact row per application; use get_application for contacts, interviews and history.',
      inputSchema: {
        status: status.optional().describe('Only applications in this status'),
        active: z
          .boolean()
          .optional()
          .describe(
            'true: only open applications; false: only closed ones (accepted, rejected, withdrawn, ghosted)',
          ),
        q: z.string().optional().describe('Search company name or role name'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const rows = await s.applications.list(args);
      return rows.map((a) => ({
        id: a.id,
        company: a.company.name,
        roleName: a.roleName,
        status: a.status,
        nextInterviewAt: a.nextInterviewAt,
        updatedAt: a.updatedAt,
      }));
    },
    logger,
  );

  defineTool(
    server,
    'get_application',
    {
      title: 'Get application',
      description: 'Get one application with its company, contacts, interviews and status history.',
      inputSchema: { id },
      annotations: { readOnlyHint: true },
    },
    ({ id }) => s.applications.get(id),
    logger,
  );

  defineTool(
    server,
    'create_application',
    {
      title: 'Create application',
      description:
        'Create a job application. Give an existing company by id, or a new company by name (reused if a company with that name already exists; its details are not changed, use update_application for that). Status defaults to to_apply. Fill in the company fields (size, isPublic, website, location) whenever you know them or can find them online; leave them out only when the information is not available.',
      inputSchema: {
        company: z
          .union([
            z.object({ id: z.uuid() }),
            z.object({
              name: z.string(),
              size: size.optional(),
              isPublic: isPublic.optional(),
              website: z.string().optional().describe('Company website URL. Fill in when known.'),
              location: z
                .string()
                .optional()
                .describe('Headquarters or main office city/country. Fill in when known.'),
            }),
          ])
          .describe('{ id } of an existing company, or { name, ... } for a new one'),
        roleName: z.string(),
        isManagement: z.boolean().optional().describe('Management role (default false)'),
        status: status.optional(),
        listingUrl: z.string().optional().describe('URL of the job listing'),
        expectedSalaryIls: z
          .number()
          .optional()
          .describe('Expected monthly gross base salary in ILS'),
        source: z.string().optional().describe('Legacy free-text origin; prefer applicationMethod'),
        applicationMethod: method.optional(),
        referrerName: z.string().optional().describe('Who referred the user (referral method)'),
        referrerChannel: channel.optional(),
        methodDetails: z
          .string()
          .optional()
          .describe('Other info about the method: job board name, recruiter, event, …'),
        notes: z.string().optional(),
        appliedAt: z.string().optional().describe('ISO 8601 date; set automatically if omitted'),
        contacts: z.array(z.object(contactFields)).optional(),
      },
    },
    (args) => s.applications.create(ApplicationCreateSchema.parse(args)),
    logger,
  );

  defineTool(
    server,
    'update_application',
    {
      title: 'Update application',
      description:
        'Update fields of an application or its company. Only the fields you send change; send null to clear a field. To change status use change_application_status.',
      inputSchema: {
        id,
        roleName: z.string().optional(),
        isManagement: z.boolean().optional(),
        listingUrl: nullable(z.string()),
        expectedSalaryIls: nullable(z.number()),
        source: nullable(z.string()),
        applicationMethod: nullable(method),
        referrerName: nullable(z.string()),
        referrerChannel: nullable(channel),
        methodDetails: nullable(z.string()),
        notes: nullable(z.string()),
        appliedAt: nullable(z.string()).describe('ISO 8601 date'),
        company: z
          .object({
            name: z.string().optional(),
            size: nullable(size),
            isPublic: isPublic.optional(),
            website: nullable(z.string()),
            location: nullable(z.string()),
          })
          .optional(),
      },
    },
    ({ id, ...patch }) => s.applications.update(id, ApplicationUpdateSchema.parse(patch)),
    logger,
  );

  defineTool(
    server,
    'change_application_status',
    {
      title: 'Change application status',
      description: `Move an application to a new status and record it in its history. Pipeline: ${APPLICATION_STATUSES.join(', ')}.`,
      inputSchema: {
        id,
        status: z.string().describe(APPLICATION_STATUSES.join(' | ')),
        repeat: z
          .boolean()
          .optional()
          .describe(
            'Set true to add another step with the same status (e.g. a second phone interview)',
          ),
      },
    },
    ({ id, ...body }) => {
      const { status, repeat } = StatusChangeSchema.parse(body);
      return s.applications.changeStatus(id, status, repeat);
    },
    logger,
  );

  defineTool(
    server,
    'delete_application',
    {
      title: 'Delete application',
      description:
        'Permanently delete an application with its contacts, interviews and history. Confirm with the user first.',
      inputSchema: { id },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      await s.applications.remove(id);
      return { deleted: id };
    },
    logger,
  );
}
