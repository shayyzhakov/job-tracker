import { Alert, Center, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { ApiError } from '../api/client';

export function PageLoader() {
  return (
    <Center py="xl">
      <Loader />
    </Center>
  );
}

export function ErrorAlert({ error, what }: { error: unknown; what: string }) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <Alert color="red" icon={<IconAlertCircle />} title={notFound ? 'Not found' : 'Error'}>
      {notFound ? `This ${what} was not found.` : `Could not load ${what}. Is the API running?`}
    </Alert>
  );
}
