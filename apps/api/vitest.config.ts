import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Integration tests share one Postgres test DB, so files run serially.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test' },
  },
});
