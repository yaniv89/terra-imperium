// scripts/ui/qa-shots.mjs
// Screenshots of the main screens for the screenshot-qa AI job (scripts/ai/screenshot-qa.mjs): at
// 844x390 (phone landscape, DPR 2) and 1600x900, in English and Hebrew, as JPEGs plus manifest.json.
// The steps are the ones the older checks use: start and begin from rtl-shots.mjs / capture-shots.mjs,
// the crisis banner and glossary from diff-u30-u32-shots.mjs, the war record from diff-u25-shots.mjs,
// the battle from battle-rtl-shots.mjs. State is set with window.__game and LOAD_GAME, so it runs on a
// dev server or on a build made with VITE_QA_HOOK=1 (no src/ module imports, which a build lacks).
// A screen that fails is logged in the manifest and the run goes on.
//   VITE_QA_HOOK=1 npm run build && npm run preview   then
//   node scripts/ui/qa-shots.mjs [--url http://localhost:4173/terra-imperium/] [--out plans/ai-output/screenshot-qa/shots]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SIZES = [
  { id: 'phone', width: 844, height: 390, dpr: 2, mobile: true },
  { id: 'desktop', width: 1600, height: 900, dpr: 1, mobile: false }
];
export const LANGS = ['en', 'he'];
// World Congress has no screen yet (src/engine/worldCongress.js only), so it is not in the list.
export const SCREENS = [
  ['start-people', 'New game, step 1: choose a people'],
  ['start-world', 'New game, step 2: the world'],
  ['start-rules', 'New game, step 3: the rules'],
  ['start-ready', 'New game, step 4: the summary and Begin'],
  ['research-card', 'Map on turn 1 with the research choice card'],
  ['map-hud', 'Map with the HUD: top bar, tab rail, End Turn'],
  ['research', 'Research tab open'],
  ['diplomacy', 'Peoples (diplomacy) tab open'],
  ['city', 'City sheet of the capital'],
  ['war-map', 'Map at war: the war pill in the top bar'],
  ['war-empire', 'Empire tab, War section, while at war'],
  ['war-peoples', 'Peoples tab while at war'],
  ['crisis', 'Crisis banner (a plague hits the player)'],
  ['glossary', 'Glossary sheet for the player\'s people'],
  ['battle', 'Tactical battle HUD (battle sandbox)']
].map(([id, what]) => ({ id, what }));
export const shotFile = (screen, size, lang) => `${screen}-${size}-${lang}.jpg`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const fire = (page, type, detail) => page.evaluate(([t, d]) => window.dispatchEvent(new CustomEvent(t, { detail: d })), [type, detail]);
const patch = (page, body) => page.evaluate((b) => {
  // eslint-disable-next-line no-new-func
  const next = new Function('s', b)(window.__game.state);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: next });
}, body);

const WAR = `
  const me = s.playerNationId; const foe = Object.keys(s.nations).find((id) => id !== me && s.nations[id].kind !== 'independent' && !s.nations[id].isEliminated);
  const war = { id: 'war_qa', aggressor: foe, enemy: me, active: true, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: null };
  const nations = { ...s.nations, [me]: { ...s.nations[me], isAtWar: true }, [foe]: { ...s.nations[foe], isAtWar: true } };
  // fog.met is left alone: a fake contact record breaks the first-contact card.
  return { ...s, nations, wars: [...(s.wars || []), war] };`;
const CRISIS = `return { ...s, wars: (s.wars || []).filter((w) => w.id !== 'war_qa'), crises: { last: {}, lastAny: s.turnNumber, history: [{ id: 'great_plague', turn: s.turnNumber, nations: [s.playerNationId, 'x'] }] } };`;

