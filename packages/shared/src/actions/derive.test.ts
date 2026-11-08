import { describe, expect, it } from 'vitest';
import type { ApplicationDto, InterviewDto } from '../dto.js';
import type { ApplicationStatus } from '../enums.js';
import { deriveActions } from './derive.js';

const NOW = new Date('2026-11-05T10:00:00Z'); // 12:00 in Asia/Jerusalem
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const inHours = (n: number) => new Date(NOW.getTime() + n * 3_600_000).toISOString();

let seq = 0;
const app = (status: ApplicationStatus, over: Partial<ApplicationDto> = {}): ApplicationDto => ({
  id: `a${++seq}`,
  company: { id: 'c', name: 'Acme', size: null, isPublic: false, website: null, location: null },
  roleName: 'Engineer',
  isManagement: false,
  status,
  listingUrl: null,
  expectedSalaryIls: null,
  source: null,
  applicationMethod: null,
  referrerName: null,
  referrerChannel: null,
  methodDetails: null,
  notes: null,
  appliedAt: null,
  createdAt: daysAgo(30),
  updatedAt: daysAgo(1),
  nextInterviewAt: null,
  interviewsCount: 0,
  replyBy: null,
  dueAt: null,
  nextStep: null,
  snoozedUntil: null,
  statusChangedAt: daysAgo(1),
  waitingOnThemAt: null,
  followUps: 0,
  ...over,
});

const interview = (
  a: ApplicationDto,
  scheduledAt: string,
  over: Partial<InterviewDto> = {},
): InterviewDto => ({
  id: `i${++seq}`,
  applicationId: a.id,
  type: 'phone',
  scheduledAt,
  durationMinutes: 60,
  location: null,
  timeUnknown: false,
  debriefedAt: null,
  ...over,
});

const run = (applications: ApplicationDto[], interviews: InterviewDto[] = []) =>
  deriveActions({ applications, interviews, now: NOW });

