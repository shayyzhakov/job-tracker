import {
  COMPANY_PRIORITIES,
  COMPANY_PRIORITY_LABELS,
  COMPANY_SIZE_LABELS,
  DEFAULT_COMPANY_PRIORITY,
  type CompanyPriority,
  type OpportunityDto,
} from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  List,
  Menu,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuildingSkyscraper,
  IconCheck,
  IconChevronDown,
  IconFlag,
  IconExternalLink,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router';
import {
  useCompanies,
  useCreateCompany,
  useDismissOpportunity,
  useOpportunities,
  usePromoteOpportunity,
  useUpdateCompany,
} from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { RoleTitle } from '../../components/RoleTitle';
import { BUCKET_COLORS, BUCKET_HINTS } from '../scout/priorityMeta';
import { formatDateMaybeTime, formatFullDateTime } from '../../lib/format';

const scoreColor = (score: number) => (score >= 80 ? 'teal' : score >= 60 ? 'yellow' : 'gray');

export function SuggestionsPage() {
  const { data, isPending, error } = useOpportunities('new');
  const promote = usePromoteOpportunity();
  const dismiss = useDismissOpportunity();
  const navigate = useNavigate();
  const companies = useCompanies('');
  const updateCompany = useUpdateCompany();
  const createCompany = useCreateCompany();

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

  // Scout listings carry the company name as text, so match a company by name, case-insensitively.
  const findCompany = (name: string) =>
    companies.data?.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const onPriority = (name: string, priority: CompanyPriority) => {
    const existing = findCompany(name);
    if (existing) updateCompany.mutate({ id: existing.id, patch: { priority } }, { onError });
    else createCompany.mutate({ name, priority, isPublic: false }, { onError });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Suggestions</Title>
          <Text c="dimmed" size="sm">
            New listings the AI scout found for you, best match first.
          </Text>
        </div>
        <Group gap="xs">
          <Button
            component={Link}
            to="/scout/companies"
            variant="default"
            leftSection={<IconBuildingSkyscraper size={16} />}
          >
            Prioritize companies
          </Button>
          <Button
            component={Link}
            to="/scout/settings"
            variant="default"
            leftSection={<IconSettings size={16} />}
          >
            Scout settings
          </Button>
        </Group>
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
            priority={findCompany(o.companyName)?.priority ?? DEFAULT_COMPANY_PRIORITY}
            priorityDisabled={companies.isPending}
            onPriority={(p) => onPriority(o.companyName, p)}
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
  priority,
  priorityDisabled,
  onPriority,
}: {
  opportunity: OpportunityDto;
  promoting: boolean;
  dismissing: boolean;
  onPromote: () => void;
  onDismiss: () => void;
  priority: CompanyPriority;
  priorityDisabled: boolean;
  onPriority: (priority: CompanyPriority) => void;
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
            {priority !== DEFAULT_COMPANY_PRIORITY && (
              <Badge size="xs" variant="light" color={BUCKET_COLORS[priority]}>
                {COMPANY_PRIORITY_LABELS[priority]}
              </Badge>
            )}
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
          <Menu position="top-end" withinPortal>
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                disabled={priorityDisabled}
                leftSection={<IconFlag size={16} />}
                rightSection={<IconChevronDown size={14} />}
                aria-label={`Set scout priority for ${o.companyName}`}
              >
                Prioritize {o.companyName}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>How much do you want {o.companyName}?</Menu.Label>
              {COMPANY_PRIORITIES.map((p) => (
                <Menu.Item
                  key={p}
                  color={p === 'blacklist' ? 'red' : undefined}
                  rightSection={p === priority ? <IconCheck size={14} /> : null}
                  onClick={() => p !== priority && onPriority(p)}
                >
                  <Text size="sm" fw={p === priority ? 600 : 400}>
                    {COMPANY_PRIORITY_LABELS[p]}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {BUCKET_HINTS[p]}
                  </Text>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
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
