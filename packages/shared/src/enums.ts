export const APPLICATION_STATUSES = [
  'to_apply',
  'applied',
  'hr_screening',
  'phone_interview',
  'technical_interview',
  'home_assignment',
  'onsite_interview',
  'final_interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const CLOSED_STATUSES = [
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted',
] as const satisfies readonly ApplicationStatus[];

export function isActiveStatus(status: ApplicationStatus): boolean {
  return !(CLOSED_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  to_apply: 'To apply',
  applied: 'Applied',
  hr_screening: 'HR screening',
  phone_interview: 'Phone interview',
  technical_interview: 'Technical interview',
  home_assignment: 'Home assignment',
  onsite_interview: 'Onsite interview',
  final_interview: 'Final interview',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
};

export const COMPANY_SIZES = ['early_stage_startup', 'startup', 'unicorn', 'corporate'] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  early_stage_startup: 'Early-stage startup',
  startup: 'Startup',
  unicorn: 'Unicorn',
  corporate: 'Corporate',
};

export const INTERVIEW_TYPES = [
  'hr',
  'phone',
  'technical',
  'system_design',
  'home_assignment_review',
  'onsite',
  'managerial',
  'final',
  'other',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr: 'HR',
  phone: 'Phone',
  technical: 'Technical',
  system_design: 'System design',
  home_assignment_review: 'Home assignment review',
  onsite: 'Onsite',
  managerial: 'Managerial',
  final: 'Final',
  other: 'Other',
};
