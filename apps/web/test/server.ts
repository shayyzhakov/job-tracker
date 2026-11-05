import { HttpResponse, http } from 'msw/http';
import { setupServer } from 'msw/node';
import { application, applicationDetail, overview } from './fixtures';

/** Default happy-path handlers; tests override with server.use(...). */
export const handlers = [
  http.get('/api/v1/overview', () => HttpResponse.json(overview())),
  http.get('/api/v1/applications', () => HttpResponse.json([application()])),
  http.get('/api/v1/applications/:id', () => HttpResponse.json(applicationDetail())),
  http.get('/api/v1/companies', () => HttpResponse.json([])),
];

export const server = setupServer(...handlers);
