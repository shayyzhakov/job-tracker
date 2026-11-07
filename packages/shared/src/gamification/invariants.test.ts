import { describe, expect, it } from 'vitest';
import { APPLICATION_STATUSES } from '../enums.js';
import type { ProgressDto } from './dto.js';
import {
  ACHIEVEMENTS,
  computeGameState,
  computeQuests,
  levelFromXp,
  XP_RULES,
  xpForLevel,
  xpFromProgress,
} from './engine.js';

const empty: ProgressDto = {
  timezone: 'Asia/Jerusalem',
  today: '2026-11-06',
  days: [],
  applicationsCount: 0,
  appliedCount: 0,
  stageReachedCounts: {},
  interviewsCount: 0,
  interviewTypesUsed: [],
  contactsCount: 0,
};

describe('registries stay consistent as features are added', () => {
  it('achievement ids are unique and well formed', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.target).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it('quest ids are unique and every quest is completable', () => {
    const quests = computeQuests(empty);
    expect(new Set(quests.map((q) => q.id)).size).toBe(quests.length);
    for (const q of quests) {
      expect(q.target).toBeGreaterThan(0);
      expect(q.xp).toBeGreaterThan(0);
      expect(q.done).toBe(false); // an empty tracker completes nothing
    }
  });

  it('only real statuses earn stage XP', () => {
    for (const status of Object.keys(XP_RULES.stage)) {
      expect(APPLICATION_STATUSES).toContain(status);
    }
  });

  it('never throws and never reports negative values for an empty tracker', () => {
    const g = computeGameState(empty);
    expect(g.level).toMatchObject({ level: 1, xp: 0 });
    expect(g.streak.current).toBe(0);
    expect(g.achievements.every((a) => a.progress >= 0 && !a.unlocked)).toBe(true);
  });
});

describe('XP and levels are monotonic', () => {
  it('level thresholds strictly increase', () => {
    for (let l = 1; l < 60; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
  });

  it('more XP never lowers the level, and pct stays in [0, 1)', () => {
    let last = 1;
    for (let xp = 0; xp < 20_000; xp += 7) {
      const l = levelFromXp(xp);
      expect(l.level).toBeGreaterThanOrEqual(last);
      expect(l.pct).toBeGreaterThanOrEqual(0);
      expect(l.pct).toBeLessThan(1);
      last = l.level;
    }
  });

  it('any additional activity never reduces XP', () => {
    const base = xpFromProgress(empty);
    const bumps: Partial<ProgressDto>[] = [
      { applicationsCount: 1 },
      { appliedCount: 1 },
      { interviewsCount: 1 },
      { contactsCount: 1 },
      ...Object.keys(XP_RULES.stage).map((s) => ({ stageReachedCounts: { [s]: 1 } })),
    ];
    for (const bump of bumps) {
      expect(xpFromProgress({ ...empty, ...bump })).toBeGreaterThan(base);
    }
  });
});
