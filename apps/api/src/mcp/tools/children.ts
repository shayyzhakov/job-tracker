import {
  ContactAttachSchema,
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

/**
 * Notes are free text next to structured fields; clients tend to dump everything into them, so every
 * notes tool and field carries this guidance (the server instructions repeat it).
 */
export const NOTES_GUIDANCE =
  'Keep notes short (one to three lines) and only for what no other field holds: how it went, impressions, questions asked, decisions and reasoning, prep links or a candidate portal link. Do NOT put in notes: times or dates, meeting links or locations (interview location field), contact names/roles/emails/phones (contacts), status or scheduling facts (status history, interviews), confirmation or email links, or a recap of the invitation. Split unrelated points into separate notes instead of one long note.';

export const NOTE_FIELD = `Free text. ${NOTES_GUIDANCE}`;

const applicationId = z.uuid().describe('Application id');
const nullable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

/** Existing contact to reuse (see list_contacts), instead of typing the person again. */
export const contactRef = {
  contactId: z.uuid().describe('Id of an existing contact'),
};

export const contactFields = {
  name: z.string(),
  role: z.string().optional().describe('e.g. Recruiter, Hiring manager'),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional().describe('LinkedIn profile or message URL (http/https)'),
  notes: z.string().optional().describe(NOTE_FIELD),
};

const NEXT_STEP =
  'One line on what the user should do before this round (prep). Shown only until the round ends.';
const REPLY_BY =
  'ISO 8601 date the employer said they would reply by after this round; replaces the default follow-up timer while this is the current round';
const DUE_AT = 'home_assignment only: ISO 8601 date-time the assignment is due';
const SUBMITTED_AT =
  'home_assignment only: ISO 8601 date-time it was handed in (the round ends then)';
const INTERVIEWER_IDS =
  'Contact ids of who interviews in this round, in order (list_contacts, or contacts on get_application). A known contact not on this application yet is added to it. For a new person call add_contact first and pass the id it returns.';
const SCHEDULED_AT =
  'ISO 8601 date-time with a UTC offset, e.g. 2026-11-08T10:00:00+02:00. The user is in Israel (UTC+2, or UTC+3 in summer).';

export function registerChildTools(server: McpServer, s: Services, logger?: ToolLogger) {
  defineTool(
    server,
    'add_contact',
    {
      title: 'Add contact',
      description:
        'Add a contact person (recruiter, headhunter, hiring manager...) to an application. People are shared across applications: to reuse someone already known pass only contactId (find them with list_contacts). New details whose email, phone or LinkedIn URL match an existing contact reuse that contact automatically; a matching name alone does not, so check list_contacts first.',
      inputSchema: {
        applicationId,
        contactId: contactRef.contactId.optional(),
        ...contactFields,
        name: contactFields.name.optional().describe('Required unless contactId is given'),
      },
    },
    async ({ applicationId, ...input }) => {
      const contact = await s.contacts.create(
        applicationId,
        ContactAttachSchema.parse(input.contactId ? { contactId: input.contactId } : input),
      );
      if (input.contactId || contact.applicationCount > 1) return contact;
      // A new person: surface known contacts with a similar name, which are not merged automatically.
      const similar = (await s.contacts.list(contact.name)).filter((c) => c.id !== contact.id);
      return similar.length === 0
        ? contact
        : {
            ...contact,
            similarContacts: similar,
            note: 'Created as a new contact. If one of similarContacts is the same person, add that one by contactId instead and remove this duplicate.',
          };
    },
    logger,
  );

  defineTool(
    server,
    'list_contacts',
    {
      title: 'List contacts',
      description:
        'List known contacts (recruiters, headhunters...) with how many applications each is on. Optional q filters on name, role, email or phone. Use get_contact for the applications of one contact.',
      inputSchema: { q: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    ({ q }) => s.contacts.list(q),
    logger,
  );

  defineTool(
    server,
    'get_contact',
    {
      title: 'Get contact',
      description: 'Get one contact with every application it is attached to.',
      inputSchema: { contactId: z.uuid() },
      annotations: { readOnlyHint: true },
    },
    ({ contactId }) => s.contacts.get(contactId),
    logger,
  );

  defineTool(
    server,
    'update_contact',
    {
      title: 'Update contact',
      description:
        'Update a contact. The contact is shared, so the change shows on every application it is on. Send null to clear a field.',
      inputSchema: {
        applicationId,
        contactId: z.uuid(),
        name: z.string().optional(),
        role: nullable(z.string()),
        email: nullable(z.string()),
        phone: nullable(z.string()),
        linkedinUrl: nullable(z.string()),
        notes: nullable(z.string()).describe(NOTE_FIELD),
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
      description:
        'Remove a contact from an application. Other applications keep it; a contact left on no application is deleted.',
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
      description:
        "Add an interview round to an application, optionally with its interviewers (contacts, via interviewerIds). Its timeline lives on the round: nextStep (what to do before it), replyBy (what the employer said after it), and for home_assignment the dueAt and submittedAt. Only the current round's values are shown, so never copy them onto other rounds. For a home_assignment, scheduledAt is when it was received.",
      inputSchema: {
        applicationId,
        type: z.enum(INTERVIEW_TYPES).optional().describe('Defaults to other'),
        scheduledAt: z.string().describe(SCHEDULED_AT),
        durationMinutes: z.number().optional(),
        location: z
          .string()
          .optional()
          .describe('Office address or video link. Keep it here, not in notes.'),
        interviewerIds: z.array(z.uuid()).optional().describe(INTERVIEWER_IDS),
        nextStep: z.string().optional().describe(NEXT_STEP),
        replyBy: z.string().optional().describe(REPLY_BY),
        dueAt: z.string().optional().describe(DUE_AT),
        submittedAt: z.string().optional().describe(SUBMITTED_AT),
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
      description:
        'Reschedule or edit an interview, including its interviewers (interviewerIds) and its timeline (nextStep, replyBy, and for home_assignment dueAt and submittedAt). Send null to clear a field.',
      inputSchema: {
        applicationId,
        interviewId: z.uuid(),
        type: z.enum(INTERVIEW_TYPES).optional(),
        scheduledAt: z.string().optional().describe(SCHEDULED_AT),
        durationMinutes: nullable(z.number()),
        location: nullable(z.string()),
        interviewerIds: z
          .array(z.uuid())
          .optional()
          .describe(`${INTERVIEWER_IDS} Replaces the whole list; [] clears it.`),
        debriefed: nullable(z.boolean()).describe(
          'true: mark the interview as debriefed (the user logged how it went); null clears it',
        ),
        nextStep: nullable(z.string()).describe(NEXT_STEP),
        replyBy: nullable(z.string()).describe(REPLY_BY),
        dueAt: nullable(z.string()).describe(DUE_AT),
        submittedAt: nullable(z.string()).describe(SUBMITTED_AT),
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
        'List the notes of an application grouped by interview (newest interview first, newest note first). Check these before adding a note, to avoid repeating what is already there.',
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
      description: `Add a short plain-text note to an interview (upcoming or past): how it went, questions asked, what was learned about the role, prep links. ${NOTES_GUIDANCE} Add one note per independent point.`,
      inputSchema: {
        applicationId,
        interviewId,
        text: z.string().describe(`One compact, self-contained note. ${NOTES_GUIDANCE}`),
      },
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
      description: `Replace the text of an interview note. ${NOTES_GUIDANCE}`,
      inputSchema: {
        applicationId,
        interviewId,
        noteId: z.uuid(),
        text: z.string().describe(`New compact text. ${NOTES_GUIDANCE}`),
      },
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
