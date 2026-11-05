import { Stack, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router';
import { useCreateApplication } from '../../api/hooks';
import { ApplicationForm, toCreatePayload } from './ApplicationForm';

export function NewApplicationPage() {
  const navigate = useNavigate();
  const create = useCreateApplication();

  return (
    <Stack maw={900}>
      <Title order={2}>New application</Title>
      <ApplicationForm
        mode="create"
        submitting={create.isPending}
        submitLabel="Save application"
        onCancel={() => navigate(-1)}
        onSubmit={(values) =>
          create.mutate(toCreatePayload(values), {
            onSuccess: (app) => navigate(`/applications/${app.id}`),
            onError: (err) =>
              notifications.show({ color: 'red', title: 'Could not save', message: err.message }),
          })
        }
      />
    </Stack>
  );
}
