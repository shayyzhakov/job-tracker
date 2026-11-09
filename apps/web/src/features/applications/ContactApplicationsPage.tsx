import { Anchor, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconBrandLinkedin, IconMail, IconPhone } from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { useContact } from '../../api/hooks';
import { ErrorAlert, PageLoader } from '../../components/QueryState';
import { StatusBadge } from '../../components/StatusBadge';

/** One contact (for example a headhunter) and every application they are attached to. */
export function ContactApplicationsPage() {
  const { id = '' } = useParams();
  const { data: contact, isPending, error } = useContact(id);
  if (isPending) return <PageLoader />;
  if (error) return <ErrorAlert error={error} what="contact" />;

  const details: { key: string; node: React.ReactNode }[] = [
    ...(contact.role ? [{ key: 'role', node: <Text c="dimmed">{contact.role}</Text> }] : []),
    ...(contact.email
      ? [
          {
            key: 'email',
            node: (
              <Group gap={4}>
                <IconMail size={14} />
                <Anchor size="sm" href={`mailto:${contact.email}`}>
                  {contact.email}
                </Anchor>
              </Group>
            ),
          },
        ]
      : []),
    ...(contact.phone
      ? [
          {
            key: 'phone',
            node: (
              <Group gap={4}>
                <IconPhone size={14} />
                <Anchor size="sm" href={`tel:${contact.phone}`}>
                  {contact.phone}
                </Anchor>
              </Group>
            ),
          },
        ]
      : []),
    ...(contact.linkedinUrl
      ? [
          {
            key: 'linkedin',
            node: (
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
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      <Anchor component={Link} to="/applications" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} /> All applications
        </Group>
      </Anchor>
      <Stack gap={4}>
        <Title order={2}>{contact.name}</Title>
        <Group gap="xs" data-testid="contact-details">
          {details.map((d, i) => (
            <Group key={d.key} gap="xs">
              {i > 0 && (
                <Text c="dimmed" aria-hidden>
                  ·
                </Text>
              )}
              {d.node}
            </Group>
          ))}
        </Group>
      </Stack>
      <Card withBorder padding="lg">
        <Text fw={600} mb="sm">
          Applications ({contact.applications.length})
        </Text>
        <Stack gap="xs">
          {contact.applications.map((a) => (
            <Group key={a.id} justify="space-between">
              <Anchor component={Link} to={`/applications/${a.id}`}>
                {a.roleName} · {a.companyName}
              </Anchor>
              <StatusBadge status={a.status} />
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
