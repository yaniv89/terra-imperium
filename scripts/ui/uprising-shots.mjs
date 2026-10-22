// scripts/ui/uprising-shots.mjs
// The Machine Uprising warning (automation.js uprisingWarning): its "needs you" chip and log line at
// 844x390 and 1600x900, en and he. Dev server first (`npx vite --port 5197`).
//   node scripts/ui/uprising-shots.mjs <outDir> [--url http://localhost:5197/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] || 'plans/ui/uprising');
const i = process.argv.indexOf('--url');
const URL_BASE = i >= 0 ? process.argv[i + 1] : 'http://localhost:5197/terra-imperium/';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const SIZES = [{ id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { id: 'desktop', viewport: { width: 1600, height: 900 } }];

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await launchBrowser(CHROME ? { executablePath: CHROME } : {});
for (const vp of SIZES) {
  for (const lang of ['en', 'he']) {
    const ctx = await browser.newContext(vp);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(URL_BASE, { timeout: 240000 });
    await page.evaluate(() => localStorage.clear());
    await page.goto(URL_BASE, { timeout: 240000 });
    await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
    await click(page.locator('[data-people]').first());
    await page.getByTestId('start-step-ready').dispatchEvent('click');
    await click(page.getByRole('button', { name: /^Begin as/ }));
    const skip = page.getByRole('button', { name: 'Skip' });
    await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await skip.isVisible().catch(() => false)) await click(skip);
    await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
    await wait(2000);
    const later = page.getByRole('button', { name: /Later|Not now|Let my advisor choose/ });
    if (await later.first().isVisible().catch(() => false)) await click(later.first());
    if (lang === 'he') { await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he')); await wait(800); }
    await page.evaluate(async () => {
      const { msg } = await import('/terra-imperium/src/engine/messages.js');
      const s = window.__game.state; const me = s.playerNationId; const t = s.turnNumber || 1;
      const next = { ...s, nations: { ...s.nations, [me]: { ...s.nations[me], automation: 70, stability: -2, uprisingWarning: { since: t, at: t + 6 } } },
        logs: [...s.logs, { year: s.year, ...msg('m.turn.uprisingWarning', { count: 6, automation: 60, stability: -2 }), type: 'crisis' }] };
      window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
    });
    await wait(1500);
    const file = path.join(OUT, `uprising-${vp.id}-${lang}.png`);
    await page.screenshot({ path: file });
    const chip = await page.getByText(/Robots rise|הרובוטים יתקוממו/).first().boundingBox().catch(() => null);
    console.log(`${vp.id} ${lang} chip=${chip ? `${Math.round(chip.x)},${Math.round(chip.y)} ${Math.round(chip.width)}x${Math.round(chip.height)}` : 'none'} errors=${errors.length} ${file}`);
    await ctx.close();
  }
}
await browser.close();
