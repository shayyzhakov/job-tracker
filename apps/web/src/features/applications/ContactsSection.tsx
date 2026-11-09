import { type ContactDto, ContactInputSchema, ContactUpdateSchema } from '@job-tracker/shared';
import { ActionIcon, Anchor, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconBrandLinkedin,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useContactMutations, useContacts } from '../../api/hooks';
import { zodErrors } from '../../lib/zod-form';
import { ContactFields, type ContactFormValues, emptyContact } from './ContactFields';
import { SimilarContactBanner } from './SimilarContactBanner';

function EditContactForm({
  contact,
  applicationId,
  onDone,
}: {
  contact: ContactDto;
  applicationId: string;
  onDone: () => void;
}) {
  const { update } = useContactMutations(applicationId);
  const form = useForm<ContactFormValues>({
    mode: 'controlled',
    initialValues: {
      name: contact.name,
      role: contact.role ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      linkedinUrl: contact.linkedinUrl ?? '',
    },
    validate: (values) => zodErrors(ContactUpdateSchema, values),
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((values) =>
        update.mutate(
          { id: contact.id, patch: ContactUpdateSchema.parse(values) },
          { onSuccess: onDone },
        ),
      )}
    >
      <Stack gap="xs">
        {contact.applicationCount > 1 && (
          <Text size="xs" c="dimmed">
            Shared: changes apply to all {contact.applicationCount} applications this contact is on.
          </Text>
        )}
        <ContactFields form={form} prefix="" />
        <Group justify="flex-end">
          <Button variant="default" size="xs" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="xs" loading={update.isPending}>
            Save changes
          </Button>
        </Group>
      </Stack>
    </form>
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
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { create, remove } = useContactMutations(applicationId);
  const { data: known = [] } = useContacts();
  const attached = new Set(contacts.map((c) => c.id));
  const form = useForm<ContactFormValues>({
    mode: 'controlled',
    initialValues: emptyContact(),
    validate: (values) => zodErrors(ContactInputSchema, values),
  });

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Contacts</Text>
        {!adding && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setAdding(true)}
          >
            Add contact
          </Button>
        )}
      </Group>
      <Stack>
        {contacts.length === 0 && !adding && (
          <Text size="sm" c="dimmed">
            No contacts yet.
          </Text>
        )}
        {contacts.map((c) =>
          editingId === c.id ? (
            <EditContactForm
              key={c.id}
              contact={c}
              applicationId={applicationId}
              onDone={() => setEditingId(null)}
            />
          ) : (
            <ContactRow
              key={c.id}
              contact={c}
              onEdit={() => setEditingId(c.id)}
              onDelete={() => remove.mutate(c.id)}
            />
          ),
        )}
        {adding && (
          <form
            noValidate
            onSubmit={form.onSubmit((values) =>
              create.mutate(ContactInputSchema.parse(values), {
                onSuccess: () => {
                  form.reset();
                  setAdding(false);
                },
              }),
            )}
          >
            <Stack gap="xs">
              <ContactFields form={form} prefix="" />
              <SimilarContactBanner
                name={form.values.name}
                known={known}
                excludeIds={attached}
                onUse={(k) =>
                  create.mutate(
                    { contactId: k.id },
                    {
                      onSuccess: () => {
                        form.reset();
                        setAdding(false);
                      },
                    },
                  )
                }
              />
              <Group justify="flex-end">
                <Button variant="default" size="xs" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="xs" loading={create.isPending}>
                  Save contact
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Card>
  );
}
