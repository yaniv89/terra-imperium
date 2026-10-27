// scripts/ui/crisis-card-shots.mjs
// Real-browser check of the crisis card (crises.js): the warning notice, the card opened early
// (ANSWER_CRISIS_EARLY, "strikes in N turns"), and the card at the strike, at 844x390 and 1600x900,
// en and he, into plans/game/crisis-card/. Needs a dev server of this checkout (`npx vite --port 5197`).
//   node scripts/ui/crisis-card-shots.mjs [--url http://localhost:5197/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const OUT = path.resolve('plans/game/crisis-card');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok) => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };
const CRISIS = 'little_ice_age';

const run = async (browser, tag, viewport, lang) => {
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 900, hasTouch: viewport.width < 900, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack));
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${tag}-${lang}-${n}.jpg`), type: 'jpeg', quality: 60 });
  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^(Begin as|מתחילים)/ }));
  const skip = page.getByRole('button', { name: /^(Skip|דלג|דילוג)/ });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // A famine coming in 3 turns that hits the player.
  await page.evaluate((id) => {
    const s = window.__game.state;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, crises: { last: {}, lastAny: s.turnNumber, history: [], coming: { id, turn: s.turnNumber + 3, nations: [s.playerNationId, 'x'] } } } });
  }, CRISIS);
  await wait(800);
  const chip = page.getByTestId('crisis-banner-chip');
  if (await chip.isVisible().catch(() => false)) { await click(chip); await wait(600); }
  if (!(await page.getByTestId('crisis-banner').isVisible().catch(() => false))) { await click(page.getByRole('button', { name: /^(Later|אחר כך)/ }).first()).catch(() => {}); await wait(800); }
  await page.getByTestId('crisis-banner').waitFor({ timeout: 10000 }).catch(() => {});
  check(`${tag} ${lang}: warning shows`, await page.getByTestId('crisis-banner').isVisible().catch(() => false));
  await shot('1-warning');
  await click(page.getByTestId('crisis-answer-now'));
  await page.getByTestId('event-coming').waitFor({ timeout: 10000 }).catch(() => {});
  check(`${tag} ${lang}: card opened early says it is coming`, await page.getByTestId('event-coming').isVisible().catch(() => false));
  await wait(400);
  await shot('2-early');
  // The strike, unanswered: the card opens from the deck link.
  await page.evaluate((id) => {
    const s = window.__game.state;
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, activeEventId: `crisis_${id}`, crises: { last: { [id]: s.turnNumber }, lastAny: s.turnNumber, history: [{ id, turn: s.turnNumber, nations: [s.playerNationId, 'x'] }] } } });
  }, CRISIS);
  await page.getByTestId('event-body').waitFor({ timeout: 10000 }).catch(() => {});
  await wait(500);
  check(`${tag} ${lang}: card at the strike, no coming line`, (await page.getByTestId('event-body').isVisible().catch(() => false)) && !(await page.getByTestId('event-coming').isVisible().catch(() => false)));
  await shot('3-strike');
  // The log: its years through formatYear (en "c. 5000 BCE", he "כ־5000 לפנה״ס").
  await page.evaluate(() => window.__game.dispatch({ type: 'RESOLVE_EVENT', payload: { optionIndex: 0 } }));
  await wait(800);
  await click(page.getByRole('button', { name: /advisor choose|היועץ שלי יבחר/ }).first()).catch(() => {}); await wait(600); // the research card waits for a pick
  await click(page.getByRole('button', { name: /^(Open event log|פתיחת יומן האירועים)$/ }).first()).catch(() => {});
  await wait(800);
  await shot('4-log');
  const text = await page.locator('body').innerText();
  check(`${tag} ${lang}: no raw placeholder or NaN`, !/\{\w+\}|NaN/.test(text));
  check(`${tag} ${lang}: no page errors`, errors.length === 0);
  if (errors[0]) console.log(errors[0]);
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, headless: true });
for (const lang of ['en', 'he']) {
  await run(browser, 'phone', { width: 844, height: 390 }, lang);
  await run(browser, 'desktop', { width: 1600, height: 900 }, lang);
}
await browser.close();
process.exit(failed ? 1 : 0);
