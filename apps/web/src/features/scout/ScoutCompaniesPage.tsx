import {
  COMPANY_PRIORITIES,
  COMPANY_PRIORITY_LABELS,
  COMPANY_SIZE_LABELS,
  type CompanyPriority,
  type CompanyWithCountsDto,
} from '@job-tracker/shared';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowsExchange, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useCompanies, useUpdateCompany } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';

const BUCKET_HINTS: Record<CompanyPriority, string> = {
  top: 'Searched first, biggest score boost.',
  high: 'Searched early, score boost.',
  moderate: 'The default. New companies land here.',
  low: 'Searched last, score penalty.',
  blacklist: 'Never suggested.',
};

const BUCKET_COLORS: Record<CompanyPriority, string> = {
  top: 'teal',
  high: 'green',
  moderate: 'gray',
  low: 'orange',
  blacklist: 'red',
};

/** Sort companies into priority buckets so the scout knows where to look (and where not to). */
export function ScoutCompaniesPage() {
  const [search, setSearch] = useState('');
  const { data, isPending, error } = useCompanies('');
  const update = useUpdateCompany();
  // Drag state: the company being dragged and the bucket it is over.
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<CompanyPriority | null>(null);

  const needle = search.trim().toLowerCase();
  const companies = (data ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle));
  const move = (id: string, priority: CompanyPriority) =>
    update.mutate({ id, patch: { priority } });
  const drop = (priority: CompanyPriority) => {
    const company = (data ?? []).find((c) => c.id === dragId);
    setDragId(null);
    setOver(null);
    if (company && company.priority !== priority) move(company.id, priority);
  };

  return (
    <Stack>
      <div>
        <Title order={2}>Prioritize companies</Title>
        <Text c="dimmed" size="sm">
          Tell the scout which companies matter. It searches the top buckets first and never
          suggests blacklisted ones. Drag a company to another bucket, or use its menu.
        </Text>
      </div>

      <TextInput
        placeholder="Search companies"
        aria-label="Search companies"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        w={300}
      />

      {update.error && (
        <Alert color="red" role="alert">
          Could not move the company: {update.error.message}
        </Alert>
      )}

      {isPending ? (
        <PageLoader />
      ) : error ? (
        <ErrorAlert error={error} what="companies" />
      ) : (data ?? []).length === 0 ? (
        <Card withBorder padding="xl">
          <Text ta="center" c="dimmed">
            No companies yet. Add some on the{' '}
            <Anchor component={Link} to="/companies">
              Companies page
            </Anchor>
            , or they appear here when you create an application.
          </Text>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm" verticalSpacing="sm">
          {COMPANY_PRIORITIES.map((priority) => (
            <Bucket
              key={priority}
              priority={priority}
              companies={companies.filter((c) => c.priority === priority)}
              onMove={move}
              isOver={over === priority}
              onDragOver={() => setOver(priority)}
              onDragLeave={() => setOver((o) => (o === priority ? null : o))}
              onDrop={() => drop(priority)}
              onDragStart={setDragId}
              onDragEnd={() => {
                setDragId(null);
                setOver(null);
              }}
              moving={update.isPending ? update.variables?.id : undefined}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function Bucket({
  priority,
  companies,
  onMove,
  moving,
  isOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onDragEnd,
}: {
  priority: CompanyPriority;
  companies: CompanyWithCountsDto[];
  onMove: (id: string, priority: CompanyPriority) => void;
  moving: string | undefined;
  isOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const label = COMPANY_PRIORITY_LABELS[priority];
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: native drag-and-drop target; each card's menu is the keyboard path
    <Card
      withBorder
      padding="sm"
      aria-label={`${label} bucket`}
      component="section"
      data-testid={`bucket-${priority}`}
      style={
        isOver ? { borderColor: `var(--mantine-color-${BUCKET_COLORS[priority]}-6)` } : undefined
      }
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Stack gap="xs">
        <div>
          <Group justify="space-between">
            <Text fw={600}>{label}</Text>
            <Badge color={BUCKET_COLORS[priority]} variant="light">
              {companies.length}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {BUCKET_HINTS[priority]}
          </Text>
        </div>
        {companies.length === 0 ? (
          <Text size="sm" c="dimmed">
            Empty
          </Text>
        ) : (
          companies.map((c) => (
            <Card
              key={c.id}
              withBorder
              padding="xs"
              opacity={moving === c.id ? 0.6 : 1}
              draggable
              style={{ cursor: 'grab' }}
              data-testid={`company-${c.id}`}
              onDragStart={() => onDragStart(c.id)}
              onDragEnd={onDragEnd}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500} size="sm" truncate>
                    {c.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {[c.size ? COMPANY_SIZE_LABELS[c.size] : null, c.isPublic ? 'Public' : null]
                      .filter(Boolean)
                      .join(' · ') || ' '}
                  </Text>
                </div>
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="subtle" aria-label={`Move ${c.name}`}>
                      <IconArrowsExchange size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Move to</Menu.Label>
                    {COMPANY_PRIORITIES.filter((p) => p !== priority).map((p) => (
                      <Menu.Item key={p} onClick={() => onMove(c.id, p)}>
                        {COMPANY_PRIORITY_LABELS[p]}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card>
          ))
        )}
      </Stack>
    </Card>
  );
}
