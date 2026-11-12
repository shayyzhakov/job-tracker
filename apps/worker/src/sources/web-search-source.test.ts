import { DEFAULT_SCOUT_CRITERIA } from '@job-tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { type MessagesClient, WebSearchSource } from './web-search-source.js';

const criteria = {
  ...DEFAULT_SCOUT_CRITERIA,
  roles: ['Backend'],
};

const companies = [
  { name: 'Wix', priority: 'top' as const },
  { name: 'Evil Corp', priority: 'blacklist' as const },
];

const found = {
  url: ' https://acme.com/jobs/1 ',
  title: 'Senior Backend Engineer',
  companyName: 'Acme',
  location: 'Tel Aviv',
  description: 'Node.js, Postgres.',
  postedAt: '2026-11-05',
};

const usage = { input_tokens: 100, output_tokens: 50, server_tool_use: { web_search_requests: 3 } };
const done = (listings: unknown[]) => ({
  stop_reason: 'end_turn',
  content: [],
  usage,
  parsed_output: { listings },
});
const paused = (marker: string) => ({
  stop_reason: 'pause_turn',
  content: [{ type: 'text', text: marker }],
  usage,
  parsed_output: null,
});

function fakeClient(...responses: Record<string, unknown>[]) {
  const queue = [...responses];
  const parse = vi.fn(async (_request: Record<string, unknown>, _options?: unknown) => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected extra request');
    return next;
  });
  return { client: { messages: { parse } } as unknown as MessagesClient, parse };
}

describe('WebSearchSource', () => {
  it('asks for listings with the web tools and returns them trimmed', async () => {
    const { client, parse } = fakeClient(done([found]));
    const source = new WebSearchSource({ client, model: 'claude-sonnet-5-5', maxSearches: 7 });

    const listings = await source.fetchListings({ criteria, companies });

    expect(listings).toEqual([{ ...found, url: 'https://acme.com/jobs/1' }]);
    const request = parse.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      model: 'claude-sonnet-5-5',
      output_config: { format: expect.anything() },
      tools: [
        { type: 'web_search_20260209', max_uses: 7, blocked_domains: ['linkedin.com'] },
        { type: 'web_fetch_20260209', blocked_domains: ['linkedin.com'] },
      ],
    });
    const prompt = JSON.stringify(request?.messages);
    expect(prompt).toContain('Backend');
    expect(prompt).toContain('search these first): Wix');
    expect(prompt).toContain('never return): Evil Corp');
  });

  it('drops rows missing a url, title or company', async () => {
    const { client } = fakeClient(
      done([
        found,
        { ...found, url: '  ' },
        { ...found, title: '' },
        { ...found, companyName: '' },
      ]),
    );
    const listings = await new WebSearchSource({ client }).fetchListings({ criteria, companies });
    expect(listings).toHaveLength(1);
  });

  it('continues after pause_turn by sending the paused content back', async () => {
    const { client, parse } = fakeClient(paused('searching...'), done([found]));
    const listings = await new WebSearchSource({ client }).fetchListings({ criteria, companies });

    expect(listings).toHaveLength(1);
    expect(parse).toHaveBeenCalledTimes(2);
    const second = parse.mock.calls[1]?.[0] as { messages: { role: string; content: unknown }[] };
    expect(second.messages.at(-1)).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'searching...' }],
    });
  });

  it('asks the agent to wrap up once the deadline has passed', async () => {
    let clock = 0;
    const { client, parse } = fakeClient(paused('a'), done([found]));
    // Each model request "takes" two minutes.
    parse.mockImplementationOnce(async () => {
      clock += 120_000;
      return paused('a');
    });
    const source = new WebSearchSource({ client, deadlineMs: 60_000, now: () => clock });

    await source.fetchListings({ criteria, companies });

    const second = parse.mock.calls[1]?.[0] as { messages: { content: unknown }[] };
    expect(JSON.stringify(second.messages.at(-1))).toContain('Time is up');
  });

  it('gives up when the model keeps pausing past the request cap', async () => {
    const { client, parse } = fakeClient(paused('1'), paused('2'), paused('3'));
    await expect(
      new WebSearchSource({ client, maxTurns: 3 }).fetchListings({ criteria, companies }),
    ).rejects.toThrow(/did not finish/);
    expect(parse).toHaveBeenCalledTimes(3);
  });

  it('throws when the model refuses or returns no structured output', async () => {
    const refused = fakeClient({ stop_reason: 'refusal', content: [], usage, parsed_output: null });
    await expect(
      new WebSearchSource({ client: refused.client }).fetchListings({ criteria, companies }),
    ).rejects.toThrow(/refus/i);

    const empty = fakeClient({
      stop_reason: 'max_tokens',
      content: [],
      usage,
      parsed_output: null,
    });
    await expect(
      new WebSearchSource({ client: empty.client }).fetchListings({ criteria, companies }),
    ).rejects.toThrow(/max_tokens/);
  });
});
