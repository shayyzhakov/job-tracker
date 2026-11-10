import {
  APPLICATION_STATUSES,
  type ApplicationDto,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPE_ROUND_STATUS,
  STATUS_GROUP_LABELS,
  STATUS_GROUPS,
  STATUS_LABELS,
  type StatusGroup,
} from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconAlertCircleFilled,
  IconCalendarCheck,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { type ApplicationFilters, useActions, useApplications } from '../../api/hooks';
import {
  ApplicationFilterBar,
  applyLocalFilters,
  isFiltering,
  useLocalFilters,
} from '../../components/ApplicationFilterBar';
import { ApplicationViewSwitch } from '../../components/ApplicationViewSwitch';
import { CorporateBadge } from '../../components/CompanyName';
import { MultiFilter } from '../../components/MultiFilter';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { RoleTitle } from '../../components/RoleTitle';
import { SortableTh, useSortedRows } from '../../components/SortableTh';
import { formatDate, formatDateTime } from '../../lib/format';

// Nothing selected, or every group, means no restriction.
const groupsFilter = (groups: StatusGroup[]): StatusGroup[] | undefined =>
  groups.length === 0 || groups.length === STATUS_GROUPS.length ? undefined : groups;

type SortKey = 'company' | 'role' | 'status' | 'applied' | 'done';

export function ApplicationsPage() {
  // The Companies page links here with ?q=<company>&scope=all to show all of a company's applications.
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [q] = useDebouncedValue(search.trim(), 250);
  const [groups, setGroups] = useState<StatusGroup[]>(
    params.get('scope') === 'all'
      ? []
      : params.get('scope') === 'closed'
        ? ['closed']
        : ['initial', 'active'],
  );
  const filters: ApplicationFilters = {
    q: q || undefined,
    groups: groupsFilter(groups),
  };
  const { data, isPending, error } = useApplications(filters);
  const [local] = useLocalFilters();
  const rows = applyLocalFilters(data ?? [], local);
  const { data: actions } = useActions();
  // flagged is ranked most urgent first (and includes capped nudges), so the first card per application is its next step.
  const needsYou = new Map<string, string>();
  for (const a of actions?.flagged ?? []) {
    if (!needsYou.has(a.applicationId)) needsYou.set(a.applicationId, a.title);
  }
  const { sorted, sort, toggle } = useSortedRows<ApplicationDto, SortKey>(rows, {
    company: (a) => a.company.name,
    role: (a) => a.roleName,
    status: (a) => APPLICATION_STATUSES.indexOf(a.status),
    applied: (a) => a.appliedAt,
    done: (a) => a.interviewsCount,
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Applications</Title>
          <ApplicationViewSwitch current="table" />
        </Group>
        <Button component={Link} to="/applications/new" leftSection={<IconPlus size={16} />}>
          New application
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search company or role"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={300}
        />
        <MultiFilter<StatusGroup>
          label="Status"
          allLabel="All statuses"
          value={groups}
          onChange={setGroups}
          options={STATUS_GROUPS.map((g) => ({ value: g, label: STATUS_GROUP_LABELS[g] }))}
        />
        <ApplicationFilterBar />
      </Group>

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="applications" />
      ) : rows.length === 0 ? (
        <Card withBorder padding="xl">
          <Text c="dimmed" ta="center">
            No applications found.{' '}
            {isFiltering(local) ? (
              'Try clearing the filters.'
            ) : (
              <Anchor component={Link} to="/applications/new">
                Add one
              </Anchor>
            )}
          </Text>
        </Card>
      ) : (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={1000}>
            <Table highlightOnHover verticalSpacing="sm" layout="fixed">
              <Table.Thead>
                <Table.Tr>
                  <SortableTh columnKey="company" sort={sort} onSort={toggle} w={260}>
                    Company
                  </SortableTh>
                  <SortableTh columnKey="role" sort={sort} onSort={toggle}>
                    Role
                  </SortableTh>
                  <SortableTh columnKey="status" sort={sort} onSort={toggle} w={210}>
                    Status
                  </SortableTh>
                  <SortableTh columnKey="applied" sort={sort} onSort={toggle} w={120}>
                    Applied
                  </SortableTh>
                  <SortableTh columnKey="done" sort={sort} onSort={toggle} w={110}>
                    Interviews
                  </SortableTh>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((a) => (
                  <Table.Tr
                    key={a.id}
                    data-needs-you={needsYou.has(a.id) || undefined}
                    style={
                      needsYou.has(a.id)
                        ? {
                            boxShadow: 'inset 3px 0 0 var(--mantine-color-yellow-6)',
                          }
                        : undefined
                    }
                  >
                    <Table.Td>
                      <Group gap={0} wrap="wrap" style={{ rowGap: 2 }}>
                        {needsYou.has(a.id) && (
                          <Tooltip label={needsYou.get(a.id)}>
                            <IconAlertCircleFilled
                              style={{ marginRight: 6 }}
                              size={16}
                              color="var(--mantine-color-yellow-6)"
                              data-testid="needs-you"
                              aria-label={needsYou.get(a.id)}
                            />
                          </Tooltip>
                        )}
                        <Anchor component={Link} to={`/applications/${a.id}`} fw={600}>
                          {a.company.name}
                        </Anchor>
                        <CorporateBadge company={a.company} />
                      </Group>
                      {a.company.location && (
                        <Text size="xs" c="dimmed">
                          {a.company.location}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ overflowWrap: 'anywhere' }}>
                      <RoleTitle name={a.roleName} isManagement={a.isManagement} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{STATUS_LABELS[a.status]}</Text>
                      {a.nextInterviewAt && (
                        <Text size="xs" c="dimmed" mt={2} data-testid="next-interview">
                          {a.nextInterviewType && !INTERVIEW_TYPE_ROUND_STATUS[a.nextInterviewType]
                            ? `${INTERVIEW_TYPE_LABELS[a.nextInterviewType]} · `
                            : ''}
                          {formatDateTime(a.nextInterviewAt)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(a.appliedAt)}</Table.Td>
                    <Table.Td>
                      {a.interviewsCount > 0 ? (
                        <Badge
                          variant="light"
                          leftSection={<IconCalendarCheck size={12} />}
                          aria-label={`${a.interviewsCount} interview rounds reached`}
                        >
                          {a.interviewsCount}
                        </Badge>
                      ) : (
                        <Text c="dimmed">–</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}
