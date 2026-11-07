import {
  INTERVIEW_TYPE_LABELS,
  INTERVIEW_TYPES,
  type InterviewDto,
  type InterviewType,
} from '@job-tracker/shared';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useInterviewMutations } from '../../api/hooks';
import { formatDateTime } from '../../lib/format';

interface InterviewFormValues {
  type: InterviewType;
  /** Local date-time from <input type="datetime-local">, e.g. 2026-11-09T10:30. */
  scheduledAt: string;
  durationMinutes: number | string;
  location: string;
  notes: string;
}

export function InterviewsSection({
  applicationId,
  interviews,
}: {
  applicationId: string;
  interviews: InterviewDto[];
}) {
  const [adding, setAdding] = useState(false);
  const { create, remove } = useInterviewMutations(applicationId);
  const form = useForm<InterviewFormValues>({
    mode: 'controlled',
    initialValues: {
      type: 'technical',
      scheduledAt: '',
      durationMinutes: 60,
      location: '',
      notes: '',
    },
    validate: { scheduledAt: (v) => (v ? null : 'Required') },
  });
  const now = Date.now();

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Interviews</Text>
        {!adding && (
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
                {(i.location || i.notes) && (
                  <Text size="sm" c="dimmed">
                    {[i.location, i.notes].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </Stack>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Delete interview"
                onClick={() => remove.mutate(i.id)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          );
        })}
        {adding && (
          <form
            noValidate
            onSubmit={form.onSubmit((v) =>
              create.mutate(
                {
                  type: v.type,
                  scheduledAt: new Date(v.scheduledAt), // parsed as local time
                  durationMinutes:
                    typeof v.durationMinutes === 'number' ? v.durationMinutes : undefined,
                  location: v.location || undefined,
                  notes: v.notes || undefined,
                },
                {
                  onSuccess: () => {
                    form.reset();
                    setAdding(false);
                  },
                },
              ),
            )}
          >
            <Stack gap="xs">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Interview type"
                  allowDeselect={false}
                  data={INTERVIEW_TYPES.map((t) => ({ value: t, label: INTERVIEW_TYPE_LABELS[t] }))}
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
              <TextInput label="Interview notes" {...form.getInputProps('notes')} />
              <Group justify="flex-end">
                <Button variant="default" size="xs" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="xs" loading={create.isPending}>
                  Save interview
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Card>
  );
}
