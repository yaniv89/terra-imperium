// .claude/skills/battle-lab/flank-shot.mjs
// The flank mark (lane battle-skill-8): fights the sandbox battle at 3x at a phone size and saves a
// screenshot the moment a held flank or rear blow puts its ring on a squad (gold: yours, red: theirs).
//   node .claude/skills/battle-lab/flank-shot.mjs <out.png> [seconds]   # dev server first; URL=, W=, H=
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const out = process.argv[2] || 'flank.png';
const seconds = Number(process.argv[3] || 120);
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox';
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 844), height: Number(process.env.H || 390) }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click();
await page.getByTestId('battle-pause').waitFor({ timeout: 60000 });
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Skip' }).click({ timeout: 3000 }).catch(() => {}); // the first-battle tips hold the clock
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: Array.from({ length: 16 }, (_, i) => i), x: k.x - 4 * 256, y: k.y }]);
  // Count every flank ring the renderer is asked for.
  const add = r.addMarker.bind(r); window.__flanks = [];
  // Blows by arc (front, flank, rear) and how many of them were held flanks.
  window.__arcs = [0, 0, 0, 0];
  const pe = r.pushEvents.bind(r);
  r.pushEvents = (ev, v) => { ev.forEach((e) => { if (e.type === 'melee' || e.type === 'shot') { window.__arcs[e.arc] += 1; if (e.flank) window.__arcs[3] += 1; } }); return pe(ev, v); };
  r.addMarker = (x, z, color, size, life, mode) => { if (mode === 'burst' && (color === '#fbbf24' || color === '#ef4444')) window.__flanks.push({ x, z, color }); return add(x, z, color, size, life, mode); };
});
let found = null;
for (let s = 0; s < seconds * 4 && !found; s += 1) {
  await page.waitForTimeout(250);
  found = await page.evaluate(() => { const f = window.__flanks.at(-1); if (f) window.__battleRenderer.centerOn(f.x, f.z); return f ? { ...f, n: window.__flanks.length } : null; });
}
if (found) { await page.waitForTimeout(120); await page.screenshot({ path: out }); }
console.log('tick', await page.evaluate(() => window.__battleRenderer.lastView?.tick), 'arcs front/flank/rear/held', await page.evaluate(() => window.__arcs.join('/')));
await page.screenshot({ path: out.replace('.png', '-end.png') });
console.log(found ? `flank ring ${JSON.stringify(found)} -> ${out}` : 'no flank ring seen');
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
