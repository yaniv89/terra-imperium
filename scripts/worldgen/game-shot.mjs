// scripts/worldgen/game-shot.mjs
// A new game on a generated world in a real browser (the boot into the world, the painted base
// picture, the peoples), screenshotted at 844x390 and desktop size:
//   node scripts/worldgen/game-shot.mjs --url http://localhost:5199/terra-imperium --seed 3 --out plans/map-variations/generated
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : dflt; };
const url = arg('url', 'http://localhost:5199/terra-imperium');
const seed = Number(arg('seed', 3));
const out = arg('out', 'plans/map-variations/generated');
const spec = { kind: 'generated', generatorVersion: 1, seed, params: { land: 30, continents: 0, climate: 'temperate', rainfall: 'normal' } };
const start = { playerNationId: 'akkad', gameSpeed: 'normal', difficultyId: 'prince', scenario: { mode: 'peoples', size: 'standard', seed: 7, map: spec }, exploredWorld: true };

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: arg('browser', 'msedge') });
try {
  for (const [name, viewport, dpr] of [['844x390', { width: 844, height: 390 }, 2], ['desktop', { width: 1440, height: 860 }, 1]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
    await ctx.addInitScript(([s, p]) => {
      if (!sessionStorage.getItem('shot-init')) {
        sessionStorage.setItem('shot-init', '1');
        localStorage.clear();
        localStorage.setItem('terra-imperium-world', JSON.stringify(s));
        localStorage.setItem('terra-imperium-pending-start', JSON.stringify(p));
        localStorage.setItem('terra-imperium-meta-v1', JSON.stringify({ hasSeenOnboarding: true, unlockedAchievements: [] }));
      }
    }, [spec, start]);
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`${url}/`);
    await page.waitForFunction(() => !!window.__game?.state?.scenario?.map, null, { timeout: 180000 });
    console.log(`${name}: game up in ${Date.now() - t0} ms, map ${await page.evaluate(() => JSON.stringify(window.__game.state.scenario.map))}`);
    await page.waitForTimeout(4000);
    for (let k = 0; k < 3; k++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    await page.screenshot({ path: path.join(out, `game-seed-${seed}-${name}.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
    // Zoomed out: the whole painted world.
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let k = 0; k < 8; k++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(200); }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `game-seed-${seed}-${name}-world.jpg`), type: 'jpeg', quality: 85, timeout: 120000 });
    await ctx.close();
  }
} finally {
  await browser.close();
}
