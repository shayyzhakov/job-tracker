import type { ApplicationStatus } from '../enums.js';
import type { DayActivity, ProgressDto } from './dto.js';

// ---- dates ----

/** YYYY-MM-DD of `date` in the given IANA timezone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

const shiftDay = (key: string, delta: number): string => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const isActiveDay = (d: DayActivity) =>
  d.added + d.applied + d.statusChanges + d.interviews + d.contacts > 0;

// ---- XP & levels ----

export const XP_RULES = {
  added: 5,
  applied: 15,
  interview: 10,
  contact: 5,
  /** One-time reward per application reaching a stage. */
  stage: {
    hr_screening: 20,
    phone_interview: 20,
    technical_interview: 30,
    home_assignment: 30,
    onsite_interview: 40,
    managerial_interview: 30,
    final_interview: 40,
    offer: 100,
    accepted: 200,
  } satisfies Partial<Record<ApplicationStatus, number>>,
} as const;

export function xpFromProgress(p: ProgressDto): number {
  let xp =
    p.applicationsCount * XP_RULES.added +
    p.appliedCount * XP_RULES.applied +
    p.interviewsCount * XP_RULES.interview +
    p.contactsCount * XP_RULES.contact;
  for (const [status, reward] of Object.entries(XP_RULES.stage)) {
    xp += (p.stageReachedCounts[status as ApplicationStatus] ?? 0) * reward;
  }
  return xp;
}

/** Total XP needed to reach `level` (level 1 starts at 0). */
export const xpForLevel = (level: number) => 40 * (level - 1) * level;

const TITLES = [
  'Rookie',
  'Explorer',
  'Contender',
  'Challenger',
  'Closer',
  'Veteran',
  'Legend',
] as const;

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  /** 0–1 progress through the current level. */
  pct: number;
}

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (xpForLevel(level + 1) <= safe) level++;
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const xpIntoLevel = safe - floor;
  return {
    level,
    title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))] ?? TITLES[0],
    xp: safe,
    xpIntoLevel,
    xpForNext: span,
    pct: xpIntoLevel / span,
  };
}

// ---- streaks ----

export interface StreakInfo {
  current: number;
  longest: number;
  activeToday: boolean;
  /** Streak is alive but today's activity is still missing. */
  atRisk: boolean;
}

/** Consecutive active days. A streak survives until the end of the day after the last activity. */
export function computeStreak(days: DayActivity[], today: string): StreakInfo {
  const active = new Set(days.filter(isActiveDay).map((d) => d.date));
  const activeToday = active.has(today);

  let current = 0;
  let cursor = activeToday ? today : shiftDay(today, -1);
  while (active.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...active].sort()) {
    run = prev && shiftDay(prev, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = date;
  }
  return {
    current,
    longest: Math.max(longest, current),
    activeToday,
    atRisk: current > 0 && !activeToday,
  };
}

// ---- quests ----

export interface Quest {
  id: string;
  scope: 'daily' | 'weekly';
  title: string;
  progress: number;
  target: number;
  done: boolean;
  xp: number;
}

const sum = (days: DayActivity[], pick: (d: DayActivity) => number) =>
  days.reduce((n, d) => n + pick(d), 0);

export function computeQuests(p: ProgressDto, today = p.today): Quest[] {
  const todayDay = p.days.find((d) => d.date === today);
  const weekStart = shiftDay(today, -6);
  const week = p.days.filter((d) => d.date >= weekStart && d.date <= today);

  const make = (q: Omit<Quest, 'done'>): Quest => ({ ...q, done: q.progress >= q.target });
  return [
    make({
      id: 'daily-apply',
      scope: 'daily',
      title: 'Submit an application',
      progress: Math.min(1, todayDay?.applied ?? 0),
      target: 1,
      xp: 15,
    }),
    make({
      id: 'daily-move',
      scope: 'daily',
      title: 'Move an application forward',
      progress: Math.min(1, todayDay?.statusChanges ?? 0),
      target: 1,
      xp: 10,
    }),
    make({
      id: 'daily-network',
      scope: 'daily',
      title: 'Add a contact',
      progress: Math.min(1, todayDay?.contacts ?? 0),
      target: 1,
      xp: 5,
    }),
    make({
      id: 'weekly-apply',
      scope: 'weekly',
      title: 'Submit 5 applications this week',
      progress: Math.min(
        5,
        sum(week, (d) => d.applied),
      ),
      target: 5,
      xp: 50,
    }),
    make({
      id: 'weekly-interview',
      scope: 'weekly',
      title: 'Line up an interview this week',
      progress: Math.min(
        1,
        sum(week, (d) => d.interviews),
      ),
      target: 1,
      xp: 30,
    }),
  ];
}