const capture = async (browser, size, lang, out, manifest) => {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: size.dpr, isMobile: size.mobile, hasTouch: size.mobile, locale: 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  const step = async (screen, fn) => {
    const file = shotFile(screen, size.id, lang);
    const errorsBefore = errors.length;
    try {
      await fn();
      await wait(700);
      if (errors.length > errorsBefore) throw new Error(`page error: ${errors[errorsBefore]}`);
      await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 70, timeout: 120000 });
      manifest.push({ file, screen, size: size.id, lang, ok: true });
    } catch (e) {
      manifest.push({ file, screen, size: size.id, lang, ok: false, error: String(e.message || e).split('\n')[0] });
    }
    console.log(`${manifest.at(-1).ok ? 'ok  ' : 'FAIL'} ${file}${manifest.at(-1).error ? `  (${manifest.at(-1).error})` : ''}`);
  };
  const closeAll = async () => { await fire(page, 'ti:close-panels'); await page.keyboard.press('Escape'); await wait(400); };
  const tab = (id) => async () => { await closeAll(); await fire(page, 'ti:open-tab', id); await wait(900); };

  await page.goto(URL_BASE);
  await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
  await page.goto(URL_BASE);
  await step('start-people', async () => { await page.locator('[data-people]').first().waitFor({ timeout: 120000 }); await click(page.locator('[data-people]').first()); });
  await step('start-world', () => click(page.getByTestId('start-next')));
  await step('start-rules', () => click(page.getByTestId('start-next')));
  await step('start-ready', () => click(page.getByTestId('start-next')));
  let inGame = false;
  await step('research-card', async () => {
    await page.getByTestId('start-step-ready').dispatchEvent('click');
    await click(page.getByTestId('begin-game'));
    const skip = page.getByRole('button', { name: /^(Skip|דילוג)$/ });
    await skip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await skip.isVisible().catch(() => false)) await click(skip);
    await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
    inGame = true;
    await wait(2500);
  });
  if (inGame) {
    await step('map-hud', async () => {
      const r = page.getByTestId('research-let-advisor');
      if (await r.isVisible().catch(() => false)) await click(r);
    });
    await step('research', tab('tech'));
    await step('diplomacy', tab('diplomacy'));
    await step('city', async () => {
      await closeAll();
      // A Stone Age start is a band: found its village first (the Found here button's action), then open
      // the player's city, or any city when the site was refused.
      const cap = await page.evaluate(() => {
        const g = window.__game; const me = g.state.playerNationId;
        const band = Object.values(g.state.units).find((u) => u.ownerId === me && (u.classId === 'settler' || u.classId === 'band'));
        if (band && !Object.values(g.state.regions).some((c) => c.owner === me)) g.dispatch({ type: 'FOUND_CITY', payload: { unitId: band.id } });
        return null;
      }).then(() => wait(800)).then(() => page.evaluate(() => {
        const s = window.__game.state; const me = s.playerNationId;
        return (Object.values(s.regions).find((c) => c.owner === me) || Object.values(s.regions)[0])?.id;
      }));
      await fire(page, 'ti:select-region', cap);
      await wait(1200);
    });
    await step('war-map', async () => { await closeAll(); await patch(page, WAR); await page.getByTestId('war-pill').waitFor({ timeout: 10000 }); });
    await step('war-empire', tab('military'));
    await step('war-peoples', tab('diplomacy'));
    await step('crisis', async () => {
      await closeAll();
      await patch(page, CRISIS);
      await wait(800);
      const chip = page.getByTestId('crisis-banner-chip');
      if (await chip.isVisible().catch(() => false)) await click(chip);
      await page.getByTestId('crisis-banner').waitFor({ timeout: 10000 });
    });
    await step('glossary', async () => {
      const id = await page.evaluate(() => window.__game.state.playerNationId);
      await fire(page, 'ti:open-glossary', { kind: 'people', id });
      await page.getByTestId('glossary-sheet').waitFor({ timeout: 10000 });
    });
  }
  await step('battle', async () => {
    await page.goto(`${URL_BASE}?battleSandbox`);
    await wait(2500);
    await page.getByRole('button', { name: /^(Fight|להילחם)$/ }).first().dispatchEvent('click');
    // Software WebGL on a CI runner loads the field slowly: wait for the HUD's pause button.
    await page.getByTestId('battle-pause').waitFor({ timeout: 180000 });
    await wait(4000);
  });
  if (errors.length) manifest.push({ size: size.id, lang, pageErrors: errors.slice(0, 5) });
  await ctx.close();
};

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:4173/terra-imperium/');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { launchBrowser } = await import('../lib/browserLaunch.mjs');
  const out = path.resolve(arg('--out', 'plans/ai-output/screenshot-qa/shots'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await launchBrowser({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true });
  const manifest = [];
  const only = arg('--only', null); // e.g. phone-he, for a local rerun of one size and language
  for (const size of SIZES) for (const lang of LANGS) if (!only || only === `${size.id}-${lang}`) await capture(browser, size, lang, out, manifest);
  await browser.close();
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const shots = manifest.filter((m) => m.ok).length;
  console.log(`${shots} of ${SIZES.length * LANGS.length * SCREENS.length} screens captured into ${out}`);
  process.exit(shots ? 0 : 1);
}
