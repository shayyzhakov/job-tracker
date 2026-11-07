import { describe, expect, it } from 'vitest';
import type { DayActivity, ProgressDto } from './dto.js';
import {
  computeAchievements,
  computeGameState,
  computeQuests,
  computeStreak,
  dayKey,
  levelFromXp,
  xpFromProgress,
} from './engine.js';

const day = (date: string, over: Partial<DayActivity> = {}): DayActivity => ({
  date,
  added: 0,
  applied: 0,
  statusChanges: 0,
  interviews: 0,
  contacts: 0,
  ...over,
});

const progress = (over: Partial<ProgressDto> = {}): ProgressDto => ({
  timezone: 'Asia/Jerusalem',
  today: '2026-11-06',
  days: [],
  applicationsCount: 0,
  appliedCount: 0,
  stageReachedCounts: {},
  interviewsCount: 0,
  interviewTypesUsed: [],
  contactsCount: 0,
  ...over,
});

describe('dayKey', () => {
  it('uses the given timezone for the day boundary', () => {
    const lateUtc = new Date('2026-11-05T22:30:00Z'); // 00:30 next day in Israel
    expect(dayKey(lateUtc, 'UTC')).toBe('2026-11-05');
    expect(dayKey(lateUtc, 'Asia/Jerusalem')).toBe('2026-11-06');
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 with no XP', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, xpIntoLevel: 0, pct: 0 });
  });
  it('levels up exactly at the threshold', () => {
    expect(levelFromXp(79).level).toBe(1);
    expect(levelFromXp(80)).toMatchObject({ level: 2, xpIntoLevel: 0 });
  });
  it('reports progress within a level', () => {
    const l = levelFromXp(160); // level 2 spans 80..240
    expect(l).toMatchObject({ level: 2, xpIntoLevel: 80, xpForNext: 160, pct: 0.5 });
  });
  it('clamps negative XP', () => {
    expect(levelFromXp(-5).xp).toBe(0);
  });
});

describe('xpFromProgress', () => {
  it('is zero for an empty tracker', () => {
    expect(xpFromProgress(progress())).toBe(0);
  });
  it('adds action and one-time stage rewards', () => {
    const xp = xpFromProgress(
      progress({
        applicationsCount: 2,
        appliedCount: 1,
        interviewsCount: 1,
        contactsCount: 1,
        stageReachedCounts: { offer: 1 },
      }),
    );
    expect(xp).toBe(2 * 5 + 15 + 10 + 5 + 100);
  });
});

describe('computeStreak', () => {
  it('is empty without activity', () => {
    expect(computeStreak([], '2026-11-06')).toEqual({
      current: 0,
      longest: 0,
      activeToday: false,
      atRisk: false,
    });
  });
  it('counts consecutive days ending today', () => {
    const days = ['2026-11-04', '2026-11-05', '2026-11-06'].map((d) => day(d, { applied: 1 }));
    expect(computeStreak(days, '2026-11-06')).toMatchObject({
      current: 3,
      activeToday: true,
      atRisk: false,
    });
  });
  it('keeps the streak alive (at risk) when only yesterday was active', () => {
    const days = ['2026-11-04', '2026-11-05'].map((d) => day(d, { added: 1 }));
    expect(computeStreak(days, '2026-11-06')).toMatchObject({
      current: 2,
      activeToday: false,
      atRisk: true,
    });
  });
  it('resets after a missed day but remembers the longest run', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-06'].map((d) =>
      day(d, { contacts: 1 }),
    );
    expect(computeStreak(days, '2026-11-06')).toMatchObject({ current: 1, longest: 3 });
  });
  it('ignores zero-activity rows', () => {
    expect(computeStreak([day('2026-11-06')], '2026-11-06').current).toBe(0);
  });
  it('handles month boundaries', () => {
    const days = ['2026-10-31', '2026-11-01'].map((d) => day(d, { applied: 1 }));
    expect(computeStreak(days, '2026-11-01').current).toBe(2);
  });
});

describe('computeQuests', () => {
  it('tracks daily and weekly progress', () => {
    const p = progress({
      days: [
        day('2026-11-06', { applied: 2, statusChanges: 1 }),
        day('2026-11-02', { applied: 4, interviews: 1 }),
        day('2026-10-20', { applied: 9 }), // outside the 7-day window
      ],
    });
    const byId = Object.fromEntries(computeQuests(p).map((q) => [q.id, q]));
    expect(byId['daily-apply']).toMatchObject({ progress: 1, done: true });
    expect(byId['daily-network']).toMatchObject({ progress: 0, done: false });
    expect(byId['weekly-apply']).toMatchObject({ progress: 5, done: true });
    expect(byId['weekly-interview']?.done).toBe(true);
  });
});

describe('computeAchievements', () => {
  it('locks everything for an empty tracker', () => {
    const state = computeGameState(progress());
    expect(state.achievements.every((a) => !a.unlocked)).toBe(true);
  });
  it('unlocks by thresholds and reports partial progress', () => {
    const p = progress({
      applicationsCount: 12,
      appliedCount: 12,
      stageReachedCounts: { offer: 1 },
    });
    const byId = Object.fromEntries(
      computeAchievements(p, computeStreak([], p.today)).map((a) => [a.id, a]),
    );
    expect(byId['first-step']?.unlocked).toBe(true);
    expect(byId['applicant-10']?.unlocked).toBe(true);
    expect(byId['applicant-25']).toMatchObject({ unlocked: false, progress: 12 });
    expect(byId.offer?.unlocked).toBe(true);
  });
});
