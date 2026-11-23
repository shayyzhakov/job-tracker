import type { NoteDto } from '@job-tracker/shared';
import { ActionIcon, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useNoteMutations } from '../../api/hooks';
import { FormModal } from '../../components/FormModal';
import { formatDateTime } from '../../lib/format';

/** Add a note (note === null) or edit one, in a dialog. */
function NoteFormModal({
  opened,
  note,
  loading,
  onSubmit,
  onClose,
}: {
  opened: boolean;
  note: NoteDto | null;
  loading: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  // Start from the note's text (or blank) every time the dialog opens.
  useEffect(() => {
    if (opened) setText(note?.text ?? '');
  }, [opened, note]);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={note ? 'Edit note' : 'Add note'}
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSubmit(text);
      }}
      submitLabel="Save note"
      submitting={loading}
      submitDisabled={text.trim() === ''}
    >
      <Textarea
        aria-label="Note"
        placeholder="Questions asked, what you learned, how it went…"
        autosize
        minRows={4}
        value={text}
        onChange={(e) => setText(e.currentTarget.value)}
        data-autofocus
      />
    </FormModal>
  );
}

/**
 * The notes of one interview, newest first. Adding and editing open a dialog; deleting asks for
 * confirmation.
 */
export function NoteList({
  applicationId,
  interviewId,
  notes,
  allowAdd = false,
  onDialogOpenChange,
}: {
  applicationId: string;
  interviewId: string;
  notes: NoteDto[];
  allowAdd?: boolean;
  /** Told when a note dialog (form or delete) opens or closes, so a dialog around this list can stay open. */
  onDialogOpenChange?: (open: boolean) => void;
}) {
  const { create, update, remove } = useNoteMutations(applicationId);
  // The note dialog: `editing` is the note being edited, or null when adding. It is kept while the
  // dialog closes so the title does not change during the transition.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NoteDto | null>(null);
  const [deleting, setDeleting] = useState<NoteDto | null>(null);
  const openForm = (note: NoteDto | null) => {
    setEditing(note);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);
  const dialogOpen = formOpen || deleting !== null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: report changes of dialogOpen only
  useEffect(() => onDialogOpenChange?.(dialogOpen), [dialogOpen]);

  return (
    <Stack gap="sm">
      {allowAdd && (
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => openForm(null)}
          style={{ alignSelf: 'flex-start' }}
        >
          Add note
        </Button>
      )}
      {allowAdd && notes.length === 0 && (
        <Text size="sm" c="dimmed">
          No notes yet.
        </Text>
      )}
      {notes.map((n) => (
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
            <ActionIcon variant="subtle" aria-label="Edit note" onClick={() => openForm(n)}>
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
      ))}
      <NoteFormModal
        opened={formOpen}
        note={editing}
        loading={create.isPending || update.isPending}
        onClose={closeForm}
        onSubmit={(text) =>
          editing
            ? update.mutate({ interviewId, id: editing.id, text }, { onSuccess: closeForm })
            : create.mutate({ interviewId, text }, { onSuccess: closeForm })
        }
      />
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
