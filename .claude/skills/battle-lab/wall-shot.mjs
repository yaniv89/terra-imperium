// .claude/skills/battle-lab/wall-shot.mjs
// Walls in a real browser: the sandbox's walled city (bronze, fort 2), AI against AI, fast-forwarded
// until the attacker reaches the wall ring; then the camera is put on the gate and a screenshot
// taken. Prints, every 2 s of sim time: attacker squads inside the ring, the gate's and the ring's
// state. Before the gate fix the attackers walked in through an open gate (inside > 0 with the
// gate whole); now they stop at it and batter it.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/wall-shot.mjs <out.png> [--w 844 --h 390] [--query "&age=bronze&city=medium&fort=2&seed=7"]
//        [--max 120] [--until contact|fallen] [--browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const out = argv[0] && !argv[0].startsWith('--') ? argv.shift() : 'walls.png';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const query = opt('query', '&age=bronze&city=medium&fort=2&seed=7');
const maxSec = Number(opt('max', 150));
// --until fallen: go on until the gate (or the ring) is down and the attacker is in
const until = opt('until', 'contact');
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&autostart&spectate${query}`;

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.getByTestId('battle-pause').click();
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '1×'); b?.click(); b?.click(); }); // 3x

const state = () => page.evaluate(() => {
  const v = window.__battleView?.(); if (!v) return null;
  const k = v.structures[0]; const Q = 256;
  const ring = v.structures.filter((s) => s.kind === 'wall' || s.kind === 'gate');
  const ringR = ring.reduce((m, s) => Math.max(m, Math.hypot(s.x - k.x, s.y - k.y)), 0);
  const gate = v.structures.find((s) => s.kind === 'gate');
  const att = v.squads.filter((q) => q.side === 0 && q.alive !== false && q.strength > 0 && !q.worker);
  const inner = ringR - 1.5 * Q;
  const inside = att.filter((q) => Math.hypot(q.x - k.x, q.y - k.y) < inner).length;
  const atGate = att.filter((q) => Math.hypot(q.x - gate.x, q.y - gate.y) < 4 * Q).length;
  const fallen = v.structures.filter((s) => (s.kind === 'wall' || s.kind === 'gate' || s.kind === 'tower') && !s.alive).length;
  return { tick: v.tick, inside, atGate, gateHp: `${gate.hp}/${gate.maxHp}`, fallen, ended: !!v.ended };
});
let last = null;
for (let s = 0; s < maxSec; s += 2) {
  await page.waitForTimeout(2000);
  last = await state();
  console.log(JSON.stringify(last));
  if (!last || last.ended) break;
  const [hp, max] = last.gateHp.split('/').map(Number);
  if (until === 'fallen' ? last.fallen > 0 && last.inside >= 2 : last.inside >= 2 || (last.atGate >= 1 && hp < max * 0.8)) break;
}
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Pause|Play/.test(x.textContent)); b?.click(); });
await page.evaluate(() => {
  const r = window.__battleRenderer; const v = window.__battleView(); const k = v.structures[0]; const g = v.structures.find((s) => s.kind === 'gate');
  r.zoomBy(1.4); r.centerOn(g.x / 256 + 2, g.y / 256);
});
await page.waitForTimeout(800);
await page.screenshot({ path: out });
console.log(`saved ${out} ${JSON.stringify(last)}`);
console.log(errors.length ? `console errors:\n${errors.slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
