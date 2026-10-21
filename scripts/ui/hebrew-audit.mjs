// scripts/ui/hebrew-audit.mjs
// Final Hebrew sweep (plans/hebrew-support-plan.md, H5 notes): starts a game in Hebrew at 844x390,
// visits every screen and lists each visible text that still contains Latin letters. A screen that
// cannot be reached in this run is reported as SKIPPED, never silently passed.
//   npx vite --port 5198   (this checkout; vite ignores .claude/**, restart it after edits)
//   node scripts/ui/hebrew-audit.mjs [--url http://localhost:5198/terra-imperium/] [--only a,b] [--lang he] [--shots]
// Report: plans/ui/hebrew-audit/report-<lang>.txt and .json
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, f) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : f; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const LANG = arg('--lang', 'he');
const ONLY = arg('--only', '') ? arg('--only', '').split(',') : null;
const SHOTS = process.argv.includes('--shots');
const OUT = path.resolve('plans/ui/hebrew-audit');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Text that is deliberately Latin: unit symbols and kept abbreviations. Tokens, compared whole.
const ALLOW = new Set(['x', 'X', 'km', 'm', 'BCE', 'CE', 'ADM', 'DIP', 'MIL', 'AI', 'HP', 'ms', 'fps', 'FPS']);

const results = [];
let page;

// Visible text nodes (and text attributes) containing Latin letters, de-duplicated.
const scan = (opts = {}) => page.evaluate(async (opts) => {
  const found = new Map();
  const add = (kind, txt, el) => {
    const k = `${kind}|${txt}`;
    if (!found.has(k)) found.set(k, { kind, text: txt, where: (el.closest('[data-testid]')?.getAttribute('data-testid')) || el.tagName.toLowerCase() });
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const vw = window.innerWidth; const vh = window.innerHeight;
  const visible = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    }
    return true;
  };
  const onScreen = (r) => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
  const pass = () => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const txt = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!txt || !/[A-Za-z]/.test(txt)) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,canvas')) continue;
    if (!visible(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    if (![...range.getClientRects()].some(onScreen)) continue;
    add('text', txt, el);
  }
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
    const r = el.getBoundingClientRect();
    if (!onScreen(r) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && /[A-Za-z]/.test(v)) add(a, v.replace(/\s+/g, ' ').trim(), el);
    }
  }
  };
  if (opts.expand) {
    for (const b of document.querySelectorAll('[aria-expanded="false"]')) { const r = b.getBoundingClientRect(); if (r.width > 0 && r.right > 0 && r.left < vw && r.top < vh && r.bottom > 0 && !b.closest('[data-testid="lens-strip"]')) { b.click(); await wait(60); } }
    await wait(250);
  }
  pass();
  const scrollers = [...document.querySelectorAll('*')].filter((e) => { if (e.scrollHeight <= e.clientHeight + 6) return false; const o = getComputedStyle(e).overflowY; if (o !== 'auto' && o !== 'scroll') return false; const r = e.getBoundingClientRect(); return r.width > 40 && r.height > 40 && r.right > 0 && r.left < vw && r.top < vh; });
  for (const sc of scrollers) {
    const start = sc.scrollTop;
    sc.scrollTop = 0; await wait(60);
    for (let i = 0; i < 40; i += 1) {
      pass();
      const before = sc.scrollTop;
      sc.scrollTop = before + Math.max(40, sc.clientHeight - 30);
      await wait(60);
      if (sc.scrollTop === before) break;
    }
    pass();
    sc.scrollTop = start;
  }
  return [...found.values()];
}, opts);

const latin = (items) => items.filter((it) => {
  if (it.where === 'lang-en' || it.where === 'lang-he') return false; // the language names stay in their own language
  const toks = it.text.match(/[A-Za-z]+/g) || [];
  return toks.some((tk) => !ALLOW.has(tk));
});

