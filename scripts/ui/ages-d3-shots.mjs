// scripts/ui/ages-d3-shots.mjs
// U60 (eight ages): the World Congress sheet at the phone held sideways (844x390, English and
// Hebrew) and a desktop (1600x900), into plans/game/ages-d3/ as jpg. A Congress takes hundreds of
// turns to meet, so the state is set through the dev-only window.__game hook with LOAD_GAME (as
// panels-shots.mjs does). Prints the checks and the page errors; exits 1 when a check fails.
//   npx vite --port 5241, then: node scripts/ui/ages-d3-shots.mjs [--url http://localhost:5241/terra-imperium/]
import { launchBrowser } from '../lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5241/terra-imperium/');
const CHROME = arg('--chrome', ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
const OUT = path.resolve('plans/game/ages-d3');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`); };

// Six AI majors and the player sit; sanctions are proposed, one set is in force, two votes are on record.
const CONGRESS = () => {
  const s = window.__game.state;
  const me = s.playerNationId; const T = 'governance_global_institutions';
  const ids = Object.keys(s.nations).sort().filter((id) => id !== me && s.nations[id].people && s.nations[id].kind !== 'independent').slice(0, 6);
  const nations = { ...s.nations };
  // At turn 1 the AI bands have not settled yet and read as eliminated: the fixture seats six of them.
  ids.forEach((id) => { nations[id] = { ...nations[id], isEliminated: false, tech: { ...(nations[id].tech || {}), researched: [...(nations[id].tech?.researched || []), T] } }; });
  const t = 31; // a Congress that has met a while: two votes on record
  window.__game.dispatch({ type: 'LOAD_GAME', payload: {
    ...s, turnNumber: t, nations, techTree: { ...s.techTree, [T]: { ...s.techTree[T], researched: true } },
    worldCongress: { hostId: ids[0], nextVoteTurn: t + 4, proposal: { id: 'sanctions', targetId: ids[2] }, playerVote: 'yes', votes: 2,
      sanctions: [{ targetId: ids[3], signers: [ids[0], ids[1], me], untilTurn: t + 20 }],
      record: [{ turn: t - 20, id: 'tradeStandard', passed: true, yes: 5, no: 2 }, { turn: t - 10, id: 'armsLimit', passed: false, yes: 3, no: 4 }] }
  } });
  return `${ids.length} AI members`;
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
  if (he) await click(page.getByTestId('lang-he'));
  await page.fill(he ? 'input[aria-label="חיפוש עמים"]' : 'input[aria-label="Search peoples"]', he ? 'אכד' : 'Akkad');
  await click(page.locator('[data-people]').first());
  await page.getByTestId('start-step-ready').dispatchEvent('click');
  await click(page.getByRole('button', { name: he ? /^מתחילים/ : /^Begin as/ }));
  const skip = page.getByRole('button', { name: he ? 'דילוג' : 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await click(skip);
  await page.getByTestId('world-top-bar').waitFor({ timeout: 60000 });
  await wait(2500);
  console.log(name, 'fixture', await page.evaluate(CONGRESS));
  await wait(500);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:open-world-congress')));
  const sheet = page.getByTestId('world-congress-sheet');
  await sheet.waitFor({ timeout: 30000 }).catch(async (e) => { await page.screenshot({ path: path.join(OUT, `${name}-debug.jpg`), type: 'jpeg' }); throw e; });
  await wait(600);
  const panel = await sheet.locator('.sheet-panel').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
  check(`${name}: the sheet fits the screen`, panel.left >= 0 && panel.right <= viewport.width + 0.5 && panel.top >= 0 && panel.bottom <= viewport.height + 0.5, JSON.stringify(panel));
  const voteH = await page.getByTestId('wc-vote-yes').evaluate((el) => el.getBoundingClientRect().height);
  check(`${name}: vote buttons at least 44 px`, voteH >= 44, `${voteH}`);
  await click(page.getByTestId('wc-vote-no'));
  await wait(300);
  check(`${name}: a vote is recorded`, await page.evaluate(() => window.__game.state.worldCongress.playerVote) === 'no');
  await click(page.getByTestId('wc-vote-yes'));
  await wait(300);
  await page.screenshot({ path: path.join(OUT, `${name}-world-congress.jpg`), type: 'jpeg', quality: 80, timeout: 120000 });
  check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
};

const browser = await launchBrowser({ executablePath: CHROME, headless: true });
await run(browser, 'phone', { width: 844, height: 390 }, true);
if (!process.argv.includes('--quick')) await run(browser, 'phone-he', { width: 844, height: 390 }, true, true);
if (!process.argv.includes('--quick')) await run(browser, 'desktop', { width: 1600, height: 900 }, false);
await browser.close();
process.exit(failed ? 1 : 0);
