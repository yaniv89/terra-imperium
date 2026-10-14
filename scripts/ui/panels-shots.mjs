// scripts/ui/panels-shots.mjs
// A real-browser check of lane L4 "Panels" (plans/playtest-audits-lane-briefs.md, CB13) at the
// phone with Safari's bars (844x340), plus screenshots into plans/ui/pa-l4/. Needs a running dev
// server of THIS checkout (`npx vite --port 5197`) and a Chrome; headless. States that take many
// turns to reach are set up through the dev-only window.__game hook with LOAD_GAME, as
// u1b-shots.mjs does. Prints one line per check and exits 1 when one fails.
//   node scripts/ui/panels-shots.mjs [--url http://localhost:5197/terra-imperium/] [--chrome <path>]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5197/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/ui/pa-l4');
fs.mkdirSync(OUT, { recursive: true });
const W = 844; const H = 340;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const box = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) }; });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

const patch = (page, body, mods = []) => page.evaluate(async ({ body, mods }) => {
  const m = {};
  for (const p of mods) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', `return (async () => { ${body} })();`);
  const next = await fn(window.__game.state, m);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, { body, mods });

const shot = async (page, name) => { await wait(500); await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }); };

const TRIBUTE = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const ind = Object.values(s.nations).filter((n) => n.indep && !n.isEliminated && s.regions[n.capitalRegionId]);
  const d = (n) => { const r = s.regions[n.capitalRegionId]; return Math.hypot((r.lat || 0) - (cap.lat || 0), (r.lng || r.lon || 0) - (cap.lng || cap.lon || 0)); };
  const pick = ind.sort((a, b) => d(a) - d(b))[0];
  return { ...s, resources: { ...s.resources, gold: 142 }, tributeDemands: [{ id: 'td_l4', indepId: pick.id, gold: 4, turns: 15, turn: s.turnNumber, expires: s.turnNumber + 3 }] };`;
const EVENT = `
  return { ...s, activeProceduralEvent: { id: 'ev_l4', title: 'A dispute over the canal', year: s.year, description: 'Two villages quarrel over who may open the sluice in the dry months. The elders ask you to rule, and neither side will be pleased with half an answer.',
    options: [{ label: 'Rule for the upstream village', effects: { gold: 10 } }, { label: 'Rule for the downstream village', effects: { gold: 5 } }, { label: 'Dig a second canal', effects: { gold: -20 } }] } };`;
const IDLE = `
  const me = s.playerNationId; const cap = s.regions[s.nations[me].capitalRegionId];
  const field = cap.tiles.filter((t) => t !== cap.tile).slice(0, 3);
  const u = (id, tile) => ({ id, ownerId: me, regionId: cap.id, homeRegionId: cap.id, tile, domain: 'land', classId: 'infantry', strength: 80, maxStrength: 100, morale: 100, movesLeft: 2, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  const units = { ...s.units }; field.forEach((t, i) => { units['idle' + i] = u('idle' + i, t); });
  return { ...s, units };`;

const main = async () => {
  const browser = await launchBrowser({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL_BASE);
  await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: /^Begin as/ }));
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  check('layout is phone-landscape', await page.evaluate(() => document.documentElement.dataset.layout) === 'phone-landscape');

  // The research choice is a card: opening the dock sets it aside, closing the dock brings it back.
  const research = page.getByTestId('research-choice');
  const hadResearch = await research.isVisible().catch(() => false);
  const rail = page.getByTestId('landscape-rail');
  const endTurn = page.getByTestId('end-turn');
  const et0 = await box(endTurn);
  await click(rail.getByRole('button', { name: 'Peoples' }));
  await page.getByTestId('landscape-dock').waitFor({ timeout: 10000 });
  await wait(300);
  const et1 = await box(endTurn);
  check('End Turn does not move when the wide dock opens', et0.left === et1.left && et0.top === et1.top, `${JSON.stringify(et0)} -> ${JSON.stringify(et1)}`);
  check('End Turn is on screen, left of the rail', et1.left >= 0 && et1.right <= W - 52 && et1.bottom <= H, JSON.stringify(et1));
  if (hadResearch) check('one thing at a time: the research card is set aside by the dock', !(await research.isVisible().catch(() => false)));
  await shot(page, '01-dock-open');
  // Answer research so it stays out of the way.
  await click(rail.getByRole('button', { name: 'Peoples' }));
  await wait(300);
  if (hadResearch) {
    check('the research card comes back when the dock closes', await research.isVisible().catch(() => false));
    await click(page.getByTestId('research-let-advisor'));
    await wait(300);
  }

  // A tribute demand arrives while the Peoples dock is open: the dock tucks, the card is readable.
  await click(rail.getByRole('button', { name: 'Peoples' }));
  await page.getByTestId('landscape-dock').waitFor({ timeout: 10000 });
  await patch(page, TRIBUTE);
  const tribute = page.getByTestId('tribute-demand-sheet').getByRole('dialog');
  await tribute.waitFor({ timeout: 15000 });
  await wait(300);
  const tb = await box(tribute);
  check('the tribute card is not squeezed beside the dock', tb.width >= 400 && tb.left >= 0 && tb.right <= W, JSON.stringify(tb));
  check('the dock is tucked while the card is up', await page.getByTestId('landscape-dock').count() === 0);
  const et2 = await box(endTurn);
  check('End Turn did not move when the card opened', et2.left === et0.left || et2.right === et0.right, JSON.stringify(et2));
  await shot(page, '02-tribute-over-dock');
  // A tap on the map does not close it.
  await page.touchscreen.tap(120, 250);
  await wait(300);
  check('a tap on the map does not close the decision card', await tribute.isVisible());

  // An event arrives: it takes the screen, the tribute waits as a chip.
  await patch(page, EVENT);
  const eventCard = page.getByTestId('event-sheet').getByRole('dialog');
  await eventCard.waitFor({ timeout: 15000 });
  await wait(300);
  const eb = await box(eventCard);
  check('the event card has a readable width', eb.width >= 480, JSON.stringify(eb));
  check('the tribute card waits as a chip', await page.getByTestId('tribute-chip').count() === 1 && !(await tribute.isVisible().catch(() => false)));
  // Measured against the card's own scroll area, not the viewport: an option under the fold of the
  // scroll area is not on screen even when its box is inside the window.
  const opts = await page.getByTestId('event-options').locator('button').all();
  const area = await box(page.getByTestId('event-body'));
  let allIn = opts.length === 3;
  const boxes = [];
  for (const o of opts) { const b = await box(o); boxes.push(`${b.top}-${b.bottom}`); if (b.bottom > area.bottom || b.top < area.top) allIn = false; }
  check('every event option is inside the card\'s scroll area at 844x340, no scrolling', allIn, `area ${area.top}-${area.bottom}, options ${boxes.join(' ')}`);
  await shot(page, '03-event-first');
  await click(page.getByTestId('event-option-0'));
  await wait(500);
  check('answering the event brings the tribute card back', await tribute.isVisible().catch(() => false));
  await click(page.getByTestId('tribute-demand-sheet').getByRole('button', { name: 'Decide later' }));
  await wait(400);
  check('closing the card gives the dock back', await page.getByTestId('landscape-dock').count() === 1);
  await click(rail.getByRole('button', { name: 'Peoples' }));

  // One Idle N chip that cycles.
  await patch(page, IDLE);
  const idle = page.getByTestId('idle-chip');
  await idle.waitFor({ timeout: 10000 });
  check('one stacked idle chip', (await idle.count()) === 1 && /Idle 3/.test(await idle.textContent()), await idle.textContent());
  const ib = await box(idle); const eb2 = await box(endTurn);
  check('the idle chip sits beside End Turn, on screen', ib.right <= eb2.left && ib.left >= 0 && Math.abs(ib.bottom - eb2.bottom) <= 2, `${JSON.stringify(ib)} ${JSON.stringify(eb2)}`);
  // Each tap selects the next idle stack: three taps, three different army cards, and the chip is
  // never under the card.
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    await idle.tap();
    await wait(600);
    seen.push(await page.getByTestId('army-where').first().textContent({ timeout: 2000 }).catch(() => ''));
  }
  check('three taps on the idle chip open an army card each time, more than one place', seen.every(Boolean) && new Set(seen).size >= 2, seen.join(' ; '));
  check('the idle chip still reads Idle 3 after three taps', /Idle 3/.test(await idle.textContent()));
  await shot(page, '04-idle-chip');

  // The gold popover's stores carry names.
  await click(page.getByTestId('top-bar-gold'));
  const reasons = page.getByTestId('top-bar-reasons');
  await reasons.waitFor({ timeout: 5000 });
  const text = await reasons.textContent();
  check('the stores in the gold popover are labelled', /ADM/.test(text) && /Gold/.test(text) && /Military Strength/.test(text));
  await shot(page, '05-gold-popover');
  // Opening a panel closes the popover.
  await click(rail.getByRole('button', { name: 'Cities' }));
  await wait(300);
  check('opening a panel closes the popover', await reasons.count() === 0);

  // The Cities list opens the city (the camera move is the turn report's own focusPlace path; this
  // script has no way to read the camera, so look at the screenshot).
  await click(page.getByTestId('city-rail-row').first());
  await wait(900);
  await shot(page, '06-city-from-list');
  await click(rail.getByRole('button', { name: 'Cities' }));

  // The era banner hides after five seconds even when a turn ends inside them.
  await patch(page, `const ids = Object.keys(m.AGES); const next = ids[ids.indexOf(s.age) + 1]; return { ...s, age: next, turnNumber: s.turnNumber + 1 };`, ['data/ages.js']);
  const banner = page.getByTestId('age-banner');
  await banner.waitFor({ timeout: 5000 });
  // Its entry animation starts 16 px higher (headless Chrome can hold that first frame): even
  // there it must be clear of the bar.
  const bb = await box(banner);
  const hb = await box(page.getByTestId('world-top-bar'));
  const rest = await banner.evaluate((el) => parseFloat(getComputedStyle(el).top));
  check('the era banner is below the top bar, also at the start of its slide', bb.top >= hb.bottom && rest >= hb.bottom + 16, `rests at ${rest}, drawn at ${bb.top}, bar ends at ${hb.bottom}`);
  await patch(page, 'return { ...s, turnNumber: s.turnNumber + 1 };');
  await wait(5200);
  check('the era banner hides by itself although a turn passed', await banner.count() === 0);

  // New game asks in the game's own dialog.
  let nativeDialog = false;
  page.on('dialog', (d) => { nativeDialog = true; d.dismiss(); });
  await click(rail.getByRole('button', { name: /Open the menu/ }));
  await click(page.getByRole('button', { name: 'New game' }));
  const confirm = page.getByTestId('new-game-confirm');
  await confirm.waitFor({ timeout: 5000 });
  await shot(page, '07-new-game-confirm');
  await page.touchscreen.tap(40, 300);
  await wait(200);
  check('New game: an in-game dialog, no browser confirm, a tap outside does not answer it', !nativeDialog && await confirm.isVisible());
  await click(page.getByTestId('new-game-confirm-cancel'));
  await wait(200);
  check('Keep playing returns to the game', await confirm.count() === 0 && await page.getByTestId('world-top-bar').isVisible());

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth) <= W);

  // A laptop keeps its panels beside the cards (the one-card rule is for phones and tablets).
  await page.setViewportSize({ width: 1280, height: 800 });
  await wait(800);
  check('layout is desktop at 1280x800', await page.evaluate(() => document.documentElement.dataset.layout) === 'desktop');
  await click(rail.getByRole('button', { name: 'Peoples' }));
  await page.getByTestId('landscape-dock').waitFor({ timeout: 10000 });
  await patch(page, TRIBUTE.replace('td_l4', 'td_l4b'));
  await page.getByTestId('tribute-demand-sheet').getByRole('dialog').waitFor({ timeout: 15000 });
  await wait(300);
  check('desktop: the dock stays open beside the tribute card', await page.getByTestId('landscape-dock').count() === 1);
  await shot(page, '09-desktop-dock-and-card');
  await browser.close();
  process.exit(failed ? 1 : 0);
};

main().catch((e) => { console.error(e); process.exit(1); });
