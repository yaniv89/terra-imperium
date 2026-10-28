// .claude/skills/battle-lab/feedback-cost.mjs
// The cost of the per-squad overlays alone (drawSquads: figures, discs, bars; the screen's squad
// flags), timed in a loop on one frozen frame so SwiftShader's slow frames don't drown it. Opens
// `?battleSandbox&bench=N&autostart`, lets the armies meet, pauses, then at each zoom times
// drawSquads and updateSquadBadges REPS times. Compare two dev servers (base and change):
//   URL=http://localhost:5198/terra-imperium/ node .claude/skills/battle-lab/feedback-cost.mjs [--bench 300]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const bench = Number(opt('bench', 300)); const reps = Number(opt('reps', 60));
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&bench=${bench}&autostart`;
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
await page.getByTestId('battle-pause').click();
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(Number(process.env.WAIT || 25000));
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(1000);
for (const zoom of [1, 2.2, 0.45]) {
  const res = await page.evaluate(async ({ zoom, reps }) => {
    const r = window.__battleRenderer; const cur = window.__battleView();
    r.camera.zoom = zoom; r.camera.updateProjectionMatrix(); r.updateCamera?.();
    const ui = { selected: new Set(cur.squads.filter((q) => q.side === 0).slice(0, 20).map((q) => q.idx)) };
    const mod = await import('/terra-imperium/src/components/battle/squadBadges.js');
    const cv = document.querySelector('[data-testid="battle-squad-flags"]');
    const t = (f) => { const a = []; for (let i = 0; i < reps; i++) { const t0 = performance.now(); f(); a.push(performance.now() - t0); } a.sort((x, y) => x - y); return +a[Math.floor(a.length / 2)].toFixed(3); };
    const hurt = cur.squads.filter((q) => q.alive && q.strength < q.startStrength).length;
    return {
      zoom, squads: cur.squads.length, hurt,
      drawSquadsMs: t(() => r.drawSquads(cur, cur, 0.5, ui)),
      flagsMs: t(() => mod.updateSquadBadges(cv, r, mod.badgesFor(cur, cur, 0.5, { zoom, playerSide: 0, map: r.map, selected: ui.selected })))
    };
  }, { zoom, reps });
  console.log(JSON.stringify(res));
}
await browser.close();
