import type { ApplicationDetailDto } from '@job-tracker/shared';
import type { App } from '../src/app.js';

export async function createApplication(
  app: App,
  overrides: Record<string, unknown> = {},
): Promise<ApplicationDetailDto> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/applications',
    payload: {
      company: { name: 'Acme' },
      roleName: 'Engineer',
      status: 'applied',
      ...overrides,
    },
  });
  if (res.statusCode !== 201) throw new Error(`createApplication failed: ${res.body}`);
  return res.json();
}
