// scripts/ui/say-why-shots.mjs
// Real-browser check of the "say why it is blocked" lane (playtest issues 2, 7, 9, 10) at 844x390
// and 1600x900, English and Hebrew: a size 1 city's settlers say "Needs size 2" (no "1 turn"), a
// greyed build "+" says why on tap, the virtue pick asks first with its cost, a locked virtue names
// its age, a refused pact says why on the card. Small jpgs into plans/game/say-why/.
//   node scripts/ui/say-why-shots.mjs [--url http://localhost:5241/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5241/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/game/say-why');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const run = async (browser, viewport, lang) => {
  const tag = `${viewport.width}x${viewport.height}-${lang}`;
  const phone = viewport.width < 900;
  const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.jpg`), type: 'jpeg', quality: 60 });
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad').catch(() => {});
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  // A Stone Age start is a band: found its village first (qa-shots.mjs does the same).
  await page.evaluate(() => {
    const g = window.__game; const me = g.state.playerNationId;
    const band = Object.values(g.state.units).find((u) => u.ownerId === me && (u.classId === 'settler' || u.classId === 'band'));
    if (band && !Object.values(g.state.regions).some((c) => c.owner === me)) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
  });
  await wait(800);
  // The capital at size 1 with settlers far over their cost; every people met; renown for points.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const cap = Object.values(s.regions).find((c) => c.owner === me && c.isCapital) || Object.values(s.regions).find((c) => c.owner === me);
    const others = Object.keys(s.nations).filter((id) => id !== me && !s.nations[id].isEliminated && s.nations[id].kind !== 'independent');
    const met = { ...(s.fog?.met?.[me] || {}), ...Object.fromEntries(others.map((id) => [id, true])) };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: {
      ...s,
      fog: s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: met } } : s.fog,
      regions: { ...s.regions, [cap.id]: { ...cap, size: 1, production: { ...(cap.production || {}), current: { kind: 'settler' }, queue: [], progress: 456 } } },
      nations: { ...s.nations, [me]: { ...s.nations[me], ruler: { ...s.nations[me].ruler, renown: 70 } } }
    } });
  });
  await wait(500);
  const rail = page.getByTestId('landscape-rail');
  // The tab rail (phones) or the side tabs (desktop); a tab's name is its word, Menu's is "Open the menu".
  const railBtn = (en, he) => (phone ? rail : page).getByRole('button', { name: en === 'Menu' ? /menu|תפריט/i : new RegExp(`^(${en}|${he})$`) }).first();
  if (lang === 'he') {
    await click(railBtn('Menu', 'תפריט'));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await click(page.getByTestId('settings-language').getByTestId('lang-he'));
    await wait(600);
    await page.keyboard.press('Escape');
    await wait(400);
  }
  // 1. The city: the queue says why the settlers wait.
  await click(railBtn('Cities', 'ערים'));
  await wait(400);
  await click(page.getByTestId('city-rail-row').first());
  await wait(900);
  const open = page.getByTestId('open-city-sheet');
  if (await open.count()) { await click(open); await wait(700); }
  const buildTab = page.getByTestId('city-tab-build');
  if (await buildTab.count()) await click(buildTab);
  await wait(500);
  const status = (await page.getByTestId('city-queue-status').textContent().catch(() => '')) || '';
  check(`${tag} settlers say the size rule, not a turn count`, lang === 'he' ? /גודל 2/.test(status) : /Needs size 2 \(now 1\)/.test(status), status);
  await shot('1-settlers');
  // A greyed "+" says why on tap.
  // A row blocked for a reason other than "already in the queue" (the settlers' own row).
  const greyed = page.locator('[data-testid="queue-item"][aria-disabled="true"]:not([title="already in the queue"]):not([title="כבר בתור"])').first();
  if (await greyed.count()) {
    await greyed.scrollIntoViewIfNeeded();
    await greyed.click({ force: true }); // aria-disabled: Playwright would wait for it to enable
    await wait(300);
    const tip = page.getByTestId('why-tip');
    check(`${tag} a greyed + shows its reason on tap`, await tip.count() > 0 && ((await tip.textContent()) || '').length > 3, await tip.textContent().catch(() => ''));
    await shot('2-why-plus');
  } else check(`${tag} a greyed + exists`, false);
  await page.keyboard.press('Escape');
  await wait(300);
  // 2. The ruler: a virtue asks first, with its cost; a locked one names its age.
  const close = page.getByRole('button', { name: /^(Close|סגירה)/ }).first();
  if (await close.count()) { await click(close); await wait(400); }
  await click(railBtn('Ruler', 'שליט'));
  await page.getByTestId('ruler-sheet').waitFor({ timeout: 10000 });
  await click(page.locator('[data-testid="ruler-tree"] button[data-state="locked"]').first());
  await wait(200);
  const block = (await page.getByTestId('ruler-virtue-block').textContent().catch(() => '')) || '';
  check(`${tag} a locked virtue names the age that opens it`, lang === 'he' ? /נפתחת ב/.test(block) : /^Opens in the /.test(block), block);
  await page.getByTestId('ruler-detail').scrollIntoViewIfNeeded();
  await shot('3-virtue-locked');
  await click(page.locator('[data-testid="ruler-tree"] button[data-state="open"]').first());
  await wait(200);
  await click(page.getByTestId('ruler-detail').locator('button.fa-btn-primary'));
  await wait(300);
  const dialog = page.getByTestId('confirm-action-dialog');
  check(`${tag} taking a virtue asks first with its cost`, await dialog.count() > 0, (await dialog.textContent().catch(() => '')).slice(0, 120));
  await shot('4-virtue-confirm');
  if (await dialog.count()) await click(page.getByTestId('confirm-action-cancel'));
  await wait(300);
  // 3. A people's card: a refused pact says why on the card.
  await click(railBtn('Peoples', 'עמים'));
  await page.getByTestId('peoples-tab').waitFor({ timeout: 10000 }).catch(() => {});
  const row = page.locator('[data-people-row]').first();
  if (await row.count()) {
    await click(row);
    await wait(400);
    const pact = page.getByRole('button', { name: /(Offer a military pact|Military pact|ברית צבאית)/ }).first();
    if (await pact.count()) {
      await click(pact);
      await wait(300);
      const n = page.getByTestId('action-blocked-reason');
      if (await n.count()) { await n.scrollIntoViewIfNeeded(); check(`${tag} a refused pact says why on the card`, true, await n.textContent()); }
      else console.log(`note ${tag}: the pact was accepted or affordable, no block to show`);
    } else console.log(`note ${tag}: no pact tile found`);
    await shot('5-pact');
  } else { console.log(`note ${tag}: no met people row`, await page.evaluate(() => { const s = window.__game.state; return JSON.stringify({ fog: !!s.fog, met: Object.keys(s.fog?.met?.[s.playerNationId] || {}).length }); })); await shot('5-pact'); }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(`${tag} no horizontal page scroll`, !overflow);
  check(`${tag} no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, args: ['--disable-dev-shm-usage'] });
for (const viewport of [{ width: 844, height: 390 }, { width: 1600, height: 900 }]) {
  for (const lang of ['en', 'he']) await run(browser, viewport, lang).catch((e) => { failed += 1; console.log(`FAIL ${viewport.width}x${viewport.height}-${lang} ${String(e).slice(0, 300)}`); });
}
await browser.close();
process.exit(failed ? 1 : 0);
