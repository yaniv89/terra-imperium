// scripts/worldgen/look-shots.mjs
// The look check of generated worlds (plans/MAP-VARIATIONS-PLAN.md 8.4): a new game on a generated
// world (or the real Earth, for the side by side), screenshotted at the start zoom on the capital,
// a mid zoom and the world view, at 844x390 (dpr 2) and 1280x800, with the GPU on.
//   npx vite --port 5743 &   then
//   node scripts/worldgen/look-shots.mjs --url http://localhost:5743/terra-imperium --seeds 1,2,3 --out plans/map-variations/generated
//        [--earth] (also the real Earth)  [--version 2]  [--people akkad]  [--profiles phone,desktop]
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt; };
const flag = (name) => process.argv.includes(`--${name}`);
const url = arg('url', 'http://localhost:5743/terra-imperium');
const out = arg('out', 'plans/map-variations/generated');
const version = Number(arg('version', 2));
const people = arg('people', 'akkad');
const profiles = arg('profiles', 'phone,desktop').split(',');
const worlds = arg('seeds', '1').split(',').filter(Boolean).map((s) => ({ name: `gen${version}-seed-${s}`, spec: { kind: 'generated', generatorVersion: version, seed: Number(s), params: { land: 30, continents: 0, climate: 'temperate', rainfall: 'normal' } } }));
if (flag('earth')) worlds.unshift({ name: 'earth', spec: null });
const PROFILE = {
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: arg('browser', 'msedge'), args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'] });
const times = [];
try {
  for (const w of worlds) {
    for (const prof of profiles) {
      const ctx = await browser.newContext(PROFILE[prof]);
      const start = { playerNationId: people, gameSpeed: 'normal', difficultyId: 'prince', scenario: { mode: 'peoples', size: 'standard', seed: 7, ...(w.spec ? { map: w.spec } : {}) }, exploredWorld: true };
      await ctx.addInitScript(([s, p]) => {
        window.__E2E_MAP_TEST__ = true; window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true;
        if (!sessionStorage.getItem('shot-init')) {
          sessionStorage.setItem('shot-init', '1');
          localStorage.clear();
          if (s) localStorage.setItem('terra-imperium-world', JSON.stringify(s));
          localStorage.setItem('terra-imperium-pending-start', JSON.stringify(p));
          localStorage.setItem('terra-imperium-meta-v1', JSON.stringify({ hasSeenOnboarding: true, unlockedAchievements: [] }));
          localStorage.setItem('terra-imperium-map-mode', 'flat'); localStorage.setItem('terra-imperium-minimap-open', '0');
        }
      }, [w.spec, start]);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const t0 = Date.now();
      await page.goto(`${url}/`, { timeout: 240000 });
      await page.waitForFunction(() => !!window.__game?.state?.turnNumber && !!window.__map2DTest, null, { timeout: 240000 });
      const up = Date.now() - t0;
      const later = page.locator('[data-testid="research-choice"] button[aria-label="Later"]');
      await later.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
      if (await later.isVisible().catch(() => false)) await later.dispatchEvent('click');
      // the close tiles render on demand: wait until none is missing
      const settle = async () => {
        await page.waitForTimeout(800);
        await page.waitForFunction(() => { const r = window.__glMap?.info?.().raster; return !r || !r.pending; }, null, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(700);
      };
      await settle();
      const tStart = Date.now() - t0;
      await page.screenshot({ path: path.join(out, `${w.name}-${prof}-start.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
      const t = await page.evaluate(() => window.__map2DTest.transform());
      const vp = PROFILE[prof].viewport;
      // zoom about the screen's centre by a factor (the map's own transform: x, y, k)
      const zoomTo = async (k) => {
        await page.evaluate(([kk, w2, h2]) => {
          const tr = window.__map2DTest.transform();
          const cx = (w2 / 2 - tr.x) / tr.k; const cy = (h2 / 2 - tr.y) / tr.k;
          window.__map2DTest.setTransform?.({ k: kk, x: w2 / 2 - cx * kk, y: h2 / 2 - cy * kk });
        }, [k, vp.width, vp.height]);
      };
      const hasSet = await page.evaluate(() => !!window.__map2DTest.setTransform);
      for (const [label, factor, wheel] of [['mid', 0.3, 4], ['world', 0, 14]]) {
        if (hasSet && factor) await zoomTo(t.k * factor);
        else if (!factor && await page.evaluate(() => !!window.__map2DTest.worldView)) { await page.evaluate(() => window.__map2DTest.worldView()); await page.waitForTimeout(600); }
        else { await page.mouse.move(vp.width / 2, vp.height / 2); for (let k = 0; k < wheel; k++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(120); } }
        await settle();
        await page.screenshot({ path: path.join(out, `${w.name}-${prof}-${label}.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
      }
      times.push(`${w.name} ${prof}: game up ${up} ms, start view drawn ${tStart} ms, k ${t.k.toFixed(1)}${errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
times.forEach((l) => console.log(l));
