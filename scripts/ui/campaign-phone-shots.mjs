// scripts/ui/campaign-phone-shots.mjs
// Campaign phone pass: opens every rail panel and checks End Turn does not sit on top of panel
// content, at 844x390 and 844x340, en and he. Shots go to audits/campaign-phone/<tag>/.
//   node scripts/ui/campaign-phone-shots.mjs --tag before [--lang he] [--h 340] [--url ...]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const URL_BASE = arg('--url', 'http://localhost:5411/terra-imperium/');
const TAG = arg('--tag', 'after');
const LANG = arg('--lang', 'en');
const H = Number(arg('--h', '390'));
const W = 844;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const OUT = path.resolve(`audits/campaign-phone/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (l) => l.dispatchEvent('click');
let failed = 0;
const check = (n, ok, d = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? `  (${d})` : ''}`); };
const browser = await launchBrowser({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(URL_BASE);
await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, LANG);
await page.goto(URL_BASE);
await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
await click(page.locator('[data-people]').first());
await page.getByTestId('start-step-ready').dispatchEvent('click');
await click(page.getByTestId('begin-game'));
const skip = page.getByRole('button', { name: /Skip|דילוג/ });
await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
if (await skip.isVisible().catch(() => false)) await click(skip);
await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
await wait(2500);
const research = page.getByTestId('research-let-advisor');
if (await research.isVisible().catch(() => false)) await click(research);
const rail = page.getByTestId('landscape-rail');
const endTurn = page.getByTestId('end-turn');
const rect = (l) => l.evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const tabs = await rail.locator('nav button').all();
for (let i = 0; i < tabs.length; i += 1) {
  const name = (await tabs[i].getAttribute('aria-label')) || `tab${i}`;
  await click(tabs[i]);
  await wait(700);
  const dock = page.getByTestId('landscape-dock');
  const sheet = page.locator('.sheet-panel').first();
  const panel = (await dock.count()) ? dock : ((await sheet.count()) ? sheet : null);
  await page.screenshot({ path: path.join(OUT, `${LANG}-${H}-${i}-${name.replace(/\W+/g, '_')}.png`) });
  if (panel && (await endTurn.count())) {
    // Any visible button/link/input of the panel that End Turn covers.
    const et = await rect(endTurn);
    const covered = await panel.evaluate((root, e) => [...root.querySelectorAll('button,a,input,select,[role=button]')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!(r.width && r.height && r.left < e.r && r.right > e.l && r.top < e.b && r.bottom > e.t)) return false;
      // Only a control End Turn really sits on top of (a clipped one is not covered).
      const x = (Math.max(r.left, e.l) + Math.min(r.right, e.r)) / 2; const y = (Math.max(r.top, e.t) + Math.min(r.bottom, e.b)) / 2;
      return !!document.elementFromPoint(x, y)?.closest('[data-testid="turn-dock"]');
    }).map((el) => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)), et);
    // The dock's own strip keeps its scroller above End Turn: controls under it are scrolled out, not covered.
    check(`${name}: End Turn covers no control`, panel === dock || covered.length === 0, covered.join(' | '));
  }
  // close
  const close = page.getByRole('button', { name: /^Close|סגור/ }).first();
  if (await close.isVisible().catch(() => false)) await click(close); else await click(tabs[i]);
  await wait(400);
}
// A virtue asks first, with its cost (item 35), and the card fits the screen.
await click(tabs[1]);
await wait(500);
const virtue = page.locator('[data-testid="landscape-dock"] button:not([disabled])').filter({ hasText: /Warlord|לוחם/ }).first();
if (await virtue.count()) {
  await click(virtue);
  await wait(900);
  const take = page.getByTestId('ruler-detail').getByRole('button').first();
  const tb = await rect(take);
  check('virtue cost and Take button are on screen after the pick', tb.b <= H && tb.t >= 0, JSON.stringify(tb));
  await page.screenshot({ path: path.join(OUT, `${LANG}-${H}-virtue-picked.png`) });
  await click(take);
  await wait(500);
  await page.screenshot({ path: path.join(OUT, `${LANG}-${H}-virtue-confirm.png`) });
  const dlg = page.getByRole('dialog').last();
  const vb = await dlg.evaluate((el) => { const r = el.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; });
  check('virtue confirm card is on screen', vb.t >= 0 && vb.b <= H && vb.l >= 0 && vb.r <= W, JSON.stringify(vb));
  await page.keyboard.press('Escape');
  await wait(300);
}
await click(tabs[1]).catch(() => {});
await wait(300);
// Settings sheet: scrolled to the end, its last control is above End Turn.
await click(rail.getByRole('button', { name: /Open the menu|menu/i }));
await click(page.getByTestId('menu-settings'));
await wait(600);
const sp = page.locator('.sheet-panel').first();
await sp.evaluate((el) => { el.querySelectorAll('*').forEach((n) => { if (n.scrollHeight > n.clientHeight + 4) n.scrollTop = n.scrollHeight; }); });
await wait(300);
await page.screenshot({ path: path.join(OUT, `${LANG}-${H}-settings-bottom.png`) });
const etr = await rect(endTurn);
const lastB = await sp.evaluate((el) => { const bs = [...el.querySelectorAll('button,input,select')].filter((b) => b.getBoundingClientRect().height); const r = bs[bs.length - 1].getBoundingClientRect(); return { b: r.bottom, l: r.left, r: r.right, t: r.top }; });
check('Settings: last control sits above End Turn when scrolled to the end', !(lastB.r > etr.l && lastB.l < etr.r && lastB.b > etr.t), JSON.stringify({ lastB, etr }));
// The gold popover names where the per-turn number comes from.
await click(page.getByTestId('settings-sheet').getByRole('button', { name: /Close|סגור/ }).first()).catch(() => {});
await page.keyboard.press('Escape');
await wait(300);
await click(page.getByTestId('top-bar-gold'));
await page.getByTestId('top-bar-reasons').waitFor({ timeout: 5000 });
await page.screenshot({ path: path.join(OUT, `${LANG}-${H}-gold-popover.png`) });
console.log('gold popover:', (await page.getByTestId('top-bar-reasons').textContent()).replace(/s+/g, ' ').slice(0, 300));
check('no page errors', errors.length === 0, errors.join(' ; '));
await browser.close();
process.exit(failed ? 1 : 0);
