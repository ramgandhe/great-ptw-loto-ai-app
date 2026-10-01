// P2 baseline: executor prepares site, crew and forms on an assigned draft (journey-baselines.md).
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_UX_ISSUER_EMAIL/_PASSWORD and
// PTW_UX_EXECUTOR_EMAIL/_PASSWORD (documented local demo accounts; PTW_UX_EXECUTOR_ID defaults to the seed operator id) node replay-p2-baseline.cjs
// Local Docker stack only. Seeds one real draft through the API as the issuer (the P1 handoff state),
// intercepts every executor write in the browser, and deletes the seed draft at the end.
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const TITLE = 'P2 baseline ' + Date.now();
const IDS = {
  generalWork: '00000000-0000-4000-8000-000000000126',
  demoPlant: '00000000-0000-4000-8000-000000000103',
  maintenance: '00000000-0000-4000-8000-000000000136',
  compressorBay: '00000000-0000-4000-8000-000000000105',
};
const report = {
  method:
    'Same counting contract as P1: button/link = 1, native select open+choose = 2, typing/scrolling/sign-in excluded; screens = main views including the start. Seed draft is real (local DB); executor writes are intercepted and answered with the current permit, so no executor data is stored.',
  journey: { name: 'P2 Executor preparation', start: '/dashboard', steps: [], screens: [], typedFields: [], clicks: 0 },
  writes: [],
  formFields: {},
  errors: [],
};
const j = report.journey;
const screen = (name) => j.screens.push(name);
const click = async (locator, label) => { await locator.click(); j.steps.push({ action: label, clicks: 1 }); j.clicks += 1; };
const fill = async (locator, value, label) => { await locator.fill(value); j.typedFields.push(label); j.steps.push({ action: 'Type ' + label, clicks: 0 }); };
const select = async (locator, label, index = 1) => {
  await locator.locator('option').nth(index).waitFor({ state: 'attached' });
  await locator.selectOption(await locator.locator('option').nth(index).getAttribute('value'));
  j.steps.push({ action: 'Select ' + label, clicks: 2 });
  j.clicks += 2;
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const login = async (email, password) => {
    if (!email || !password) throw new Error('Set the PTW_UX_*_EMAIL/_PASSWORD variables for local demo accounts');
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    return page;
  };
  const call = (page, method, path, body) =>
    page.evaluate(async ([m, p, b]) => {
      const res = await fetch('http://localhost:4000/api/v1' + p, {
        method: m,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('ptw_access_token') },
        body: b ? JSON.stringify(b) : undefined,
      });
      return res.json();
    }, [method, path, body]);

  try {
    // Seed: the P1 handoff state (type, title, scope, place, schedule, primary executor) saved at step 2.
    const issuer = await login(process.env.PTW_UX_ISSUER_EMAIL, process.env.PTW_UX_ISSUER_PASSWORD);
    // The executor signs in only after the seed exists, so their first dashboard load already lists it.
    const executorId = process.env.PTW_UX_EXECUTOR_ID || '00000000-0000-4000-8000-000000000015';
    const created = await call(issuer, 'POST', '/permits', {
      permitTypeId: IDS.generalWork, title: TITLE, workScope: 'Inspect the marked walkway before routine work.', currentStep: 0,
    });
    const id = created.data.permit.id;
    const day = new Date(Date.now() + 86400000);
    const local = (h) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).toISOString();
    const seeded = await call(issuer, 'PATCH', '/permits/' + id, {
      expectedRevision: created.data.permit.draftRevision,
      plantId: IDS.demoPlant, departmentId: IDS.maintenance, locationId: IDS.compressorBay,
      plannedStartAt: local(8), plannedEndAt: local(16),
      executors: [{ workforceUserId: executorId, isPrimary: true }], currentStep: 1,
    });
    if (!seeded.success) throw new Error('Seed failed: ' + seeded.error?.message);

    const page = await login(process.env.PTW_UX_EXECUTOR_EMAIL, process.env.PTW_UX_EXECUTOR_PASSWORD);
    if ((await call(page, 'GET', '/auth/profile')).data.id !== executorId) throw new Error('PTW_UX_EXECUTOR_ID does not match the executor login');
    // Intercept executor writes; answer with the current permit so the page behaves as after a save.
    await page.route('**/api/v1/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') return route.continue();
      report.writes.push({ method: req.method(), path: new URL(req.url()).pathname, body: req.postDataJSON?.() ?? null });
      const current = await route.fetch({ method: 'GET', postData: undefined });
      return route.fulfill({ response: current });
    });

    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'load' });
    screen('Dashboard (Needs you)');
    const link = page.getByRole('link').filter({ hasText: TITLE }).first();
    await link.waitFor({ timeout: 45000 });
    await click(link, 'Open assigned draft from Needs you');
    await page.locator('#plantId').waitFor();
    screen('Location & schedule (issuer step, read-only)');

    await click(page.getByRole('button', { name: '3. On-site details' }), 'Step: On-site details');
    await page.locator('#workstationId').waitFor();
    screen('On-site details');
    await select(page.locator('#workstationId'), 'Workstation');
    await select(page.locator('#machineryId'), 'Machinery');
    await select(page.locator('#hazard-0'), 'Hazard 1');
    await click(page.getByRole('button', { name: 'Add hazard' }), 'Add hazard');
    await select(page.locator('#hazard-1'), 'Hazard 2', 2);
    await select(page.locator('#ppe-0'), 'PPE 1');
    for (const n of [1, 2]) {
      await click(page.getByRole('button', { name: 'Add PPE' }), 'Add PPE');
      await select(page.locator('#ppe-' + n), 'PPE ' + (n + 1), n + 1);
    }
    report.lototoGas = {
      lototoEnabled: await page.getByRole('checkbox', { name: /LOTOTO required/ }).isEnabled(),
      gasEnabled: await page.getByRole('checkbox', { name: /Gas testing required/ }).isEnabled(),
      note: 'Not required for General Work; left unchecked.',
    };

    await click(page.getByRole('button', { name: 'Next', exact: true }), 'Next (saves)');
    await page.getByRole('button', { name: 'Add executor' }).waitFor();
    screen('Crew assignment');
    report.crewOptions = await page.locator('#executor-0 option').allInnerTexts();
    // Two existing crew members alongside the primary executor (options 2 and 3; option 1 is the executor).
    for (const n of [1, 2]) {
      await click(page.getByRole('button', { name: 'Add executor' }), 'Add crew member');
      await select(page.locator('#executor-' + n), 'Crew member ' + n, n + 1);
    }

    await click(page.getByRole('button', { name: 'Next', exact: true }), 'Next (saves)');
    await page.locator('#ff-permit-2').waitFor();
    screen('Forms & check sheets');
    const requiredState = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[id^="ff-"]')]
          .filter((el) => el.labels?.[0]?.innerText.includes('*'))
          .map((el) => ({ id: el.id, label: el.labels[0].innerText.split('\n')[0], value: el.value })),
      );
    report.formFields.onArrival = await requiredState();
    await fill(page.locator('#ff-permit-2'), 'M/s Demo Contractors', 'Permit issued to (contractor firm)');
    await click(page.getByRole('button', { name: 'Me, now' }).first(), 'Sign: contractor supervisor (Me, now)');
    await click(page.getByRole('button', { name: 'Normal jobs or cold work at floor level' }), 'Type of work');
    await click(page.getByRole('button', { name: /^All yes/ }), 'All yes (2 precaution checks)');
    report.allYesAlternative = { individualAnswers: 2, allYes: 1, proposedWithConfirmation: 2 };
    report.formFields.afterEntry = await requiredState();
    report.formFields.signaturesNotExecutors = ['Job issued by', 'HOD of job issuer', 'Job authorised by', 'Job completion accepted by'];

    await click(page.getByRole('button', { name: 'Save draft', exact: true }), 'Save draft');
    await page.waitForLoadState('networkidle');
  } catch (error) {
    report.errors.push(String(error.stack || error));
    process.exitCode = 1;
  } finally {
    execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -c "delete from permits where title like 'P2 baseline %'"`);
    await browser.close();
    fs.writeFileSync(__dirname + '/p2-baseline-replay.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ typed: j.typedFields.length, clicks: j.clicks, screens: j.screens, writes: report.writes.map((w) => w.method + ' ' + w.path), errors: report.errors }, null, 1));
  }
})();
