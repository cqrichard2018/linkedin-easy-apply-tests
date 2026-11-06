/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard)
 *
 * Builds the uploadable submission bundle into submission/:
 *  - Submission-Notes.pdf  (the cover note, as a document)
 *  - Code-Listing.pdf      (key source files, as a document)
 *  - demo-run.webm         (recorded end-to-end run against the mock)
 *  - 01..03-*.png          (step screenshots, refreshed from the mock)
 * Requires the mock server: node mock/server.mjs
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3009';
const OUT = path.resolve('submission');
fs.mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const pageCss = `
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; margin: 48px; color: #191919; font-size: 13px; line-height: 1.55; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  code, pre { font-family: "SF Mono", Menlo, monospace; font-size: 11px; background: #f5f5f5; }
  code { padding: 1px 4px; }
  pre { padding: 12px; white-space: pre-wrap; word-break: break-all; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 12px; color: #444; }
`;

async function htmlToPdf(browser, html, file) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: path.join(OUT, file), format: 'A4', margin: { top: '24px', bottom: '24px' } });
  await page.close();
  console.log('written:', file);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--lang=en-US'] });

// ---- 1. Submission notes PDF (content mirrors SUBMISSION.md) ----------------
const notesHtml = `<html><head><style>${pageCss}</style></head><body>
<h1>Submission notes — LinkedIn Easy Apply E2E suite</h1>
<p>Playwright + TypeScript. Main test is <code>tests/easy-apply.spec.ts</code>, page objects
are in <code>pages/</code>. The README in the repo has the full setup; this is the short version.</p>

<h2>How each requirement is covered</h2>
<ul>
<li>Search a job with Easy Apply and open the form: <code>pages/JobsPage.ts</code>. I use the
<code>f_AL=true</code> url parameter for the Easy Apply filter instead of clicking the filter
buttons, it is much more stable.</li>
<li>Required fields (name, email, phone, resume): the smoke test checks they are visible and pre-filled.</li>
<li>Required field enforcement / button state: the "enforces required fields" test clears the phone
field and checks the form blocks going forward. It accepts both a disabled button and an inline
error, because LinkedIn does this differently depending on the A/B bucket.</li>
<li>File upload: the "resume upload" test checks the accept attribute, uploads a sample pdf and
checks the file name shows up.</li>
<li>Logging and error handling: <code>utils/logger.ts</code> writes a json log per run,
<code>fixtures/test.ts</code> captures page errors, console errors and failed requests. Playwright
also saves trace, video and screenshot on failure.</li>
<li>Chrome and Edge: <code>chrome</code> and <code>edge</code> projects in <code>playwright.config.ts</code>.</li>
<li>Mobile (iPhone 13, Galaxy S9): <code>iphone-13</code> and <code>galaxy-s9</code> projects.</li>
<li>Multi-user and session persistence: <code>tests/auth.setup.ts</code> logs each user in once and
saves storageState to <code>.auth/</code>. The suite then runs once per user without logging in again.
Cookie-based login (<code>li_at</code>) and the other fallback options are described in the README.</li>
<li>CI/CD and maintenance: <code>.github/workflows/e2e.yml</code> plus two README sections.</li>
</ul>

<h2>How to run</h2>
<pre>npm install
npx playwright install chromium
cp .env.example .env   # add a test account
npm run auth           # one-time login in a headed browser
npm test</pre>
<p>Reports and screenshots go to <code>playwright-report/</code>, <code>logs/</code> and <code>test-results/</code>.</p>

<h2>One thing to be upfront about</h2>
<p>I could not run this against the real site: from my network every request to linkedin.com gets
redirected to linkedin.cn (which answers with HTTP 451), and I have no way around that. So to verify
the suite actually works I wrote a small local mock (<code>mock/server.mjs</code>) that copies the DOM
structure the tests depend on, and ran everything against it. The screenshots, the recorded video and
the logs attached are from those runs - all 4 projects pass (chrome, edge, iphone-13, galaxy-s9).
On a network where linkedin.com works, the same suite runs against the real site with no code
changes, just <code>npm run auth</code> and <code>npm test</code>.</p>
<p>Also note: no real application is ever submitted. The submit button is only checked for presence,
never clicked, and every run discards the form at the end.</p>
</body></html>`;
await htmlToPdf(browser, notesHtml, 'Submission-Notes.pdf');

// ---- 2. Code listing PDF -----------------------------------------------------
const codeFiles = [
  'playwright.config.ts',
  'tests/auth.setup.ts',
  'tests/easy-apply.spec.ts',
  'pages/JobsPage.ts',
  'pages/EasyApplyModal.ts',
  'fixtures/test.ts',
  'utils/logger.ts',
  'utils/users.ts',
  'mock/server.mjs',
  '.github/workflows/e2e.yml',
];
const sections = codeFiles
  .map((f) => `<h2>${esc(f)}</h2><pre>${esc(fs.readFileSync(f, 'utf8'))}</pre>`)
  .join('\n');
await htmlToPdf(
  browser,
  `<html><head><style>${pageCss}</style></head><body><h1>Code listing — LinkedIn Easy Apply E2E suite</h1>${sections}</body></html>`,
  'Code-Listing.pdf',
);

// ---- 3. Recorded run (video) + fresh screenshots ------------------------------
const videoDir = path.join(OUT, 'video-tmp');
fs.rmSync(videoDir, { recursive: true, force: true });
const context = await browser.newContext({
  baseURL: BASE,
  locale: 'en-US',
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

await page.goto('/jobs/search/?keywords=Software+Engineer&location=United+States&f_AL=true');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, '01-search-results.png') });

await page.locator('.job-card-container').first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, '02-job-detail.png') });

await page.getByRole('button', { name: /easy apply/i }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(OUT, '03-easy-apply-form.png') });

await page.getByRole('button', { name: 'Next' }).click();
await page.locator('#resume').setInputFiles('fixtures/files/sample-resume.pdf');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '04-resume-upload.png') });

await page.getByRole('button', { name: 'Review' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, '05-review-step.png') });

await page.getByRole('button', { name: 'Dismiss' }).click();
await page.getByRole('button', { name: 'Discard' }).click();
await page.waitForTimeout(600);

await context.close(); // finalizes the video file
const webm = fs.readdirSync(videoDir).find((f) => f.endsWith('.webm'));
fs.renameSync(path.join(videoDir, webm), path.join(OUT, 'demo-run.webm'));
fs.rmSync(videoDir, { recursive: true, force: true });
console.log('written: demo-run.webm, 01..05-*.png');

await browser.close();
console.log('submission bundle complete ->', OUT);
