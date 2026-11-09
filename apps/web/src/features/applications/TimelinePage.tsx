import { INTERVIEW_TYPE_LABELS, type TimelineInterviewDto } from '@job-tracker/shared';
import { Anchor, Badge, Box, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconMapPin, IconPlus } from '@tabler/icons-react';
import { Fragment, useMemo } from 'react';
import { Link } from 'react-router';
import { useTimeline } from '../../api/hooks';
import { ApplicationViewSwitch } from '../../components/ApplicationViewSwitch';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { relativeDayLabel } from '../../lib/format';

const DAY = 86_400_000;
/** History is limited to the past week; everything planned is shown, however far ahead. */
const HISTORY_DAYS = 7;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});
const dayLabel = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

type Entry =
  | { kind: 'now'; key: string }
  | { kind: 'day'; key: string; date: Date }
  | {
      kind: 'interview';
      key: string;
      interview: TimelineInterviewDto;
      past: boolean;
    };

/** Flattens the rounds into day headings, the rounds themselves, and a "now" marker between past and upcoming. */
export function buildEntries(rows: TimelineInterviewDto[], now: Date): Entry[] {
  const entries: Entry[] = [];
  let lastDay = '';
  let nowPlaced = false;
  const placeNow = () => {
    if (nowPlaced) return;
    nowPlaced = true;
    entries.push({ kind: 'now', key: 'now' });
  };
  for (const interview of rows) {
    const at = new Date(interview.scheduledAt);
    const past = at.getTime() < now.getTime();
    if (!past) placeNow();
    const key = dayKey(at);
    if (key !== lastDay) {
      lastDay = key;
      entries.push({ kind: 'day', key: `day-${key}`, date: at });
    }
    entries.push({ kind: 'interview', key: interview.id, interview, past });
  }
  placeNow();
  return entries;
}

function Round({ interview, past }: { interview: TimelineInterviewDto; past: boolean }) {
  const label = INTERVIEW_TYPE_LABELS[interview.type];
  return (
    <Card
      withBorder
      padding="sm"
      component={Link}
      to={`/applications/${interview.applicationId}`}
      aria-label={`${label} interview at ${interview.companyName}`}
      style={{
        opacity: past ? 0.7 : 1,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2}>
          <Group gap="xs">
            <Text fw={600}>{interview.companyName}</Text>
            <Badge variant="outline" size="sm">
              {label}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {interview.roleName}
          </Text>
          {interview.location && (
            <Group gap={4}>
              <IconMapPin size={12} />
              <Text size="xs" c="dimmed">
                {interview.location}
              </Text>
            </Group>
          )}
        </Stack>
        <Text fw={600} size="sm" style={{ whiteSpace: 'nowrap' }}>
          {time.format(new Date(interview.scheduledAt))}
        </Text>
      </Group>
    </Card>
  );
}

export function TimelinePage() {
  // Day-aligned so the query key stays stable between renders.
  const from = useMemo(() => new Date(startOfDay(new Date()).getTime() - HISTORY_DAYS * DAY), []);
  const { data, isPending, error } = useTimeline(from);
  const entries = useMemo(() => buildEntries(data ?? [], new Date()), [data]);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Applications</Title>
          <ApplicationViewSwitch current="timeline" />
        </Group>
        <Button component={Link} to="/applications/new" leftSection={<IconPlus size={16} />}>
          New application
        </Button>
      </Group>

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="the timeline" />
      ) : (data?.length ?? 0) === 0 ? (
        <Card withBorder padding="xl">
          <Text c="dimmed" ta="center">
            No interviews in the past week or planned.{' '}
            <Anchor component={Link} to="/applications">
              Open an application
            </Anchor>{' '}
            to schedule one.
          </Text>
        </Card>
      ) : (
        <Box
          component="ol"
          aria-label="Interview timeline"
          m={0}
          p={0}
          pl="md"
          style={{
            listStyle: 'none',
            borderLeft: '2px solid var(--mantine-color-default-border)',
          }}
        >
          {entries.map((e) => (
            <Fragment key={e.key}>
              {e.kind === 'day' && (
                <Box component="li" mt="md" mb={6} style={{ position: 'relative' }}>
                  <Dot />
                  <Text fw={600} size="sm">
                    {relativeDayLabel(e.date) ?? dayLabel.format(e.date)}
                  </Text>
                </Box>
              )}
              {e.kind === 'now' && (
                <Box component="li" my="sm" style={{ position: 'relative' }} aria-label="Now">
                  <Dot color="var(--mantine-color-red-6)" />
                  <Group gap="xs" wrap="nowrap">
                    <Badge color="red" size="sm">
                      Now
                    </Badge>
                    <Box
                      style={{
                        flex: 1,
                        borderTop: '1px dashed var(--mantine-color-red-6)',
                      }}
                    />
                  </Group>
                </Box>
              )}
              {e.kind === 'interview' && (
                <Box component="li" mb={6}>
                  <Round interview={e.interview} past={e.past} />
                </Box>
              )}
            </Fragment>
          ))}
        </Box>
      )}
    </Stack>
  );
}

/** The dot that sits on the vertical line. */
function Dot({ color = 'var(--mantine-color-dimmed)' }: { color?: string }) {
  return (
    <Box
      aria-hidden
      style={{
        position: 'absolute',
        left: -22,
        top: 6,
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}
