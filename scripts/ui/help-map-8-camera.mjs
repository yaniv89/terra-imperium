// scripts/ui/help-map-8-camera.mjs
// Lane help-map-8, lead's manual playtest (29 Oct): does the camera go to what the player picks?
// The city list (Cities tab), a settler (Idle chip), a loaded save, and "Next army" with units in a garrison.
//   npx vite --port 5231 &  node scripts/ui/help-map-8-camera.mjs [--url http://localhost:5231/terra-imperium/] [--size phone|desktop]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5231/terra-imperium/');
const size = arg('--size', 'phone') === 'phone' ? { width: 844, height: 390, mobile: true } : { width: 1600, height: 900, mobile: false };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser({ channel: 'chrome' });
const g = await openGame(browser, { size, lang: 'en', url: URL });
const { page } = g;
await page.evaluate(() => { window.__E2E_MAP_TEST__ = true; });
const save = readEraSave(arg('--age', 'classical')).state;
await loadSlice(g, { state: save });
const ev = (name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
await dismiss(); await ev('ti:close-panels'); await wait(800);
// screen point of a tile, and whether it sits in the middle third of the screen
const at = (tile) => page.evaluate(async (t) => {
  const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js'); const { lat, lon } = getTiles().latLonOf(t);
  const p = window.__map2DTest.project(lat, lon); const mid = p.x > innerWidth * 0.15 && p.x < innerWidth * 0.85 && p.y > innerHeight * 0.15 && p.y < innerHeight * 0.85;
  return `${Math.round(p.x)},${Math.round(p.y)} ${mid ? 'centred' : 'NOT CENTRED'}`;
}, tile);
const s0 = await page.evaluate(() => window.__game.state);
const cities = Object.values(s0.regions).filter((r) => r.owner === s0.playerNationId);
const cap = s0.nations[s0.playerNationId].capitalRegionId;
console.log('after load: capital', s0.regions[cap].name, await at(s0.regions[cap].tile));
// pan away, then pick the farthest own city from the city list
const far = cities.sort((a, b) => Math.abs(b.tile - s0.regions[cap].tile) - Math.abs(a.tile - s0.regions[cap].tile))[0];
await page.evaluate(() => { const t = window.__map2DTest.transform(); window.__map2DTest.setTransform({ x: t.x + 600, y: t.y + 300, k: t.k }); }); await wait(800);
await ev('ti:open-tab', 'cities'); await wait(1200);
const row = page.locator(`[data-testid="city-rail-row"][data-city-id="${far.id}"]`).first();
if (await row.count()) { await row.dispatchEvent('click'); await wait(2000); console.log('city list ->', far.name, await at(far.tile)); } else console.log('city list: no row for', far.name);
await ev('ti:close-panels'); await page.keyboard.press('Escape'); await wait(800);
// a settler far from the view: its tile through the Idle chip's event
const st = await page.evaluate(() => {
  const s = window.__game.state; const far = Object.values(s.regions).filter((r) => r.owner === s.playerNationId).pop();
  const u = { id: 'unit_probe', ownerId: s.playerNationId, classId: 'settler', domain: 'land', tile: far.tile, regionId: far.id, homeRegionId: far.id, strength: 1, maxStrength: 1, movesLeft: 1 };
  window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, units: { ...s.units, [u.id]: u } } });
  return far.tile;
});
await wait(800);
await page.evaluate(() => { const t = window.__map2DTest.transform(); window.__map2DTest.setTransform({ x: t.x - 900, y: t.y + 400, k: t.k }); }); await wait(800);
await ev('ti:select-tile', st); await wait(2000);
console.log('settler ->', await at(st));
await page.keyboard.press('Escape'); await wait(500);
// a load of a save of the same game, the camera panned away first
await page.evaluate(() => { const t = window.__map2DTest.transform(); window.__map2DTest.setTransform({ x: t.x + 1500, y: t.y - 700, k: t.k }); }); await wait(800);
await page.evaluate((json) => window.__game.load(JSON.parse(json)), JSON.stringify(save)); await wait(4000);
console.log('after a second load: capital', await at(s0.regions[cap].tile));
// Next army: what the cycle holds vs the player's land stacks
const cyc = await page.evaluate(async () => {
  const s = window.__game.state; const { armyCycle } = await import('/terra-imperium/src/components/map/mapCamera.js');
  const stacks = new Set(Object.values(s.units).filter((u) => u.ownerId === s.playerNationId && u.strength > 0 && u.domain !== 'naval' && !u.settler && !u.band).map((u) => u.tile));
  return { cycle: armyCycle(s).length, stacks: stacks.size };
});
console.log('next army cycle', cyc.cycle, 'of', cyc.stacks, 'land stacks');
await page.screenshot({ path: `${process.env.TEMP}/hm8/cam-end.jpg`, type: 'jpeg', quality: 60 });
console.log('page errors', g.errors.slice(0, 3));
await browser.close();
