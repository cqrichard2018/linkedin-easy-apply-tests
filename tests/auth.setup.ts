/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import { getUsers } from '../utils/users';
import { logger } from '../utils/logger';

/**
 * Authenticates every configured user ONCE and persists storageState.
 *
 * Login strategy, in order of preference:
 *  1. Reuse an existing .auth/<user>.json (delete it to force re-login).
 *  2. Inject the `li_at` session cookie (no UI login — best for CI where
 *     data-center IPs trigger CAPTCHA).
 *  3. Credential login through the UI. If LinkedIn asks for verification
 *     (2FA / CAPTCHA), a headed run waits up to 2 minutes for a human to
 *     complete it; headless runs fail fast with a clear remediation message.
 */
for (const user of getUsers()) {
  setup(`authenticate ${user.id}`, async ({ page, context, baseURL }) => {
    if (fs.existsSync(user.stateFile)) {
      logger.info('Reusing persisted session', { user: user.id, stateFile: user.stateFile });
      return;
    }

    if (user.liAt) {
      logger.info('Authenticating via li_at cookie', { user: user.id });
      await context.addCookies([
        {
          name: 'li_at',
          value: user.liAt,
          domain: '.www.linkedin.com',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        },
      ]);
      await page.goto(`${baseURL}/feed/`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('navigation').first()).toBeVisible({ timeout: 30_000 });
      await context.storageState({ path: user.stateFile });
      logger.info('Session persisted', { user: user.id, stateFile: user.stateFile });
      return;
    }

    if (!user.email || !user.password) {
      throw new Error(
        `[${user.id}] No li_at cookie and incomplete credentials. ` +
          'Set LINKEDIN_USER_*_EMAIL/PASSWORD or LINKEDIN_USER_*_LI_AT.',
      );
    }

    logger.info('Authenticating via credential login', { user: user.id });
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill(user.email);
    await page.locator('#password').fill(user.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    const landed = page.waitForURL(/\/(feed|jobs|checkpoint)/, { timeout: 30_000 }).then(() => true);
    await landed.catch(() => false);

    if (page.url().includes('/checkpoint')) {
      if (process.env.HEADED === '1') {
        logger.warn('Verification checkpoint detected — complete it manually (2 min window)', {
          user: user.id,
        });
        await page.waitForURL(/\/(feed|jobs)/, { timeout: 120_000 });
      } else {
        throw new Error(
          `[${user.id}] LinkedIn requires verification (2FA/CAPTCHA). ` +
            'Run `npm run auth` once headed to complete it manually, or set the li_at cookie.',
        );
      }
    }

    if (!/\/(feed|jobs)/.test(page.url())) {
      const alertText = (
        await page.locator('[role="alert"], .alert, [id^="error-for-"]').first().textContent().catch(() => null)
      )?.trim();
      throw new Error(
        `[${user.id}] Login did not reach feed/jobs (url=${page.url()}). ` +
          (alertText ? `Page says: "${alertText}"` : 'No error banner found — unexpected page behaviour.'),
      );
    }

    await context.storageState({ path: user.stateFile });
    logger.info('Session persisted', { user: user.id, stateFile: user.stateFile });
  });
}
