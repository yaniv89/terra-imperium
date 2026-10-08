#!/usr/bin/env node
/* Native battle screenshot QA; no dev-server startup or production asset writes.
 * Run from the repository root (--repo defaults to cwd; dependencies resolve there).
 * PLAN (no browser): node scripts/art/capture-battle-art.mjs --plan
 * PHONE SHIP ONLY (use the existing Vite dev server, not built preview):
 * node scripts/art/capture-battle-art.mjs --run --scenario landing-middle \
 *   --profiles phone --qa-raf-ms 200 --out ../battle-art-landing-phone
 * Both viewport profiles are the default; --profiles phone,desktop is explicit.
 * --base http://127.0.0.1:3010/terra-imperium/ overrides the default dev URL.
 * Browser: normal Playwright cache by default; optionally set PLAYWRIGHT_BROWSERS_PATH,
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or CHROME. No fixed cache/revision path.
 * Native URLs use &tile=<actual land id>&artRoads; tileContextOf reads preview
 * state.world.tileState road booleans. No renderer fixtures or climate overrides.
 * --qa-raf-ms 200 caps page RAF at 5 FPS and gates first draw until a real sim frame.
 * This is screenshot QA ONLY, never a hardware/FPS performance benchmark.
 * --scenario selects cases. --smoke opens default native sandbox for selected profiles.
 * --delayed-raid is a SEPARATE real-order field destruction/depot goods exercise.
 * Native Start -> tick > 0 -> Pause -> Give orders removes deployment UI.
 * Sandbox bench bypasses tile/terrain/raid/landing inputs, so bench is not used.
 * __E2E_BATTLE_TEST__, DEV __battleRenderer/__battleOrders and battle-pause are existing hooks.
 * GET success alone is insufficient: verify GLB magic/version/length, parsed required root,
 * and live scene geometry/instance placement. Parent visual review is still required.
 * Reports explicitly list uncaptured cases/assets. This harness does NOT capture the
 * campaign map or claim all 14 checkpoint assets are natively visually verified.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const scenarios = [
  ...[['bronze', 'wood'], ['classical', 'stone'], ['modern', 'steel']].map(([age, material]) => ({
    id: `river-${age}`, query: { terrain: 'mixed', age }, crossing: material,
    keys: ['battle/terrain/river-kit.glb', 'battle/terrain/ford.glb', `battle/terrain/bridge-${material}.glb`]
  })),
  ...['conifer', 'tropical', 'cold'].map((kit) => ({
    id: `nature-${kit}`, query: { terrain: 'forest', age: 'bronze' }, vegetation: kit,
    keys: [`battle/nature/vegetation-${kit}.glb`]
  })),
  { id: 'raid', query: { terrain: 'mixed', age: 'bronze', raid: 'raid' },
    keys: ['loot-sack', 'exit-marker'].map((id) => `battle/props/${id}.glb`) },
  ...[['bronze', 'ancient'], ['kingdoms', 'middle'], ['modern', 'modern']].map(([age, period]) => ({
    id: `landing-${period}`, query: { terrain: 'island', age, landing: '' },
    keys: [`battle/props/landing-${period}.glb`]
  }))
];
const viewportProfiles = { phone: { width: 844, height: 390 }, desktop: { width: 1600, height: 900 } };
const options = { repo: process.cwd(), out: '', base: process.env.URL ||
  `http://127.0.0.1:3010${process.env.VITE_BASE || '/terra-imperium/'}`, run: false, smoke: false, delayed: false, qaRAFMs: 0, profiles: 'phone,desktop' };
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--run') options.run = true;
  else if (arg === '--plan') options.plan = true;
  else if (arg === '--delayed-raid') options.delayed = true;
  else if (arg === '--smoke') options.smoke = true;
  else if (arg === '--qa-raf-ms') {
    options.qaRAFMs = Number(process.argv[++i]);
    if (!Number.isFinite(options.qaRAFMs) || options.qaRAFMs < 0) throw new Error('--qa-raf-ms requires a nonnegative interval');
  }
  else if (['--repo', '--out', '--base', '--scenario', '--profiles'].includes(arg)) {
    const value = process.argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    options[arg.slice(2)] = value;
  } else throw new Error(`Unknown argument: ${arg}`);
}
const profileNames = [...new Set(options.profiles.split(',').map((name) => name.trim()))];
for (const name of profileNames) if (!Object.hasOwn(viewportProfiles, name))
  throw new Error(`Unknown profile ${JSON.stringify(name)}; use phone, desktop or phone,desktop`);
const sizes = profileNames.map((name) => viewportProfiles[name]);
const screenshotRAFIntervalMs = options.qaRAFMs; // Optional screenshot-only CPU headroom.
const base = new URL(options.base);
base.hash = ''; base.search = '';
if (!base.pathname.endsWith('/')) base.pathname += '/';
const selected = options.delayed ? [{ id: 'raid-delayed', query: { terrain: 'mixed', age: 'bronze', raid: 'raid' }, keys: ['battle/props/loot-sack.glb', 'battle/props/burnt-field-overlay.glb'], delayed: true }] : options.smoke ? [{ id: 'smoke', query: { terrain: 'mixed', age: 'bronze' }, keys: [] }]
  : options.scenario ? options.scenario.split(',').map((id) => {
    const s = scenarios.find((item) => item.id === id);
    if (!s) throw new Error(`Unknown scenario ${id}`);
    return s;
  }) : scenarios;
const urlFor = (s) => {
  const url = new URL(base);
  url.searchParams.set('battleSandbox', ''); url.searchParams.set('autostart', '');
  url.searchParams.set('seed', '7'); url.searchParams.set('fort', '0');
  url.searchParams.set('attacker', 'small'); url.searchParams.set('defender', 'small');
  url.searchParams.set('noeco', '');
  Object.entries(s.query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.href;
};
const delayedScenario = { id: 'raid-delayed', keys: ['battle/props/loot-sack.glb', 'battle/props/burnt-field-overlay.glb'] };
const checkpointKeys = [...new Set([...scenarios, delayedScenario].flatMap((scenario) => scenario.keys))];
const coverageCases = [...scenarios, delayedScenario].flatMap((scenario) => Object.entries(viewportProfiles)
  .map(([profile, viewport]) => ({ id: scenario.id, profile, viewport })));
const plan = { base: base.href, profiles: profileNames, resolutions: sizes, nativeTileSelection: true,
  coverage: { checkpointAssetCount: checkpointKeys.length, all14NativelyVerified: false,
    mapCapturedByThisHarness: false, parentVisualReviewRequired: true,
    scope: 'Selected native battle cases only; source/parse audits and external map captures are separate evidence.',
    unrequestedCases: coverageCases.filter((item) => !profileNames.includes(item.profile) || !selected.some((s) => s.id === item.id)),
    checkpointAssetKeys: checkpointKeys },
  screenshotTiming: { rafIntervalMs: screenshotRAFIntervalMs, maxRenderFPS: screenshotRAFIntervalMs ? 1000 / screenshotRAFIntervalMs : null,
    performanceBenchmark: false, realClock: true, workerTimersUnmodified: true,
    firstFrameGateQAOnly: screenshotRAFIntervalMs > 0 },
  scenarios: selected.map((s) => ({ ...s, url: urlFor(s) })),
  limitations: ['--plan leaves tile IDs unresolved; --run discovers actual loaded geo tiles.',
    'artRoads supplies QA preview road state only; campaign state remains untouched.',
    'Delayed loot/scorch requires real field destruction and can time out; opening raid is separate.',
    'No bridge damage HP hook; intact placement only. Parent must visually inspect screenshots.'] };
if (!options.run || options.plan) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  if (!options.out) throw new Error('--run requires an explicit --out capture directory');
  const out = resolve(options.out);
  const repo = resolve(options.repo);
  if (out === repo || out.startsWith(`${repo}/`)) throw new Error('Output must be outside the busy repository');
  if (!existsSync(join(repo, 'package.json'))) throw new Error(`Repository package.json absent: ${repo}; run from the repo root or pass --repo`);
  const require = createRequire(join(repo, 'package.json'));
  const { chromium } = require('@playwright/test');
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME || undefined;
  mkdirSync(out, { recursive: true });
  const report = { ...plan, startedAt: new Date().toISOString(), smokeOnly: options.smoke,
    parentVisualReviewRequired: true, rendererBackendRequested: 'ANGLE SwiftShader',
    hardwarePerformanceEvidence: false, results: [] };
  const browser = await chromium.launch({ headless: true, executablePath, args: [
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'
  ] });
  const flush = () => {
    const passed = report.results.filter((row) => row.ok && row.audit);
    const verified = new Set(passed.flatMap((row) => row.audit.assets.filter((asset) =>
      asset.loaded && asset.parsed && asset.placedCopies > 0).map((asset) => asset.key)));
    report.coverage.runtimeLoadAndPlacementVerifiedKeys = [...verified];
    report.coverage.notRuntimeVerifiedAssetKeys = checkpointKeys.filter((key) => !verified.has(key));
    report.coverage.uncapturedOrFailedCases = coverageCases.filter((item) => !passed.some((row) =>
      row.id === item.id && row.viewport.width === item.viewport.width && row.viewport.height === item.viewport.height));
    writeFileSync(join(out, 'capture-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  };
  try {
    if (!options.smoke && selected.some((s) => s.vegetation || s.crossing)) {
      const discovery = await browser.newPage();
      try {
        const url = new URL(base); url.searchParams.set('battleSandbox', '');
        await discovery.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await discovery.getByTestId('sandbox-terrain').waitFor({ timeout: 120000 });
        report.realTiles = await discovery.evaluate(async (baseURL) => {
          const { getTiles } = await import(`${baseURL}src/data/geo/tiles.js`);
          const { vegetationKitFor } = await import(`${baseURL}src/battle/art/vegetation.js`);
          const { sandboxTileOptions } = await import(`${baseURL}src/components/battle/sandboxTile.js`);
          const { tileContextOf } = await import(`${baseURL}src/battle/setup/tileContext.js`);
          const { buildSetupFromArmies } = await import(`${baseURL}src/battle/setup/buildBattleSetup.js`);
          const { findCrossings } = await import(`${baseURL}src/battle/art/battleTerrain.js`);
          const { TILE } = await import(`${baseURL}src/battle/setup/mapgen.js`);
          const tiles = getTiles(); const vegetation = {}; const rivers = [];
          const candidates = { conifer: [], tropical: [], cold: [] };
          const vegetationSearch = {};
          for (let tile = 0; tile < tiles.count; tile++) {
            if (tiles.land[tile] !== 1) continue;
            const kit = vegetationKitFor({ tile }, tiles);
            if (['conifer', 'tropical', 'cold'].includes(kit)) {
              const ctx = tileContextOf(null, tile);
              const forestSectors = ctx.sectors.filter((sector) => !sector.water && sector.terrain === 'forest').length;
              const score = (ctx.terrain === 'forest' ? 100 : 0) + forestSectors * 20 +
                (ctx.terrain === 'hills' ? 5 : 0) - (ctx.coastal ? 2 : 0);
              candidates[kit].push({ tile, terrain: ctx.terrain, forestSectors, score,
                climate: tiles.climateNames[tiles.climate[tile]], kit });
            }
            const size = Math.max(0, ...tiles.neighbors[tile].filter((n) => tiles.land[n] === 1)
              .map((n) => tiles.riverSizeBetween(tile, n)));
            if (size) rivers.push({ tile, size });
          }
          for (const [kit, list] of Object.entries(candidates)) {
            list.sort((a, b) => b.score - a.score || a.tile - b.tile);
            const search = vegetationSearch[kit] = { candidates: list.length, checked: 0, zeroForestRejected: 0 };
            for (const candidate of list) {
              // Match the native sandbox terrain, region seed and tile context. No
              // vegetation override or synthetic forest cells: inspect generated map data.
              const setup = buildSetupFromArmies({ regionId: `sandbox-${candidate.terrain}-7`,
                terrain: candidate.terrain, seed: 7, attackerUnits: [], defenderUnits: [],
                fortLevel: 0, infrastructure: 5, deposits: ['iron', 'copper'],
                tileContext: tileContextOf(null, candidate.tile) });
              search.checked += 1;
              const forestCells = setup.map.tiles.reduce((count, value) => count + (value === TILE.FOREST ? 1 : 0), 0);
              if (!forestCells) { search.zeroForestRejected += 1; continue; }
              vegetation[kit] = { ...candidate, forestCells }; break;
            }
            if (!vegetation[kit]) search.gap = `No real ${kit} land tile generates FOREST cells at native seed 7`;
          }
          rivers.sort((a, b) => b.size - a.size || a.tile - b.tile);
          let river = null;
          for (const { tile } of rivers.slice(0, 100)) {
            const preview = sandboxTileOptions(tiles, new URLSearchParams(`tile=${tile}&artRoads`));
            const setup = buildSetupFromArmies({ regionId: 'sandbox-mixed-7', terrain: 'mixed', seed: 7,
              attackerUnits: [], defenderUnits: [], fortLevel: 0, infrastructure: 5,
              deposits: ['iron', 'copper'], tileContext: tileContextOf(preview.state, tile) });
            const found = findCrossings(setup.map);
            if (found.bridges.length && found.fords.length && found.banks.length) {
              river = { tile, crossings: Object.fromEntries(Object.entries(found).map(([k, v]) => [k, v.length])) }; break;
            }
          }
          return { vegetation, vegetationSearch, river };
        }, base.href);
        for (const scenario of selected) {
          if (scenario.vegetation) {
            const real = report.realTiles.vegetation[scenario.vegetation];
            if (!real) scenario.discoveryGap = report.realTiles.vegetationSearch[scenario.vegetation].gap;
            else { scenario.query.tile = String(real.tile); scenario.query.terrain = real.terrain; }
          }
          if (scenario.crossing) {
            if (!report.realTiles.river) throw new Error('No actual river tile generates bank/ford/bridge');
            scenario.query.tile = String(report.realTiles.river.tile); scenario.query.artRoads = '';
          }
        }
        report.scenarios = selected.map((s) => ({ ...s, url: urlFor(s) })); flush();
      } finally { await discovery.close(); }
    }
    for (const scenario of selected) for (const viewport of sizes) {
      if (scenario.discoveryGap) {
        report.results.push({ id: scenario.id, viewport, url: null, ok: false,
          proofStatus: 'diagnostic-not-acceptance-proof', gaps: [scenario.discoveryGap],
          errors: [], shots: [], captureSkipped: true });
        flush(); console.log(`GAP ${scenario.id}: ${scenario.discoveryGap}`); continue;
      }
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: 'block' });
      const page = await context.newPage();
      const row = { id: scenario.id, viewport, url: urlFor(scenario), errors: [], warnings: [],
        httpFailures: [], failedRequests: [], glbResponses: [], shots: [], gaps: [] };
      report.results.push(row);
      const bodies = []; let collecting = true;
      page.on('console', (message) => {
        if (!collecting) return;
        if (message.type() === 'error') row.errors.push(message.text());
        if (message.type() === 'warning') {
          row.warnings.push(message.text());
          if (/\[art\].*(keeping|without|failed)|WebGL.*(lost|error)|failed to load/i.test(message.text()))
            row.errors.push(`Art/WebGL fallback warning: ${message.text()}`);
        }
      });
      page.on('pageerror', (e) => { if (collecting) row.errors.push(`pageerror: ${e.message}`); });
      page.on('requestfailed', (r) => {
        if (collecting) row.failedRequests.push({ url: r.url(), error: r.failure()?.errorText });
      });
      page.on('response', (response) => {
        if (!collecting) return;
        if (response.status() >= 400) row.httpFailures.push({ url: response.url(), status: response.status() });
        // Vite's ?import / ?url JS modules are not GLB binary responses.
        if (!/\.glb(?:\?|$)/i.test(response.url()) || /javascript/.test(response.headers()['content-type'] || '')) return;
        bodies.push((async () => {
          try {
            const bytes = await response.body();
            row.glbResponses.push({ url: response.url(), status: response.status(), bytes: bytes.length,
              validGLB: response.ok() && bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'glTF' &&
                bytes.readUInt32LE(4) === 2 && bytes.readUInt32LE(8) === bytes.length });
          } catch (e) { row.errors.push(`GLB response unreadable: ${response.url()}: ${e.message}`); }
        })());
      });
      try {
        await page.addInitScript((intervalMs) => {
          window.__E2E_BATTLE_TEST__ = true;
          const timing = window.__captureScreenshotTiming = { rafIntervalMs: intervalMs, performanceBenchmark: false,
            firstFrameGateQAOnly: intervalMs > 0, gateChecks: 0, gateStartedAtMs: null, firstFrameAtMs: null, gateDurationMs: null };
          if (!intervalMs) return;
          // Screenshot QA only: defer page RAF to leave CPU for Vite module loading
          // and the real sim worker. Native RAF supplies its real timestamp; no fake
          // clock, snapshots, worker messages or geometry. Preserve cancellation.
          const nativeRAF = window.requestAnimationFrame.bind(window);
          const nativeCancelRAF = window.cancelAnimationFrame.bind(window);
          const pending = new Map(); let nextId = 0;
          window.requestAnimationFrame = (callback) => {
            const id = ++nextId;
            const entry = { timer: null, nativeId: null };
            pending.set(id, entry);
            const waitingForNativeFrame = () => {
              const test = window.__battleTest;
              if (!test) return false;
              const tick = test.tick();
              if (Number.isFinite(tick)) {
                if (timing.firstFrameAtMs === null) {
                  timing.firstFrameAtMs = performance.now();
                  timing.gateDurationMs = timing.gateStartedAtMs === null ? 0 :
                    timing.firstFrameAtMs - timing.gateStartedAtMs;
                }
                return false;
              }
              timing.gateChecks += 1;
              timing.gateStartedAtMs ??= performance.now();
              return true;
            };
            const schedule = () => {
              entry.timer = setTimeout(() => {
                entry.timer = null;
                if (!pending.has(id)) return;
                // Keep the page's real worker messages/timers free to deliver its
                // first native frame before an expensive initial SwiftShader draw.
                if (waitingForNativeFrame()) { schedule(); return; }
                entry.nativeId = nativeRAF((timestamp) => {
                  entry.nativeId = null;
                  if (!pending.has(id)) return;
                  if (waitingForNativeFrame()) { schedule(); return; }
                  pending.delete(id); callback(timestamp);
                });
              }, intervalMs);
            };
            schedule();
            return id;
          };
          window.cancelAnimationFrame = (id) => {
            const entry = pending.get(id); if (!entry) return;
            if (entry.timer !== null) clearTimeout(entry.timer);
            if (entry.nativeId !== null) nativeCancelRAF(entry.nativeId);
            pending.delete(id);
          };
        }, screenshotRAFIntervalMs);
        // Enter through native setup UI. autostart opens TacticalBattleScreen but does
        // NOT resume the simulation. Warm its shared worker modules before GPU-heavy
        // battlefield construction; do not preload models to manufacture asset checks.
        const stagedURL = new URL(row.url); stagedURL.searchParams.delete('autostart');
        row.entryURL = stagedURL.href;
        const navigation = await page.goto(stagedURL.href, { waitUntil: 'domcontentloaded', timeout: 120000 });
        if (!navigation?.ok()) throw new Error(`Navigation failed: ${navigation?.status()}`);
        await page.getByTestId('sandbox-terrain').waitFor({ timeout: 120000 });
        await page.evaluate(async (baseURL) => {
          await Promise.all([
            import(`${baseURL}src/worldgen/worldLoader.js`),
            import(`${baseURL}src/battle/worker/battleLoop.js`)
          ]);
        }, base.href);
        await page.getByRole('button', { name: 'Fight', exact: true }).click();
        await page.getByTestId('battle-pause').waitFor({ timeout: 120000 });
        await page.waitForFunction(() => document.querySelector('[data-testid="battle-failure"]') ||
          (window.__battleRenderer?.lastView && Number.isFinite(window.__battleTest?.tick())),
          null, { timeout: 60000, polling: 100 });
        if (await page.getByTestId('battle-failure').isVisible())
          throw new Error(`Native worker boot failed before Start: ${await page.getByTestId('battle-failure').innerText()}`);
        row.firstNativeFrameTick = await page.evaluate(() => window.__battleTest.tick());
        // Hide the pause sheet before using the actual Start control below.
        const orders = page.getByTestId('battle-pause-orders');
        if (await orders.isVisible()) await orders.click();
        await page.evaluate(async () => {
          const r = window.__battleRenderer;
          const layers = [r.terrainArt, r.vegetation, r.battleProps, r.civicStructures, r.cityLayer, r.economyLayer, r.raidLandingProps];
          const waits = layers.flatMap((x) => Array.isArray(x?.ready) ? x.ready : x?.ready ? [x.ready] : []);
          let timer;
          try {
            await Promise.race([Promise.all(waits), new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Renderer asset readiness exceeded 60 seconds')), 60000);
            })]);
          } finally { clearTimeout(timer); }
        });
        // Real UI transition removes deployment UI/zone; never synthesize a view.
        const pause = page.getByTestId('battle-pause');
        if (await page.getByTestId('battle-failure').isVisible())
          throw new Error(`Native battle failed before Start: ${await page.getByTestId('battle-failure').innerText()}`);
        await pause.click();
        await page.waitForFunction(() => document.querySelector('[data-testid="battle-pause"]')?.getAttribute('aria-label') === 'Pause');
        await page.waitForFunction(() => document.querySelector('[data-testid="battle-failure"]') ||
          window.__battleTest?.tick() > 0, null, { timeout: 60000 });
        if (await page.getByTestId('battle-failure').isVisible())
          throw new Error(`Native battle failed after Start: ${await page.getByTestId('battle-failure').innerText()}`);
        if (!scenario.delayed) {
          await pause.click();
          await page.waitForFunction(() => document.querySelector('[data-testid="battle-pause"]')?.getAttribute('aria-label') === 'Resume');
          if (await orders.isVisible()) await orders.click();
        }
        if (await page.getByTestId('battle-failure').isVisible())
          throw new Error('Native failure overlay present after Start/Pause transition');
        row.capturePhase = 'started-native-battle';
        row.firstRunningTick = await page.evaluate(() => window.__battleTest.tick());
        if (scenario.delayed) {
          const start = page.getByTestId('battle-pause');
          if (!(await start.getAttribute('aria-label'))?.includes('Pause')) await start.click();
          row.exercise = await page.evaluate(() => {
            const r = window.__battleRenderer;
            const field = r.setup.structures.find((s) => s.loot && s.category === 'fields');
            if (!field) throw new Error('No native raid field target');
            const target = r.lastView.structures.find((s) => s.id === field.id);
            const squads = r.lastView.squads.filter((s) => s.side === 0 && s.alive && s.onField).map((s) => s.idx);
            if (!target || !squads.length || !window.__battleOrders) throw new Error('Native attacker/target/order hook absent');
            window.__battleOrders([{ side: 0, type: 'attack', squads, target: { kind: 'structure', index: r.lastView.structures.findIndex((s) => s.id === field.id) } }]);
            return { fieldId: field.id, squads, syntheticState: false };
          });
          await page.waitForFunction(({ fieldId }) => {
            const v = window.__battleRenderer?.lastView;
            return v?.structures?.some((s) => s.id === fieldId && s.alive === false);
          }, row.exercise, { timeout: 180000 });
          if ((await start.getAttribute('aria-label'))?.includes('Pause')) await start.click();
          await page.waitForFunction(() => document.querySelector('[data-testid="battle-pause"]')?.getAttribute('aria-label') === 'Resume');
          const orders = page.getByTestId('battle-pause-orders');
          if (await orders.isVisible()) await orders.click();
        }
        await page.waitForTimeout(1000);
        await Promise.all(bodies);
        row.audit = await page.evaluate(async ({ baseURL, scenario, received }) => {
          const { ART } = await import(`${baseURL}src/battle/art/artFiles.js`);
          const { vegetationKitFor } = await import(`${baseURL}src/battle/art/vegetation.js`);
          const { loadKit, kitObject } = await import(`${baseURL}src/battle/art/kitLoader.js`);
          const { PROP_OBJECTS } = await import(`${baseURL}src/battle/art/vegetationProps.js`);
          const { CITY_TILES_PER_UNIT } = await import(`${baseURL}src/battle/setup/cityBattle.js`);
          const r = window.__battleRenderer;
          const gl = r.renderer.getContext();
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          const gpu = { vendor: gl.getParameter(gl.VENDOR), renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION), shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null,
            unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
            requestedBackend: 'ANGLE SwiftShader', hardwarePerformanceEvidence: false };
          gpu.classification = /swiftshader|llvmpipe|software/i.test(`${gpu.renderer} ${gpu.unmaskedRenderer}`)
            ? 'software' : 'unverified';
          r.scene.updateMatrixWorld(true);
          const result = { screenshotTiming: window.__captureScreenshotTiming, gpu, diagnostics: r.diagnostics(), battleType: r.setup.battleType, actualTile: r.setup.tile,
            simTick: window.__battleTest.tick(), canvas: { width: r.renderer.domElement.width,
              height: r.renderer.domElement.height, webglContextLost: r.renderer.getContext().isContextLost() },
            nativeVegetation: vegetationKitFor(r.setup), assets: [], targets: [], gaps: [],
            crossings: r.terrainArt?.found ? Object.fromEntries(Object.entries(r.terrainArt.found)
              .map(([k, v]) => [k, v.length])) : null };
          if (scenario.query.tile != null && result.actualTile !== Number(scenario.query.tile))
            result.gaps.push('Native setup tile differs from requested real tile');
          if (result.canvas.webglContextLost || !result.diagnostics.drawCalls)
            result.gaps.push('No live WebGL scene draw or context lost');
          if (scenario.vegetation && result.nativeVegetation !== scenario.vegetation)
            result.gaps.push(`Native climate selected ${result.nativeVegetation}, requested ${scenario.vegetation}; no URL override exists`);
          const { raidLandingPlacements } = await import(`${baseURL}src/battle/art/raidLandingProps.js`);
          result.raidLanding = { consumerExists: !!r.raidLandingProps,
            placements: raidLandingPlacements(r.setup, r.lastView),
            loadedObjects: [...(r.raidLandingProps?.objects?.keys() || [])],
            instances: r.raidLandingProps?.instances?.stats(),
            carrying: r.lastView?.eco?.carrying || [],
            destroyedFields: (r.lastView?.structures || []).filter((s) => s.alive === false &&
              r.setup.structures.some((meta) => meta.id === s.id && meta.loot && meta.category === 'fields')).map((s) => s.id) };
          for (const key of scenario.keys.filter((key) => key.startsWith('battle/props/'))) {
            const id = key.split('/').at(-1).replace('.glb', '');
            if (!result.raidLanding.consumerExists || !result.raidLanding.loadedObjects.includes(id) ||
                !result.raidLanding.placements.some((p) => p.id === id))
              result.gaps.push(`Native raid/landing consumer has no placement for ${id}`);
          }
          const visible = (node) => { for (let n = node; n; n = n.parent) if (!n.visible) return false; return true; };
          const absolute = (url) => new URL(url, location.href).href;
          for (const key of scenario.keys) {
            const url = ART.url(key); const record = { key, url, loaded: false, parsed: false, placedCopies: 0 };
            result.assets.push(record);
            if (!url) { result.gaps.push(`Asset absent from ART index: ${key}`); continue; }
            // Never fetch an unused asset merely to manufacture a load-success record.
            record.loaded = received.some((item) => item.validGLB && item.url === absolute(url));
            if (!record.loaded) { result.gaps.push(`No valid binary loaded by runtime: ${key}`); continue; }
            const kit = await loadKit(url); record.objects = Object.keys(kit.objects); record.parsed = true;
            const id = key.split('/').at(-1).replace('.glb', '');
            const rootName = id === 'river-kit' ? 'bank' : id;
            if (!scenario.vegetation && !kit.objects[rootName]) {
              result.gaps.push(`Required parsed root absent: ${rootName}`); continue;
            }
            if (scenario.vegetation) {
              const v = r.vegetation; let treeCopies = 0;
              record.matchedKinds = [];
              for (const [kind, value] of Object.entries(v?.kinds || {})) {
                const obj = kitObject(kit, PROP_OBJECTS[kind] || []);
                if (!obj) continue;
                // Live vegetation uses scaled clones. Compare every attribute/index and
                // material to the requested kit, then require those clones in the scene.
                const matching = new Set(value.levels.filter((level, index) => {
                  const bundle = obj.lods[index]; if (!bundle) return false;
                  const expected = bundle.geometry.clone().scale(CITY_TILES_PER_UNIT, CITY_TILES_PER_UNIT, CITY_TILES_PER_UNIT);
                  const same = sameGeometry(level.geometry, expected);
                  expected.dispose();
                  const materials = Array.isArray(level.material) ? level.material : [level.material];
                  return same && materials.length === bundle.materials.length &&
                    materials.every((material, i) => material === bundle.materials[i]);
                }).map((level) => level.geometry));
                let copies = 0;
                for (const mesh of value.list) if (visible(mesh) && mesh.parent && matching.has(mesh.geometry)) {
                  copies += mesh.count || 0;
                  if ((kind === 'pine' || kind === 'oak') && mesh.count) result.targets.push({ name: rootName,
                    ...instancePosition(mesh), copies: mesh.count });
                }
                if (copies) record.matchedKinds.push({ kind, copies });
                record.placedCopies += copies;
                if (kind === 'pine' || kind === 'oak') treeCopies += copies;
              }
              if (!treeCopies) result.gaps.push('No visible tree instances verified against the requested vegetation kit');
            } else {
              const obj = kit.objects[rootName];
              const geometries = new Set(obj.lods.map((x) => x.geometry));
              const propConsumer = key.startsWith('battle/props/');
              const consumerMeshes = propConsumer ? new Set(obj.lods.map((bundle) =>
                r.raidLandingProps?.instances?.meshes.get(bundle)?.mesh).filter(Boolean)) : null;
              if (propConsumer && r.raidLandingProps?.objects.get(rootName) !== obj)
                result.gaps.push(`Native consumer did not use the parsed requested object: ${rootName}`);
              r.scene.updateMatrixWorld(true);
              r.scene.traverse((mesh) => {
                if (!mesh.isMesh || !visible(mesh) || !geometries.has(mesh.geometry) ||
                    (consumerMeshes && !consumerMeshes.has(mesh))) return;
                const count = mesh.isInstancedMesh ? mesh.count : 1;
                record.placedCopies += count;
                if (count) result.targets.push({ name: rootName, ...instancePosition(mesh), copies: count });
              });
            }
            if (!record.placedCopies) result.gaps.push(`Parsed but no matching visible scene instances: ${key}`);
          }
          return result;
          function sameGeometry(actual, expected) {
            const names = Object.keys(expected.attributes);
            if (Object.keys(actual.attributes).length !== names.length) return false;
            const equal = (a, b) => !a || !b ? a === b : a.itemSize === b.itemSize &&
              a.array.length === b.array.length && a.array.every((value, i) => value === b.array[i]);
            return equal(actual.index, expected.index) && names.every((name) =>
              equal(actual.attributes[name], expected.attributes[name]));
          }
          function instancePosition(mesh) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            const transform = mesh.matrixWorld.clone();
            if (mesh.isInstancedMesh && mesh.count) {
              const instance = mesh.matrix.clone(); mesh.getMatrixAt(0, instance); transform.multiply(instance);
            }
            const corners = [];
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z]) {
                const point = mesh.position.clone().set(x, y, z).applyMatrix4(transform);
                corners.push({ x: point.x, y: point.y, z: point.z });
              }
            const center = box.getCenter(mesh.position.clone()).applyMatrix4(transform);
            return { x: center.x, z: center.z, worldCorners: corners,
              height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)) };
          }
        }, { baseURL: base.href, scenario, received: row.glbResponses });
        row.gaps.push(...row.audit.gaps);
        const shoot = async (name) => {
          const file = `${scenario.id}-${viewport.width}x${viewport.height}-${name}.png`;
          await page.screenshot({ path: join(out, file), fullPage: false, animations: 'disabled', timeout: 120000 });
          row.shots.push(file);
        };
        await page.evaluate(() => {
          const r = window.__battleRenderer;
          r.centerOn(r.map.w / 2, r.map.h / 2); r.updateCamera();
        });
        await page.waitForTimeout(400); await shoot('wide');
        // One close detail per distinct target root, cap six per scenario/resolution.
        const targets = [...new Map(row.audit.targets.map((t) => [t.name, t])).values()].slice(0, 6);
        for (const target of targets) {
          const framing = await page.evaluate((target) => {
            const r = window.__battleRenderer;
            // Ground-only target, without centerOn's map-edge clamp. Project all eight
            // transformed root bounds corners so tall masts and the whole hull fit.
            r.target.set(target.x, 0, target.z);
            r.camera.zoom = 2.2; r.camera.updateProjectionMatrix(); r.updateCamera();
            const safe = { left: 24, right: r.width - 24, top: 110, bottom: r.height - 90 };
            const project = () => {
              const points = target.worldCorners.map((p) => {
                const v = r.target.clone().set(p.x, p.y, p.z).project(r.camera);
                return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
              });
              return { left: Math.min(...points.map((p) => p.x)), right: Math.max(...points.map((p) => p.x)),
                top: Math.min(...points.map((p) => p.y)), bottom: Math.max(...points.map((p) => p.y)) };
            };
            for (let attempt = 0; attempt < 4; attempt++) {
              const bounds = project();
              const factor = Math.min((safe.right - safe.left) / Math.max(1, bounds.right - bounds.left),
                (safe.bottom - safe.top) / Math.max(1, bounds.bottom - bounds.top), 1);
              r.camera.zoom *= factor * (factor < 1 ? 0.9 : 1);
              r.camera.updateProjectionMatrix(); r.updateCamera();
              const fitted = project(); const e = r.camera.matrixWorld.elements;
              const dx = ((fitted.left + fitted.right - safe.left - safe.right) / 2) *
                (r.camera.right - r.camera.left) / r.camera.zoom / r.width;
              const dy = -((fitted.top + fitted.bottom - safe.top - safe.bottom) / 2) *
                (r.camera.top - r.camera.bottom) / r.camera.zoom / r.height;
              const determinant = e[0] * e[6] - e[2] * e[4];
              if (Math.abs(determinant) < 1e-8) throw new Error('Cannot frame ground target with this camera');
              r.target.x += (dx * e[6] - e[2] * dy) / determinant;
              r.target.z += (e[0] * dy - dx * e[4]) / determinant;
              r.target.y = 0; r.updateCamera();
            }
            const bounds = project();
            return { safe, bounds, zoom: r.camera.zoom, height: target.height,
              fits: bounds.left >= safe.left - 1 && bounds.right <= safe.right + 1 &&
                bounds.top >= safe.top - 1 && bounds.bottom <= safe.bottom + 1 };
          }, target);
          await page.waitForTimeout(500);
          row.detailFraming ||= []; row.detailFraming.push({ name: target.name, ...framing });
          if (!framing.fits) row.gaps.push(`Entire root bounds do not fit art-detail frame: ${target.name}`);
          await shoot(`detail-${target.name}`);
        }
        await Promise.all(bodies);
      } catch (e) {
        row.errors.push(`Harness: ${e.message}`);
        try { row.screenshotTiming = await page.evaluate(() => window.__captureScreenshotTiming); }
        catch { /* A closed or crashed page cannot supply gate diagnostics. */ }
      }
      finally {
        row.ok = !row.errors.length && !row.gaps.length && !row.httpFailures.length && !row.failedRequests.length;
        row.proofStatus = options.smoke ? 'smoke-only' : row.ok ? 'automated-load-and-placement-pass-needs-visual-review' : 'diagnostic-not-acceptance-proof';
        flush(); collecting = false; await context.close();
        console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.id} ${viewport.width}x${viewport.height}: ${row.shots.length} shots, ${row.gaps.length} gaps, ${row.errors.length} errors`);
      }
    }
  } finally { await browser.close(); report.finishedAt = new Date().toISOString(); flush(); }
  if (report.results.some((row) => !row.ok)) process.exitCode = 1;
}
