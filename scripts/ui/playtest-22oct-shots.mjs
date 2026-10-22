// scripts/ui/playtest-22oct-shots.mjs
// Real-browser check of the 22 Oct playtest fixes at 844x390 and 1600x900, English and Hebrew:
// Stone Age trade is blocked and says why, a gift takes its gold, an improvement that replaces
// another warns and asks first, and the "needs you" chips. Small jpgs into audits/user-playtest-22oct/.
//   node scripts/ui/playtest-22oct-shots.mjs [--url http://localhost:5287/terra-imperium/] [--only gift]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5287/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('audits/user-playtest-22oct');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const start = async (browser, viewport) => {
  const phone = viewport.width < 900;
  const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
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
  // Found the village; retried, since the first dispatch can land before the world is ready.
  for (let i = 0; i < 20; i++) {
    const owned = await page.evaluate(() => {
      const g = window.__game; const me = g.state.playerNationId;
      if (Object.values(g.state.regions).some((c) => c.owner === me)) return true;
      const band = Object.values(g.state.units).find((u) => u.ownerId === me && (u.classId === 'settler' || u.classId === 'band'));
      if (band) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
      return false;
    });
    if (owned) break;
    await wait(1000);
  }
  await wait(500);
  // Every major met, gold to spend.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const others = Object.keys(s.nations).filter((id) => id !== me && !s.nations[id].isEliminated && s.nations[id].kind !== 'independent');
    const met = { ...(s.fog?.met?.[me] || {}), ...Object.fromEntries(others.map((id) => [id, 1])) };
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, resources: { ...s.resources, gold: 1000 }, fog: s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: met } } : s.fog } });
  });
  await wait(500);
  return { ctx, page, errors, phone };
};

const gold = (page) => page.evaluate(() => window.__game.state.resources.gold);

