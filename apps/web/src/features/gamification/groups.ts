import type { ApplicationStatus } from '@job-tracker/shared';

export type GroupId = 'todo' | 'progress' | 'done';

export interface StageGroup {
  id: GroupId;
  title: string;
  hint: string;
  statuses: readonly ApplicationStatus[];
  /** Status given when a card is dropped here; null = ask (the outcome is ambiguous). */
  dropStatus: ApplicationStatus | null;
}

export const GROUPS: StageGroup[] = [
  {
    id: 'todo',
    title: 'To do',
    hint: 'Not submitted yet',
    statuses: ['to_apply'],
    dropStatus: 'to_apply',
  },
  {
    id: 'progress',
    title: 'In progress',
    hint: 'Applied, waiting or interviewing',
    statuses: [
      'applied',
      'hr_screening',
      'phone_interview',
      'technical_interview',
      'home_assignment',
      'onsite_interview',
      'final_interview',
    ],
    dropStatus: 'applied',
  },
  {
    id: 'done',
    title: 'Done',
    hint: 'Offers and closed applications',
    statuses: ['offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'],
    dropStatus: null,
  },
];

export const groupOf = (status: ApplicationStatus): GroupId =>
  (GROUPS.find((g) => g.statuses.includes(status)) ?? (GROUPS[0] as StageGroup)).id;
