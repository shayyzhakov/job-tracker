import { COMPANY_SIZE_LABELS, COMPANY_SIZES, type CompanyWithCountsDto } from '@job-tracker/shared';
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useCompanies, useDeleteCompany } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { SortableTh, useSortedRows } from '../../components/SortableTh';
import { CompanyFormModal } from './CompanyFormModal';

type SortKey = 'name' | 'size' | 'type' | 'applications';

export function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [q] = useDebouncedValue(search.trim(), 250);
  const { data, isPending, error } = useCompanies(q);
  const rows = data ?? [];
  const { sorted, sort, toggle } = useSortedRows<CompanyWithCountsDto, SortKey>(
    rows,
    {
      name: (c) => c.name,
      // Order by the size scale (smallest first); companies without a size sort last.
      size: (c) => (c.size ? COMPANY_SIZES.indexOf(c.size) : null),
      type: (c) => (c.isPublic ? 'Public' : 'Private'),
      applications: (c) => c.totalApplications * 1000 + c.activeApplications,
    },
    { key: 'name', direction: 'asc' },
  );

  // `editing` is a company, or 'new' for the add form; null when the modal is closed.
  const [editing, setEditing] = useState<CompanyWithCountsDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CompanyWithCountsDto | null>(null);
  const remove = useDeleteCompany();
  const closeDelete = () => {
    setDeleting(null);
    remove.reset();
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Companies</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
          Add company
        </Button>
      </Group>

      <TextInput
        placeholder="Search companies"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={300}
      />

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="companies" />
      ) : rows.length === 0 ? (
        <Card withBorder padding="xl">
          <Text c="dimmed" ta="center">
            {q
              ? 'No companies match your search.'
              : 'No companies yet. Add one to start tracking it.'}
          </Text>
        </Card>
      ) : (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={700}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <SortableTh columnKey="name" sort={sort} onSort={toggle}>
                    Name
                  </SortableTh>
                  <SortableTh columnKey="size" sort={sort} onSort={toggle} w={170}>
                    Size
                  </SortableTh>
                  <SortableTh columnKey="type" sort={sort} onSort={toggle} w={110}>
                    Type
                  </SortableTh>
                  <SortableTh columnKey="applications" sort={sort} onSort={toggle} w={170}>
                    Applications
                  </SortableTh>
                  <Table.Th w={90} aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sorted.map((c) => (
                  <Table.Tr key={c.id}>
                    <Table.Td>
                      <Anchor
                        component="button"
                        type="button"
                        fw={600}
                        onClick={() => setEditing(c)}
                      >
                        {c.name}
                      </Anchor>
                      {c.location && (
                        <Text size="xs" c="dimmed">
                          {c.location}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {c.size ? COMPANY_SIZE_LABELS[c.size] : <Text c="dimmed">–</Text>}
                    </Table.Td>
                    <Table.Td>{c.isPublic ? 'Public' : 'Private'}</Table.Td>
                    <Table.Td>
                      {c.totalApplications > 0 ? (
                        <Anchor
                          component={Link}
                          to={`/applications?q=${encodeURIComponent(c.name)}&scope=all`}
                          aria-label={`${c.activeApplications} active of ${c.totalApplications} applications at ${c.name}`}
                        >
                          {c.activeApplications} / {c.totalApplications}
                        </Anchor>
                      ) : (
                        <Text span c="dimmed">
                          0 / 0
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap" justify="flex-end">
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Edit ${c.name}`}
                            onClick={() => setEditing(c)}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip
                          label={
                            c.totalApplications > 0
                              ? `Has ${c.totalApplications} application${c.totalApplications === 1 ? '' : 's'}; delete them first`
                              : 'Delete'
                          }
                        >
                          {/* aria-disabled (not disabled) keeps the tooltip working on hover. */}
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Delete ${c.name}`}
                            aria-disabled={c.totalApplications > 0}
                            data-disabled={c.totalApplications > 0 || undefined}
                            onClick={() => c.totalApplications === 0 && setDeleting(c)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <CompanyFormModal
        opened={editing !== null}
        company={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />

      <Modal opened={deleting !== null} onClose={closeDelete} title="Delete company">
        <Stack>
          <Text>
            Delete <b>{deleting?.name}</b>? This cannot be undone.
          </Text>
          {remove.error && (
            <Alert color="red" role="alert">
              {remove.error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeDelete}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id, { onSuccess: closeDelete })}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
