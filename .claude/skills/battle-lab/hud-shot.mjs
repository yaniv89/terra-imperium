// .claude/skills/battle-lab/hud-shot.mjs
// The battle HUD's space in a real browser (playtest audit CB19: I201, U03, I206, I207, U09): the
// sandbox at one screen size, optionally with phone cutout insets (`--safe t,r,b,l` in css px, passed
// to the screen as `&safe=` because headless Chromium has no notch), shot in five states: deploy,
// the army selected, the wand sheet open, laborers selected and their build sheet, the minimap on,
// paused. For each state it prints
//   field   the share of the screen the HUD leaves uncovered (I201's target: 70% or more)
//   small   visible buttons under 44 px on a side (touch targets)
//   unsafe  visible buttons that cross the safe area (the notch, the home bar)
//   pause   where the speed and pause buttons sit (I206: they must not move between states)
// Start the dev server first:  npx vite --port 5199 --strictPort --force &
//   node .claude/skills/battle-lab/hud-shot.mjs <outDir> [--w 844 --h 390] [--safe 0,47,21,47] [--params "&city=medium"] [--browser <exe>]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const safe = opt('safe', '');
const extra = opt('params', '');
const touch = opt('touch', W <= 1100 ? '1' : '0') === '1';
const exe = opt('browser', process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const url = `${base}?battleSandbox&autostart&age=bronze${safe ? `&safe=${safe}` : ''}${extra}`;
fs.mkdirSync(outDir, { recursive: true });
const tag = `${W}x${H}${safe ? '-safe' : ''}${opt('tag', '')}`;

const browser = await launchBrowser({ executablePath: exe, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: touch });
// Ordinary play: the first-battle coach (RTS-01) is taken as seen (`--hint 1` shows it).
if (opt('hint', '0') !== '1') await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await page.waitForTimeout(2000);

const [st, sr, sb, sl] = (safe || '0,0,0,0').split(',').map(Number);
const measure = () => page.evaluate(({ st, sr, sb, sl }) => {
  const root = document.querySelector('[data-testid="tactical-battle"]');
  const vw = innerWidth; const vh = innerHeight; const cell = 4;
  const cols = Math.ceil(vw / cell); const rows = Math.ceil(vh / cell);
  const grid = new Uint8Array(cols * rows);
  const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(/[ ,/]+/).filter(Boolean); return p.length > 3 ? Number(p[3]) : 1; };
  const small = []; const unsafe = [];
  root.querySelectorAll('*').forEach((el) => {
    if (el.tagName === 'CANVAS' || el.closest('[aria-hidden="true"]') || el.closest('[data-hud-ignore]')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return;
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const paints = alpha(cs.backgroundColor) > 0.05 || (parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0.05) || text || ['svg', 'IMG', 'BUTTON'].includes(el.tagName);
    if (el.tagName === 'BUTTON') {
      const name = el.dataset.testid || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20);
      if (r.width < 43.5 || r.height < 43.5) small.push(`${name} ${Math.round(r.width)}x${Math.round(r.height)}`);
      // A button scrolled out of its sheet is clipped by the sheet: judge the sheet instead.
      let box = r;
      for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowY)) { const pr = p.getBoundingClientRect(); box = { left: Math.max(r.left, pr.left), top: Math.max(r.top, pr.top), right: Math.min(r.right, pr.right), bottom: Math.min(r.bottom, pr.bottom) }; break; }
      }
      if (box.right > box.left && box.bottom > box.top && (box.left < sl - 0.5 || box.top < st - 0.5 || box.right > vw - sr + 0.5 || box.bottom > vh - sb + 0.5)) unsafe.push(name);
    }
    if (!paints) return;
    for (let y = Math.max(0, Math.floor(r.top / cell)); y < Math.min(rows, Math.ceil(r.bottom / cell)); y++) {
      for (let x = Math.max(0, Math.floor(r.left / cell)); x < Math.min(cols, Math.ceil(r.right / cell)); x++) grid[y * cols + x] = 1;
    }
  });
  const covered = grid.reduce((s, v) => s + v, 0) / grid.length;
  const at = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
  return { field: Math.round((1 - covered) * 1000) / 10, small, unsafe, pause: at('battle-pause'), speed: at('battle-speed') };
}, { st, sr, sb, sl });
const shot = async (name) => {
  const f = path.join(outDir, `${tag}-${name}.png`);
  await page.screenshot({ path: f });
  const m = await measure();
  console.log(`${name}: field ${m.field}% | pause ${m.pause} speed ${m.speed}${m.small.length ? ` | small: ${m.small.join('; ')}` : ''}${m.unsafe.length ? ` | UNSAFE: ${m.unsafe.join('; ')}` : ''}\n  ${f}`);
};

await shot('1-deploy');
await page.getByTestId('battle-pause').click(); // Start
await page.waitForTimeout(2500);
await page.getByTestId('battle-select-all').click();
await page.waitForTimeout(600);
await shot('2-army');
if (await page.getByTestId('battle-wand').count()) {
  await page.getByTestId('battle-wand').click();
  await page.waitForTimeout(500);
  await shot('3-wand');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}
// A laborer: tap one on the field (centred first).
const wp = await page.evaluate(() => {
  const v = window.__battleView?.(); const r = window.__battleRenderer;
  const q = v?.squads.find((s) => s.side === 0 && s.classId === 'worker' && s.alive && s.onField);
  if (!q) return null;
  r.centerOn(q.x / 256, q.y / 256); r.updateCamera();
  return r.worldToScreen(q.x / 256, q.y / 256, 0.4);
});
if (wp) {
  if (touch) await page.touchscreen.tap(wp.x, wp.y); else await page.mouse.click(wp.x, wp.y);
  await page.waitForTimeout(600);
  await shot('4-laborers');
  if (await page.getByTestId('battle-build').count()) {
    await page.getByTestId('battle-build').first().click();
    await page.waitForTimeout(800);
    await shot('4b-build-sheet');
    if (await page.getByTestId('battle-build-close').count()) await page.getByTestId('battle-build-close').click();
  }
}
// A narrow phone keeps Map behind View (RTS-02).
const viewMenu = async () => { if (await page.getByTestId('battle-view-more').count()) { await page.getByTestId('battle-view-more').click(); await page.waitForTimeout(200); } };
await viewMenu();
if (await page.getByTestId('battle-minimap-toggle').count()) {
  await page.getByTestId('battle-minimap-toggle').click();
  await page.waitForTimeout(600);
  await shot('5-minimap');
  await viewMenu();
  await page.getByTestId('battle-minimap-toggle').click();
}
await page.getByTestId('battle-pause').click();
await page.waitForTimeout(600);
await shot('6-paused');
console.log(errors.length ? `console errors:\n${errors.slice(0, 10).join('\n')}` : 'no console errors');
await browser.close();
