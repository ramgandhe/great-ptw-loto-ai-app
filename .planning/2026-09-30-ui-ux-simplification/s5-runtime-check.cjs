// S5 runtime check against the local Docker stack (real writes to the local database only).
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> PTW_HOD_EMAIL/PTW_HOD_PASSWORD=<local demo HOD>
// OUT=<screenshot folder> node s5-runtime-check.cjs
// Seeds one ready LOTOTO plan with two isolation points ("S5 check …"), then as the HOD: isolates it point by point,
// restores it point by point, and checks the dashboard, messages, a clash and an incident. The plan and its
// execution records stay in the local database (isolation and restoration records are audit history).
const { chromium } = require(process.env.PW_MODULE);
const { execSync } = require('node:child_process');
const TENANT = '00000000-0000-4000-8000-000000000001';
const TITLE = 'S5 check ' + Date.now();
const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAF'|' -c "${sql}"`).toString().trim().split('\n')[0];
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

(async () => {
  const planId = psql(`insert into lototo_plans (tenant_id, machinery_id, title, status) values ('${TENANT}', '00000000-0000-4000-8000-000000000112', '${TITLE}', 'ready') returning id`);
  const points = ['S5-A', 'S5-B'].map((n) =>
    psql(`insert into isolation_points (plan_id, machinery_id, isolation_number, description, verification_required) values ('${planId}', '00000000-0000-4000-8000-000000000112', '${n}', 'Check point ${n}', true) returning id`),
  );
  points.forEach((id, i) => psql(`insert into isolation_sequences (plan_id, isolation_point_id, sequence_order, requires_verification) values ('${planId}', '${id}', ${i + 1}, true) returning id`));

  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => page.screenshot({ path: `${process.env.OUT}/${name}.png`, fullPage: true });
  const chip = (n) => page.getByRole('navigation', { name: 'Isolation points' }).getByRole('button', { name: new RegExp(n) });
  const done = (text) => page.getByRole('status').filter({ hasText: text }).waitFor();
  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.locator('#email').fill(process.env.PTW_HOD_EMAIL);
    await page.locator('#password').fill(process.env.PTW_HOD_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');

    // LOTOTO execution: one point at a time, in order.
    await page.goto(`http://localhost:3000/lototo/execute/${planId}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Start isolation execution' }).click();
    await page.getByText('2 of 2 points to do').waitFor();
    check('execution opens on point 1 with point 2 waiting', (await chip('S5-B').isDisabled()) && (await page.locator('#point-heading').innerText()).includes('S5-A'));
    await page.getByLabel('Lock tag').fill('L-S5-1');
    await page.getByRole('button', { name: 'Apply lock' }).click();
    await done('Lock applied');
    check('locking point 1 opens point 2', !(await chip('S5-B').isDisabled()));
    await page.getByLabel('Tag number').fill('T-S5-1');
    await page.getByRole('button', { name: 'Apply tag' }).click();
    await done('Tag applied');
    await page.getByRole('button', { name: 'Record pass verification' }).click();
    await done('Verification recorded');
    check('a finished point moves the work to the next point', (await page.locator('#point-heading').innerText()).includes('S5-B') && (await page.getByText('Finished points (1)').isVisible()));
    check('isolation cannot be marked complete with a point unlocked', await page.getByRole('button', { name: 'Mark isolation complete' }).isDisabled());
    await page.getByLabel('Lock tag').fill('L-S5-2');
    await page.getByRole('button', { name: 'Apply lock' }).click();
    await done('Lock applied');
    await page.getByLabel('Tag number').fill('T-S5-2');
    await page.getByRole('button', { name: 'Apply tag' }).click();
    await done('Tag applied');
    await page.getByRole('button', { name: 'Record pass verification' }).click();
    await done('Verification recorded');
    await shot('lototo-execute-all-done');
    await page.getByRole('button', { name: 'Mark isolation complete' }).click();
    await done('Isolation marked complete');
    await page.getByRole('button', { name: 'Complete verification' }).click();
    await done('Isolation verified');
    const [executionId, status] = psql(`select id, status from isolation_execution where plan_id='${planId}'`).split('|');
    check('isolation verified', status === 'verified', status);

    // Restoration: what is still on, point by point, each step confirmed.
    await page.goto(`http://localhost:3000/lototo/restoration/${executionId}`, { waitUntil: 'networkidle' });
    await page.getByText('Still on: 2 locks, 2 tags; 2 of 2 points to restore').waitFor();
    check('restoration header counts what is still on', true);
    check('complete restoration held until points are restored', await page.getByRole('button', { name: 'Complete restoration' }).isDisabled());
    for (let point = 1; point <= 2; point += 1) {
      await page.getByRole('button', { name: 'Remove lock' }).click();
      await done('Lock removed');
      await page.getByRole('button', { name: 'Remove tag' }).click();
      await done('Tag removed');
      await page.getByRole('button', { name: 'Restore point' }).click();
      await done('Equipment restored');
      await page.getByRole('button', { name: 'Record verification' }).click();
      await done('Restoration verified');
    }
    await shot('lototo-restoration-ready');
    await page.getByRole('button', { name: 'Complete restoration' }).click();
    await done('Restoration complete');
    check('restoration complete', psql(`select status from isolation_execution where id='${executionId}'`) === 'restored');

    // Dashboard: a failed queue read is never "all caught up".
    await page.route('**/api/v1/approvals', (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, json: { success: false } }) : route.continue()));
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    const warning = page.getByRole('alert').filter({ hasText: 'Could not check your approvals' });
    await warning.waitFor();
    check('dashboard names the queue it could not read, with Retry', await warning.getByRole('button', { name: 'Retry' }).isVisible());
    await page.unroute('**/api/v1/approvals');
    await warning.getByRole('button', { name: 'Retry' }).click();
    await warning.waitFor({ state: 'detached' });
    check('retry clears the warning once the read works', true);
    await shot('dashboard');

    // Messages: opening the record is the main move.
    await page.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle' });
    const open = page.getByRole('link', { name: /^Open (permit|review|incident|clash|LOTOTO plan|billing|work|closure)$/ });
    check('messages offer Open <record> buttons', (await open.count()) > 0, await open.count());
    await shot('notifications');

    await page.goto('http://localhost:3000/simops/conflicts/00000000-0000-4000-8000-000000000601', { waitUntil: 'networkidle' });
    check('clash shows the permits side by side with the overlap', await page.getByText(/^Overlap:/).isVisible());
    check('reject form opens only on request', (await page.getByLabel('Rejection reason').count()) === 0 && (await page.getByRole('button', { name: 'Reject and suspend permits…' }).isVisible()));
    await shot('simops-conflict');

    await page.goto('http://localhost:3000/incidents/00000000-0000-4000-8000-000000000502', { waitUntil: 'networkidle' });
    check('incident leads with who acts next', (await page.getByText('HOD decides whether work continues').isVisible()) && (await page.getByText('Your decision is needed').isVisible()));
    await shot('incident');
    check('no page errors', errors.length === 0, errors);
  } catch (error) {
    check('script completed', false, String(error));
  } finally {
    console.log(JSON.stringify(results, null, 1));
    await browser.close();
  }
})();
