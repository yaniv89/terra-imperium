// .claude/skills/battle-lab/deploy-tap.mjs
// Deploy by hand on a phone (playtest 40736779836 steps 3 to 6): the sandbox at 844x390 touch, Line,
// then a tap on a squad's middle and on its banner, then a tap inside the zone. Prints the selection
// rings drawn and where the squad stands after each step, and saves a shot per step.
// Dev server first:  npx vite --port 5199 --strictPort &
//   AGES=stone,gunpowder Q='&fort=0' node .claude/skills/battle-lab/deploy-tap.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const W = 844; const H = 390;
const ages = (process.env.AGES || 'stone').split(',');
const base = process.env.URL || 'http://localhost:5199/terra-imperium/';
const lang = process.env.LANG_UI || 'en';
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
for (const age of ages) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('terra-imperium.language', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  // each event carries its own time: CDP answers only after a slow frame, which would stretch a tap into a long press
  const touch = (type, touchPoints, at) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints, timestamp: at });
  const tap = async (x, y) => { const t = Date.now() / 1000; const d = touch('touchStart', [{ x, y, id: 1 }], t); await page.waitForTimeout(60); await touch('touchEnd', [], t + 0.06); await d; await page.waitForTimeout(400); };
  const shot = (n) => page.screenshot({ path: path.join(outDir, `${age}-${lang}-${n}.png`) });
  await page.goto(`${base}?battleSandbox&age=${age}${process.env.Q ?? '&fort=0'}`, { timeout: 240000 });
  await page.getByRole('button', { name: /Fight|הילחם|לקרב/ }).first().click();
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
  await page.waitForTimeout(2500);
  const line = await page.$('[data-testid="battle-deploy-preset-line"]');
  if (line) { const bb = await line.boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(800); }
  await shot('1-line');
  const info = () => page.evaluate(() => {
    const r = window.__battleRenderer; const v = window.__battleView(); const Q = 256;
    const own = v.squads.filter((q) => q.side === v.playerSide && q.alive && q.onField && q.classId !== 'worker');
    return { side: v.playerSide, rings: r.rings.count, sel: window.__battleSelected?.() ?? null, squads: own.map((q) => { const s = r.worldToScreen(q.x / Q, q.y / Q); return { idx: q.idx, cls: q.classId, sx: Math.round(s.x), sy: Math.round(s.y), x: q.x, y: q.y }; }) };
  });
  const a = await info();
  const q = a.squads.find((s) => s.sx > 40 && s.sx < 420 && s.sy > 60 && s.sy < 300) || a.squads[0];
  console.log(`${age} before: rings ${a.rings} sel ${JSON.stringify(a.sel)} target squad ${JSON.stringify(q)}`);
  await tap(q.sx, q.sy);
  const b = await info();
  console.log(`${age} tap on squad middle: rings ${b.rings} sel ${JSON.stringify(b.sel)} panel "${(await page.getByTestId('battle-deploy-selected').textContent().catch(() => ''))}"`);
  await shot('2-tapped');
  // a spot in the zone well clear of the squad (a tap on it would select it again), below the top bar
  const defender = a.side === 1; // the deploy card sits on the far side from your army: left for a defender
  const tx = defender ? Math.min(780, q.sx + 150) : q.sx > 300 ? q.sx - 150 : Math.min(480, q.sx + 150); const ty = Math.max(120, Math.min(290, q.sy + 40));
  await tap(tx, ty);
  await page.waitForTimeout(1500);
  const c = await info();
  const moved = c.squads.find((s) => s.idx === q.idx);
  console.log(`${age} tap in zone at ${tx},${ty}: squad now at screen ${moved?.sx},${moved?.sy} (was ${q.sx},${q.sy}) sel ${JSON.stringify(c.sel)} rings ${c.rings}`);
  await shot('3-placed');
  console.log(`${age} errors: ${errors.slice(0, 5).join(' | ') || 'none'}`);
  await ctx.close();
}
await browser.close();
