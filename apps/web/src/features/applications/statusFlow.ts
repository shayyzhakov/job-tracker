import {
  type ApplicationDetailDto,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPE_ROUND_STATUS,
  STATUS_LABELS,
} from '@job-tracker/shared';

export interface FlowStep {
  key: string;
  title: string;
  at: string;
  /** Dated in the future: hasn't happened yet. */
  scheduled: boolean;
}

/**
 * The whole flow of an application in one chronological list: every status change on record
 * (to apply, applied, offer, closed outcomes), the applied date, and every interview round.
 * A step is "scheduled" purely by its timestamp being in the future.
 *
 * The applied date is a bare date (midnight), which can fall before the moment the application was
 * added. Applied is therefore never ordered before the first recorded step, so the flow reads
 * to apply → applied, while still showing the applied date.
 */
export function buildStatusFlow(
  app: Pick<ApplicationDetailDto, 'history' | 'interviews' | 'appliedAt'>,
  now: number,
): FlowStep[] {
  const interviewIds = new Set(app.interviews.map((i) => i.id));
  // Applied is shown once, at the applied date (the history row only records when it was typed in).
  const firstApplied = app.history.find(
    (h) => h.toStatus === 'applied' && h.fromStatus !== 'rejected',
  );
  const firstRecorded = app.history
    .filter((h) => h.fromStatus === null || h.toStatus === 'to_apply')
    .map((h) => h.changedAt)
    .sort()[0];
  const appliedSort =
    app.appliedAt && firstRecorded && firstRecorded > app.appliedAt ? firstRecorded : app.appliedAt;

  interface Item {
    key: string;
    title: string;
    at: string;
    sortAt: string;
    rank: number;
  }
  const items: Item[] = [
    ...(app.appliedAt
      ? [
          {
            key: 'applied',
            title: STATUS_LABELS.applied,
            at: app.appliedAt,
            sortAt: appliedSort ?? app.appliedAt,
            rank: 2,
          },
        ]
      : []),
    ...app.history
      // A row from before rounds came from interviews that points at an interview is that interview.
      .filter((h) => !(h.interviewId && interviewIds.has(h.interviewId)))
      .filter((h) => !(app.appliedAt && h === firstApplied))
      .map((h) => ({
        key: `h-${h.id}`,
        title: STATUS_LABELS[h.toStatus],
        at: h.changedAt,
        sortAt: h.changedAt,
        rank: 1,
      })),
    ...app.interviews.map((i) => {
      const stage = INTERVIEW_TYPE_ROUND_STATUS[i.type];
      return {
        key: `i-${i.id}`,
        title: stage ? STATUS_LABELS[stage] : `${INTERVIEW_TYPE_LABELS[i.type]} interview`,
        at: i.scheduledAt,
        sortAt: i.scheduledAt,
        rank: 1,
      };
    }),
  ];
  return items
    .sort((a, b) => Date.parse(a.sortAt) - Date.parse(b.sortAt) || a.rank - b.rank)
    .map(({ key, title, at }) => ({ key, title, at, scheduled: new Date(at).getTime() > now }));
}
