import type { ProgressDto } from '@job-tracker/shared';
import { notifications } from '@mantine/notifications';
import type { AppEvent } from '../../lib/app-events';
import { fireConfetti } from './effects';
import { gameStateOf } from './useGame';

const SEEN_KEY = 'gamification.seen';
interface Seen {
  achievements: string[];
  level: number;
}

const readSeen = (): Seen | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Seen) : null;
  } catch {
    return null;
  }
};
const writeSeen = (seen: Seen) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* storage unavailable: celebrations may repeat, nothing else breaks */
  }
};

/** First run: remember what is already earned so nothing fires retroactively. */
export function seedSeen(progress: ProgressDto): void {
  if (readSeen()) return;
  const g = gameStateOf(progress);
  writeSeen({
    achievements: g.achievements.filter((a) => a.unlocked).map((a) => a.id),
    level: g.level.level,
  });
}

/** Compares progress before/after a core event and rewards the difference. */
export function celebrate(
  prev: ProgressDto | undefined,
  next: ProgressDto | undefined,
  event: AppEvent,
) {
  if (!prev || !next || event.type === 'application.deleted') return;
  const seen = readSeen();
  if (!seen) return seedSeen(next);
  const before = gameStateOf(prev).level.xp;
  const g = gameStateOf(next);
  const gained = g.level.xp - before;

  if (gained > 0) {
    notifications.show({
      id: 'gm-xp',
      title: `+${gained} XP`,
      message: `${g.level.xpForNext - g.level.xpIntoLevel} XP to level ${g.level.level + 1}`,
      color: 'indigo',
      autoClose: 2500,
      classNames: { root: 'gm-toast' },
    });
  }

  const newlyUnlocked = g.achievements.filter(
    (a) => a.unlocked && !seen.achievements.includes(a.id),
  );
  newlyUnlocked.forEach((a, i) => {
    setTimeout(
      () =>
        notifications.show({
          title: `Achievement unlocked: ${a.name}`,
          message: a.description,
          color: a.tier === 'gold' ? 'yellow' : a.tier === 'silver' ? 'gray' : 'orange',
          autoClose: 5000,
          classNames: { root: 'gm-toast gm-toast--achievement' },
        }),
      600 + i * 900,
    );
  });

  const leveledUp = g.level.level > seen.level;
  if (leveledUp) {
    setTimeout(
      () =>
        notifications.show({
          title: `Level ${g.level.level}: ${g.level.title}`,
          message: 'You levelled up. Keep going!',
          color: 'grape',
          autoClose: 6000,
          classNames: { root: 'gm-toast gm-toast--level' },
        }),
      300,
    );
  }

  const milestone =
    event.type === 'status.changed' && (event.status === 'offer' || event.status === 'accepted');
  if (milestone || leveledUp) fireConfetti('big');
  else if (newlyUnlocked.length > 0) fireConfetti('small');

  writeSeen({
    achievements: g.achievements.filter((a) => a.unlocked).map((a) => a.id),
    level: g.level.level,
  });
}
