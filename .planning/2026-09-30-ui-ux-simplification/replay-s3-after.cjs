// S3 after-measurement of H1 (site hierarchy in setup) and E1 (new employee from People), same
// counting contract as journey-baselines.md.
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_UX_ORGADMIN_EMAIL/_PASSWORD node replay-s3-after.cjs
// Local Docker stack only. H1 saves for real to check the stored parent links, then deletes its
// records; E1 intercepts its write, like the baseline, because a real employee creates a login.
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const STAMP = String(Date.now()).slice(-6);
const NAMES = { plant: `S3 Plant ${STAMP}`, department: `S3 Department ${STAMP}`, location: `S3 Location ${STAMP}`, workstation: `S3 Workstation ${STAMP}` };
const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAF'|' -c "${sql}"`).toString().trim();
const report = { method: 'Same counting contract as journey-baselines.md.', journeys: [], checks: [], errors: [] };
let j;
const begin = (name, start) => { j = { name, start, steps: [], screens: [], typedFields: [], clicks: 0 }; report.journeys.push(j); };
const screen = (name) => j.screens.push(name);
const click = async (locator, label) => { await locator.click(); j.steps.push({ action: label, clicks: 1 }); j.clicks += 1; };
const fill = async (locator, value, label) => { await locator.fill(value); j.typedFields.push(label); j.steps.push({ action: 'Type ' + label, clicks: 0 }); };
const select = async (locator, label) => {
  await locator.locator('option').nth(1).waitFor({ state: 'attached' });
  await locator.selectOption(await locator.locator('option').nth(1).getAttribute('value'));
  j.steps.push({ action: 'Select ' + label, clicks: 2 });
  j.clicks += 2;
};
const check = (name, ok, detail) => report.checks.push({ name, ok, detail });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })).newPage();
  page.on('pageerror', (e) => report.errors.push('page error: ' + e.message));
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(process.env.PTW_UX_ORGADMIN_EMAIL);
    await page.locator('#password').fill(process.env.PTW_UX_ORGADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');

    // H1: plant, its department, a location in that department, a workstation at that location.
    begin('H1 Four-record site hierarchy (S3)', '/organisation/setup');
    await page.goto('http://localhost:3000/organisation/setup', { waitUntil: 'networkidle' });
    screen('Setup overview');
    await click(page.getByRole('link', { name: /Sites and equipment/ }), 'Sites and equipment area');
    await page.locator('#step-plants').waitFor();
    screen('Sites and equipment');
    const add = async (key, label, name) => {
      const block = page.locator(`#step-${key}`);
      await click(block.getByRole('button', { name: `Add ${label}`, exact: true }), `Open ${label}`);
      await fill(block.getByLabel(new RegExp(`^${label[0].toUpperCase()}${label.slice(1)} name`, 'i')), name, `${label} name`);
      // Code is suggested from the name on blur; workstations require one.
      await block.getByLabel(new RegExp(`^${label[0].toUpperCase()}${label.slice(1)} name`, 'i')).blur();
      const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/${key}`));
      await click(block.locator('form').getByRole('button', { name: `Add ${label}`, exact: true }), `Save ${label}`);
      const response = await saved;
      check(`H1 ${label} saved`, response.status() === 201, response.status());
      await page.waitForLoadState('networkidle');
    };
    await add('plants', 'plant', NAMES.plant);
    await add('departments', 'department', NAMES.department);
    await add('locations', 'location', NAMES.location);
    await add('workstations', 'workstation', NAMES.workstation);
    const [plantId, deptPlant, locDept, wsLoc, deptId, locId] = psql(
      `select p.id, d.plant_id, l.department_id, w.location_id, d.id, l.id from plants p, departments d, locations l, workstation_catalogue w where p.name='${NAMES.plant}' and d.name='${NAMES.department}' and l.name='${NAMES.location}' and w.name='${NAMES.workstation}'`,
    ).split('|');
    check('H1 department stored under the new plant', deptPlant === plantId, { plantId, deptPlant });
    check('H1 location stored under the new department', locDept === deptId, { deptId, locDept });
    check('H1 workstation stored at the new location', wsLoc === locId, { locId, wsLoc });

    // E1: a new employee with a department, from People (write intercepted).
    const writes = [];
    await page.route('**/api/v1/employees', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      writes.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { success: true, data: { id: '00000000-0000-4000-8000-0000000000e1', name: 'Review Benchmark Person', email: 'ux-benchmark@example.invalid', loginCreated: false } } });
    });
    begin('E1 New employee with department (S3)', '/workforce/directory');
    await page.goto('http://localhost:3000/workforce/directory', { waitUntil: 'networkidle' });
    screen('People');
    await click(page.getByRole('button', { name: 'Add employee', exact: true }), 'Add employee');
    await fill(page.getByLabel('Full name', { exact: false }), 'Review Benchmark Person', 'Full name');
    await fill(page.locator('form input[type=email]'), 'ux-benchmark@example.invalid', 'Email');
    await select(page.locator('form').getByLabel('Department', { exact: false }), 'Department');
    await click(page.locator('form').getByRole('button', { name: 'Add employee', exact: true }), 'Save employee');
    await page.waitForLoadState('networkidle');
    check('E1 one employee write with name, email and department', writes.length === 1 && writes[0].name && writes[0].email && writes[0].departmentId, writes);
    check('E1 stayed on the People page', page.url().endsWith('/workforce/directory'), page.url());
  } catch (error) {
    report.errors.push(String(error.stack || error));
    process.exitCode = 1;
  } finally {
    psql(`delete from workstation_catalogue where name='${NAMES.workstation}'`);
    psql(`delete from locations where name='${NAMES.location}'`);
    psql(`delete from departments where name='${NAMES.department}'`);
    psql(`delete from plants where name='${NAMES.plant}'`);
    await browser.close();
    fs.writeFileSync(__dirname + '/s3-after-replay.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
      journeys: report.journeys.map((x) => ({ name: x.name, typed: x.typedFields.length, clicks: x.clicks, screens: x.screens.length })),
      failedChecks: report.checks.filter((c) => !c.ok),
      passedChecks: report.checks.filter((c) => c.ok).length,
      errors: report.errors,
    }, null, 1));
  }
})();
