import type { InterviewDto, RoundPhase } from '../dto.js';
import { ACTION_RULES as R } from './rules.js';

export interface CurrentRound {
  interview: InterviewDto;
  phase: RoundPhase;
}

const isAssignment = (i: InterviewDto) => i.type === 'home_assignment';
const at = (iso: string) => Date.parse(iso);

/**
 * When a round ended, or null while it is still going: a live round ends at its time plus its
 * duration (default length if unset); a home assignment ends when it is submitted.
 */
export function roundEnd(i: InterviewDto): number | null {
  if (isAssignment(i)) return i.submittedAt ? at(i.submittedAt) : null;
  if (i.timeUnknown) return null;
  return at(i.scheduledAt) + (i.durationMinutes ?? R.defaultInterviewMinutes) * 60_000;
}

/** True once the round is over (see `roundEnd`). */
export const hasEnded = (i: InterviewDto, now: Date) => {
  const end = roundEnd(i);
  return end !== null && end <= now.getTime();
};

/**
 * The round whose timeline counts right now, for an open application (the caller handles offers and
 * closed applications). In order:
 * 1. A home assignment received and not submitted (`open`) stays the user's move even when another
 *    round is scheduled after it. One followed by a live round already held is treated as done.
 * 2. The next live round still ahead (`upcoming`).
 * 3. The latest round without a real time (`unscheduled`), if added after the last round ended.
 * 4. The round that ended last (`ended`).
 */
export function currentRound(interviews: InterviewDto[], now: Date): CurrentRound | null {
  const t = now.getTime();
  const sorted = [...interviews].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const live = sorted.filter((i) => !isAssignment(i));
  const liveHeld = live.filter((i) => hasEnded(i, now));

  const openAssignment = sorted
    .filter(
      (i) =>
        isAssignment(i) &&
        !i.submittedAt &&
        at(i.scheduledAt) <= t &&
        !liveHeld.some((l) => l.scheduledAt > i.scheduledAt),
    )
    .at(-1);
  if (openAssignment) return { interview: openAssignment, phase: 'open' };

  const upcoming = live.find((i) => !i.timeUnknown && !hasEnded(i, now));
  if (upcoming) return { interview: upcoming, phase: 'upcoming' };

  const ended = sorted
    .filter((i) => hasEnded(i, now))
    .sort((a, b) => (roundEnd(a) ?? 0) - (roundEnd(b) ?? 0))
    .at(-1);
  const unscheduled = live.filter((i) => i.timeUnknown).at(-1);
  if (unscheduled && (!ended || at(unscheduled.scheduledAt) >= (roundEnd(ended) ?? 0))) {
    return { interview: unscheduled, phase: 'unscheduled' };
  }
  return ended ? { interview: ended, phase: 'ended' } : null;
}
