import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { ApplicationDetailPage } from './features/applications/ApplicationDetailPage';
import { ApplicationsPage } from './features/applications/ApplicationsPage';
import { ContactApplicationsPage } from './features/applications/ContactApplicationsPage';
import { NewApplicationPage } from './features/applications/NewApplicationPage';
import { TimelinePage } from './features/applications/TimelinePage';
import { CompaniesPage } from './features/companies/CompaniesPage';
import { IntegrationsPage } from './features/integrations/IntegrationsPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { ScoutCompaniesPage } from './features/scout/ScoutCompaniesPage';
import { ScoutSettingsPage } from './features/scout/ScoutSettingsPage';
import { SuggestionsPage } from './features/suggestions/SuggestionsPage';
import { TodayPage } from './features/today/TodayPage';
import { getRegisteredRoutes } from './lib/extensions';

/** Built after optional layers had a chance to register their routes (see main.tsx). */
export const createAppRouter = () =>
  createBrowserRouter([
    {
      path: '/',
      Component: Layout,
      children: [
        { index: true, Component: OverviewPage },
        { path: 'overview', element: <Navigate to="/" replace /> },
        { path: 'tasks', Component: TodayPage },
        { path: 'applications', Component: ApplicationsPage },
        { path: 'applications/timeline', Component: TimelinePage },
        { path: 'applications/new', Component: NewApplicationPage },
        { path: 'applications/:id', Component: ApplicationDetailPage },
        { path: 'contacts/:id', Component: ContactApplicationsPage },
        { path: 'companies', Component: CompaniesPage },
        { path: 'suggestions', Component: SuggestionsPage },
        { path: 'integrations', Component: IntegrationsPage },
        { path: 'scout/settings', Component: ScoutSettingsPage },
        { path: 'scout/companies', Component: ScoutCompaniesPage },
        ...getRegisteredRoutes(),
      ],
    },
  ]);
