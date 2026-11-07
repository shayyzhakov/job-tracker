import { Button, Card, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { useGamificationEnabled } from './enabled';

/** Route pages stay mounted at startup; when the layer is off they show a way back in. */
export function Gate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useGamificationEnabled();
  if (enabled) return <>{children}</>;
  return (
    <Card withBorder padding="xl">
      <Stack align="center" gap="xs">
        <Text c="dimmed">Gamification is switched off.</Text>
        <Button onClick={() => setEnabled(true)}>Turn it on</Button>
      </Stack>
    </Card>
  );
}
