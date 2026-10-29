// .claude/skills/battle-lab/result-pin.mjs
// The result screen's pinned Continue (lane battle-hud-9, NC 162): a sandbox battle ended by Retreat, then
// per size and language whether Continue sits inside the screen without a scroll. Prints one line each.
// Dev server first (npx vite --port 5231), then:
//   CHROMIUM=<browser exe> node .claude/skills/battle-lab/result-pin.mjs <outDir>   (SIZES=844x390,1600x900 LANGS=en,he)
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const base = process.env.URL || 'http://localhost:5231/terra-imperium/';
const sizes = (process.env.SIZES || '844x390,1600x900').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANGS || 'en,he').split(',');
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
for (const [w, h] of sizes) for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: h <= 500 });
  await ctx.addInitScript((l) => { try { localStorage.setItem('terra-imperium.language', l); localStorage.setItem('ti.coach.firstBattle', '1'); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage();
  const tap = (id) => page.getByTestId(id).first().click();
  await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000 });
  await page.getByTestId('battle-start').first().waitFor({ timeout: 180000 });
  await tap('battle-start'); await page.waitForTimeout(1500);
  await tap('battle-pause'); await page.waitForTimeout(400);
  await tap('battle-leave'); await page.waitForTimeout(300); await tap('battle-retreat-all'); await page.waitForTimeout(300);
  await tap('battle-resume');
  await page.getByTestId('battle-end-beat').click({ timeout: 240000 }).catch(() => {});
  await page.getByTestId('battle-result').waitFor({ timeout: 240000 });
  await page.waitForTimeout(1500);
  const m = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="battle-continue"]').getBoundingClientRect();
    const sc = document.querySelector('[data-testid="battle-result"]');
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, inView: r.top >= 0 && r.bottom <= innerHeight, scrolls: sc.scrollHeight > sc.clientHeight };
  });
  const f = path.join(outDir, `result-${w}x${h}-${lang}.png`);
  await page.screenshot({ path: f });
  console.log(`${w}x${h} ${lang}: Continue ${m.top}-${m.bottom} of ${m.vh}, in view ${m.inView}, the card scrolls ${m.scrolls} | ${f}`);
  await ctx.close();
}
await browser.close();
