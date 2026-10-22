// scripts/ui/canopy-perf.mjs
// A/B of the canopy fade in ONE page, alternating so machine noise cancels: frame ms (median and p95
// from the renderer's own frame times) with the holes on (the fade loop runs) and off (count 0).
//   node scripts/ui/canopy-perf.mjs [--url http://localhost:5231/terra-imperium/] [--rounds 4] [--zoom 0.45]
import { launchBrowser } from '../lib/browserLaunch.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const rounds = Number(opt('rounds', 4)); const zoom = Number(opt('zoom', 1));
const exe = process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await launchBrowser({ executablePath: exe, headless: true, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
await page.goto(`${opt('url', 'http://localhost:5231/terra-imperium/')}?battleSandbox&autostart&terrain=forest&age=bronze&bench=300`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.evaluate((z) => { const r = window.__battleRenderer; if (z !== 1) r.zoomBy(z); }, zoom);
await page.waitForTimeout(8000);
const sample = async (holes) => {
  await page.evaluate((on) => {
    const r = window.__battleRenderer; const f = r.canopyFade;
    // on: the worst case, 16 holes over the middle of the screen every frame (the real list is the selected and fighting squads)
    f.set = on ? () => { for (let i = 0; i < 16; i++) f.holes.value[i].set(r.target.x + (i % 4) * 3 - 5, r.target.z + Math.floor(i / 4) * 3 - 5, 2.6); f.count.value = 16; } : () => { f.count.value = 0; };
    r.frameTimes.length = 0;
  }, holes);
  await page.waitForTimeout(5000);
  return page.evaluate(() => { const t = [...window.__battleRenderer.frameTimes].sort((a, b) => a - b); return { n: t.length, p50: t[Math.floor(t.length / 2)], p95: t[Math.floor(t.length * 0.95)], holes: window.__battleRenderer.canopyFade.count.value }; });
};
const out = { on: [], off: [] };
for (let i = 0; i < rounds; i++) { out.off.push(await sample(false)); out.on.push(await sample(true)); }
const med = (a, k) => a.map((x) => x[k]).sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const k of ['off', 'on']) console.log(k, JSON.stringify(out[k].map((x) => [Math.round(x.p50 * 10) / 10, Math.round(x.p95 * 10) / 10, x.holes])), 'median p50', med(out[k], 'p50').toFixed(2), 'p95', med(out[k], 'p95').toFixed(2));
await browser.close();
