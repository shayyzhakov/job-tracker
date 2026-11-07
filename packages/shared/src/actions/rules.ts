/** Default timers (days) and thresholds for the action queue. One place to tune them. */
export const ACTION_RULES = {
  /** Applied → follow up after this long without news. */
  appliedStaleDays: 14,
  /** After an interview → follow up after this long. */
  interviewStaleDays: 7,
  /** After a final interview the silence matters more. */
  finalInterviewStaleDays: 5,
  /** After the user hands the ball over a second time, wait this long again. */
  followUpStaleDays: 7,
  /** After "they're scheduling". */
  schedulingStaleDays: 3,
  /** After a home assignment is submitted. */
  assignmentStaleDays: 7,
  /** To apply: amber / red after this many days. */
  toApplySoonDays: 3,
  toApplyOverdueDays: 7,
  /** Round reached but no real interview time: amber after this many days. */
  scheduleSoonDays: 2,
  /** Home assignment without a due date / offer without expiry. */
  assignmentSoonDays: 3,
  offerOverdueDays: 5,
  /** Prep card appears this many hours before an interview. */
  prepWindowHours: 48,
  /** Interview length assumed when none is recorded. */
  defaultInterviewMinutes: 60,
  /** After this many follow-ups the card asks whether to mark the application ghosted. */
  ghostAfterFollowUps: 2,
  /** A stale follow-up becomes "overdue" once ignored this many days. */
  followUpOverdueDays: 3,
  /** Low-priority nudges shown at once. */
  nudgeCap: 5,
} as const;
