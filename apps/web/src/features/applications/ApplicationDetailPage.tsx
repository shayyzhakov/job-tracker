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
import { FormModal } from '../../components/FormModal';
import { LinkifiedText } from '../../components/LinkifiedText';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';
import { StatusSelect } from '../../components/StatusSelect';
import { Slot } from '../../lib/extensions';
import { formatDate, formatDateMaybeTime, formatIls } from '../../lib/format';
import { ApplicationForm, toUpdatePayload, valuesFromApplication } from './ApplicationForm';
import { ContactsSection } from './ContactsSection';
import { CurrentStep } from './CurrentStep';
import { DebriefBanner } from './DebriefBanner';
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
          <LinkifiedText text={app.methodDetails} />
        </Stack>
      )}
      {app.notes && (
        <Stack gap={0} mt="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Notes
          </Text>
          <LinkifiedText text={app.notes} />
        </Stack>
      )}
    </Card>
  );
}

/** Local date-time for <input type="datetime-local">, e.g. 2026-11-09T10:30. */
const toLocalInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export interface RoundTimeline {
  interviewAt: Date;
  nextStep?: string;
  dueAt?: Date;
}

function RoundTimeModal({
  round,
  submitting,
  onClose,
  onSubmit,
}: {
  round: { status: ApplicationStatus } | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (timeline: RoundTimeline) => void;
}) {
  const [value, setValue] = useState(() => toLocalInput(new Date()));
  const [nextStep, setNextStep] = useState('');
  const [dueAt, setDueAt] = useState('');
  const assignment = round?.status === 'home_assignment';
  return (
    <FormModal
      opened={round !== null}
      onClose={onClose}
      title={
        round
          ? assignment
            ? 'When did you get the home assignment?'
            : `When is the ${STATUS_LABELS[round.status].toLowerCase()}?`
          : ''
      }
      size="md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value) return;
        onSubmit({
          interviewAt: new Date(value), // parsed as local time
          nextStep: nextStep.trim() || undefined,
          dueAt: assignment && dueAt ? new Date(dueAt) : undefined,
        });
      }}
      submitLabel="Save"
      submitting={submitting}
      submitDisabled={!value}
    >
      <TextInput
        type="datetime-local"
        label={assignment ? 'Received' : 'Date & time'}
        description={assignment ? undefined : 'Past or future. Future ones show as scheduled.'}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        required
        data-autofocus
      />
      {assignment && (
        <TextInput
          type="datetime-local"
          label="Due by"
          description="Ranks it on Tasks until you mark it submitted."
          value={dueAt}
          onChange={(e) => setDueAt(e.currentTarget.value)}
        />
      )}
      <TextInput
        label="Next step"
        description="What to do before this round. Stops showing once the round is over."
        value={nextStep}
        onChange={(e) => setNextStep(e.currentTarget.value)}
      />
    </FormModal>
  );
}

function OfferModal({
  opened,
  submitting,
  onClose,
  onSubmit,
}: {
  opened: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (offerExpiresAt: Date | undefined) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="When does the offer expire?"
      size="md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value ? new Date(value) : undefined); // parsed as local time
      }}
      submitLabel="Save"
      submitting={submitting}
    >
      <TextInput
        type="datetime-local"
        label="Offer expires"
        description="Optional. Ranks the offer on Tasks."
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        data-autofocus
      />
    </FormModal>
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
  const [offerOpen, offer] = useDisclosure(false);

  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="application" />;

  // Interview-round stages are interviews: ask when it takes place before recording the step.
  // An offer asks for its expiry.
  const requestStatus = (status: ApplicationStatus) => {
    if (isRoundStatus(status)) setPendingRound({ status });
    else if (status === 'offer') offer.open();
    else changeStatus.mutate({ id: app.id, status });
  };
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

      <DebriefBanner app={app} />

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
                  <>
                    <CurrentStep app={app} />
                    <Details app={app} />
                  </>
                )}
                {!editing && (
                  <>
                    <InterviewsSection
                      applicationId={app.id}
                      interviews={app.interviews}
                      contacts={app.contacts}
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
        onSubmit={(timeline) => {
          if (!pendingRound) return;
          changeStatus.mutate(
            { id: app.id, status: pendingRound.status, ...timeline },
            { onSuccess: () => setPendingRound(null) },
          );
        }}
      />

      <OfferModal
        key={offerOpen ? 'open' : 'closed'}
        opened={offerOpen}
        submitting={changeStatus.isPending}
        onClose={offer.close}
        onSubmit={(offerExpiresAt) =>
          changeStatus.mutate(
            { id: app.id, status: 'offer', offerExpiresAt },
            { onSuccess: offer.close },
          )
        }
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
