export type ActionKind =
  | 'respond_offer'
  | 'submit_assignment'
  | 'prep_interview'
  | 'schedule_interview'
  | 'debrief'
  | 'follow_up'
  | 'mark_ghosted'
  | 'apply';

/** Ordered most to least urgent. `deadline` = a hard date ahead; `overdue` = past due or ignored too long. */
export const ACTION_URGENCIES = ['deadline', 'overdue', 'soon', 'nudge'] as const;
export type ActionUrgency = (typeof ACTION_URGENCIES)[number];

export interface ActionDto {
  applicationId: string;
  company: string;
  roleName: string;
  kind: ActionKind;
  urgency: ActionUrgency;
  title: string;
  subtitle: string;
  /** The date that drives ranking, when there is one (deadline, interview time, or when the wait expired). */
  dueAt: string | null;
  /** The interview a prep/debrief card refers to. */
  interviewId: string | null;
}

export interface WaitingDto {
  applicationId: string;
  company: string;
  roleName: string;
  /** `scheduled`: an interview is on the calendar. `waiting`: the employer's move (or snoozed). */
  state: 'scheduled' | 'waiting';
  subtitle: string;
  /** When this is worth looking at again: the interview time, or when the wait runs out. */
  checkInAt: string;
}

export interface ActionsDto {
  /** Cards for the user, most urgent first. Low-priority nudges beyond the cap are left out (see hiddenNudges). */
  needsYou: ActionDto[];
  /** Interviews further out than the prep window, soonest first. */
  scheduled: WaitingDto[];
  /** Waiting on the employer, soonest check-in first. */
  waiting: WaitingDto[];
  hiddenNudges: number;
  counts: { needsYou: number; overdue: number; waiting: number };
}
