// scripts/ui/safari-shots.mjs
// iPhone Safari landscape checks in Chromium (WebKit is not installed here): an iPhone 17 user agent,
// touch, DPR 3, the notch and home indicator as safe-area insets (CDP Emulation.setSafeAreaInsetsOverride
// where Chrome has it), at 844x390 (Safari's bars hidden) and 844x340 (the bars showing). Screenshots
// of the start screen, the map with End Turn, a side sheet, and two End Turns through the turn
// worker; prints whether the page can scroll behind the game and where the bottom controls end.
//   npx vite --port 5201   (in another shell)
//   node scripts/ui/safari-shots.mjs --url http://localhost:5201/ --out plans/ui/safari/after
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const URL = arg('url', 'http://localhost:5201/');
const OUT = arg('out', 'plans/ui/safari/shots');
const UA = process.argv.includes('--desktop-ua') ? undefined : 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
// '844x390-bars': the layout viewport stays 390 tall while Safari's bottom bar covers the last 50 px
// (visualViewport.height 340, as on the phone): the bar is drawn as a red strip over the page.
const SIZES = [{ name: '844x390', width: 844, height: 390 }, { name: '844x340', width: 844, height: 340 }, { name: '844x390-bars', width: 844, height: 390, bar: 50 }];
const INSETS = { top: 0, left: 59, bottom: 21, right: 0 }; // landscape, Dynamic Island on the left

const exe = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : { channel: 'chrome' }), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
mkdirSync(OUT, { recursive: true });

const startGame = async (page) => {
  await page.getByTestId('start-next').waitFor({ timeout: 120000 });
  await page.fill('input[aria-label="Search peoples"]', 'Akkad');
  await page.locator('[data-people]').first().dispatchEvent('click');
  await page.getByTestId('start-step-ready').dispatchEvent('click'); // Begin is on Ready only
  await page.getByRole('button', { name: /^Begin as/ }).dispatchEvent('click');
  const skip = page.getByRole('button', { name: 'Skip' });
  await skip.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  if (await skip.isVisible().catch(() => false)) await skip.dispatchEvent('click');
  // Research on the advisor, so End Turn is not held by the choice.
  const advisor = page.getByTestId('research-let-advisor');
  await advisor.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (await advisor.isVisible().catch(() => false)) await advisor.dispatchEvent('click');
};

const geometry = (page) => page.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
  window.scrollTo(0, 300);
  document.scrollingElement.scrollTop = 300;
  const scrolled = Math.max(window.scrollY, document.scrollingElement.scrollTop);
  window.scrollTo(0, 0);
  const cs = getComputedStyle(document.documentElement);
  return {
    viewport: [innerWidth, innerHeight], visual: window.visualViewport ? [Math.round(visualViewport.width), Math.round(visualViewport.height)] : null,
    appHeight: cs.getPropertyValue('--app-height').trim() || null,
    body: r('body'), topBar: r('[data-testid="world-top-bar"]'), endTurn: r('[data-testid="end-turn"]') || r('[data-testid="world-moves"]'),
    sheet: r('.sheet-panel'), pageScrolledBy: scrolled, layout: document.documentElement.dataset.layout
  };
});

const endTurn = async (page, label) => {
  const before = await page.evaluate(() => document.querySelector('[data-testid="world-top-bar"]')?.textContent || '');
  const t0 = Date.now();
  for (let i = 0; i < 8; i++) {
    const advisor = page.getByTestId('research-let-advisor');
    if (await advisor.isVisible().catch(() => false)) await advisor.dispatchEvent('click');
    const queue = page.locator('[data-testid="queue-item"]:not([disabled])').first();
    if (await queue.isVisible().catch(() => false)) { await queue.dispatchEvent('click'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    const btn = page.getByTestId('end-turn');
    if (!(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click');
    await page.waitForTimeout(500);
    if (await page.getByTestId('world-moves').isVisible().catch(() => false)) break;
  }
  await page.getByTestId('world-moves').waitFor({ state: 'detached', timeout: 90000 }).catch(() => {});
  const after = await page.evaluate(() => document.querySelector('[data-testid="world-top-bar"]')?.textContent || '');
  console.log(`  ${label}: ${Date.now() - t0} ms, top bar changed: ${before !== after}`);
};

for (const size of SIZES) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await context.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' || /turn worker/i.test(m.text())) logs.push(`${m.type()}: ${m.text()}`); });
  await page.addInitScript(() => {
    window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true; window.__E2E_MAP_TEST__ = true;
    try { localStorage.setItem('terra-imperium-map-mode', 'flat'); localStorage.setItem('terra-imperium-map-renderer', 'webgl'); localStorage.setItem('terra-imperium-minimap-open', '0'); } catch { /* none */ }
  });
  if (size.bar) {
    await page.addInitScript((h) => {
      const vv = new EventTarget();
      Object.assign(vv, { width: innerWidth, height: h, scale: 1, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0 });
      Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
      addEventListener('DOMContentLoaded', () => {
        const bar = document.createElement('div');
        bar.style.cssText = `position:fixed;left:0;right:0;top:${h}px;height:${innerHeight - h}px;background:rgba(220,38,38,.85);z-index:2147483647;pointer-events:none;font:12px system-ui;color:#fff;display:flex;align-items:center;justify-content:center`;
        bar.textContent = 'Safari bar (simulated)';
        document.documentElement.appendChild(bar);
      });
    }, size.height - size.bar);
  }
  const cdp = await context.newCDPSession(page);
  const insets = await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSETS }).then(() => 'emulated', (e) => `not available (${e.message.split('\n')[0]})`);
  console.log(`${size.name}: safe-area insets ${insets}`);
  await page.goto(URL, { timeout: 240000 });
  await page.getByTestId('start-next').waitFor({ timeout: 120000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${size.name}-1-start.png` });
  await startGame(page);
  await page.getByTestId('end-turn').waitFor({ timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('  map', JSON.stringify(await geometry(page)));
  await page.screenshot({ path: `${OUT}/${size.name}-2-map.png` });
  // A side sheet: the nation overview from the top bar.
  await page.getByTestId('top-bar-nation').dispatchEvent('click').catch(() => {});
  await page.waitForTimeout(1200);
  console.log('  sheet', JSON.stringify(await geometry(page)));
  await page.screenshot({ path: `${OUT}/${size.name}-3-sheet.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await endTurn(page, 'end turn 1');
  await endTurn(page, 'end turn 2');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${size.name}-4-after-two-turns.png` });
  console.log(`  ${logs.length ? logs.slice(0, 8).join('\n  ') : 'no page errors or worker warnings'}`);
  await context.close();
}
await browser.close();
