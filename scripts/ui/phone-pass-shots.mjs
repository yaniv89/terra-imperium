// scripts/ui/phone-pass-shots.mjs
// The phone pass (plans/lanes/phone-pass-REPORT.md): every campaign screen at a phone held sideways
// (844x390, 844x340 with Safari's bars) and a desktop (1600x900), English and Hebrew. Each shot is
// audited in the page: controls smaller than 44 px, controls off screen or under another element
// (End Turn, the rail, the notch inset), raw {placeholders} and NaN. Needs a dev server of THIS
// checkout (`npx vite --port 5197`). Late states come through the dev-only window.__game hook.
//   node scripts/ui/phone-pass-shots.mjs [--out dir] [--only 844x390-en] [--screens city,army]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/phone-pass'));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const SCREENS = (arg('--screens', '') || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });

const CONFIGS = [];
for (const [w, h] of [[844, 390], [844, 340], [1600, 900]]) {
  for (const lang of ['en', 'he']) CONFIGS.push({ id: `${w}x${h}-${lang}`, w, h, lang, phone: w < 1000 });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  if (next) window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });
const fire = (page, name, detail) => page.evaluate(({ name, detail }) => window.dispatchEvent(new CustomEvent(name, { detail })), { name, detail });

// In-page audit of what is on screen now.
const audit = (page, phone) => page.evaluate((phone) => {
  const W = innerWidth; const H = innerHeight; const out = [];
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-testid') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const vis = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  for (const el of document.querySelectorAll('button,a[href],input,select,[role=button],[role=switch],[role=tab]')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !vis(el) || el.closest('canvas')) continue;
    if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue; // scrolled away
    // clipped by a scrolling ancestor: skip (the user scrolls to it)
    let clipped = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(s.overflow + s.overflowX + s.overflowY)) {
        const pr = p.getBoundingClientRect();
        if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.right > pr.right + 1) { clipped = true; break; }
      }
    }
    if (clipped) continue;
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) out.push(`OFF  ${label(el)} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    const x = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)); const y = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2));
    const hit = document.elementFromPoint(x, y);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      // covered by something that is not a backdrop (a modal over the page is fine)
      const cover = hit.closest('button,a,[role=button],[data-testid],section,aside,header,nav,div');
      const isBackdrop = hit.classList.contains('sheet-backdrop') || /backdrop|fixed inset-0/.test(hit.className || '') || hit.tagName === 'CANVAS';
      if (!isBackdrop && cover && phone) out.push(`UNDER ${label(el)} <- ${label(cover)}`);
    } else if (phone && (r.height < 40 || r.width < 40) && !el.disabled) {
      // its hit area may be widened by a ::before inset
      const b = getComputedStyle(el, '::before');
      const widened = b.content !== 'none' && b.position === 'absolute';
      if (!widened) out.push(`SMALL ${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  // Right to left: a signed number whose sign lands on the wrong side ("50+" for "+50"), measured.
  if (document.documentElement.dir === 'rtl') {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = n.textContent;
      for (const m of s.matchAll(/(^|[^\w])([+\-\u2212])(\d)/g)) {
        const at = m.index + m[1].length;
        const rect = (i) => { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); return r.getBoundingClientRect(); };
        const sg = rect(at); const dg = rect(at + 1);
        if (!sg.width || sg.bottom < 0 || sg.top > H || Math.abs(sg.top - dg.top) > 4) continue;
        if (sg.left > dg.left) out.push(`BIDI sign after the number in "${s.trim().slice(0, 40)}"`);
      }
    }
  }
  const text = document.body.innerText;
  for (const m of text.matchAll(/\{[a-zA-Z_]+\}|\bNaN\b|\bundefined\b/g)) out.push(`TEXT ${m[0]} in "${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\s+/g, ' ')}"`);
  const sx = document.scrollingElement; if (sx.scrollWidth > W + 1) out.push(`HSCROLL page ${sx.scrollWidth}`);
  return [...new Set(out)];
}, phone);

