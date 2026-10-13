// plans/art-pilot/md09-machine-scale/shots.mjs
// Machines beside infantry in the battle sandbox (MD09, MD10): one phone screenshot per age and
// zoom, centred between a machine squad and the nearest infantry squad of the player's army.
// Dev server first:  npx vite --port 5202 --strictPort
//   CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe" node plans/art-pilot/md09-machine-scale/shots.mjs <outDir> <prefix>
// CASES="bronze:siege:siege,modern:cavalry:cavalry" (age:attacker preset:machine class), ZOOMS="z1:1,z3:3"
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'shot';
mkdirSync(outDir, { recursive: true });
const base = process.env.URL || 'http://localhost:5202/terra-imperium/?battleSandbox&terrain=plains&noeco';
const cases = (process.env.CASES || 'bronze:siege:siege,classical:siege:siege,kingdoms:siege:siege,gunpowder:siege:siege,modern:siege:siege,modern:balanced:cavalry')
  .split(',').map((s) => { const [age, attacker, cls] = s.split(':'); return { age, attacker, cls }; });
const zooms = (process.env.ZOOMS || 'z1:1,z3:3').split(',').map((s) => { const [name, z] = s.split(':'); return { name, z: Number(z) }; });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: (process.env.GL === 'gpu' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']) });
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // The dev server compiles the sim's modules on first use; on a busy machine that can take longer
  // than the battle's 25 second watchdog, which then shows the failure panel. Open again (the
  // modules are compiled by then) until the army is on the field.
  let open = false;
  for (let attempt = 1; attempt <= 5 && !open; attempt++) {
    try {
      await page.goto(`${base}&age=${c.age}&attacker=${c.attacker}${process.env.EXTRA || ''}`, { timeout: 180000 });
      await page.getByRole('button', { name: 'Fight' }).click({ timeout: 120000 });
      await page.waitForFunction(() => (window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0) || document.body.innerText.includes('could not start'), null, { timeout: 120000 });
      open = await page.evaluate(() => !!window.__battleRenderer && window.__battleRenderer.soldierLayers.size > 0 && !document.body.innerText.includes('could not start'));
    } catch (e) { errors.push(`attempt ${attempt}: ${String(e.message).split('\n')[0]}`); }
    if (!open) console.log(`(${c.age} ${c.attacker}: attempt ${attempt} did not open the battle, opening it again)`);
  }
  if (!open) { console.log(`GAVE UP ${c.age} ${c.attacker}`); await ctx.close(); continue; }
  await page.waitForTimeout(Number(process.env.WAIT || 6000)); // the models download and bake
  // the deployment hint covers the army: hide it for the picture
  await page.evaluate(() => { const h = [...document.querySelectorAll('h1,h2,h3,div,p')].find((e) => e.childElementCount === 0 && e.textContent.trim() === 'Deploy your army'); if (h?.parentElement) h.parentElement.style.display = 'none'; });
  for (const zm of zooms) {
    const info = await page.evaluate(({ z, cls }) => {
      const r = window.__battleRenderer;
      r.camera.zoom = Math.min(r.maxZoom || 3, z); r.camera.updateProjectionMatrix();
      const own = (window.__battleView?.()?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField);
      const machines = own.filter((q) => q.classId === cls); const foot = own.filter((q) => q.classId === 'infantry');
      let best = null;
      machines.forEach((m) => foot.forEach((f) => { const d = Math.hypot(m.x - f.x, m.y - f.y); if (!best || d < best.d) best = { d, m, f }; }));
      if (best) r.centerOn((best.m.x + best.f.x) / 2 / 256, (best.m.y + best.f.y) / 2 / 256);
      r.updateCamera();
      return { zoom: r.camera.zoom, px: r.soldierPx(), gap: best ? best.d / 256 : null, squads: own.map((q) => q.classId).join(',') };
    }, { z: zm.z, cls: c.cls });
    await page.waitForTimeout(1500);
    const file = `${outDir}/${prefix}-${c.age}-${c.cls}-${zm.name}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 82, timeout: 180000 });
    // SwiftShader can stall the page long enough for the battle's 25 second watchdog to give up:
    // such a picture shows the failure panel, not the army. Say so, so it gets retaken.
    const failed = await page.evaluate(() => document.body.innerText.includes('could not start'));
    console.log(`${failed ? 'RETAKE (the battle watchdog fired) ' : ''}${file} zoom=${info.zoom.toFixed(2)} soldierPx=${info.px.toFixed(1)} gap=${info.gap?.toFixed(1)} tiles [${info.squads}]`);
  }
  if (errors.length) console.log(`errors: ${errors.slice(0, 5).join(' | ')}`);
  await ctx.close();
}
await browser.close();
