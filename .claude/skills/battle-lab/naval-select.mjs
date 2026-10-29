// .claude/skills/battle-lab/naval-select.mjs
// Box select of ships on a phone (playtest 40736779836 step 47: "the box caught one ship"). The sea
// sandbox at 844x390 touch: Start, Select, at once a drag around every own ship; prints how many were caught
// and saves a shot. Touch events carry their own timestamps (a slow frame must not stretch a gesture).
// Dev server first:  npx vite --port 5199 --strictPort &
//   AGES=classical,information [PAD=-12] node .claude/skills/battle-lab/naval-select.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const ages = (process.env.AGES || 'information').split(',');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
for (const age of ages) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const t0 = Date.now() / 1000;
  let clock = 0;
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp: t0 + clock / 1000 });
  const tapAt = async (x, y) => { clock = (Date.now() / 1000 - t0) * 1000; const d = touch('touchStart', [{ x, y, id: 1 }]); clock += 60; await touch('touchEnd', []); await d; await page.waitForTimeout(400); };
  const drag = async (x1, y1, x2, y2) => {
    clock = (Date.now() / 1000 - t0) * 1000;
    const sent = [touch('touchStart', [{ x: x1, y: y1, id: 1 }])];
    for (let k = 1; k <= 12; k++) { clock += 16; sent.push(touch('touchMove', [{ x: x1 + ((x2 - x1) * k) / 12, y: y1 + ((y2 - y1) * k) / 12, id: 1 }])); }
    clock += 16; sent.push(touch('touchEnd', []));
    await Promise.all(sent); await page.waitForTimeout(500);
  };
  const tapId = async (id) => { const bb = await (await page.$(`[data-testid="${id}"]`))?.boundingBox(); if (bb) await tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2); return !!bb; };
  await page.goto(`${base}?battleSandbox&age=${age}&sea`, { timeout: 240000 });
  await page.getByRole('button', { name: 'Fight' }).first().click();
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  await tapId('battle-pause'); // Start
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `naval-select-${age}-before.png`) });
  const ships = await page.evaluate(() => {
    const r = window.__battleRenderer; const v = window.__battleView(); const Q = 256;
    return v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField).map((q) => { const s = r.worldToScreen(q.x / Q, q.y / Q); return { idx: q.idx, x: Math.round(s.x), y: Math.round(s.y) }; });
  });
  const xs = ships.map((s) => s.x); const ys = ships.map((s) => s.y);
  // PAD (px, default 30) around the ships' centres; a negative PAD leaves the outer ships' centres out (their hulls in)
  const pad = Number(process.env.PAD ?? 30);
  const box = [Math.max(4, Math.min(...xs) - pad), Math.max(50, Math.min(...ys) - pad), Math.min(840, Math.max(...xs) + pad), Math.min(330, Math.max(...ys) + pad)];
  await tapId('battle-select-mode');
  await drag(...box);
  const sel = await page.evaluate(() => window.__battleSelected());
  console.log(`${age}: ${ships.length} ships at ${JSON.stringify(ships)}; box ${box.join(',')} caught ${sel.length}: ${JSON.stringify(sel)}`);
  await page.screenshot({ path: path.join(outDir, `naval-select-${age}.png`) });
  await ctx.close();
}
await browser.close();
