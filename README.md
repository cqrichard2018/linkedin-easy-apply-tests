# LinkedIn Easy Apply — E2E Test Suite

Playwright + TypeScript suite that automates the LinkedIn **Easy Apply** flow on the real
production site: job search → open application form → validate required fields, resume
upload and button behaviour. **No test ever submits a real application** — every flow
ends by discarding the form.

## What is covered

| Requirement | Where |
| --- | --- |
| Navigate to linkedin.com/jobs, search, filter Easy Apply | `pages/JobsPage.ts` (`f_AL=true` filter) |
| Open application form, validate required fields (name/email/phone/resume) | `tests/easy-apply.spec.ts` — smoke + resume tests |
| Required-field enforcement | `expectRequiredFieldEnforced()` — accepts disabled-button **or** inline-error strategy |
| File upload behaviour | `expectResumeAcceptsDocuments()` + `uploadResume()` |
| Button state (blocked until form complete) | same enforcement helper (dual-strategy) |
| Logging & error handling | `utils/logger.ts` (JSON-lines), `fixtures/test.ts` (pageerror/console/request capture), Playwright trace/video/screenshot on failure |
| Chrome + Edge | `chrome` / `edge` projects via branded channels |
| Mobile emulation | `iphone-13` / `galaxy-s9` projects via device descriptors |
| Multi-user sessions | per-user `storageState` in `.auth/`, suite runs once per user |
| Login-persistence workarounds | see "Authentication strategies" below |
| CI/CD + maintenance | `.github/workflows/e2e.yml` + "Maintenance strategy" below |

## Setup

```bash
npm install
npx playwright install chromium   # Chrome & Edge use your locally installed browsers
cp .env.example .env              # fill in at least LINKEDIN_USER_A_*
```

> Edge must be installed locally for the `edge` project (`channel: 'msedge'`).
> On GitHub-hosted runners it is preinstalled.

## Running

```bash
npm run auth          # one-time HEADED login; complete any 2FA manually, session is persisted
npm test              # all projects (chrome, edge, iphone-13, galaxy-s9)
npm run test:chrome   # single project
npm run test:mobile   # iPhone 13 + Galaxy S9+
npm run report        # open the HTML report
```

> Mobile projects use Playwright's bundled browsers by default (webkit for iPhone,
> chromium for Android). If they are not downloaded locally, `CHANNEL=chrome npm run
> test:mobile` reuses the installed Chrome for emulation. In CI they always run on
> the bundled browsers.

Run artifacts: `playwright-report/` (HTML), `reports/` (JUnit/JSON), `logs/` (structured
JSON-lines), `test-results/` (traces, videos, failure screenshots).

## Authentication strategies (multi-user session handling)

The `setup` project authenticates **each configured user once** and persists
`storageState` (cookies + localStorage) to `.auth/<user>.json`. Test projects reuse that
state — users are fully isolated and no test performs a login.

Strategy order per user:

1. **Reuse persisted state** — if `.auth/<user>.json` exists, skip login entirely.
   Delete the file to force re-authentication.
2. **`li_at` cookie injection** — set `LINKEDIN_USER_<X>_LI_AT` (copied from a logged-in
   browser's DevTools). No UI login at all; the only reliable option in CI, where
   data-center IPs almost always trigger CAPTCHA.
3. **Credential login** — `LINKEDIN_USER_<X>_EMAIL` / `_PASSWORD`. If LinkedIn shows a
   verification checkpoint, a headed run (`npm run auth`) waits up to 2 minutes for a
   human to complete 2FA, then persists the session. Headless runs fail fast with a
   remediation message.

### Workarounds when login persistence is not feasible

- **Session refresh job**: run the `setup` project on a schedule (nightly CI job) and
  commit the refreshed `.auth/*.json` to a secure artifact store, so flaky re-logins
  never block the test job.
- **li_at rotation**: cookies live ~1 year but can be revoked; keep per-user cookies as
  CI secrets and document an owner per test account who refreshes them.
- **Checkpoint escalation**: if a checkpoint appears mid-run, the suite fails loudly with
  the exact remediation step instead of retrying blindly (retries make checkpoints worse).

## Offline demo mode (no VPN, no credentials)

Global linkedin.com is unreachable from CN-region networks (302 → linkedin.cn →
HTTP 451) and Easy Apply needs a real account. `mock/server.mjs` reproduces only the
**DOM contract** the page objects depend on (selectors, roles, labels), so the entire
suite runs unmodified against it:

```bash
npm run mock   # terminal 1: mock on http://127.0.0.1:3009
npm run demo   # terminal 2: full chrome project, 6 tests
npm run demo:screenshots   # captures screenshots/01..03 step-by-step
```

`BASE_URL` (env) switches the target: mock for demos/CI of the harness itself,
production for the real assessment. The mock already caught one real locator bug
(multiple inline-error containers required a `visible` filter, not `.first()`).

## CI/CD integration

`.github/workflows/e2e.yml`:

- **Matrix** over `chrome`, `edge`, `iphone-13`, `galaxy-s9` on every push/PR.
- **Nightly schedule** — LinkedIn changes its DOM frequently; nightly runs catch selector
  drift before it blocks a PR.
- **Secrets-based auth** — sessions come from `li_at` secrets, never from UI logins in CI.
- **Artifacts on every run** — HTML report, JUnit/JSON, structured logs, traces, videos
  and failure screenshots are uploaded per project for debugging.
- **Retries: 2 in CI, 0 locally** — local failures should be investigated, not masked.

In a larger pipeline this job would gate on: lint/type-check → this suite (PR, smoke tag
only) → full matrix (nightly). For production apps the same pattern applies with
environment-specific base URLs.

## Maintenance strategy

- **Page objects centralize selectors** (`pages/`). LinkedIn ships A/B variants and
  frequent DOM changes; a selector fix lands in exactly one place. Locators prefer
  role/label over CSS, with documented fallbacks for the mobile full-page variant.
- **URL-driven state where possible** (`f_AL=true`) instead of fragile UI interactions.
- **Dual-strategy assertions** where LinkedIn behaviour legitimately varies (disabled
  button vs. inline error) — tests assert the *contract*, not one A/B bucket, and log
  which strategy was observed.
- **Quarantine workflow**: a test that fails on nightly but passes on re-run gets tagged
  `@flaky`, excluded from PR gating, and gets a linked issue — it never silently blocks.
- **Ownership**: each test account has a named owner responsible for credential/cookie
  refresh; CI secrets are rotated on a calendar reminder.

## Known limitations & compliance

- LinkedIn's terms restrict automated access. Use **dedicated test accounts**, low
  run frequency, and never submit real applications (enforced in code: `EasyApplyModal`
  has no submit method; the submit button is located for assertions only).
- Search results depend on the account's region/network; `SEARCH_KEYWORDS` and
  `SEARCH_LOCATION` are configurable to keep results stable.
- The "extra screening questions" step varies per job; the resume/review navigation has a
  bounded step budget and logs a clear warning instead of hanging.

## Project structure

```
├── playwright.config.ts     # projects: chrome, edge, iphone-13, galaxy-s9 + auth setup
├── tests/
│   ├── auth.setup.ts        # per-user login, storageState persistence
│   └── easy-apply.spec.ts   # multi-user Easy Apply suite
├── pages/                   # JobsPage, EasyApplyModal (page objects)
├── fixtures/
│   ├── test.ts              # base test: console/pageerror/request capture
│   └── files/sample-resume.pdf
├── utils/                   # logger (JSON-lines), user roster
└── .github/workflows/e2e.yml
```
