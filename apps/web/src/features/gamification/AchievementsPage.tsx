import {
  Card,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCheck, IconLock } from '@tabler/icons-react';
import { PageLoader } from '../../components/QueryState';
import { useGamificationEnabled } from './enabled';
import { Gate } from './Gate';
import { ACHIEVEMENT_ICONS, TIER_COLORS } from './icons';
import { useGame, useProgress } from './useGame';

function Content() {
  const [, setEnabled] = useGamificationEnabled();
  const { isPending, isError } = useProgress();
  const state = useGame();
  if (isPending) return <PageLoader />;
  if (isError || !state) return <Text c="dimmed">Progress is unavailable right now.</Text>;
  const { level, streak, quests, achievements } = state.game;
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Achievements</Title>
        <Switch
          label="Gamification"
          checked
          onChange={(e) => setEnabled(e.currentTarget.checked)}
        />
      </Group>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        {[
          ['Level', `${level.level} · ${level.title}`],
          ['Total XP', String(level.xp)],
          ['Streak', `${streak.current} days (best ${streak.longest})`],
          ['Unlocked', `${unlocked}/${achievements.length}`],
        ].map(([label, value]) => (
          <Card key={label} withBorder padding="md" className="gm-rise">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              {label}
            </Text>
            <Text fw={700} fz="lg">
              {value}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Title order={4}>Quests</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {quests.map((q) => (
          <Card key={q.id} withBorder padding="md" className="gm-rise">
            <Group justify="space-between" mb={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {q.scope}
              </Text>
              <Text size="xs" c={q.done ? 'green' : 'dimmed'} fw={600}>
                {q.done ? 'Done' : `+${q.xp} XP`}
              </Text>
            </Group>
            <Text fw={600}>{q.title}</Text>
            <Progress
              mt="xs"
              size="sm"
              value={(q.progress / q.target) * 100}
              color={q.done ? 'green' : 'indigo'}
            />
          </Card>
        ))}
      </SimpleGrid>

      <Title order={4}>Badges</Title>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
        {achievements.map((a, i) => {
          const Icon = ACHIEVEMENT_ICONS[a.icon] ?? IconCheck;
          return (
            <Card
              key={a.id}
              withBorder
              padding="md"
              className={`gm-rise ${a.unlocked ? 'gm-badge gm-badge--on' : 'gm-badge'}`}
              style={{ animationDelay: `${i * 40}ms` }}
              data-testid={`badge-${a.id}`}
              data-unlocked={a.unlocked}
            >
              <Group wrap="nowrap">
                <ThemeIcon
                  size={44}
                  radius="xl"
                  variant={a.unlocked ? 'light' : 'default'}
                  color={TIER_COLORS[a.tier]}
                >
                  {a.unlocked ? <Icon size={24} /> : <IconLock size={20} />}
                </ThemeIcon>
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text fw={700}>{a.name}</Text>
                  <Text size="xs" c="dimmed">
                    {a.description}
                  </Text>
                  {!a.unlocked && (
                    <Progress
                      size="xs"
                      mt={4}
                      value={(a.progress / a.target) * 100}
                      color={TIER_COLORS[a.tier]}
                    />
                  )}
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

export function AchievementsPage() {
  return (
    <Gate>
      <Content />
    </Gate>
  );
}
