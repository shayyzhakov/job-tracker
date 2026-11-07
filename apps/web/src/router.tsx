import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { ApplicationDetailPage } from './features/applications/ApplicationDetailPage';
import { ApplicationsPage } from './features/applications/ApplicationsPage';
import { NewApplicationPage } from './features/applications/NewApplicationPage';
import { IntegrationsPage } from './features/integrations/IntegrationsPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { ScoutSettingsPage } from './features/scout/ScoutSettingsPage';
import { SuggestionsPage } from './features/suggestions/SuggestionsPage';
import { getRegisteredRoutes } from './lib/extensions';

/** Built after optional layers had a chance to register their routes (see main.tsx). */
export const createAppRouter = () =>
  createBrowserRouter([
    {
      path: '/',
      Component: Layout,
      children: [
        { index: true, Component: OverviewPage },
        { path: 'applications', Component: ApplicationsPage },
        { path: 'applications/new', Component: NewApplicationPage },
        { path: 'applications/:id', Component: ApplicationDetailPage },
        { path: 'suggestions', Component: SuggestionsPage },
        { path: 'integrations', Component: IntegrationsPage },
        { path: 'scout/settings', Component: ScoutSettingsPage },
        ...getRegisteredRoutes(),
      ],
    },
  ]);
