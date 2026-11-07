import {
  type ApplicationStatus,
  type DayActivity,
  dayKey,
  type InterviewType,
  type ProgressDto,
} from '@job-tracker/shared';
import type { ApplicationItem, ContactItem, HistoryItem, InterviewItem } from '../../db/mappers.js';

export const PROGRESS_TIMEZONE = 'Asia/Jerusalem';
/** How far back activity is reported (streaks and quests never look further). */
const WINDOW_DAYS = 400;

export interface ProgressInput {
  applications: ApplicationItem[];
  history: HistoryItem[];
  interviews: InterviewItem[];
  contacts: ContactItem[];
}

/** Pure read-model for the gamification layer: facts only, no scoring (that lives in @job-tracker/shared). */
export function buildProgress(
  { applications, history, interviews, contacts }: ProgressInput,
  now: Date,
  timeZone = PROGRESS_TIMEZONE,
): ProgressDto {
  const today = dayKey(now, timeZone);
  const cutoff = dayKey(new Date(now.getTime() - WINDOW_DAYS * 86_400_000), timeZone);
  const byDate = new Map<string, DayActivity>();

  const bump = (iso: string | null, field: Exclude<keyof DayActivity, 'date'>) => {
    if (!iso) return;
    const date = dayKey(new Date(iso), timeZone);
    if (date < cutoff) return;
    const entry = byDate.get(date) ?? {
      date,
      added: 0,
      applied: 0,
      statusChanges: 0,
      interviews: 0,
      contacts: 0,
    };
    entry[field]++;
    byDate.set(date, entry);
  };

  const stageReachedCounts: Partial<Record<ApplicationStatus, number>> = {};
  for (const a of applications) {
    bump(a.createdAt, 'added');
    bump(a.appliedAt, 'applied');
    for (const s of new Set(a.reachedStatuses)) {
      stageReachedCounts[s] = (stageReachedCounts[s] ?? 0) + 1;
    }
  }
  // The initial history row (fromStatus null) is the creation itself, already counted as "added".
  for (const h of history) if (h.fromStatus) bump(h.changedAt, 'statusChanges');
  for (const i of interviews) bump(i.createdAt, 'interviews');
  for (const c of contacts) bump(c.createdAt, 'contacts');

  return {
    timezone: timeZone,
    today,
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    applicationsCount: applications.length,
    appliedCount: applications.filter((a) => a.appliedAt).length,
    stageReachedCounts,
    interviewsCount: interviews.length,
    interviewTypesUsed: [...new Set(interviews.map((i) => i.type))] as InterviewType[],
    contactsCount: contacts.length,
  };
}
