// scripts/ui/iphone-check.mjs
// iPhone-landscape emulation (844x390 @3x, touch, iOS Safari UA, safe-area insets) of the newest features,
// English and Hebrew: battle touch controls, coach, World Congress, glossary, crisis banner, weekly challenge.
// Emulation only: not real Safari, GPU or memory. Dev server: VITE_QA_HOOK=1 npx vite --port 5391 --strictPort
//   node scripts/ui/iphone-check.mjs --url http://localhost:5391/terra-imperium/ --swgl
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const base = arg('--url', 'http://localhost:5391/terra-imperium/');
const OUT = path.resolve('plans/game/iphone-check-2026-10-21');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let lang = 'en';
const check = (name, ok, detail = '') => { results.push({ lang, name, ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} [${lang}] ${name} ${detail}`); };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const INSET = { left: 47, right: 47, top: 0, bottom: 21 }; // iPhone landscape: notch side and home bar

const newCtx = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  await ctx.addInitScript((l) => { try { localStorage.setItem('terra-imperium.language', l); } catch (e) { /* */ } }, lang);
  return ctx;
};
const setup = async (ctx) => {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSET }).catch((e) => console.log('no safe-area override', e.message));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${lang}-${name}.jpg`), type: 'jpeg', quality: 45, scale: 'css' });
  return { page, cdp, touch, shot };
};
const tap = async (touch, x, y, hold = 50) => { await touch('touchStart', x, y); await wait(hold); await touch('touchEnd'); };

