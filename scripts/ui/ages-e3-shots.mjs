// scripts/ui/ages-e3-shots.mjs
// U74 (eight ages): the Future screens on a real browser at 844x390 and 1600x900, English and Hebrew,
// into plans/game/ages-e3/ as jpg: the uprising chip opening the Domestic panel's automation box,
// the Planetary Council sheet, the city build list's robot rows and the army sheet's robot row.
// The state is a Future player with the robot techs, set through the dev-only window.__game hook.
// Prints the checks and the page errors; exits 1 when a check fails.
//   npx vite --port 5263, then: node scripts/ui/ages-e3-shots.mjs [--url http://localhost:5263/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { foundFirstCity } from '../../e2e/startHelpers.js';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5263/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/game/ages-e3');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

// A Future player with the robot techs, a robot in the capital, automation high and stability low (the
// uprising warning), Future Tech taken twice, and a Planetary Council in session hosted by the player.
const FUTURE = async () => {
  const { withAgesResearched, withTechsResearched } = await import('/terra-imperium/src/engine/research.js');
  const { ROBOT_TECH } = await import('/terra-imperium/src/data/unitClasses.js');
  let s = window.__game.state;
  const me = s.playerNationId;
  s = withTechsResearched(withAgesResearched(s, me, 'future'), me, [ROBOT_TECH, 'science_machine_consciousness', 'economy_automated_industry', 'governance_global_institutions', 'governance_planetary_federation']);
  const capId = s.nations[me].capitalRegionId;
  const unit = Object.values(s.units).find((u) => u.ownerId === me && u.domain === 'land' && u.regionId === capId);
  const ids = Object.keys(s.nations).sort().filter((id) => id !== me && s.nations[id].people && s.nations[id].kind !== 'independent').slice(0, 5);
  const nations = { ...s.nations, [me]: { ...s.nations[me], automation: 70, stability: -2, uprisingWarning: { since: 30, at: 34 } } };
  ids.forEach((id) => { nations[id] = { ...nations[id], isEliminated: false }; });
  const t = 31;
  window.__game.dispatch({ type: 'LOAD_GAME', payload: {
    ...s, turnNumber: t, nations,
    units: unit ? { ...s.units, [unit.id]: { ...unit, robot: true, classId: 'infantry' } } : s.units,
    research: { ...s.research, futureTechs: 2 },
    worldCongress: { hostId: me, nextVoteTurn: t + 4, proposal: { id: 'weaponsBan' }, votes: 2,
      binds: [{ id: 'orbitalDemilitarisation', nationId: me, untilTurn: t + 12 }],
      record: [{ turn: t - 10, id: 'orbitalDemilitarisation', passed: true, yes: 5, no: 1 }] }
  } });
  return { capId, tile: s.regions[capId].tile, robot: !!unit };
};

const run = async (browser, name, viewport, mobile, he = false) => {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  await foundFirstCity(page); // a Stone start has no city yet
  await page.keyboard.press('Escape');
  if (he) await page.evaluate(async () => (await import('/terra-imperium/src/i18n/index.js')).setLanguage('he'));
  await wait(800);
  const fx = await page.evaluate(FUTURE);
  check(`${name}: fixture has a robot`, fx.robot);
  await wait(1200);
  const shot = (what) => page.screenshot({ path: path.join(OUT, `${name}-${what}.jpg`), type: 'jpeg', quality: 80, timeout: 120000 });
  const inView = async (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5 && r.left >= 0 && r.right <= window.innerWidth + 0.5; }).catch(() => false);

  // 1. The uprising chip opens the Domestic panel's Court with the automation box.
  const chip = page.getByText(he ? /הרובוטים יתקוממו/ : /Robots rise/).first();
  check(`${name}: uprising chip shows`, await chip.isVisible().catch(() => false));
  await click(chip);
  const box = page.getByTestId('automation');
  await box.waitFor({ timeout: 15000 }).catch(() => {});
  await wait(900);
  check(`${name}: automation box opens from the chip`, await box.isVisible().catch(() => false));
  check(`${name}: the uprising warning line is shown`, await page.getByTestId('automation-warning').isVisible().catch(() => false));
  await box.scrollIntoViewIfNeeded().catch(() => {});
  check(`${name}: automation box fits the screen`, await inView(box));
  await shot('automation');
  await page.keyboard.press('Escape');
  await wait(500);

  // 2. The Planetary Council sheet.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-world-congress')));
  const sheet = page.getByTestId('world-congress-sheet');
  await sheet.waitFor({ timeout: 20000 }).catch(() => {});
  await wait(700);
  check(`${name}: Council sheet opens`, await sheet.isVisible().catch(() => false));
  const panel = await sheet.locator('.sheet-panel').evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }).catch(() => null);
  check(`${name}: Council sheet fits`, !!panel && panel.l >= 0 && panel.r <= viewport.width + 0.5 && panel.t >= 0 && panel.b <= viewport.height + 0.5, JSON.stringify(panel));
  const text = await sheet.innerText().catch(() => '');
  check(`${name}: it is the Planetary Council`, he ? /פלנטרית|פלנטרי/.test(text) : /Planetary Council/.test(text), text.slice(0, 80).replace(/\n/g, ' '));
  await shot('council');
  await page.keyboard.press('Escape');
  await sheet.locator('button[aria-label]').first().dispatchEvent('click').catch(() => {});
  await wait(600);

  // 3. The capital's build list: robot rows.
  await page.evaluate(async (capId) => { const { manageCity } = await import('/terra-imperium/src/components/map/marchEvents.js'); manageCity(capId, 'build'); }, fx.capId);
  await wait(1800);
  const robotRow = page.getByText(he ? /רובוט:/ : /A robot: no manpower/).first();
  await robotRow.scrollIntoViewIfNeeded().catch(() => {});
  await wait(400);
  check(`${name}: build list has robot rows`, await robotRow.isVisible().catch(() => false));
  check(`${name}: robot row fits the screen`, await inView(robotRow));
  await shot('build-robots');
  await page.keyboard.press('Escape');
  await wait(600);

  // 4. The army sheet on the capital: the robot row says it has no morale.
  await page.evaluate(async (tile) => { const { selectArmy } = await import('/terra-imperium/src/components/map/marchEvents.js'); selectArmy(tile); }, fx.tile);
  await wait(1500);
  const robotStats = page.getByText(he ? /רובוט, בלי מורל/ : /robot, no morale/).first();
  await robotStats.scrollIntoViewIfNeeded().catch(() => {});
  check(`${name}: army sheet marks the robot`, await robotStats.isVisible().catch(() => false));
  await shot('army-robot');

  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', { width: 844, height: 390 }, true);
await run(browser, 'phone-he', { width: 844, height: 390 }, true, true);
await run(browser, 'desktop', { width: 1600, height: 900 }, false);
await run(browser, 'desktop-he', { width: 1600, height: 900 }, false, true);
await browser.close();
process.exit(failed ? 1 : 0);
