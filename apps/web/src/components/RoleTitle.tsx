import { Badge, Group, Text } from '@mantine/core';

/** Role name prefixed with an M (management) / IC (individual contributor) badge. */
export function RoleTitle({ name, isManagement }: { name: string; isManagement: boolean }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Badge
        size="xs"
        variant="light"
        color={isManagement ? 'grape' : 'gray'}
        title={isManagement ? 'Management' : 'Individual contributor'}
        style={{ flexShrink: 0 }}
      >
        {isManagement ? 'M' : 'IC'}
      </Badge>
      <Text span inherit>
        {name}
      </Text>
    </Group>
  );
}
