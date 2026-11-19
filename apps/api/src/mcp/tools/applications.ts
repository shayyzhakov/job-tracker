import {
  APPLICATION_METHODS,
  APPLICATION_STATUSES,
  ApplicationCreateSchema,
  ApplicationUpdateSchema,
  COMPANY_PRIORITIES,
  COMPANY_SIZES,
  HAND_OVER_REASONS,
  HandOverSchema,
  REFERRAL_CHANNELS,
  SnoozeSchema,
  STATUS_GROUPS,
  StatusChangeSchema,
} from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defineTool, type ToolLogger } from '../tool.js';
import { contactFields, contactRef } from './children.js';

/** The application's own notes describe the opportunity, never our progress with it. */
const APPLICATION_NOTES_FIELD =
  'Free text about the opportunity itself: role details, team, tech stack, compensation hints, why it is interesting, and relevant links (job post, company pages). Do NOT put progress here (applied or not, status, interviews, next steps, follow-ups, "no application submitted"): status, interviews and the action queue hold that. Keep it short.';

const id = z.uuid().describe('Application id');
const status = z.enum(APPLICATION_STATUSES);
export const size = z
  .enum(COMPANY_SIZES)
  .describe(
    'Company size bucket: early_stage_startup (seed/Series A, small team), startup (growth-stage, roughly 50-500 employees), scale_up (mature, established tech company of roughly 500-5,000 employees, public or private, e.g. monday.com or Wix), corporate (large established company of roughly 5,000+ employees, including big public ones like Meta or Amazon). Look it up if you do not know it; omit only if it cannot be found.',
  );
export const priority = z
  .enum(COMPANY_PRIORITIES)
  .describe(
    'How much the job scout should care about the company: top (dream target, searched first), high, moderate (default for new companies), low, blacklist (never suggest its listings). Only set it when the user states a preference.',
  );
export const isPublic = z
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
const OFFER_EXPIRES_AT =
  'ISO 8601 date-time when the offer expires; used only while the status is offer (ranks the offer on the Tasks list)';
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export function registerApplicationTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'list_applications',
    {
      title: 'List applications',
      description:
        'List job applications, most recently updated first. Returns a compact row per application; use get_application for contacts, interviews, interview notes and history.',
      inputSchema: {
        status: status.optional().describe('Only applications in this status'),
        groups: z
          .array(z.enum(STATUS_GROUPS))
          .optional()
          .describe(
            'Only applications in these status groups. initial: to apply, on hold, applied (no interview yet). active: HR screening through final, and offer. closed: accepted, rejected, withdrawn, ghosted. Omit for all.',
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
        nextInterviewType: a.nextInterviewType,
        interviewsCount: a.interviewsCount,
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
      description:
        "Get one application with its company, contacts, interviews, interview notes and status history. currentRound names the interview whose timeline (nextStep, replyBy, dueAt) counts now and its phase (upcoming, unscheduled, open = home assignment not submitted, ended); other rounds' values are history. offerExpiresAt applies only while the status is offer.",
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
        'Create a job application. Give an existing company by id, or a new company by name (reused if a company with that name already exists; its details, including priority, are not changed, use update_application or update_company for that). Status defaults to to_apply. Fill in the company fields (size, isPublic, website, location) whenever you know them or can find them online; leave them out only when the information is not available.',
      inputSchema: {
        company: z
          .union([
            z.object({ id: z.uuid() }),
            z.object({
              name: z.string(),
              size: size.optional(),
              priority: priority.optional(),
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
        notes: z.string().optional().describe(APPLICATION_NOTES_FIELD),
        appliedAt: z.string().optional().describe('ISO 8601 date; set automatically if omitted'),
        contacts: z
          .array(z.union([z.object(contactRef), z.object(contactFields)]))
          .optional()
          .describe(
            'New contacts, or {contactId} to reuse an existing one. Call list_contacts first: people with the same email, phone or LinkedIn are reused automatically, but a matching name alone is not',
          ),
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
        notes: nullable(z.string()).describe(APPLICATION_NOTES_FIELD),
        appliedAt: nullable(z.string()).describe('ISO 8601 date'),
        offerExpiresAt: nullable(z.string()).describe(OFFER_EXPIRES_AT),
        company: z
          .object({
            name: z.string().optional(),
            size: nullable(size),
            priority: priority.optional(),
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
      description: `Move an application to a new status. Only to_apply, on_hold (parked on purpose, no reminders), applied, offer and the closed outcomes are stored (and recorded in the history). An interview-round status (coffee_chat, hr_screening, ... final_interview) adds that interview instead, so do not call schedule_interview for the same round; the status an application shows follows its interviews: the next upcoming one, else the last one held. Going back to to_apply, on_hold or applied is refused while the application has interviews. The history stays one logical path (interviews are never dropped): reopening a closed application (to applied, offer or a round) removes the closed outcome, a new closed outcome replaces the previous one, going back to to_apply/on_hold drops the milestones in between, and a round chosen at offer keeps the offer. Pipeline: ${APPLICATION_STATUSES.join(', ')}.`,
      inputSchema: {
        id,
        status: z.string().describe(APPLICATION_STATUSES.join(' | ')),
        interviewAt: z
          .string()
          .optional()
          .describe(
            'For interview-round statuses: ISO 8601 date-time with a UTC offset of the interview (past or future). Defaults to now.',
          ),
        nextStep: z
          .string()
          .optional()
          .describe(
            'For interview-round statuses: one line on what the user should do before this round. Stored on the interview it creates.',
          ),
        dueAt: z
          .string()
          .optional()
          .describe(
            'For home_assignment only: ISO 8601 date-time the assignment is due. Stored on the interview it creates.',
          ),
        offerExpiresAt: z.string().optional().describe(`For offer only: ${OFFER_EXPIRES_AT}`),
      },
    },
    ({ id, ...body }) => {
      const { status, interviewAt, nextStep, dueAt, offerExpiresAt } =
        StatusChangeSchema.parse(body);
      return s.applications.changeStatus(id, status, interviewAt, {
        nextStep,
        dueAt,
        offerExpiresAt,
      });
    },
    logger,
  );

  defineTool(
    server,
    'snooze_application',
    {
      title: 'Snooze application',
      description:
        "Hide an application's card from the Tasks action list until the given time. The card returns on its own afterwards.",
      inputSchema: {
        id,
        until: z.string().describe('ISO 8601 date-time with a UTC offset'),
      },
    },
    ({ id, until }) => s.applications.snooze(id, SnoozeSchema.parse({ until }).until),
    logger,
  );

  defineTool(
    server,
    'hand_over_application',
    {
      title: 'Hand ball to employer',
      description:
        'Record that the user did their part and is now waiting on the employer: followed_up (a follow-up was sent), submitted (home assignment handed in: sets submittedAt on the open home-assignment interview) or they_scheduling (the employer will propose an interview time). Starts the waiting timer.',
      inputSchema: { id, reason: z.enum(HAND_OVER_REASONS) },
    },
    ({ id, reason }) => s.applications.handOver(id, HandOverSchema.parse({ reason }).reason),
    logger,
  );

  defineTool(
    server,
    'delete_application',
    {
      title: 'Delete application',
      description:
        'Permanently delete an application with its contacts, interviews, interview notes and history. Confirm with the user first.',
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
