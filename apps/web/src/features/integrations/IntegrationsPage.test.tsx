import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '../../../test/render';
import { IntegrationsPage } from './IntegrationsPage';
import { mcpUrl } from './mcp-url';

describe('mcpUrl', () => {
  it('points at the API port in dev and the same origin in production', () => {
    expect(mcpUrl('http://localhost:5173', true)).toBe('http://localhost:3000/mcp');
    expect(mcpUrl('https://jobs.example.com', false)).toBe('https://jobs.example.com/mcp');
  });
});

describe('IntegrationsPage', () => {
  it('shows the server URL and connection commands', async () => {
    renderRoute(<IntegrationsPage />, { path: '/integrations' });
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByLabelText('server URL')).toHaveTextContent('/mcp');
    expect(screen.getByLabelText('Claude Code command')).toHaveTextContent(
      'claude mcp add --transport http job-tracker',
    );
    expect(screen.getByText('promote_suggestion')).toBeInTheDocument();
  });

  it('explains the OAuth sign-in instead of showing a token', async () => {
    renderRoute(<IntegrationsPage />, { path: '/integrations' });
    expect(screen.queryByRole('button', { name: 'Reveal token' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('MCP token')).not.toBeInTheDocument();
    expect(screen.getByText(/no token to copy|Locally the endpoint/)).toBeInTheDocument();
  });
});
