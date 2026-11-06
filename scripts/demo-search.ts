/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
/**
 * No-login smoke demo: public job search -> job detail -> Easy Apply button.
 * Easy Apply itself requires auth, so we expect a login wall; that path is
 * exercised here precisely to verify selectors and error handling.
 */
import { chromium } from '@playwright/test';
import { JobsPage } from '../pages/JobsPage';
import { logger } from '../utils/logger';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: process.env.HEADED !== '1' });
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL ?? 'https://www.linkedin.com',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = await context.newPage();
  const shot = (name: string) => page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });

  try {
    const jobs = new JobsPage(page);
    await jobs.searchWithEasyApply('Software Engineer', 'United States');
    await shot('01-search-results');
    logger.info('screenshot saved', { file: 'screenshots/01-search-results.png' });

    const firstCard = page
      .locator('.job-card-container, li.jobs-search-results__list-item, li.occludable-update, ul.jobs-search__results-list > li')
      .first();
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.click();
    await jobs.dismissGuestModal();
    await page.waitForTimeout(3000); // let the detail pane settle
    await shot('02-job-detail');
    logger.info('screenshot saved', { file: 'screenshots/02-job-detail.png' });

    // logged-in jobs show "Easy Apply"; guest view shows a generic "Apply" CTA
    const easyApplyBtn = page
      .getByRole('button', { name: /easy apply/i })
      .or(page.locator('button.apply-button'))
      .first();
    if (await easyApplyBtn.isVisible().catch(() => false)) {
      await easyApplyBtn.click();
      await page.waitForTimeout(3000);
      await shot('03-after-easy-apply-click');
      const authWall = page.locator('[data-test-modal], div[role="dialog"], .authwall').first();
      logger.info('Easy Apply clicked without login', {
        url: page.url(),
        authWallVisible: await authWall.isVisible().catch(() => false),
      });
    } else {
      logger.warn('No Easy Apply button on first job (may require login to show)');
      await shot('03-no-easy-apply-button');
    }
  } catch (err) {
    logger.error('demo failed', { error: (err as Error).message });
    await shot('99-error');
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(() => process.exit(1));