const record = async (screen, note = '', opts = { expand: true }) => {
  const items = latin(await scan(opts));
  results.push({ screen, note, items });
  console.log(`${items.length ? 'LATIN' : 'clean'} ${screen}${note ? ` (${note})` : ''}: ${items.length}`);
  for (const it of items.slice(0, 60)) console.log(`    [${it.kind}] ${it.text.slice(0, 110)}  <${it.where}>`);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `${LANG}-${screen.replace(/[^a-z0-9]+/gi, '_')}.png`), timeout: 120000 }).catch(() => {});
};
const skipped = (screen, why) => { results.push({ screen, skipped: why, items: [] }); console.log(`SKIPPED ${screen}: ${why}`); };

const click = async (loc) => { await loc.first().dispatchEvent('click'); await wait(450); };
const tid = (id) => page.getByTestId(id);
const has = async (loc) => (await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false));
const esc = async () => { await page.keyboard.press('Escape'); await wait(300); };
const patch = (body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });
const evalMod = (modPath, fnName, ...args) => page.evaluate(async ({ modPath, fnName, args }) => (await import(`/terra-imperium/src/${modPath}`))[fnName](...args), { modPath, fnName, args });

const step = async (name, fn) => {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  try { await fn(); } catch (e) { skipped(name, `error: ${String(e).split('\n')[0].slice(0, 140)}`); }
};

const fresh = async () => {
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); localStorage.setItem('ti.coach.firstBattle', '1'); }, LANG);
  await page.goto(URL_BASE);
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

