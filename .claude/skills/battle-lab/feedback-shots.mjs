// .claude/skills/battle-lab/feedback-shots.mjs
// Combat feedback check (plans/lanes/battle-feedback-REPORT.md): for each scenario and screen size,
// opens the sandbox, starts the battle at 3x, selects the whole army, attack-moves it on the enemy,
// waits for the fight, pauses on it and saves a small jpg. Dev server first:
//   npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/feedback-shots.mjs <outDir> [prefix]
// SCENARIOS="field-bronze:fort=0&age=bronze,city-modern:city=medium&fort=2&age=modern"
// SIZES="phone:844x390@2,desktop:1600x900@1"  WAIT=14000 (ms of fighting before the shot)  ZOOM=2 (a closer camera)
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'shot';
mkdirSync(outDir, { recursive: true });
const base = process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox';
const scenarios = (process.env.SCENARIOS || 'field-bronze:fort=0&age=bronze,field-modern:fort=0&age=modern,city-bronze:city=medium&fort=2&age=bronze,city-modern:city=medium&fort=2&age=modern')
  .split(',').map((s) => { const i = s.indexOf(':'); return { name: s.slice(0, i), q: s.slice(i + 1) }; });
const sizes = (process.env.SIZES || 'phone:844x390@2,desktop:1600x900@1').split(',').map((s) => {
  const [name, rest] = s.split(':'); const [wh, dpr] = rest.split('@'); const [w, h] = wh.split('x').map(Number);
  return { name, w, h, dpr: Number(dpr || 1) };
});
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
for (const sc of scenarios) {
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr, hasTouch: size.name !== 'desktop' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(`${base}&${sc.q}`);
    await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
    await page.waitForFunction(() => window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    const tap = (id) => page.evaluate((t) => document.querySelector(`[data-testid="${t}"]`)?.click(), id);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Skip')?.click()); // the first-battle tips
    await tap('battle-pause'); // deployment -> battle
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
    await page.waitForTimeout(800);
    // The whole army at the enemy: their army's middle in a field, the keep in a city.
    await page.evaluate(() => {
      const v = window.__battleView(); const side = v.playerSide ?? 0;
      const own = v.squads.filter((q) => q.side === side && q.alive && q.onField && q.classId !== 'worker');
      const foe = v.squads.filter((q) => q.side !== side && q.alive && q.onField);
      const k = v.structures?.[0];
      const at = foe.length && !(k && k.alive) ? { x: foe.reduce((s, q) => s + q.x, 0) / foe.length, y: foe.reduce((s, q) => s + q.y, 0) / foe.length } : { x: k.x, y: k.y };
      window.__battleOrders([{ side, type: 'attackMove', squads: own.map((q) => q.idx), x: Math.round(at.x), y: Math.round(at.y) }]);
    });
    await tap('battle-select-all');
    await page.waitForTimeout(Number(process.env.WAIT || 14000));
    // Centre on the fight: the player's squad closest to a visible enemy (else the army's middle).
    await page.evaluate(() => {
      const r = window.__battleRenderer; const v = window.__battleView(); const side = v.playerSide ?? 0;
      const own = v.squads.filter((q) => q.side === side && q.alive && q.onField && !q.fled && q.classId !== 'worker');
      const foe = v.squads.filter((q) => q.side !== side && q.alive && q.onField && !q.fled && q.visible !== false);
      let best = null; let bd = Infinity;
      own.forEach((a) => foe.forEach((b) => { const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2; if (d < bd) { bd = d; best = [a, b]; } }));
      if (best) r.centerOn((best[0].x + best[1].x) / 512, (best[0].y + best[1].y) / 512);
      else if (own.length) r.centerOn(own.reduce((a, q) => a + q.x, 0) / own.length / 256, own.reduce((a, q) => a + q.y, 0) / own.length / 256);
    });
    if (process.env.ZOOM) await page.evaluate((z) => { const r = window.__battleRenderer; r.camera.zoom = z; r.camera.updateProjectionMatrix(); r.updateCamera(); }, Number(process.env.ZOOM));
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => { const r = window.__battleRenderer; return { fx: r.fx.length, splats: r.splats.length, zoom: +r.camera.zoom.toFixed(2) }; });
    const file = `${outDir}/${prefix}-${sc.name}-${size.name}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 62, timeout: 180000 });
    console.log(`${file} ${JSON.stringify(st)}${errors.length ? ` errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
    await ctx.close();
  }
}
await browser.close();
