import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/integration/**/*.test.tsx'], pool: 'forks', env: { PARSE_IN_WORKER: '0' } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } },
});
