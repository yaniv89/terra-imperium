// scripts/ui/texture-evict-shots.mjs
// H-05 (audits/mobile-campaign-2026-10-20): towns, wonders and farms on the map turned solid black
// after a long session. This forces what a long session does, in minutes: the close view over the
// capital (towns and a farm), then the model files dropped from memory (assetMemory.js LRU, as when
// a battle or other towns load past the budget), then a lost and restored WebGL context. After each
// step it screenshots and counts the close view's textures that can no longer be drawn (a disposed
// file's closed bitmap: width 0) and the share of near-black pixels round the capital.
//   node scripts/ui/texture-evict-shots.mjs [--url http://localhost:5245/terra-imperium/] [--tag before|after]
//        [--touch]   a phone (844x390, touch: textures capped at 1024 and their CPU copies released)
// Needs a running dev server. Shots go to audits/fix-h05/ (not committed).
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5245/terra-imperium/');
const TAG = arg('--tag', 'after');
const TOUCH = process.argv.includes('--touch');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'audits/fix-h05'));
fs.mkdirSync(OUT, { recursive: true });
const W = TOUCH ? 844 : 1118; const H = TOUCH ? 390 : 646;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, people) => {
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await page.fill('input[aria-label="Search peoples"]', people);
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
  if (await later.first().isVisible().catch(() => false)) await click(later.first());
};

// A farm and a mine on the capital's second ring (owned), so the close view draws improvement models.
const SETUP = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const T = m.getTiles();
  const ring1 = T.neighbors[cap.tile];
  const ring2 = [...new Set(ring1.flatMap((n) => T.neighbors[n]))].filter((t) => t !== cap.tile && !ring1.includes(t) && T.land[t] === 1);
  const farm = ring2[0]; const mine = ring2[Math.floor(ring2.length / 2)];
  const tileState = { ...(s.world.tileState || {}), [farm]: { ...(s.world.tileState?.[farm] || {}), improvement: 'farm' }, [mine]: { ...(s.world.tileState?.[mine] || {}), improvement: 'mine' } };
  const tileOwner = { ...s.world.tileOwner, [farm]: capId, [mine]: capId };
  const p = T.latLonOf(cap.tile);
  window.__evict = { lat: p.lat, lng: p.lon };
  return { ...s, world: { ...s.world, tileState, tileOwner } };
