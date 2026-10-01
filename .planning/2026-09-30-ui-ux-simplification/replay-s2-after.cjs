// S2 after-measurement of P1 and P2 on the one-page permit editor, same counting contract as the baselines.
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_UX_ISSUER_EMAIL/_PASSWORD and
// PTW_UX_EXECUTOR_EMAIL/_PASSWORD (local demo accounts) node replay-s2-after.cjs
// Local Docker stack only. P1 saves for real (to check what is stored); P2 intercepts the executor's writes
// like its baseline. Every "S2 after" permit is deleted at the end.
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const STAMP = Date.now();
const IDS = {
  generalWork: '00000000-0000-4000-8000-000000000126',
  demoPlant: '00000000-0000-4000-8000-000000000103',
  maintenance: '00000000-0000-4000-8000-000000000136',
  compressorBay: '00000000-0000-4000-8000-000000000105',
  operator: process.env.PTW_UX_EXECUTOR_ID || '00000000-0000-4000-8000-000000000015',
};
const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAF'|' -c "${sql}"`).toString().trim();
const report = { method: 'Same counting contract as journey-baselines.md.', journeys: [], checks: [], errors: [] };
let j;
const begin = (name, start) => { j = { name, start, steps: [], screens: [], typedFields: [], clicks: 0 }; report.journeys.push(j); };
const screen = (name) => j.screens.push(name);
const click = async (locator, label) => { await locator.click(); j.steps.push({ action: label, clicks: 1 }); j.clicks += 1; };
const fill = async (locator, value, label) => { await locator.fill(value); j.typedFields.push(label); j.steps.push({ action: 'Type ' + label, clicks: 0 }); };
const select = async (locator, label, value) => {
  await locator.locator('option').nth(1).waitFor({ state: 'attached' });
  await locator.selectOption(value ?? (await locator.locator('option').nth(1).getAttribute('value')));
  j.steps.push({ action: 'Select ' + label, clicks: 2 });
  j.clicks += 2;
};
const check = (name, ok, detail) => report.checks.push({ name, ok, detail });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const login = async (email, password) => {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })).newPage();
    page.on('pageerror', (e) => report.errors.push('page error: ' + e.message));
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
    // P1: issuer creates and assigns a fresh routine permit.
    const issuer = await login(process.env.PTW_UX_ISSUER_EMAIL, process.env.PTW_UX_ISSUER_PASSWORD);
    begin('P1 New permit issuer preparation (S2)', '/permits');
    await issuer.goto('http://localhost:3000/permits', { waitUntil: 'networkidle' });
    screen('Permit list');
    await click(issuer.getByRole('link', { name: /New permit|Create permit/i }).first(), 'New permit');
    await issuer.locator('#workScope').waitFor();
    screen('Permit editor');
    await click(issuer.getByRole('radio', { name: 'General Work', exact: true }), 'General Work type');
    const scope = `S2 after ${STAMP}: inspect the marked walkway before routine work. Sweep it afterwards.`;
    await fill(issuer.locator('#workScope'), scope, 'Work scope');
    const title = await issuer.locator('#title').inputValue();
    check('P1 title suggested from the scope', title === `S2 after ${STAMP}: inspect the marked walkway before routine work`, title);
    await select(issuer.locator('#locationId'), 'Location', IDS.compressorBay);
    check('P1 plant shown from the location', (await issuer.locator('#section-place').innerText()).includes('Demo Plant, from the location'));
    await select(issuer.locator('#departmentId'), 'Department');
    await select(issuer.locator('#primary-executor'), 'Primary executor');
    await click(issuer.getByRole('button', { name: 'Tomorrow, 08:00 to 16:00', exact: true }), 'Tomorrow schedule');
    const saved = issuer.waitForResponse((r) => r.request().method() === 'PATCH' && /\/permits\/[0-9a-f-]+$/.test(r.url()));
    await click(issuer.getByRole('button', { name: 'Save draft', exact: true }), 'Save draft');
    check('P1 save succeeded', (await saved).status() === 200);
    await issuer.getByText('Saved', { exact: true }).waitFor();
    const [plantId, departmentId, locationId, start, executors] = psql(
      `select p.plant_id, p.department_id, p.location_id, p.planned_start_at, (select count(*) from permit_executors e where e.permit_id=p.id) from permits p where p.title like 'S2 after ${STAMP}%'`,
    ).split('|');
    check('P1 stored plant derived from location', plantId === IDS.demoPlant && locationId === IDS.compressorBay, { plantId, locationId });
    check('P1 stored department, schedule and executor', Boolean(departmentId && start) && executors === '1', { departmentId, start, executors });

    // P2: executor prepares site, crew and forms on a seeded handoff draft (writes intercepted).
    const created = await call(issuer, 'POST', '/permits', {
      permitTypeId: IDS.generalWork, title: `S2 after P2 ${STAMP}`, workScope: 'Inspect the marked walkway before routine work.', currentStep: 0,
    });
    const id = created.data.permit.id;
    const day = new Date(Date.now() + 86400000);
    const local = (h) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).toISOString();
    const seeded = await call(issuer, 'PATCH', '/permits/' + id, {
      expectedRevision: created.data.permit.draftRevision,
      plantId: IDS.demoPlant, departmentId: IDS.maintenance, locationId: IDS.compressorBay,
      plannedStartAt: local(8), plannedEndAt: local(16),
      executors: [{ workforceUserId: IDS.operator, isPrimary: true }], currentStep: 1,
    });
    if (!seeded.success) throw new Error('Seed failed: ' + seeded.error?.message);

    const op = await login(process.env.PTW_UX_EXECUTOR_EMAIL, process.env.PTW_UX_EXECUTOR_PASSWORD);
    const writes = [];
    await op.route('**/api/v1/**', async (route) => {
      const req = route.request();
      if (req.method() === 'GET') return route.continue();
      writes.push({ method: req.method(), body: req.postDataJSON?.() ?? null });
      return route.fulfill({ response: await route.fetch({ method: 'GET', postData: undefined }) });
    });
    begin('P2 Executor preparation (S2)', '/dashboard');
    await op.goto('http://localhost:3000/dashboard', { waitUntil: 'load' });
    screen('Dashboard (Needs you)');
    const link = op.getByRole('link').filter({ hasText: `S2 after P2 ${STAMP}` }).first();
    await link.waitFor({ timeout: 45000 });
    await click(link, 'Open assigned draft from Needs you');
    await op.locator('#workstationId').waitFor();
    screen('Permit editor');
    await op.waitForTimeout(500);
    const siteTop = await op.locator('#section-site').evaluate((el) => el.getBoundingClientRect().top);
    // Lands just below the sticky headers: in the top half of the window, not at the top of the page.
    check('P2 editor opens at Site and crew', siteTop > 0 && siteTop < 450, siteTop);
    await select(op.locator('#workstationId'), 'Workstation');
    await select(op.locator('#machineryId'), 'Machinery');
    const hazards = op.getByRole('group', { name: 'Hazards' }).getByRole('button');
    await click(hazards.nth(0), 'Hazard 1');
    await click(hazards.nth(1), 'Hazard 2');
    const ppe = op.getByRole('group', { name: 'PPE' }).getByRole('button');
    for (const n of [0, 1, 2]) await click(ppe.nth(n), 'PPE ' + (n + 1));
    await select(op.locator('#add-crew'), 'Crew member 1');
    await select(op.locator('#add-crew'), 'Crew member 2');
    await fill(op.locator('#ff-permit-2'), 'M/s Demo Contractors', 'Permit issued to (contractor firm)');
    await click(op.getByRole('button', { name: 'Me, now' }).first(), 'Sign: contractor supervisor (Me, now)');
    await click(op.getByRole('button', { name: 'Normal jobs or cold work at floor level' }), 'Type of work');
    await click(op.getByRole('button', { name: /^Confirm 2 unanswered checks as Yes/ }), 'Confirm unanswered checks (opens confirmation)');
    const confirmText = await op.getByRole('group', { name: 'Confirm these 2 checks are Yes' }).innerText();
    check('P2 confirmation lists the exact checks', /notified about the nature of work/.test(confirmText) && /oil and slippery floor/.test(confirmText));
    await click(op.getByRole('button', { name: 'I confirm these 2 checks are Yes' }), 'I confirm these 2 checks are Yes');
    const formHeader = await op.getByRole('article', { name: 'Safe work permit' }).locator('header').innerText();
    // Only the issuer's own signature is left; the issuer gives it before submitting.
    const review = await op.locator('#section-review').innerText();
    check('P2 only the issuer signature is left on the form', /1 required left/.test(formHeader) && /Job issued by/.test(review), { formHeader, review });
    await click(op.getByRole('button', { name: 'Save preparation', exact: true }), 'Save preparation');
    await op.getByText('Saved. The job issuer reviews next.').waitFor();
    const body = writes.at(-1)?.body ?? {};
    check('P2 save carries revision and only executor fields', body.expectedRevision !== undefined && body.title === undefined && body.locationId === undefined, Object.keys(body));
    check('P2 save holds 2 hazards, 3 PPE, 3 crew', body.hazards?.length === 2 && body.ppe?.length === 3 && body.executors?.length === 3, {
      hazards: body.hazards?.length, ppe: body.ppe?.length, executors: body.executors?.length,
    });
    report.p2Writes = writes.length;
  } catch (error) {
    report.errors.push(String(error.stack || error));
    process.exitCode = 1;
  } finally {
    psql(`delete from permits where title like 'S2 after %'`);
    await browser.close();
    fs.writeFileSync(__dirname + '/s2-after-replay.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      journeys: report.journeys.map((x) => ({ name: x.name, typed: x.typedFields.length, clicks: x.clicks, screens: x.screens.length })),
      failedChecks: report.checks.filter((c) => !c.ok),
      passedChecks: report.checks.filter((c) => c.ok).length,
      errors: report.errors,
    }, null, 1));
  }
})();
