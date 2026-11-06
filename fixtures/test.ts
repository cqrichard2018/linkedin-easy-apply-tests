/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import { test as base } from '@playwright/test';
import { logger } from '../utils/logger';

/**
 * Base test with global error capture. Unexpected page behaviour is logged to
 * the structured log even when it does not fail the test, so flaky signals
 * (failed XHRs, uncaught JS errors) are visible in CI artifacts.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    page.on('pageerror', (err) =>
      logger.error('Uncaught page error', { test: testInfo.title, message: err.message }),
    );
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        logger.warn('Browser console error', {
          test: testInfo.title,
          text: msg.text().slice(0, 500),
        });
      }
    });
    page.on('requestfailed', (req) => {
      const type = req.resourceType();
      if (req.url().includes('linkedin.com') && ['document', 'xhr', 'fetch'].includes(type)) {
        logger.warn('Request failed', {
          test: testInfo.title,
          url: req.url(),
          error: req.failure()?.errorText,
        });
      }
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
