// .claude/skills/battle-lab/town-shot.mjs
// battle-art-8 evidence: a town assault at a phone size (844x390 by default). The army attack-moves
// on the keep at 3x; after `seconds` the camera stays where the game put it (the default follow),
// then centres on the fight. Saves <prefix>-default.png (the camera as left), <prefix>-fight.png
// (centred on the latest blood) and <prefix>-near.png (one zoom step in), and prints the banner's
// height in px, the 3D bars drawn and soldiers standing on building tiles.
//   node .claude/skills/battle-lab/town-shot.mjs <outDir> [prefix] [seconds]   (dev server on 5199)
//   QUERY='&city=medium&fort=0&age=bronze' W=844 H=390
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const dir = process.argv[2] || '.'; const prefix = process.argv[3] || 'town'; const seconds = Number(process.argv[4] || 40);
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/?battleSandbox'}${process.env.QUERY ?? '&city=medium&fort=0&age=bronze'}`;
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 844), height: Number(process.env.H || 390) }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await page.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.getByRole('button', { name: 'Fight' }).click();
await page.getByTestId('battle-pause').waitFor({ timeout: 60000 });
await page.getByTestId('battle-pause').click();
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '3×'); b?.click(); });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: r.setup.squads?.filter?.((q) => q.side === 0).map((q) => q.idx) ?? Array.from({ length: 16 }, (_, i) => i), x: k.x, y: k.y }]);
});
await page.waitForTimeout(seconds * 1000);
const stats = () => page.evaluate(() => {
  const r = window.__battleRenderer; const { w, tiles } = r.map; let onBuilding = 0; let figs = 0;
  r.soldierLayers.forEach((l) => { const a = l.matrix.array; for (let i = 0; i < l.count; i++) { figs += 1; if (tiles[Math.floor(a[i * 16 + 14]) * w + Math.floor(a[i * 16 + 12])] === 7) onBuilding += 1; } });
  return { perf: window.__battlePerf?.meter, zoom: +r.camera.zoom.toFixed(2), bars: r.barBg.count, banners: r.bannerPoles.count, bannerPx: r.bannerPxNow ?? null, figs, onBuilding, corpses: r.corpses?.length ?? null };
});
await page.screenshot({ path: `${dir}/${prefix}-default.png` });
console.log('default', JSON.stringify(await stats()));
await page.evaluate(() => { const r = window.__battleRenderer; const sp = r.splats[r.splats.length - 1]; if (sp) r.centerOn(sp.x, sp.z); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/${prefix}-fight.png` });
console.log('fight', JSON.stringify(await stats()));
await page.evaluate(() => { const r = window.__battleRenderer; r.zoomBy ? r.zoomBy(1.5) : (r.camera.zoom *= 1.5, r.camera.updateProjectionMatrix()); });
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/${prefix}-near.png` });
console.log('near', JSON.stringify(await stats()));
// the streets: your squad nearest the keep, the default zoom, after TOWN_WAIT more seconds
await page.evaluate(() => { const r = window.__battleRenderer; r.zoomBy(1 / r.camera.zoom); });
await page.waitForTimeout(Number(process.env.TOWN_WAIT || 20) * 1000);
await page.evaluate(() => { // on your squad nearest the keep (in the streets once the army is in)
  const r = window.__battleRenderer; const k = r.setup.structures[0]; const v = window.__battleView?.();
  const own = (v?.squads || []).filter((q) => q.side === 0 && q.alive && q.onField && !q.fled && q.classId !== 'worker').sort((a, b) => Math.hypot(a.x - k.x, a.y - k.y) - Math.hypot(b.x - k.x, b.y - k.y));
  if (own[0]) r.centerOn(own[0].x / 256, own[0].y / 256); else r.centerOn(k.x / 256 - 5, k.y / 256);
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}/${prefix}-streets.png` });
console.log('streets', JSON.stringify(await stats()));
console.log(`errors (${errors.length}): ${errors.slice(0, 8).join(' | ')}`);
await browser.close();
