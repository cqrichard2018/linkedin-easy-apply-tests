/** LinkedIn Easy Apply E2E suite — @author Li Jiang (Richard) */
/**
 * Offline mock of the LinkedIn Easy Apply flow.
 *
 * Exists because global linkedin.com is unreachable from CN-region networks
 * (302 -> linkedin.cn/incareer -> HTTP 451) and because a self-contained demo
 * needs no credentials. It reproduces ONLY the DOM contract the page objects
 * rely on (selector names, roles, labels, ARIA), so the real test suite runs
 * unmodified against it via BASE_URL=http://127.0.0.1:3009.
 *
 * It is NOT a LinkedIn clone for any other purpose — no branding, no assets.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 3009);

const page = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; margin: 0; background: #f3f2ef; color: #191919; }
  nav { background: #fff; padding: 12px 24px; border-bottom: 1px solid #e0dfdc; font-weight: 600; }
  main { max-width: 1128px; margin: 24px auto; display: flex; gap: 24px; padding: 0 16px; }
  ul.jobs-search-results-list { list-style: none; margin: 0; padding: 0; width: 40%; }
  li.job-card-container { background: #fff; border: 1px solid #e0dfdc; border-radius: 8px; padding: 16px; margin-bottom: 8px; cursor: pointer; }
  li.job-card-container:hover { box-shadow: 0 0 0 1px #0a66c2; }
  .job-title { font-weight: 600; color: #0a66c2; }
  .job-meta { color: #666; font-size: 14px; margin-top: 4px; }
  .easy-apply-badge { display: inline-block; margin-top: 6px; font-size: 12px; color: #057642; font-weight: 600; }
  #detail { flex: 1; background: #fff; border: 1px solid #e0dfdc; border-radius: 8px; padding: 24px; min-height: 480px; }
  button { font: inherit; border-radius: 16px; padding: 6px 16px; cursor: pointer; border: 1px solid #0a66c2; background: #fff; color: #0a66c2; font-weight: 600; }
  button.primary { background: #0a66c2; color: #fff; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  .jobs-easy-apply-modal { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
  .modal-card { background: #fff; border-radius: 8px; width: 480px; max-width: 92vw; padding: 24px; }
  .modal-card h2 { margin-top: 0; font-size: 20px; }
  .field { margin-bottom: 16px; }
  .field label { display: block; font-size: 14px; margin-bottom: 4px; }
  .field input[type=text], .field input[type=email], .field input[type=tel] { width: 100%; padding: 8px; border: 1px solid #666; border-radius: 4px; box-sizing: border-box; }
  .artdeco-inline-feedback--error { color: #d11124; font-size: 13px; margin-top: 4px; }
  .modal-actions { display: flex; justify-content: space-between; margin-top: 24px; }
  .hidden { display: none !important; }
  #confirm-dialog { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 10; }
  #uploaded-name { margin-top: 8px; font-size: 14px; color: #057642; }
  header.bar { display: flex; justify-content: space-between; align-items: center; }
</style>
</head>
<body>${body}</body>
</html>`;

const loginPage = page('Sign In | Mock', `
  <nav aria-label="Primary">Mock Jobs</nav>
  <main style="display:block; max-width:400px;">
    <h1>Sign in</h1>
    <form action="/feed" method="get">
      <div class="field"><label for="username">Email or phone</label>
        <input id="username" name="session_key" type="text" autocomplete="username"></div>
      <div class="field"><label for="password">Password</label>
        <input id="password" name="session_password" type="password" autocomplete="current-password"></div>
      <button type="submit" class="primary">Sign in</button>
    </form>
  </main>`);

const feedPage = page('Feed | Mock', `
  <nav aria-label="Primary">Mock Jobs — signed in</nav>
  <main style="display:block;"><h1>Feed</h1><p>Signed-in landing page.</p></main>`);

const jobsPage = page('Jobs | Mock', `
  <nav aria-label="Primary">Mock Jobs</nav>
  <main>
    <ul class="jobs-search-results-list">
      ${[1, 2, 3, 4, 5]
        .map(
          (i) => `
      <li class="job-card-container" data-job="${i}" tabindex="0" onclick="selectJob(${i})">
        <div class="job-title">Software Engineer (Mock ${i})</div>
        <div class="job-meta">Example Corp · United States (Remote)</div>
        <span class="easy-apply-badge">Easy Apply</span>
      </li>`,
        )
        .join('')}
    </ul>
    <section id="detail">
      <h2 id="detail-title">Select a job</h2>
      <p id="detail-body">Click a job card on the left.</p>
      <div id="detail-action"></div>
    </section>
  </main>

  <div class="jobs-easy-apply-modal hidden" data-test-modal-id="easy-apply">
    <div class="modal-card">
      <header class="bar">
        <h2 id="modal-heading">Apply to Example Corp</h2>
        <button type="button" aria-label="Dismiss" onclick="dismiss()">✕</button>
      </header>

      <div id="step-1">
        <h3>Contact info</h3>
        <div class="field"><label for="first-name">First name</label>
          <input id="first-name" type="text" value="Demo"></div>
        <div class="field"><label for="last-name">Last name</label>
          <input id="last-name" type="text" value="Candidate"></div>
        <div class="field"><label for="email">Email address</label>
          <input id="email" type="email" value="demo.candidate@example.com"></div>
        <div id="email-error" class="artdeco-inline-feedback--error hidden" role="alert">
          Please enter a valid email address</div>
        <div class="field"><label for="phone">Phone number</label>
          <input id="phone" type="tel" value="+1 555 010 2030"></div>
        <div id="phone-error" class="artdeco-inline-feedback--error hidden" role="alert">
          Please enter a valid phone number</div>
        <div class="modal-actions">
          <span></span>
          <button type="button" class="primary" onclick="nextFromStep1()">Next</button>
        </div>
      </div>

      <div id="step-2" class="hidden">
        <h3>Resume</h3>
        <div class="field">
          <label for="resume">Upload resume (PDF or DOC)</label>
          <input id="resume" type="file" accept=".pdf,.doc,.docx" onchange="showFileName(this)">
          <div id="uploaded-name"></div>
        </div>
        <div class="modal-actions">
          <span></span>
          <button type="button" class="primary" onclick="goStep(3)">Review</button>
        </div>
      </div>

      <div id="step-3" class="hidden">
        <h3>Review your application</h3>
        <p>Contact info and resume look good. This is the final step.</p>
        <div class="modal-actions">
          <span></span>
          <button type="button" class="primary" onclick="neverSubmit(event)">Submit application</button>
        </div>
      </div>
    </div>
  </div>

  <div id="confirm-dialog" class="hidden" role="dialog" aria-label="Unsaved changes">
    <div class="modal-card">
      <h2>Discard application?</h2>
      <div class="modal-actions">
        <button type="button" onclick="closeConfirm()">Cancel</button>
        <button type="button" class="primary" onclick="discard()">Discard</button>
      </div>
    </div>
  </div>

<script>
  const jobs = ${JSON.stringify(
    Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      title: `Software Engineer (Mock ${i + 1})`,
      body: `Example Corp is hiring a Software Engineer. Job #${i + 1}.`,
    })),
  )};

  function selectJob(id) {
    const job = jobs.find((j) => j.id === id);
    document.getElementById('detail-title').textContent = job.title;
    document.getElementById('detail-body').textContent = job.body;
    document.getElementById('detail-action').innerHTML =
      '<button type="button" class="primary" onclick="openModal()">Easy Apply</button>';
  }

  function openModal() {
    goStep(1);
    document.querySelector('.jobs-easy-apply-modal').classList.remove('hidden');
  }

  function goStep(n) {
    [1, 2, 3].forEach((i) =>
      document.getElementById('step-' + i).classList.toggle('hidden', i !== n),
    );
    clearErrors();
  }

  function clearErrors() {
    document.getElementById('email-error').classList.add('hidden');
    document.getElementById('phone-error').classList.add('hidden');
  }

  function nextFromStep1() {
    clearErrors();
    let ok = true;
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    if (!email.includes('@')) {
      document.getElementById('email-error').classList.remove('hidden');
      ok = false;
    }
    if (!phone) {
      document.getElementById('phone-error').classList.remove('hidden');
      ok = false;
    }
    if (ok) goStep(2);
  }

  function showFileName(input) {
    const name = input.files && input.files[0] ? input.files[0].name : '';
    document.getElementById('uploaded-name').textContent = name
      ? 'Uploaded: ' + name
      : '';
  }

  function dismiss() {
    document.getElementById('confirm-dialog').classList.remove('hidden');
  }

  function closeConfirm() {
    document.getElementById('confirm-dialog').classList.add('hidden');
  }

  function discard() {
    document.getElementById('confirm-dialog').classList.add('hidden');
    document.querySelector('.jobs-easy-apply-modal').classList.add('hidden');
  }

  function neverSubmit(event) {
    // Deliberately a no-op: the mock never submits, mirroring the suite's rule.
    event.preventDefault();
  }
</script>`);

const routes = {
  '/login': loginPage,
  '/feed': feedPage,
  '/jobs/': jobsPage,
  '/jobs/search/': jobsPage,
};

http
  .createServer((req, res) => {
    const path = new URL(req.url, 'http://x').pathname.replace(/\/$/, '') || '/';
    const html =
      routes[path] ??
      routes[path + '/'] ??
      (path.startsWith('/jobs') ? jobsPage : feedPage);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  })
  .listen(PORT, () => console.log(`mock listening on http://127.0.0.1:${PORT}`));