`;
const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

// The close view's drawn textures that cannot be drawn: no image, or a closed bitmap (width 0).
const textureCheck = (page) => page.evaluate(async () => {
  const cv = window.__closeView;
  const root = [...cv.towns.values()][0]?.parent;
  const seen = new Set(); let drawn = 0; let broken = 0; let minPx = Infinity; const names = new Set();
  root?.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let up = o; while (up && up.visible) up = up.parent; if (up) return; // hidden by a parent
    if (o.isInstancedMesh && !o.count) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
      Object.values(mat || {}).forEach((tex) => {
        if (!tex?.isTexture || seen.has(tex)) return;
        seen.add(tex); drawn += 1;
        const img = tex.image; const w = img?.width || img?.naturalWidth || 0;
        if (!img || !w) { broken += 1; names.add(mat.name || '?'); } else minPx = Math.min(minPx, w);
      });
    });
  });
  const { gltfMemory } = await import('/terra-imperium/src/battle/render/gltfUnitLoader.js');
  return { drawn, broken, minPx: Number.isFinite(minPx) ? minPx : null, brokenMaterials: [...names].slice(0, 8), memory: gltfMemory() };
});

// Share of near-black pixels in the middle of the screen (the capital and its works).
const blackShare = (file) => {
  const png = PNG.sync.read(fs.readFileSync(file));
  let n = 0; let dark = 0;
  const x0 = Math.round(png.width * 0.2); const x1 = Math.round(png.width * 0.8);
  const y0 = Math.round(png.height * 0.15); const y1 = Math.round(png.height * 0.85);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const o = (y * png.width + x) * 4;
    const l = 0.2126 * png.data[o] + 0.7152 * png.data[o + 1] + 0.0722 * png.data[o + 2];
    n += 1; if (l < 12) dark += 1;
  }
  return Math.round((dark / n) * 1000) / 10;
};

const browser = await launchBrowser({ headless: true, executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, isMobile: TOUCH, hasTouch: TOUCH, deviceScaleFactor: 1 });
  await context.addInitScript(() => { window.__E2E_MAP_TEST__ = true; localStorage.setItem('terra-imperium-map-mode', 'flat'); });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
  page.on('console', (msg) => { if (msg.type() === 'error' || /WebGL|GL_INVALID|texImage/i.test(msg.text())) console.log('console', msg.type(), msg.text().slice(0, 200)); });
  await startGame(page, arg('--people', 'Kemet'));
  await patch(page, SETUP, ['data/geo/tiles.js']);
  await wait(1500);
  const focus = (k, d = 0) => page.evaluate(({ k, d }) => { const c = window.__evict; window.__map2DTest.focus(c.lat + d, c.lng + d, k); }, { k, d });
  const shot = async (step) => {
    const file = path.join(OUT, `${TAG}-${TOUCH ? 'touch' : 'desktop'}-${step}.png`);
    await page.screenshot({ path: file, timeout: 120000 });
    const check = await textureCheck(page);
    const row = { step, ...check, blackPct: blackShare(file), file: path.relative(process.cwd(), file) };
    results.push(row);
    console.log(JSON.stringify(row));
  };
  await focus(45);
  for (let i = 0; i < 20 && (await textureCheck(page)).drawn < 10; i++) await wait(2000); // the model files come in
  await wait(3000);
  await shot('1-fresh');
  // A long session's eviction: every file idle past keepMs (15 s), then the LRU trimmed to nothing.
  await wait(16000);
  await page.evaluate(async () => { const m = await import('/terra-imperium/src/battle/render/gltfUnitLoader.js'); window.__dropped = m.trimGltfCache(0); });
  await focus(45, 0.02); await wait(6000);
  await shot('2-after-evict');
  // A lost and restored context (a phone's memory pressure, the app in the background).
  await page.evaluate(() => {
    window.__townsBefore = [...window.__closeView.towns.values()].map((m) => m.uuid);
    const canvas = [...document.querySelectorAll('canvas')].find((c) => c.getContext('webgl2'));
    const ext = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__lose = ext; ext.loseContext();
  });
  await wait(800);
  await page.evaluate(() => window.__lose.restoreContext());
  await wait(1500);
  await focus(45); await wait(6000);
  // on a touch device the maps kept no CPU copy: the towns must be rebuilt from a full load, not
  // uploaded again from the 64 px stand-ins (blurred)
  const rebuilt = await page.evaluate(() => [...window.__closeView.towns.values()].some((m) => !window.__townsBefore.includes(m.uuid)));
  console.log(JSON.stringify({ townsRebuiltAfterRestore: rebuilt }));
  await shot('3-after-restore');
  // Off screen, the files are no longer held and may go; back on screen they must load again
  // (the objects built on them are dropped with them), never draw from the disposed copies.
  await focus(45, 25); await wait(4000);
  await wait(16000);
  const dropped = await page.evaluate(async () => { const m = await import('/terra-imperium/src/battle/render/gltfUnitLoader.js'); return m.trimGltfCache(0).length; });
  console.log(JSON.stringify({ droppedOffScreen: dropped }));
  await focus(45);
  for (let i = 0; i < 20 && (await textureCheck(page)).drawn < 10; i++) await wait(2000);
  await wait(3000);
  await shot('4-away-and-back');
  await context.close();
} finally {
  await browser.close();
}
const bad = results.filter((r) => r.broken > 0);
console.log(bad.length ? `BROKEN TEXTURES at ${bad.map((r) => r.step).join(', ')}` : 'no broken textures');
