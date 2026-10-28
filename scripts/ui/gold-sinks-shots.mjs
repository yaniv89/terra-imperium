// scripts/ui/gold-sinks-shots.mjs
// Lane gold-sinks: the army sheet's upgrade row with its upkeep line (economy.js unitUpkeepGold) and an
// event card whose gold is scaled to the player's income (applyEventEffects.js scaleEventGold), at
// 844x390 and 1600x900, en and he. Needs a dev server: `npx vite --port 5197`.
//   node scripts/ui/gold-sinks-shots.mjs [--url http://localhost:5197/terra-imperium/] [--out plans/lanes/gold-sinks-shots]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve(arg('--out', 'plans/lanes/gold-sinks-shots'));
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const fire = (page, name, detail) => page.evaluate(({ name, detail }) => window.dispatchEvent(new CustomEvent(name, { detail })), { name, detail });
const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  if (next) window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

let failed = false;
for (const [w, h] of [[844, 390], [1600, 900]]) {
  for (const lang of ['en', 'he']) {
    const id = `${w}x${h}-${lang}`; const phone = w < 1000;
    const browser = await launchBrowser({ executablePath: CHROME, headless: true });
    const page = await (await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(URL_BASE);
    await page.evaluate((l) => { localStorage.clear(); if (l !== 'en') localStorage.setItem('terra-imperium.language', l); }, lang);
    await page.goto(URL_BASE);
    const newGame = page.locator('[data-testid="title-new-game"], button').filter({ hasText: /New game|משחק חדש/ }).first();
    await newGame.waitFor({ timeout: 60000 }).catch(() => {});
    if (await newGame.isVisible().catch(() => false)) await click(newGame);
    await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
    await page.locator('input[type="search"], input').first().fill('Akkad').catch(() => {});
    await click(page.locator('[data-people]').first());
    await click(page.getByTestId('start-step-ready'));
    await click(page.getByTestId('begin-game'));
    await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
    await wait(2000);
    const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
    if (await skip.first().isVisible().catch(() => false)) await click(skip.first());
    const advisor = page.getByTestId('research-let-advisor');
    if (await advisor.isVisible().catch(() => false)) await click(advisor);
    // Found the first village (a Dawn start is a band with a settler).
    const found = page.getByTestId('found-city');
    for (let i = 0; i < 4 && !(await found.isVisible().catch(() => false)); i++) { await click(page.getByTestId('idle-chip')).catch(() => {}); await wait(600); }
    if (await found.isVisible().catch(() => false)) { await click(found); await wait(1500); }
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await wait(150); }
    // A Classical realm: the Stone and Bronze techs known, five big cities, a Stone Age warband at the capital.
    await patch(page, `
      const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
      const techTree = { ...s.techTree }; for (const t of [...m.getTechsForAge('stone'), ...m.getTechsForAge('bronze')]) techTree[t.id] = { ...techTree[t.id], researched: true };
      let st = { ...s, techTree };
      for (let i = 0; i < 4; i++) { try { st = m.addCity(st, me, { near: capId, size: 12 }).state; } catch (e) { /* no room */ } }
      const unit = { id: 'gs_old', ownerId: me, regionId: capId, homeRegionId: capId, tile: cap.tile, domain: 'land', classId: 'infantry', strength: 100, maxStrength: 100, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null, ageId: 'stone' };
      return { ...st, techAgeId: 'classical', units: { ...st.units, gs_old: unit }, resources: { ...st.resources, gold: 6000 } };`, ['engine/testWorld.js', 'data/techTree.js']);
    await wait(1200);
    const tile = await page.evaluate(() => window.__game.state.units.gs_old?.tile);
    await fire(page, 'ti:select-army', tile); await wait(1200);
    const upkeep = page.getByTestId('army-upgrade-upkeep').first();
    await page.getByTestId('army-sheet').locator('.overflow-y-auto').first().evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
    await upkeep.scrollIntoViewIfNeeded().catch(() => {});
    const upkeepText = await upkeep.textContent().catch(() => null);
    await page.screenshot({ path: path.join(OUT, `${id}-army-upgrade.png`) });
    for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await wait(150); }
    await click(page.getByTestId('army-sheet').getByRole('button', { name: /^(Close|סגירה|סגור)$/ }).first()).catch(() => {});
    await fire(page, 'ti:close-panels'); await wait(400);
    // The dock's Buy chip (endTurnModel.js buyHint): first beside Advisor builds and a blocker (the
    // capital builds, the new cities wait), then once the advisor has filled the queues.
    await patch(page, `const me = s.playerNationId; const capId = s.nations[me].capitalRegionId;
      return { ...s, regions: { ...s.regions, [capId]: { ...s.regions[capId], production: { current: { kind: 'unit', classId: 'infantry' }, queue: [], progress: 0 } } } };`);
    await page.getByTestId('dock-buy').waitFor({ timeout: 8000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, `${id}-dock-crowded.png`) });
    await page.evaluate(() => window.__game.dispatch({ type: 'ADVISOR_PRODUCTION' }));
    await wait(1200);
    await page.getByTestId('dock-buy').waitFor({ timeout: 8000 }).catch(() => {});
    const buyText = await page.getByTestId('dock-buy').textContent().catch(() => null);
    await page.screenshot({ path: path.join(OUT, `${id}-dock-buy.png`) });
    if (!buyText) failed = true;
    // An event card with a gold cost and a gold gain, pinned to the capital.
    await patch(page, `
      const card = Object.values(m.CARDS).find((c) => c.options?.some((o) => o.effects?.gold < 0) && c.options.some((o) => o.effects?.gold > 0) && c.kind === 'link');
      const capId = s.nations[s.playerNationId].capitalRegionId;
      return { ...s, activeProceduralEvent: { ...card, year: s.year, cityId: capId, tile: s.regions[capId].tile } };`, ['engine/eventDeck.js']);
    await page.getByTestId('event-sheet').waitFor({ timeout: 15000 }).catch(() => {});
    await wait(800);
    const optionText = await page.getByTestId('event-options').innerText().catch(() => '');
    await page.screenshot({ path: path.join(OUT, `${id}-event.png`) });
    const bad = [...`${upkeepText} ${optionText}`.matchAll(/\{[a-zA-Z_]+\}|\bNaN\b|\bundefined\b/g)].map((x) => x[0]);
    console.log(`${id}: buy "${buyText}" | upkeep "${upkeepText}" | event gold ${(optionText.match(/[-+]?\d[\d,]*\s*(g|זהב|gold)?/g) || []).slice(0, 4).join(' / ')}${errors.length ? ` | ERRORS ${errors.join(' ; ')}` : ''}${bad.length ? ` | BAD ${bad}` : ''}`);
    if (!upkeepText || errors.length || bad.length) failed = true;
    await browser.close();
  }
}
process.exit(failed ? 1 : 0);
