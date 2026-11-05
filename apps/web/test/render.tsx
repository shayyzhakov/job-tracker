import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { theme } from '../src/theme';

/** Renders `element` at `path` (matched against `route`) with all app providers. */
export function renderRoute(
  element: ReactElement,
  { path = '/', route = path }: { path?: string; route?: string } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: route, element },
      { path: '*', element: <div data-testid="location-probe" /> },
    ],
    { initialEntries: [path] },
  );
  const user = userEvent.setup();
  const utils = render(
    <MantineProvider theme={theme} env="test">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
  return { ...utils, user, router };
}
