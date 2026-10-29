// .claude/skills/battle-lab/finish-shot.mjs
// The end of a lost commanded battle in a real browser (lane battle-truth): the sandbox with a small army
// left idle against cavalry at 3x. Shoots the first clash (the camera goes there, "Your ... are under
// attack"), the "army is gone" banner, Finish now's "finishing" line and the result card. Prints the battle
// clock when Finish now was tapped and the wall-clock seconds the rest of the battle took.
// Dev server first (npx vite --port 5343 --strictPort), then:
//   CHROMIUM="C:/Program Files/Google/Chrome/Application/chrome.exe" node .claude/skills/battle-lab/finish-shot.mjs <outDir> [prefix]
// URL, W, H (844 x 390), LANG_UI (en | he), CHROMIUM (a browser path, else Playwright's own).
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const prefix = process.argv[3] || 'finish';
mkdirSync(outDir, { recursive: true });
const url = process.env.URL || 'http://localhost:5343/terra-imperium/?battleSandbox&autostart&fort=0&attacker=small&defender=cavalry';
const W = Number(process.env.W || 844); const H = Number(process.env.H || 390);
const browser = await launchBrowser(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: W < 1000 });
await ctx.addInitScript((lang) => { try { localStorage.setItem('ti.coach.firstBattle', '1'); localStorage.setItem('ti.hint.battleControls', '1'); if (lang) localStorage.setItem('terra-imperium.language', lang); } catch { /* blocked */ } }, process.env.LANG_UI === 'he' ? 'he' : null);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
const shot = (name) => page.screenshot({ path: `${outDir}/${prefix}-${name}.jpg`, quality: 70 });
await page.goto(url, { timeout: 240000 });
await page.getByTestId('battle-start').first().click({ timeout: 180000 });
await page.waitForTimeout(1500);
await page.getByTestId('battle-speed').first().click().catch(() => {}); // 2x
await page.getByTestId('battle-speed').first().click().catch(() => {}); // 3x
const hit = await page.getByTestId('battle-alerts').filter({ hasText: /Your .* are under attack|שלכם תחת מתקפה/ }).first()
  .waitFor({ timeout: 300000 }).then(() => true, () => false);
await shot('clash');
await page.getByTestId('battle-army-gone').waitFor({ timeout: 600000 }).catch(async (e) => { await shot('timeout'); throw e; });
await shot('gone');
const clock = await page.getByTestId('battle-clock').first().textContent().catch(() => '?');
const t0 = Date.now();
await page.getByTestId('battle-finish-now').click();
await page.waitForTimeout(300);
await shot('finishing');
await page.locator('[data-testid="battle-end-beat"], [data-testid="battle-result"]').first().waitFor({ timeout: 300000 });
const secs = (Date.now() - t0) / 1000;
if (await page.getByTestId('battle-end-beat').isVisible().catch(() => false)) await page.getByTestId('battle-end-beat').click();
await page.getByTestId('battle-result').waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await shot('result');
console.log(JSON.stringify({ clashAlert: hit, clockAtFinish: clock, secondsToEnd: secs, errors }));
await browser.close();
