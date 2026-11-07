import { describe, expect, it } from 'vitest';
import { applySsmEnv } from './ssm.js';

const fakeSsm = (params: Record<string, string>) => ({
  send: async (cmd: { input: { Names: string[] } }) => ({
    Parameters: cmd.input.Names.filter((n) => n in params).map((n) => ({
      Name: n,
      Value: params[n],
    })),
  }),
});

describe('applySsmEnv', () => {
  it('exposes each SSM_<NAME> parameter as <NAME>', async () => {
    const env: NodeJS.ProcessEnv = {
      SSM_ORIGIN_VERIFY_SECRET: '/p/mcp',
      SSM_OTHER: '/p/other',
      KEEP: 'x',
    };
    await applySsmEnv(env, fakeSsm({ '/p/mcp': 'token-value', '/p/other': 'o' }) as never);
    expect(env).toMatchObject({ ORIGIN_VERIFY_SECRET: 'token-value', OTHER: 'o', KEEP: 'x' });
  });

  it('does nothing (and makes no call) when no SSM_ variables are set', async () => {
    const client = {
      send: async () => {
        throw new Error('should not be called');
      },
    };
    await expect(applySsmEnv({ A: '1' }, client as never)).resolves.toBeUndefined();
  });

  it('fails loudly when a parameter is missing', async () => {
    await expect(
      applySsmEnv({ SSM_ORIGIN_VERIFY_SECRET: '/p/missing' }, fakeSsm({}) as never),
    ).rejects.toThrow('/p/missing');
  });
});
