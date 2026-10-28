// .claude/skills/battle-lab/screens-shot.mjs
// The battle screens lane's before/after set (playtest 40651418969): per size and language, the field
// deploy with the first-battle coach, the battle started, the army selected, the result after a
// retreat (its end beat first), the sandbox setup with the last result, and the naval deploy.
// Dev server first:  npx vite --port 5199 --strictPort &
//   node .claude/skills/battle-lab/screens-shot.mjs <outDir> [baseUrl]   (SIZES=844x390,1600x900 LANGS=en,he)
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';

const outDir = process.argv[2] || '.';
const base = process.argv[3] || 'http://localhost:5199/terra-imperium/';
const sizes = (process.env.SIZES || '844x390,1600x900').split(',').map((s) => s.split('x').map(Number));
const langs = (process.env.LANGS || 'en,he').split(',');
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchBrowser({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', headless: true });
for (const [w, h] of sizes) for (const lang of langs) {
  const phone = h <= 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript((l) => { try { localStorage.setItem('terra-imperium.language', l); } catch { /* blocked */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const tag = `${w}x${h}-${lang}`;
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${tag}-${name}.png`) });
  const tap = async (id) => { const loc = page.getByTestId(id).first(); await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); const bb = await loc.boundingBox(); if (!bb) return false; if (phone) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  try {
    await page.goto(`${base}?battleSandbox&autostart&age=bronze`, { timeout: 240000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('battle-start').first().waitFor({ timeout: 120000 });
    await page.waitForTimeout(2500);
    await shot('1-deploy');
    await tap('battle-deploy-more'); await page.waitForTimeout(300); await shot('2-deploy-folded');
    await tap('battle-start'); await page.waitForTimeout(1500); await shot('3-started-coach');
    if (await page.getByTestId('battle-coach-skip').count()) await tap('battle-coach-skip');
    await tap('battle-select-all'); await page.waitForTimeout(600); await shot('4-selected');
    await tap('battle-pause'); await page.waitForTimeout(400);
    await tap('battle-leave'); await page.waitForTimeout(300); await tap('battle-retreat-all'); await page.waitForTimeout(300);
    await tap('battle-resume');
    await page.getByTestId('battle-end-beat').waitFor({ timeout: 240000 }).then(() => shot('5-end-beat'), () => {});
    await page.getByTestId('battle-result').waitFor({ timeout: 240000 }); await page.waitForTimeout(500); await shot('6-result');
    await tap('battle-continue'); await page.waitForTimeout(1000); await shot('7-setup');
    await page.goto(`${base}?battleSandbox&autostart&sea&age=classical`, { timeout: 240000, waitUntil: 'domcontentloaded' });
    await page.getByTestId('battle-start').first().waitFor({ timeout: 120000 }); await page.waitForTimeout(2500);
    await shot('8-naval-deploy');
  } catch (e) { console.log(`${tag} failed: ${e.message.split('\n')[0]}`); await shot('x-failed'); }
  console.log(`${tag} done${errors.length ? `, errors: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}
await browser.close();
