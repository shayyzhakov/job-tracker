import { defineConfig } from 'vitest/config';

// Root config for `pnpm test:watch`: runs every workspace's tests in one watcher.
export default defineConfig({
  test: { projects: ['packages/*', 'apps/*'] },
});
