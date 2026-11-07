import type { ActionDto, ActionKind, ActionUrgency } from '@job-tracker/shared';
import { Anchor, Badge, Button, Card, Group, Menu, Stack, Text } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useChangeStatus, useDebrief, useHandOver, useSnooze } from '../../api/hooks';

const URGENCY: Record<ActionUrgency, { color: string; label: string }> = {
  deadline: { color: 'red', label: 'Deadline' },
  overdue: { color: 'red', label: 'Overdue' },
  soon: { color: 'yellow', label: 'Soon' },
  nudge: { color: 'gray', label: 'Nudge' },
};

export type SnoozePreset = 'tomorrow' | 'three_days' | 'next_week';

const SNOOZE_LABELS: Record<SnoozePreset, string> = {
  tomorrow: 'Tomorrow',
  three_days: 'In 3 days',
  next_week: 'Next week',
};

/** Tomorrow comes back at 09:00 local; the other presets keep the current time of day. */
export function snoozeUntil(preset: SnoozePreset, now = new Date()): Date {
  const d = new Date(now);
  if (preset === 'tomorrow') {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setDate(d.getDate() + (preset === 'three_days' ? 3 : 7));
  return d;
}

export function ActionCard({ action }: { action: ActionDto }) {
  const handOver = useHandOver();
  const changeStatus = useChangeStatus();
  const debrief = useDebrief();
  const snooze = useSnooze();
  const { applicationId: id, kind } = action;
  const busy =
    handOver.isPending || changeStatus.isPending || debrief.isPending || snooze.isPending;
  const urgency = URGENCY[action.urgency];

  const open = (label: string) => (
    <Button component={Link} to={`/applications/${id}`} size="xs" variant="default">
      {label}
    </Button>
  );
  const act = (label: string, run: () => void, primary = false) => (
    <Button size="xs" variant={primary ? 'filled' : 'default'} disabled={busy} onClick={run}>
      {label}
    </Button>
  );
  const hand = (reason: 'followed_up' | 'submitted' | 'they_scheduling') => () =>
    handOver.mutate({ id, reason });
  const status = (to: 'applied' | 'withdrawn' | 'ghosted') => () =>
    changeStatus.mutate({ id, status: to });

  const buttons: Record<ActionKind, React.ReactNode> = {
    respond_offer: open('Open offer'),
    submit_assignment: (
      <>
        {act('Mark submitted', hand('submitted'), true)}
        {open('Open')}
      </>
    ),
    schedule_interview: (
      <>
        {act("They're scheduling", hand('they_scheduling'))}
        {open('Set time')}
      </>
    ),
    debrief: (
      <>
        {act(
          'Done',
          () =>
            action.interviewId &&
            debrief.mutate({ applicationId: id, interviewId: action.interviewId }),
          true,
        )}
        {open('Add notes')}
      </>
    ),
    follow_up: (
      <>
        {act('Followed up', hand('followed_up'), true)}
        {act('Mark ghosted', status('ghosted'))}
      </>
    ),
    mark_ghosted: (
      <>
        {act('Mark ghosted', status('ghosted'), true)}
        {act('Followed up again', hand('followed_up'))}
      </>
    ),
    apply: (
      <>
        {act('Applied', status('applied'), true)}
        {act('Drop', status('withdrawn'))}
      </>
    ),
  };

  return (
    <Card
      withBorder
      padding="sm"
      data-testid="action-card"
      data-kind={kind}
      style={{ borderLeft: `4px solid var(--mantine-color-${urgency.color}-6)` }}
    >
      <Group justify="space-between" wrap="nowrap" align="center">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} truncate="end">
              {action.title}
            </Text>
            <Badge size="xs" color={urgency.color} variant="light">
              {urgency.label}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {action.subtitle} ·{' '}
            <Anchor component={Link} to={`/applications/${id}`} size="sm">
              {action.roleName}
            </Anchor>
          </Text>
        </Stack>
        <Group gap="xs" wrap="nowrap">
          {buttons[kind]}
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconClock size={14} />}
                aria-label={`Snooze ${action.company}`}
              >
                Snooze
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {(Object.keys(SNOOZE_LABELS) as SnoozePreset[]).map((preset) => (
                <Menu.Item
                  key={preset}
                  onClick={() => snooze.mutate({ id, until: snoozeUntil(preset) })}
                >
                  {SNOOZE_LABELS[preset]}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Card>
  );
}
