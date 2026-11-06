/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Projects cover the cross-browser / cross-device requirements:
 *  - chrome / edge : real branded channels (Chrome and Edge must be installed)
 *  - iphone-13 / galaxy-s9 : mobile emulation via Playwright device descriptors
 * The `setup` project authenticates every configured user once and persists
 * storageState to .auth/ so test projects never log in again.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // LinkedIn rate-limits aggressively; keep it serial
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://www.linkedin.com',
    headless: process.env.HEADED !== '1',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    locale: 'en-US',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { channel: 'chrome' } },
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      dependencies: ['setup'],
    },
    {
      name: 'edge',
      use: { ...devices['Desktop Chrome'], channel: 'msedge' },
      dependencies: ['setup'],
    },
    // Mobile emulation via device descriptors. CHANNEL=chrome lets local runs
    // reuse the installed branded browser when the bundled build is missing
    // (iPhone descriptors default to webkit, so the engine must be pinned too).
    {
      name: 'iphone-13',
      use: {
        ...devices['iPhone 13'],
        channel: process.env.CHANNEL,
        ...(process.env.CHANNEL ? { defaultBrowserType: 'chromium' as const } : {}),
      },
      dependencies: ['setup'],
    },
    {
      name: 'galaxy-s9',
      use: { ...devices['Galaxy S9+'], channel: process.env.CHANNEL },
      dependencies: ['setup'],
    },
  ],
});
