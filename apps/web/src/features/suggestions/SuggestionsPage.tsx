import { COMPANY_SIZE_LABELS, type OpportunityDto } from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  List,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconExternalLink, IconSettings, IconX } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import { useDismissOpportunity, useOpportunities, usePromoteOpportunity } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { RoleTitle } from '../../components/RoleTitle';
import { formatDateMaybeTime, formatFullDateTime } from '../../lib/format';

const scoreColor = (score: number) => (score >= 80 ? 'teal' : score >= 60 ? 'yellow' : 'gray');

export function SuggestionsPage() {
  const { data, isPending, error } = useOpportunities('new');
  const promote = usePromoteOpportunity();
  const dismiss = useDismissOpportunity();
  const navigate = useNavigate();

  const onError = (err: Error) =>
    notifications.show({
      color: 'red',
      title: 'Something went wrong',
      message: err.message,
    });

  const onPromote = (id: string) =>
    promote.mutate(id, {
      onSuccess: (app) => navigate(`/applications/${app.id}`),
      onError,
    });
  const onDismiss = (id: string) => dismiss.mutate(id, { onError });

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Suggestions</Title>
          <Text c="dimmed" size="sm">
            New listings the AI scout found for you, best match first.
          </Text>
        </div>
        <Button
          component={Link}
          to="/scout/settings"
          variant="default"
          leftSection={<IconSettings size={16} />}
        >
          Scout settings
        </Button>
      </Group>

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="suggestions" />
      ) : data.length === 0 ? (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed">
            No new suggestions. The scout runs daily; check your{' '}
            <Anchor component={Link} to="/scout/settings">
              scout settings
            </Anchor>{' '}
            if nothing shows up.
          </Text>
        </Card>
      ) : (
        data.map((o) => (
          <SuggestionCard
            key={o.id}
            opportunity={o}
            promoting={promote.isPending && promote.variables === o.id}
            dismissing={dismiss.isPending && dismiss.variables === o.id}
            onPromote={() => onPromote(o.id)}
            onDismiss={() => onDismiss(o.id)}
          />
        ))
      )}
    </Stack>
  );
}

function SuggestionCard({
  opportunity: o,
  promoting,
  dismissing,
  onPromote,
  onDismiss,
}: {
  opportunity: OpportunityDto;
  promoting: boolean;
  dismissing: boolean;
  onPromote: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card withBorder data-testid={`suggestion-${o.id}`}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Text fw={600} size="lg">
            <RoleTitle name={o.title} isManagement={o.isManagement} badgeSide="right" />
          </Text>
          <Group gap="xs">
            <Text>{o.companyName}</Text>
            {o.companySize && (
              <Badge size="xs" variant="light">
                {COMPANY_SIZE_LABELS[o.companySize]}
              </Badge>
            )}
            {o.location && (
              <Text c="dimmed" size="sm">
                · {o.location}
              </Text>
            )}
            {o.postedAt && (
              <Text c="dimmed" size="sm">
                · listed on {formatDateMaybeTime(o.postedAt)}
              </Text>
            )}
          </Group>
          <Text c="dimmed" size="sm">
            Suggested {formatFullDateTime(o.createdAt)}
          </Text>
        </Stack>
        <Tooltip label="Match score">
          <Badge size="xl" color={scoreColor(o.score)} aria-label={`Match score ${o.score}`}>
            {o.score}
          </Badge>
        </Tooltip>
      </Group>

      {o.summary && <Text mt="sm">{o.summary}</Text>}
      {o.reasons.length > 0 && (
        <List size="sm" mt="xs" c="dimmed">
          {o.reasons.map((r) => (
            <List.Item key={r}>{r}</List.Item>
          ))}
        </List>
      )}

      <Group mt="md" justify="space-between">
        <Anchor href={o.listingUrl} target="_blank" rel="noreferrer" size="sm">
          <Group gap={4}>
            View listing <IconExternalLink size={14} />
          </Group>
        </Anchor>
        <Group gap="xs">
          <Button
            variant="default"
            leftSection={<IconX size={16} />}
            onClick={onDismiss}
            loading={dismissing}
            disabled={promoting}
          >
            Dismiss
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={onPromote}
            loading={promoting}
            disabled={dismissing}
          >
            Add to applications
          </Button>
        </Group>
      </Group>
    </Card>
  );
}
