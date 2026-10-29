// scripts/ui/polish8-shots.mjs
// Shots of lane polish-8's cards (trade terms, dock Buy confirm, the manual save slot in Load)
// at 844x390 and 1600x900, en and he, into plans/ui/polish-8/. Needs `npx vite --port 5288`.
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const URL_BASE = process.argv[2] || 'http://localhost:5288/terra-imperium/';
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve('plans/ui/polish-8');
fs.mkdirSync(OUT, { recursive: true });
const SKIP_HE = 'דילוג';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const startGame = async (page, lang) => {
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByTestId('begin-game'));
  const skip = page.getByRole('button', { name: lang === 'he' ? SKIP_HE : 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
};

const ask = (page, which) => page.evaluate(async (which) => {
  const spec = await import('/terra-imperium/src/components/ui/confirmSpecs.js');
  const dlg = await import('/terra-imperium/src/components/ui/ConfirmActionDialog.jsx');
  const s = window.__game.state; const me = s.playerNationId;
  const other = Object.values(s.nations).find((n) => n.id !== me && !n.isEliminated && n.kind !== 'independent');
  if (which === 'trade') {
    const fog = s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [other.id]: 1 } } } : s.fog;
    const st = { ...s, fog, techAgeId: 'bronze', resources: { ...s.resources, gold: 5000 }, nations: { ...s.nations, [other.id]: { ...other, isAtWar: false } } };
    const sp = spec.tradeConfirm(st, other.id, other.name); if (!sp) throw new Error('trade refused: ' + other.id); dlg.askConfirm(sp, () => {});
  } else dlg.askConfirm(spec.buyConfirm({ ...s, resources: { ...s.resources, gold: 420 } }, { cityId: 'x', name: 'Ur', gold: 250, turns: 4 }, 'Ur'), () => {}); // a band starts with no city: any name shows the card
}, which);

const browser = await launchBrowser({ executablePath: CHROME });
for (const lang of ['en', 'he']) {
  for (const vp of [{ id: 'phone', width: 844, height: 390 }, { id: 'desktop', width: 1600, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.id === 'phone', hasTouch: vp.id === 'phone' });
    const page = await ctx.newPage();
    try {
      await startGame(page, lang);
      for (const which of ['trade', 'buy']) {
        await ask(page, which); await wait(700);
        await page.screenshot({ path: path.join(OUT, `${which}-${lang}-${vp.id}.png`) });
        await page.keyboard.press('Escape'); await wait(300);
        await page.evaluate(async () => (await import('/terra-imperium/src/components/ui/ConfirmActionDialog.jsx')).closeConfirm());
      }
      // Menu > Save now, then the title's Load lists the manual slot beside the autosave
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-menu', { detail: 'all' })));
      await click(page.getByTestId('menu-save')); await wait(500);
      await page.screenshot({ path: path.join(OUT, `menu-${lang}-${vp.id}.png`) });
      await page.reload();
      await page.getByTestId('title-load').waitFor({ timeout: 60000 });
      await click(page.getByTestId('title-load'));
      await wait(600);
      await page.screenshot({ path: path.join(OUT, `load-${lang}-${vp.id}.png`) });
      console.log('ok', lang, vp.id);
    } catch (e) { console.log('FAIL', lang, vp.id, e.message.split('\n')[0]); await page.screenshot({ path: path.join(OUT, `fail-${lang}-${vp.id}.png`) }); }
    await ctx.close();
  }
}
await browser.close();
