// scripts/ui/canopy-shot.mjs
// Trees and roofs over your selected squads fade (src/battle/render/canopyFade.js). Opens the battle
// sandbox in a forest, centres the camera on a player squad inside the woods, and shots the field with
// the squads selected and not. Dev server on --url (default :5231).
//   node scripts/ui/canopy-shot.mjs <outDir> [--w 844 --h 390] [--query "&terrain=forest&age=bronze"]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'audits/leftover-bugs';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const query = opt('query', '&terrain=forest&age=bronze');
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${opt('url', 'http://localhost:5231/terra-imperium/')}?battleSandbox&autostart${query}`;
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: exe, headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/status of 403/.test(m.text())) errors.push(m.text().slice(0, 300)); });
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(1500);
// The player's squad standing among the most trees.
const at = await page.evaluate(() => {
  const r = window.__battleRenderer; const v = r.lastView; const { w, h, tiles } = r.setup.map;
  const mine = v.squads.filter((s) => s.side === v.playerSide && s.alive && s.onField);
  const wood = (x, z) => { let n = 0; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (tiles[Math.max(0, Math.min(h - 1, Math.floor(z) + j)) * w + Math.max(0, Math.min(w - 1, Math.floor(x) + i))] === 1) n++; return n; };
  let best = mine[0]; let score = -1;
  mine.forEach((s) => { const sc = wood(s.x / 256, s.y / 256); if (sc > score) { score = sc; best = s; } });
  r.centerOn(best.x / 256, best.y / 256); r.zoomBy(1.6);
  return { idx: best.idx, wood: score };
});
console.log('squad', JSON.stringify(at));
await page.waitForTimeout(4000);
const tag = `${W}x${H}`;
await page.screenshot({ path: `${outDir}/canopy-${tag}-unselected.png` });
await page.evaluate((idx) => window.__battleSelect?.([idx]), at.idx);
await page.getByTestId('battle-select-all').click().catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/canopy-${tag}-selected.png` });
// Proof the shader works where no squad happens to stand under a tree: one hole by hand on the middle of the screen.
await page.evaluate(() => { const r = window.__battleRenderer; r.canopyFade.set = () => {}; r.canopyFade.holes.value[0].set(r.target.x, r.target.z, 3.2); r.canopyFade.count.value = 1; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/canopy-${tag}-hole.png` });
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no console errors');
await browser.close();
