// scripts/art/unit-shots.mjs
// Screenshots of the battle unit models in the game, for the art acceptance check (plans/
// ART-MODELS-PLAN.md section 11.4). Start the dev server first: npx vite --port 5199 --strictPort
//   node scripts/art/unit-shots.mjs sandbox <outDir> [age] [query]   the battle sandbox at 844x390
//        (default query `bench=20&autostart`: every class of the age on the field): one close shot
//        per unit class (and a wide one), plus each layer's triangle count, so a GLB model (its own
//        count) is told apart from the procedural body. Query '' opens the ordinary sandbox battle.
//   node scripts/art/unit-shots.mjs lineup <outDir> <age-class>...  every model through the real
//        resolver, loader and soldier shader, two team colours, standing and walking (vertex rig)
// Uses the DEV-only hook window.__battleRenderer (TacticalBattleScreen.jsx). CHROME=<path> picks the
// browser (default: Chrome, then Playwright's own Chromium).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [mode = 'sandbox', outDir = 'plans/art/shots/units', ...rest] = process.argv.slice(2);
const BASE = process.env.URL || 'http://localhost:5199/terra-imperium/';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
mkdirSync(outDir, { recursive: true });
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = []; const unitLog = [];
page.on('console', (m) => { const t = m.text(); if (t.includes('[units]')) unitLog.push(t); if (m.type() === 'error') errors.push(t); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const report = { mode, viewport: [W, H], shots: [], layers: null, unitLog, errors };

if (mode === 'sandbox') {
  const age = rest[0] || 'bronze'; const extra = rest[1] || 'bench=20&autostart';
  await page.goto(`${BASE}?battleSandbox&age=${age}${extra ? `&${extra}` : ''}`);
  if (!extra.includes('autostart')) await page.getByRole('button', { name: 'Fight' }).click();
  await page.getByTestId('battle-pause').waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);
  const shoot = async (name) => { const p = join(outDir, `${name}.png`); await page.screenshot({ path: p }); report.shots.push(p); };
  await shoot(`sandbox-${age}-wide`);
  // Start the battle if it waits for deployment, then pause it (and hide the pause menu) so every
  // close shot shows the same moment.
  if (!(await page.locator('[data-testid="battle-pause"][aria-label="Pause"]').count())) { await page.getByTestId('battle-pause').click(); await page.waitForTimeout(2000); }
  await page.locator('[data-testid="battle-pause"][aria-label="Pause"]').click();
  await page.getByTestId('battle-pause-orders').click({ timeout: 3000 }).catch(() => {});
  // Close shots show the full model: SwiftShader is slow, so the adaptive detail would otherwise
  // drop every figure to the runtime's reduced levels (soldierLod.js). LOD=1 keeps it adaptive.
  if (!process.env.LOD) await page.evaluate(() => { const r = window.__battleRenderer; r.figureBudget = 1e12; r.detail.bias = r.detail.ceiling = 3; r.detail.holdUntil = 1e9; });
  report.setupUnits = await page.evaluate(() => window.__battleRenderer.setup.sides.map((s) => [...(s.units || []), ...(s.reinforcements || [])].map((u) => u.classId).join(',')));
  report.squads = await page.evaluate(() => window.__battleRenderer.lastView.squads.map((s) => `${s.side}:${s.classId}${s.onField ? '' : ' off-field'}${s.inside >= 0 ? ' inside' : ''}`));
  // Zoomed out every squad is drawn: frame each soldier layer (one class, or the generals) on the
  // figures it drew, zoom in, then frame again on what is drawn close up.
  const frame = (k) => page.evaluate((key) => {
    const r = window.__battleRenderer; const l = r.soldierLayers.get(key);
    if (!l?.count) return false; const a = l.matrix.array; const n = key.endsWith(':general') ? 1 : Math.min(l.count, 6);
    let sx = 0; let sz = 0; for (let i = 0; i < n; i++) { sx += a[i * 16 + 12]; sz += a[i * 16 + 14]; }
    r.centerOn(sx / n, sz / n); r.updateCamera(); return true;
  }, k);
  const zoom = (f) => page.evaluate((z) => { const r = window.__battleRenderer; r.zoomBy(z); r.updateCamera(); }, f);
  await zoom(0.001); await page.waitForTimeout(800);
  const keys = await page.evaluate(() => [...window.__battleRenderer.soldierLayers.keys()]);
  for (const key of keys) {
    await zoom(0.001); await page.waitForTimeout(700);
    if (!(await frame(key))) continue;
    await zoom(1000); await page.waitForTimeout(700);
    await frame(key); await page.waitForTimeout(700);
    await shoot(`sandbox-${key.replace(/[:~]/g, '-')}`);
  }
  report.layers = await page.evaluate(() => [...window.__battleRenderer.soldierLayers.entries()].map(([key, l]) => ({ key, triangles: l.tris })));
} else {
  const ids = rest.length ? rest : ['bronze-infantry'];
  await page.route(BASE, (r) => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#dce7e1"></body>' }));
  await page.goto(BASE);
  report.layers = await page.evaluate(async ({ ids, base }) => {
    const T = await import(`${base}node_modules/.vite/deps/three.js`);
    const U = await import(`${base}src/battle/render/unitModels.js`);
    const L = await import(`${base}src/battle/render/gltfUnitLoader.js`);
    const F = await import(`${base}src/battle/render/soldierFactory.js`);
    window.units = { T, F, models: [] }; const rows = [];
    for (const id of ids) {
      const [age, ...cls] = id.split('-'); const classId = cls.join('-');
      const m = classId === 'general' ? U.findGeneralModel(age) : U.findUnitModel(age, classId);
      if (!m || !m.url || m.recipe) { rows.push({ id, error: 'no enabled GLB' }); continue; }
      const out = await L.loadUnitModel(m.url, { quadruped: classId === 'cavalry' || classId === 'general', ...m.options, height: 1 });
      const geo = out.geometry; const team = Array.from(geo.attributes.aTeam.array).filter((v) => v === 1).length;
      const skin = Array.from(geo.attributes.aPart.array).filter((v) => v === 1).length;
      window.units.models.push({ id, geo, width: geo.boundingBox.max.x - geo.boundingBox.min.x });
      rows.push({ id, triangles: out.stats.triangles, namedLimbs: out.stats.namedLimbs, limbs: out.stats.limbs, warnings: out.stats.warnings, teamVertices: team, skinVertices: skin });
    }
    return rows;
  }, { ids, base: BASE });
  for (const moving of [false, true]) {
    await page.evaluate(({ W, H, moving }) => {
      const { T, F, models } = window.units;
      document.body.replaceChildren(); window.r3?.dispose();
      const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); window.r3 = r;
      r.setSize(W, H); r.setClearColor('#dce7e1'); document.body.appendChild(r.domElement);
      const scene = new T.Scene();
      scene.add(new T.HemisphereLight('#E3EEF8', '#5A503F', 2.2));
      const sun = new T.DirectionalLight('#FFE7C2', 2.4); sun.position.set(3, 8, 5); scene.add(sun);
      const gap = 0.35; const widths = models.map((m) => Math.max(0.6, m.width) * 2 + gap);
      const total = widths.reduce((s, w) => s + w, 0); let x = -total / 2;
      const span = Math.max(1.6, total / 2 + 0.2);
      const camera = new T.OrthographicCamera(-span, span, span * H / W, -span * H / W, 0.01, 100);
      camera.position.set(2.2, 3.2, 8); camera.lookAt(0, 0.55, 0);
      models.forEach((m, k) => {
        const geo = F.packForGPU(m.geo.clone());
        geo.setAttribute('aAnim', new T.InstancedBufferAttribute(new Float32Array([0, moving ? 1 : 0, 0, 0.5, moving ? 1 : 0, 0]), 3));
        geo.setAttribute('aVariant', new T.InstancedBufferAttribute(new Float32Array([1, 0, 0, 3, 1, 0]), 4));
        const mesh = new T.InstancedMesh(geo, F.createSoldierMaterial(), 2); scene.add(mesh);
        const w = Math.max(0.6, m.width);
        for (let i = 0; i < 2; i++) { mesh.setMatrixAt(i, new T.Matrix4().makeTranslation(x + w / 2 + i * w, 0, 0)); mesh.setColorAt(i, new T.Color(i ? '#327aff' : '#e34b42')); }
        x += widths[k];
        mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      });
      F.RIG_TIME.value = 1.2; r.render(scene, camera);
    }, { W, H, moving });
    const p = join(outDir, `lineup-${moving ? 'walking' : 'standing'}.png`);
    await page.screenshot({ path: p }); report.shots.push(p);
  }
}
writeFileSync(join(outDir, `${mode}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ layers: report.layers, unitLog, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
