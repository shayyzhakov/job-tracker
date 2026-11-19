import { type ApplicationStatus, isRoundStatus } from './enums.js';

/**
 * How far along a milestone is. To apply and on hold are siblings (not submitted yet); every closed
 * outcome shares one rank, since an application ends with one outcome.
 */
const MILESTONE_RANK: Partial<Record<ApplicationStatus, number>> = {
  to_apply: 0,
  on_hold: 0,
  applied: 1,
  offer: 2,
  accepted: 3,
  rejected: 3,
  withdrawn: 3,
  ghosted: 3,
};
const CLOSED_RANK = 3;

const rank = (status: ApplicationStatus) => MILESTONE_RANK[status] ?? 1.5;

export interface HistoryStep {
  fromStatus?: ApplicationStatus | null;
  toStatus: ApplicationStatus;
}

export interface HistoryRewrite<T extends HistoryStep> {
  /** Rows that no longer belong in the path once the application moves on. */
  drop: T[];
  /** False when the target is already in the path (it keeps its first row and date): nothing to append. */
  append: boolean;
  /** The last milestone left in the path, the `fromStatus` of a row appended after it. */
  from: ApplicationStatus | null;
  /** The milestones the path holds afterwards, in order, including the target. */
  path: ApplicationStatus[];
}

/**
 * Keeps the status history one logical path forward (requirement 01, "History stays logical").
 * `history` is in time order. Moving to `to`:
 * 1. If `to` is already in the path, everything after its first appearance is dropped (a loop:
 *    to apply → applied → to apply, or applied → ghosted → applied).
 * 2. Otherwise later stages are undone: trailing milestones further along than `to` are dropped,
 *    and a closed outcome replaces the previous one (applied → ghosted → rejected keeps rejected only).
 *    Then `to` is appended.
 * Rows of round statuses (only on history written before rounds came from interviews) are never
 * dropped: the interview behind them still says that round happened.
 */
export function rewriteHistory<T extends HistoryStep>(
  history: readonly T[],
  to: ApplicationStatus,
): HistoryRewrite<T> {
  const milestones = history.filter((h) => !isRoundStatus(h.toStatus));
  const first = milestones.findIndex((h) => h.toStatus === to);
  let kept: T[];
  let append: boolean;
  if (first >= 0) {
    kept = milestones.slice(0, first + 1);
    append = false;
  } else {
    kept = [...milestones];
    const target = rank(to);
    while (kept.length > 0) {
      const last = rank((kept.at(-1) as T).toStatus);
      if (last > target || (last === CLOSED_RANK && target === CLOSED_RANK)) kept.pop();
      else break;
    }
    append = true;
  }
  const keptSet = new Set<T>(kept);
  return {
    drop: milestones.filter((h) => !keptSet.has(h)),
    append,
    from: append ? (kept.at(-1)?.toStatus ?? null) : null,
    path: [...kept.map((h) => h.toStatus), ...(append ? [to] : [])],
  };
}

/**
 * Replays a whole history (time order) through `rewriteHistory`, as if every change had been made
 * under it: the rows to drop, and kept rows whose `fromStatus` no longer matches the row before them.
 */
export function cleanHistory<T extends HistoryStep>(
  history: readonly T[],
): { drop: T[]; relink: { row: T; fromStatus: ApplicationStatus | null }[] } {
  const dropped = new Set<T>();
  const from = new Map<T, ApplicationStatus | null>();
  const live: T[] = [];
  for (const row of history) {
    if (isRoundStatus(row.toStatus)) {
      live.push(row);
      continue;
    }
    const rewrite = rewriteHistory(live, row.toStatus);
    for (const d of rewrite.drop) {
      dropped.add(d);
      live.splice(live.indexOf(d), 1);
    }
    if (rewrite.append) {
      live.push(row);
      from.set(row, rewrite.from);
    } else dropped.add(row);
  }
  return {
    drop: history.filter((h) => dropped.has(h)),
    relink: history
      .filter((h) => !dropped.has(h) && from.has(h) && (h.fromStatus ?? null) !== from.get(h))
      .map((row) => ({ row, fromStatus: from.get(row) ?? null })),
  };
}
