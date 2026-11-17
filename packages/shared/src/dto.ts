// Wire-format types returned by the API (dates are ISO strings).
import type {
  ApplicationMethod,
  ApplicationStatus,
  CompanyPriority,
  CompanySize,
  InterviewType,
  ReferralChannel,
} from './enums.js';

export interface CompanyDto {
  id: string;
  name: string;
  size: CompanySize | null;
  /** How much the scout should care about this company. */
  priority: CompanyPriority;
  isPublic: boolean;
  website: string | null;
  location: string | null;
}

/** A company with its application counts (derived on read, never stored). */
export interface CompanyWithCountsDto extends CompanyDto {
  openApplications: number;
  totalApplications: number;
}

/** One application of a company, as shown on the company detail. */
export interface CompanyApplicationDto {
  id: string;
  roleName: string;
  status: ApplicationStatus;
}

export interface CompanyDetailDto extends CompanyWithCountsDto {
  applications: CompanyApplicationDto[];
}

/** A person (recruiter, headhunter, hiring manager) shared by every application they appear on. */
export interface ContactDto {
  id: string;
  /** How many applications this contact is attached to (1 = only the one it is shown on). */
  applicationCount: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
}

export interface ContactApplicationDto {
  id: string;
  roleName: string;
  status: ApplicationStatus;
  companyName: string;
}

/** A contact with every application it is attached to. */
export interface ContactDetailDto extends ContactDto {
  applications: ContactApplicationDto[];
}

export interface InterviewDto {
  id: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  /** True when the round was created from a status change without a real time; the time is a placeholder. */
  timeUnknown: boolean;
  /** When the user logged how the interview went (or dismissed the prompt); null until then. */
  debriefedAt: string | null;
  /** What to do before this round; current only until the round ends. */
  nextStep: string | null;
  /** When they said they'd reply after this round; replaces the default follow-up timer. */
  replyBy: string | null;
  /** Home assignment only: when it is due. */
  dueAt: string | null;
  /** Home assignment only: when it was submitted (the round ends then). */
  submittedAt: string | null;
}

/**
 * Where a round stands relative to now. `upcoming`: a live round still ahead (or in progress).
 * `unscheduled`: a live round with no real time yet. `open`: a home assignment received and not
 * submitted. `ended`: the round is over (time plus duration passed, or the assignment was submitted).
 */
export type RoundPhase = 'upcoming' | 'unscheduled' | 'open' | 'ended';

/** The round whose timeline counts right now (see `currentRound`). */
export interface CurrentRoundDto {
  interviewId: string;
  phase: RoundPhase;
}

export interface NoteDto {
  id: string;
  applicationId: string;
  interviewId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryDto {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
  /** The interview this step created or came from; null for plain status changes and older rows. */
  interviewId: string | null;
}

export interface ApplicationDto {
  id: string;
  company: CompanyDto;
  roleName: string;
  isManagement: boolean;
  status: ApplicationStatus;
  listingUrl: string | null;
  expectedSalaryIls: number | null;
  source: string | null;
  /** How the user applied; null for applications created before this was tracked. */
  applicationMethod: ApplicationMethod | null;
  /** Who referred the user (only meaningful for the referral method). */
  referrerName: string | null;
  /** How the user and the referrer spoke. */
  referrerChannel: ReferralChannel | null;
  /** Anything else relevant to the method (job-board name, recruiter, event, …). */
  methodDetails: string | null;
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Next upcoming interview, if any — convenient for list views. */
  nextInterviewAt: string | null;
  /** Type of that interview; lets the list label rounds that have no stage (review, other). */
  nextInterviewType: InterviewType | null;
  /** Interview rounds reached so far, derived from the status history. */
  interviewsCount: number;
  /** When the offer expires; only meaningful while the status is offer. */
  offerExpiresAt: string | null;
  /** The action card for this application is hidden until this time. */
  snoozedUntil: string | null;
  /** When the application last moved to its current status. */
  statusChangedAt: string;
  /** When the user handed the ball to the employer (follow-up sent, assignment submitted…); ignored if older than statusChangedAt. */
  waitingOnThemAt: string | null;
  /** Follow-ups sent since the last status change. */
  followUps: number;
}

export interface ApplicationDetailDto extends ApplicationDto {
  contacts: ContactDto[];
  interviews: InterviewDto[];
  /** Interview notes of the whole application, newest first. */
  interviewNotes: NoteDto[];
  history: StatusHistoryDto[];
  /** The round whose timeline (next step, due date, reply-by) counts now; null for offers, closed and no rounds. */
  currentRound: CurrentRoundDto | null;
}

export interface UpcomingInterviewDto extends InterviewDto {
  companyName: string;
  roleName: string;
}

/** One interview round on the cross-application timeline. */
export type TimelineInterviewDto = UpcomingInterviewDto;

export interface MethodStatDto {
  method: ApplicationMethod;
  /** Applications submitted via this method (status past to_apply). */
  applications: number;
  /** Of those, how many got any response (reached a stage beyond applied). */
  responses: number;
  /** Of those, how many reached an interview stage or beyond (offer included). */
  interviews: number;
}

export interface OverviewDto {
  totalApplications: number;
  /** Not closed: initial + active. */
  openApplications: number;
  /** Applications in the Active group (interviewing or at offer). */
  inProgressApplications: number;
  countsByStatus: Record<ApplicationStatus, number>;
  /**
   * Share of submitted applications (status past to_apply) that got any response —
   * reached a stage beyond "applied", rejections included (0–1). Null if none submitted.
   */
  responseRate: number | null;
  /** Applications that ever reached the offer stage. */
  offers: number;
  /** Interviews scheduled within the next 7 days. */
  interviewsNext7Days: number;
  nextInterview: UpcomingInterviewDto | null;
  upcomingInterviews: UpcomingInterviewDto[];
  /** Applications submitted per week (weeks start Sunday, UTC, YYYY-MM-DD), last 8 weeks, oldest first. */
  weeklyApplied: { weekStart: string; count: number }[];
  /** Applications grouped by how the user applied, most used first. Applications without a method are not counted. */
  methodBreakdown: MethodStatDto[];
  /** Mean expected monthly salary across active applications that have one. */
  averageExpectedSalaryIls: number | null;
}
