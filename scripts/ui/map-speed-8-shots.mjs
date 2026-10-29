// scripts/ui/map-speed-8-shots.mjs
// Lane map-speed-8 (F145): the map is never black. A new game's first frames (the Earth at once, the
// small "Loading map detail" chip), then the map's tiles made to fail (requests aborted) after a zoom:
// the low-detail Earth stays with the "Retry" chip; Retry with the network back clears it.
// 844x390 touch and 1600x900, en and he.
//   node scripts/preview.mjs --mobile --port 4251 &  node scripts/ui/map-speed-8-shots.mjs [--url http://localhost:4251/] [--out dir]
import { mkdirSync } from 'node:fs';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:4251/');
const OUT = arg('--out', 'plans/lanes/map-speed-8-shots');
mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launchBrowser({ channel: 'chrome' });
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok' : 'FAIL'} ${what}`); if (!ok) bad++; };

for (const [sizeName, size] of Object.entries(SIZES)) {
  for (const lang of ['en', 'he']) {
    const tag = `${sizeName}-${lang}`;
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.mobile ? 2 : 1, isMobile: size.mobile, hasTouch: size.mobile });
    await ctx.addInitScript((l) => {
      window.__E2E_MAP_TEST__ = true;
      try { localStorage.setItem('terra-imperium.language', l); localStorage.setItem('terra-imperium-map-mode', 'flat'); } catch { /* none */ }
    }, lang);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(URL);
    await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
    await page.locator('[data-people]').first().dispatchEvent('click');
    await page.getByTestId('start-step-ready').dispatchEvent('click');
    await page.getByTestId('begin-game').dispatchEvent('click');
    // the first frame: a picture, not black (the chip may already be gone on a fast machine)
    await page.waitForFunction(() => window.__glMap?.info().frames > 0, null, { timeout: 60000 });
    const chipAtFirst = await page.getByTestId('map-detail-loading').isVisible().catch(() => false);
    await page.screenshot({ path: `${OUT}/1-first-frame-${tag}.png` });
    console.log(`${tag}: loading chip at the first frame: ${chipAtFirst}`);
    await page.waitForFunction(() => window.__glMap?.info().detail == null, null, { timeout: 30000 }).catch(() => {});
    check(!(await page.getByTestId('map-detail-loading').isVisible().catch(() => false)), `${tag} the loading chip goes once the detail is in`);
    for (let i = 0; i < 4; i++) {
      const b = page.getByRole('button', { name: /^(Skip|Later|Not now|דילוג|דלג|אחר כך|לא עכשיו)$/ }).first();
      if (await b.isVisible().catch(() => false)) await b.dispatchEvent('click');
      await wait(300);
    }
    // the network drops: every map picture fails; zoom out to the world and in somewhere new
    await page.route(/\/map\/(tiles|cover)\//, (r) => r.abort());
    await page.evaluate(() => window.__map2DTest.focus(30, 31, 6)); // the Nile delta, level 5 tiles
    await page.waitForFunction(() => window.__glMap?.info().detail === 'failed', null, { timeout: 20000 }).catch(() => {});
    const retry = page.getByTestId('map-detail-retry');
    check(await retry.isVisible().catch(() => false), `${tag} failed tiles show the Retry chip`);
    const info = await page.evaluate(() => window.__glMap.info());
    check(info.raster.failed > 0 && info.frames > 0, `${tag} the failed tiles are counted (${info.raster.failed}) and the map still draws`);
    await page.screenshot({ path: `${OUT}/2-retry-chip-${tag}.png` });
    // the network is back: Retry loads them and the chip goes
    await page.unroute(/\/map\/(tiles|cover)\//);
    await retry.dispatchEvent('click');
    await page.waitForFunction(() => window.__glMap?.info().detail == null, null, { timeout: 20000 }).catch(() => {});
    check(!(await retry.isVisible().catch(() => false)), `${tag} Retry with the network back clears the chip`);
    await page.screenshot({ path: `${OUT}/3-after-retry-${tag}.png` });
    check(errors.length === 0, `${tag} no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    await ctx.close();
  }
}
await browser.close();
console.log(bad ? `${bad} checks failed` : 'all checks ok');
process.exit(bad ? 1 : 0);
