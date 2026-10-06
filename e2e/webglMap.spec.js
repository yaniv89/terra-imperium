// e2e/webglMap.spec.js
// The one WebGL map (plans/MASTER-PLAN.md 5.4, src/components/map/gl/GLMapView.jsx): it is the map
// (the globe and its switch hidden), it pans and zooms by wheel, drag and pinch, a tap picks a
// city, a tile or a marker, and the world wraps east to west. A phone held sideways (844x390,
// touch) is the reference screen.
import { test, expect } from '@playwright/test';

const startGame = async (page, nation = 'France') => {
  await page.addInitScript(() => { window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true; try { localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ } });
  await page.goto('/');
  await page.fill('input[placeholder="Search 240 nations..."]', nation);
  await page.locator('section', { has: page.getByRole('heading', { name: 'Choose Your Nation' }) }).locator('button').first().dispatchEvent('click');
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  await expect(page.getByTestId('flat-map')).toHaveAttribute('data-renderer', 'webgl', { timeout: 60000 });
  await page.waitForFunction(() => window.__map2DTest?.focus && window.__glMap, null, { timeout: 90000 });
};
const mapBox = (page) => page.getByTestId('flat-map').boundingBox();
// The first screen point of the map (a 13 px grid, clear of the panels' edges) where a tap picks
// what `test` wants (the map's own answer, __map2DTest.pickAt).
const findPick = (page, box, test, arg = null) => page.evaluate(({ w, h, bx, by, src, a }) => {
  // only where the map itself is under the finger (not a panel over it)
  const onMap = (x, y) => document.elementFromPoint(bx + x, by + y)?.dataset?.testid === 'gl-map';
  const want = new Function(`return (${src})`)();
  // the whole fingertip ring (18 px, as the map's tap chooser) must pick the same, or a touch asks which city
  const ring = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2) * 18, Math.sin((i / 8) * Math.PI * 2) * 18])];
  for (let y = 60; y < h - 30; y += 13) {
    for (let x = 40; x < w - 120; x += 13) {
      const q = window.__map2DTest.pickAt(x, y);
      if (!want(q, a) || !onMap(x, y)) continue;
      if (q.kind !== 'city' || ring.every(([dx, dy]) => { const r = window.__map2DTest.pickAt(x + dx, y + dy); return r?.kind === 'city' && r.id === q.id; })) return { x, y };
    }
  }
  return null;
}, { w: box.width, h: box.height, bx: box.x, by: box.y, src: test.toString(), a: arg });
const capitalOf = (page, nation) => page.evaluate((n) => {
  const f = window.__map2DTest.features.find((x) => x.properties.owner === n && x.properties.gameRegionId);
  return f ? f.properties.gameRegionId : null;
}, nation);

