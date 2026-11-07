import { type ContactDto, ContactInputSchema } from '@job-tracker/shared';
import { ActionIcon, Anchor, Button, Card, Group, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBrandLinkedin, IconMail, IconPhone, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { useContactMutations } from '../../api/hooks';
import { zodErrors } from '../../lib/zod-form';
import { ContactFields, type ContactFormValues, emptyContact } from './ContactFields';

function ContactRow({ contact, onDelete }: { contact: ContactDto; onDelete: () => void }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text fw={600}>{contact.name}</Text>
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
      <ActionIcon
        variant="subtle"
        color="red"
        aria-label={`Delete contact ${contact.name}`}
        onClick={onDelete}
      >
        <IconTrash size={16} />
      </ActionIcon>
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
  const { create, remove } = useContactMutations(applicationId);
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
        {contacts.map((c) => (
          <ContactRow key={c.id} contact={c} onDelete={() => remove.mutate(c.id)} />
        ))}
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
