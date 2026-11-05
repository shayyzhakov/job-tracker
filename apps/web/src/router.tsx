import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { ApplicationDetailPage } from './features/applications/ApplicationDetailPage';
import { ApplicationsPage } from './features/applications/ApplicationsPage';
import { NewApplicationPage } from './features/applications/NewApplicationPage';
import { OverviewPage } from './features/overview/OverviewPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: OverviewPage },
      { path: 'applications', Component: ApplicationsPage },
      { path: 'applications/new', Component: NewApplicationPage },
      { path: 'applications/:id', Component: ApplicationDetailPage },
    ],
  },
]);
