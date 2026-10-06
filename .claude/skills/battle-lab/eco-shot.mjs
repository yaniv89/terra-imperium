// .claude/skills/battle-lab/eco-shot.mjs
// Battle economy check in a real browser (phase R1): opens the sandbox with the economy on, AI
// against AI (`&spectate`) so both sides gather, build and train, fast-forwards, then screenshots
// the attacker's base, the defender's town, and the HUD with the build menu and a building panel
// open. Prints the economy summary and console errors.
// Start the dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/eco-shot.mjs <outDir> [--w 844 --h 390] [--seconds 40] [--query "&age=bronze"]
//        [--browser "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"] [--tag phone]
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const seconds = Number(opt('seconds', 40));
const tag = opt('tag', `${W}x${H}`);
const query = opt('query', '&age=bronze');
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const spectate = !argv.includes('--player');
const url = `${process.env.URL || 'http://localhost:5199/terra-imperium/'}?battleSandbox&autostart${spectate ? '&spectate' : ''}${query}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.getByTestId('battle-pause').click();
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '1×'); b?.click(); b?.click(); }); // 3x
for (let s = 0; s < seconds; s += 10) {
  await page.waitForTimeout(10000);
  const st = await page.evaluate(() => { const v = window.__battleView?.(); return v?.eco ? { tick: v.tick, stock: v.eco.stock, pop: `${v.eco.pop}/${v.eco.cap}`, buildings: v.eco.buildings.filter((b) => b.alive).map((b) => `${b.side}:${b.type}${b.built ? '' : '*'}`).join(' ') } : null; });
  console.log(`t+${s + 10}s ${JSON.stringify(st)}`);
}
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Pause|Play/.test(x.textContent)); b?.click(); }); // pause for the shots
const shot = async (name, fn) => {
  await page.evaluate(fn);
  await page.waitForTimeout(700);
  const file = path.join(outDir, `${name}-${tag}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
};
await shot('base', () => { const r = window.__battleRenderer; const v = window.__battleView(); const camp = v.eco.buildings.find((b) => b.type === 'camp'); r.zoomBy(1.8); r.centerOn(camp.x / 256 + 3, camp.y / 256); });
await shot('town', () => { const r = window.__battleRenderer; const k = r.setup.structures[0]; r.centerOn(k.x / 256 - 4, k.y / 256); });
// The HUD: the build menu open, then the camp's panel (tap the Base button).
await page.getByTestId('battle-hq').click().catch(() => {});
await page.waitForTimeout(400);
await page.getByTestId('battle-build').click({ force: true }).catch(() => {});
await shot('hud', () => {});
console.log(errors.length ? `console errors:\n${errors.slice(0, 20).join('\n')}` : 'no console errors');
await browser.close();