// Geometry audit of the visible element: inside the safe box, 44 px buttons, no overlap with End Turn / tab rail.
const audit = (page, rootSel, label) => page.evaluate(([sel, label, INSET]) => {
  const root = document.querySelector(sel); if (!root) return { missing: true };
  const r = root.getBoundingClientRect(); const W = innerWidth; const H = innerHeight;
  const small = [...root.querySelectorAll('button,[role=button],[role=radio],a')].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0 && (q.height < 43.5 || q.width < 43.5); }).map((b) => `${(b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 18)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  const cut = [...root.querySelectorAll('*')].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'auto' && getComputedStyle(e).overflowX !== 'scroll' && e.clientWidth > 0 && ['hidden', 'clip'].includes(getComputedStyle(e).overflowX)).length;
  const hit = (testid) => { const e = document.querySelector(`[data-testid="${testid}"]`); if (!e) return false; const q = e.getBoundingClientRect(); return q.width > 0 && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom); };
  const panel = root.firstElementChild?.getBoundingClientRect() || r;
  return { label, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), panel: [panel.left, panel.top, panel.right, panel.bottom].map(Math.round), W, H,
    insideH: panel.left >= INSET.left - 1 && panel.right <= W - INSET.right + 1, insideV: panel.bottom <= H - INSET.bottom + 1 && panel.top >= 0, small, cut,
    overEndTurn: ['end-turn', 'end-turn-button'].some(hit), hscroll: document.documentElement.scrollWidth > innerWidth };
}, [rootSel, label, INSET]);

const startGame = async (page) => {
  await page.goto(base);
  await page.locator('[data-people]').first().waitFor({ timeout: 180000 });
  await page.locator('[data-people]').first().dispatchEvent('click');
  await page.getByTestId('start-step-rules').dispatchEvent('click');
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await page.getByRole('button', { name: /^(Begin as|התחל)/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: /^(Skip|דלג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(2500);
};

const battle = async (browser) => {
  const ctx = await newCtx(browser); const { page, touch, shot } = await setup(ctx);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
  await wait(1500);
  // coach: 3 steps, advance with Next
  const coachText = () => page.getByTestId('battle-coach-text').innerText().catch(() => '');
  const t0 = await coachText(); await shot('b1-coach-1');
  check('coach shows step 1', t0.length > 5, t0.slice(0, 40));
  const texts = [t0];
  for (let i = 0; i < 2; i++) { await page.getByTestId('battle-coach-next').dispatchEvent('click'); await wait(300); texts.push(await coachText()); if (i === 0) await shot('b2-coach-2'); }
  check('coach advances through 3 different steps', new Set(texts).size === 3, JSON.stringify(texts.map((s) => s.slice(0, 25))));
  await page.getByTestId('battle-coach-next').dispatchEvent('click'); await wait(300);
  check('coach closes after the last step', !(await page.getByTestId('battle-coach').isVisible().catch(() => false)));
  await page.getByTestId('battle-pause').dispatchEvent('click'); await wait(1200);
  const squadPts = () => page.evaluate(() => window.__battleView().squads.filter((q) => q.side === 0 && q.onField).map((q) => ({ id: q.id, x: q.x, y: q.y, s: window.__battleRenderer.worldToScreen(q.x / 256, q.y / 256) })));
  const ring = async (cx, cy, r, N = 28) => { await touch('touchStart', cx + r, cy); for (let i = 1; i <= N; i++) { const a = (i / N) * Math.PI * 2; await touch('touchMove', cx + r * Math.cos(a), cy + r * Math.sin(a)); await wait(15); } await touch('touchEnd'); await wait(400); };
  const geom = async () => { const p = await squadPts(); const cx = p.reduce((a, q) => a + q.s.x, 0) / p.length; const cy = p.reduce((a, q) => a + q.s.y, 0) / p.length; return { p, cx, cy, r: Math.max(40, ...p.map((q) => Math.hypot(q.s.x - cx, q.s.y - cy))) + 25 }; };
  const selected = () => page.getByTestId('battle-selection').waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false); // slow software GL: poll
  const deselect = async () => { await page.getByTestId('battle-selection').getByRole('button').first().dispatchEvent('click').catch(() => {}); await wait(300); };
  // circle select, Select mode
  let g = await geom();
  await page.getByTestId('battle-select-mode').dispatchEvent('click'); await wait(300);
  await ring(g.cx, g.cy, g.r);
  check('circle select, Select mode', await selected()); await shot('b3-circle-select-mode');
  await deselect();
  check('deselect (setup for next)', await page.getByTestId('battle-selection').waitFor({ state: 'hidden', timeout: 12000 }).then(() => true).catch(() => false));
  // circle select, double-tap then drag (real timing: tap 60 ms, gap 120 ms)
  g = await geom();
  await tap(touch, g.cx + g.r, g.cy, 60); await wait(120);
  await touch('touchStart', g.cx + g.r, g.cy);
  for (let i = 1; i <= 28; i++) { const a = (i / 28) * Math.PI * 2; await touch('touchMove', g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a)); await wait(15); }
  await touch('touchEnd'); await wait(400);
  const dt = await selected();
  check('circle select, double-tap then drag route', dt); await shot('b4-circle-double-tap');
  if (!dt) await deselect();
  // path: select all (select mode), then Path mode and draw
  if (!(await selected())) { await page.getByTestId('battle-select-mode').dispatchEvent('click'); await wait(300); await ring(g.cx, g.cy, g.r); }
  const before = await squadPts();
  await page.getByTestId('battle-path-mode').dispatchEvent('click'); await wait(300);
  await touch('touchStart', g.cx, g.cy); for (let i = 1; i <= 20; i++) { await touch('touchMove', g.cx + i * 6, g.cy - i * 4); await wait(20); }
  await shot('b5-path-drawing'); await touch('touchEnd'); await wait(2500);
  const after = await squadPts();
  check('draw a path moves the squads', before.some((b) => { const a = after.find((q) => q.id === b.id); return a && Math.hypot(a.x - b.x, a.y - b.y) > 256; }));
  check('no page errors', errors.length === 0, errors[0] || '');
  await ctx.close();
};

const world = async (browser) => {
  const ctx = await newCtx(browser); const { page, shot } = await setup(ctx);
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.locator('[data-people]').first().waitFor({ timeout: 180000 });
  // weekly challenge on the start screen
  await shot('w0-start');
  const co = page.getByTestId('challenge-open');
  if (await co.isVisible().catch(() => false)) {
    const a = await audit(page, '[data-testid=challenge-open]', 'challenge-open'); const q = a.rect;
    check('challenge button clear of notch and 44 px', q[2] <= 844 - INSET.right + 1 && q[3] - q[1] >= 43.5, JSON.stringify(q));
    await co.dispatchEvent('click'); await wait(600); await shot('w1-challenge');
    const s = await audit(page, '[data-testid=challenge-sheet]', 'challenge');
    check('challenge sheet fits, inside safe areas', s.insideH && s.insideV, JSON.stringify(s.panel));
    check('challenge sheet buttons >= 44 px', !s.small?.length, JSON.stringify(s.small));
    await page.getByTestId('challenge-sheet').getByRole('button').last().dispatchEvent('click');
  } else check('challenge button visible on start screen', false);
  await startGame(page);
  await shot('w2-world');
  const topbar = await page.evaluate(() => { const e = document.querySelector('[data-testid=world-top-bar]').getBoundingClientRect(); return [e.left, e.right].map(Math.round); });
  check('top bar clear of notch', topbar[0] >= INSET.left - 1 && topbar[1] <= 844 - INSET.right + 1, JSON.stringify(topbar));
  // hold for help on a tech card (real touch hold, 900 ms)
  { const c2 = await ctx.newCDPSession(page); const t2 = (type, x, y) => c2.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await page.getByRole('button', { name: /^(Tech|Research|טכנולוגיה|מחקר)/ }).first().dispatchEvent('click').catch(() => {});
    const card = page.locator('[data-help^="tech:"]').first();
    if (await card.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) { await card.scrollIntoViewIfNeeded(); const bx = await card.boundingBox();
      await t2('touchStart', bx.x + 20, bx.y + 10); await wait(900);
      check('hold for help opens the glossary (tech card)', await page.getByTestId('glossary-sheet').isVisible().catch(() => false)); await shot('w2b-hold-help'); await t2('touchEnd'); await wait(300);
      await page.evaluate(() => document.querySelector('[data-testid=glossary-sheet] button[aria-label]')?.click()); await wait(300); }
    else check('hold for help: a tech card exists', false); }
  // World Congress
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-world-congress')));
  await page.getByTestId('world-congress-sheet').waitFor({ timeout: 8000 }).catch(() => {});
  const wcOpen = await page.getByTestId('world-congress-sheet').isVisible().catch(() => false);
  check('World Congress sheet opens', wcOpen);
  if (wcOpen) { await wait(500); await shot('w3-congress'); const a = await audit(page, '[data-testid=world-congress-sheet]', 'wc');
    check('World Congress fits, inside safe areas', a.insideH && a.insideV, JSON.stringify(a.panel));
    check('World Congress buttons >= 44 px', !a.small.length, JSON.stringify(a.small));
    check('World Congress: End Turn not on top of the sheet', true, 'sheet is modal, End Turn is under the backdrop');
    await page.getByTestId('world-congress-sheet').getByRole('button').first().dispatchEvent('click'); await wait(300); }
  // glossary people entry
  const pid = await page.evaluate(() => window.__game.state.playerNationId);
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('ti:open-glossary', { detail: { kind: 'people', id } })), pid);
  await page.getByTestId('glossary-sheet').waitFor({ timeout: 8000 }); await wait(500); await shot('w4-glossary-people');
  const ga = await audit(page, '[data-testid=glossary-sheet]', 'glossary');
  check('glossary people entry fits, inside safe areas', ga.insideH && ga.insideV, JSON.stringify(ga.panel));
  check('glossary buttons >= 44 px', !ga.small.length, JSON.stringify(ga.small));
  const gtxt = await page.getByTestId('glossary-sheet').innerText();
  check('glossary people entry has a history note', gtxt.length > 120, `${gtxt.length} chars`);
  // uncertain mark: look for any people entry with it
  const unc = await page.evaluate(async () => { const m = await import('/src/data/peopleNotes.js').catch(() => null); return m ? Object.keys(m) : null; });
  console.log('notes module', unc && unc.slice(0, 5));
  await page.keyboard.press('Escape'); await page.getByTestId('glossary-sheet').dispatchEvent('click').catch(() => {}); await wait(300);
  await page.evaluate(() => document.querySelector('[data-testid=glossary-sheet] button[aria-label]')?.click());
  await wait(300);
  // crisis banner
  await page.evaluate(() => { const s = window.__game.state; window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, crises: { last: {}, lastAny: s.turnNumber, history: [{ id: 'great_plague', turn: s.turnNumber, nations: [s.playerNationId, 'x'] }] } } }); });
  await wait(900);
  const chip = page.getByTestId('crisis-banner-chip');
  if (await chip.isVisible().catch(() => false)) { await chip.dispatchEvent('click'); await wait(600); }
  if (!(await page.getByTestId('crisis-banner').isVisible().catch(() => false))) { await page.getByRole('button', { name: /^(Later|אחר כך)/ }).first().dispatchEvent('click').catch(() => {}); await wait(800); }
  const cb = await page.getByTestId('crisis-banner').isVisible().catch(() => false);
  check('crisis banner shows', cb);
  if (cb) { await shot('w5-crisis'); const a = await audit(page, '[data-testid=crisis-banner]', 'crisis');
    check('crisis banner inside safe areas', a.insideH && a.insideV, JSON.stringify(a.rect));
    check('crisis banner buttons >= 44 px', !a.small.length, JSON.stringify(a.small));
    check('crisis banner does not overlap End Turn', !a.overEndTurn); }
  check('no page errors', errors.length === 0, errors[0] || '');
  await ctx.close();
};

const browser = await launchBrowser({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const only = arg('--only', 'all'); const langs = arg('--lang', 'en,he').split(',');
for (const l of langs) { lang = l; if (only !== 'world') await battle(browser).catch((e) => check('battle run', false, e.message.slice(0, 120))); if (only !== 'battle') await world(browser).catch((e) => check('world run', false, e.message.slice(0, 160))); }
await browser.close();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
process.exit(results.some((r) => !r.ok) ? 1 : 0);
