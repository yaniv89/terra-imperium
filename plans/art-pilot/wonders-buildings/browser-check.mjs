// plans/art-pilot/wonders-buildings/browser-check.mjs
// Browser check of the wonders and base landmarks in the close view (README.md here). Starts as
// Egypt, sets up cities, buildings and wonders through the dev modules, saves, reloads, and
// screenshots each city. Needs npx vite on port 5173.
//   node plans/art-pilot/wonders-buildings/browser-check.mjs <outDir> [desktop|phone|both]
//   env: ONLY=cairo,rome  AGE=modern  KS=60,120  WAIT=5000
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2];
const MODES = (process.argv[3] || 'both') === 'both' ? ['desktop', 'phone'] : [process.argv[3]];
const BASE = 'http://localhost:5173/terra-imperium/';
fs.mkdirSync(OUT, { recursive: true });

// what each check city gets: lat/lng, buildings, wonders (tier 3), a modern age for its nation
const SETUP = [
  { key: 'cairo', within: 0.9, lat: 30.04, lng: 31.24, cats: { food: 1, culture: 1, economy: 0 }, wonders: ['great_pyramids'] },
  { key: 'rome', name: 'Rome', nation: 'it', lat: 41.9, lng: 12.5, cats: { culture: 1, economy: 1, military: 0 }, wonders: ['colosseum'] },
  { key: 'alexandria', name: 'Alexandria', nation: 'eg', lat: 31.2, lng: 29.92, cats: { science: 1, naval: 0, economy: 0 }, wonders: ['lighthouse', 'great_library'], coastal: 'lighthouse' },
  { key: 'beijing', within: 0.9, lat: 39.9, lng: 116.4, cats: { culture: 1, food: 1, science: 0 }, wonders: ['forbidden_city'] },
  { key: 'london', within: 0.9, lat: 51.5, lng: -0.12, cats: { industry: 2, economy: 2, science: 3, naval: 1 }, wonders: [], modern: true }
];

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const PICK = ONLY ? SETUP.filter((s) => ONLY.includes(s.key)) : SETUP;
const setup = async (page) => page.evaluate(async (SETUP) => {
  const B = '/terra-imperium/src/';
  const { getTiles } = await import(B + 'data/geo/tiles.js');
  const { foundCity, sizeToPeople } = await import(B + 'engine/world/cities.js');
  const { syncWorldRegistry } = await import(B + 'engine/world/registry.js');
  // found a city on exactly this tile (it takes the tile from any border over it), as testWorld.addCity
  const addCityAt = (state, nationId, tile, size, name) => {
    const world = { cities: state.regions, tileOwner: state.world.tileOwner, tileState: state.world.tileState || {} };
    const r = foundCity(world, tiles, { nationId, tile, size, name, turn: state.turnNumber || 1 });
    const record = { ...r.city, founderId: nationId, owner: nationId, control: 100, currentPopulation: sizeToPeople(size), currentInfrastructure: 0, underInvasion: false, unrest: 0, defenseLevel: 0, climateResilience: 0, dev: { tax: size, production: size, manpower: size }, buildings: r.city.buildings };
    const next = { ...state, regions: { ...r.world.cities, [record.id]: record }, world: { ...state.world, tileOwner: r.world.tileOwner, tileState: r.world.tileState } };
    syncWorldRegistry(next);
    return { state: next, cityId: record.id };
  };
  const { CURRENT_SAVE_VERSION } = await import(B + 'engine/saveMigrations.js');
  const tiles = getTiles();
  let state = JSON.parse(JSON.stringify(window.__game.state));
  if (window.__AGE) state.age = window.__AGE;
  const report = {};
  const dist = (a, b) => { const p = tiles.latLonOf(a); const q = tiles.latLonOf(b); return Math.hypot(p.lat - q.lat, (p.lon - q.lon) * Math.cos((p.lat * Math.PI) / 180)); };
  for (const s of SETUP) {
    const t = tiles.nearest(s.lat, s.lng, 30).find((x) => tiles.land[x] === 1);
    const near = Object.values(state.regions).filter((c) => c.tile != null).sort((a, b) => dist(a.tile, t) - dist(b.tile, t))[0];
    let city = near && dist(near.tile, t) < (s.within || 0.3) ? near : null;
    if (!city) {
      const nation = s.nation || (tiles.countryOf(t) && state.nations[tiles.countryOf(t)] ? tiles.countryOf(t) : near.owner);
      const r = addCityAt(state, nation, t, 6, s.name);
      state = r.state; city = state.regions[r.cityId];
    }
    const cats = { ...city.buildings.categories, ...s.cats };
    state.regions[city.id] = { ...state.regions[city.id], buildings: { ...city.buildings, categories: cats } };
    if (s.modern) {
      const n = state.nations[city.owner];
      state.nations[city.owner] = { ...n, tech: { ...(n.tech || {}), ageId: 'modern' } };
      if (city.owner === state.playerNationId) state.techAgeId = 'modern';
    }
    // wonder tiles: land in the city's border, not the centre, a coastal one for the lighthouse
    const own = (city.tiles || []).filter((x) => x !== city.tile && tiles.land[x] === 1 && !state.world.tileState?.[x]?.wonder);
    const coastal = own.filter((x) => tiles.neighbors[x].some((n) => tiles.land[n] !== 1));
    state.world.tileState ||= {};
    s.wonders.forEach((w) => {
      const pool = w === s.coastal && coastal.length ? coastal : own.filter((x) => !coastal.includes(x) || !s.coastal);
      const wt = pool.find((x) => !state.world.tileState[x]?.wonder) ?? own.find((x) => !state.world.tileState[x]?.wonder);
      state.world.tileState[wt] = { ...(state.world.tileState[wt] || {}), wonder: w };
      state.greatProjects = { ...(state.greatProjects || {}), [w]: { regionId: city.id, tier: 3, tile: wt } };
    });
    const c = tiles.latLonOf(city.tile);
    report[s.key] = { id: city.id, name: city.name, owner: city.owner, lat: c.lat, lng: c.lon, size: city.size, coastal: city.water };
  }
  localStorage.setItem('terra-imperium-save-v1', JSON.stringify({ version: CURRENT_SAVE_VERSION, state, savedAt: Date.now() }));
  return report;
}, PICK);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let cities = process.env.REUSE ? JSON.parse(fs.readFileSync(process.env.REUSE, "utf8")) : null;
for (const mode of MODES) {
  const viewport = mode === 'phone' ? { width: 844, height: 390 } : { width: 1440, height: 900 };
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mode === 'phone', hasTouch: mode === 'phone' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${mode} pageerror ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${mode} ${m.type()} ${m.text().slice(0, 200)}`); });
  await page.addInitScript((age) => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; window.__AGE = age; }, process.env.AGE || null);
  await page.goto(BASE);
  if (!cities) {
    await page.getByPlaceholder('Search 240 nations...').fill('Egypt');
    await page.getByRole('button', { name: 'Egypt', exact: true }).dispatchEvent('click');
    await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
    await page.getByRole('button', { name: 'Begin as Egypt' }).dispatchEvent('click');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.waitForFunction(() => window.__game?.state, null, { timeout: 90000 });
    cities = await setup(page);
    fs.writeFileSync(`${OUT}/cities.json`, JSON.stringify(cities, null, 2));
    const save = await page.evaluate(() => localStorage.getItem('terra-imperium-save-v1'));
    fs.writeFileSync(`${OUT}/save.json`, save);
  } else {
    const save = fs.readFileSync(`${OUT}/save.json`, 'utf8');
    await page.evaluate((s) => localStorage.setItem('terra-imperium-save-v1', s), save);
  }
  await page.reload();
  await page.waitForTimeout(6000);
  const skip = page.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await page.waitForTimeout(1000);
  // the research chooser opens on a new turn: close it so the map shows
  const close = page.getByRole('button', { name: 'Later', exact: true });
  if (await close.count()) await close.first().dispatchEvent('click').catch(() => {});
  await page.getByTitle('Flat map view').dispatchEvent('click');
  await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 90000 });
  if (await close.count()) await close.first().dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${mode}-start.png` });
  console.log(mode, 'hook', await page.evaluate(() => !!window.__map2DTest));
  // warm up: visit every city once so the model files are in before the shots
  for (const c of Object.values(cities)) { await page.evaluate((c) => window.__map2DTest.focus(c.lat, c.lng, 60), c); await page.waitForTimeout(5000); }
  await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 90000 });
  // the flat map: the globe view may be the default
  for (const [key, c] of Object.entries(cities)) {
    for (const k of (process.env.KS || '60,120').split(',').map(Number)) {
      await page.evaluate(({ c, k }) => window.__map2DTest.focus(c.lat, c.lng, k), { c, k });
      await page.waitForTimeout(2500);
      // wait for the models to come in (the close canvas redraws on load)
      await page.waitForTimeout(Number(process.env.WAIT || 6000));
      await page.screenshot({ path: `${OUT}/${mode}-${key}-k${k}.png` });
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${OUT}/errors.txt`, errors.join('\n'));
console.log(JSON.stringify(cities), '\nerrors:', errors.length);
