// Usage (server running on 127.0.0.1:8765, fake data loaded, Playwright installed):
//   node tools/browser_check.js <screenshot folder> path/to/sofa-planner.html
// Browser check for the sofa_planner module under the test project's strict CSP.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2];
const BASE = 'http://127.0.0.1:8765';
const ORIGINAL = 'file://' + path.resolve(process.argv[3]);

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); }

async function newWatchedPage(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/status of 409/.test(m.text())) page.errors.push('console: ' + m.text()); });
  page.on('pageerror', e => page.errors.push('pageerror: ' + e.message));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e =>
      window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' line ' + e.lineNumber));
  });
  return page;
}

async function login(page, user) {
  await page.goto(BASE + '/accounts/login/');
  await page.fill('#id_username', user);
  await page.fill('#id_password', 'test-pass-123');
  await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')]);
}

(async () => {
  const browser = await chromium.launch();

  // 1. Original standalone file, for a visual reference.
  const octx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const orig = await octx.newPage();
  await orig.goto(ORIGINAL);
  await orig.locator('#palette .card:not(.has-variants):not(.custom)').nth(0).click();
  await orig.locator('#palette .card:not(.has-variants):not(.custom)').nth(1).click();
  await orig.waitForTimeout(300);
  await orig.screenshot({ path: OUT + '/original.png' });
  const origPieces = await orig.locator('#world .piece').count();

  // 2. Module editor, user alice, existing layout 1.
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await newWatchedPage(ctx);
  await login(page, 'alice.test');
  await page.goto(BASE + '/sofa-planner/');
  check('list page shows own layout', await page.getByRole('link', { name: 'Demo living room A', exact: true }).count() === 1);
  check('list page hides other user layout', await page.getByText('Bob demo power bed').count() === 0);

  await page.getByRole('link', { name: 'Demo living room A', exact: true }).click();
  await page.waitForSelector('#world .piece');
  const n = await page.locator('#world .piece').count();
  check('server layout loaded: 4 pieces', n === 4, 'pieces=' + n);
  // Positions must come from element.style (CSSOM), proving the data-style fix works.
  const firstBox = await page.locator('#world .piece').first().boundingBox();
  check('pieces are positioned (not stacked at 0,0)', firstBox && firstBox.width > 10, JSON.stringify(firstBox));
  const dimStyled = await page.evaluate(() => {
    const s = document.querySelector('#world .dim .stem');
    return s ? s.style.width : null;
  });
  check('dimension line got its inline width via CSSOM', dimStyled && dimStyled !== '0px', dimStyled);
  const leftover = await page.evaluate(() => document.querySelectorAll('[data-style]').length);
  check('no unconverted data-style left', leftover === 0, 'count=' + leftover);
  const modelName = await page.textContent('#nameCurrent');
  check('sofa model name shown in picker', modelName.trim() === 'Alvric Sofa', modelName);

  // Add a piece, save via the button.
  await page.locator('#palette .card:not(.has-variants):not(.custom)').nth(1).click();
  await page.waitForTimeout(200);
  check('unsaved status shown', (await page.textContent('#sp-status')).includes('Unsaved'));
  await page.screenshot({ path: OUT + '/module-editor.png' });
  await page.click('#sp-save');
  await page.waitForFunction(() => document.querySelector('#sp-status').dataset.state !== 'pending');
  const st = await page.textContent('#sp-status');
  check('save succeeds -> version 2', st.includes('Saved. Version 2'), st);

  // 3. Stale tab: second page opened BEFORE another save.
  const tabB = await newWatchedPage(ctx);
  await tabB.goto(BASE + '/sofa-planner/1/');
  await tabB.waitForSelector('#world .piece');
  check('reload shows saved 5 pieces', await tabB.locator('#world .piece').count() === 5);
  // tab A saves again (v2 -> v3), then tab B (still v2) tries.
  await page.locator('#palette .card:not(.has-variants):not(.custom)').nth(1).click();
  await page.click('#sp-save');
  await page.waitForFunction(() => (document.querySelector('#sp-status').textContent || '').includes('Version 3'));
  await tabB.locator('#palette .card:not(.has-variants):not(.custom)').nth(0).click();
  await tabB.click('#sp-save');
  await tabB.waitForFunction(() => document.querySelector('#sp-status').dataset.state === 'error');
  const conflict = await tabB.textContent('#sp-status');
  check('stale tab gets conflict message', conflict.includes('changed somewhere else'), conflict);

  // 4. New layout page.
  const p3 = await newWatchedPage(ctx);
  await p3.goto(BASE + '/sofa-planner/new/');
  await p3.waitForSelector('#palette .card');
  await p3.locator('#palette .card:not(.has-variants):not(.custom)').nth(0).click();
  await p3.fill('#sp-layout-name', 'Browser test layout');
  await p3.click('#sp-save');
  await p3.waitForFunction(() => document.querySelector('#sp-status').dataset.state !== 'pending');
  check('new layout created', (await p3.textContent('#sp-status')).includes('Version 1'), await p3.textContent('#sp-status'));
  check('URL switched to edit URL', /\/sofa-planner\/\d+\/$/.test(p3.url()), p3.url());

  // 5. Print view hides the editor UI (print CSS fix).
  await page.emulateMedia({ media: 'print' });
  const toolbarHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.sp-editor > header')).display === 'none');
  check('print: planner toolbar hidden', toolbarHidden);
  await page.emulateMedia({ media: 'screen' });

  // 6. Narrow screen screenshot (320px) for KNOWN_LIMITATIONS.
  const mctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const mp = await newWatchedPage(mctx);
  await login(mp, 'alice.test');
  await mp.goto(BASE + '/sofa-planner/');
  await mp.screenshot({ path: OUT + '/module-list-320px.png', fullPage: true });
  await mp.goto(BASE + '/sofa-planner/1/');
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: OUT + '/module-editor-320px.png' });
  const hScroll = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  // 7. No CSP violations and no JS errors on any module page.
  for (const [label, pg] of [['editor', page], ['tabB', tabB], ['new', p3], ['mobile', mp]]) {
    const csp = await pg.evaluate(() => window.__csp);
    check(`${label}: no CSP violations`, csp.length === 0, csp.join(' | '));
    check(`${label}: no JS errors`, pg.errors.length === 0, pg.errors.join(' | '));
  }

  console.log(JSON.stringify({ origPieces, editor320HorizontalScroll: hScroll }));
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.detail && !r.ok ? '  -> ' + r.detail : ''));
  console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
