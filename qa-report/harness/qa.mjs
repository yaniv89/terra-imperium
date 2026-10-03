// qa-report/harness/qa.mjs
// Shared Playwright helpers for the Terra Imperium QA audit. Plain Node ESM, no test runner:
//
//   import { ensureServer, openApp } from './qa.mjs';
//   const server = await ensureServer(5180);            // starts `vite --port 5180` if nothing answers
//   const qa = await openApp({ port: 5180, viewport: 'phone-land', area: 'smoke' });
//   await qa.startNewGame({ nation: 'France', seed: 7 });
//   await qa.shot('started');
//   await qa.endTurns(3);
//   await qa.close();                                    // writes the JSON log
//   await server.stop();                                 // only stops a server ensureServer started
//
// Everything is written under qa-report/: screenshots/<viewport>/<area>/NN-label.png and
// logs/<viewport>/<area>.json (console errors, page errors, failed requests, per step).
//
// Notes from the repo's own e2e specs (e2e/*.spec.js) that this harness follows:
// - window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true before load: the auto-rotating WebGL globe is
//   very slow under headless SwiftShader and can make CDP calls hang.
// - Chromium runs with SwiftShader flags (same as playwright.config.js).
// - In a dev server build (vite), the app exposes window.__game = { state, dispatch }
//   (src/context/GameContext.jsx). The harness uses it to read state and as a fallback to
//   dispatch actions. A production build (docs/ or www/) does not expose it.

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getViewport, isTouch } from './viewports.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const QA_ROOT = path.resolve(HERE, '..');
export const REPO_ROOT = path.resolve(QA_ROOT, '..');
export const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium';
// vite.config.js serves the game under /terra-imperium/ (GitHub Pages base path).
export const DEFAULT_BASE = '/terra-imperium/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shot';

// ---------------------------------------------------------------- server

const answers = async (url) => {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
};

/** Make sure a dev server answers on `port`. Starts `npx vite --port <port> --strictPort` in the
 * repo root if not. Returns { url, started, stop() }. stop() only kills a server it started. */
export const ensureServer = async (port = 5180, { base = DEFAULT_BASE, timeoutMs = 120000 } = {}) => {
  const url = `http://localhost:${port}${base}`;
  if (await answers(url)) return { url, started: false, stop: async () => {} };
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true, env: { ...process.env, BROWSER: 'none' }
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await answers(url)) {
      return {
        url, started: true, pid: child.pid,
        stop: async () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } }
      };
    }
    if (child.exitCode !== null) throw new Error(`vite exited early:\n${out}`);
    await sleep(500);
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* ignore */ }
  throw new Error(`vite did not answer on ${url} within ${timeoutMs} ms:\n${out}`);
};

// ---------------------------------------------------------------- browser + session

/**
 * Open the app in a fresh browser context.
 * @param {object} o
 * @param {number} o.port            dev server port (default 5180)
 * @param {string} o.viewport        a key of VIEWPORTS (viewports.mjs)
 * @param {string} o.area            folder name for screenshots and the log (e.g. 'start', 'map')
 * @param {string} [o.base]          base path (default '/terra-imperium/'; use '/' for the mobile preview)
 * @param {string} [o.query]         query string such as '?battleSandbox' or '?tileViewer'
 * @param {boolean} [o.skipOnboarding=true]  pre-mark the onboarding tour as seen
 * @param {boolean} [o.dismissRotateHint=false] pre-dismiss the portrait rotate hint
 * @param {boolean} [o.autorotate=false]     let the globe auto-rotate (slow headless)
 * @param {object} [o.storage]       extra localStorage entries set before load
 * @param {boolean} [o.headless=true]
 * @param {boolean} [o.navigate=true] go to the app right away
 */
