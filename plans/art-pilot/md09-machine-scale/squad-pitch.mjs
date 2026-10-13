// plans/art-pilot/md09-machine-scale/squad-pitch.mjs
// Where the sandbox deploys the player's squads (tiles), and what each one draws: the distance to
// the nearest other squad is the ground a squad's drawn block has before it runs into a neighbour.
//   CHROMIUM=... node plans/art-pilot/md09-machine-scale/squad-pitch.mjs [age] [attacker preset]
import { chromium } from '@playwright/test';

const age = process.argv[2] || 'classical'; const attacker = process.argv[3] || 'siege';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await page.goto(`http://localhost:5202/terra-imperium/?battleSandbox&terrain=plains&noeco&age=${age}&attacker=${attacker}`);
await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 90000 });
await page.waitForTimeout(5000);
const rows = await page.evaluate(() => {
  const r = window.__battleRenderer;
  const own = (window.__battleView?.()?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField);
  return own.map((q) => {
    const near = Math.min(...own.filter((o) => o !== q).map((o) => Math.hypot(o.x - q.x, o.y - q.y))) / 256;
    const info = r.squadInfo[q.idx]; const memo = r.soldierMemo.get(q.idx);
    return `${q.classId.padEnd(9)} x=${(q.x / 256).toFixed(1)} y=${(q.y / 256).toFixed(1)} nearest=${near.toFixed(2)} drawn=${memo?.n} cols=${memo?.cols} spacing=${info?.spacing?.toFixed(2)} rowGap=${info?.rowGap?.toFixed(2)} machine=${!!info?.machine}`;
  });
});
console.log(`${age} ${attacker}\n${rows.join('\n')}`);
await browser.close();
