/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import { expect, Page } from '@playwright/test';
import { EasyApplyModal } from './EasyApplyModal';
import { logger } from '../utils/logger';

/**
 * LinkedIn jobs search. Uses the `f_AL=true` query param (LinkedIn's own
 * "Easy Apply" filter) instead of clicking filter chips — URL-driven state is
 * far more stable than the filter UI, which changes frequently.
 */
export class JobsPage {
  constructor(private readonly page: Page) {}

  private get resultsList() {
    return this.page.locator(
      '.jobs-search-results-list, .scaffold-layout__list-container ul, ul.jobs-search__results-list',
    );
  }

  private get jobCards() {
    // logged-in split-pane cards + guest-view bare <li> under the results list
    return this.page.locator(
      '.job-card-container, li.jobs-search-results__list-item, li.occludable-update, ul.jobs-search__results-list > li',
    );
  }

  /** Guest view pops a sign-in modal on card click; dismiss if present. */
  async dismissGuestModal(): Promise<void> {
    const dismiss = this.page.locator('button.modal__dismiss').first();
    if (await dismiss.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismiss.click();
      logger.info('guest sign-in modal dismissed');
    }
  }

  async searchWithEasyApply(keywords: string, location: string): Promise<void> {
    const params = new URLSearchParams({ keywords, location, f_AL: 'true' });
    await this.page.goto(`/jobs/search/?${params.toString()}`, { waitUntil: 'domcontentloaded' });
    try {
      await expect(this.resultsList.first()).toBeVisible({ timeout: 30_000 });
    } catch (err) {
      logger.error('Job results list never appeared', {
        url: this.page.url(),
        error: (err as Error).message,
      });
      throw new Error(`Search results did not load at ${this.page.url()} — possible auth wall or layout change.`);
    }
    logger.info('Job search results loaded', { keywords, location });
  }

  /**
   * Clicks through the first result cards until one exposes an enabled
   * "Easy Apply" button, opens it and returns the modal page object.
   */
  async openFirstEasyApplyJob(maxCards = 10): Promise<EasyApplyModal> {
    await expect(this.jobCards.first()).toBeVisible({ timeout: 30_000 });
    const count = Math.min(await this.jobCards.count(), maxCards);
    const easyApplyBtn = this.page.getByRole('button', { name: /easy apply/i }).first();

    for (let i = 0; i < count; i++) {
      const card = this.jobCards.nth(i);
      await card.scrollIntoViewIfNeeded();
      await card.click();
      await this.dismissGuestModal();
      try {
        await expect(easyApplyBtn).toBeVisible({ timeout: 5_000 });
        await expect(easyApplyBtn).toBeEnabled();
        await easyApplyBtn.click();
        logger.info('Easy Apply form opened', { cardIndex: i });
        return new EasyApplyModal(this.page);
      } catch {
        logger.warn('Card has no usable Easy Apply button, trying next', { cardIndex: i });
      }
    }
    throw new Error(`No Easy Apply job found in the first ${count} result cards.`);
  }
}
