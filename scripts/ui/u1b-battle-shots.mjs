// scripts/ui/u1b-battle-shots.mjs
// Screenshots of the battle screens restyled in phase U1b (plans/UI-DESIGN.md B01 Battle HUD, B05
// City assault, B06 Alerts and pause, B08 Result) in the battle sandbox, at the reference phone
// screen (844x390 landscape) and a desktop (1280x800), into plans/ui/u1b/. Needs a running dev
// server (`npx vite --port 5187`) and a Chrome; headless. Drives the battle with the DEV hooks of
// TacticalBattleScreen.jsx (window.__battleRenderer, window.__battleOrders), as battle-lab does.
//   node scripts/ui/u1b-battle-shots.mjs [--url http://localhost:5187/terra-imperium/] [--only B01,B08] [--vp phone]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL_BASE = arg('--url', 'http://localhost:5187/terra-imperium/');
const CHROME = arg('--chrome', ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p)));
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);
const VP_ONLY = arg('--vp', '');
const OUT = path.resolve('plans/ui/u1b');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { id: 'phone', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  { id: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (loc) => loc.dispatchEvent('click');
const shot = async (page, name, vp) => {
  const file = path.join(OUT, `${name}-${vp.id}.png`);
  await wait(500);
  await page.screenshot({ path: file, timeout: 120000 });
  console.log('wrote', path.relative(process.cwd(), file));
};

const openBattle = async (page, query) => {
  await page.goto(`${URL_BASE}?battleSandbox&${query}`);
  await click(page.getByRole('button', { name: 'Fight' }));
  await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
};
const speedTo3 = (page) => page.evaluate(() => { for (let i = 0; i < 2; i++) { const b = [...document.querySelectorAll('button')].find((x) => /^[123]×$/.test(x.textContent.trim())); b?.click(); } });
const attackKeep = (page, houses = 0) => page.evaluate((nh) => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  const hs = r.setup.structures.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'house' && s.alive).sort((a, b) => a.s.x - b.s.x).slice(0, nh);
  window.__battleOrders([{ side: 0, type: 'attackMove', squads: Array.from({ length: 16 }, (_, i) => i).slice(nh), x: k.x - 4 * 256, y: k.y }]);
  hs.forEach(({ i }, n) => window.__battleOrders([{ side: 0, type: 'attack', squads: [n], target: { kind: 'structure', index: i } }]));
}, houses);
const centreOnFight = (page, zoom = 1.4) => page.evaluate((z) => {
  const r = window.__battleRenderer; const k = r.setup.structures[0];
  r.zoomBy(z); r.centerOn(k.x / 256 - 6, k.y / 256);
}, zoom);

const SCREENS = {
  // B01 + B05: a city assault under way, a regiment selected
  B01: async (page, vp) => {
    await openBattle(page, 'city=medium&age=classical&fort=2&seed=7');
    await shot(page, 'B01-deploy', vp);
    await click(page.getByTestId('battle-pause'));
    await wait(3000);
    await attackKeep(page, 2);
    await speedTo3(page);
    await centreOnFight(page);
    await wait(20000);
    const card = page.getByTestId('battle-select-all'); // B10: the regiment bar is gone; All selects the army
    if (await card.count()) await click(card);
    await wait(800);
    await shot(page, 'B01-B05-assault', vp);
    // B06: pause sheet
    await click(page.getByTestId('battle-pause'));
    await page.getByTestId('battle-pause-sheet').waitFor({ timeout: 10000 });
    await shot(page, 'B06-pause', vp);
    // B08: sound the retreat and wait for the result
    await click(page.getByTestId('battle-leave'));
    await click(page.getByTestId('battle-retreat-all'));
    await click(page.getByTestId('battle-resume'));
    await page.getByTestId('battle-result').waitFor({ timeout: 240000 });
    await shot(page, 'B08-result', vp);
  },
  // B01 on open ground, B06 alerts as the armies meet
  B06: async (page, vp) => {
    await openBattle(page, 'terrain=plains&age=bronze&fort=0&seed=11&noeco');
    await click(page.getByTestId('battle-pause'));
    await wait(1500);
    await page.evaluate(() => { const r = window.__battleRenderer; const k = r.setup.structures[0]; window.__battleOrders([{ side: 0, type: 'attackMove', squads: Array.from({ length: 16 }, (_, i) => i), x: k.x - 4 * 256, y: k.y }]); });
    await speedTo3(page);
    await page.getByTestId('battle-alerts').waitFor({ timeout: 180000 }).catch(() => {});
    await page.evaluate(() => {
      const r = window.__battleRenderer; const sp = r.splats[r.splats.length - 1];
      if (sp) r.centerOn(sp.x, sp.z);
    });
    await shot(page, 'B06-alerts-field', vp);
  }
};

const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
try {
  for (const vp of VIEWPORTS) {
    if (VP_ONLY && VP_ONLY !== vp.id) continue;
    for (const [id, run] of Object.entries(SCREENS)) {
      if (ONLY.length && !ONLY.includes(id)) continue;
      const context = await browser.newContext({ viewport: vp.viewport, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      const page = await context.newPage();
      page.on('pageerror', (e) => console.log(`[${vp.id}] pageerror`, String(e).slice(0, 300)));
      try { await run(page, vp); } catch (e) { console.log(`[${vp.id}] ${id} failed:`, String(e).slice(0, 400)); }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
