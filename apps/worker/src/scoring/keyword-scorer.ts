import type { ScoutCriteria, Seniority } from '@job-tracker/shared';
import type { ListingScore, ListingScorer, RawListing } from '../types.js';

// Checked in order; the first match wins (so "Senior Engineering Manager" is a manager).
const SENIORITY_PATTERNS: [Seniority, RegExp][] = [
  ['director', /\b(director|head of|vp)\b/i],
  ['manager', /\bmanager\b/i],
  ['team_lead', /\b(team lead|tech lead|lead)\b/i],
  ['principal', /\bprincipal\b/i],
  ['staff', /\bstaff\b/i],
  ['senior', /\b(senior|sr\.?)\b/i],
  ['junior', /\b(junior|jr\.?|entry)\b/i],
  ['mid', /\bmid\b/i],
];
const MANAGEMENT: Seniority[] = ['team_lead', 'manager', 'director'];

const includes = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * Deterministic offline scorer: role title 60, seniority 20, location 20.
 * Used without an API key and for local end-to-end runs; ClaudeScorer is the real one.
 */
export class KeywordScorer implements ListingScorer {
  async score(listing: RawListing, criteria: ScoutCriteria): Promise<ListingScore> {
    const seniority = SENIORITY_PATTERNS.find(([, re]) => re.test(listing.title))?.[0] ?? null;
    const isManagement = seniority !== null && MANAGEMENT.includes(seniority);
    const location = listing.location ?? '';
    const reasons: string[] = [];

    const hasCriteria =
      criteria.roles.length + criteria.seniorities.length + criteria.locations.length > 0;
    if (!hasCriteria) {
      return {
        score: 50,
        summary: listing.title,
        reasons,
        isManagement,
        seniority,
        companySize: null,
      };
    }

    let score = 0;
    const role = criteria.roles.find((r) => includes(listing.title, r));
    if (role || criteria.roles.length === 0) {
      score += 60;
      if (role) reasons.push(`Title matches "${role}"`);
    }
    if (
      criteria.seniorities.length === 0 ||
      (seniority && criteria.seniorities.includes(seniority))
    ) {
      score += 20;
      if (seniority && criteria.seniorities.length > 0) reasons.push(`Seniority: ${seniority}`);
    }
    const place = criteria.locations.find((l) => includes(location, l));
    if (place || criteria.locations.length === 0) {
      score += 20;
      if (place) reasons.push(`Location: ${place}`);
    }

    return { score, summary: listing.title, reasons, isManagement, seniority, companySize: null };
  }
}
