// scripts/art/city-shots.mjs
// Phone-sized (844x390) screenshots of a real city in the battle sandbox, centred on its town
// hall (the keep), for the art acceptance check. Start the dev server first:
//   npx vite --port 5199 --strictPort
//   node scripts/art/city-shots.mjs <outDir> <prefix> <style>[,<style>...] [query] [zoom]
// query: extra sandbox params (default `city=medium&age=bronze&fort=2`); zoom: the camera zoom of
// the close shot (default 2.2; the wide shot is the battle's opening view). Prints console errors.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [outDir = 'plans/art/shots/wave1', prefix = 'city', styles = 'europe', query = 'city=medium&age=bronze&fort=2', zoomArg = '2.2'] = process.argv.slice(2);
const BASE = process.env.URL || 'http://localhost:5199/terra-imperium/';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
mkdirSync(outDir, { recursive: true });
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const HIDE_TOWN = !!process.env.HIDE_TOWN; // debug: the town model hidden, the hall and the region's buildings stay
for (const style of styles.split(',')) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('403')) errors.push(`${style}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${style} pageerror: ${e.message}`));
  if (HIDE_TOWN) await page.addInitScript(() => { window.HIDE_TOWN = true; });
  if (process.env.DEBUG_GROUND) await page.addInitScript(() => { window.DEBUG_GROUND = true; });
  if (process.env.NO_SHADOW) await page.addInitScript(() => { window.NO_SHADOW = true; });
  await page.goto(`${BASE}?battleSandbox&${query}&style=${style}&autostart`);
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await page.waitForTimeout(6000);
  // pause (the sandbox may wait for deployment first) and hide the pause menu
  if (!(await page.locator('[data-testid="battle-pause"][aria-label="Pause"]').count())) { await page.getByTestId('battle-pause').click(); await page.waitForTimeout(1500); }
  await page.locator('[data-testid="battle-pause"][aria-label="Pause"]').click().catch(() => {});
  await page.getByTestId('battle-pause-orders').click({ timeout: 3000 }).catch(() => {});
  await page.evaluate((z) => {
    // the pause chip and the city panel sit over the town: hide them for the picture
    document.querySelectorAll('[data-testid="battle-paused-pill"]').forEach((d) => { d.style.visibility = 'hidden'; });
    [...document.querySelectorAll('div')].filter((d) => /^Defender housing/i.test(d.innerText || '')).slice(-1).forEach((d) => { (d.closest('[class*="absolute"]') || d).style.visibility = 'hidden'; });
    const r = window.__battleRenderer; const k = r.map.keep;
    r.camera.zoom = Number(z); r.camera.updateProjectionMatrix();
    const hall = r.setup.structures[0]; // the town hall (it may stand off the map's keep tile)
    r.centerOn(hall ? hall.x / 256 : k.x + 0.5, hall ? hall.y / 256 : k.y + 0.5); r.updateCamera();
    if (window.HIDE_TOWN && r.cityLayer.town) r.cityLayer.town.visible = false;
    if (window.NO_SHADOW) r.sun.castShadow = false;
    if (window.DEBUG_GROUND && r.cityLayer.town) r.cityLayer.town.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach((m) => { if (m.name === 'Ground') m.color.set('#ff0000'); }); });
  }, zoomArg);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(outDir, `${prefix}-${style}-844x390.png`) });
  console.log(`${prefix}-${style}`, await page.evaluate(() => { const s = window.__battleRenderer.setup.structures[0]; return JSON.stringify({ radius: s.radius, w: s.w, hall: s.hall, lift: s.hallLift, underHall: window.__battleRenderer.setup.structures.filter((x) => x.underHall).length }); }));
  if (process.env.EVAL) console.log('eval', await page.evaluate(process.env.EVAL));
  await page.close();
}
console.log(JSON.stringify({ errors: errors.slice(0, 20) }, null, 2));
await browser.close();
