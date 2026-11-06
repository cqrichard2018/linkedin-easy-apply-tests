/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import path from 'node:path';
import { test, expect } from '../fixtures/test';
import { JobsPage } from '../pages/JobsPage';
import { getUsers } from '../utils/users';
import { logger } from '../utils/logger';

const SEARCH = {
  keywords: process.env.SEARCH_KEYWORDS ?? 'Software Engineer',
  location: process.env.SEARCH_LOCATION ?? 'United States',
};
const SAMPLE_RESUME = path.resolve(__dirname, '../fixtures/files/sample-resume.pdf');

/**
 * The whole suite runs once per configured user (multi-user session handling):
 * each describe block gets its own persisted storageState, so users are fully
 * isolated and never log in during the test run itself.
 *
 * No test ever clicks "Submit application" — every flow ends with discard.
 */
for (const user of getUsers()) {
  test.describe(`Easy Apply — ${user.id}`, () => {
    test.use({ storageState: user.stateFile });

    test.beforeEach(async ({ page }) => {
      const jobs = new JobsPage(page);
      await jobs.searchWithEasyApply(SEARCH.keywords, SEARCH.location);
    });

    test('opens the form and shows required contact fields @smoke', async ({ page }) => {
      const modal = await new JobsPage(page).openFirstEasyApplyJob();
      await test.step('form loads', () => modal.expectLoaded());
      await test.step('required fields visible and pre-filled', () =>
        modal.expectContactFieldsVisible(),
      );
      await modal.closeAndDiscard();
    });

    test('enforces required fields (phone number)', async ({ page }) => {
      const modal = await new JobsPage(page).openFirstEasyApplyJob();
      await modal.expectLoaded();
      const strategy = await test.step('clear phone and verify enforcement', () =>
        modal.expectRequiredFieldEnforced(/phone|mobile/i),
      );
      logger.info('enforcement strategy observed', { user: user.id, strategy });
      await modal.closeAndDiscard();
    });

    test('resume upload: type restriction and upload feedback', async ({ page }) => {
      const modal = await new JobsPage(page).openFirstEasyApplyJob();
      await modal.expectLoaded();
      await test.step('navigate to resume step', () => modal.goToResumeStep());
      await test.step('input restricts file types', () => modal.expectResumeAcceptsDocuments());
      await test.step('upload sample resume', () => modal.uploadResume(SAMPLE_RESUME));
      await modal.closeAndDiscard();
    });

    test('never submits: submit button is reachable only for assertion', async ({ page }) => {
      const modal = await new JobsPage(page).openFirstEasyApplyJob();
      await modal.expectLoaded();
      // Walk forward until the review step or step budget is exhausted.
      for (let i = 0; i < 4; i++) {
        if (await modal.submitButton().isVisible().catch(() => false)) break;
        await modal.primaryAction().click();
      }
      // Safety assertion only — we assert presence but intentionally never click.
      if (await modal.submitButton().isVisible().catch(() => false)) {
        await expect(modal.submitButton()).toBeEnabled();
        logger.info('Reached review step; submit button present and NOT clicked');
      } else {
        logger.warn('Review step not reached within step budget (extra screening questions?)');
      }
      await modal.closeAndDiscard();
    });
  });
}