// ---------- title screen and start steps ----------
await step('title', async () => {
  // a first title screen needs a save: make one by playing a turn later; here the start steps come first
  await fresh();
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
});
await step('start', async () => {
  if (!(await page.locator('[data-people]').count())) await fresh();
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await record('start: people list');
  const steps = await page.locator('[data-testid^="start-step-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  await click(page.locator('[data-people]'));
  for (const s of steps) { await click(tid(s)); await record(`start: ${s}`); }
  await click(tid('begin-game'));
  await wait(2000);
  const nextB = page.getByRole('button', { name: LANG === 'he' ? 'הבא' : 'Next' });
  const startB = page.getByRole('button', { name: LANG === 'he' ? 'התחילו לשחק' : 'Start playing' });
  for (let i = 0; i < 8; i += 1) {
    if (await has(startB)) { await record(`onboarding ${i + 1}`); await click(startB); break; }
    if (!(await has(nextB))) break;
    await record(`onboarding ${i + 1}`); await click(nextB);
  }
  await tid('world-top-bar').waitFor({ timeout: 90000 });
  await wait(3000);
});

const NO_GAME_NEEDED = ONLY && ONLY.every((o) => ['battle', 'title'].includes(o));
if (!NO_GAME_NEEDED && !(await page.getByTestId('world-top-bar').count())) {
  console.log('no game started; abort'); await browser.close(); process.exit(1);
}

// every visible tab of a tab list (role=tab) inside `scope`; records each
const visitTabs = async (screen, scope = page) => {
  const tabs = scope.locator('[role="tab"]:visible');
  const n = await tabs.count();
  if (!n) { skipped(`${screen}: tabs`, 'no tabs visible'); return; }
  for (let i = 0; i < n; i += 1) {
    const tb = tabs.nth(i);
    const label = ((await tb.getAttribute('aria-label')) || (await tb.innerText()) || `#${i}`).replace(/\s+/g, ' ').trim().slice(0, 30);
    await tb.dispatchEvent('click'); await wait(500);
    await record(`${screen} > ${label}`);
  }
};
const gs = (fnBody) => page.evaluate(`(() => { const s = window.__game.state; ${fnBody} })()`);
const lensEvent = (id) => page.evaluate((x) => window.dispatchEvent(new CustomEvent('ti:set-map-lens', { detail: x })), id);

// ---------- map and lenses ----------
await step('map', async () => {
  await record('map: political');
  const lenses = await page.evaluate(async () => (await import('/terra-imperium/src/components/map/lenses.js')).LENSES.map((l) => l.id));
  for (const l of lenses) { await lensEvent(l); await wait(600); await record(`map: lens ${l}`); }
  await lensEvent('political');
  await click(tid('lens-pill')); await record('map: lens list open'); await esc();
});

// ---------- rail tabs ----------
const railTab = async (ix) => { await click(tid('landscape-rail').locator('nav button').nth(ix)); await wait(600); };
await step('rail', async () => {
  const labels = await tid('landscape-rail').locator('nav button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.innerText));
  console.log('  rail buttons:', labels.join(' | '));
  for (let i = 0; i < labels.length - 2; i += 1) {
    await railTab(i);
    await record(`rail: ${labels[i]}`);
    const dock = tid('landscape-dock');
    if (await has(dock)) await visitTabs(`rail: ${labels[i]}`, dock);
    if (await has(tid('landscape-dock'))) await railTab(i); // close the open dock
  }
});

await step('log', async () => {
  const n = await tid('landscape-rail').locator('nav button').count();
  await railTab(n - 2);
  await record('log');
  await esc();
  if (await has(tid('log-drawer'))) await railTab(n - 2);
});
await step('menu', async () => {
  const n = await tid('landscape-rail').locator('nav button').count();
  await railTab(n - 1);
  await click(tid('menu-settings')); // the menu hub, then Settings
  await tid('settings-sheet').waitFor({ timeout: 8000 });
  await record('menu: settings');
  await visitTabs('menu', tid('settings-sheet'));
  await esc();
});

const capitalId = () => gs('return s.nations[s.playerNationId].capitalRegionId;');
const manage = (regionId, tab) => evalMod('components/map/marchEvents.js', 'manageCity', regionId, tab);

await step('city', async () => {
  const cap = await capitalId();
  await manage(cap, 'overview');
  await wait(1500);
  await record('city: opened');
  const sheet = page.locator('[data-testid="city-sheet"], [data-testid="region-info-modal"], [data-testid="city-panel"]').first();
  console.log('  city sheet visible:', await has(sheet));
  await visitTabs('city', page);
  const buildGroups = page.locator('[data-testid^="build-group-"]');
  console.log('  build groups:', await buildGroups.count());
});

const closeAllCards = async () => { for (let i = 0; i < 3; i += 1) await esc(); };
const metNationId = () => gs('return Object.values(s.nations).find((n) => !n.indep && n.id !== s.playerNationId && !n.isEliminated)?.id;');
const markMet = (id) => patch(`const me = s.playerNationId; return { ...s, fog: { ...(s.fog || {}), met: { ...(s.fog?.met || {}), [me]: { ...(s.fog?.met?.[me] || {}), [${JSON.stringify(id)}]: 1 } } } };`);

await step('researchchoice', async () => {
  await evalMod('components/ui/uiEvents.js', 'openResearchChoice');
  await wait(900);
  await record('research choice');
  const opt = page.locator('[data-testid^="research-option-"]').first();
  if (await has(opt)) await click(opt); else await esc();
  await wait(500);
});

await step('tech', async () => {
  await railTab(2);
  await record('tech: lines');
  await click(tid('research-web-toggle'));
  await record('tech: web (tech tree)');
  await railTab(2);
});

await step('diplomacy', async () => {
  const nid = await metNationId();
  await markMet(nid);
  await wait(800);
  if (await has(tid('first-contact'))) { await record('first contact'); await esc(); } else skipped('first contact', 'card did not show');
  await railTab(3);
  await record('peoples: list');
  const rows = page.locator('[data-testid="peoples-list"] button');
  console.log('  peoples rows:', await rows.count());
  if (await rows.count()) { await click(rows); await record('peoples: nation card'); }
  await railTab(3);
  await evalMod('components/map/marchEvents.js', 'selectNation', nid);
  await wait(800);
  await record('nation sheet');
  await visitTabs('nation sheet', tid('nation-sheet'));
  await closeAllCards();
});

await step('events', async () => {
  const ids = await page.evaluate(async () => Object.keys((await import('/terra-imperium/src/data/events.js')).HISTORICAL_EVENTS).slice(0, 3));
  for (const id of ids) {
    await patch(`return { ...s, activeEventId: ${JSON.stringify(id)} };`);
    await wait(900);
    await record(`event: ${id}`);
    const opt = page.locator('[data-testid^="event-option-"]').first();
    if (await has(opt)) await click(opt);
    await patch('return { ...s, activeEventId: null };');
    await wait(400);
  }
});

await step('report', async () => {
  await click(tid('end-turn'));
  await wait(2500);
  await record('turn report');
  await closeAllCards();
});

const selTile = (tile) => evalMod('components/map/marchEvents.js', 'selectTile', tile);
const selArmy = (tile) => evalMod('components/map/marchEvents.js', 'selectArmy', tile);

await step('mapobj', async () => {
  const info = await patchless();
  console.log('  units:', JSON.stringify(info.units.slice(0, 6)));
  // tiles near the capital: free land, own land, water
  const pick = await page.evaluate(async (capTile) => {
    const m = await import('/terra-imperium/src/data/geo/tiles.js'); const t = m.getTiles(); const s = window.__game.state;
    const owner = s.world.tileOwner; const out = { free: null, own: null, water: null, foreign: null };
    const seen = new Set([capTile]); let f = [capTile];
    for (let d = 0; d < 9; d += 1) {
      const nx = [];
      f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); nx.push(y); } }));
      f = nx;
      for (const x of f) {
        if (t.land[x] === 1 && owner[x] == null && !out.free) out.free = x;
        if (t.land[x] === 1 && owner[x] != null && s.regions[owner[x]]?.owner === s.playerNationId && d > 0 && !out.own) out.own = x;
        if (t.land[x] !== 1 && !out.water) out.water = x;
        if (t.land[x] === 1 && owner[x] != null && s.regions[owner[x]]?.owner !== s.playerNationId && !out.foreign) out.foreign = x;
      }
    }
    const foreignCity = Object.values(s.regions).find((c) => c.owner !== s.playerNationId && c.tile != null);
    if (!out.foreign && foreignCity) out.foreign = foreignCity.tile;
    return out;
  }, info.capTile);
  console.log('  tiles:', JSON.stringify(pick));
  for (const [k, tl] of Object.entries(pick)) {
    if (tl == null) { skipped(`tile sheet: ${k}`, 'no such tile found'); continue; }
    await selTile(tl); await wait(900); await record(`tile sheet: ${k}`);
  }
  await closeAllCards();
  await patch(`const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
    const u = (id) => ({ id, ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile: cap.tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
    return { ...s, units: { ...s.units, aud_a1: u('aud_a1'), aud_a2: u('aud_a2') } };`);
  await wait(600);
  await selArmy(info.capTile); await wait(900); await record('army sheet');
  await click(tid('army-march')); await wait(900); await record('march bar: start');
  for (const [k, tl] of Object.entries(pick)) {
    if (tl == null) continue;
    await selTile(tl); await wait(1000); await record(`march bar: target ${k}`);
  }
  await closeAllCards();
});

