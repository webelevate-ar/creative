import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/integration/**/*.test.tsx'], pool: 'forks' },
  oxc: { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } },
});
