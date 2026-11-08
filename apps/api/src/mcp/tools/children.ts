import {
  ContactInputSchema,
  ContactUpdateSchema,
  INTERVIEW_TYPES,
  InterviewInputSchema,
  InterviewUpdateSchema,
  NoteInputSchema,
  NoteUpdateSchema,
} from '@job-tracker/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Services } from '../../services.js';
import { defineTool, type ToolLogger } from '../tool.js';

const applicationId = z.uuid().describe('Application id');
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const contactFields = {
  name: z.string(),
  role: z.string().optional().describe('e.g. Recruiter, Hiring manager'),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional().describe('LinkedIn profile or message URL (http/https)'),
  notes: z.string().optional(),
};

const SCHEDULED_AT =
  'ISO 8601 date-time with a UTC offset, e.g. 2026-11-08T10:00:00+02:00. The user is in Israel (UTC+2, or UTC+3 in summer).';

export function registerChildTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'add_contact',
    {
      title: 'Add contact',
      description: 'Add a contact person (recruiter, hiring manager...) to an application.',
      inputSchema: { applicationId, ...contactFields },
    },
    ({ applicationId, ...input }) =>
      s.contacts.create(applicationId, ContactInputSchema.parse(input)),
    logger,
  );

  defineTool(
    server,
    'update_contact',
    {
      title: 'Update contact',
      description: 'Update a contact on an application. Send null to clear a field.',
      inputSchema: {
        applicationId,
        contactId: z.uuid(),
        name: z.string().optional(),
        role: nullable(z.string()),
        email: nullable(z.string()),
        phone: nullable(z.string()),
        linkedinUrl: nullable(z.string()),
        notes: nullable(z.string()),
      },
    },
    ({ applicationId, contactId, ...patch }) =>
      s.contacts.update(applicationId, contactId, ContactUpdateSchema.parse(patch)),
    logger,
  );

  defineTool(
    server,
    'remove_contact',
    {
      title: 'Remove contact',
      description: 'Delete a contact from an application.',
      inputSchema: { applicationId, contactId: z.uuid() },
      annotations: { destructiveHint: true },
    },
    async ({ applicationId, contactId }) => {
      await s.contacts.remove(applicationId, contactId);
      return { deleted: contactId };
    },
    logger,
  );

  defineTool(
    server,
    'schedule_interview',
    {
      title: 'Schedule interview',
      description: 'Add an interview to an application.',
      inputSchema: {
        applicationId,
        type: z.enum(INTERVIEW_TYPES).optional().describe('Defaults to other'),
        scheduledAt: z.string().describe(SCHEDULED_AT),
        durationMinutes: z.number().optional(),
        location: z.string().optional().describe('Office address or video link'),
      },
    },
    ({ applicationId, ...input }) =>
      s.interviews.create(applicationId, InterviewInputSchema.parse(input)),
    logger,
  );

  defineTool(
    server,
    'update_interview',
    {
      title: 'Update interview',
      description: 'Reschedule or edit an interview. Send null to clear a field.',
      inputSchema: {
        applicationId,
        interviewId: z.uuid(),
        type: z.enum(INTERVIEW_TYPES).optional(),
        scheduledAt: z.string().optional().describe(SCHEDULED_AT),
        durationMinutes: nullable(z.number()),
        location: nullable(z.string()),
        debriefed: nullable(z.boolean()).describe(
          'true: mark the interview as debriefed (the user logged how it went); null clears it',
        ),
      },
    },
    ({ applicationId, interviewId, ...patch }) =>
      s.interviews.update(applicationId, interviewId, InterviewUpdateSchema.parse(patch)),
    logger,
  );

  defineTool(
    server,
    'remove_interview',
    {
      title: 'Remove interview',
      description: 'Delete an interview from an application.',
      inputSchema: { applicationId, interviewId: z.uuid() },
      annotations: { destructiveHint: true },
    },
    async ({ applicationId, interviewId }) => {
      await s.interviews.remove(applicationId, interviewId);
      return { deleted: interviewId };
    },
    logger,
  );

  const interviewId = z.uuid().describe('Interview id');

  defineTool(
    server,
    'list_notes',
    {
      title: 'List interview notes',
      description:
        'List the notes of an application grouped by interview (newest interview first, newest note first).',
      inputSchema: { applicationId },
      annotations: { readOnlyHint: true },
    },
    async ({ applicationId }) => {
      const app = await s.applications.get(applicationId);
      return [...app.interviews]
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        .map((i) => ({
          interviewId: i.id,
          type: i.type,
          scheduledAt: i.scheduledAt,
          notes: app.interviewNotes.filter((n) => n.interviewId === i.id),
        }))
        .filter((g) => g.notes.length > 0);
    },
    logger,
  );

  defineTool(
    server,
    'add_note',
    {
      title: 'Add interview note',
      description:
        'Add a multi-line plain-text note to an interview (upcoming or past): questions asked, what was learned about the role, how it went.',
      inputSchema: { applicationId, interviewId, text: z.string() },
    },
    ({ applicationId, interviewId, text }) =>
      s.notes.create(applicationId, interviewId, NoteInputSchema.parse({ text })),
    logger,
  );

  defineTool(
    server,
    'update_note',
    {
      title: 'Update interview note',
      description: 'Replace the text of an interview note.',
      inputSchema: { applicationId, interviewId, noteId: z.uuid(), text: z.string() },
    },
    ({ applicationId, interviewId, noteId, text }) =>
      s.notes.update(applicationId, interviewId, noteId, NoteUpdateSchema.parse({ text })),
    logger,
  );

  defineTool(
    server,
    'remove_note',
    {
      title: 'Remove interview note',
      description: 'Delete a note from an interview.',
      inputSchema: { applicationId, interviewId, noteId: z.uuid() },
      annotations: { destructiveHint: true },
    },
    async ({ applicationId, interviewId, noteId }) => {
      await s.notes.remove(applicationId, interviewId, noteId);
      return { deleted: noteId };
    },
    logger,
  );
}
