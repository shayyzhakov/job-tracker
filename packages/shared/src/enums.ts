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

/** Statuses that represent an interview round (as opposed to applying, an offer, or a close). */
export const INTERVIEW_ROUND_STATUSES = [
  'hr_screening',
  'phone_interview',
  'technical_interview',
  'home_assignment',
  'onsite_interview',
  'final_interview',
] as const satisfies readonly ApplicationStatus[];

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
  'home_assignment',
  'home_assignment_review',
  'onsite',
  'managerial',
  'final',
  'coffee',
  'other',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  hr: 'HR',
  phone: 'Phone',
  technical: 'Technical',
  system_design: 'System design',
  home_assignment: 'Home assignment',
  home_assignment_review: 'Home assignment review',
  onsite: 'Onsite',
  managerial: 'Managerial',
  final: 'Final',
  coffee: 'Coffee chat',
  other: 'Other',
};

/** Interview type recorded for each interview-round status. */
export const ROUND_STATUS_INTERVIEW_TYPE: Record<
  (typeof INTERVIEW_ROUND_STATUSES)[number],
  InterviewType
> = {
  hr_screening: 'hr',
  phone_interview: 'phone',
  technical_interview: 'technical',
  home_assignment: 'home_assignment',
  onsite_interview: 'onsite',
  final_interview: 'final',
};

/** Pipeline stage an interview type belongs to (types without a stage don't move the status). */
export const INTERVIEW_TYPE_ROUND_STATUS: Partial<Record<InterviewType, ApplicationStatus>> = {
  hr: 'hr_screening',
  phone: 'phone_interview',
  technical: 'technical_interview',
  system_design: 'technical_interview',
  home_assignment: 'home_assignment',
  onsite: 'onsite_interview',
  final: 'final_interview',
};

export function isRoundStatus(
  status: ApplicationStatus,
): status is (typeof INTERVIEW_ROUND_STATUSES)[number] {
  return (INTERVIEW_ROUND_STATUSES as readonly ApplicationStatus[]).includes(status);
}

/** How the user applied to / got into the process for a role. */
export const APPLICATION_METHODS = [
  'referral',
  'linkedin',
  'company_site',
  'job_board',
  'recruiter_outreach',
  'networking_event',
  'other',
] as const;
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];

export const APPLICATION_METHOD_LABELS: Record<ApplicationMethod, string> = {
  referral: 'Referral',
  linkedin: 'Self-applied via LinkedIn',
  company_site: 'Self-applied via company site',
  job_board: 'Job board (Drushim, AllJobs, …)',
  recruiter_outreach: 'Recruiter reached out',
  networking_event: 'Networking / event',
  other: 'Other',
};

/** How the user and a referrer got in touch about the role. */
export const REFERRAL_CHANNELS = [
  'in_person',
  'phone',
  'whatsapp',
  'linkedin',
  'email',
  'other',
] as const;
export type ReferralChannel = (typeof REFERRAL_CHANNELS)[number];

export const REFERRAL_CHANNEL_LABELS: Record<ReferralChannel, string> = {
  in_person: 'In person',
  phone: 'Phone call',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn message',
  email: 'Email',
  other: 'Other',
};
