import type { ApplicationStatus, InterviewType } from '../enums.js';

/** What happened on one calendar day (in `ProgressDto.timezone`). Zero-activity days are omitted. */
export interface DayActivity {
  /** YYYY-MM-DD */
  date: string;
  /** Applications added to the tracker. */
  added: number;
  /** Applications submitted (appliedAt). */
  applied: number;
  /** Status changes recorded. */
  statusChanges: number;
  /** Interviews scheduled (created). */
  interviews: number;
  /** Contacts added. */
  contacts: number;
}

/**
 * Raw facts the gamification layer derives everything from (XP, levels, streaks, achievements, quests).
 * Read-only view over existing data; nothing here is persisted by the gamification layer.
 */
export interface ProgressDto {
  timezone: string;
  /** Server's "today" (YYYY-MM-DD in `timezone`). */
  today: string;
  days: DayActivity[];
  applicationsCount: number;
  appliedCount: number;
  /** For each status, how many applications ever reached it. */
  stageReachedCounts: Partial<Record<ApplicationStatus, number>>;
  interviewsCount: number;
  interviewTypesUsed: InterviewType[];
  contactsCount: number;
}
