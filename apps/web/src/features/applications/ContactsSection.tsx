import { type ContactDto, ContactInputSchema, ContactUpdateSchema } from '@job-tracker/shared';
import { ActionIcon, Alert, Anchor, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconBrandLinkedin,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useContactMutations, useContacts } from '../../api/hooks';
import { FormModal } from '../../components/FormModal';
import { zodErrors } from '../../lib/zod-form';
import { ContactFields, type ContactFormValues, emptyContact } from './ContactFields';
import { SimilarContactBanner } from './SimilarContactBanner';

/** Add a contact to the application (contact === null) or edit one, in a dialog. */
function ContactFormModal({
  opened,
  contact,
  applicationId,
  attached,
  onClose,
}: {
  opened: boolean;
  contact: ContactDto | null;
  applicationId: string;
  /** Ids already on the application, left out of the similar-contact suggestions. */
  attached: Set<string>;
  onClose: () => void;
}) {
  const { create, update } = useContactMutations(applicationId);
  const { data: known = [] } = useContacts();
  const schema = contact ? ContactUpdateSchema : ContactInputSchema;
  const form = useForm<ContactFormValues>({
    mode: 'controlled',
    initialValues: emptyContact(),
    validate: (values) => zodErrors(schema, values),
  });
  const { setValues, resetDirty, clearErrors } = form;

  // Reset every time the dialog opens, for a different contact or a blank one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: form and mutation helpers are stable
  useEffect(() => {
    if (!opened) return;
    const values: ContactFormValues = contact
      ? {
          name: contact.name,
          role: contact.role ?? '',
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          linkedinUrl: contact.linkedinUrl ?? '',
        }
      : emptyContact();
    setValues(values);
    resetDirty(values);
    clearErrors();
    create.reset();
    update.reset();
  }, [opened, contact]);

  const submit = form.onSubmit((values) =>
    contact
      ? update.mutate(
          { id: contact.id, patch: ContactUpdateSchema.parse(values) },
          { onSuccess: onClose },
        )
      : create.mutate(ContactInputSchema.parse(values), { onSuccess: onClose }),
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={contact ? 'Edit contact' : 'Add contact'}
      onSubmit={submit}
      submitLabel={contact ? 'Save changes' : 'Save contact'}
      submitting={create.isPending || update.isPending}
      error={(create.error ?? update.error)?.message}
    >
      {contact && contact.applicationCount > 1 && (
        <Alert variant="light" color="blue" role="status">
          Shared: changes apply to all {contact.applicationCount} applications this contact is on.
        </Alert>
      )}
      <ContactFields form={form} prefix="" autofocus />
      {!contact && (
        <SimilarContactBanner
          name={form.values.name}
          known={known}
          excludeIds={attached}
          onUse={(k) => create.mutate({ contactId: k.id }, { onSuccess: onClose })}
        />
      )}
    </FormModal>
  );
}

function ContactRow({
  contact,
  onEdit,
  onDelete,
}: {
  contact: ContactDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Group gap="xs">
          <Text fw={600}>{contact.name}</Text>
          {contact.applicationCount > 1 && (
            <Button
              component={Link}
              to={`/contacts/${contact.id}`}
              variant="light"
              size="compact-xs"
            >
              On {contact.applicationCount} applications
            </Button>
          )}
        </Group>
        {contact.role && (
          <Text size="sm" c="dimmed">
            {contact.role}
          </Text>
        )}
        <Group gap="md">
          {contact.email && (
            <Group gap={4}>
              <IconMail size={14} />
              <Anchor size="sm" href={`mailto:${contact.email}`}>
                {contact.email}
              </Anchor>
            </Group>
          )}
          {contact.phone && (
            <Group gap={4}>
              <IconPhone size={14} />
              <Anchor size="sm" href={`tel:${contact.phone}`}>
                {contact.phone}
              </Anchor>
            </Group>
          )}
          {contact.linkedinUrl && (
            <Group gap={4}>
              <IconBrandLinkedin size={14} />
              <Anchor
                size="sm"
                href={contact.linkedinUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                LinkedIn
              </Anchor>
            </Group>
          )}
        </Group>
      </Stack>
      <Group gap={4} wrap="nowrap">
        <ActionIcon variant="subtle" aria-label={`Edit contact ${contact.name}`} onClick={onEdit}>
          <IconPencil size={16} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={`Delete contact ${contact.name}`}
          onClick={onDelete}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

export function ContactsSection({
  applicationId,
  contacts,
}: {
  applicationId: string;
  contacts: ContactDto[];
}) {
  // The form dialog: `editing` is the contact being edited, or null when adding one. It is kept
  // while the dialog closes so the title does not change during the transition.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactDto | null>(null);
  const { remove } = useContactMutations(applicationId);
  const attached = new Set(contacts.map((c) => c.id));
  const open = (contact: ContactDto | null) => {
    setEditing(contact);
    setFormOpen(true);
  };

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Contacts</Text>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => open(null)}
        >
          Add contact
        </Button>
      </Group>
      <Stack>
        {contacts.length === 0 && (
          <Text size="sm" c="dimmed">
            No contacts yet.
          </Text>
        )}
        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            onEdit={() => open(c)}
            onDelete={() => remove.mutate(c.id)}
          />
        ))}
      </Stack>
      <ContactFormModal
        opened={formOpen}
        contact={editing}
        applicationId={applicationId}
        attached={attached}
        onClose={() => setFormOpen(false)}
      />
    </Card>
  );
}
