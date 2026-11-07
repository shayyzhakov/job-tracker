import { z } from 'zod';
import {
  APPLICATION_METHODS,
  APPLICATION_STATUSES,
  COMPANY_SIZES,
  INTERVIEW_TYPES,
  REFERRAL_CHANNELS,
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
export const CompanySizeSchema = z.enum(COMPANY_SIZES);
export const ApplicationMethodSchema = z.enum(APPLICATION_METHODS);
export const ReferralChannelSchema = z.enum(REFERRAL_CHANNELS);
export const InterviewTypeSchema = z.enum(INTERVIEW_TYPES);

export const CompanyInputSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  size: CompanySizeSchema.optional(),
  isPublic: z.boolean().default(false),
  website: optional(z.url()),
  location: optionalText,
});
export type CompanyInput = z.infer<typeof CompanyInputSchema>;

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
};

export const ApplicationCreateSchema = z.object({
  company: z.union([z.object({ id: z.uuid() }), CompanyInputSchema]),
  status: ApplicationStatusSchema.default('to_apply'),
  contacts: z.array(ContactInputSchema).default([]),
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
    company: z
      .object({
        name: z.string().trim().min(1, 'Required'),
        size: CompanySizeSchema.nullable(),
        isPublic: z.boolean(),
        website: z.preprocess(blankToNull, z.url().nullable()),
        location: z.preprocess(blankToNull, z.string().trim().nullable()),
      })
      .partial(),
  })
  .partial();
export type ApplicationUpdate = z.infer<typeof ApplicationUpdateSchema>;
export type ApplicationUpdateInput = z.input<typeof ApplicationUpdateSchema>;

export const StatusChangeSchema = z.object({
  status: ApplicationStatusSchema,
  /** Record a new step even when the status is unchanged (e.g. a second phone interview). */
  repeat: z.boolean().optional(),
  /** When the interview for a round stage takes place (past or future); defaults to now. */
  interviewAt: z.coerce.date().optional(),
});
export type StatusChange = z.infer<typeof StatusChangeSchema>;

export const InterviewInputSchema = z.object({
  type: InterviewTypeSchema.default('other'),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional(),
  location: optionalText,
  notes: optionalText,
});
export type InterviewInput = z.infer<typeof InterviewInputSchema>;
export type InterviewCreateInput = z.input<typeof InterviewInputSchema>;

export const ApplicationListQuerySchema = z.object({
  status: ApplicationStatusSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
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
    notes: nullableText,
  })
  .partial();
export type InterviewUpdate = z.infer<typeof InterviewUpdateSchema>;
export type InterviewUpdateInput = z.input<typeof InterviewUpdateSchema>;
