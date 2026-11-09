import type { ContactDto } from '@job-tracker/shared';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Known contacts whose name equals the typed one (case-insensitive), or contains / is contained by it. */
export function similarContacts(name: string, known: ContactDto[], excludeIds: Set<string>) {
  const typed = norm(name);
  if (typed.length < 3) return [];
  return known
    .filter((k) => !excludeIds.has(k.id))
    .filter((k) => {
      const other = norm(k.name);
      return other === typed || other.includes(typed) || typed.includes(other);
    })
    .slice(0, 3);
}

/** Suggests reusing a known contact when the typed name looks like one already in the system. */
export function SimilarContactBanner({
  name,
  known,
  excludeIds,
  onUse,
}: {
  name: string;
  known: ContactDto[];
  excludeIds: Set<string>;
  onUse: (contact: ContactDto) => void;
}) {
  const matches = similarContacts(name, known, excludeIds);
  if (matches.length === 0) return null;
  return (
    <Alert color="blue" variant="light" title="Already in your contacts?">
      <Stack gap="xs">
        {matches.map((k) => (
          <Group key={k.id} justify="space-between" wrap="nowrap">
            <Text size="sm">
              {[k.name, k.role, k.email].filter(Boolean).join(' · ')}
              {k.applicationCount > 1 ? ` (on ${k.applicationCount} applications)` : ''}
            </Text>
            <Button size="compact-xs" variant="light" onClick={() => onUse(k)}>
              Use this contact
            </Button>
          </Group>
        ))}
      </Stack>
    </Alert>
  );
}
