// AI opportunity scout: search criteria, suggested listings and listing URL normalisation.
import { z } from 'zod';
import { COMPANY_SIZES, type CompanySize } from './enums.js';

export const SENIORITY_LEVELS = [
  'junior',
  'mid',
  'senior',
  'staff',
  'principal',
  'team_lead',
  'manager',
  'director',
] as const;
export type Seniority = (typeof SENIORITY_LEVELS)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  staff: 'Staff',
  principal: 'Principal',
  team_lead: 'Team lead',
  manager: 'Manager',
  director: 'Director',
};

export const ROLE_TRACKS = ['ic', 'management', 'either'] as const;
export type RoleTrack = (typeof ROLE_TRACKS)[number];

export const ROLE_TRACK_LABELS: Record<RoleTrack, string> = {
  ic: 'Individual contributor',
  management: 'Management',
  either: 'Either',
};

/**
 * new: shown as a suggestion. filtered: scored or screened out (kept so it is never re-scored).
 * dismissed / promoted: the user acted on it.
 */
export const OPPORTUNITY_STATUSES = ['new', 'filtered', 'dismissed', 'promoted'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Trimmed, non-blank, de-duplicated (case-insensitive, first spelling wins) list of strings. */
const textList = z
  .array(z.string())
  .default([])
  .transform((items) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of items) {
      const item = raw.trim();
      const key = item.toLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  });

export const ScoutCriteriaSchema = z.object({
  /** Role titles to look for, e.g. "Backend Engineer". */
  roles: textList,
  seniorities: z.array(z.enum(SENIORITY_LEVELS)).default([]),
  track: z.enum(ROLE_TRACKS).default('either'),
  /** Free-text locations, e.g. "Tel Aviv", "Remote (Israel)". */
  locations: textList,
  /** Allowed company sizes; empty means any size. */
  companySizes: z.array(z.enum(COMPANY_SIZES)).default([]),
  /** Companies never to suggest (matched case-insensitively). */
  excludedCompanies: textList,
  /** Listings scoring below this (0–100) are filtered out. */
  minScore: z.number().int().min(0).max(100).default(60),
});
export type ScoutCriteria = z.output<typeof ScoutCriteriaSchema>;
export type ScoutCriteriaInput = z.input<typeof ScoutCriteriaSchema>;

export const DEFAULT_SCOUT_CRITERIA: ScoutCriteria = ScoutCriteriaSchema.parse({});

export const OpportunityListQuerySchema = z.object({
  status: z.enum(OPPORTUNITY_STATUSES).default('new'),
});
export type OpportunityListQuery = z.infer<typeof OpportunityListQuerySchema>;

export const OpportunityCreateSchema = z.object({
  listingUrl: z.url(),
  companyName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  source: z.string().trim().min(1).default('Manual'),
  location: z.string().trim().min(1).optional(),
  description: z.string().default(''),
  postedAt: z.iso.datetime({ offset: true }).optional(),
  score: z.number().int().min(0).max(100).default(70),
  summary: z.string().default(''),
  reasons: z.array(z.string()).default([]),
  isManagement: z.boolean().default(false),
  companySize: z.enum(COMPANY_SIZES).optional(),
});
export type OpportunityCreateInput = z.output<typeof OpportunityCreateSchema>;

export interface OpportunityDto {
  id: string;
  listingUrl: string;
  source: string;
  companyName: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  /** Match score 0–100. */
  score: number;
  summary: string;
  reasons: string[];
  isManagement: boolean;
  companySize: CompanySize | null;
  status: OpportunityStatus;
  /** Set once promoted. */
  applicationId: string | null;
  createdAt: string;
}

export interface ScoutCriteriaDto extends ScoutCriteria {
  updatedAt: string | null;
}

const TRACKING_PARAMS = new Set(['ref', 'source', 'src', 'trk', 'fbclid', 'gclid', 'lipi']);
const isTrackingParam = (key: string) =>
  key.toLowerCase().startsWith('utm_') || TRACKING_PARAMS.has(key.toLowerCase());

/** Canonical form of a listing URL, used to de-duplicate listings across runs and sources. */
export function normalizeListingUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  const kept = [...url.searchParams].filter(([key]) => !isTrackingParam(key));
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = new URLSearchParams(kept).toString();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}
