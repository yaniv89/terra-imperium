// .claude/skills/battle-lab/camera-shot.mjs
// Touch camera on a phone (battle-screens lane, playtest 40651418969 steps 14-16, 24, 181, 185): the
// same CDP touch drag and pinch the AI playtester sends, and what the camera did (target moved, zoom).
// Dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/camera-shot.mjs <outDir> [query]   (query e.g. "&age=gunpowder")
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const query = process.argv[3] || '';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const wait = (ms) => page.waitForTimeout(ms);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const drag = async (x1, y1, x2, y2) => { await touch('touchStart', [{ x: x1, y: y1, id: 1 }]); for (let k = 1; k <= 12; k++) { await touch('touchMove', [{ x: x1 + ((x2 - x1) * k) / 12, y: y1 + ((y2 - y1) * k) / 12, id: 1 }]); await wait(16); } await touch('touchEnd', []); };
const cam = () => page.evaluate(() => { const r = window.__battleRenderer; return r ? { x: +r.target.x.toFixed(1), z: +r.target.z.toFixed(1), zoom: +r.camera.zoom.toFixed(2) } : null; });
const radial = () => page.getByTestId('battle-radial').isVisible().catch(() => false);

await page.goto(`${base}?battleSandbox&autostart${query}`, { timeout: 240000, waitUntil: 'domcontentloaded' });
await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
await wait(2000);
const under = (x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}${e.dataset?.testid ? `#${e.dataset.testid}` : ''}` : 'none'; }, [x, y]);
const report = async (label, fn, at) => { const a = await cam(); const what = at ? ` on ${await under(...at)}` : ''; await fn(); await wait(300); const b = await cam(); console.log(`${label}${what}: ${JSON.stringify(a)} -> ${JSON.stringify(b)} radial ${await radial()}`); };
await page.screenshot({ path: path.join(outDir, 'camera-deploy.png') });
await report('deploy drag', () => drag(420, 300, 250, 200), [420, 300]);
const bb = await page.getByTestId('battle-pause').boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
await wait(1500);
await report('battle drag', () => drag(500, 250, 300, 180), [500, 250]);
await report('battle drag 2', () => drag(300, 200, 520, 280), [300, 200]);
const sel = await page.getByTestId('battle-select-all').boundingBox(); await page.touchscreen.tap(sel.x + sel.width / 2, sel.y + sel.height / 2);
await wait(500);
await report('drag with army selected', () => drag(450, 230, 300, 160), [450, 230]);
await report('pinch 0.6', () => cdp.send('Input.synthesizePinchGesture', { x: 420, y: 220, scaleFactor: 0.6, gestureSourceType: 'touch' }));
await report('pinch 2', () => cdp.send('Input.synthesizePinchGesture', { x: 420, y: 220, scaleFactor: 2, gestureSourceType: 'touch' }));
await page.screenshot({ path: path.join(outDir, 'camera.png') });
await wait(0);
console.log('errors', errors.slice(0, 5));
await browser.close();
