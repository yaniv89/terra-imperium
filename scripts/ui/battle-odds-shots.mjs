// scripts/ui/battle-odds-shots.mjs
// Real-browser shots of lane battle-odds (844x390 and 1600x900, en and he): the city's Defense tab
// with Engage during a siege, the attack card it opens (hopeless, with its reasons) and the defence
// card with its reasons. The kingdoms era save (scripts/ai/era-saves) is loaded through the dev-only
// window.__game hook and a siege set on the player's capital.
//   npx vite --port 5197 &   node scripts/ui/battle-odds-shots.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser } from '../lib/browserLaunch.mjs';
import { readEraSave } from '../ai/build-era-saves.mjs';

const URL_BASE = process.env.URL || 'http://localhost:5197/terra-imperium/';
const OUT = path.resolve(process.argv[2] || 'plans/ui/battle-odds');
fs.mkdirSync(OUT, { recursive: true });
const save = readEraSave('kingdoms').state;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [{ id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { id: 'desktop', viewport: { width: 1600, height: 900 } }];

// The capital besieged by a big stack next to it; a small stone-age garrison inside; an assault queued.
const SIEGE = `
  const me = s.playerNationId; const capId = s.nations[me].capitalRegionId; const cap = s.regions[capId];
  const war = s.wars.find((w) => w.active && (w.aggressor === me || w.enemy === me));
  const foe = war.aggressor === me ? war.enemy : war.aggressor;
  const tiles = m.getTiles();
  const ring = tiles.neighbors[cap.tile].filter((t) => tiles.land[t] === 1 && !Object.values(s.regions).some((c) => c.tile === t));
  const u = (id, owner, regionId, tile, classId, strength, extra = {}) => ({ id, ownerId: owner, regionId, homeRegionId: regionId, tile, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, movesLeft: 1, xp: 0, rank: 'recruit', promotions: [], commanderId: null, embarkedOn: null, ...extra });
  const units = { ...Object.fromEntries(Object.entries(s.units).filter(([, x]) => x.regionId !== capId && !ring.includes(x.tile))),
    g1: u('g1', me, capId, cap.tile, 'infantry', 600, { ageId: 'stone' }), g2: u('g2', me, capId, cap.tile, 'ranged', 400, { ageId: 'bronze' }),
    e1: u('e1', foe, null, ring[0], 'infantry', 1000), e2: u('e2', foe, null, ring[0], 'infantry', 1000), e3: u('e3', foe, null, ring[0], 'ranged', 900), e4: u('e4', foe, null, ring[0], 'cavalry', 800) };
  s = { ...s, units, regions: { ...s.regions, [capId]: { ...cap, siege: { by: foe, hp: 300, maxHp: 640 } } } };
  if (QUEUE) s = { ...s, pendingDefenses: [m.createDefenseRecord(s, { war: { ...war, aggressor: foe }, regionId: capId, aggressorShare: 0.8, seed: 7, index: 1 })] };
  window.__bo = { capId };
  return s;
`;
const patch = (page, queue) => page.evaluate(async ({ body, queue }) => {
  const m = {};
  for (const p of ['data/geo/tiles.js', 'engine/defense.js']) Object.assign(m, await import(`/terra-imperium/src/${p}`));
  // eslint-disable-next-line no-new-func
  const fn = new Function('s', 'm', 'QUEUE', `return (async () => { ${body} })();`);
  window.__game.dispatch({ type: 'LOAD_GAME', payload: await fn(window.__game.state, m, queue) });
}, { body: SIEGE, queue });

const browser = await launchBrowser({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--disable-dev-shm-usage'] });
const errors = [];
try {
  for (const lang of ['en', 'he']) {
    for (const vp of SIZES) {
      const ctx = await browser.newContext(vp);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`[${lang} ${vp.id}] ${String(e).slice(0, 200)}`));
      await page.goto(URL_BASE);
      await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('terra-imperium.language', l); }, lang);
      await page.goto(URL_BASE);
      // a new game first (the title screen does not open a loaded state), then the era save
      await page.locator('[data-people]').first().waitFor({ timeout: 90000 });
      await page.locator('[data-people]').first().dispatchEvent('click');
      await page.getByTestId('start-step-ready').dispatchEvent('click');
      await page.getByTestId('begin-game').dispatchEvent('click');
      await page.getByTestId('world-top-bar').waitFor({ timeout: 90000 });
      const skip = page.getByRole('button', { name: /^(Skip|דילוג)/ });
      await skip.first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      if (await skip.first().isVisible().catch(() => false)) await skip.first().dispatchEvent('click');
      await page.evaluate((json) => window.__game.load(JSON.parse(json)), JSON.stringify(save));
      await wait(3000);
      await patch(page, false);
      await wait(1500);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:manage-city', { detail: { regionId: window.__bo.capId, tab: 'defense' } })));
      await wait(2000); await page.screenshot({ path: path.join(OUT, `debug-${lang}-${vp.id}.png`) });
      await page.getByTestId('city-defense').waitFor({ timeout: 20000 });
      await page.getByTestId('city-engage').scrollIntoViewIfNeeded();
      await wait(800);
      await page.screenshot({ path: path.join(OUT, `defense-tab-${lang}-${vp.id}.png`) });
      await page.getByTestId('city-engage-button').dispatchEvent('click');
      await page.getByTestId('pre-battle').waitFor({ timeout: 30000 });
      await wait(1500);
      await page.screenshot({ path: path.join(OUT, `engage-card-${lang}-${vp.id}.png`) });
      console.log(lang, vp.id, 'hopeless:', await page.getByTestId('pre-battle-hopeless').textContent().catch(() => 'none'));
      await page.getByTestId('battle-choice-calloff').first().dispatchEvent('click');
      await wait(500);
      await patch(page, true);
      await wait(2000);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('ti:show-defense')));
      await page.screenshot({ path: path.join(OUT, `debug2-${lang}-${vp.id}.png`) });
      await page.getByTestId('defense-sheet').waitFor({ timeout: 30000 });
      await wait(1500);
      await page.screenshot({ path: path.join(OUT, `defense-card-${lang}-${vp.id}.png`) });
      console.log(lang, vp.id, 'reasons:', await page.getByTestId('defense-odds-factors').textContent().catch(() => 'none'), '| warning:', await page.getByTestId('defense-hopeless').textContent().catch(() => 'none'));
      await ctx.close();
    }
  }
} finally { await browser.close(); }
console.log(errors.length ? errors.join('\n') : 'no page errors');