describe('deriveActions', () => {
  it('ignores closed applications', () => {
    const r = run(
      ['accepted', 'rejected', 'withdrawn', 'ghosted'].map((s) => app(s as ApplicationStatus)),
    );
    expect(r.needsYou).toEqual([]);
    expect(r.waiting).toEqual([]);
    expect(r.counts).toEqual({ needsYou: 0, overdue: 0, waiting: 0 });
  });

  describe('to_apply', () => {
    it.each([
      [1, 'nudge'],
      [3, 'soon'],
      [7, 'overdue'],
    ])('after %i days is %s', (days, urgency) => {
      const r = run([app('to_apply', { createdAt: daysAgo(days) })]);
      expect(r.needsYou[0]).toMatchObject({ kind: 'apply', urgency });
    });
  });

  describe('applied', () => {
    it('waits until 14 days, then asks for a follow-up', () => {
      const early = run([app('applied', { statusChangedAt: daysAgo(5) })]);
      expect(early.needsYou).toEqual([]);
      expect(early.waiting).toHaveLength(1);

      const stale = run([app('applied', { statusChangedAt: daysAgo(15) })]);
      expect(stale.needsYou[0]).toMatchObject({ kind: 'follow_up', urgency: 'nudge' });
    });

    it('becomes overdue once the follow-up is ignored for 3 days', () => {
      const r = run([app('applied', { statusChangedAt: daysAgo(17) })]);
      expect(r.needsYou[0]).toMatchObject({ kind: 'follow_up', urgency: 'overdue' });
    });

    it('replyBy replaces the default timer', () => {
      const tomorrow = new Date(NOW.getTime() + 86_400_000).toISOString();
      const waiting = run([app('applied', { statusChangedAt: daysAgo(20), replyBy: tomorrow })]);
      expect(waiting.needsYou).toEqual([]);
      expect(waiting.waiting[0]?.subtitle).toContain('they said by');

      const missed = run([app('applied', { statusChangedAt: daysAgo(2), replyBy: daysAgo(1) })]);
      expect(missed.needsYou[0]).toMatchObject({ kind: 'follow_up' });
    });

    it('restarts a 7-day timer after a follow-up', () => {
      const a = app('applied', {
        statusChangedAt: daysAgo(30),
        waitingOnThemAt: daysAgo(3),
        followUps: 1,
      });
      expect(run([a]).needsYou).toEqual([]);
      const b = { ...a, waitingOnThemAt: daysAgo(8) };
      expect(run([b]).needsYou[0]).toMatchObject({ kind: 'follow_up' });
    });

    it('asks whether to mark ghosted after two follow-ups', () => {
      const a = app('applied', {
        statusChangedAt: daysAgo(40),
        waitingOnThemAt: daysAgo(8),
        followUps: 2,
      });
      expect(run([a]).needsYou[0]).toMatchObject({ kind: 'mark_ghosted', urgency: 'overdue' });
    });

    it('ignores a hand-over older than the status change', () => {
      const a = app('applied', { statusChangedAt: daysAgo(2), waitingOnThemAt: daysAgo(10) });
      expect(run([a]).waiting[0]?.checkInAt).toBe(
        new Date(Date.parse(daysAgo(2)) + 14 * 86_400_000).toISOString(),
      );
    });
  });

  describe('interview rounds', () => {
    it('with no real interview time asks to schedule, amber after 2 days', () => {
      const fresh = run([app('phone_interview', { statusChangedAt: daysAgo(0) })]);
      expect(fresh.needsYou[0]).toMatchObject({ kind: 'schedule_interview', urgency: 'nudge' });
      const older = run([app('phone_interview', { statusChangedAt: daysAgo(2) })]);
      expect(older.needsYou[0]).toMatchObject({ kind: 'schedule_interview', urgency: 'soon' });
    });

    it('treats a placeholder (timeUnknown) interview as not scheduled', () => {
      const a = app('phone_interview', { statusChangedAt: daysAgo(3) });
      const r = run([a], [interview(a, daysAgo(3), { timeUnknown: true })]);
      expect(r.needsYou[0]).toMatchObject({ kind: 'schedule_interview' });
    });

    it('"they\'re scheduling" hands over with a 3-day timer', () => {
      const a = app('phone_interview', {
        statusChangedAt: daysAgo(2),
        waitingOnThemAt: daysAgo(1),
      });
      expect(run([a]).waiting).toHaveLength(1);
      const stale = { ...a, statusChangedAt: daysAgo(6), waitingOnThemAt: daysAgo(4) };
      expect(run([stale]).needsYou[0]).toMatchObject({ kind: 'follow_up' });
    });

    it('lists an interview beyond 48h as scheduled', () => {
      const a = app('technical_interview');
      const r = run([a], [interview(a, inHours(24 * 5))]);
      expect(r.needsYou).toEqual([]);
      expect(r.scheduled).toHaveLength(1);
    });

    it('keeps an interview within 48h as scheduled, not a task', () => {
      const a = app('technical_interview');
      const r = run([a], [interview(a, inHours(30))]);
      expect(r.needsYou).toEqual([]);
      expect(r.scheduled).toHaveLength(1);
    });

    it('asks for a debrief from the day after, once', () => {
      const a = app('phone_interview');
      const sameDay = run([a], [interview(a, inHours(-3))]);
      expect(sameDay.needsYou).toEqual([]);

      const nextDay = run([a], [interview(a, daysAgo(1))]);
      expect(nextDay.needsYou[0]).toMatchObject({ kind: 'debrief' });

      const done = run([a], [interview(a, daysAgo(1), { debriefedAt: daysAgo(0) })]);
      expect(done.needsYou).toEqual([]);
      expect(done.waiting).toHaveLength(1);
    });

    it('goes stale 7 days after an interview, 5 after a final one', () => {
      const phone = app('phone_interview');
      const pi = interview(phone, daysAgo(8), { debriefedAt: daysAgo(7) });
      expect(run([phone], [pi]).needsYou[0]).toMatchObject({ kind: 'follow_up' });

      const fin = app('final_interview');
      const fi = interview(fin, daysAgo(6), { debriefedAt: daysAgo(5) });
      expect(run([fin], [fi]).needsYou[0]).toMatchObject({ kind: 'follow_up' });
      const pi2 = interview(phone, daysAgo(6), { debriefedAt: daysAgo(5) });
      expect(run([phone], [pi2]).needsYou).toEqual([]);
    });
  });

  describe('home assignment', () => {
    it('ranks by due date and escalates when past due', () => {
      const due = app('home_assignment', { dueAt: inHours(20) });
      expect(run([due]).needsYou[0]).toMatchObject({
        kind: 'submit_assignment',
        urgency: 'deadline',
      });
      const late = app('home_assignment', { dueAt: inHours(-5) });
      expect(run([late]).needsYou[0]).toMatchObject({ urgency: 'overdue' });
    });

    it('without a due date turns amber after 3 days', () => {
      expect(
        run([app('home_assignment', { statusChangedAt: daysAgo(1) })]).needsYou[0]?.urgency,
      ).toBe('nudge');
      expect(
        run([app('home_assignment', { statusChangedAt: daysAgo(3) })]).needsYou[0]?.urgency,
      ).toBe('soon');
    });

    it('is waiting once submitted, stale after 7 days', () => {
      const a = app('home_assignment', {
        statusChangedAt: daysAgo(10),
        waitingOnThemAt: daysAgo(2),
      });
      expect(run([a]).waiting).toHaveLength(1);
      const stale = { ...a, waitingOnThemAt: daysAgo(8) };
      expect(run([stale]).needsYou[0]).toMatchObject({ kind: 'follow_up' });
    });
  });

  describe('offer', () => {
    it('is a deadline when it has an expiry, overdue once expired', () => {
      expect(run([app('offer', { dueAt: inHours(48) })]).needsYou[0]).toMatchObject({
        kind: 'respond_offer',
        urgency: 'deadline',
      });
      expect(run([app('offer', { dueAt: inHours(-1) })]).needsYou[0]?.urgency).toBe('overdue');
    });

    it('without expiry is amber, red after 5 days', () => {
      expect(run([app('offer', { statusChangedAt: daysAgo(1) })]).needsYou[0]?.urgency).toBe(
        'soon',
      );
      expect(run([app('offer', { statusChangedAt: daysAgo(5) })]).needsYou[0]?.urgency).toBe(
        'overdue',
      );
    });
  });

  describe('snooze', () => {
    it('hides the card until the snooze ends, then returns it', () => {
      const a = app('to_apply', { createdAt: daysAgo(8), snoozedUntil: inHours(24) });
      const hidden = run([a]);
      expect(hidden.needsYou).toEqual([]);
      expect(hidden.waiting[0]?.subtitle).toContain('Snoozed');

      const back = run([{ ...a, snoozedUntil: inHours(-1) }]);
      expect(back.needsYou[0]).toMatchObject({ kind: 'apply', urgency: 'overdue' });
    });
  });

  describe('ranking and caps', () => {
    it('orders deadlines, overdue, soon, then nudges; earliest date first', () => {
      const r = run([
        app('to_apply', {
          createdAt: daysAgo(1),
          company: { ...app('to_apply').company, name: 'Nudge' },
        }),
        app('home_assignment', {
          dueAt: inHours(30),
          company: { ...app('to_apply').company, name: 'Later' },
        }),
        app('home_assignment', {
          dueAt: inHours(10),
          company: { ...app('to_apply').company, name: 'Sooner' },
        }),
        app('to_apply', {
          createdAt: daysAgo(9),
          company: { ...app('to_apply').company, name: 'Overdue' },
        }),
      ]);
      expect(r.needsYou.map((a) => a.company)).toEqual(['Sooner', 'Later', 'Overdue', 'Nudge']);
    });

    it('caps nudges but never hides deadlines, and counts everything', () => {
      const nudges = Array.from({ length: 8 }, () => app('to_apply', { createdAt: daysAgo(1) }));
      const deadline = app('offer', { dueAt: inHours(24) });
      const r = run([...nudges, deadline]);
      expect(r.needsYou.filter((a) => a.urgency === 'nudge')).toHaveLength(5);
      expect(r.hiddenNudges).toBe(3);
      expect(r.flagged).toHaveLength(9);
      expect(r.needsYou[0]?.kind).toBe('respond_offer');
      expect(r.counts.needsYou).toBe(9);
    });

    it('produces at most one entry per application', () => {
      const a = app('phone_interview', { statusChangedAt: daysAgo(5) });
      const r = run([a], [interview(a, inHours(5)), interview(a, daysAgo(2))]);
      const entries = [...r.needsYou, ...r.scheduled, ...r.waiting].filter(
        (x) => x.applicationId === a.id,
      );
      expect(entries).toHaveLength(1);
    });
  });

  describe('timezone', () => {
    it('treats "today" by Jerusalem calendar day, not UTC', () => {
      // 23:30 UTC on Nov 5 is already Nov 6 in Jerusalem, so a 21:30 UTC Nov 5 interview was "yesterday".
      const now = new Date('2026-11-05T23:30:00Z');
      const a = app('phone_interview');
      const held = interview(a, '2026-11-05T21:30:00Z');
      const r = deriveActions({ applications: [a], interviews: [held], now });
      expect(r.needsYou[0]).toMatchObject({ kind: 'debrief' });
    });
  });
});