// ---- achievements ----

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold';
  /** Tabler icon name suffix, resolved by the UI. */
  icon: string;
  target: number;
  value: (p: ProgressDto, streak: StreakInfo) => number;
}

const reached = (p: ProgressDto, s: ApplicationStatus) => p.stageReachedCounts[s] ?? 0;
const interviewsReached = (p: ProgressDto) =>
  (
    ['phone_interview', 'technical_interview', 'onsite_interview', 'final_interview'] as const
  ).reduce((n, s) => n + reached(p, s), 0);

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first-step',
    name: 'First step',
    description: 'Add your first application',
    tier: 'bronze',
    icon: 'flag',
    target: 1,
    value: (p) => p.applicationsCount,
  },
  {
    id: 'applicant-10',
    name: 'In motion',
    description: 'Submit 10 applications',
    tier: 'bronze',
    icon: 'send',
    target: 10,
    value: (p) => p.appliedCount,
  },
  {
    id: 'applicant-25',
    name: 'Relentless',
    description: 'Submit 25 applications',
    tier: 'silver',
    icon: 'send',
    target: 25,
    value: (p) => p.appliedCount,
  },
  {
    id: 'applicant-50',
    name: 'Machine',
    description: 'Submit 50 applications',
    tier: 'gold',
    icon: 'send',
    target: 50,
    value: (p) => p.appliedCount,
  },
  {
    id: 'first-response',
    name: 'Someone noticed',
    description: 'Get a first reply from a company',
    tier: 'bronze',
    icon: 'message',
    target: 1,
    value: (p) => reached(p, 'hr_screening') + interviewsReached(p),
  },
  {
    id: 'interviewer',
    name: 'In the room',
    description: 'Reach an interview stage',
    tier: 'silver',
    icon: 'microphone',
    target: 1,
    value: (p) => interviewsReached(p),
  },
  {
    id: 'variety',
    name: 'Well rounded',
    description: 'Schedule 3 different interview types',
    tier: 'silver',
    icon: 'puzzle',
    target: 3,
    value: (p) => p.interviewTypesUsed.length,
  },
  {
    id: 'networker',
    name: 'Networker',
    description: 'Add 5 contacts',
    tier: 'bronze',
    icon: 'users',
    target: 5,
    value: (p) => p.contactsCount,
  },
  {
    id: 'streak-3',
    name: 'Warming up',
    description: 'Keep a 3-day streak',
    tier: 'bronze',
    icon: 'flame',
    target: 3,
    value: (_p, s) => s.longest,
  },
  {
    id: 'streak-7',
    name: 'On fire',
    description: 'Keep a 7-day streak',
    tier: 'silver',
    icon: 'flame',
    target: 7,
    value: (_p, s) => s.longest,
  },
  {
    id: 'streak-30',
    name: 'Unstoppable',
    description: 'Keep a 30-day streak',
    tier: 'gold',
    icon: 'flame',
    target: 30,
    value: (_p, s) => s.longest,
  },
  {
    id: 'offer',
    name: 'Offer in hand',
    description: 'Receive an offer',
    tier: 'gold',
    icon: 'trophy',
    target: 1,
    value: (p) => reached(p, 'offer'),
  },
  {
    id: 'accepted',
    name: 'Landed',
    description: 'Accept an offer',
    tier: 'gold',
    icon: 'confetti',
    target: 1,
    value: (p) => reached(p, 'accepted'),
  },
];

export interface AchievementState extends AchievementDef {
  progress: number;
  unlocked: boolean;
}

export function computeAchievements(p: ProgressDto, streak: StreakInfo): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const progress = Math.min(a.target, a.value(p, streak));
    return { ...a, progress, unlocked: progress >= a.target };
  });
}

// ---- everything at once ----

export interface GameState {
  level: LevelInfo;
  streak: StreakInfo;
  quests: Quest[];
  achievements: AchievementState[];
}

export function computeGameState(p: ProgressDto, today = p.today): GameState {
  const streak = computeStreak(p.days, today);
  return {
    level: levelFromXp(xpFromProgress(p)),
    streak,
    quests: computeQuests(p, today),
    achievements: computeAchievements(p, streak),
  };
}
