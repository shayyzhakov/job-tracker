import {
  APPLICATION_STATUSES,
  type ApplicationDto,
  type ApplicationStatus,
} from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconCalendarCheck, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  type ApplicationFilters,
  useActions,
  useApplications,
  useChangeStatus,
} from '../../api/hooks';
import {
  ApplicationFilterBar,
  applyLocalFilters,
  isFiltering,
  useLocalFilters,
} from '../../components/ApplicationFilterBar';
import { CorporateBadge } from '../../components/CompanyName';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { RoleTitle } from '../../components/RoleTitle';
import { SortableTh, useSortedRows } from '../../components/SortableTh';
import { StatusSelect } from '../../components/StatusSelect';
import { Slot } from '../../lib/extensions';
import { formatDate, formatDateTime } from '../../lib/format';

type Scope = 'active' | 'closed' | 'all';
const scopeToActive: Record<Scope, boolean | undefined> = {
  active: true,
  closed: false,
  all: undefined,
};

type SortKey = 'company' | 'role' | 'status' | 'move' | 'applied' | 'interview' | 'done';

type Move = 'needs_you' | 'scheduled' | 'waiting';
const MOVES: Record<Move, { label: string; color: string; order: number }> = {
  needs_you: { label: 'Needs you', color: 'red', order: 0 },
  scheduled: { label: 'Scheduled', color: 'blue', order: 1 },
  waiting: { label: 'Waiting', color: 'gray', order: 2 },
};

export function ApplicationsPage() {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 250);
  const [scope, setScope] = useState<Scope>('active');
  const filters: ApplicationFilters = { q: q || undefined, active: scopeToActive[scope] };
  const { data, isPending, error } = useApplications(filters);
  const [local] = useLocalFilters();
  const rows = applyLocalFilters(data ?? [], local);
  const changeStatus = useChangeStatus();
  const { data: actions } = useActions();
  const moves = new Map<string, Move>();
  for (const w of actions?.waiting ?? []) moves.set(w.applicationId, 'waiting');
  for (const w of actions?.scheduled ?? []) moves.set(w.applicationId, 'scheduled');
  for (const a of actions?.needsYou ?? []) moves.set(a.applicationId, 'needs_you');
  const { sorted, sort, toggle } = useSortedRows<ApplicationDto, SortKey>(rows, {
    company: (a) => a.company.name,
    role: (a) => a.roleName,
    status: (a) => APPLICATION_STATUSES.indexOf(a.status),
    move: (a) => {
      const m = moves.get(a.id);
      return m ? MOVES[m].order : 3;
    },
    applied: (a) => a.appliedAt,
    interview: (a) => a.nextInterviewAt,
    done: (a) => a.interviewsCount,
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Applications</Title>
          <Slot name="applications.views" />
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
        <SegmentedControl
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          data={[
            { value: 'active', label: 'Active' },
            { value: 'closed', label: 'Closed' },
            { value: 'all', label: 'All' },
          ]}
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
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <SortableTh columnKey="company" sort={sort} onSort={toggle}>
                    Company
                  </SortableTh>
                  <SortableTh columnKey="role" sort={sort} onSort={toggle}>
                    Role
                  </SortableTh>
                  <SortableTh columnKey="status" sort={sort} onSort={toggle} w={210}>
                    Status
                  </SortableTh>
                  <SortableTh columnKey="move" sort={sort} onSort={toggle} w={120}>
                    Next move
                  </SortableTh>
                  <SortableTh columnKey="applied" sort={sort} onSort={toggle}>
                    Applied
                  </SortableTh>
                  <SortableTh columnKey="interview" sort={sort} onSort={toggle}>
                    Next interview
                  </SortableTh>
                  <SortableTh columnKey="done" sort={sort} onSort={toggle} w={110}>
                    Interviews
                  </SortableTh>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/applications/${a.id}`} fw={600}>
                        {a.company.name}
                      </Anchor>
                      <CorporateBadge company={a.company} />
                      {a.company.location && (
                        <Text size="xs" c="dimmed">
                          {a.company.location}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <RoleTitle name={a.roleName} isManagement={a.isManagement} />
                    </Table.Td>
                    <Table.Td>
                      <StatusSelect
                        aria-label={`Status for ${a.company.name}`}
                        size="xs"
                        value={a.status}
                        onChange={(status: ApplicationStatus) =>
                          changeStatus.mutate({ id: a.id, status })
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      {(() => {
                        const move = moves.get(a.id);
                        return move ? (
                          <Badge
                            variant="light"
                            color={MOVES[move].color}
                            data-testid="next-move"
                            data-move={move}
                          >
                            {MOVES[move].label}
                          </Badge>
                        ) : null;
                      })()}
                    </Table.Td>
                    <Table.Td>{formatDate(a.appliedAt)}</Table.Td>
                    <Table.Td>{formatDateTime(a.nextInterviewAt)}</Table.Td>
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