test.describe('the WebGL map on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('is the map: no globe switch, wheel zoom, a tap on land picks the city, on open land the tile', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    await expect(page.getByTitle('Globe view')).toHaveCount(0);
    const box = await mapBox(page);
    // wheel zoom
    await page.evaluate(() => window.__map2DTest.focus(46.5, 2.5, 4));
    const k0 = await page.evaluate(() => window.__map2DTest.transform().k);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(() => page.evaluate(() => window.__map2DTest.transform().k)).toBeGreaterThan(k0 * 1.2);
    // a tap on France's land selects its city
    const paris = await capitalOf(page, 'fr');
    expect(paris).toBeTruthy();
    await page.evaluate(() => window.__map2DTest.focus(48.85, 2.35, 10));
    await page.waitForTimeout(500);
    // a point of its land, away from the town's banner
    const p = await findPick(page, box, (q, id) => q?.kind === 'city' && q.via === 'land' && q.id === id, paris);
    expect(p).not.toBeNull();
    await page.mouse.click(box.x + p.x, box.y + p.y);
    await expect.poll(() => page.evaluate(() => window.__map2DTest.selected)).toBe(paris);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__map2DTest.selected)).toBeNull();
    // open land nobody holds, near France: the tile sheet
    await page.evaluate(() => window.__map2DTest.focus(47, 2.5, 6));
    await page.waitForTimeout(500);
    const free = await page.evaluate(({ w, h, bx, by }) => {
      for (let y = 80; y < h - 40; y += 23) for (let x = 300; x < w - 300; x += 23) { const p = window.__map2DTest.pickAt(x, y); if (p?.kind === 'tile' && p.land && p.explored && document.elementFromPoint(bx + x, by + y)?.dataset?.testid === 'gl-map') return { x, y, tile: p.tile }; }
      return null;
    }, { w: box.width, h: box.height, bx: box.x, by: box.y });
    expect(free).not.toBeNull();
    await page.mouse.click(box.x + free.x, box.y + free.y);
    await expect(page.getByTestId('tile-yields')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('wraps east to west: dragging across the antimeridian continues into the other side', async ({ page }) => {
    test.setTimeout(120000);
    await startGame(page);
    await page.evaluate(() => window.__map2DTest.focus(62, 175, 4));
    await page.waitForTimeout(300);
    const box = await mapBox(page);
    const before = await page.evaluate(() => window.__map2DTest.project(62, -170));
    // drag the map left by 400 px: Alaska comes in from the right
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * 0.4 - i * 40, box.y + box.height / 2);
    await page.mouse.up();
    const after = await page.evaluate(() => window.__map2DTest.project(62, -170));
    expect(Math.abs(after.x - (before.x - 400))).toBeLessThan(2);
    // and Alaska, past the line, is land a tap picks (the world goes on, no empty band)
    const ak = await page.evaluate(() => window.__map2DTest.project(64, -152));
    expect(ak.x).toBeGreaterThan(0); expect(ak.x).toBeLessThan(box.width);
    expect(await page.evaluate(({ x, y }) => window.__map2DTest.pickAt(x, y), ak)).toMatchObject({ land: true });
  });
});

test.describe('the WebGL map on a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('pinch zoom, and a tap on the army banner or the land picks the city', async ({ page }) => {
    test.setTimeout(150000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await startGame(page);
    await page.evaluate(() => window.__map2DTest.focus(47.5, 2.5, 4));
    await page.waitForTimeout(400);
    const box = await mapBox(page);
    const k0 = await page.evaluate(() => window.__map2DTest.transform().k);
    // a pinch: two fingers moving apart
    const cdp = await page.context().newCDPSession(page);
    const cx = box.x + box.width * 0.4; const cy = box.y + box.height * 0.55;
    const touch = (type, d) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
    await touch('touchStart', 20);
    for (let d = 30; d <= 120; d += 10) await touch('touchMove', d);
    await touch('touchEnd', 0);
    await expect.poll(() => page.evaluate(() => window.__map2DTest.transform().k)).toBeGreaterThan(k0 * 2);
    // a tap on the land of Paris
    const paris = await capitalOf(page, 'fr');
    await page.evaluate(() => window.__map2DTest.focus(48.85, 2.35, 14));
    await page.waitForTimeout(500);
    const p = await findPick(page, box, (q, id) => q?.kind === 'city' && q.via === 'land' && q.id === id, paris);
    expect(p).not.toBeNull();
    await page.touchscreen.tap(box.x + p.x, box.y + p.y);
    await expect.poll(() => page.evaluate(() => window.__map2DTest.selected)).toBe(paris);
    await page.getByRole('button', { name: 'Close', exact: true }).first().dispatchEvent('click');
    await expect.poll(() => page.evaluate(() => window.__map2DTest.selected)).toBeNull();
    // your army banner over Paris: a garrison opens its city
    await page.evaluate(() => window.__map2DTest.focus(48.85, 2.35, 6));
    await page.waitForTimeout(600);
    const army = await findPick(page, box, (q) => q?.kind === 'marker' && q.marker === 'army' && q.own);
    expect(army).not.toBeNull();
    await page.touchscreen.tap(box.x + army.x, box.y + army.y);
    await expect.poll(() => page.evaluate(() => window.__map2DTest.selected)).toBe(paris);
    expect(errors).toEqual([]);
  });
});

test.describe('the globe behind its setting', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('with the setting on, the globe switch comes back', async ({ page }) => {
    test.setTimeout(120000);
    await page.addInitScript(() => { localStorage.setItem('terra-imperium-show-globe', '1'); localStorage.setItem('terra-imperium-map-mode', 'flat'); });
    await startGame(page);
    await expect(page.getByTitle('Globe view')).toHaveCount(1);
  });
});
