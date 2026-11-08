import type {
  ActionDto,
  ActionsDto,
  ApplicationDetailDto,
  ApplicationDto,
  CompanyDto,
  OpportunityDto,
  OverviewDto,
  ScoutCriteriaDto,
  UpcomingInterviewDto,
} from '@job-tracker/shared';
import { APPLICATION_STATUSES, DEFAULT_SCOUT_CRITERIA } from '@job-tracker/shared';

export const acme: CompanyDto = {
  id: 'c1',
  name: 'Acme',
  size: 'scale_up',
  isPublic: false,
  website: null,
  location: 'Tel Aviv',
};

export const application = (overrides: Partial<ApplicationDto> = {}): ApplicationDto => ({
  id: 'a1',
  company: acme,
  roleName: 'Backend Engineer',
  isManagement: false,
  status: 'applied',
  listingUrl: 'https://jobs.acme.com/1',
  expectedSalaryIls: 42000,
  source: null,
  applicationMethod: null,
  referrerName: null,
  referrerChannel: null,
  methodDetails: null,
  notes: null,
  appliedAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  nextInterviewAt: null,
  interviewsCount: 0,
  replyBy: null,
  dueAt: null,
  nextStep: null,
  snoozedUntil: null,
  statusChangedAt: '2026-11-01T10:00:00.000Z',
  waitingOnThemAt: null,
  followUps: 0,
  ...overrides,
});

export const applicationDetail = (
  overrides: Partial<ApplicationDetailDto> = {},
): ApplicationDetailDto => ({
  ...application(),
  contacts: [
    {
      id: 'ct1',
      applicationId: 'a1',
      name: 'Dana Levi',
      role: 'Recruiter',
      email: 'dana@acme.com',
      phone: null,
      linkedinUrl: null,
      notes: null,
    },
  ],
  interviews: [],
  interviewNotes: [],
  history: [
    {
      id: 'h1',
      applicationId: 'a1',
      fromStatus: null,
      toStatus: 'applied',
      changedAt: '2026-11-01T10:00:00.000Z',
      interviewId: null,
    },
  ],
  ...overrides,
});

export const upcomingInterview: UpcomingInterviewDto = {
  id: 'i1',
  applicationId: 'a1',
  type: 'technical',
  scheduledAt: '2026-11-07T12:00:00.000Z',
  durationMinutes: 60,
  location: null,
  timeUnknown: false,
  debriefedAt: null,
  companyName: 'Acme',
  roleName: 'Backend Engineer',
};

export const actionCard = (overrides: Partial<ActionDto> = {}): ActionDto => ({
  applicationId: 'a1',
  company: 'Acme',
  roleName: 'Backend Engineer',
  kind: 'follow_up',
  urgency: 'nudge',
  title: 'Follow up with Acme',
  subtitle: 'Applied 15 days ago',
  dueAt: null,
  interviewId: null,
  ...overrides,
});

export const actions = (overrides: Partial<ActionsDto> = {}): ActionsDto => ({
  needsYou: [],
  scheduled: [],
  waiting: [],
  hiddenNudges: 0,
  flagged: [],
  counts: { needsYou: 0, overdue: 0, waiting: 0 },
  ...overrides,
});

export const overview = (overrides: Partial<OverviewDto> = {}): OverviewDto => ({
  totalApplications: 5,
  activeApplications: 4,
  countsByStatus: {
    ...(Object.fromEntries(
      APPLICATION_STATUSES.map((s) => [s, 0]),
    ) as OverviewDto['countsByStatus']),
    applied: 2,
    phone_interview: 2,
    rejected: 1,
  },
  responseRate: 0.6,
  offers: 0,
  interviewsNext7Days: 1,
  nextInterview: upcomingInterview,
  upcomingInterviews: [upcomingInterview],
  weeklyApplied: [{ weekStart: '2026-11-01', count: 3 }],
  methodBreakdown: [
    { method: 'referral', applications: 2, responses: 2, interviews: 1 },
    { method: 'linkedin', applications: 3, responses: 1, interviews: 0 },
  ],
  averageExpectedSalaryIls: 42000,
  ...overrides,
});

export const opportunity = (overrides: Partial<OpportunityDto> = {}): OpportunityDto => ({
  id: 'o1',
  listingUrl: 'https://boards.example.com/nimbus/jobs/1001',
  source: 'fixture',
  companyName: 'Nimbus Data',
  title: 'Senior Backend Engineer',
  location: 'Tel Aviv',
  postedAt: '2026-11-04T07:30:00.000Z',
  score: 88,
  summary: 'Node.js services on Postgres and Kafka.',
  reasons: ['Senior backend role', 'Tel Aviv hybrid'],
  isManagement: false,
  companySize: 'startup',
  status: 'new',
  applicationId: null,
  createdAt: '2026-11-05T07:00:00.000Z',
  ...overrides,
});

export const scoutCriteria = (overrides: Partial<ScoutCriteriaDto> = {}): ScoutCriteriaDto => ({
  ...DEFAULT_SCOUT_CRITERIA,
  roles: ['Backend Engineer'],
  seniorities: ['senior'],
  locations: ['Tel Aviv'],
  updatedAt: '2026-11-01T10:00:00.000Z',
  ...overrides,
});
