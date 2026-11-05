import { z } from 'zod';
import { APPLICATION_STATUSES, COMPANY_SIZES, INTERVIEW_TYPES } from './enums.js';

/** Blank form fields ('' or whitespace) become undefined before validation. */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());
const optionalText = optional(z.string().trim());

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const CompanySizeSchema = z.enum(COMPANY_SIZES);
export const InterviewTypeSchema = z.enum(INTERVIEW_TYPES);

export const CompanyInputSchema = z.object({
  name: z.string().trim().min(1),
  size: CompanySizeSchema.optional(),
  isPublic: z.boolean().default(false),
  website: optional(z.url()),
  location: optionalText,
});
export type CompanyInput = z.infer<typeof CompanyInputSchema>;

export const ContactInputSchema = z.object({
  name: z.string().trim().min(1),
  role: optionalText,
  email: optional(z.email()),
  phone: optionalText,
  notes: optionalText,
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

const applicationFields = {
  roleName: z.string().trim().min(1),
  isManagement: z.boolean().default(false),
  listingUrl: optional(z.url()),
  expectedSalaryIls: z.number().int().nonnegative().optional(),
  source: optionalText,
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
    roleName: z.string().trim().min(1),
    isManagement: z.boolean(),
    listingUrl: z.preprocess(blankToNull, z.url().nullable()),
    expectedSalaryIls: z.number().int().nonnegative().nullable(),
    source: z.preprocess(blankToNull, z.string().trim().nullable()),
    notes: z.preprocess(blankToNull, z.string().trim().nullable()),
    appliedAt: z.preprocess(blankToNull, z.coerce.date().nullable()),
    company: z
      .object({
        name: z.string().trim().min(1),
        size: CompanySizeSchema.nullable(),
        isPublic: z.boolean(),
        website: z.preprocess(blankToNull, z.url().nullable()),
        location: z.preprocess(blankToNull, z.string().trim().nullable()),
      })
      .partial(),
  })
  .partial();
export type ApplicationUpdate = z.infer<typeof ApplicationUpdateSchema>;

export const StatusChangeSchema = z.object({ status: ApplicationStatusSchema });
export type StatusChange = z.infer<typeof StatusChangeSchema>;

export const InterviewInputSchema = z.object({
  type: InterviewTypeSchema.default('other'),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().optional(),
  location: optionalText,
  notes: optionalText,
});
export type InterviewInput = z.infer<typeof InterviewInputSchema>;

export const ApplicationListQuerySchema = z.object({
  status: ApplicationStatusSchema.optional(),
  active: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: optionalText,
});
export type ApplicationListQuery = z.infer<typeof ApplicationListQuerySchema>;