const closeAll = async (page) => {
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await wait(150); }
  for (let i = 0; i < 4; i++) {
    const close = page.locator('button[aria-label="Close"]:visible, button[aria-label="סגירה"]:visible, button[aria-label="סגור"]:visible, button[aria-label="Cancel march"]:visible, button[aria-label="ביטול הצעידה"]:visible').first();
    if (!(await close.count())) break;
    await click(close).catch(() => {}); await wait(250);
  }
  await fire(page, 'ti:close-panels');
  await wait(300);
};

const report = [];
const run = async (cfg) => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, isMobile: cfg.phone, hasTouch: cfg.phone, deviceScaleFactor: cfg.phone ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  const shot = async (name) => {
    await wait(600);
    const file = path.join(OUT, `${cfg.id}-${name}.png`);
    await page.screenshot({ path: file, timeout: 120000 }).catch((e) => console.log('shot failed', name, String(e).slice(0, 80)));
    const issues = await audit(page, cfg.phone).catch((e) => [`audit failed ${e}`]);
    report.push({ cfg: cfg.id, name, issues });
    console.log(`${cfg.id} ${name}: ${issues.length ? `\n    ${issues.join('\n    ')}` : 'clean'}`);
  };
  const want = (s) => !SCREENS.length || SCREENS.includes(s);
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, cfg.lang);
  await page.goto(URL_BASE);
  const screen = page.getByTestId('start-screen');
  if (!(await screen.isVisible().catch(() => false))) {
    // title screen first
    const newGame = page.locator('[data-testid="title-new-game"], button').filter({ hasText: /New game|משחק חדש/ }).first();
    await newGame.waitFor({ timeout: 60000 }).catch(() => {});
    if (await newGame.isVisible().catch(() => false)) await click(newGame);
  }
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  if (want('title')) {
    for (let i = 0; i < 4; i++) {
      const step = await screen.getAttribute('data-step');
      await shot(`start-${i}-${step}`);
      if (step === 'ready') break;
      await click(page.getByTestId('start-next'));
      await page.locator(`[data-testid="start-screen"]:not([data-step="${step}"])`).waitFor({ timeout: 10000 });
    }
    await click(page.getByTestId('start-step-people'));
    await wait(300);
  }
  await page.locator('input[type="search"], input').first().fill('Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await click(page.getByTestId('start-step-ready'));
  await click(page.getByTestId('begin-game'));
  await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
  await wait(2500);
  // The tutorial's first card, if any
  await shot('map-first');
  const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
  if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
  const advisor = page.getByTestId('research-let-advisor');
  if (await advisor.isVisible().catch(() => false)) { await shot('research-choice'); await click(advisor); }
  // found the first village
  const idle = page.getByTestId('idle-chip');
  const found = page.getByTestId('found-city');
  for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(idle).catch(() => {}); await wait(600); }
  if (await found.isVisible().catch(() => false)) { await shot('band-sheet'); await click(found); await wait(1500); }
  await closeAll(page);
  // A grown realm: four more cities, a garrison, gold
  await patch(page, `
    const me = s.playerNationId; const cap = s.nations[me].capitalRegionId;
    let st = s; for (let i = 0; i < 4; i++) { try { st = m.addCity(st, me, { near: cap }).state; } catch (e) { /* no room */ } }
    return { ...st, resources: { ...st.resources, gold: 420 } };`, ['engine/testWorld.js']).catch((e) => console.log('grow failed', String(e).slice(0, 120)));
  await wait(1200);
  if (want('map')) await shot('map-hud');
  const capId = await page.evaluate(() => window.__game.state.nations[window.__game.state.playerNationId].capitalRegionId);
  if (want('city')) {
    await fire(page, 'ti:select-region', capId); await wait(900); await shot('city-card');
    await fire(page, 'ti:manage-city', { regionId: capId, tab: 'overview' }); await wait(900); await shot('city-sheet');
    await fire(page, 'ti:manage-city', { regionId: capId, tab: 'build' }); await wait(900); await shot('city-build');
    await closeAll(page);
  }
  if (want('army')) {
    const tile = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.units).find((u) => u.ownerId === s.playerNationId && u.tile != null)?.tile; });
    if (tile != null) { await fire(page, 'ti:select-army', tile); await wait(900); await shot('army-sheet'); }
    const march = page.getByRole('button', { name: /^(March|צעד|הצעד)/ }).first();
    if (await march.isVisible().catch(() => false)) { await click(march); await wait(900); await shot('march-bar'); }
    await closeAll(page);
  }
  if (want('tabs')) {
    for (const tab of ['domestic', 'ruler', 'cities', 'tech', 'diplomacy', 'legacy']) {
      await fire(page, 'ti:open-tab', tab); await wait(1000); await shot(`tab-${tab}`);
      await closeAll(page);
    }
  }
  if (want('menu')) {
    await fire(page, 'ti:open-menu', 'all'); await wait(800); await shot('menu');
    await closeAll(page);
    await fire(page, 'ti:open-settings'); await wait(800); await shot('settings');
    await closeAll(page);
    await fire(page, 'ti:open-nation-overview'); await wait(800); await shot('nation-overview');
    await closeAll(page);
    await fire(page, 'ti:open-glossary', { kind: 'people', id: 'akkad' }); await wait(800); await shot('glossary');
    await closeAll(page);
  }
  if (want('peoples')) {
    const other = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.nations).find((n) => n.id !== s.playerNationId && !n.indep && !n.isEliminated)?.id; });
    await fire(page, 'ti:select-nation', other); await wait(900); await shot('nation-card');
    await closeAll(page);
  }
  if (want('event')) {
    await patch(page, "return { ...s, activeEventId: 'the_wheel' };");
    await wait(1000); await shot('event-card');
    const opt = page.locator('[data-testid^="event-option"], [data-testid="event-sheet"] button').first();
    if (await opt.isVisible().catch(() => false)) await click(opt);
    await patch(page, 'return { ...s, activeEventId: null };');
    await closeAll(page);
  }
  if (want('crisis')) {
    await patch(page, "return { ...s, settings: { ...s.settings, crises: 'on' }, crises: { ...(s.crises || {}), coming: { id: 'sea_peoples', turn: s.turnNumber + 5, nations: [s.playerNationId] } } };");
    await wait(1000); await shot('crisis-banner');
    await closeAll(page);
  }
  if (want('turn')) {
    // End the turn and see the report (answer whatever blocks it)
    for (let i = 0; i < 10; i++) {
      await click(page.getByTestId('end-turn')).catch(() => {});
      await wait(2500);
      const row = page.locator('[data-testid="build-row"] button:not([disabled])').last();
      if (await row.isVisible().catch(() => false)) { await click(row); await wait(600); await closeAll(page); continue; }
      const w = page.getByTestId('end-turn-warnings');
      if (await w.isVisible().catch(() => false)) { await shot('end-turn-warnings'); const go = w.locator('button').last(); await click(go); await wait(2500); }
      if (await page.getByTestId('turn-report').isVisible().catch(() => false)) break;
      await closeAll(page);
    }
    await fire(page, 'ti:open-turn-report'); await wait(1200); await shot('turn-report');
    await closeAll(page);
  }
  if (errors.length) console.log(`${cfg.id} page errors:\n  ${[...new Set(errors)].join('\n  ')}`);
  await browser.close();
};

for (const cfg of CONFIGS) {
  if (ONLY.length && !ONLY.includes(cfg.id)) continue;
  try { await run(cfg); } catch (e) { console.log(`${cfg.id} FAILED: ${String(e).slice(0, 300)}`); }
}
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 1));
