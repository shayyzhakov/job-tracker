import {
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
import { formatDateTime } from '../../lib/format';
import { NoteList } from './NoteList';

interface InterviewFormValues {
  type: InterviewType;
  /** Local date-time from <input type="datetime-local">, e.g. 2026-11-09T10:30. */
  scheduledAt: string;
  durationMinutes: number | string;
  location: string;
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
};

export function InterviewsSection({
  applicationId,
  interviews,
  notes,
}: {
  applicationId: string;
  interviews: InterviewDto[];
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
    });
  };

  const submit = (v: InterviewFormValues) => {
    const base = {
      type: v.type,
      scheduledAt: new Date(v.scheduledAt), // parsed as local time
      durationMinutes: typeof v.durationMinutes === 'number' ? v.durationMinutes : undefined,
      location: v.location || undefined,
    };
    if (editingId) {
      update.mutate(
        {
          id: editingId,
          patch: {
            ...base,
            durationMinutes: base.durationMinutes ?? null,
            location: base.location ?? null,
          },
        },
        { onSuccess: close },
      );
    } else {
      create.mutate(base, { onSuccess: close });
    }
  };

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
            label="Date & time"
            withAsterisk
            {...form.getInputProps('scheduledAt')}
          />
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
        </SimpleGrid>
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
          const past = new Date(i.scheduledAt).getTime() < now;
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
                      Past
                    </Badge>
                  ) : (
                    <Badge variant="outline" color="gray" size="sm">
                      Scheduled
                    </Badge>
                  )}
                </Group>
                {i.location && (
                  <Text size="sm" c="dimmed">
                    {i.location}
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
