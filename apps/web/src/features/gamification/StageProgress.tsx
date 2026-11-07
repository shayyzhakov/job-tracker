import { APPLICATION_STATUSES, type ApplicationStatus, STATUS_LABELS } from '@job-tracker/shared';
import { Group, Text } from '@mantine/core';
import { useGamificationEnabled } from './enabled';

/** The happy path, in order; closed statuses (rejected, withdrawn, ghosted) sit off it. */
const PATH = APPLICATION_STATUSES.slice(0, APPLICATION_STATUSES.indexOf('accepted') + 1);

/** application.detail.top slot: where this application is on the way to an offer. */
export function StageProgress({ status }: { status?: ApplicationStatus }) {
  const [enabled] = useGamificationEnabled();
  if (!enabled || !status) return null;
  const rank = PATH.indexOf(status);
  const closed = rank === -1;
  return (
    <div
      role="img"
      className="gm-stages"
      data-testid="gm-stages"
      aria-label={`Stage: ${STATUS_LABELS[status]}`}
    >
      <Group gap={4} wrap="nowrap">
        {PATH.map((s, i) => (
          <div
            key={s}
            title={STATUS_LABELS[s]}
            className={`gm-stage ${!closed && i < rank ? 'gm-stage--done' : ''} ${!closed && i === rank ? 'gm-stage--current' : ''}`}
          />
        ))}
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {closed
          ? `Closed: ${STATUS_LABELS[status]}`
          : `Stage ${rank + 1} of ${PATH.length}: ${STATUS_LABELS[status]}`}
      </Text>
    </div>
  );
}
