// scripts/ui/help-map-8-probe.mjs
// Lane help-map-8: where the march target stands on screen when a march starts from the war card
// and after it is confirmed, on the classical era save (Israel at war with Akkad, Sippar the target).
//   npx vite --port 5231 &  node scripts/ui/help-map-8-probe.mjs [--url http://localhost:5231/terra-imperium/] [--tag before]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5231/terra-imperium/');
const TAG = arg('--tag', 'after');
const OUT = arg('--out', process.env.TEMP || '.');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const size = { width: 844, height: 390, mobile: true };

const browser = await launchBrowser({ channel: 'chrome' });
const g = await openGame(browser, { size, lang: 'en', url: URL });
const { page } = g;
await page.evaluate(() => { window.__E2E_MAP_TEST__ = true; });
await loadSlice(g, { state: readEraSave('classical').state });
const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
await dismiss();
await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:close-panels'))); await wait(800);
// the march target's screen point, and whether it is in the free map (not under the march bar, not off screen)
const where = () => page.evaluate(async () => {
  const s = window.__game.state; const { getTiles } = await import('/terra-imperium/src/data/geo/tiles.js');
  const c = Object.values(s.regions).find((r) => r.name === 'Sippar'); const { lat, lon } = getTiles().latLonOf(c.tile);
  const p = window.__map2DTest.project(lat, lon); const b = document.querySelector('[data-testid="march-bar"]')?.getBoundingClientRect();
  const underBar = !!b && p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom;
  const off = p.x < 0 || p.y < 40 || p.x > innerWidth - 60 || p.y > innerHeight - 70;
  return `Sippar at ${Math.round(p.x)},${Math.round(p.y)} bar ${b ? `${Math.round(b.top)}-${Math.round(b.bottom)}` : 'none'} ${underBar ? 'UNDER BAR' : off ? 'OFF THE FREE MAP' : 'in view'}`;
});
await page.getByTestId('war-pill').first().dispatchEvent('click'); await wait(1200);
await page.getByTestId('war-march').first().dispatchEvent('click'); await wait(2500);
console.log(TAG, 'march set from the war card:', await where());
await page.screenshot({ path: `${OUT}/hm8-${TAG}-march-set.jpg`, type: 'jpeg', quality: 70 });
await page.getByTestId('march-attack').first().dispatchEvent('click'); await wait(2500);
console.log(TAG, 'after March to attack:', await where());
await page.screenshot({ path: `${OUT}/hm8-${TAG}-march-confirmed.jpg`, type: 'jpeg', quality: 70 });
console.log('page errors', g.errors.slice(0, 3));
await browser.close();
