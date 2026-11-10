import {
  type ApplicationDto,
  type ApplicationMethod,
  type ApplicationStatus,
  type CompanyDto,
  type CompanySize,
  type ContactDto,
  displayedStatus,
  INTERVIEW_ROUND_STATUSES,
  INTERVIEW_TYPE_ROUND_STATUS,
  type InterviewDto,
  type InterviewMoment,
  type InterviewType,
  type NoteDto,
  type OpportunityDto,
  type OpportunityStatus,
  type ReferralChannel,
  type StatusHistoryDto,
} from '@job-tracker/shared';

// Stored item shapes (dates are ISO strings; key attributes are not part of these types).

export interface CompanyItem {
  id: string;
  name: string;
  size: CompanySize | null;
  isPublic: boolean;
  website: string | null;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationItem {
  id: string;
  companyId: string;
  roleName: string;
  isManagement: boolean;
  status: ApplicationStatus;
  listingUrl: string | null;
  expectedSalaryIls: number | null;
  source: string | null;
  applicationMethod?: ApplicationMethod | null;
  referrerName?: string | null;
  referrerChannel?: ReferralChannel | null;
  methodDetails?: string | null;
  notes: string | null;
  appliedAt: string | null;
  /** Every status this application has ever had (replaces an aggregate over the history rows). */
  reachedStatuses: ApplicationStatus[];
  /** Action-queue fields; absent on rows written before they existed. */
  replyBy?: string | null;
  dueAt?: string | null;
  nextStep?: string | null;
  snoozedUntil?: string | null;
  statusChangedAt?: string;
  waitingOnThemAt?: string | null;
  followUps?: number;
  createdAt: string;
  updatedAt: string;
}

/** A person, shared by every application they are attached to (`CONTACT#<id> / META`). */
export interface ContactItem {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Attaches a contact to one application (`APP#<appId> / CONTACT#<contactId>`). */
export interface ContactLinkItem {
  /** The contact's id. */
  id: string;
  applicationId: string;
  createdAt: string;
}

export interface InterviewItem {
  id: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  timeUnknown?: boolean;
  debriefedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  applicationId: string;
  interviewId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryItem {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
  /** Absent on rows written before interviews were linked to stages. */
  interviewId?: string | null;
}

export interface OpportunityItem {
  id: string;
  listingUrl: string;
  source: string;
  companyName: string;
  title: string;
  location: string | null;
  description: string;
  postedAt: string | null;
  score: number;
  summary: string;
  reasons: string[];
  isManagement: boolean;
  companySize: CompanySize | null;
  status: OpportunityStatus;
  applicationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Nullable optional input fields are stored as explicit nulls so DTOs never see `undefined`. */
export const nul = <T>(v: T | null | undefined): T | null => v ?? null;

export const toCompanyDto = (c: CompanyItem): CompanyDto => ({
  id: c.id,
  name: c.name,
  size: c.size,
  isPublic: c.isPublic,
  website: c.website,
  location: c.location,
});

export const toContactDto = (c: ContactItem, applicationCount: number): ContactDto => ({
  id: c.id,
  applicationCount,
  name: c.name,
  role: c.role,
  email: c.email,
  phone: c.phone,
  linkedinUrl: c.linkedinUrl ?? null,
  notes: c.notes,
});

export const toInterviewDto = (i: InterviewItem): InterviewDto => ({
  id: i.id,
  applicationId: i.applicationId,
  type: i.type,
  scheduledAt: i.scheduledAt,
  durationMinutes: i.durationMinutes,
  location: i.location,
  timeUnknown: i.timeUnknown ?? false,
  debriefedAt: i.debriefedAt ?? null,
});

export const toNoteDto = (n: NoteItem): NoteDto => ({
  id: n.id,
  applicationId: n.applicationId,
  interviewId: n.interviewId,
  text: n.text,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

export const toHistoryDto = (h: HistoryItem): StatusHistoryDto => ({
  id: h.id,
  applicationId: h.applicationId,
  fromStatus: h.fromStatus,
  toStatus: h.toStatus,
  changedAt: h.changedAt,
  interviewId: h.interviewId ?? null,
});

/** What the interviews of one application say about its status (see `displayedStatus`). */
export interface InterviewTiming {
  /** Earliest interview strictly in the future. */
  next: InterviewMoment | null;
  /** Earliest future interview that has a stage (the one that sets the displayed status). */
  nextStaged: InterviewMoment | null;
  hasPast: boolean;
  /** Latest past interview that has a stage. */
  lastPast: InterviewMoment | null;
  /** Stages of past interviews. */
  pastStages: ReadonlySet<ApplicationStatus>;
  /** Past interviews that have a stage (two phone calls count as two). */
  heldStaged: number;
}

export const NO_TIMING: InterviewTiming = {
  next: null,
  nextStaged: null,
  hasPast: false,
  lastPast: null,
  pastStages: new Set(),
  heldStaged: 0,
};

/** Interview rounds held so far: one per past interview with a stage (a round only in old history does not count). */
const interviewRoundsReached = (timing: InterviewTiming) => timing.heldStaged;

/** Rows from before statusChangedAt existed: appliedAt is exact while still "applied", else the last touch. */
const statusChangedFallback = (a: ApplicationItem) =>
  a.status === 'applied' && a.appliedAt ? a.appliedAt : a.updatedAt;

export const toApplicationDto = (
  a: ApplicationItem,
  company: CompanyItem,
  timing: InterviewTiming = NO_TIMING,
): ApplicationDto => {
  const statusChangedAt = a.statusChangedAt ?? statusChangedFallback(a);
  return {
    id: a.id,
    company: toCompanyDto(company),
    roleName: a.roleName,
    isManagement: a.isManagement,
    status: displayedStatus({
      status: a.status,
      next: timing.nextStaged,
      lastPast: timing.lastPast,
    }),
    listingUrl: a.listingUrl,
    expectedSalaryIls: a.expectedSalaryIls,
    source: a.source,
    applicationMethod: nul(a.applicationMethod),
    referrerName: nul(a.referrerName),
    referrerChannel: nul(a.referrerChannel),
    methodDetails: nul(a.methodDetails),
    notes: a.notes,
    appliedAt: a.appliedAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    nextInterviewAt: timing.next?.at ?? null,
    nextInterviewType: timing.next?.type ?? null,
    interviewsCount: interviewRoundsReached(timing),
    replyBy: nul(a.replyBy),
    dueAt: nul(a.dueAt),
    nextStep: nul(a.nextStep),
    snoozedUntil: nul(a.snoozedUntil),
    statusChangedAt,
    waitingOnThemAt: nul(a.waitingOnThemAt),
    followUps: a.followUps ?? 0,
  };
};

export const toOpportunityDto = (o: OpportunityItem): OpportunityDto => ({
  id: o.id,
  listingUrl: o.listingUrl,
  source: o.source,
  companyName: o.companyName,
  title: o.title,
  location: o.location,
  postedAt: o.postedAt,
  score: o.score,
  summary: o.summary,
  reasons: o.reasons,
  isManagement: o.isManagement,
  companySize: o.companySize,
  status: o.status,
  applicationId: o.applicationId,
  createdAt: o.createdAt,
});
