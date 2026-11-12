import { z } from 'zod';
import {
  APPLICATION_METHODS,
  APPLICATION_STATUSES,
  COMPANY_PRIORITIES,
  COMPANY_SIZES,
  INTERVIEW_TYPES,
  REFERRAL_CHANNELS,
  STATUS_GROUPS,
} from './enums.js';

/** Blank form fields ('' or whitespace) become undefined before validation. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());
const optionalText = optional(z.string().trim());
/** http(s) only: the value is rendered as a link, so `javascript:` and friends are rejected. */
const httpUrl = z
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must start with http:// or https://');

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const StatusGroupSchema = z.enum(STATUS_GROUPS);
export const CompanySizeSchema = z.enum(COMPANY_SIZES);
export const CompanyPrioritySchema = z.enum(COMPANY_PRIORITIES);
export const ApplicationMethodSchema = z.enum(APPLICATION_METHODS);
export const ReferralChannelSchema = z.enum(REFERRAL_CHANNELS);
export const InterviewTypeSchema = z.enum(INTERVIEW_TYPES);

export const CompanyInputSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  size: CompanySizeSchema.optional(),
  /** Scout priority; new companies start as moderate when omitted. */
  priority: CompanyPrioritySchema.optional(),
  isPublic: z.boolean().default(false),
  website: optional(z.url()),
  location: optionalText,
});
export type CompanyInput = z.infer<typeof CompanyInputSchema>;

/** Partial company edit: only the fields sent change; `null` clears an optional field. */
export const CompanyUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Required'),
    size: CompanySizeSchema.nullable(),
    priority: CompanyPrioritySchema,
    isPublic: z.boolean(),
    website: z.preprocess(blankToNull, z.url().nullable()),
    location: z.preprocess(blankToNull, z.string().trim().nullable()),
  })
  .partial();
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;

export const ContactInputSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  role: optionalText,
  email: optional(z.email()),
  phone: optionalText,
  linkedinUrl: optional(httpUrl),
  notes: optionalText,
});
export type ContactInput = z.infer<typeof ContactInputSchema>;
export type ContactCreateInput = z.input<typeof ContactInputSchema>;

/** Points at a contact that already exists, so it is reused instead of re-typed. */
export const ContactRefSchema = z.object({ contactId: z.uuid() });
export type ContactRef = z.infer<typeof ContactRefSchema>;

/** Attach a contact to an application: an existing one by id, or new details (matched on email / LinkedIn). */
export const ContactAttachSchema = z.union([ContactRefSchema, ContactInputSchema]);
export type ContactAttach = z.infer<typeof ContactAttachSchema>;
export type ContactAttachInput = z.input<typeof ContactAttachSchema>;

export const ContactListQuerySchema = z.object({ q: optionalText });
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>;

/** True when the attach payload references an existing contact. */
export const isContactRef = (c: ContactAttach): c is ContactRef => 'contactId' in c;

const applicationFields = {
  roleName: z.string().trim().min(1, 'Required'),
  isManagement: z.boolean().default(false),
  listingUrl: optional(z.url()),
  expectedSalaryIls: z.number().int().nonnegative().optional(),
  source: optionalText,
  applicationMethod: optional(ApplicationMethodSchema),
  referrerName: optionalText,
  referrerChannel: optional(ReferralChannelSchema),
  methodDetails: optionalText,
  notes: optionalText,
  appliedAt: optional(z.coerce.date()),
  replyBy: optional(z.coerce.date()),
  dueAt: optional(z.coerce.date()),
  nextStep: optionalText,
};

export const ApplicationCreateSchema = z.object({
  company: z.union([z.object({ id: z.uuid() }), CompanyInputSchema]),
  status: ApplicationStatusSchema.default('to_apply'),
  contacts: z.array(ContactAttachSchema).default([]),
  ...applicationFields,
});
export type ApplicationCreateInput = z.input<typeof ApplicationCreateSchema>;
export type ApplicationCreate = z.output<typeof ApplicationCreateSchema>;

/**
 * Status is excluded on purpose: status changes go through StatusChangeSchema so history is recorded.
 * No defaults here — a PATCH must only touch the fields it sends. `null` clears a field.
 */
