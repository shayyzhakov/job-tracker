import { describe, expect, it } from 'vitest';
import {
  ApplicationCreateSchema,
  ApplicationUpdateSchema,
  ContactInputSchema,
  InterviewInputSchema,
  StatusChangeSchema,
} from './schemas.js';

const valid = {
  company: { name: 'Acme', size: 'startup', isPublic: false, location: 'Tel Aviv' },
  roleName: 'Senior Backend Engineer',
  isManagement: false,
};

describe('ApplicationCreateSchema', () => {
  it('accepts a minimal application with a new company and defaults status to to_apply', () => {
    const parsed = ApplicationCreateSchema.parse(valid);
    expect(parsed.status).toBe('to_apply');
    expect(parsed.contacts).toEqual([]);
  });

  it('accepts an existing company by id', () => {
    const id = '0b8a6f3e-7c1d-4b8e-9f2a-1d2c3b4a5e6f';
    const parsed = ApplicationCreateSchema.parse({ ...valid, company: { id } });
    expect(parsed.company).toEqual({ id });
  });

  it('trims the role name and rejects an empty one', () => {
    expect(ApplicationCreateSchema.parse({ ...valid, roleName: '  Dev  ' }).roleName).toBe('Dev');
    expect(ApplicationCreateSchema.safeParse({ ...valid, roleName: '   ' }).success).toBe(false);
  });

  it('rejects an unknown company size', () => {
    const r = ApplicationCreateSchema.safeParse({
      ...valid,
      company: { ...valid.company, size: 'huge' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a negative or fractional salary', () => {
    expect(ApplicationCreateSchema.safeParse({ ...valid, expectedSalaryIls: -1 }).success).toBe(
      false,
    );
    expect(ApplicationCreateSchema.safeParse({ ...valid, expectedSalaryIls: 1.5 }).success).toBe(
      false,
    );
  });

  it('requires a valid listing URL when given', () => {
    expect(ApplicationCreateSchema.safeParse({ ...valid, listingUrl: 'nope' }).success).toBe(false);
    expect(
      ApplicationCreateSchema.safeParse({ ...valid, listingUrl: 'https://jobs.example.com/1' })
        .success,
    ).toBe(true);
  });

  it('accepts multiple contacts', () => {
    const parsed = ApplicationCreateSchema.parse({
      ...valid,
      contacts: [
        { name: 'Dana', role: 'Recruiter', email: 'dana@acme.com' },
        { name: 'Avi', phone: '+972-50-1234567' },
      ],
    });
    expect(parsed.contacts).toHaveLength(2);
  });
});

describe('ApplicationUpdateSchema', () => {
  it('allows partial updates but not status (status has its own endpoint)', () => {
    expect(ApplicationUpdateSchema.parse({ notes: 'follow up' })).toEqual({ notes: 'follow up' });
    expect(ApplicationUpdateSchema.parse({ status: 'offer' })).not.toHaveProperty('status');
  });
});

describe('StatusChangeSchema', () => {
  it('rejects unknown statuses', () => {
    expect(StatusChangeSchema.safeParse({ status: 'hired?' }).success).toBe(false);
    expect(StatusChangeSchema.parse({ status: 'phone_interview' }).status).toBe('phone_interview');
  });
});

describe('ContactInputSchema', () => {
  it('requires a name and validates email', () => {
    expect(ContactInputSchema.safeParse({ email: 'a@b.co' }).success).toBe(false);
    expect(ContactInputSchema.safeParse({ name: 'Dana', email: 'not-email' }).success).toBe(false);
  });

  it('accepts an http(s) LinkedIn url and rejects other schemes', () => {
    const url = 'https://www.linkedin.com/in/dana';
    expect(ContactInputSchema.parse({ name: 'Dana', linkedinUrl: url }).linkedinUrl).toBe(url);
    expect(
      ContactInputSchema.safeParse({ name: 'Dana', linkedinUrl: 'javascript:alert(1)' }).success,
    ).toBe(false);
    expect(ContactInputSchema.safeParse({ name: 'Dana', linkedinUrl: 'nope' }).success).toBe(false);
  });

  it('turns empty optional strings into undefined (blank form fields)', () => {
    expect(
      ContactInputSchema.parse({ name: 'Dana', email: '', phone: '', linkedinUrl: '' }),
    ).toEqual({
      name: 'Dana',
    });
  });
});

describe('InterviewInputSchema', () => {
  it('parses an ISO date and defaults type to other', () => {
    const parsed = InterviewInputSchema.parse({ scheduledAt: '2026-11-10T09:00:00.000Z' });
    expect(parsed.scheduledAt).toBeInstanceOf(Date);
    expect(parsed.type).toBe('other');
  });
});

describe('ApplicationUpdateSchema clearing', () => {
  it('turns blank strings into null so the field is cleared', () => {
    expect(ApplicationUpdateSchema.parse({ notes: '', listingUrl: '' })).toEqual({
      notes: null,
      listingUrl: null,
    });
  });
});

describe('child update schemas', () => {
  it('ContactUpdateSchema clears blank fields and validates email', async () => {
    const { ContactUpdateSchema } = await import('./schemas.js');
    expect(ContactUpdateSchema.parse({ email: '' })).toEqual({ email: null });
    expect(ContactUpdateSchema.safeParse({ email: 'bad' }).success).toBe(false);
  });

  it('InterviewUpdateSchema applies no defaults', async () => {
    const { InterviewUpdateSchema } = await import('./schemas.js');
    expect(InterviewUpdateSchema.parse({ location: 'x' })).toEqual({ location: 'x' });
  });

  it('note schemas trim text and reject blank text', async () => {
    const { NoteInputSchema, NoteUpdateSchema } = await import('./schemas.js');
    expect(NoteInputSchema.parse({ text: '  Asked about indexes\nand caching ' })).toEqual({
      text: 'Asked about indexes\nand caching',
    });
    expect(NoteInputSchema.safeParse({ text: '   ' }).success).toBe(false);
    expect(NoteUpdateSchema.safeParse({}).success).toBe(false);
  });
});
