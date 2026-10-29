// scripts/ui/odds-truth-shots.mjs
// Shots of lane odds-truth (plans/lanes/odds-truth-REPORT.md), 844x390 and 1600x900, en and he:
//   1. the attack card on Zafar (gunpowder era save, Israel at war with Saba) with Saba troops standing near it;
//   2. the siege card of Israel's capital held by its militia alone, walls nearly down, an Israeli army standing near.
//   npx vite --port 5263 &   node scripts/ui/odds-truth-shots.mjs [--url http://localhost:5263/terra-imperium/] [--tag after]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5263/terra-imperium/');
const OUT = path.resolve('plans/lanes/odds-truth-shots', arg('--tag', 'after'));
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = { state: readEraSave('gunpowder').state };

// Runs `body` on the live state with the tile grid and defense.js, then loads the result.
const patch = (page, body) => page.evaluate(async (b) => {
  const m = {};
  for (const p of ['data/geo/tiles.js', 'engine/defense.js']) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const s = await new Function('s', 'm', `return (async () => { ${b} })();`)(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
}, body);

const U = `const u = (id, owner, regionId, tile, classId, strength, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, ...extra });`;
// Saba troops beside Zafar and a spy report on Saba: the card is exact and names them.
const ZAFAR = `${U}
  const tiles = m.getTiles(); const z = s.regions.c86094;
  const ring = tiles.neighbors[z.tile].filter((t) => tiles.land[t] === 1 && !Object.values(s.regions).some((c) => c.tile === t));
  const units = { ...s.units, sb1: u('sb1', 'saba', 'c86094x', ring[1], 'infantry', 1000), sb2: u('sb2', 'saba', 'c86094x', ring[1], 'infantry', 1000), sb3: u('sb3', 'saba', 'c86094x', ring[1], 'cavalry', 1000) };
  return { ...s, units, intel: { ...(s.intel || {}), saba: s.turnNumber + 5 } };`;
// The capital held by militia alone, its walls at 40 of their HP, Saba at the gates, an Israeli army two tiles off.
const SIEGE = `${U}
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const war = s.wars.find((w) => w.active && (w.aggressor === me || w.enemy === me));
  const foe = war.aggressor === me ? war.enemy : war.aggressor;
  const tiles = m.getTiles();
  const ring = tiles.neighbors[cap.tile].filter((t) => tiles.land[t] === 1 && !Object.values(s.regions).some((c) => c.tile === t));
  const far = tiles.neighbors[ring[1]].find((t) => tiles.land[t] === 1 && !ring.includes(t) && t !== cap.tile);
  const other = Object.values(s.regions).find((c) => c.owner === me && c.id !== capId).id;
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.regionId !== capId && !ring.includes(x.tile))),
    e1: u('e1', foe, null, ring[0], 'infantry', 1000, { route: [cap.tile] }), e2: u('e2', foe, null, ring[0], 'infantry', 1000), e3: u('e3', foe, null, ring[0], 'cavalry', 1000),
    n1: u('n1', me, other, far, 'infantry', 1000), n2: u('n2', me, other, far, 'infantry', 1000) };
  s = { ...s, units, regions: { ...s.regions, [capId]: { ...cap, siege: { by: foe, hp: 40, maxHp: 640, startedTurn: s.turnNumber - 3 } } } };
  s = { ...s, battleSettings: { defaultMode: 'ask', autoDefend: false }, pendingDefenses: [m.createDefenseRecord(s, { war: { ...war, aggressor: foe }, regionId: capId, aggressorShare: 0.8, seed: 7, index: 1 })] };
  return s;`;

const run = async (browser, sizeId, lang) => {
  const g = await openGame(browser, { size: SIZES[sizeId], lang, url: URL });
  const { page } = g;
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${sizeId}-${lang}.png`), timeout: 120000 });
  await loadSlice(g, save);
  await wait(2500);
  await patch(page, ZAFAR); await wait(1500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: 'c86094' }))); await wait(2000);
  const invade = page.getByText(/^(Invade Zafar|פלשו אל )/);
  await shot('0-zafar-card');
  if (await invade.count()) { await invade.first().dispatchEvent('click'); await page.getByTestId('pre-battle').waitFor({ timeout: 30000 }).catch(() => {}); await wait(1500); await shot('1-zafar-attack'); console.log(sizeId, lang, 'theirs:', await page.getByTestId('pre-battle-theirs').textContent().catch(() => 'none')); }
  await page.keyboard.press('Escape'); await wait(500);
  await patch(page, SIEGE); await wait(2000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:show-defense')));
  await page.getByTestId('defense-sheet').waitFor({ timeout: 30000 }).catch(() => {});
  await wait(1500); await shot('2-siege-militia');
  console.log(sizeId, lang, 'walls:', await page.getByTestId('defense-walls').textContent().catch(() => 'none'), '| standby:', await page.getByTestId('defense-standby').textContent().catch(() => 'none'), '| warning:', await page.getByTestId('defense-hopeless').textContent().catch(() => 'none'));
  console.log(sizeId, lang, 'page errors:', g.errors.join(' | ') || 'none');
  await page.context().close();
};

const browser = await launchBrowser({ channel: process.env.PW_CHANNEL || undefined }); // PW_CHANNEL=chrome where Playwright's own browser is missing
for (const sizeId of arg('--sizes', 'phone,desktop').split(',')) for (const lang of arg('--langs', 'en,he').split(',')) {
  try { await run(browser, sizeId, lang); } catch (e) { console.log('fail', sizeId, lang, String(e.message).split('\n')[0]); }
}
await browser.close();
