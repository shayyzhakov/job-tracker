import type { NoteDto } from '@job-tracker/shared';
import { ActionIcon, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useNoteMutations } from '../../api/hooks';
import { formatDateTime } from '../../lib/format';

function NoteEditor({
  initial = '',
  submitLabel,
  loading,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  loading: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Stack gap="xs">
      <Textarea
        aria-label="Note"
        placeholder="Questions asked, what you learned, how it went…"
        autosize
        minRows={3}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        data-autofocus
      />
      <Group justify="flex-end">
        <Button variant="default" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="xs"
          loading={loading}
          disabled={text.trim() === ''}
          onClick={() => onSubmit(text)}
        >
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}

/** The notes of one interview, newest first, with edit and delete (with confirmation) in place. */
export function NoteList({
  applicationId,
  interviewId,
  notes,
  allowAdd = false,
}: {
  applicationId: string;
  interviewId: string;
  notes: NoteDto[];
  allowAdd?: boolean;
}) {
  const { create, update, remove } = useNoteMutations(applicationId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NoteDto | null>(null);

  return (
    <Stack gap="sm">
      {allowAdd &&
        (adding ? (
          <NoteEditor
            submitLabel="Add note"
            loading={create.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(text) =>
              create.mutate({ interviewId, text }, { onSuccess: () => setAdding(false) })
            }
          />
        ) : (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
            style={{ alignSelf: 'flex-start' }}
          >
            Add note
          </Button>
        ))}
      {allowAdd && notes.length === 0 && !adding && (
        <Text size="sm" c="dimmed">
          No notes yet.
        </Text>
      )}
      {notes.map((n) =>
        editingId === n.id ? (
          <NoteEditor
            key={n.id}
            initial={n.text}
            submitLabel="Save note"
            loading={update.isPending}
            onCancel={() => setEditingId(null)}
            onSubmit={(text) =>
              update.mutate(
                { interviewId, id: n.id, text },
                { onSuccess: () => setEditingId(null) },
              )
            }
          />
        ) : (
          <Group key={n.id} justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {n.text}
              </Text>
              <Text size="xs" c="dimmed">
                {formatDateTime(n.createdAt)}
                {n.updatedAt !== n.createdAt && ` · edited ${formatDateTime(n.updatedAt)}`}
              </Text>
            </Stack>
            <Group gap={4} wrap="nowrap">
              <ActionIcon
                variant="subtle"
                aria-label="Edit note"
                onClick={() => setEditingId(n.id)}
              >
                <IconPencil size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Delete note"
                onClick={() => setDeleting(n)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          </Group>
        ),
      )}
      <Modal opened={!!deleting} onClose={() => setDeleting(null)} title="Delete note?" centered>
        <Text mb="md">This permanently deletes the note.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            loading={remove.isPending}
            onClick={() =>
              deleting &&
              remove.mutate(
                { interviewId: deleting.interviewId, id: deleting.id },
                { onSuccess: () => setDeleting(null) },
              )
            }
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
