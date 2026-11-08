// Wire-format types returned by the API (dates are ISO strings).
import type {
  ApplicationMethod,
  ApplicationStatus,
  CompanySize,
  InterviewType,
  ReferralChannel,
} from './enums.js';

export interface CompanyDto {
  id: string;
  name: string;
  size: CompanySize | null;
  isPublic: boolean;
  website: string | null;
  location: string | null;
}

export interface ContactDto {
  id: string;
  applicationId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
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
  /** Interview rounds reached so far, derived from the status history. */
  interviewsCount: number;
  /** When the employer said they'd reply by (ISO date); overrides the default waiting timer. */
  replyBy: string | null;
  /** The user's own deadline: home-assignment due date or offer expiry. */
  dueAt: string | null;
  /** One-line manual "what I should do next". */
  nextStep: string | null;
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
}

export interface UpcomingInterviewDto extends InterviewDto {
  companyName: string;
  roleName: string;
}

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
  activeApplications: number;
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