const run = async (browser, viewport, lang) => {
  const tag = `${viewport.width}x${viewport.height}-${lang}`;
  const { ctx, page, errors, phone } = await start(browser, viewport);
  const shot = (name) => page.screenshot({ path: path.join(OUT, `${tag}-${name}.jpg`), type: 'jpeg', quality: 60 });
  const rail = page.getByTestId('landscape-rail');
  const railBtn = (en, he) => (phone ? rail : page).getByRole('button', { name: en === 'Menu' ? /menu|תפריט/i : new RegExp(`^(${en}|${he})$`) }).first();
  if (lang === 'he') {
    await click(railBtn('Menu', 'תפריט'));
    await click(page.getByTestId('menu-settings'));
    await page.getByTestId('settings-sheet').waitFor({ timeout: 10000 });
    await click(page.getByTestId('settings-language').getByTestId('lang-he'));
    await wait(600);
    for (let i = 0; i < 3 && await page.getByTestId('settings-sheet').isVisible().catch(() => false); i++) { await page.keyboard.press('Escape'); await wait(300); }
    if (await page.getByTestId('settings-sheet').isVisible().catch(() => false)) await click(page.getByTestId('settings-sheet').getByRole('button', { name: /close|סגירה/i }).first());
    await wait(400);
  }
  // 4. The "needs you" chips: ruler points, an empty governor seat, a full decree bank. Open each.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId; const n = s.nations[me];
    const cands = n.governorCandidates?.length ? n.governorCandidates : [{ id: 'gov_test_0', name: 'Ur-Nammu', skill: 2 }];
    // Research chosen and the city busy, so the new chips are the ones in view.
    const regions = Object.fromEntries(Object.entries(s.regions).map(([id, c]) => [id, c.owner === me ? { ...c, production: { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 } } : c]));
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, regions, research: { ...s.research, auto: true }, nations: { ...s.nations, [me]: { ...n, governors: {}, governorCandidates: cands, ruler: { ...n.ruler, decrees: 99 } } } } });
  });
  await wait(600);
  const chips = page.getByTestId('next-prompt').getByRole('button');
  const chipText = (await chips.allTextContents()).join(' | ');
  check(`${tag} the new reminders show as chips`, lang === 'he' ? /שליט/.test(chipText) && /מושל/.test(chipText) : /Ruler/.test(chipText) && /governor/.test(chipText), chipText);
  await shot('chips');
  await click(chips.filter({ hasText: /Ruler|שליט/ }).first());
  await wait(700);
  check(`${tag} the ruler chip opens the Ruler sheet`, await page.getByTestId('ruler-sheet').isVisible().catch(() => false));
  await shot('chip-ruler');
  await page.keyboard.press('Escape');
  await wait(400);
  await click(page.getByTestId('next-prompt').getByRole('button').filter({ hasText: /governor|מושל/ }).first());
  await wait(700);
  const seat = page.getByTestId('governors');
  check(`${tag} the governor chip opens the court`, await seat.isVisible().catch(() => false));
  if (await seat.count()) await seat.scrollIntoViewIfNeeded();
  await shot('chip-governor');
  await page.keyboard.press('Escape');
  await wait(400);
  // 1 and 2: a people's card. Trade waits for Bronze; the gift takes its gold.
  await click(railBtn('Peoples', 'עמים'));
  await wait(800);
  await shot('diplomacy');
  const trade = page.getByRole('button', { name: /^(Trade|סחר)/ }).first();
  const before = await gold(page);
  await click(trade);
  await wait(400);
  await shot('trade-blocked');
  check(`${tag} trade is marked blocked`, (await trade.getAttribute('aria-disabled')) === 'true');
  check(`${tag} trade tap says why`, await page.getByTestId('why-tip').isVisible().catch(() => false));
  check(`${tag} trade takes nothing`, (await gold(page)) === before);
  await click(page.getByRole('button', { name: /^(More actions|עוד פעולות)/ }).first());
  await wait(300);
  const g0 = await gold(page);
  await click(page.getByRole('button', { name: /^(Gift|מתנה)/ }).first());
  await wait(500);
  const g1 = await gold(page);
  await shot('gift');
  console.log('topbar', await page.getByTestId('world-top-bar').innerText());
  check(`${tag} gift takes 100 gold`, g0 - g1 === 100, `${g0} -> ${g1}`);
  // An independent's sheet from a city card's owner link (RegionInfoModal) must not offer a major's gift.
  await page.keyboard.press('Escape');
  const indep = await page.evaluate(() => Object.keys(window.__game.state.nations).find((id) => window.__game.state.nations[id].kind === 'independent'));
  await page.evaluate((id) => { const s = window.__game.state; const me = s.playerNationId; window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, fog: { ...s.fog, met: { ...s.fog.met, [me]: { ...s.fog.met[me], [id]: 1 } } } } }); }, indep);
  await wait(300);
  await page.evaluate((id) => window.dispatchEvent(new CustomEvent('ti:select-nation', { detail: id })), indep);
  await wait(700);
  await shot('independent-sheet');
  check(`${tag} an independent opens its own sheet`, await page.getByTestId('indep-name').isVisible().catch(() => false));
  check(`${tag} no major's card for an independent`, !(await page.getByTestId('nation-sheet').count()));
  await click(page.getByTestId('independent-sheet').getByRole('button', { name: /close|סגירה/i }).first()).catch(() => {});
  await page.keyboard.press('Escape');
  // 3. A farm on a tile of the capital: the build list warns on what would replace it, and asks first.
  await page.evaluate(() => {
    const s = window.__game.state; const me = s.playerNationId;
    const cap = Object.values(s.regions).find((c) => c.owner === me);
    const tile = cap.tiles.find((t) => t !== cap.tile);
    window.__game.dispatch({ type: 'LOAD_GAME', payload: { ...s, world: { ...s.world, tileState: { ...s.world.tileState, [tile]: { ...(s.world.tileState[tile] || {}), improvement: 'farm' } } } } });
  });
  await wait(400);
  await click(railBtn('Cities', 'ערים'));
  await wait(400);
  await click(page.getByTestId('city-rail-row').first());
  await wait(900);
  const openSheet = page.getByTestId('open-city-sheet');
  if (await openSheet.count()) { await click(openSheet); await wait(700); }
  const buildTab = page.getByTestId('city-tab-build');
  if (await buildTab.count()) await click(buildTab);
  await wait(500);
  const warn = page.getByTestId('build-replaces').first();
  check(`${tag} a row that replaces the farm says so`, await warn.count() > 0, await warn.textContent().catch(() => ''));
  if (await warn.count()) {
    await warn.scrollIntoViewIfNeeded();
    await shot('replace-row');
    const row = page.locator('[data-testid="build-row"]', { has: page.getByTestId('build-replaces') }).first();
    const queueBefore = await page.evaluate(() => { const s = window.__game.state; const cap = Object.values(s.regions).find((c) => c.owner === s.playerNationId); return [cap.production?.current, ...(cap.production?.queue || [])].filter(Boolean).length; });
    await click(row.getByTestId('queue-item'));
    await wait(400);
    const dialog = page.getByTestId('confirm-action-dialog');
    check(`${tag} replacing asks first`, await dialog.count() > 0, (await dialog.textContent().catch(() => '')).slice(0, 120));
    await shot('replace-confirm');
    const queueMid = await page.evaluate(() => { const s = window.__game.state; const cap = Object.values(s.regions).find((c) => c.owner === s.playerNationId); return [cap.production?.current, ...(cap.production?.queue || [])].filter(Boolean).length; });
    check(`${tag} nothing queued before the answer`, queueMid === queueBefore);
    if (await dialog.count()) {
      await click(page.getByTestId('confirm-action-ok'));
      await wait(400);
      const queueAfter = await page.evaluate(() => { const s = window.__game.state; const cap = Object.values(s.regions).find((c) => c.owner === s.playerNationId); return [cap.production?.current, ...(cap.production?.queue || [])].filter(Boolean).length; });
      check(`${tag} the answer queues it`, queueAfter === queueBefore + 1);
    }
  }
  await page.keyboard.press('Escape');
  await wait(300);
  check(`${tag} no page errors`, !errors.length, errors.join('; '));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME });
for (const [vp, lang] of [[{ width: 844, height: 390 }, 'en'], [{ width: 844, height: 390 }, 'he'], [{ width: 1600, height: 900 }, 'en'], [{ width: 1600, height: 900 }, 'he']]) await run(browser, vp, lang);
await browser.close();
process.exit(failed ? 1 : 0);
