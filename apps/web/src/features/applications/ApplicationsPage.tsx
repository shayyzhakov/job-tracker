import type { ApplicationStatus } from '@job-tracker/shared';
import {
  Anchor,
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
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { type ApplicationFilters, useApplications, useChangeStatus } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { StatusSelect } from '../../components/StatusSelect';
import { formatDate, formatDateTime, formatIls } from '../../lib/format';

type Scope = 'active' | 'closed' | 'all';
const scopeToActive: Record<Scope, boolean | undefined> = {
  active: true,
  closed: false,
  all: undefined,
};

export function ApplicationsPage() {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 250);
  const [scope, setScope] = useState<Scope>('active');
  const filters: ApplicationFilters = { q: q || undefined, active: scopeToActive[scope] };
  const { data, isPending, error } = useApplications(filters);
  const changeStatus = useChangeStatus();

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Applications</Title>
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
      </Group>

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="applications" />
      ) : data.length === 0 ? (
        <Card withBorder padding="xl">
          <Text c="dimmed" ta="center">
            No applications found.{' '}
            <Anchor component={Link} to="/applications/new">
              Add one
            </Anchor>
          </Text>
        </Card>
      ) : (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={900}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Company</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th w={210}>Status</Table.Th>
                  <Table.Th>Expected salary</Table.Th>
                  <Table.Th>Applied</Table.Th>
                  <Table.Th>Next interview</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((a) => (
                  <Table.Tr key={a.id}>
                    <Table.Td>
                      <Anchor component={Link} to={`/applications/${a.id}`} fw={600}>
                        {a.company.name}
                      </Anchor>
                      {a.company.location && (
                        <Text size="xs" c="dimmed">
                          {a.company.location}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {a.roleName}
                      {a.isManagement && (
                        <Text size="xs" c="dimmed">
                          Management
                        </Text>
                      )}
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
                    <Table.Td>{formatIls(a.expectedSalaryIls)}</Table.Td>
                    <Table.Td>{formatDate(a.appliedAt)}</Table.Td>
                    <Table.Td>{formatDateTime(a.nextInterviewAt)}</Table.Td>
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
