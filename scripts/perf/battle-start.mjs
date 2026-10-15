// scripts/perf/battle-start.mjs
// How a commanded battle starts in a real browser, stage by stage (startWatch.js), and what happens
// when the worker dies. Opens the battle sandbox (`/?battleSandbox&autostart`) at 844x390 on the
// production mobile build and reads the stage times from the crash log (`battle-start ...` events).
//
//   node scripts/perf/battle-start.mjs [--throttle 1,6,10] [--age bronze] [--lang en|he]
//        [--scenarios normal,killWarm,killAll] [--shots dir] [--no-build] [--port 5293]
//
// Scenarios:
//   normal     the battle starts as usual (with CPU throttling when asked)
//   killWarm   the first battle worker (the warm one) is terminated without a word, as iOS can do:
//              the client must replace it with a fresh worker after its stall time and start
//   killAll    every worker is terminated and the page's animation frames stop after the battlefield
//              is built: nothing can answer, so the start must fail with the stage reached and the
//              reason in the crash log (the failure card's screenshot)
// --shots saves the loading screen and, for killAll, the failure card.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { launchBrowser } from '../lib/browserLaunch.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('port', '5293'));
const AGE = arg('age', 'bronze');
const LANG = arg('lang', 'en');
const THROTTLES = arg('throttle', '1').split(',').map(Number);
const SCENARIOS = arg('scenarios', 'normal').split(',');
const SHOTS = arg('shots', null);
// --base https://terra-imperium.pages.dev: run against a deployed site instead of a local build.
const BASE = arg('base', null);
// --hold 35: after the start, keep watching this many seconds for a failure card (an old build has no loading screen to wait for).
const HOLD = Number(arg('hold', '0'));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

if (!BASE && !process.argv.includes('--no-build')) execSync('npm run build:mobile', { stdio: 'inherit' });
const server = BASE ? null : spawn(process.execPath, ['scripts/preview.mjs', '--mobile', '--port', String(PORT)], { stdio: 'ignore' });
const stop = () => { try { server?.kill(); } catch { /* gone */ } };
process.on('exit', stop);
for (let i = 0; !BASE && i < 150; i++) {
  try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 300));
}

// Before the page runs: the language, and the worker sabotage of the scenario.
const initScript = ({ lang, scenario }) => {
  try { localStorage.setItem('terra-imperium.language', lang); } catch { /* blocked */ }
  window.__workers = 0;
  const W = window.Worker;
  window.Worker = function Patched(...a) {
    const w = new W(...a);
    if (!/battle/.test(String(a[0]))) return w; // only the battle's workers (not the turn worker)
    window.__workers += 1;
    const n = window.__workers;
    if ((scenario === 'killWarm' && n === 1) || scenario === 'killAll') setTimeout(() => w.terminate(), 300);
    return w;
  };
  window.Worker.prototype = W.prototype;
  if (scenario === 'killAll') {
    // Once the battlefield is up, no more animation frames: the main-thread fallback cannot run.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (fn) => (document.querySelector('[data-testid="battle-starting"]') ? 0 : raf(fn));
  }
};

const browser = await launchBrowser({ channel: 'chrome' });
const rows = [];
try {
  for (const scenario of SCENARIOS) for (const throttle of THROTTLES) {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    if (throttle > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.addInitScript(initScript, { lang: LANG, scenario });
    const t0 = Date.now();
    await page.goto(`${BASE || `http://localhost:${PORT}`}/?battleSandbox&autostart&age=${AGE}`);
    let shotLoading = false; let shotSlow = false;
    let outcome = 'timeout';
    for (let i = 0; i < 1200; i++) { // up to 120 s
      const state = await page.evaluate(() => ({
        started: !!document.querySelector('[data-testid="battle-starting"]'),
        failed: !!document.querySelector('[data-testid="battle-failure"]'),
        hud: !document.querySelector('[data-testid="battle-starting"]') && !document.querySelector('[data-testid="battle-loading"]') && !!document.querySelector('canvas'),
        slow: !!document.querySelector('[data-testid="battle-loading-auto"]'),
        stage: document.querySelector('[data-testid="battle-starting"]')?.getAttribute('data-stage') || null
      }));
      if (SHOTS && !shotLoading && state.started && state.stage && state.stage !== 'field') {
        shotLoading = true;
        await page.screenshot({ path: `${SHOTS}/loading-${LANG}-${scenario}-x${throttle}.png` });
      }
      if (SHOTS && !shotSlow && state.slow) { shotSlow = true; await page.screenshot({ path: `${SHOTS}/loading-slow-${LANG}-${scenario}-x${throttle}.png` }); }
      if (state.failed) { outcome = 'failed'; break; }
      if (state.hud && outcome !== 'started') { outcome = 'started'; if (!HOLD) break; }
      if (outcome === 'started' && Date.now() - t0 > HOLD * 1000) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const ms = Date.now() - t0;
    if (SHOTS && outcome === 'failed') await page.screenshot({ path: `${SHOTS}/failure-${LANG}-${scenario}-x${throttle}.png` });
    const log = await page.evaluate(() => {
      try { const l = JSON.parse(localStorage.getItem('terra-imperium-crash-log')); return l.sessions[l.sessions.length - 1].events.map((e) => e.kind).filter((k) => k.startsWith('battle')).join(' | '); } catch { return ''; }
    });
    const detail = outcome === 'failed' ? await page.locator('[data-testid="battle-failure-detail"]').innerText().catch(() => '') : '';
    const workers = await page.evaluate(() => window.__workers);
    rows.push({ scenario, throttle, outcome, ms, workers, detail, log });
    console.log(`${scenario.padEnd(8)} x${throttle}: ${outcome} after ${(ms / 1000).toFixed(1)} s, ${workers} workers${detail ? ` | card: ${detail}` : ''}\n   crash log: ${log}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  stop();
}
process.exit(0);
