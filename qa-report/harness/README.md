# QA harness

Plain Node ESM helpers around the installed `playwright` package for the Terra Imperium audit.
No test runner: each audit script is a small `.mjs` file you run with `node`.

Files:

- `viewports.mjs`: the 7 audit viewports (desktop 1920x1080, laptop 1366x768, tablet-land 1024x768,
  tablet-port 768x1024, phone-land 844x390, phone-land-small 667x375, phone-port 390x844). Phones
  and tablets get `hasTouch` and `isMobile`. `expectLayout` is what `src/hooks/useLayoutMode.js`
  should put on `<html data-layout>` (note: 1024 wide counts as desktop there).
- `qa.mjs`: `ensureServer(port)` and `openApp({ port, viewport, area, ... })`, which returns a
  `QASession` with the helpers below.
- `example.mjs`: the working example (start screen, seeded France game, two turns).

## Run the example

```bash
node qa-report/harness/example.mjs desktop 5180
node qa-report/harness/example.mjs phone-land 5180
```

`ensureServer(5180)` starts `npx vite --port 5180 --strictPort` if nothing answers on
`http://localhost:5180/terra-imperium/` and stops it again at the end (it never stops a server it
did not start, so you can keep one running yourself with `npx vite --port 5180`).
Output: `qa-report/screenshots/<viewport>/example/01-start-screen.png`, `02-game-started.png`,
`03-after-two-turns.png` and the log `qa-report/logs/<viewport>/example.json`.
Verified on 2026-10-03: both viewports pass with 0 console errors, 0 page errors, 0 failed
requests; the log shows `layout=desktop` and `layout=phone-landscape`, turns t1 -> t2 -> t3.

## Tiny example

```js
import { ensureServer, openApp } from './qa.mjs';

const server = await ensureServer(5180);
const qa = await openApp({ port: 5180, viewport: 'phone-land', area: 'smoke' });
try {
  await qa.step('new game', async () => {
    await qa.startNewGame({ nation: 'France', seed: 7 });   // seeded, through the real UI
    await qa.shot('started');                                 // screenshots/phone-land/smoke/01-started.png
  });
  await qa.step('three turns', () => qa.endTurns(3));        // answers events, peace offers, defenses
  console.log(await qa.getState((s) => ({ turn: s.turnNumber, year: s.year, seed: s.rngSeed })));
} finally {
  console.log(await qa.close());                              // writes logs/phone-land/smoke.json
  await server.stop();
}
```

## Starting a seeded game

The app has no URL parameter for nation or seed. Two ways:

1. Through the UI (default, `via: 'ui'`). The start screen (`src/components/ui/StartScreen.jsx`)
   passes its "World seed" field (default 1) as `scenario.seed`, and `GameContext.resetGame`
   sends it as `rngSeed` to `RESET_GAME` -> `createInitialState`. The seed field only shows in
   "Emergent civilizations" mode, so for a full-world game the harness switches the "World
   scenario" select to emergent, types the seed, switches back to "Full world" (the value stays in
   component state), searches the nation ("Search 240 nations..."), picks it and presses
   "Begin as <Nation>". Optional: `speed`, `difficulty` (visible button names), `mode: 'emergent'`
   with `nationCount`, `guided: true` (the guided Egypt start, `data-testid="guided-start"`).
2. Through the dev hook (`via: 'hook'`, needs `nationId`, e.g. `'fr'`). In a dev server build
   `src/context/GameContext.jsx` exposes `window.__game = { state, dispatch }`; the harness
   dispatches `RESET_GAME` with `rngSeed` directly. Faster, skips the start screen UI.

`window.__game` does not exist in production builds (docs/, the mobile build that the e2e suite
uses), so `getState()` returns null there and `turnMarker()` falls back to the header year.

## QASession API

- `step(name, fn, { soft })`: runs a named step; console errors, page errors, failed requests
  (HTTP >= 400 and network failures, ignoring ERR_ABORTED) and screenshots are recorded per step.
  A failing step takes an `error-<name>` screenshot and rethrows unless `soft: true`.
- `shot(label, { fullPage, locator })`: numbered PNG in `screenshots/<viewport>/<area>/`.
- `note(text)`: free text into the log.
- `act(locatorOrSelector, { real })`: tap on touch viewports, click otherwise; falls back to a
  dispatched click if the real gesture is blocked (the fallback is logged as a warning).
- `visible(target)`: never throws.
- `waitForGame()`: End Turn button visible, a painted canvas, 5 animation frames, a settle delay.
- `waitForGameOrStart()`, `layout()` (the `data-layout` value), `yearText()`, `turnMarker()`.
- `getState(fn)`, `dispatch(action)`, `hasHook()`: dev server only.
- `clearBlockers({ peace: 'accept'|'reject', research: 'advisor'|'first'|'later' })`: skips the
  onboarding tour, answers an event (first option), auto-resolves pending defense battles, answers
  an AI peace offer, answers the research choice sheet. Returns what it answered. It reports, but
  never fights, an open tactical battle (`state.pendingBattle`).
- `endTurn()` / `endTurns(n)`: clears blockers, presses End Turn (twice if the warn-me setting
  arms it), waits for the turn to change, retries after clearing blockers, and as a last resort
  dispatches `ADVANCE_TURN` through the hook. Throws if the turn never advances.
- `goto(query)`: reload with another query string, e.g. `?battleSandbox`, `?tileViewer`.
- `close()`: writes the JSON log and closes the browser.

## openApp options

`port` (5180), `viewport`, `area`, `base` (`'/terra-imperium/'`; use `'/'` for the mobile
preview on 4173), `query`, `skipOnboarding` (true: marks the tour as seen in
`terra-imperium-meta-v1`), `dismissRotateHint`, `autorotate` (false: sets
`window.__E2E_DISABLE_GLOBE_AUTOROTATE__`, the auto-rotating globe is very slow under headless
SwiftShader), `storage` (extra localStorage entries), `headless`.

Chromium: `/opt/pw-browsers/chromium` (or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), launched with the
same SwiftShader flags as `playwright.config.js`. A fresh browser context per `openApp`, so each
run starts with empty storage (no autosave). Starting a game takes about 20 to 25 s headless;
one End Turn about 5 to 10 s early on.
