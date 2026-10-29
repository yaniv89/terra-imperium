// .claude/skills/battle-lab/risk-tap.mjs
// The pre-battle card's "Command anyway" (lane battle-hud-9, WM fix 5) in a real browser: a war, a walled
// enemy city beside the capital held by far more men than you bring, a spy report (exact odds), then on the
// card: Command, one tap on Begin battle (it turns into "Command anyway: Hopeless"), 3 s later it is back,
// two taps open the battle. Prints each step and shoots the card. Dev server first (npx vite --port 5231).
//   CHROMIUM=<browser exe> node .claude/skills/battle-lab/risk-tap.mjs <outDir> [--lang he] [--w 844 --h 390]
import { launchBrowser } from '../../../scripts/lib/browserLaunch.mjs';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const outDir = argv[0] && !argv[0].startsWith('--') ? argv.shift() : '.';
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const W = Number(opt('w', 844)); const H = Number(opt('h', 390)); const lang = opt('lang', 'en');
const BASE = process.env.URL || 'http://localhost:5231/terra-imperium/';
fs.mkdirSync(outDir, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');

const browser = await launchBrowser({ headless: true, executablePath: process.env.CHROMIUM || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: process.env.TOUCH ? process.env.TOUCH === '1' : W < 1000, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { window.__E2E_MAP_TEST__ = true; });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.locator('[data-people]').first().waitFor({ timeout: 120000 });
await page.fill('input[aria-label="Search peoples"]', 'Akkad');
await click(page.locator('[data-people]').first());
await page.getByTestId('start-step-ready').dispatchEvent('click');
await click(page.getByRole('button', { name: /^Begin as/ }));
await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
await wait(2500);
// A Dawn start holds a band: found its village first, as a player's first tap does.
await page.evaluate(() => { const g = window.__game; const band = Object.values(g.state.units).find((x) => x.ownerId === g.state.playerNationId && x.classId === 'settler'); if (band) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } }); });
await wait(1500);
// A war, a city of theirs beside the capital with 2,000 men in it, a spy report on them.
await page.evaluate(async (lang) => {
  const m = await import('/terra-imperium/src/engine/testWorld.js');
  let s = window.__game.state;
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId || Object.keys(s.regions).find((id) => s.regions[id].owner === me); const cap = s.regions[capId];
  const foe = Object.values(s.nations).find((n) => n.id !== me && n.kind !== 'independent');
  const war = { id: 'war_risk', aggressor: me, enemy: foe.id, active: true, startYear: s.year - 9, startTurn: Math.max(1, s.turnNumber - 9), cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: null };
  const u = (id, owner, regionId, tile, classId, strength) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: strength, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, target: null });
  s = { ...s, units: { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.ownerId !== me || x.classId === 'settler')), g1: u('g1', me, capId, cap.tile, 'infantry', 60) },
    nations: { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe.id]: { ...s.nations[foe.id], isAtWar: true } },
    fog: s.fog ? { ...s.fog, met: { ...s.fog.met, [me]: { ...(s.fog.met?.[me] || {}), [foe.id]: 1 } } } : s.fog,
    wars: [...s.wars, war], resources: { ...s.resources, gold: 5000 } };
  const r = m.addCity(s, foe.id, { near: capId });
  s = r.state;
  const c = s.regions[r.cityId];
  s = { ...s, units: { ...s.units, t1: u('t1', foe.id, r.cityId, c.tile, 'infantry', 2000) }, intel: { ...(s.intel || {}), [foe.id]: s.turnNumber + 3 }, settings: { ...s.settings, language: lang } };
  s = m.atGates(s, capId, r.cityId); // the army stands at its gates: the card opens at once, no march
  window.__risk = { target: r.cityId, capId };
  window.__game.dispatch({ type: 'LOAD_GAME', payload: s });
}, lang);
await page.evaluate(async (l) => { (await import('/terra-imperium/src/i18n/index.js')).setLanguage(l); }, lang); // the start screen ran in English
await wait(1500);
// the welcome tour and first contact step aside
for (let i = 0; i < 3; i++) {
  for (const loc of [page.getByRole('button', { name: /^(Skip|דלגו|דילוג)$/ }), page.getByRole('button', { name: /^(Let my advisor choose|שהיועץ שלי יבחר)$/ }), page.locator('[data-testid="first-contact"] button', { hasText: /Later|אחר כך/ })]) if (await loc.first().isVisible().catch(() => false)) await click(loc.first());
  await wait(400);
}
await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:select-region', { detail: window.__risk.target })));
await wait(1500);
await page.getByRole('button', { name: /^Invade|^Attack|^פלשו|^תקפו/ }).first().click({ force: true });
await page.getByTestId('pre-battle').waitFor({ timeout: 15000 }).catch(async (e) => { console.log('ids:', await page.evaluate(() => [...document.querySelectorAll('[data-testid]')].map((e) => e.dataset.testid).filter((x) => /battle|chip|wait|region/i.test(x)).join(' ')));
console.log('state:', await page.evaluate(() => { const g = window.__game.state; return JSON.stringify({ g1: g.units.g1 && { tile: g.units.g1.tile, region: g.units.g1.regionId, moves: g.units.g1.movesLeft, route: g.units.g1.route, target: g.units.g1.target }, log: (g.log || g.eventLog || []).slice(-3) }); })); await page.screenshot({ path: path.join(outDir, 'risk-failed.png') }); throw e; });
const go = page.getByTestId('battle-go');
const shot = async (name) => { const f = path.join(outDir, `risk-${lang}-${W}x${H}-${name}.png`); await page.screenshot({ path: f }); return f; };
await click(page.getByTestId('battle-choice-command'));
await wait(300);
console.log('card:', await go.textContent(), '|', await shot('1-card'));
await go.click();
await wait(200);
console.log('after one tap:', await go.textContent(), 'confirm', await go.getAttribute('data-confirm'), 'card open', await page.getByTestId('pre-battle').isVisible(), '|', await shot('2-armed'));
await wait(3300);
console.log('3 s later:', await go.textContent(), 'confirm', await go.getAttribute('data-confirm'));
await go.click();
await wait(200);
await page.getByTestId('battle-choice-auto').click();
await wait(200);
console.log('a tap elsewhere resets:', await go.textContent(), 'confirm', await go.getAttribute('data-confirm'));
await page.getByTestId('battle-choice-command').click();
await go.click(); await wait(150); await go.click();
await wait(2500);
console.log('two taps: card open', await page.getByTestId('pre-battle').isVisible().catch(() => false), 'battle screen', await page.locator('[data-testid="tactical-battle"], [data-testid="battle-loading"]').first().isVisible().catch(() => false), '|', await shot('3-after-two'));
await browser.close();