export const ApplicationUpdateSchema = z
  .object({
    roleName: z.string().trim().min(1, 'Required'),
    isManagement: z.boolean(),
    listingUrl: z.preprocess(blankToNull, z.url().nullable()),
    expectedSalaryIls: z.number().int().nonnegative().nullable(),
    source: z.preprocess(blankToNull, z.string().trim().nullable()),
    applicationMethod: z.preprocess(blankToNull, ApplicationMethodSchema.nullable()),
    referrerName: z.preprocess(blankToNull, z.string().trim().nullable()),
    referrerChannel: z.preprocess(blankToNull, ReferralChannelSchema.nullable()),
    methodDetails: z.preprocess(blankToNull, z.string().trim().nullable()),
    notes: z.preprocess(blankToNull, z.string().trim().nullable()),
    appliedAt: z.preprocess(blankToNull, z.coerce.date().nullable()),
    replyBy: z.preprocess(blankToNull, z.coerce.date().nullable()),
    dueAt: z.preprocess(blankToNull, z.coerce.date().nullable()),
    nextStep: z.preprocess(blankToNull, z.string().trim().nullable()),
    company: CompanyUpdateSchema,
  })
  .partial();
export type ApplicationUpdate = z.infer<typeof ApplicationUpdateSchema>;
export type ApplicationUpdateInput = z.input<typeof ApplicationUpdateSchema>;

export const StatusChangeSchema = z.object({
  status: ApplicationStatusSchema,
  /** When the interview for a round stage takes place (past or future); defaults to now. */
  interviewAt: z.coerce.date().optional(),
  /** Optional timeline the employer gave: when they'll reply by, and the user's own deadline (assignment due / offer expiry). */
  replyBy: optional(z.coerce.date()),
  dueAt: optional(z.coerce.date()),
});
export type StatusChange = z.infer<typeof StatusChangeSchema>;

export const SnoozeSchema = z.object({ until: z.coerce.date() });
export type Snooze = z.infer<typeof SnoozeSchema>;

export const HAND_OVER_REASONS = ['followed_up', 'submitted', 'they_scheduling'] as const;
export type HandOverReason = (typeof HAND_OVER_REASONS)[number];
export const HandOverSchema = z.object({ reason: z.enum(HAND_OVER_REASONS) });
export type HandOver = z.infer<typeof HandOverSchema>;

export const InterviewInputSchema = z.object({
  type: InterviewTypeSchema.default('other'),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional(),
  location: optionalText,
  /** The round exists but nobody has given a real time yet (scheduledAt is a placeholder). */
  timeUnknown: z.boolean().optional(),
});
export type InterviewInput = z.infer<typeof InterviewInputSchema>;
export type InterviewCreateInput = z.input<typeof InterviewInputSchema>;

export const ApplicationListQuerySchema = z.object({
  status: ApplicationStatusSchema.optional(),
  /** Comma-separated status groups (initial, active, closed); omitted means every group. */
  groups: optional(
    z
      .union([z.string(), z.array(z.string())])
      .transform((v) =>
        (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).map((g) => g.trim()),
      )
      .pipe(z.array(StatusGroupSchema)),
  ),
  q: optionalText,
});
export type ApplicationListQuery = z.infer<typeof ApplicationListQuerySchema>;

const nullableText = z.preprocess(blankToNull, z.string().trim().nullable());

export const ContactUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'Required'),
    role: nullableText,
    email: z.preprocess(blankToNull, z.email().nullable()),
    phone: nullableText,
    linkedinUrl: z.preprocess(blankToNull, httpUrl.nullable()),
    notes: nullableText,
  })
  .partial();
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;
export type ContactUpdateInput = z.input<typeof ContactUpdateSchema>;

export const InterviewUpdateSchema = z
  .object({
    type: InterviewTypeSchema,
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().positive().nullable(),
    location: nullableText,
    /** Set to true to mark the interview debriefed (now), or null to clear. */
    debriefed: z.boolean().nullable(),
  })
  .partial();
export type InterviewUpdate = z.infer<typeof InterviewUpdateSchema>;
export type InterviewUpdateInput = z.input<typeof InterviewUpdateSchema>;

/** A note is multi-line plain text attached to one interview. Blank text is rejected. */
const noteText = z.string().trim().min(1, 'Required');
export const NoteInputSchema = z.object({ text: noteText });
export type NoteInput = z.infer<typeof NoteInputSchema>;
export const NoteUpdateSchema = z.object({ text: noteText });
export type NoteUpdate = z.infer<typeof NoteUpdateSchema>;
