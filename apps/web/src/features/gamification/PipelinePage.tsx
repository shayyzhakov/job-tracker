import {
  APPLICATION_STATUSES,
  type ApplicationDto,
  type ApplicationStatus,
  STATUS_LABELS,
} from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { useApplications, useChangeStatus } from '../../api/hooks';
import {
  ApplicationFilterBar,
  applyLocalFilters,
  useLocalFilters,
} from '../../components/ApplicationFilterBar';
import { CorporateBadge } from '../../components/CompanyName';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { RoleTitle } from '../../components/RoleTitle';
import { STATUS_COLORS } from '../../components/StatusBadge';
import { Gate } from './Gate';
import { GROUPS, type GroupId, groupOf, type StageGroup } from './groups';
import { ViewSwitch } from './ViewSwitch';

function Board() {
  const { data: all, isPending, error } = useApplications({});
  const [local] = useLocalFilters();
  const changeStatus = useChangeStatus();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<GroupId | null>(null);
  const [moved, setMoved] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // application awaiting an outcome
  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="applications" />;

  const data = applyLocalFilters(all, local);

  const move = (app: ApplicationDto, status: ApplicationStatus) => {
    if (app.status === status) return;
    changeStatus.mutate({ id: app.id, status });
    setMoved(app.id);
    setTimeout(() => setMoved(null), 900);
  };

  const drop = (group: StageGroup) => {
    const app = data.find((a) => a.id === dragId);
    setDragId(null);
    setOver(null);
    if (!app || groupOf(app.status) === group.id) return;
    if (group.dropStatus) move(app, group.dropStatus);
    else setAsking(app.id);
  };

  const askingApp = data.find((a) => a.id === asking);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Title order={2}>Applications</Title>
          <ViewSwitch current="pipeline" />
        </Group>
        <Group>
          <ApplicationFilterBar />
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Drag a card between columns, or click its badge to set an exact status.
      </Text>
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {GROUPS.map((group) => {
          const apps = data.filter((a) => groupOf(a.status) === group.id);
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: native drag-and-drop target; the badge menu on each card is the keyboard path
            <div
              key={group.id}
              data-testid={`col-${group.id}`}
              className={`gm-col ${over === group.id ? 'gm-col--over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(group.id);
              }}
              onDragLeave={() => setOver((o) => (o === group.id ? null : o))}
              onDrop={() => drop(group)}
            >
              <Group justify="space-between" mb="xs" wrap="nowrap">
                <Stack gap={0}>
                  <Text fw={700}>{group.title}</Text>
                  <Text size="xs" c="dimmed">
                    {group.hint}
                  </Text>
                </Stack>
                <Badge variant="default" className="tabular-nums">
                  {apps.length}
                </Badge>
              </Group>
              <Stack gap="xs">
                {apps.length === 0 && (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    Nothing here
                  </Text>
                )}
                {apps.map((a) => (
                  <Card
                    key={a.id}
                    withBorder
                    padding="sm"
                    draggable
                    onDragStart={() => setDragId(a.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    className={`gm-card ${moved === a.id ? 'gm-pop' : ''}`}
                    data-testid={`card-${a.id}`}
                  >
                    <Stack gap={6} align="flex-start">
                      <Stack gap={0} style={{ minWidth: 0 }}>
                        <Group gap={0} wrap="nowrap">
                          <Anchor
                            component={Link}
                            to={`/applications/${a.id}`}
                            fw={600}
                            size="sm"
                            draggable={false}
                          >
                            {a.company.name}
                          </Anchor>
                          <CorporateBadge company={a.company} />
                        </Group>
                        <Text size="xs" c="dimmed" component="div">
                          <RoleTitle name={a.roleName} isManagement={a.isManagement} />
                        </Text>
                      </Stack>
                      <Menu position="bottom-end" shadow="md" withinPortal>
                        <Menu.Target>
                          <Badge
                            component="button"
                            type="button"
                            variant="light"
                            color={STATUS_COLORS[a.status]}
                            style={{ cursor: 'pointer' }}
                            aria-label={`Status: ${STATUS_LABELS[a.status]}. Change status`}
                            data-testid={`badge-${a.id}`}
                          >
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {APPLICATION_STATUSES.map((s) => (
                            <Menu.Item key={s} disabled={s === a.status} onClick={() => move(a, s)}>
                              {STATUS_LABELS[s]}
                            </Menu.Item>
                          ))}
                        </Menu.Dropdown>
                      </Menu>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </div>
          );
        })}
      </SimpleGrid>

      <Modal
        opened={Boolean(askingApp)}
        onClose={() => setAsking(null)}
        title={askingApp ? `How did ${askingApp.company.name} end?` : ''}
        size="sm"
      >
        <Stack gap="xs">
          {(GROUPS[2] as StageGroup).statuses.map((s) => (
            <Button
              key={s}
              variant="light"
              color={STATUS_COLORS[s]}
              onClick={() => {
                if (askingApp) move(askingApp, s);
                setAsking(null);
              }}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </Stack>
      </Modal>
    </Stack>
  );
}

export function PipelinePage() {
  return (
    <Gate>
      <Board />
    </Gate>
  );
}