async function patchless() {
  return gs('const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId]; return { capTile: cap.tile, capId: cap.id, units: Object.values(s.units).filter((u) => u.ownerId === me && u.tile != null).map((u) => ({ id: u.id, tile: u.tile, cls: u.classId, domain: u.domain })) };');
}

await step('settler', async () => {
  const info = await patchless();
  await patch(`const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId]; return { ...s, units: { ...s.units, aud_settler: m.makeSettler('aud_settler', cap, me) } };`, ['engine/settlers.js']);
  await wait(600);
  await selTile(info.capTile); await wait(900);
  await record('settler sheet (tile with settlers)');
  const choose = tid('settler-choose-site');
  if (await has(choose)) { await click(choose); await wait(1500); await record('settle mode (site card)'); } else skipped('settle mode', 'no choose-a-site button');
  await closeAllCards();
  await lensEvent('settle'); await wait(1500);
  await record('settle lens with settlers');
  await lensEvent('political');
  await closeAllCards();
});

// ---------- battles ----------
const tClick = async (id) => { const b = tid(id); if (await b.count()) { await b.first().dispatchEvent('click'); return true; } return false; };
await step('battle', async () => {
  const campaign = page;
  page = await ctx.newPage();
  try {
    await page.goto(URL_BASE);
    await page.evaluate((l) => { localStorage.setItem('terra-imperium.language', l); localStorage.setItem('ti.coach.firstBattle', '1'); }, LANG);
    await page.goto(`${URL_BASE}?battleSandbox&autostart&age=bronze`);
    await tid('battle-pause').waitFor({ timeout: 120000 });
    await wait(4000);
    await record('battle: before start (deploy)');
    await tClick('battle-start'); await wait(3000);
    await record('battle: HUD');
    await tClick('battle-hq'); await wait(900); await record('battle: camp (HQ card)');
    await tClick('battle-building-close'); await wait(300);
    await tClick('battle-select-all'); await wait(600); await record('battle: all selected');
    await tClick('battle-wand'); await wait(600); await record('battle: wand');
    await tClick('battle-wand-close'); await wait(300);
    await tClick('battle-idle-workers'); await wait(500); await record('battle: laborers selected');
    await tClick('battle-build'); await wait(800); await record('battle: build sheet (laborers selected)');
    await tClick('battle-build-close'); await wait(300);
    await tClick('battle-pause'); await wait(800); await record('battle: pause');
    await tClick('battle-leave'); await wait(600); await record('battle: retreat card');
    await tClick('battle-retreat-all'); await wait(800);
    await tClick('battle-resume'); await wait(500);
    await page.evaluate(() => { const b = document.querySelector('[data-testid="battle-speed"]'); for (let i = 0; i < 2; i += 1) b?.click(); });
    for (let i = 0; i < 60; i += 1) { await wait(2000); if (await page.getByTestId('battle-result').count()) break; }
    await wait(1500);
    await record('battle: result');
  } finally { await page.close(); page = campaign; }
});

