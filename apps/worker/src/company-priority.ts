import type { CompanyPriority } from '@job-tracker/shared';

/** A company the user has put in a non-default priority bucket. */
export interface PrioritizedCompany {
  name: string;
  priority: CompanyPriority;
}

/** How much a company's priority moves a listing's 0–100 score. Blacklist is handled separately. */
export const SCORE_ADJUSTMENT: Record<CompanyPriority, number> = {
  top: 15,
  high: 8,
  moderate: 0,
  low: -8,
  blacklist: 0,
};

const normalize = (name: string) => name.trim().toLowerCase();

/** Looks companies up by name, case-insensitively (scout listings carry free-text names). */
export class PriorityIndex {
  private readonly byName = new Map<string, CompanyPriority>();

  constructor(companies: readonly { name: string; priority: CompanyPriority }[]) {
    for (const c of companies) this.byName.set(normalize(c.name), c.priority);
  }

  get(companyName: string): CompanyPriority {
    return this.byName.get(normalize(companyName)) ?? 'moderate';
  }

  /** Companies in a non-default bucket, for steering a source. */
  prioritized(): PrioritizedCompany[] {
    return [...this.byName.entries()]
      .filter(([, priority]) => priority !== 'moderate')
      .map(([name, priority]) => ({ name, priority }));
  }
}

/** Applies the bucket's boost or penalty, clamped to 0–100. Returns the new score and a reason. */
export function adjustScore(
  score: number,
  priority: CompanyPriority,
): { score: number; note: string | null } {
  const delta = SCORE_ADJUSTMENT[priority];
  if (delta === 0) return { score, note: null };
  const adjusted = Math.max(0, Math.min(100, score + delta));
  const label =
    priority === 'top' ? 'Top-priority' : priority === 'high' ? 'High-priority' : 'Low-priority';
  return { score: adjusted, note: `${label} company (${delta > 0 ? '+' : ''}${delta})` };
}
