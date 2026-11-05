import type {
  ApplicationDto,
  CompanyDto,
  ContactDto,
  InterviewDto,
  StatusHistoryDto,
} from '@job-tracker/shared';
import type { applications, companies, contacts, interviews, statusHistory } from './schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

export const toCompanyDto = (c: Row<typeof companies>): CompanyDto => ({
  id: c.id,
  name: c.name,
  size: c.size,
  isPublic: c.isPublic,
  website: c.website,
  location: c.location,
});

export const toContactDto = (c: Row<typeof contacts>): ContactDto => ({
  id: c.id,
  applicationId: c.applicationId,
  name: c.name,
  role: c.role,
  email: c.email,
  phone: c.phone,
  notes: c.notes,
});

export const toInterviewDto = (i: Row<typeof interviews>): InterviewDto => ({
  id: i.id,
  applicationId: i.applicationId,
  type: i.type,
  scheduledAt: iso(i.scheduledAt),
  durationMinutes: i.durationMinutes,
  location: i.location,
  notes: i.notes,
});

export const toHistoryDto = (h: Row<typeof statusHistory>): StatusHistoryDto => ({
  id: h.id,
  applicationId: h.applicationId,
  fromStatus: h.fromStatus,
  toStatus: h.toStatus,
  changedAt: iso(h.changedAt),
});

export const toApplicationDto = (
  a: Row<typeof applications>,
  company: Row<typeof companies>,
  nextInterviewAt: Date | null,
): ApplicationDto => ({
  id: a.id,
  company: toCompanyDto(company),
  roleName: a.roleName,
  isManagement: a.isManagement,
  status: a.status,
  listingUrl: a.listingUrl,
  expectedSalaryIls: a.expectedSalaryIls,
  source: a.source,
  notes: a.notes,
  appliedAt: isoOrNull(a.appliedAt),
  createdAt: iso(a.createdAt),
  updatedAt: iso(a.updatedAt),
  nextInterviewAt: isoOrNull(nextInterviewAt),
});
