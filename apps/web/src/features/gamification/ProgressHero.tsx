import {
  Card,
  Group,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconFlame } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useCountUp } from './effects';
import { useGamificationEnabled } from './enabled';
import { ACHIEVEMENT_ICONS, TIER_COLORS } from './icons';
import { useGame } from './useGame';

/** overview.top slot: level, XP, streak, today's quests and the next achievements. */
export function ProgressHero() {
  const [enabled] = useGamificationEnabled();
  const state = useGame();
  const xp = useCountUp(state?.game.level.xp ?? 0);
  if (!enabled || !state) return null;
  const { level, streak, quests, achievements } = state.game;

  const daily = quests.filter((q) => q.scope === 'daily');
  const weekly = quests.filter((q) => q.scope === 'weekly');
  const next = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.progress / b.target - a.progress / a.target)
    .slice(0, 3);
  const latest = achievements.filter((a) => a.unlocked).length;

  return (
    <Card withBorder padding="lg" className="gm-hero gm-rise" data-testid="gm-hero">
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
        <Group wrap="nowrap" gap="lg">
          <RingProgress
            size={96}
            thickness={8}
            roundCaps
            sections={[{ value: level.pct * 100, color: 'indigo' }]}
            label={
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed" lh={1}>
                  LEVEL
                </Text>
                <Text fz={26} fw={800} lh={1.1} data-testid="gm-level">
                  {level.level}
                </Text>
              </Stack>
            }
          />
          <Stack gap={4} style={{ flex: 1 }}>
            <Text fw={700} fz="lg" lh={1.1}>
              {level.title}
            </Text>
            <Progress
              value={level.pct * 100}
              size="sm"
              radius="xl"
              className="gm-xp-bar"
              aria-label="XP to next level"
            />
            <Text size="xs" c="dimmed" className="tabular-nums">
              <Text span fw={700} c="var(--mantine-color-text)" data-testid="gm-xp">
                {xp}
              </Text>{' '}
              XP · {level.xpForNext - level.xpIntoLevel} to level {level.level + 1}
            </Text>
          </Stack>
        </Group>

        <Stack gap="xs">
          <Group gap="xs">
            <ThemeIcon
              variant="light"
              color={streak.activeToday ? 'orange' : 'gray'}
              radius="xl"
              className={streak.activeToday ? 'gm-flame gm-flame--on' : ''}
            >
              <IconFlame size={18} />
            </ThemeIcon>
            <Text fw={700} data-testid="gm-streak">
              {streak.current}-day streak
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {streak.atRisk
              ? 'Do one thing today to keep it alive.'
              : streak.activeToday
                ? `Longest: ${streak.longest} days. Nice work today.`
                : 'Start a streak with any activity today.'}
          </Text>
          {daily.map((q) => (
            <Group key={q.id} gap="xs" wrap="nowrap">
              <ThemeIcon
                size={20}
                radius="xl"
                variant={q.done ? 'filled' : 'default'}
                color="green"
                className={q.done ? 'gm-pop' : ''}
              >
                {q.done && <IconCheck size={12} />}
              </ThemeIcon>
              <Text
                size="sm"
                td={q.done ? 'line-through' : undefined}
                c={q.done ? 'dimmed' : undefined}
                style={{ flex: 1 }}
              >
                {q.title}
              </Text>
              <Text size="xs" c="dimmed">
                +{q.xp}
              </Text>
            </Group>
          ))}
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">
              This week
            </Text>
            <Text size="xs" c="dimmed" component={Link} to="/achievements">
              {latest}/{achievements.length} achievements
            </Text>
          </Group>
          {weekly.map((q) => (
            <Stack key={q.id} gap={2}>
              <Group justify="space-between">
                <Text size="sm">{q.title}</Text>
                <Text size="xs" c="dimmed" className="tabular-nums">
                  {q.progress}/{q.target}
                </Text>
              </Group>
              <Progress
                value={(q.progress / q.target) * 100}
                size="xs"
                color={q.done ? 'green' : 'indigo'}
              />
            </Stack>
          ))}
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt={4}>
            Next up
          </Text>
          <Group gap="xs">
            {next.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.icon] ?? IconCheck;
              return (
                <ThemeIcon
                  key={a.id}
                  variant="light"
                  color={TIER_COLORS[a.tier]}
                  size="lg"
                  title={`${a.name}: ${a.progress}/${a.target}`}
                >
                  <Icon size={18} />
                </ThemeIcon>
              );
            })}
          </Group>
        </Stack>
      </SimpleGrid>
    </Card>
  );
}
