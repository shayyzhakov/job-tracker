import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/notifications/styles.css';
import './styles.css';

import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthGate } from './auth/AuthGate';
import { readAuthConfig } from './auth/config';
import { registerGamification } from './features/gamification';
import { createAppRouter } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } },
});

// Optional side layers plug in here. Remove this line (and the import) to unplug gamification.
registerGamification();
const router = createAppRouter();

const authConfig = readAuthConfig(import.meta.env, window.location.origin);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      {/* Israeli calendar: weeks start Sunday, weekend is Friday–Saturday. */}
      <DatesProvider settings={{ firstDayOfWeek: 0, weekendDays: [5, 6] }}>
        <Notifications />
        <AuthGate config={authConfig}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </AuthGate>
      </DatesProvider>
    </MantineProvider>
  </StrictMode>,
);
