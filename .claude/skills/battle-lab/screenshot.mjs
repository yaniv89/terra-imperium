// .claude/skills/battle-lab/screenshot.mjs
// Real-browser battle check: opens the battle sandbox on a running dev server, starts the battle,
// orders the player army to attack-move on the keep, fast-forwards, centres on the fighting and
// saves a screenshot. Prints renderer stats (blood fx, splats) and every console error/warning.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/screenshot.mjs [out.png] [seconds]
// Uses DEV-only hooks from TacticalBattleScreen.jsx: window.__battleRenderer, window.__battleOrders.
import { chromium } from '@playwright/test';

const out = process.argv[2] || 'battle.png';
const seconds = Number(process.argv[3] || 60);
// main serves under /terra-imperium/ (vite base); override with URL=... if that changes.
const url = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 900), height: Number(process.env.H || 600) } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click();
await page.getByTestId('battle-pause').waitFor({ timeout: 60000 });
await page.getByTestId('battle-pause').click();
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: Array.from({ length: 16 }, (_, i) => i), x: k.x - 4 * 256, y: k.y }]);
});
for (let s = 0; s < seconds; s += 5) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => { const r = window.__battleRenderer; return { blood: r.fx.filter((f) => f.kind === 'blood').length, fx: r.fx.length, splats: r.splats.length }; });
  console.log(`t+${s + 5}s ${JSON.stringify(st)}`);
}
// Aim the camera at the fighting (the latest blood splat) or, before any blood, at the middle of all
// soldiers drawn: never at the empty deployment area the army has already marched away from.
await page.evaluate(() => {
  const r = window.__battleRenderer; const sp = r.splats[r.splats.length - 1];
  if (sp) { r.centerOn(sp.x, sp.z); return; }
  let sx = 0; let sz = 0; let n = 0;
  r.soldierLayers.forEach((l) => { const a = l.matrix.array; for (let i = 0; i < l.count; i++) { sx += a[i * 16 + 12]; sz += a[i * 16 + 14]; n += 1; } });
  if (n) r.centerOn(sx / n, sz / n);
});
await page.waitForTimeout(400);
await page.screenshot({ path: out });
console.log(`saved ${out}`);
console.log(`console errors/warnings (${errors.length}):\n${errors.slice(0, 20).join('\n')}`);
await browser.close();
