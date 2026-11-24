import { Alert, Button, Group, Modal, type ModalProps, Stack } from '@mantine/core';
import type { FormEventHandler, ReactNode } from 'react';

/**
 * The one dialog for adding or editing a sub-entity (interview, contact, note, company, status
 * details). Forms never open inline in a list or card, so the page behind does not shift: see the
 * "Forms" UX standard in docs/ARCHITECTURE.md.
 *
 * The body is a form with Cancel and a primary submit button at the bottom right. Put
 * `data-autofocus` on the first field so it gets focus when the dialog opens.
 */
export function FormModal({
  opened,
  onClose,
  title,
  onSubmit,
  submitLabel,
  submitting = false,
  submitDisabled = false,
  error,
  size = 'lg',
  closeOnEscape,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  /** Shown above the buttons, e.g. a failed save. */
  error?: string | null;
  size?: ModalProps['size'];
  closeOnEscape?: boolean;
  children: ReactNode;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={size}
      centered
      closeOnEscape={closeOnEscape}
    >
      <form noValidate onSubmit={onSubmit}>
        <Stack>
          {children}
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
