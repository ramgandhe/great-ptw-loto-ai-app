// Closure-review P2 runtime check against the local Docker stack (reads only; nothing is saved).
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> node p2-runtime-check.cjs
// Uses the documented local demo accounts issuer@ptw.local and orgadmin@ptw.local.
const { chromium } = require(process.env.PW_MODULE);
const results = [];
const check = (name, ok, detail) => results.push({ name, ok, detail });

async function login(browser, email, password) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard');
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const errors = [];
  try {
    const issuer = await login(browser, 'issuer@ptw.local', 'admin');
    issuer.on('pageerror', (e) => errors.push(e.message));
    await issuer.goto('http://localhost:3000/permits', { waitUntil: 'networkidle' });
    await issuer.goto('http://localhost:3000/permits/new', { waitUntil: 'networkidle' });
    await issuer.locator('#workScope').fill('P2 check: unsaved scope text.');

    // Browser Back with unsaved changes asks; staying keeps the text.
    const dialogs = [];
    issuer.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await issuer.goBack();
    await issuer.waitForTimeout(800);
    check('Back with unsaved changes asks first', dialogs.some((m) => /unsaved changes/i.test(m)), dialogs);
    check('staying keeps the editor and the typed text', issuer.url().endsWith('/permits/new') && (await issuer.locator('#workScope').inputValue()) === 'P2 check: unsaved scope text.', issuer.url());

    // An in-app link asks too.
    dialogs.length = 0;
    await issuer.getByRole('link', { name: /^Home$/ }).first().click();
    await issuer.waitForTimeout(500);
    check('an in-app link with unsaved changes asks first', dialogs.length === 1 && issuer.url().endsWith('/permits/new'), { dialogs, url: issuer.url() });

    // Submit with gaps: field errors under the fields; the summary link focuses the field.
    await issuer.getByRole('radio', { name: 'General Work', exact: true }).click();
    await issuer.getByRole('button', { name: 'Submit permit', exact: true }).click();
    const summary = issuer.locator('#validation-summary');
    await summary.waitFor();
    check('location error shown under the field and tied to it', (await issuer.locator('#locationId-error').innerText()) === 'Location is required' && (await issuer.locator('#locationId').getAttribute('aria-describedby')) === 'locationId-error', await issuer.locator('#locationId').getAttribute('aria-invalid'));
    check('planned start (custom date field) carries the error attributes', (await issuer.locator('#plannedStartAt').getAttribute('aria-describedby')) === 'plannedStartAt-error');
    check('primary executor (custom person select) carries the error attributes', (await issuer.locator('#primary-executor').getAttribute('aria-invalid')) === 'true');
    await summary.getByRole('link', { name: 'Location is required' }).click();
    check('summary link focuses the field itself', await issuer.evaluate(() => document.activeElement?.id === 'locationId'));
    const formLink = summary.getByRole('link', { name: /^Safe work permit:/ });
    if (await formLink.count()) {
      await formLink.click();
      const focused = await issuer.evaluate(() => document.activeElement?.closest('[data-missing]') !== null);
      check('a form error focuses its first unanswered required question', focused);
      check('unanswered required questions are marked', (await issuer.getByText('Required before submitting').count()) > 0);
    } else {
      check('form error present for the check', false, await summary.innerText());
    }

    // People: Manage opens that person; adding offers existing sign-in accounts.
    const admin = await login(browser, 'orgadmin@ptw.local', 'orgadmin');
    admin.on('pageerror', (e) => errors.push(e.message));
    await admin.goto('http://localhost:3000/workforce/directory', { waitUntil: 'networkidle' });
    const firstEmployee = admin.locator('tbody tr').filter({ hasText: 'employee' }).first();
    const name = (await firstEmployee.locator('td').first().innerText()).trim();
    await firstEmployee.getByRole('button', { name: 'Manage' }).click();
    await admin.getByRole('heading', { name: `Edit ${name}` }).waitFor({ timeout: 15000 });
    check('Manage opens that person for editing in their list', true, name);
    await admin.getByRole('button', { name: 'Cancel' }).click();
    await admin.getByRole('button', { name: 'Add employee' }).first().click();
    const accountSelect = admin.getByLabel(/Existing sign-in account/);
    check('adding an employee offers existing sign-in accounts', (await accountSelect.count()) === 1 && (await accountSelect.locator('option').count()) > 1, await accountSelect.locator('option').count());
    await accountSelect.selectOption({ index: 1 });
    check('choosing an account fills the name and email', Boolean(await admin.locator('form input[type=email]').inputValue()));
    check('the form says no new login is created', await admin.getByText(/no new login or password is created/).isVisible());
    check('no page errors', errors.length === 0, errors);
  } catch (error) {
    check('script completed', false, String(error));
  } finally {
    console.log(JSON.stringify(results, null, 1));
    await browser.close();
  }
})();
