import {
  APPLICATION_METHOD_LABELS,
  type ApplicationDetailDto,
  type ApplicationStatus,
  COMPANY_SIZE_LABELS,
  isRoundStatus,
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
  Tabs,
  Text,
  TextInput,
  Timeline,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconExternalLink, IconPencil, IconTrash } from '@tabler/icons-react';
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
import { formatDate, formatDateMaybeTime, formatDateTime, formatIls } from '../../lib/format';
import { ApplicationForm, toUpdatePayload, valuesFromApplication } from './ApplicationForm';
import { ContactsSection } from './ContactsSection';
import { InterviewsSection } from './InterviewsSection';
import { NotesTab } from './NotesTab';
import { buildStatusFlow } from './statusFlow';

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
        {app.replyBy && <Field label="Reply expected by">{formatDate(app.replyBy)}</Field>}
        {app.dueAt && <Field label="Your deadline">{formatDateTime(app.dueAt)}</Field>}
        {app.nextStep && <Field label="Next step">{app.nextStep}</Field>}
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

/** Local date-time for <input type="datetime-local">, e.g. 2026-11-09T10:30. */
const toLocalInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function RoundTimeModal({
  round,
  submitting,
  onClose,
  onSubmit,
}: {
  round: { status: ApplicationStatus } | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (interviewAt: Date) => void;
}) {
  const [value, setValue] = useState(() => toLocalInput(new Date()));
  return (
    <Modal
      opened={round !== null}
      onClose={onClose}
      title={round ? `When is the ${STATUS_LABELS[round.status].toLowerCase()}?` : ''}
      centered
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (value) onSubmit(new Date(value)); // parsed as local time
        }}
      >
        <Stack>
          <TextInput
            type="datetime-local"
            label="Date & time"
            description="Past or future. Future ones show as scheduled."
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!value}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
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
  const [pendingRound, setPendingRound] = useState<{
    status: ApplicationStatus;
  } | null>(null);

  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="application" />;

  // Interview-round stages are interviews: ask when it takes place before recording the step.
  const requestStatus = (status: ApplicationStatus) =>
    isRoundStatus(status)
      ? setPendingRound({ status })
      : changeStatus.mutate({ id: app.id, status });
  const steps = buildStatusFlow(app, Date.now());
  const lastDone = steps.reduce((last, s, i) => (s.scheduled ? last : i), -1);

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
            hasInterviews={app.interviews.length > 0}
            onChange={(status) => requestStatus(status)}
            w={200}
          />
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

      <Tabs defaultValue="details" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="details">Details</Tabs.Tab>
          <Tabs.Tab value="notes">
            Notes{app.interviewNotes.length > 0 ? ` (${app.interviewNotes.length})` : ''}
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="notes">
          <NotesTab applicationId={app.id} interviews={app.interviews} notes={app.interviewNotes} />
        </Tabs.Panel>
        <Tabs.Panel value="details">
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
                    <InterviewsSection
                      applicationId={app.id}
                      interviews={app.interviews}
                      notes={app.interviewNotes}
                    />
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
                  active={lastDone}
                  bulletSize={14}
                  lineWidth={2}
                  data-testid="status-timeline"
                >
                  {steps.map((step) => (
                    <Timeline.Item
                      key={step.key}
                      lineVariant={step.scheduled ? 'dashed' : 'solid'}
                      title={
                        step.scheduled ? (
                          <Text span fs="italic" c="dimmed" size="sm" fw={500}>
                            {step.title}
                          </Text>
                        ) : (
                          step.title
                        )
                      }
                      data-testid={step.scheduled ? 'upcoming-step' : undefined}
                    >
                      {step.scheduled && (
                        <Group gap={6}>
                          <Badge size="xs" variant="outline" color="gray">
                            Scheduled
                          </Badge>
                        </Group>
                      )}
                      <Text size="xs" c="dimmed" mt={step.scheduled ? 4 : 0}>
                        {formatDateMaybeTime(step.at)}
                      </Text>
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>

      <RoundTimeModal
        key={pendingRound?.status ?? 'none'}
        round={pendingRound}
        submitting={changeStatus.isPending}
        onClose={() => setPendingRound(null)}
        onSubmit={(interviewAt) => {
          if (!pendingRound) return;
          changeStatus.mutate(
            {
              id: app.id,
              status: pendingRound.status,
              interviewAt,
            },
            { onSuccess: () => setPendingRound(null) },
          );
        }}
      />

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
