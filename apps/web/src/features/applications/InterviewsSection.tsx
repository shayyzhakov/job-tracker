import {
  type ContactDto,
  hasEnded,
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPES,
  type InterviewDto,
  type InterviewType,
  type NoteDto,
} from '@job-tracker/shared';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconNotes, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useInterviewMutations } from '../../api/hooks';
import { formatDate, formatDateTime } from '../../lib/format';
import { NoteList } from './NoteList';

interface InterviewFormValues {
  type: InterviewType;
  /** Local date-time from <input type="datetime-local">, e.g. 2026-11-09T10:30. */
  scheduledAt: string;
  durationMinutes: number | string;
  location: string;
  /** Contact ids of the interviewers, in order. */
  interviewerIds: string[];
  /** What to do before this round. */
  nextStep: string;
  /** Local date-time values like scheduledAt; blank when unset. */
  replyBy: string;
  /** Home assignment only. */
  dueAt: string;
  submittedAt: string;
}

/** ISO instant -> value for <input type="datetime-local"> in the user's local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY: InterviewFormValues = {
  type: 'technical',
  scheduledAt: '',
  durationMinutes: 60,
  location: '',
  interviewerIds: [],
  nextStep: '',
  replyBy: '',
  dueAt: '',
  submittedAt: '',
};

const localOrBlank = (iso: string | null) => (iso ? toLocalInput(iso) : '');
const dateOrNull = (v: string) => (v ? new Date(v) : null); // parsed as local time

export function InterviewsSection({
  applicationId,
  interviews,
  contacts,
  notes,
}: {
  applicationId: string;
  interviews: InterviewDto[];
  /** The application's contacts: the people who can be picked as interviewers. */
  contacts: ContactDto[];
  notes: NoteDto[];
}) {
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { create, update, remove } = useInterviewMutations(applicationId);
  const form = useForm<InterviewFormValues>({
    mode: 'controlled',
    initialValues: EMPTY,
    validate: { scheduledAt: (v) => (v ? null : 'Required') },
  });
  const now = Date.now();
  const count = (interviewId: string) => notes.filter((n) => n.interviewId === interviewId).length;
  const notesInterview = interviews.find((i) => i.id === notesFor);
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));

  const close = () => {
    setAdding(false);
    setEditingId(null);
    form.reset();
  };

  const startEdit = (i: InterviewDto) => {
    setAdding(false);
    setEditingId(i.id);
    form.setValues({
      type: i.type,
      scheduledAt: toLocalInput(i.scheduledAt),
      durationMinutes: i.durationMinutes ?? '',
      location: i.location ?? '',
      interviewerIds: i.interviewerIds,
      nextStep: i.nextStep ?? '',
      replyBy: localOrBlank(i.replyBy),
      dueAt: localOrBlank(i.dueAt),
      submittedAt: localOrBlank(i.submittedAt),
    });
  };

  const submit = (v: InterviewFormValues) => {
    const assignment = v.type === 'home_assignment';
    const base = {
      type: v.type,
      scheduledAt: new Date(v.scheduledAt), // parsed as local time
      durationMinutes: typeof v.durationMinutes === 'number' ? v.durationMinutes : undefined,
      location: v.location || undefined,
      interviewerIds: v.interviewerIds,
      nextStep: v.nextStep.trim() || undefined,
    };
    const timeline = {
      replyBy: dateOrNull(v.replyBy),
      dueAt: assignment ? dateOrNull(v.dueAt) : null,
      submittedAt: assignment ? dateOrNull(v.submittedAt) : null,
    };
    if (editingId) {
      update.mutate(
        {
          id: editingId,
          patch: {
            ...base,
            durationMinutes: base.durationMinutes ?? null,
            location: base.location ?? null,
            nextStep: base.nextStep ?? null,
            ...timeline,
          },
        },
        { onSuccess: close },
      );
    } else {
      create.mutate(
        {
          ...base,
          replyBy: timeline.replyBy ?? undefined,
          dueAt: timeline.dueAt ?? undefined,
          submittedAt: timeline.submittedAt ?? undefined,
        },
        { onSuccess: close },
      );
    }
  };

  const isAssignment = form.values.type === 'home_assignment';
  const editing = interviews.find((i) => i.id === editingId);
  // Reply-by belongs after a round: offered once the round being edited is over.
  const showReplyBy = !!editing && hasEnded(editing, new Date(now));

  const formEl = (
    <form noValidate onSubmit={form.onSubmit(submit)}>
      <Stack gap="xs">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Interview type"
            allowDeselect={false}
            data={INTERVIEW_TYPES.map((t) => ({
              value: t,
              label: INTERVIEW_TYPE_LABELS[t],
            }))}
            {...form.getInputProps('type')}
          />
          <TextInput
            type="datetime-local"
            label={isAssignment ? 'Received' : 'Date & time'}
            withAsterisk
            {...form.getInputProps('scheduledAt')}
          />
          {isAssignment && (
            <TextInput
              type="datetime-local"
              label="Due by"
              description="Ranks it on Tasks until it is submitted."
              {...form.getInputProps('dueAt')}
            />
          )}
          {isAssignment && editingId && (
            <TextInput
              type="datetime-local"
              label="Submitted"
              description="The round ends when it is submitted."
              {...form.getInputProps('submittedAt')}
            />
          )}
          <NumberInput
            label="Duration (minutes)"
            min={5}
            step={15}
            {...form.getInputProps('durationMinutes')}
          />
          <TextInput
            label="Location / link"
            placeholder="Zoom, office…"
            {...form.getInputProps('location')}
          />
          {showReplyBy && (
            <TextInput
              type="datetime-local"
              label="They'll reply by"
              description="Replaces the default follow-up timer."
              {...form.getInputProps('replyBy')}
            />
          )}
        </SimpleGrid>
        {contacts.length > 0 && (
          <MultiSelect
            label="Interviewers"
            description="Pick from this application's contacts. Add a new person under Contacts first."
            placeholder={form.values.interviewerIds.length ? undefined : 'Who interviews?'}
            searchable
            data={contacts.map((c) => ({
              value: c.id,
              label: c.role ? `${c.name} (${c.role})` : c.name,
            }))}
            {...form.getInputProps('interviewerIds')}
          />
        )}
        <TextInput
          label="Next step"
          description="What to do before this round. Stops showing once the round is over."
          {...form.getInputProps('nextStep')}
        />
        <Group justify="flex-end">
          <Button variant="default" size="xs" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" size="xs" loading={create.isPending || update.isPending}>
            {editingId ? 'Save changes' : 'Save interview'}
          </Button>
        </Group>
      </Stack>
    </form>
  );

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Interviews</Text>
        {!adding && !editingId && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            Schedule interview
          </Button>
        )}
      </Group>
      <Stack>
        {interviews.length === 0 && !adding && (
          <Text size="sm" c="dimmed">
            No interviews scheduled.
          </Text>
        )}
        {interviews.map((i) => {
          if (editingId === i.id) return <div key={i.id}>{formEl}</div>;
          const assignment = i.type === 'home_assignment';
          const past = assignment
            ? hasEnded(i, new Date(now))
            : new Date(i.scheduledAt).getTime() < now;
          const ended = hasEnded(i, new Date(now));
          return (
            <Group key={i.id} justify="space-between" wrap="nowrap">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={600} c={past ? 'dimmed' : undefined}>
                    {formatDateTime(i.scheduledAt)}
                  </Text>
                  <Badge variant="outline" size="sm">
                    {INTERVIEW_TYPE_LABELS[i.type]}
                  </Badge>
                  {past ? (
                    <Badge color="gray" size="sm">
                      {assignment ? 'Submitted' : 'Past'}
                    </Badge>
                  ) : (
                    <Badge variant="outline" color="gray" size="sm">
                      {assignment ? 'To submit' : 'Scheduled'}
                    </Badge>
                  )}
                </Group>
                {i.interviewerIds.some((id) => contactName.has(id)) && (
                  <Text size="sm" c="dimmed">
                    With{' '}
                    {i.interviewerIds
                      .flatMap((id) => {
                        const name = contactName.get(id);
                        return name ? [name] : [];
                      })
                      .join(', ')}
                  </Text>
                )}
                {i.location && (
                  <Text size="sm" c="dimmed">
                    {i.location}
                  </Text>
                )}
                {assignment && i.dueAt && (
                  <Text size="sm" c={ended ? 'dimmed' : undefined}>
                    Due by {formatDateTime(i.dueAt)}
                  </Text>
                )}
                {i.nextStep && (
                  <Text size="sm" c={ended ? 'dimmed' : undefined}>
                    Next step: {i.nextStep}
                  </Text>
                )}
                {ended && i.replyBy && (
                  <Text size="sm" c="dimmed">
                    They'll reply by {formatDate(i.replyBy)}
                  </Text>
                )}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Button
                  variant="subtle"
                  size="compact-xs"
                  leftSection={<IconNotes size={14} />}
                  aria-label={`Notes for ${INTERVIEW_TYPE_LABELS[i.type]} interview`}
                  onClick={() => setNotesFor(i.id)}
                >
                  Notes{count(i.id) > 0 ? ` (${count(i.id)})` : ''}
                </Button>
                <ActionIcon
                  variant="subtle"
                  aria-label="Edit interview"
                  disabled={adding}
                  onClick={() => startEdit(i)}
                >
                  <IconPencil size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Delete interview"
                  onClick={() => remove.mutate(i.id)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Group>
          );
        })}
        {adding && formEl}
      </Stack>
      <Modal
        opened={!!notesInterview}
        onClose={() => setNotesFor(null)}
        title={
          notesInterview
            ? `${INTERVIEW_TYPE_LABELS[notesInterview.type]} interview · ${formatDateTime(notesInterview.scheduledAt)}`
            : 'Notes'
        }
        size="lg"
      >
        {notesInterview && (
          <NoteList
            applicationId={applicationId}
            interviewId={notesInterview.id}
            notes={notes.filter((n) => n.interviewId === notesInterview.id)}
            allowAdd
          />
        )}
      </Modal>
    </Card>
  );
}
