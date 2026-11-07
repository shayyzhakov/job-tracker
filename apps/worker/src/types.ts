import { COMPANY_SIZES, type ScoutCriteria, SENIORITY_LEVELS } from '@job-tracker/shared';
import { z } from 'zod';

/** A job listing as a source returns it, before de-duplication and scoring. */
export const RawListingSchema = z.object({
  url: z.string().min(1),
  title: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  location: z.string().trim().nullish(),
  description: z.string().default(''),
  /** ISO timestamp, when the source knows it. */
  postedAt: z.string().nullish(),
});
export type RawListing = z.input<typeof RawListingSchema>;

/** Where listings come from (a job board API, a feed, a fixture file...). */
export interface ListingSource {
  readonly name: string;
  fetchListings(): Promise<RawListing[]>;
}

export const ListingScoreSchema = z.object({
  /** 0–100 match against the criteria. */
  score: z.number(),
  /** One or two sentences on the role, for the suggestion card. */
  summary: z.string(),
  /** Short bullet reasons for (or against) the match. */
  reasons: z.array(z.string()),
  isManagement: z.boolean(),
  seniority: z.enum(SENIORITY_LEVELS).nullable(),
  /** Inferred from the company and listing; null when unknown. */
  companySize: z.enum(COMPANY_SIZES).nullable(),
});
export type ListingScore = z.infer<typeof ListingScoreSchema>;

export interface ListingScorer {
  score(listing: RawListing, criteria: ScoutCriteria): Promise<ListingScore>;
}

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}
