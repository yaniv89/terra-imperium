# iPhone landscape check, 21 Oct 2026

Emulation only: Chromium with an iPhone profile (844x390, scale 3, touch, iOS Safari user agent, safe-area
insets 47/47/0/21 through CDP, real touch events). It is NOT a real iPhone: no real Safari (WebKit), no real GPU,
no real memory limits. The machine was overloaded (load 13 to 17 on 4 cores) and the battle worker timed out
twice, so several checks could not finish. Script: `scripts/ui/iphone-check.mjs`.

| Check | en | he | Notes |
|---|---|---|---|
| Coach (3 steps) shows and advances | pass | not run | steps differ, closes after the last |
| Circle select, Select mode | pass (run 1) | not run | later runs failed only because the worker timed out under load |
| Circle select, double-tap then drag | FIXED in code, not re-verified in a browser | not run | real code bug, see below |
| Draw a path moves the squads | pass | not run | |
| Hold for help (tech card) | not verified | not run | hold did not open the sheet in the one run that got there (box was overloaded); battle HUD has no hold-help target in this base |
| Safe areas on the start and world screens (47 px inset) | pass (chips, Goals, map-mode buttons, top bar content start at 47 px) | not run | `en-w2-world.jpg` |
| Weekly challenge sheet | pass before the lead hid the button; sheet and banner padding fixed | not run | |
| World Congress sheet | not verified | not verified | screenshots timed out |
| Glossary people entry (history note, uncertain mark) | not verified | not verified | |
| Crisis banner | not verified | not verified | code uses `--safe-start`, so it follows the inset |

## Double-tap lasso: code bug, fixed
The screen rebuilds the gesture recognizer whenever its handlers change, and a tap changes the selection, so the
"last tap" memory was lost and the second tap never counted as a double-tap. The memory now lives outside the
recognizer (`memory` argument of `createGestureRecognizer`, kept in a ref by `TacticalBattleScreen`).
Test: `src/battle/input/gestures.test.js` ("rebuilt between the taps").

## Layout fixes (screenshot QA list)
Fixed: game speed "NaN turns" (the field is `turnLimit`); war label and Peoples card fall back to the id when a
nation has no name; research chip shows the tech name when there is no turn count; Research choice card stays
clear of the rail and End Turn on desktop; age strip cells narrower and stacked on a phone, goal names wrap;
needs-you chips cannot reach the search button; top bar date, turn and research chip are bidi isolated; challenge
sheet and banner respect safe areas; the QA shot script now opens the Empire War section correctly (the
"blank Empire tab" was the script firing the alias `military` as a raw tab id, not a game bug).
Not fixed: World lens button touching the dock edge when a wide panel is open (needs a layout rethink);
"notch" findings for chips, rail and map buttons (they already use `--safe-start`/`--safe-end`; the QA shots had
no inset); goals list under the age strip is a scroll position, not a clip.
