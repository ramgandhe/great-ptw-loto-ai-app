// S7 web route sweep: every route in route-inventory.md, signed in as each listed account, at 1440 and 390 px.
// Run: PW_MODULE=<playwright module> PW_CHROME=<chromium binary> ACCOUNTS="orgadmin@ptw.local:orgadmin,hod@ptw.local:admin"
//      node s7-route-sweep.cjs > s7-route-sweep.json   (local Docker stack only; reads, no writes)
// Per route: where it landed (redirects such as /unauthorized are recorded, not failures), page errors,
// error text on the page, horizontal overflow, and whether it rendered a top heading.
const { chromium } = require(process.env.PW_MODULE);
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const psql = (sql) =>
  execSync(`docker exec great-ptw-loto-ai-app-postgres-1 psql -U ptw -d ptw_platform -tAc "${sql}"`).toString().trim().split('\n')[0];
const ID = {
  permit: '00000000-0000-4000-8000-000000000202',
  approval: '00000000-0000-4000-8000-000000000202',
  closure: '00000000-0000-4000-8000-000000000209',
  archive: '00000000-0000-4000-8000-000000000210',
  execution: '00000000-0000-4000-8000-000000000206',
  incident: '00000000-0000-4000-8000-000000000501',
  plan: '00000000-0000-4000-8000-000000000401',
  planExec: '00000000-0000-4000-8000-000000000403',
  // Records of the demo company, which every listed account belongs to.
  restoration: psql("select e.id from isolation_execution e join lototo_plans p on p.id = e.plan_id where p.tenant_id = '00000000-0000-4000-8000-000000000001' and e.status in ('verified','restored') limit 1"),
  conflict: '00000000-0000-4000-8000-000000000601',
  resolved: psql("select id from simops_conflicts where tenant_id = '00000000-0000-4000-8000-000000000001' and status in ('approved','rejected') limit 1"),
  template: psql("select id from permit_templates where tenant_id='00000000-0000-4000-8000-000000000001' limit 1"),
};
// A route whose record type has no example in the local data is reported as skipped, not visited.
for (const key of Object.keys(ID)) ID[key] = ID[key] || 'NO-SAMPLE';

function routes() {
  const md = fs.readFileSync(__dirname + '/route-inventory.md', 'utf8');
  return [...md.matchAll(/^\| web \| .*?\]\(\.\.\/\.\.\/frontend\/src\/app\/(.*?)\/?page\.tsx\)/gm)].map(([, file]) => {
    const path = '/' + file.replace(/\([^)]*\)\/?/g, '').replace(/\/$/, '');
    return path
      .replace(/^\/approvals\/\[permitId\]/, `/approvals/${ID.approval}`)
      .replace(/^\/closure\/archive\/\[permitId\]/, `/closure/archive/${ID.archive}`)
      .replace(/^\/closure\/\[permitId\]/, `/closure/${ID.closure}`)
      .replace(/^\/execution\/\[permitId\]/, `/execution/${ID.execution}`)
      .replace(/^\/incidents\/\[id\]/, `/incidents/${ID.incident}`)
      .replace(/^\/lototo\/(execute|history)\/\[planId\]/, `/lototo/$1/${ID.planExec}`)
      .replace(/^\/lototo\/plans\/\[id\]/, `/lototo/plans/${ID.plan}`)
      .replace(/^\/lototo\/restoration\/\[executionId\]/, `/lototo/restoration/${ID.restoration}`)
      .replace(/^\/simops\/conflicts\/\[id\]/, `/simops/conflicts/${ID.conflict}`)
      .replace(/^\/simops\/history\/\[id\]/, `/simops/history/${ID.resolved}`)
      .replace(/^\/organisation\/templates\/\[id\]/, `/organisation/templates/${ID.template}`)
      .replace(/^\/permits\/\[id\]/, `/permits/${ID.permit}`)
      .replace(/^$/, '/');
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PW_CHROME });
  const list = [...new Set(routes())];
  const results = [];
  for (const account of (process.env.ACCOUNTS ?? 'orgadmin@ptw.local:orgadmin').split(',')) {
    const [email, password] = account.split(':');
    for (const width of [1440, 390]) {
      const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
      let errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL('**/dashboard', { timeout: 60000 });
      const notification = await page.evaluate(async () => {
        const r = await fetch('http://localhost:4000/api/v1/notifications', { headers: { Authorization: 'Bearer ' + localStorage.getItem('ptw_access_token') } });
        return (await r.json()).data?.[0]?.id ?? null;
      });
      for (const raw of list) {
        const path = raw.replace('/notifications/[id]', `/notifications/${notification}`);
        if (path.includes('NO-SAMPLE')) {
          results.push({ account: email, width, path, skipped: 'no example record in the local data' });
          continue;
        }
        errors = [];
        try {
          await page.goto('http://localhost:3000' + path, { waitUntil: 'networkidle', timeout: 45000 });
        } catch {
          await page.waitForTimeout(1500);
        }
        await page.waitForTimeout(400);
        const state = await page.evaluate(() => ({
          landed: location.pathname + location.search,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          headings: document.querySelectorAll('h1').length,
          errorText: [...document.querySelectorAll('[role=alert]')].map((el) => el.textContent.trim()).filter(Boolean).slice(0, 2),
          stillLoading: /^Loading\b/.test(document.querySelector('main')?.innerText.trim() ?? ''),
        }));
        results.push({ account: email, width, path, ...state, pageErrors: errors.slice(0, 2) });
      }
      await page.context().close();
    }
  }
  await browser.close();
  console.log(JSON.stringify(results));
})();
