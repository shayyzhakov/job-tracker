import {
  APPLICATION_METHOD_LABELS,
  type ApplicationDetailDto,
  COMPANY_SIZE_LABELS,
  INTERVIEW_TYPE_LABELS,
  REFERRAL_CHANNEL_LABELS,
  STATUS_LABELS,
} from '@job-tracker/shared';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconExternalLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  useApplication,
  useChangeStatus,
  useDeleteApplication,
  useUpdateApplication,
} from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';
import { StatusSelect } from '../../components/StatusSelect';
import { Slot } from '../../lib/extensions';
import { formatDate, formatDateTime, formatIls } from '../../lib/format';
import { ApplicationForm, toUpdatePayload, valuesFromApplication } from './ApplicationForm';
import { ContactsSection } from './ContactsSection';
import { InterviewsSection } from './InterviewsSection';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Text component="div">{children ?? '—'}</Text>
    </Stack>
  );
}

function Details({ app }: { app: ApplicationDetailDto }) {
  return (
    <Card withBorder padding="lg">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Field label="Company size">
          {app.company.size ? COMPANY_SIZE_LABELS[app.company.size] : null}
        </Field>
        <Field label="Public company">{app.company.isPublic ? 'Yes' : 'No'}</Field>
        <Field label="Location">{app.company.location}</Field>
        <Field label="Management role">{app.isManagement ? 'Yes' : 'No'}</Field>
        <Field label="Expected salary">{formatIls(app.expectedSalaryIls)}</Field>
        <Field label="Applied on">{formatDate(app.appliedAt)}</Field>
        <Field label="Application method">
          {app.applicationMethod ? APPLICATION_METHOD_LABELS[app.applicationMethod] : null}
        </Field>
        {app.applicationMethod === 'referral' && (
          <>
            <Field label="Referred by">{app.referrerName}</Field>
            <Field label="Spoke via">
              {app.referrerChannel ? REFERRAL_CHANNEL_LABELS[app.referrerChannel] : null}
            </Field>
          </>
        )}
        {app.source && <Field label="Source">{app.source}</Field>}
        <Field label="Listing">
          {app.listingUrl ? (
            <Anchor href={app.listingUrl} target="_blank" rel="noreferrer">
              Open listing <IconExternalLink size={12} />
            </Anchor>
          ) : null}
        </Field>
        <Field label="Website">
          {app.company.website ? (
            <Anchor href={app.company.website} target="_blank" rel="noreferrer">
              {app.company.website}
            </Anchor>
          ) : null}
        </Field>
      </SimpleGrid>
      {app.methodDetails && (
        <Stack gap={0} mt="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Method details
          </Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{app.methodDetails}</Text>
        </Stack>
      )}
      {app.notes && (
        <Stack gap={0} mt="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Notes
          </Text>
          <Text style={{ whiteSpace: 'pre-wrap' }}>{app.notes}</Text>
        </Stack>
      )}
    </Card>
  );
}

export function ApplicationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: app, isPending, error } = useApplication(id);
  const changeStatus = useChangeStatus();
  const update = useUpdateApplication(id);
  const remove = useDeleteApplication();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, confirm] = useDisclosure(false);

  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="application" />;

  const now = Date.now();
  const upcoming = app.interviews
    .filter((i) => new Date(i.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <Stack>
      <Anchor component={Link} to="/applications" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All applications
        </Group>
      </Anchor>

      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>{app.roleName}</Title>
          <Group gap="xs">
            <Text fz="lg">{app.company.name}</Text>
            <StatusBadge status={app.status} />
          </Group>
        </Stack>
        <Group>
          <StatusSelect
            aria-label="Change status"
            value={app.status}
            onChange={(status) => changeStatus.mutate({ id: app.id, status })}
            w={200}
          />
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => changeStatus.mutate({ id: app.id, status: app.status, repeat: true })}
          >
            Add another {STATUS_LABELS[app.status]} step
          </Button>
          {!editing && (
            <Button
              variant="default"
              leftSection={<IconPencil size={16} />}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={confirm.open}
          >
            Delete
          </Button>
        </Group>
      </Group>

      <Slot name="application.detail.top" applicationId={app.id} status={app.status} />

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack>
            {editing ? (
              <ApplicationForm
                mode="edit"
                initialValues={valuesFromApplication(app)}
                submitting={update.isPending}
                submitLabel="Save changes"
                onCancel={() => setEditing(false)}
                onSubmit={(values) =>
                  update.mutate(toUpdatePayload(values), {
                    onSuccess: () => setEditing(false),
                    onError: (err) =>
                      notifications.show({
                        color: 'red',
                        title: 'Could not save',
                        message: err.message,
                      }),
                  })
                }
              />
            ) : (
              <Details app={app} />
            )}
            {!editing && (
              <>
                <InterviewsSection applicationId={app.id} interviews={app.interviews} />
                <ContactsSection applicationId={app.id} contacts={app.contacts} />
              </>
            )}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder padding="lg">
            <Text fw={600} mb="md">
              Status history
            </Text>
            <Timeline
              active={app.history.length - 1}
              bulletSize={14}
              lineWidth={2}
              data-testid="status-timeline"
            >
              {app.history.map((h) => (
                <Timeline.Item key={h.id} title={STATUS_LABELS[h.toStatus]}>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(h.changedAt)}
                  </Text>
                </Timeline.Item>
              ))}
              {upcoming.map((i) => (
                <Timeline.Item
                  key={i.id}
                  lineVariant="dashed"
                  title={
                    <Text span fs="italic" c="dimmed" size="sm" fw={500}>
                      {INTERVIEW_TYPE_LABELS[i.type]} interview
                    </Text>
                  }
                  data-testid="upcoming-step"
                >
                  <Group gap={6}>
                    <Badge size="xs" variant="outline" color="gray">
                      Scheduled
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4}>
                    {formatDateTime(i.scheduledAt)}
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Grid.Col>
      </Grid>

      <Modal opened={confirmOpen} onClose={confirm.close} title="Delete application?" centered>
        <Text mb="md">
          This permanently deletes the {app.roleName} application at {app.company.name}, including
          its contacts, interviews and history.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={confirm.close}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={remove.isPending}
            onClick={() =>
              remove.mutate(app.id, {
                onSuccess: () => navigate('/applications', { replace: true }),
              })
            }
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
