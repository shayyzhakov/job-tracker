// Wire-format types returned by the API (dates are ISO strings).
import type { ApplicationStatus, CompanySize, InterviewType } from './enums.js';

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
  notes: string | null;
}

export interface InterviewDto {
  id: string;
  applicationId: string;
  type: InterviewType;
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  notes: string | null;
}

export interface StatusHistoryDto {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
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
  notes: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Next upcoming interview, if any — convenient for list views. */
  nextInterviewAt: string | null;
}

export interface ApplicationDetailDto extends ApplicationDto {
  contacts: ContactDto[];
  interviews: InterviewDto[];
  history: StatusHistoryDto[];
}

export interface UpcomingInterviewDto extends InterviewDto {
  companyName: string;
  roleName: string;
}

export interface OverviewDto {
  totalApplications: number;
  activeApplications: number;
  countsByStatus: Record<ApplicationStatus, number>;
  /** Share of submitted applications that progressed past "applied" (0–1), null if none submitted. */
  responseRate: number | null;
  offers: number;
  interviewsThisWeek: number;
  nextInterview: UpcomingInterviewDto | null;
  upcomingInterviews: UpcomingInterviewDto[];
  /** Applications submitted per ISO week (week start date, YYYY-MM-DD), last 8 weeks, oldest first. */
  weeklyApplied: { weekStart: string; count: number }[];
  averageExpectedSalaryIls: number | null;
}
