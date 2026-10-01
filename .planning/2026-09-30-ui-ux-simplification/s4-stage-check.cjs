// S4 stage answers runtime check against the local Docker stack (real writes to the local database only).
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_EMAIL/PTW_PASSWORD=<local demo issuer>
// PTW_HOD_EMAIL/PTW_HOD_PASSWORD=<local demo HOD> node s4-stage-check.cjs
// The HOD approves a permit whose Safe work permit form has the two approval-stage signatures empty:
// refused first, then signed beside the decision and approved; then verified and closed the same way.
// A run that reaches closure leaves one closed "S4 check" permit in the local archive (closed permits are read-only).
const { chromium } = require(process.env.PW_MODULE);
const { execSync } = require('node:child_process');
const TITLE = 'S4 check ' + Date.now();
const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAF'|' -c "${sql}"`).toString().trim();
// Direct status changes bypass the API, so drop the API's cached copies of permits and queues.
const flushPermitCache = () =>
  execSync(`docker exec great-ptw-loto-ai-app-redis-1 sh -c "redis-cli --scan --pattern 'permit:*' | xargs -r redis-cli del"`);
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

async function login(browser, email, password, errors) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const pageErrors = [];
  try {
    const issuer = await login(browser, process.env.PTW_EMAIL, process.env.PTW_PASSWORD, pageErrors);
    const safeWork = psql(`select id from permit_templates where code='SOP-ES-023-F1' and status='published' and tenant_id=(select tenant_id from permit_types where id='00000000-0000-4000-8000-000000000126')`);
    const id = await issuer.evaluate(async ([title, templateId]) => {
      const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('ptw_access_token') };
      const api = (m, p, b) => fetch('http://localhost:4000/api/v1' + p, { method: m, headers, body: JSON.stringify(b) }).then((r) => r.json());
      const created = await api('POST', '/permits', { permitTypeId: '00000000-0000-4000-8000-000000000126', title, workScope: 'Stage answer check.', currentStep: 0 });
      await api('PATCH', '/permits/' + created.data.permit.id, {
        expectedRevision: created.data.permit.draftRevision,
        formResponses: [{ templateId, answers: { 'authorisation-1': { name: 'Issuer' } } }],
      });
      return created.data.permit.id;
    }, [TITLE, safeWork]);
    // Skip the submit form-filling (covered by s0a-runtime-check): put the draft straight into review.
    psql(`update permits set status='pending_approval', submitted_by=created_by, submitted_at=now() where id='${id}'`);
    flushPermitCache();

    const hod = await login(browser, process.env.PTW_HOD_EMAIL, process.env.PTW_HOD_PASSWORD, pageErrors);
    // Approval through the workspace's Review tab; closure below through its own route, so both paths are covered.
    await hod.goto(`http://localhost:3000/permits/${id}?tab=review`, { waitUntil: 'networkidle' });
    await hod.getByRole('radio', { name: 'Approve' }).click();
    const legend = hod.getByText('Sign the form for approval');
    check('approval shows the approval-stage fields beside the decision', await legend.isVisible());
    check('approval says how many are left', await hod.getByText('2 left to sign').isVisible());

    const confirm = hod.getByRole('button', { name: /^Approve/ }).last();
    await confirm.click();
    const refused = hod.getByRole('alert').filter({ hasText: 'Complete these before approving' });
    await refused.waitFor();
    check('approving without the signatures is refused with the field names', /HOD of job issuer/.test(await refused.innerText()), await refused.innerText());
    check('refused approval changed nothing', psql(`select status from permits where id='${id}'`) === 'pending_approval');

    for (const label of ['HOD of job issuer', 'Job authorised by']) {
      await hod.locator('div.grid').filter({ has: hod.locator('label', { hasText: label }) }).getByRole('button', { name: 'Me, now' }).last().click();
    }
    check('signing clears the count', (await hod.getByText(/left to sign/).count()) === 0);
    const approved = hod.waitForResponse((r) => r.url().endsWith(`/approvals/${id}/approve`));
    await confirm.click();
    check('signed approval succeeds', (await approved).status() < 300);
    await hod.waitForLoadState('networkidle');
    const [status, responses, revision] = psql(`select status, form_responses, draft_revision from permits where id='${id}'`).split('|');
    const answers = JSON.parse(responses)[0]?.answers ?? {};
    check('permit approved', status === 'approved', status);
    check('both approval signatures stored, issuer signature kept', Boolean(answers['authorisation-2']?.name && answers['authorisation-3']?.name && answers['authorisation-1']?.name === 'Issuer'), answers);
    check('revision bumped by the stage answers', Number(revision) === 2, revision);
    const audits = psql(`select count(*) from audit_logs where entity_id='${id}' and action='permit.form_answer_changed' and (metadata->>'revision')::int = 2`);
    check('each signature audited under the HOD', audits === '2', audits);

    // Closure: the issuer verifies without signing completion; the HOD cannot close until it is signed.
    psql(`update permits set status='execution_completed' where id='${id}'`);
    flushPermitCache();
    await issuer.goto(`http://localhost:3000/closure/${id}`, { waitUntil: 'networkidle' });
    check('verification shows the closure-stage field', await issuer.getByText('Sign the form for closure').isVisible());
    for (const box of await issuer.getByRole('checkbox').all()) await box.check();
    await issuer.getByPlaceholder('Verification comments (required)').fill('Checked on site.');
    await issuer.getByRole('button', { name: 'Submit verification' }).click();
    await issuer.getByText(/Verification submitted/).waitFor();
    check('verification without the completion signature is accepted', psql(`select status from permits where id='${id}'`) === 'pending_closure');

    await hod.goto(`http://localhost:3000/closure/${id}`, { waitUntil: 'networkidle' });
    for (const box of await hod.getByRole('checkbox').all()) await box.check();
    check('close is held until the completion is signed', (await hod.getByText('1 left to sign before closing').isVisible()) && (await hod.getByRole('button', { name: 'Close permit' }).isDisabled()));
    await hod.locator('div.grid').filter({ has: hod.locator('label', { hasText: 'Job completion accepted by' }) }).getByRole('button', { name: 'Me, now' }).last().click();
    await hod.getByRole('button', { name: 'Close permit' }).click();
    await hod.locator('#closure-comment').fill('Closed after completion was accepted.');
    await hod.getByRole('dialog').getByRole('button', { name: 'Close permit' }).click();
    await hod.waitForURL('**/closure/archive');
    const [closedStatus, closedResponses] = psql(`select status, form_responses from permits where id='${id}'`).split('|');
    check('signed closure closes the permit', closedStatus === 'closed', closedStatus);
    check('completion signature stored', Boolean(JSON.parse(closedResponses)[0]?.answers['completion-1']?.name));
    check('no page errors', pageErrors.length === 0, pageErrors);
  } catch (error) {
    check('script completed', false, String(error));
  } finally {
    console.log(JSON.stringify(results, null, 1));
    // Closed permits are read-only (and archived) by design, so a fully closed test permit stays.
    psql(`update permits set status='cancelled' where title like 'S4 check %' and status not in ('draft', 'closed', 'cancelled')`);
    psql(`delete from permits where title like 'S4 check %' and status = 'draft'`);
    flushPermitCache();
    await browser.close();
  }
})();
