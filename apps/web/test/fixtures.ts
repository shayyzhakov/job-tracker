import type {
  ApplicationDetailDto,
  ApplicationDto,
  CompanyDto,
  OverviewDto,
  UpcomingInterviewDto,
} from '@job-tracker/shared';
import { APPLICATION_STATUSES } from '@job-tracker/shared';

export const acme: CompanyDto = {
  id: 'c1',
  name: 'Acme',
  size: 'unicorn',
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
  notes: null,
  appliedAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  nextInterviewAt: null,
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
      notes: null,
    },
  ],
  interviews: [],
  history: [
    {
      id: 'h1',
      applicationId: 'a1',
      fromStatus: null,
      toStatus: 'applied',
      changedAt: '2026-11-01T10:00:00.000Z',
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
  notes: null,
  companyName: 'Acme',
  roleName: 'Backend Engineer',
};

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
  averageExpectedSalaryIls: 42000,
  ...overrides,
});
