# Submission notes

Playwright + TypeScript. Main test is `tests/easy-apply.spec.ts`, page objects
are in `pages/`. README has the full setup, below is just the short version.

## How each requirement is covered

- Search a job with Easy Apply and open the form: `pages/JobsPage.ts`. I use
  the `f_AL=true` url parameter for the Easy Apply filter instead of clicking
  the filter buttons, it is much more stable.
- Required fields (name, email, phone, resume): the smoke test in
  `easy-apply.spec.ts` checks they are visible and pre-filled.
- Required field enforcement / button state: the "enforces required fields"
  test clears the phone field and checks the form blocks going forward. It
  accepts both a disabled button and an inline error, because LinkedIn does
  this differently depending on the A/B bucket.
- File upload: the "resume upload" test checks the accept attribute, uploads
  a sample pdf and checks the file name shows up.
- Logging and error handling: `utils/logger.ts` writes a json log per run,
  `fixtures/test.ts` captures page errors, console errors and failed requests.
  Playwright also saves trace, video and screenshot on failure.
- Chrome and Edge: `chrome` and `edge` projects in `playwright.config.ts`.
- Mobile (iPhone 13, Galaxy S9): `iphone-13` and `galaxy-s9` projects.
- Multi-user and session persistence: `tests/auth.setup.ts` logs each user in
  once and saves storageState to `.auth/`. The suite then runs once per user
  without logging in again. Cookie-based login (`li_at`) and the other
  fallback options are described in the README.
- CI/CD and maintenance: `.github/workflows/e2e.yml` plus two README sections.

## How to run

```
npm install
npx playwright install chromium
cp .env.example .env   # add a test account
npm run auth           # one-time login in a headed browser
npm test
```

Reports and screenshots go to `playwright-report/`, `logs/` and `test-results/`.

## One thing to be upfront about

I could not run this against the real site: from my network every request to
linkedin.com gets redirected to linkedin.cn (which answers with HTTP 451), and
I have no way around that. So to verify the suite actually works I wrote a
small local mock (`mock/server.mjs`) that copies the DOM structure the tests
depend on, and ran everything against it. The screenshots and logs attached
are from those runs - all 4 projects pass (chrome, edge, iphone-13, galaxy-s9).
On a network where linkedin.com works, the same suite runs against the real
site with no code changes, just `npm run auth` and `npm test`.

Also note: no real application is ever submitted. The submit button is only
checked for presence, never clicked, and every run discards the form at the
end.
