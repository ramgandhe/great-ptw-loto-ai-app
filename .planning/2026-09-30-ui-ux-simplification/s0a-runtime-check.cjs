// S0a runtime check against the local Docker stack (real writes to the local database only).
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_EMAIL/PTW_PASSWORD=<local demo issuer>
// PTW_EXECUTOR_EMAIL/PTW_EXECUTOR_PASSWORD=<local demo executor> node s0a-runtime-check.cjs
// Local Docker stack only; deletes its own "S0a check" drafts and cancels its submitted test permit.
const { chromium } = require(process.env.PW_MODULE);
const { execSync } = require('node:child_process');
const TITLE = 'S0a check ' + Date.now();
const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAF'|' -c "${sql}"`).toString().trim();
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(process.env.PTW_EMAIL);
    await page.locator('#password').fill(process.env.PTW_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');

    // 1. First save stores the whole form, not just type/title/scope.
    await page.goto('http://localhost:3000/permits/new', { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'General Work', exact: true }).click();
    await page.locator('#workScope').fill('Runtime check of the first save.');
    await page.locator('#title').fill(TITLE);
    await page.locator('#locationId').selectOption('00000000-0000-4000-8000-000000000105'); // Compressor Bay: plant comes from it
    for (const id of ['departmentId', 'primary-executor']) {
      const select = page.locator('#' + id);
      await select.locator('option').nth(1).waitFor({ state: 'attached' });
      await select.selectOption(await select.locator('option').nth(1).getAttribute('value'));
    }
    await page.getByRole('button', { name: 'Tomorrow, 08:00 to 16:00', exact: true }).click();
    const patched = page.waitForResponse((r) => r.request().method() === 'PATCH' && /\/permits\/[0-9a-f-]+$/.test(r.url()));
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const patch = await patched;
    check('follow-up save after create succeeded', patch.status() === 200, patch.status());
    const [id, locationId, start, revision, executors] = psql(
      `select p.id, p.location_id, p.planned_start_at, p.draft_revision, (select count(*) from permit_executors e where e.permit_id=p.id) from permits p where p.title='${TITLE}'`,
    ).split('|');
    check('first save stores location, schedule and executor', Boolean(locationId && start) && executors === '1', { locationId, start, revision, executors });
    check('create then full save leaves revision 1', revision === '1', { revision });

    // 2. A stale tab gets the conflict message, keeps its values, and re-saves explicitly.
    const other = await context.newPage();
    await other.goto(`http://localhost:3000/permits/${id}/edit`, { waitUntil: 'networkidle' });
    await other.locator('#title').fill(TITLE + ' (other tab)');
    await other.getByRole('button', { name: 'Save draft', exact: true }).click();
    await other.waitForLoadState('networkidle');
    await page.locator('#title').fill(TITLE + ' (first tab)');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'changed since you opened it' });
    await alert.waitFor();
    check('submit is not offered as clickable during the conflict', await page.getByRole('button', { name: 'Submit permit' }).count() === 0 || await page.getByRole('button', { name: 'Submit permit' }).isDisabled());
    const alertText = await alert.innerText();
    check('stale save shows the conflict message', /changed since you opened it/.test(alertText), alertText);
    check('typed value kept after conflict', (await page.locator('#title').inputValue()) === TITLE + ' (first tab)');
    check('database still has the other tab\'s save', psql(`select title from permits where id='${id}'`) === TITLE + ' (other tab)');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await alert.waitFor({ state: 'detached' });
    check('explicit re-save replaces it', psql(`select title from permits where id='${id}'`) === TITLE + ' (first tab)');

    // 3. A save without a revision (an old app) is refused with the update message.
    const status = await page.evaluate(async (permitId) => {
      const token = Object.entries(localStorage).find(([k]) => /access/i.test(k))?.[1] ?? sessionStorage.getItem('access_token');
      const res = await fetch(`http://localhost:4000/api/v1/permits/${permitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: 'no revision' }),
      });
      return { status: res.status, body: await res.text() };
    }, id);
    check('save without revision is refused with the update message', status.status === 400 && /update the app/.test(status.body), status);

    // 4. Full journey with real saves: executor prepares, issuer signs and submits. Signatures that
    //    belong to approval and closure must not block the submit.
    const issuerPage = page;
    const executorId = '00000000-0000-4000-8000-000000000015';
    const seed = await issuerPage.evaluate(async ([execId, title]) => {
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('ptw_access_token') };
      const api = (m, p, b) => fetch('http://localhost:4000/api/v1' + p, { method: m, headers, body: JSON.stringify(b) }).then((r) => r.json());
      const created = await api('POST', '/permits', { permitTypeId: '00000000-0000-4000-8000-000000000126', title, workScope: 'Full submit check.', currentStep: 0 });
      const day = new Date(Date.now() + 86400000);
      const at = (h) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h).toISOString();
      await api('PATCH', '/permits/' + created.data.permit.id, {
        expectedRevision: created.data.permit.draftRevision,
        plantId: '00000000-0000-4000-8000-000000000103', departmentId: '00000000-0000-4000-8000-000000000136',
        locationId: '00000000-0000-4000-8000-000000000105', plannedStartAt: at(8), plannedEndAt: at(16),
        executors: [{ workforceUserId: execId, isPrimary: true }], currentStep: 1,
      });
      return created.data.permit.id;
    }, [executorId, TITLE + ' (submit)']);

    const exec = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    exec.on('pageerror', (e) => pageErrors.push(e.message));
    await exec.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await exec.locator('#email').fill(process.env.PTW_EXECUTOR_EMAIL);
    await exec.locator('#password').fill(process.env.PTW_EXECUTOR_PASSWORD);
    await exec.getByRole('button', { name: 'Sign in', exact: true }).click();
    await exec.waitForURL('**/dashboard');
    await exec.goto(`http://localhost:3000/permits/${seed}/edit`, { waitUntil: 'networkidle' });
    await exec.locator('#workstationId').selectOption('00000000-0000-4000-8000-000000000110');
    await exec.locator('#machineryId').selectOption('00000000-0000-4000-8000-000000000111');
    await exec.getByRole('group', { name: 'Hazards' }).getByRole('button').first().click();
    await exec.getByRole('group', { name: 'PPE' }).getByRole('button').first().click();
    await exec.locator('#ff-permit-2').fill('M/s Demo Contractors');
    await exec.getByRole('button', { name: 'Me, now' }).first().click();
    await exec.getByRole('button', { name: 'Normal jobs or cold work at floor level' }).click();
    await exec.getByRole('button', { name: /^Confirm 2 unanswered checks as Yes/ }).click();
    await exec.getByRole('button', { name: 'I confirm these 2 checks are Yes' }).click();
    await exec.getByRole('button', { name: 'Save preparation', exact: true }).click();
    await exec.getByText('Saved. The job issuer reviews next.').waitFor();

    await issuerPage.goto(`http://localhost:3000/permits/${seed}/edit`, { waitUntil: 'networkidle' });
    await issuerPage.locator('li').filter({ hasText: 'Job issued by' }).getByRole('button', { name: 'Me, now' }).click();
    await issuerPage.getByRole('button', { name: 'Submit permit', exact: true }).click();
    await issuerPage.waitForURL(`**/permits/${seed}`);
    const [submittedStatus, responses] = psql(`select status, form_responses from permits where id='${seed}'`).split('|');
    const answers = JSON.parse(responses)[0]?.answers ?? {};
    check('full journey: issuer submit succeeds', submittedStatus === 'pending_approval', submittedStatus);
    check('full journey: approval and closure signatures were not needed to submit', !answers['authorisation-2'] && !answers['completion-1'], Object.keys(answers));
    const audits = Number(psql(`select count(*) from audit_logs where entity_id='${seed}' and action='permit.form_answer_changed'`));
    check('full journey: each saved answer has an audit row', audits >= 10, audits);

    check('no page errors', pageErrors.length === 0, pageErrors);
  } catch (error) {
    check('script completed', false, String(error));
  } finally {
    console.log(JSON.stringify(results, null, 1));
    // Approval history is immutable, so a submitted test permit cannot be deleted: cancel it instead.
    psql(`update permits set status='cancelled' where title like 'S0a check %' and status <> 'draft'`);
    psql(`delete from permits where title like 'S0a check %' and status = 'draft'`);
    await browser.close();
  }
})();
