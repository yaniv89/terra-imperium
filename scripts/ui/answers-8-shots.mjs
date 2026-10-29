// scripts/ui/answers-8-shots.mjs
// Shots and checks of lane answers-8 (plans/lanes/answers-8-REPORT.md) on the classical era save
// (Israel at war with Akkad), 844x390 (touch, CDP taps and holds) and 1600x900, en and he.
//   npx vite --port 5263 &  node scripts/ui/answers-8-shots.mjs [--url http://localhost:5263/terra-imperium/]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { openGame, loadSlice } from '../ai/human-playtest.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL = arg('--url', 'http://localhost:5263/terra-imperium/');
const OUT = path.resolve('plans/lanes/answers-8-shots');
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { phone: { width: 844, height: 390, mobile: true }, desktop: { width: 1600, height: 900, mobile: false } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const save = { state: readEraSave('classical').state };
const fails = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); if (!ok) fails.push(name); };

const run = async (browser, sizeId, lang) => {
  const size = SIZES[sizeId];
  const tag = `${sizeId}-${lang}`;
  const g = await openGame(browser, { size, lang, url: URL });
  const { page, cdp } = g;
  const press = async (x, y, hold) => (size.mobile
    ? (await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }), await wait(hold), await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }))
    : page.mouse.click(x, y));
  const tap = async (loc, hold = 60) => { const l = loc.first(); if (!(await l.count())) return false; await l.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {}); const b = await l.boundingBox({ timeout: 5000 }).catch(() => null); if (!b) return false; await press(b.x + b.width / 2, b.y + b.height / 2, hold); await wait(900); return true; };
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}-${tag}.jpg`), type: 'jpeg', quality: 70, timeout: 120000 });
  const ev = (name, detail) => page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n, { detail: d })), [name, detail]);
  const shown = (id) => page.getByTestId(id).first().isVisible().catch(() => false);
  const tipText = () => page.getByTestId('why-tip').first().textContent({ timeout: 2000 }).catch(() => '');
  await loadSlice(g, save);
  const dismiss = async () => { for (let i = 0; i < 3; i++) { const b = page.getByRole('button', { name: /Later|Not now|Let my advisor choose|Close|סגירה/ }); if (await b.first().isVisible().catch(() => false)) await b.first().dispatchEvent('click'); await wait(300); } };
  await dismiss();
  await ev('ti:close-panels'); await wait(600);

  // 1. City card peace offer: an Akkad city the player holds, Negotiate, white peace; the answer shows on the card.
  const cityId = await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const war = s.wars.find((w) => w.active && (w.aggressor === me || w.enemy === me));
    const foe = war.aggressor === me ? war.enemy : war.aggressor;
    const c = Object.values(s.regions).find((r) => r.owner === foe && !r.isCapital) || Object.values(s.regions).find((r) => r.owner === foe);
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions: { ...s.regions, [c.id]: { ...c, occupiedBy: me } } } });
    return c.id;
  });
  await wait(1500); await dismiss();
  await ev('ti:select-region', cityId); await wait(1500);
  check(`${tag} city card shows Negotiate`, await shown('open-peace-deal'));
  if (size.mobile) {
    await tap(page.getByTestId('open-peace-deal'), 900);
    check(`${tag} hold Negotiate opens Diplomacy costs`, await shown('glossary-sheet'));
    await shot('1a-hold-negotiate');
    await page.keyboard.press('Escape'); await wait(500);
    if (!(await shown('open-peace-deal'))) { await ev('ti:select-region', cityId); await wait(1200); }
  }
  await tap(page.getByTestId('open-peace-deal'));
  await tap(page.getByTestId('peace-white'));
  await wait(300);
  const answer = await tipText();
  check(`${tag} the city card answers the peace offer`, /peace|שלום/i.test(answer), answer.slice(0, 160));
  await shot('1b-city-peace-answer');
  await ev('ti:close-panels'); await page.keyboard.press('Escape'); await wait(600);

  // 2. The "?" Help view lists the three topic cards; each opens its card.
  for (const id of ['battle', 'ships', 'diplomacy']) {
    await tap(page.getByTestId('top-bar-help'));
    await tap(page.getByTestId(`menu-topic-${id}`));
    const text = await page.getByTestId('glossary-sheet').first().textContent().catch(() => '');
    check(`${tag} topic ${id} opens with see-also and no raw placeholder`, (await shown('glossary-see-also')) && !/\{\w+\}|NaN|undefined/.test(text));
    await shot(`2-topic-${id}`);
    await page.keyboard.press('Escape'); await wait(500);
  }
  await tap(page.getByTestId('top-bar-help'));
  await shot('2-help-view');
  await page.keyboard.press('Escape'); await wait(400);
  await page.context().close();
};

const browser = await launchBrowser({ channel: 'chrome' });
for (const sizeId of arg('--sizes', 'phone,desktop').split(',')) for (const lang of arg('--langs', 'en,he').split(',')) {
  try { await run(browser, sizeId, lang); } catch (e) { check(`${sizeId} ${lang} run`, false, String(e.message).split('\n')[0]); }
}
await browser.close();
console.log(fails.length ? `${fails.length} failed` : 'all checks passed');
process.exitCode = fails.length ? 1 : 0;
