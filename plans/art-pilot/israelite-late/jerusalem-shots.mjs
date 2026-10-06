// plans/art-pilot/israelite-late/jerusalem-shots.mjs
// Browser check of the Israelite towns: a Dawn game as Israel, then for each age the state's age
// (and every nation's tech age) is set with LOAD_GAME and the flat map's close view is framed on
// Jerusalem and on a Levant town (Amman). Run `npx vite` first, then
//   node plans/art-pilot/israelite-late/jerusalem-shots.mjs [out_dir] [tag]
import { chromium } from '@playwright/test';

const OUT = process.argv[2] || 'plans/art-pilot/israelite-late';
const TAG = process.argv[3] || '';
const BASE = process.env.BASE_URL || 'http://localhost:5173/terra-imperium/';
const AGES = (process.env.AGES || 'bronze,classical,kingdoms,gunpowder,modern').split(',');
const VIEWS = [['phone', 844, 390], ['desktop', 1440, 900]].filter(([n]) => !process.env.VIEW || process.env.VIEW === n);
const K = Number(process.env.K || 70);
const TIER = process.env.TIER || 'medium'; // the town size: buildings per category so townTier picks it

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [view, w, h] of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; });
  await page.goto(BASE);
  await page.getByPlaceholder('Search 240 nations...').fill('Israel');
  await page.getByRole('button', { name: 'Israel', exact: true }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Begin as Israel' }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await page.getByTitle('Flat map view').click();
  await page.waitForFunction(() => window.__map2DTest?.features?.length > 0, null, { timeout: 90000 });
  // the research picker and the city list cover part of the map: close them
  await page.getByRole('button', { name: 'Let my advisor choose' }).click().catch(() => {});
  await page.waitForTimeout(500);
  const ids = await page.evaluate(() => ({ il: window.__game.state.nations.il.capitalRegionId }));
  // frame a city: centre the visible map on a point just above its banner (where the town stands)
  const frame = async (id, k) => {
    let c = { lat: 31.85, lng: 35.3 };
    for (let i = 0; i < 3; i++) {
      await page.evaluate(({ c, k }) => window.__map2DTest.focus(c.lat, c.lng, k), { c, k });
      await page.waitForTimeout(1000);
      const box = await page.locator(`[data-city-banner="${id}"]`).first().boundingBox().catch(() => null);
      if (!box) return false;
      const map = await page.getByTestId('flat-map').boundingBox();
      const d = await page.evaluate((c) => ({ a: window.__map2DTest.project(c.lat, c.lng), b: window.__map2DTest.project(c.lat + 0.1, c.lng + 0.1) }), c);
      const sx = (d.b.x - d.a.x) / 0.1, sy = (d.b.y - d.a.y) / 0.1;
      const tx = box.x + box.width / 2 - map.x, ty = box.y - map.y - Number(process.env.LIFT || 30);
      c = { lat: c.lat + (ty - d.a.y) / sy, lng: c.lng + (tx - d.a.x) / sx };
    }
    await page.evaluate(({ c, k }) => window.__map2DTest.focus(c.lat, c.lng, k), { c, k });
    return true;
  };
  for (const age of AGES) {
    await page.evaluate(({ age, tier }) => {
      const { state, dispatch } = window.__game;
      const cats = tier === 'big' ? { food: 2, economy: 2, defense: 2, culture: 0 } : tier === 'medium' ? { food: 1, economy: 0, culture: 0, science: 0, defense: 0 } : { food: -1, economy: -1, defense: 0 };
      const nations = Object.fromEntries(Object.entries(state.nations).map(([id, n]) => [id, { ...n, tech: { ...(n.tech || {}), ageId: age } }]));
      const grow = (id) => id && state.regions[id] ? { [id]: { ...state.regions[id], buildings: { ...(state.regions[id].buildings || {}), categories: { ...(state.regions[id].buildings?.categories || {}), ...cats } } } } : {};
      const regions = { ...state.regions, ...grow(state.nations.il?.capitalRegionId), ...grow(state.nations.jo?.capitalRegionId), ...grow(state.nations.ps?.capitalRegionId) };
      dispatch({ type: 'LOAD_GAME', payload: { ...state, age, techAgeId: age, nations, regions } });
    }, { age, tier: TIER });
    for (const [key, id] of [['jerusalem', ids.il], ...([])]) {
      await page.evaluate(() => { window.__shotCentre = null; });
      if (!(await frame(id, K))) { console.log('no banner for', id); continue; }
      await page.waitForTimeout(Number(process.env.WAIT || 8000));
      const file = `${OUT}/${age}-${key}-${view}${TAG ? '-' + TAG : ''}.png`;
      await page.screenshot({ path: file });
      console.log('wrote', file);
    }
  }
  await page.close();
}
await browser.close();
