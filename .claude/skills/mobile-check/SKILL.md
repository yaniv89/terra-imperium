---
name: mobile-check
description: Check Terra Imperium UI changes on a phone held sideways (844x390 and 844x340 with Safari bars) and on desktop 1600x900, in English and Hebrew, with real-browser screenshots. Use after any change to panels, cards, the top bar, the tab rail, the start screen or the battle HUD, and before saying a UI fix is done.
---

# Mobile check

Phones play landscape; 844x390 is the reference screen (CLAUDE.md). Hebrew is right to left.

1. Dev server of THIS checkout: `npx vite --port 5197` (background).
2. Panels and cards: `node scripts/ui/panels-shots.mjs` (prints one line per check, exit 1 on a
   failure, shots into plans/ui/pa-l4/). Chrome: `--chrome /opt/pw-browsers/chromium` if needed.
3. Other screens: a short Playwright script at 844x390 and 1600x900, en and he
   (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium`); long-turn states through
   the dev-only `window.__game` hook with LOAD_GAME, as scripts/ui/u1b-shots.mjs does.
4. Look at every shot (Read the image). Check: nothing overlaps or is cut off, controls stay
   44 px from the notch side and inside the safe area, End Turn sits at `--rail-w`, text has no
   raw `{placeholder}` or NaN, Hebrew mirrors and reads in order.
5. The landscape e2e: `npx playwright test e2e/landscape.spec.js`.
Report what was checked, at which sizes and languages, and attach the worst shot.
