// scripts/art/building-shots.mjs
// The culture skins of the battle buildings through the game's own kit loader (src/battle/art/
// kitLoader.js), for the art acceptance check: one 844x390 picture per group of themes, a column
// per theme (the shared Bronze buildings first, for comparison) with its barracks, tower and trade
// post from back to front, at their true relative sizes (team parts in red). Start the dev server first: npx vite --port 5199 --strictPort
//   node scripts/art/building-shots.mjs <outDir> <theme>[,<theme>...] [age]
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const [outDir = 'plans/art/shots/wave1', themes = 'europe', age = 'bronze'] = process.argv.slice(2);
const BASE = process.env.URL || 'http://localhost:5199/terra-imperium/';
const W = 844; const H = 390;
mkdirSync(outDir, { recursive: true });
const chrome = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(BASE, (r) => r.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#dce7e1"></body>' }));
await page.goto(BASE);
const list = themes.split(',');
const rows = await page.evaluate(async ({ list, base, age, W, H }) => {
  const T = await import(`${base}node_modules/.vite/deps/three.js`);
  const K = await import(`${base}src/battle/art/kitLoader.js`);
  const roles = ['barracks', 'tower', 'trade-post'];
  const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.setClearColor('#dce7e1');
  document.body.appendChild(r.domElement);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight('#E3EEF8', '#5A503F', 2.0));
  const sun = new T.DirectionalLight('#FFE7C2', 2.6); sun.position.set(3, 8, 5); scene.add(sun);
  const files = [['shared', `${base}src/assets/battle/rts/rts-${age}.glb`], ...list.map((t) => [t, `${base}src/assets/battle/rts/rts-${age}-${t}.glb`])];
  const out = [];
  for (let row = 0; row < files.length; row++) {
    const [name, url] = files[row];
    let kit = null;
    try { kit = await K.loadKit(url); } catch (e) { out.push({ name, error: e.message }); continue; }
    roles.forEach((role, col) => {
      const obj = K.kitObject(kit, role); if (!obj) return;
      const b = obj.lods[0]; const fit = 1;
      const mats = (Array.isArray(b.materials) ? b.materials : [b.materials]).map((m) => { const c = m.clone(); if (K.isTeamMaterial(m) && c.color) c.color.set('#d64541'); return c; });
      const mesh = new T.Mesh(b.geometry, mats.length === 1 ? mats[0] : mats);
      mesh.scale.setScalar(fit); mesh.position.set((row - (files.length - 1) / 2) * 2.1, 0, (col - 1) * 1.9);
      scene.add(mesh);
    });
    out.push({ name, objects: Object.keys(kit.objects).length });
  }
  const span = Math.max(2.3, files.length * 0.62);
  const cam = new T.OrthographicCamera(-span * W / H, span * W / H, span, -span, 0.1, 200);
  cam.position.set(6, 16, 18); cam.lookAt(0, 0.3, 0);
  r.render(scene, cam);
  return out;
}, { list, base: BASE, age, W, H });
const file = join(outDir, `rts-${age}-skins-${list.join('-')}.png`);
await page.screenshot({ path: file });
console.log(JSON.stringify({ file, rows, errors: errors.filter((e) => !e.includes('403')).slice(0, 10) }, null, 2));
await browser.close();
