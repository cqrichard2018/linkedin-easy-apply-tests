/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
import { expect, Locator, Page } from '@playwright/test';
import { logger } from '../utils/logger';

/**
 * Page object for the Easy Apply form. On desktop it renders as a modal; on
 * mobile web it renders as a full page — `root` covers both so the same tests
 * run against every project.
 *
 * SAFETY: this class deliberately has no `submit()` method, and every test
 * ends with closeAndDiscard(). The final "Submit application" button is only
 * ever located for assertion, never clicked.
 */
export class EasyApplyModal {
  readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page
      .locator(
        [
          '.jobs-easy-apply-modal',
          '[data-test-modal-id]',
          'div[role="dialog"]:has-text("Apply")',
          'main:has-text("Apply to")', // mobile full-page variant
        ].join(', '),
      )
      .first();
  }

  // ---- lifecycle -----------------------------------------------------------

  async expectLoaded(): Promise<void> {
    try {
      await expect(this.root).toBeVisible({ timeout: 20_000 });
    } catch (err) {
      logger.error('Easy Apply form did not open', {
        url: this.page.url(),
        error: (err as Error).message,
      });
      throw new Error('Easy Apply modal/page never became visible after clicking the button.');
    }
  }

  async closeAndDiscard(): Promise<void> {
    const dismiss = this.root
      .getByRole('button', { name: /dismiss|close/i })
      .or(this.page.getByRole('button', { name: /dismiss|close/i }))
      .first();
    await dismiss.click();
    const discard = this.page.getByRole('button', { name: /discard/i }).first();
    if (await discard.isVisible().catch(() => false)) {
      await discard.click();
    }
    await expect(this.root).toBeHidden({ timeout: 10_000 }).catch(() => {
      logger.warn('Form still visible after discard', { url: this.page.url() });
    });
    logger.info('Easy Apply form discarded without submitting');
  }

  // ---- contact fields ------------------------------------------------------

  contactField(label: RegExp): Locator {
    return this.root.getByLabel(label).first();
  }

  /** Required profile fields LinkedIn pre-fills on the first step. */
  async expectContactFieldsVisible(): Promise<void> {
    for (const label of [/first name/i, /last name/i, /email/i, /phone|mobile/i]) {
      const field = this.contactField(label);
      await expect(field, `required field ${label} should be visible`).toBeVisible();
      await expect(field, `required field ${label} should be pre-filled`).not.toHaveValue('');
    }
    logger.info('All required contact fields visible and pre-filled');
  }

  // ---- validation behaviour --------------------------------------------------

  /**
   * Clears a required field and verifies the form enforces it: either the
   * primary action is disabled, or clicking it keeps us on the same step with
   * an inline error. Both strategies are valid LinkedIn behaviour depending on
   * the A/B bucket, so we accept either and log which one applied.
   */
  async expectRequiredFieldEnforced(label: RegExp): Promise<'disabled' | 'inline-error'> {
    const field = this.contactField(label);
    await field.clear();
    const action = this.primaryAction();
    const strategy =
      (await action.isDisabled().catch(() => false)) ||
      (await action.getAttribute('aria-disabled')) === 'true'
        ? 'disabled'
        : 'inline-error';

    if (strategy === 'inline-error') {
      await action.click();
      await this.expectInlineError(`required field ${label}`);
      await expect(action, 'should stay on the same step').toBeVisible();
    }
    logger.info('Required field enforcement verified', { label: String(label), strategy });
    return strategy;
  }

  private async expectInlineError(context: string): Promise<void> {
    // Multiple error containers may exist in the DOM (one per field) with only
    // the relevant one visible — filter by visibility instead of taking first().
    const error = this.root
      .getByRole('alert')
      .or(this.root.locator('.artdeco-inline-feedback--error, [data-test-form-element-error-messages]'))
      .filter({ visible: true });
    await expect(error.first(), `inline validation error should appear for ${context}`).toBeVisible();
  }

  // ---- navigation inside the form ------------------------------------------

  /** "Next" on intermediate steps, "Review" on the last data-entry step. */
  primaryAction(): Locator {
    return this.root.getByRole('button', { name: /^(next|review|continue)$/i }).first();
  }

  /** Located for assertions only — NEVER clicked (see class docstring). */
  submitButton(): Locator {
    return this.root.getByRole('button', { name: /submit application/i }).first();
  }

  // ---- resume upload ---------------------------------------------------------

  resumeInput(): Locator {
    return this.root.locator('input[type="file"]').first();
  }

  /** Advances steps until the resume upload input is visible (max 4 steps). */
  async goToResumeStep(maxSteps = 4): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
      if (await this.resumeInput().isVisible().catch(() => false)) return;
      await this.primaryAction().click();
    }
    await expect(this.resumeInput(), 'resume upload input should be reachable').toBeVisible();
  }

  async expectResumeAcceptsDocuments(): Promise<void> {
    const accept = await this.resumeInput().getAttribute('accept');
    expect(accept, 'resume input should restrict file types').toMatch(/\.pdf|\.doc/i);
    logger.info('Resume input accept attribute verified', { accept });
  }

  async uploadResume(filePath: string): Promise<void> {
    await this.resumeInput().setInputFiles(filePath);
    const fileName = filePath.split('/').pop()!;
    await expect(
      this.root.getByText(new RegExp(fileName.replace(/[.]/g, '\\.'), 'i')).first(),
      'uploaded file name should be displayed',
    ).toBeVisible({ timeout: 15_000 });
    logger.info('Resume uploaded and reflected in UI', { fileName });
  }
}
