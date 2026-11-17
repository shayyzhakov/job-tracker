import {
  type ApplicationDetailDto,
  INTERVIEW_TYPE_LABELS,
  type InterviewDto,
  type RoundPhase,
} from '@job-tracker/shared';
import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useHandOver } from '../../api/hooks';
import { formatDate, formatDateTime } from '../../lib/format';

const PHASE_LABEL: Record<RoundPhase, string> = {
  upcoming: 'Upcoming',
  unscheduled: 'No time yet',
  open: 'To submit',
  ended: 'Done',
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Text size="sm">
      <Text span c="dimmed">
        {label}:{' '}
      </Text>
      {children}
    </Text>
  );
}

function RoundLines({ round, phase }: { round: InterviewDto; phase: RoundPhase }) {
  if (phase === 'open') {
    return (
      <>
        <Line label="Due by">{round.dueAt ? formatDateTime(round.dueAt) : 'No due date set'}</Line>
        {round.nextStep && <Line label="Next step">{round.nextStep}</Line>}
      </>
    );
  }
  if (phase === 'ended') {
    return (
      <>
        {round.submittedAt && <Line label="Submitted">{formatDateTime(round.submittedAt)}</Line>}
        <Line label="They'll reply by">
          {round.replyBy ? formatDate(round.replyBy) : 'No date given'}
        </Line>
      </>
    );
  }
  return round.nextStep ? <Line label="Next step">{round.nextStep}</Line> : null;
}

/**
 * The timeline that counts right now: the current round's next step, due date or reply-by, or the
 * offer's expiry. Values on other rounds are history and are shown on those rounds only.
 */
export function CurrentStep({ app }: { app: ApplicationDetailDto }) {
  const handOver = useHandOver();
  if (app.status === 'offer') {
    return (
      <Card withBorder padding="md" data-testid="current-step">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
          Current step
        </Text>
        <Text fw={600}>Offer</Text>
        <Line label="Expires">
          {app.offerExpiresAt ? formatDateTime(app.offerExpiresAt) : 'No expiry set'}
        </Line>
      </Card>
    );
  }
  const current = app.currentRound;
  const round = current && app.interviews.find((i) => i.id === current.interviewId);
  if (!current || !round) return null;
  const assignment = round.type === 'home_assignment';
  const when = round.timeUnknown
    ? null
    : `${assignment ? 'Received ' : ''}${formatDateTime(round.scheduledAt)}`;

  return (
    <Card withBorder padding="md" data-testid="current-step">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>
        Current step
      </Text>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600}>{INTERVIEW_TYPE_LABELS[round.type]}</Text>
            <Badge size="sm" variant="light" color={current.phase === 'ended' ? 'gray' : 'blue'}>
              {PHASE_LABEL[current.phase]}
            </Badge>
            {when && (
              <Text size="sm" c="dimmed">
                {when}
              </Text>
            )}
          </Group>
          <RoundLines round={round} phase={current.phase} />
        </Stack>
        {current.phase === 'open' && (
          <Button
            size="xs"
            loading={handOver.isPending}
            onClick={() => handOver.mutate({ id: app.id, reason: 'submitted' })}
          >
            Mark submitted
          </Button>
        )}
      </Group>
    </Card>
  );
}