const CLASH = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const t = m.getTiles(); const owner = s.world.tileOwner;
  const ind = Object.values(s.nations).find((n) => n.indep && !n.isEliminated && !(n.indep.truceWith || {})[me]);
  let seen = new Set([cap.tile]); let f = [cap.tile]; let pair = null;
  for (let d = 0; d < 10 && !pair; d++) { const n = []; f.forEach((x) => t.neighbors[x].forEach((y) => { if (!seen.has(y)) { seen.add(y); n.push(y); } })); f = n.sort((a, b) => a - b);
    for (const x of f) { if (t.land[x] !== 1 || owner[x] != null) continue; const o = t.neighbors[x].find((y) => t.land[y] === 1 && owner[y] == null); if (o != null) { pair = [x, o]; break; } } }
  const u = (id, ownerId, regionId, tile) => ({ id, ownerId, regionId, homeRegionId: regionId, tile, domain: 'land', classId: 'infantry', strength: 1000, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null });
  window.__clash = pair;
  return { ...s, pendingCaptures: [], units: { ...s.units, nml1: u('nml1', me, cap.id, pair[0]), nml2: u('nml2', ind.id, ind.capitalRegionId, pair[1]) } };`;

await step('prebattle', async () => {
  await closeAllCards();
  await patch(CLASH, ['data/geo/tiles.js']);
  const pair = await page.evaluate(() => window.__clash);
  await selTile(pair[1]); await wait(900);
  const attack = tid('attack-army').first();
  await attack.waitFor({ timeout: 10000 });
  await record('tile sheet: enemy army (attack button)');
  await click(attack);
  await tid('pre-battle').waitFor({ timeout: 15000 });
  await record('pre-battle card');
  await click(tid('battle-go'));
  await wait(3000);
  if (await has(tid('battle-replay'))) { await record('battle replay'); await click(tid('battle-replay').locator('button').last()); await wait(800); }
  if (await has(tid('battle-pause'))) { // Command was the default: a tactical battle began
    skipped('prebattle: auto result', 'default mode was Command; the tactical screen is covered by the battle step');
    await tClick('battle-start'); await wait(1500);
    await tClick('battle-pause'); await wait(500); await tClick('battle-leave'); await wait(500); await tClick('battle-retreat-all'); await wait(1500);
    for (let i = 0; i < 20; i += 1) { if (await has(tid('battle-result'))) break; await wait(1500); }
    if (await has(tid('battle-result'))) { await record('campaign battle: result'); await click(tid('battle-continue')); await wait(1500); }
  }
  await closeAllCards();
  await evalMod('components/battle/battleReportEvents.js', 'openBattleReport', await gs('return (s.battleReports || [])[0]?.id ?? null;'));
  await wait(1200);
  if (await has(tid('battle-report'))) {
    await record('battle report sheet');
    const rep = tid('battle-report-replay');
    if (await has(rep)) { await click(rep); await wait(1500); await record('battle report: replay'); }
  } else skipped('battle report sheet', 'no report opened');
  await closeAllCards();
});

await step('overview', async () => {
  await closeAllCards();
  await evalMod('components/ui/uiEvents.js', 'openNationOverview');
  await wait(900);
  await record('nation overview sheet');
  await closeAllCards();
});

await step('government', async () => {
  await railTab(0);
  const buttons = page.locator('[data-testid="landscape-dock"] button');
  const n = await buttons.count();
  let opened = false;
  for (let i = 0; i < n && !opened; i += 1) {
    const txt = (await buttons.nth(i).innerText().catch(() => '')).trim();
    if (/ממשל|שיטת שלטון|Government/.test(txt) && txt.length < 40 && !(await buttons.nth(i).isDisabled())) {
      await buttons.nth(i).dispatchEvent('click'); await wait(700);
      if (await page.locator('[role="dialog"]').count()) { await record('government change dialog'); opened = true; await esc(); }
    }
  }
  if (!opened) skipped('government change dialog', 'no enabled government button found');
  await railTab(0);
});

await step('title', async () => {
  await wait(2500); // let the autosave run
  await page.goto(URL_BASE);
  await tid('title-screen').waitFor({ timeout: 120000 });
  await record('title screen');
  await click(tid('title-load'));
  await tid('title-load-view').waitFor({ timeout: 10000 });
  await record('title: load view');
  await click(tid('title-load-back'));
  if (await has(tid('title-settings'))) { await click(tid('title-settings')); await wait(800); await record('title: settings'); await esc(); }
});

// Extra screens: every scripts/ui/audit-steps/*.mjs exports default async (a) => { ... } with the helpers below.
const stepsDir = path.resolve('scripts/ui/audit-steps');
if (fs.existsSync(stepsDir)) {
  const api = { step, record, skipped, click, tid, has, wait, esc, patch, gs, evalMod, railTab, visitTabs, closeAllCards, selTile, selArmy, manage, capitalId, tClick, getPage: () => page, getCtx: () => ctx, URL_BASE, LANG };
  for (const f of fs.readdirSync(stepsDir).filter((x) => x.endsWith('.mjs')).sort()) {
    await (await import(pathToFileURL(path.join(stepsDir, f)).href)).default(api);
  }
}
//@@SCREENS

await browser.close();
const uniq = new Map();
for (const r of results) for (const it of r.items) { const k = it.text; if (!uniq.has(k)) uniq.set(k, []); uniq.get(k).push(r.screen); }
const lines = [`Hebrew audit (${LANG}) ${new Date().toISOString()}`, `screens: ${results.length}, with Latin: ${results.filter((r) => r.items.length).length}, skipped: ${results.filter((r) => r.skipped).length}, unique Latin strings: ${uniq.size}`, ''];
for (const r of results) lines.push(`${r.skipped ? 'SKIPPED' : r.items.length ? 'LATIN  ' : 'clean  '} ${r.screen}${r.skipped ? ': ' + r.skipped : ': ' + r.items.length}`);
lines.push('', 'Unique Latin strings, with the first screen each appeared on:');
for (const [k, v] of uniq) lines.push(`  ${k.slice(0, 140)}   <${v[0]}>`);
if (pageErrors.length) lines.push('', 'page errors:', ...pageErrors.slice(0, 10));
if (!ONLY) fs.writeFileSync(path.join(OUT, `report-${LANG}.txt`), lines.join('\n'));
console.log(lines.slice(0, 3).join('\n'));
if (!ONLY) fs.writeFileSync(path.join(OUT, `report-${LANG}.json`), JSON.stringify({ results, pageErrors }, null, 1));
