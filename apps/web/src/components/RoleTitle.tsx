import { Badge, Group, Text } from '@mantine/core';

/**
 * Role name with an M (management) / IC (individual contributor) badge.
 * The badge goes before the name by default; `badgeSide="right"` puts it after
 * the name, vertically centred (used for larger headings).
 */
export function RoleTitle({
  name,
  isManagement,
  badgeSide = 'left',
}: {
  name: string;
  isManagement: boolean;
  badgeSide?: 'left' | 'right';
}) {
  const right = badgeSide === 'right';
  const badge = (
    <Badge
      size="xs"
      variant="light"
      color={isManagement ? 'grape' : 'gray'}
      title={isManagement ? 'Management' : 'Individual contributor'}
      style={right ? { flexShrink: 0 } : { flexShrink: 0, marginTop: 2 }}
    >
      {isManagement ? 'M' : 'IC'}
    </Badge>
  );
  return (
    <Group gap={6} wrap="nowrap" align={right ? 'center' : 'flex-start'}>
      {!right && badge}
      <Text span inherit>
        {name}
      </Text>
      {right && badge}
    </Group>
  );
}
