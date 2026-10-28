// .claude/skills/battle-lab/camera-probe.mjs
// Camera gestures the way the AI playtester sends them (CDP touch: a 12-step one-finger drag, and
// Input.synthesizePinchGesture): prints the camera's centre and zoom before and after each, in
// deploy and in play, so "drag does not pan, pinch does not zoom" is a number, not a feeling.
// Dev server first: npx vite --port 5199 --strictPort --force &
//   CHROMIUM=/opt/pw-browsers/chromium node .claude/skills/battle-lab/camera-probe.mjs [--w 844 --h 390]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390));
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000 });
await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
await page.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const cam = () => page.evaluate(() => { const c = window.__battleRenderer.camera; return { x: +c.position.x.toFixed(1), z: +c.position.z.toFixed(1), zoom: +c.zoom.toFixed(2) }; });
const drag = async (x1, y1, x2, y2) => { await touch('touchStart', [{ x: x1, y: y1, id: 1 }]); for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: x1 + ((x2 - x1) * k) / 12, y: y1 + ((y2 - y1) * k) / 12, id: 1 }]); await page.waitForTimeout(16); } await touch('touchEnd', []); };
const pinch = (x, y, s) => cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: s, gestureSourceType: 'touch' });
const row = async (label, fn) => { const a = await cam(); await fn(); await page.waitForTimeout(400); const b = await cam(); console.log(`${label.padEnd(26)} ${JSON.stringify(a)} -> ${JSON.stringify(b)}`); };
for (const phase of ['deploy', 'play']) {
  if (phase === 'play') { await page.getByTestId('battle-start').click(); await page.waitForTimeout(1500); }
  await row(`${phase} drag left 300px`, () => drag(600, 200, 300, 220));
  await row(`${phase} drag up 150px`, () => drag(420, 300, 420, 150));
  await row(`${phase} pinch 0.6`, () => pinch(420, 200, 0.6));
  await row(`${phase} pinch 1.6`, () => pinch(420, 200, 1.6));
}
console.log(errors.length ? `errors: ${errors.join(' / ')}` : 'no page errors');
await browser.close();
