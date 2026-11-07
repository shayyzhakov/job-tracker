import type { ActionDto, ActionsDto, WaitingDto } from '@job-tracker/shared';
import { Anchor, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useActions } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { formatDate } from '../../lib/format';
import { ActionCard } from './ActionCard';

const WAITING_PREVIEW = 3;

function Section({ title, cards }: { title: string; cards: ActionDto[] }) {
  if (cards.length === 0) return null;
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="dimmed">
        {title}
      </Text>
      {cards.map((a) => (
        <ActionCard key={`${a.applicationId}:${a.kind}`} action={a} />
      ))}
    </Stack>
  );
}

function WaitingList({
  title,
  items,
  testId,
}: {
  title: string;
  items: WaitingDto[];
  testId: string;
}) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, WAITING_PREVIEW);
  return (
    <Stack gap={0} data-testid={testId}>
      <Text size="sm" fw={600} c="dimmed" mb={4}>
        {title} · {items.length}
      </Text>
      {shown.map((w) => (
        <Group
          key={w.applicationId}
          justify="space-between"
          py={6}
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="sm">
            <Anchor component={Link} to={`/applications/${w.applicationId}`} size="sm">
              {w.company}
            </Anchor>{' '}
            <Text span c="dimmed">
              · {w.subtitle}
            </Text>
          </Text>
          <Text size="sm" c="dimmed">
            check-in {formatDate(w.checkInAt)}
          </Text>
        </Group>
      ))}
      {items.length > WAITING_PREVIEW && (
        <Anchor component="button" type="button" size="sm" ta="left" onClick={() => setAll(!all)}>
          {all ? 'Show less' : `+${items.length - WAITING_PREVIEW} more`}
        </Anchor>
      )}
    </Stack>
  );
}

function Summary({ counts }: { counts: ActionsDto['counts'] }) {
  const parts = [
    `${counts.needsYou} need${counts.needsYou === 1 ? 's' : ''} you`,
    ...(counts.overdue > 0 ? [`${counts.overdue} overdue`] : []),
    `${counts.waiting} waiting on others`,
  ];
  return (
    <Text c="dimmed" data-testid="today-summary">
      {parts.join(' · ')}
    </Text>
  );
}

export function TodayPage() {
  const { data, isPending, error } = useActions();
  if (isPending) return <PageLoader />;
  if (error || !data) return <ErrorAlert error={error} what="action list" />;

  const pinned = data.needsYou.filter((a) => a.urgency === 'deadline' || a.urgency === 'overdue');
  const soon = data.needsYou.filter((a) => a.urgency === 'soon');
  const nudges = data.needsYou.filter((a) => a.urgency === 'nudge');
  const nextCheckIn = [...data.scheduled, ...data.waiting].map((w) => w.checkInAt).sort()[0];

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Today</Title>
        <Summary counts={data.counts} />
      </div>

      {data.counts.needsYou === 0 ? (
        <Card withBorder padding="lg" data-testid="today-empty">
          <Group gap="sm">
            <IconCircleCheck size={28} color="var(--mantine-color-green-6)" aria-hidden />
            <div>
              <Text fw={600}>You're clear</Text>
              <Text size="sm" c="dimmed">
                Everything else is waiting on others
                {nextCheckIn ? `. Next check-in ${formatDate(nextCheckIn)}.` : '.'}
              </Text>
            </div>
          </Group>
        </Card>
      ) : (
        <>
          <Section title="Deadlines and overdue" cards={pinned} />
          <Section title="Coming up" cards={soon} />
          <Section title="Nudges" cards={nudges} />
          {data.hiddenNudges > 0 && (
            <Text size="sm" c="dimmed" data-testid="hidden-nudges">
              +{data.hiddenNudges} more nudge{data.hiddenNudges === 1 ? '' : 's'} once these are
              done
            </Text>
          )}
        </>
      )}

      <WaitingList title="Interviews scheduled" items={data.scheduled} testId="today-scheduled" />
      <WaitingList title="Waiting on others" items={data.waiting} testId="today-waiting" />
    </Stack>
  );
}
