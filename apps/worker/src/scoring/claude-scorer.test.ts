import { DEFAULT_SCOUT_CRITERIA } from '@job-tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { RawListing } from '../types.js';
import { ClaudeScorer, type MessagesClient } from './claude-scorer.js';

const listing: RawListing = {
  url: 'https://x.com/1',
  title: 'Senior Backend Engineer',
  companyName: 'Acme',
  location: 'Tel Aviv',
  description: 'Node.js, Postgres, AWS.',
};

const parsed = {
  score: 87.6,
  summary: 'Backend role on the payments team.',
  reasons: ['Senior backend', 'Tel Aviv'],
  isManagement: false,
  seniority: 'senior',
  companySize: 'unicorn',
};

function fakeClient(response: Record<string, unknown>) {
  const parse = vi.fn(async (_request: Record<string, unknown>) => response);
  return { client: { messages: { parse } } as unknown as MessagesClient, parse };
}

describe('ClaudeScorer', () => {
  it('asks the configured model for a structured score and normalises it', async () => {
    const { client, parse } = fakeClient({ stop_reason: 'end_turn', parsed_output: parsed });
    const scorer = new ClaudeScorer({ client, model: 'claude-haiku-5-5' });

    const result = await scorer.score(listing, { ...DEFAULT_SCOUT_CRITERIA, roles: ['Backend'] });

    expect(result).toEqual({ ...parsed, score: 88 });
    const request = parse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: 'claude-haiku-5-5',
      output_config: { effort: 'low', format: expect.anything() },
    });
    const prompt = JSON.stringify(request);
    expect(prompt).toContain('Backend');
    expect(prompt).toContain('Node.js, Postgres, AWS.');
  });

  it('clamps scores into 0–100', async () => {
    const { client } = fakeClient({
      stop_reason: 'end_turn',
      parsed_output: { ...parsed, score: 140 },
    });
    const result = await new ClaudeScorer({ client }).score(listing, DEFAULT_SCOUT_CRITERIA);
    expect(result.score).toBe(100);
  });

  it('throws when the model refuses', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', parsed_output: null });
    await expect(
      new ClaudeScorer({ client }).score(listing, DEFAULT_SCOUT_CRITERIA),
    ).rejects.toThrow(/refus/i);
  });

  it('throws when there is no parsed output', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(
      new ClaudeScorer({ client }).score(listing, DEFAULT_SCOUT_CRITERIA),
    ).rejects.toThrow(/max_tokens/);
  });
});
