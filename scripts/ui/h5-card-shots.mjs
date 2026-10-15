// Campaign cards in Hebrew (phase H5) at 844x390 and 844x340: the capture card, the pre-battle card,
// the nation sheet with its card, the peace deal, the independent city sheet, the region card.
// Needs a dev server of THIS checkout (`npx vite --port 5198`) and a Chrome; headless. States are set
// up through the dev-only window.__game hook with LOAD_GAME, as capture-shots.mjs does.
//   node scripts/ui/h5-card-shots.mjs [--url http://localhost:5198/terra-imperium/] [--out plans/ui/h5] [--lang he]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5198/terra-imperium/');
const LANG = arg('--lang', 'he');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(arg('--out', 'plans/ui/h5'));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

const TAKE = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const ind = Object.values(s.nations).filter((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
  const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
  const pick = ind.sort((a, b) => d(a) - d(b))[0];
  const cityId = pick.capitalRegionId;
  window.__indep = pick.id;
  const r = m.conquerRegion({ regions: s.regions, nations: s.nations, turnNumber: s.turnNumber }, cityId, me, null);
  return m.openCapture({ ...s, regions: r.regions, nations: r.nations }, { opId: 'shot1', cityId, by: me, from: pick.id, source: 'battle' });`;

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

const startGame = async (page) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
for (const H of [390, 340]) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await startGame(page);
  await page.evaluate(async (l) => (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l), LANG);
  await patch(page, 'return { ...s, researchAdvisor: true };').catch(() => {});
  // English words still on screen (the dialogs and sheets): a hint for the review, not a failure
  const leaks = async (name) => { const words = await page.evaluate(() => { const els = [...document.querySelectorAll('[role=dialog], [data-testid*=sheet], [data-testid*=card], [data-testid=pre-battle]')]; const text = els.map((e) => e.innerText).join(' '); return [...new Set(text.match(/[A-Za-z][A-Za-z'’-]{2,}/g) || [])]; }); console.log('  english in', name, words.slice(0, 25).join(' | ')); };
  const shot = async (name) => { await leaks(name); await wait(700); await page.screenshot({ path: path.join(OUT, `${name}-${LANG}-${H}.png`), timeout: 120000 }); };

  // the capture card
  await patch(page, TAKE, ['engine/conquest.js', 'engine/capture.js']);
  await page.getByTestId('capture-card').waitFor({ timeout: 15000 }).catch(() => {});
  await shot('capture');
  await click(page.getByTestId('capture-choice-tributary'));
  await shot('capture-tributary');
  const indepId = await page.evaluate(() => window.__indep);
  await click(page.getByTestId('capture-go'));
  await wait(800);

  // the independent city sheet
  if (indepId) {
    await page.evaluate(async (id) => (await import('/terra-imperium/src/components/independents/independentEvents.js')).openIndependent(id), indepId);
    await page.getByTestId('independent-sheet').waitFor({ timeout: 8000 }).catch(() => {});
    await shot('independent');
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 10);
    await wait(400);
  }

  // the pre-battle card (a clash on nobody's land)
  await patch(page, CLASH, ['data/geo/tiles.js']);
  const pair = await page.evaluate(() => window.__clash);
  await page.evaluate(async (tile) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectTile(tile), pair[1]);
  const attack = page.getByTestId('attack-army').first();
  await attack.waitFor({ timeout: 10000 }).catch(() => {});
  if (await attack.isVisible().catch(() => false)) {
    await click(attack);
    await page.getByTestId('pre-battle').waitFor({ timeout: 15000 }).catch(() => {});
    await shot('prebattle');
    await click(page.getByTestId('battle-choice-calloff').first()).catch(() => {});
  }

  // the nation sheet and its card
  const nid = await page.evaluate(() => { const s = window.__game.state; return Object.values(s.nations).find((n) => !n.indep && n.id !== s.playerNationId && !n.isEliminated)?.id; });
  await page.evaluate(async (id) => { const s = window.__game.state; const f = await import('/terra-imperium/src/engine/fog.js'); window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, fog: { ...(s.fog || {}), met: { ...(s.fog?.met || {}), [s.playerNationId]: { ...(s.fog?.met?.[s.playerNationId] || {}), [id]: 1 } } } } }); return f; }, nid);
  await page.evaluate(async (id) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectNation(id), nid);
  await shot('nation');
  await page.getByTestId('nation-sheet').waitFor({ timeout: 8000 }).catch(() => {});
  await page.evaluate(async (id) => {
    const s0 = window.__game.state;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s0, resources: { ...s0.resources, gold: 99999, adm: 999, dip: 999, mil: 999 } } });
    window.__game.dispatch({ type: 'DECLARE_WAR', payload: { nationId: id } });
  }, nid);
  await wait(600);
  await page.evaluate(async (id) => (await import('/terra-imperium/src/components/map/marchEvents.js')).selectNation(id), nid);
  await wait(800);
  const peaceTile = page.getByText(LANG === 'he' ? 'הסכם שלום' : 'Peace deal').first();
  if (await peaceTile.count()) {
    await click(peaceTile);
    await page.getByTestId('peace-deal').waitFor({ timeout: 8000 }).catch(() => {});
    await shot('peace');
    await page.keyboard.press('Escape');
    await page.mouse.click(8, 8);
  }
  await patch(page, `
    const me = s.playerNationId; const nid = ${JSON.stringify(nid)}; const cap = s.nations[me].capitalRegionId;
    const war = (s.wars || []).find((w) => w.active);
    if (!war) return s;
    const rec = m.createDefenseRecord(s, { war: { ...war, aggressor: nid }, regionId: cap, aggressorShare: 1, seed: 5, index: 0 });
    return { ...s, pendingDefenses: [rec] };`, ['engine/defense.js']).catch(() => {});
  await page.getByTestId('defense-sheet').waitFor({ timeout: 8000 }).catch(() => {});
  await shot('defense');
  console.log(LANG, H, errors.length ? errors.slice(0, 2).join(' | ') : 'no page errors');
  await ctx.close();
}
await browser.close();
