// scripts/perf/river-cost.mjs
// What the map's river lines (src/components/map/gl/riverLayer.js) cost a frame: the same view drawn
// back to back with the lines on and off (__glMap.timeFrames, the GPU finished each time), in turns,
// medians of a few rounds. Against a dev server you start yourself (npx vite --port 5199) or any URL:
//   node scripts/perf/river-cost.mjs --url http://localhost:5199/ [--gpu] [--profiles desktop,phone]
//        [--views "nile:30.6,31.1,12|..."] (name:lat,lng,k) [--frames 20] [--rounds 5]
import { chromium } from '@playwright/test';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const flag = (name) => process.argv.includes(`--${name}`);
const URL = arg('url', 'http://localhost:5199/');
const PROFILES = arg('profiles', 'desktop,phone').split(',');
const FRAMES = Number(arg('frames', 20)); const ROUNDS = Number(arg('rounds', 5));
const VIEWS = arg('views', 'world:30,30,1|nile:30.6,31.1,3|mesopotamia:33,44.2,12|rhine:50.3,7.6,40|mississippi:38.6,-90.2,40').split('|').map((s) => {
  const [name, rest] = s.split(':'); const [lat, lng, k] = rest.split(',').map(Number);
  return { name, lat, lng, k };
});
const PROFILE = {
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  phone: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];

const args = flag('gpu') ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-webgl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true, args });
const rows = [];
for (const name of PROFILES) {
  const context = await browser.newContext(PROFILE[name]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true;
    try { localStorage.setItem('terra-imperium-map-mode', 'flat'); localStorage.setItem('terra-imperium-map-renderer', 'webgl'); localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ }
  });
  await page.goto(URL, { timeout: 240000 });
  await page.getByTestId('start-next').waitFor({ timeout: 120000 });
  await page.getByTestId('explored-world').dispatchEvent('click');
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await page.locator('[data-people]').first().dispatchEvent('click');
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  await page.waitForFunction(() => window.__map2DTest?.focus && window.__glMap?.timeFrames, null, { timeout: 120000 });
  const gpu = await page.evaluate(() => { const c = window.__glMap.renderer.getContext(); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; });
  for (const v of VIEWS) {
    await page.evaluate(({ lat, lng, k }) => window.__map2DTest.focus(lat, lng, k), v);
    await page.waitForTimeout(3000);
    const on = []; const off = [];
    for (let r = 0; r < ROUNDS; r++) {
      on.push(await page.evaluate((n) => window.__glMap.timeFrames(n, true), FRAMES));
      off.push(await page.evaluate((n) => window.__glMap.timeFrames(n, false), FRAMES));
    }
    const vertices = await page.evaluate(() => window.__glMap.info().rivers);
    const row = { profile: name, view: v.name, k: v.k, on: median(on), off: median(off), vertices };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  console.log(`${name}: ${gpu}`);
  await context.close();
}
await browser.close();
console.log('\n| profile | view | k | frame ms, lines on | lines off | lines cost ms | river vertices |');
console.log('|---|---|---|---|---|---|---|');
rows.forEach((r) => console.log(`| ${r.profile} | ${r.view} | ${r.k} | ${r.on.toFixed(2)} | ${r.off.toFixed(2)} | ${(r.on - r.off).toFixed(2)} | ${r.vertices} |`));