export const openApp = async ({
  port = 5180, viewport = 'desktop', area = 'misc', base = DEFAULT_BASE, query = '',
  skipOnboarding = true, dismissRotateHint = false, autorotate = false, storage = {},
  headless = true, navigate = true
} = {}) => {
  const vp = getViewport(viewport);
  const browser = await chromium.launch({
    headless,
    executablePath: fs.existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
  });
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    hasTouch: vp.hasTouch,
    isMobile: vp.isMobile
  });
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(90000);
  const page = await context.newPage();

  const init = { autorotate, skipOnboarding, dismissRotateHint, storage };
  await page.addInitScript((o) => {
    if (!o.autorotate) window.__E2E_DISABLE_GLOBE_AUTOROTATE__ = true;
    try {
      // Only on the first load of this context: later reloads must keep the autosave.
      if (!sessionStorage.getItem('__qa_init')) {
        sessionStorage.setItem('__qa_init', '1');
        if (o.skipOnboarding) {
          const raw = localStorage.getItem('terra-imperium-meta-v1');
          const meta = raw ? JSON.parse(raw) : { unlockedAchievements: [], selectedDoctrine: 'none', difficulty: 'prince' };
          meta.hasSeenOnboarding = true;
          localStorage.setItem('terra-imperium-meta-v1', JSON.stringify(meta));
        }
        if (o.dismissRotateHint) localStorage.setItem('terra-imperium-portrait-ok', '1');
        for (const [k, v] of Object.entries(o.storage || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
    } catch { /* storage blocked */ }
  }, init);

  const qa = new QASession({ browser, context, page, viewport, area, url: `http://localhost:${port}${base}${query}` });
  if (navigate) await qa.goto();
  return qa;
};

export class QASession {
  constructor({ browser, context, page, viewport, area, url }) {
    Object.assign(this, { browser, context, page, viewport, area, url });
    this.touch = isTouch(viewport);
    this.shotIndex = 0;
    this.shotDir = path.join(QA_ROOT, 'screenshots', viewport, slug(area));
    this.logFile = path.join(QA_ROOT, 'logs', viewport, `${slug(area)}.json`);
    fs.mkdirSync(this.shotDir, { recursive: true });
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    this.steps = [];
    this.current = this._newStep('setup');
    this.notes = [];

    page.on('console', (m) => {
      if (m.type() === 'error') this.current.consoleErrors.push(m.text());
      else if (m.type() === 'warning') this.current.consoleWarnings.push(m.text());
    });
    page.on('pageerror', (e) => this.current.pageErrors.push(String(e?.stack || e)));
    page.on('requestfailed', (r) => {
      const why = r.failure()?.errorText || 'failed';
      if (why.includes('ERR_ABORTED')) return; // navigation/HMR aborts are noise
      this.current.failedRequests.push(`${r.method()} ${r.url()} (${why})`);
    });
    page.on('response', (r) => { if (r.status() >= 400) this.current.failedRequests.push(`${r.request().method()} ${r.url()} -> ${r.status()}`); });
  }

  _newStep(name) {
    return { name, startedAt: new Date().toISOString(), ms: 0, ok: true, error: null, screenshots: [], consoleErrors: [], consoleWarnings: [], pageErrors: [], failedRequests: [] };
  }

  /** Run fn as a named step: errors are recorded (and re-thrown unless {soft:true}). */
  async step(name, fn, { soft = false } = {}) {
    this._closeStep();
    this.current = this._newStep(name);
    const t0 = Date.now();
    try {
      return await fn?.(this);
    } catch (e) {
      this.current.ok = false;
      this.current.error = String(e?.stack || e);
      try { await this.shot(`error-${name}`); } catch { /* page may be gone */ }
      if (!soft) throw e;
      return undefined;
    } finally {
      this.current.ms = Date.now() - t0;
    }
  }

  _closeStep() {
    if (this.current && (this.current.name !== 'setup' || this.current.consoleErrors.length || this.current.pageErrors.length || this.current.failedRequests.length || this.current.screenshots.length)) {
      if (!this.steps.includes(this.current)) this.steps.push(this.current);
    }
  }

  note(text) { this.notes.push(text); }

  /** Numbered screenshot into screenshots/<viewport>/<area>/NN-label.png. Returns the path. */
  async shot(label, { fullPage = false, locator = null } = {}) {
    this.shotIndex += 1;
    const file = path.join(this.shotDir, `${String(this.shotIndex).padStart(2, '0')}-${slug(label)}.png`);
    const opts = { path: file, timeout: 60000, animations: 'disabled', caret: 'hide' };
    if (locator) await locator.screenshot(opts);
    else await this.page.screenshot({ ...opts, fullPage });
    this.current.screenshots.push(path.relative(QA_ROOT, file));
    return file;
  }

  async goto(query) {
    const url = query === undefined ? this.url : this.url.replace(/\?.*$/, '') + query;
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector('#root > *', { timeout: 90000 });
  }

  // ------------------------------------------------------------ input

  /** Tap on touch viewports, click on desktop ones. Falls back to a dispatched click event
   * (no pointer travel over the globe) when the real gesture times out or is intercepted. */
  async act(target, { timeout = 15000, real = true } = {}) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    if (real) {
      try {
        await loc.waitFor({ state: 'visible', timeout });
        if (this.touch) await loc.tap({ timeout });
        else await loc.click({ timeout });
        return 'real';
      } catch (e) {
        this.current.consoleWarnings.push(`[qa] real ${this.touch ? 'tap' : 'click'} failed, dispatching click instead: ${String(e).split('\n')[0]}`);
      }
    }
    await loc.dispatchEvent('click', undefined, { timeout });
    return 'dispatch';
  }

  /** Visible check that never throws. */
  async visible(target) {
    const loc = typeof target === 'string' ? this.page.locator(target).first() : target;
    return loc.isVisible().catch(() => false);
  }

  // ------------------------------------------------------------ state (dev builds only)

  async hasHook() { return this.page.evaluate(() => !!window.__game).catch(() => false); }

  /** Pick fields from window.__game.state (dev server only). fn runs in the page: (state) => value. */
  async getState(fn = (s) => ({ turnNumber: s.turnNumber, year: s.year, player: s.playerNationId, gameStatus: s.gameStatus })) {
    return this.page.evaluate(`(() => { const g = window.__game; if (!g || !g.state) return null; return (${fn.toString()})(g.state); })()`);
  }

  async dispatch(action) {
    return this.page.evaluate((a) => { if (!window.__game) return false; window.__game.dispatch(a); return true; }, action);
  }

  async yearText() {
    return this.page.locator('header').getByText(/^-?\d+ (BCE|CE)$/).first().textContent({ timeout: 5000 }).catch(() => null);
  }

  /** A comparable "which turn are we on" value: turnNumber via the hook, else the header year. */
  async turnMarker() {
    const s = await this.getState((st) => st.turnNumber).catch(() => null);
    if (s !== null && s !== undefined) return `t${s}`;
    return `y${await this.yearText()}`;
  }

  // ------------------------------------------------------------ waits

  /** Wait until the game shell is up and the globe/flat-map canvas has painted a few frames. */
  async waitForGame({ timeout = 90000, settleMs = 1500 } = {}) {
    await this.page.getByRole('button', { name: /^(End Turn|End anyway)/ }).first().waitFor({ state: 'visible', timeout });
    await this.page.waitForFunction(() => {
      const c = [...document.querySelectorAll('canvas')].find((el) => el.width > 0 && el.height > 0 && el.offsetParent !== null);
      return !!c || !!document.querySelector('[data-testid="flat-map"]');
    }, null, { timeout });
    await this.page.evaluate(() => new Promise((r) => { let n = 0; const f = () => (++n >= 5 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
    await sleep(settleMs);
  }

  async layout() { return this.page.evaluate(() => document.documentElement.dataset.layout); }

  // ------------------------------------------------------------ new game

  /**
   * Start a new game from the start screen.
   * Seed: the start screen passes its "World seed" (default 1) as scenario.seed, which
   * createInitialState uses as rngSeed. The field is only shown in "Emergent civilizations" mode,
   * so for a full-world game we switch to emergent, type the seed, and switch back (the value is
   * kept in component state). via:'hook' instead dispatches RESET_GAME through window.__game
   * (dev server only), which is what the start screen does under the hood.
   * @param {object} o
   * @param {string} [o.nation='France']  nation display name as on the start screen
   * @param {number} [o.seed=1]
   * @param {'full'|'emergent'} [o.mode='full']
   * @param {number} [o.nationCount]      emergent mode only (one of NATION_COUNTS, default 45)
   * @param {string} [o.speed]            'quick' | 'normal' | 'epic' style ids are shown by name; pass the visible name
   * @param {string} [o.difficulty]       difficulty display name, e.g. 'Prince'
   * @param {boolean} [o.guided=false]    the guided Egypt start (ignores nation)
   * @param {'ui'|'hook'} [o.via='ui']
   * @param {string} [o.nationId]         required for via:'hook' (e.g. 'fr')
   */
  async startNewGame({ nation = 'France', nationId, seed = 1, mode = 'full', nationCount, speed, difficulty, guided = false, via = 'ui' } = {}) {
    const page = this.page;
    // If a save was resumed, there is no start screen: reset through the header menu or the hook.
    const heading = page.getByRole('heading', { name: 'Choose Your Nation' });
    if (via === 'hook') {
      await this.waitForGameOrStart();
      const ok = await page.evaluate(({ nationId: id, seed: s, mode: m, nationCount: n, guided: g }) => {
        if (!window.__game) return false;
        window.__game.dispatch({ type: 'RESET_GAME', payload: { playerNationId: g ? 'eg' : id, gameSpeed: 'normal', scenario: { mode: m, nationCount: n || 45, seed: s }, rngSeed: s, guided: g, doctrineId: 'none', difficultyId: 'prince' } });
        return true;
      }, { nationId, seed, mode, nationCount, guided });
      if (!ok) throw new Error('startNewGame via hook needs the dev server (window.__game)');
      await this.waitForGame();
      await this.clearBlockers();
      return;
    }
    await heading.waitFor({ state: 'visible', timeout: 90000 });
    const scenario = page.getByLabel('World scenario');
    if (seed !== 1 || mode === 'emergent') {
      await scenario.selectOption('emergent');
      await page.getByLabel('World seed').fill(String(seed));
      if (nationCount) await page.getByLabel('Active nations').selectOption(String(nationCount));
      if (mode !== 'emergent') await scenario.selectOption('full');
    }
    if (speed) await this.act(page.getByRole('button', { name: new RegExp(`^${speed}`, 'i') }).first());
    if (difficulty) await this.act(page.getByRole('button', { name: new RegExp(`^${difficulty}`, 'i') }).first());
    if (guided) {
      await this.act(page.getByTestId('guided-start'));
    } else {
      await page.getByPlaceholder('Search 240 nations...').fill(nation);
      await this.act(page.getByRole('button', { name: nation, exact: true }).first());
      await this.act(page.getByRole('button', { name: `Begin as ${nation}` }));
    }
    await this.waitForGame();
    await this.clearBlockers();
  }

  async waitForGameOrStart(timeout = 90000) {
    await this.page.getByRole('button', { name: /^(End Turn|End anyway)/ }).or(this.page.getByRole('heading', { name: 'Choose Your Nation' })).first().waitFor({ state: 'visible', timeout });
  }

  // ------------------------------------------------------------ turns

  /**
   * Answer whatever blocks End Turn or covers the screen: the onboarding tour, an event sheet
   * (first affordable option), pending defense battles (auto-resolve), an AI peace offer
   * (accept by default), the research choice (let the advisor choose).
   * Returns the list of things it answered.
   */
  async clearBlockers({ peace = 'accept', research = 'advisor', maxRounds = 12 } = {}) {
    const page = this.page;
    const done = [];
    for (let round = 0; round < maxRounds; round++) {
      let acted = false;
      const skip = page.getByRole('button', { name: 'Skip', exact: true });
      if (await this.visible(skip)) { await this.act(skip, { real: false }); done.push('onboarding-skip'); acted = true; }

      const eventSheet = page.getByTestId('event-sheet');
      if (await this.visible(eventSheet)) {
        const opt = eventSheet.locator('button:not([aria-disabled="true"])').filter({ hasNotText: /^$/ });
        const n = await opt.count();
        // The first enabled button inside the sheet that is an option (they are full width).
        let clicked = false;
        for (let i = 0; i < n && !clicked; i++) {
          const b = opt.nth(i);
          const cls = (await b.getAttribute('class').catch(() => '')) || '';
          if (cls.includes('w-full')) { await this.act(b, { real: false }); clicked = true; }
        }
        if (!clicked && (await this.hasHook())) { await this.dispatch({ type: 'RESOLVE_EVENT', payload: { optionIndex: 0 } }); clicked = true; }
        if (clicked) { done.push('event'); acted = true; }
      }

      const defensePill = page.getByTestId('defense-pill');
      if (await this.visible(defensePill)) { await this.act(defensePill, { real: false }); acted = true; }
      if (await this.visible(page.getByTestId('defense-sheet'))) {
        const all = page.getByTestId('defense-auto-all');
        if (await this.visible(all)) await this.act(all, { real: false });
        else await this.act(page.getByTestId('defense-auto').first(), { real: false });
        done.push('defense-auto'); acted = true;
      }

      const peacePill = page.getByTestId('peace-offer-pill');
      if (await this.visible(peacePill)) { await this.act(peacePill, { real: false }); acted = true; }
      if (await this.visible(page.getByTestId('peace-offer-sheet'))) {
        await this.act(page.getByTestId(peace === 'reject' ? 'peace-offer-reject' : 'peace-offer-accept'), { real: false });
        done.push(`peace-${peace}`); acted = true;
      }

      if (await this.visible(page.getByTestId('research-choice'))) {
        if (research === 'first') await this.act(page.locator('[data-testid^="research-option-"]').first(), { real: false });
        else if (research === 'later') await this.act(page.getByRole('button', { name: 'Later' }), { real: false });
        else await this.act(page.getByTestId('research-let-advisor'), { real: false });
        done.push(`research-${research}`); acted = true;
      }

      if (!acted) break;
      await sleep(250);
    }
    // A tactical battle the harness never starts on its own; report it if one is open.
    const pendingBattle = await this.getState((s) => !!s.pendingBattle).catch(() => null);
    if (pendingBattle) this.current.consoleWarnings.push('[qa] a tactical battle (state.pendingBattle) is open; the harness does not fight it');
    return done;
  }

  /** End one turn safely. Clears blockers, presses End Turn (twice if it arms with a warning),
   * waits for the turn to change, then clears blockers again. Falls back to dispatching
   * ADVANCE_TURN through the dev hook if the UI does not advance. Returns the new marker. */
  async endTurn({ timeout = 60000, peace, research } = {}) {
    const page = this.page;
    await this.clearBlockers({ peace, research });
    const before = await this.turnMarker();
    const btn = page.getByRole('button', { name: /^(End Turn|End anyway)/ }).first();
    await this.act(btn, { real: false });
    await sleep(150);
    if ((await btn.getAttribute('data-armed').catch(() => '0')) === '1') await this.act(btn, { real: false });
    const t0 = Date.now();
    let marker = before;
    let retried = false;
    while (Date.now() - t0 < timeout) {
      marker = await this.turnMarker();
      if (marker !== before) break;
      // A blocker can appear mid-turn (a defense battle stops resolveTurn); answer and retry once.
      if (!retried && Date.now() - t0 > 3000) {
        const cleared = await this.clearBlockers({ peace, research });
        retried = true;
        if (cleared.length) { await this.act(btn, { real: false }); await sleep(150); if ((await btn.getAttribute('data-armed').catch(() => '0')) === '1') await this.act(btn, { real: false }); }
      }
      await sleep(250);
    }
    if (marker === before && (await this.hasHook())) {
      this.current.consoleWarnings.push('[qa] End Turn did not advance through the UI; dispatching ADVANCE_TURN');
      await this.dispatch({ type: 'ADVANCE_TURN' });
      await sleep(1000);
      marker = await this.turnMarker();
    }
    if (marker === before) throw new Error(`turn did not advance from ${before}`);
    await this.clearBlockers({ peace, research });
    return marker;
  }

  async endTurns(n, opts) {
    const markers = [];
    for (let i = 0; i < n; i++) markers.push(await this.endTurn(opts));
    return markers;
  }

  // ------------------------------------------------------------ teardown

  summary() {
    this._closeStep();
    const all = this.steps;
    return {
      viewport: this.viewport, area: this.area, url: this.url, finishedAt: new Date().toISOString(),
      totals: {
        steps: all.length,
        failedSteps: all.filter((s) => !s.ok).length,
        consoleErrors: all.reduce((a, s) => a + s.consoleErrors.length, 0),
        pageErrors: all.reduce((a, s) => a + s.pageErrors.length, 0),
        failedRequests: all.reduce((a, s) => a + s.failedRequests.length, 0)
      },
      notes: this.notes,
      steps: all
    };
  }

  writeLog() {
    const s = this.summary();
    fs.writeFileSync(this.logFile, JSON.stringify(s, null, 2));
    return { file: this.logFile, ...s.totals };
  }

  async close() {
    const res = this.writeLog();
    await this.browser.close().catch(() => {});
    return res;
  }
}
