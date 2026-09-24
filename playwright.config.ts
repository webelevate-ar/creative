import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `rm -rf .e2e-data && DATABASE_PATH=.e2e-data/e2e.sqlite PORT=${PORT} NODE_ENV=test SIGNUP_LIMIT_PER_HOUR=1000 npx tsx src/server.tsx`,
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
