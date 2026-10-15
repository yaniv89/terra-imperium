# Plan: the GPT mobile QA audit (93 turns, Akkad, Chrome 844x390), 14 October 2026

Source: the user pasted a GPT audit of a 93-turn campaign played in desktop Chrome at 844x390 and
667x375. GPT's browser control died at turn 93 during a Kish siege offer and Chrome then vanished.
GPT called that a tool blocker. Read with the user's own iPhone crashes (Safari "A problem repeatedly
occurred", many reloads on the map and in battles), it is most likely the same thing: memory. The art
session measured textures that are never freed (about 64 MB per town file, 500 to 650 MB in a city
battle, the map's WebGL context kept alive under the battle).

Every row below says what we do, who does it, and how big it is. IDs are GPT's.

## 0. Already covered by running lanes (do not duplicate)

| ID | What | Lane |
|---|---|---|
| Chrome death at T93 | Memory: texture caches never evicted, ImageBitmaps never closed, battle renderer never releases its context, map context alive under battles | Crash hunt (`claude/pa-w7-crash-hunt`) |
| MAP-01 (part) | Units shrink on zoom, fog borders, resources in fog | Map zoom and fog (`claude/pa-w7-map-zoom-fixes`) |
| ACT-01 wording | "Invade from Jerusalem" while the army is far away | Battle fog and texts (`claude/pa-w7-fog-texts`) |

## 1. Wave A: broken flows (P1, do first, small to medium)

| ID | Problem | Fix | Size |
|---|---|---|---|
| DEF-01 | Command on a militia-only city with low siege HP returns to the campaign, records Auto, the city falls | Find why `battleOpenGuard` / `BEGIN_DEFENSE_BATTLE` falls back (likely "nobody on a side" when only militia defends, or the new empty-city rule in cityAssault.js). Either launch the battle with the militia, or say on the card before the tap why Command is not possible. Never record Auto when the player chose Command without telling them. | M |
| ACT-01 | Halted army, march to Hagmatana, "Attack now" opens the province card and no battle; next turn nothing | Trace `MarchBar` / `marchBarModel` and `attackReach` against the new rule set (decision 41 Auto-only no-man's-land, empty-city Auto attack, `canAttack` for independents, supply 0). Every refused attack must show its reason on the button or the card. Add a test per refusal reason. | M |
| ECON-02 | Military summary says 0 campaigning, 0 consumption while six regiments abroad starve and the meter drains 18 a turn | The summary must read the same selectors as the supply meter (`supplyMeter.js`, `marchingUnits`). One source, a test that both agree. | S |
| ECON-01 | Forecast 145 gold, actual 137: marching upkeep missing from the forecast | Add march upkeep (`MARCH_UPKEEP_SHARE`, routes.js) to the income forecast; test forecast equals next turn's change. | S |
| BUILD-01 | City Build: the floating queue card covers advice and rows; at 667 almost no list left | Reserve the queue bar's height in the scroller (no overlap), collapse the long-build advice into one line with a "more" tap, show cost and ETA on the row. Check 844x390, 667x375, 844x340. | M |

## 2. Wave B: truth in reports and peace (P2, small)

| ID | Problem | Fix | Size |
|---|---|---|---|
| LOGIC-01 | "4,295 soldiers" becomes "42,950 men" | Every surface uses `menOf` / `menText` (battleLedger.js). Grep for `MEN_PER_STRENGTH`, `* 10` and raw strength shown as people; one label everywhere. | S |
| LOGIC-02 | Auto report: all 2,130 defenders lost, yet "garrison driven back to Kish" | Narrative lines from the ledger (fled > 0 to say driven back), test. | S |
| REPORT-01 | "Won" filter with no victories still shows a defeat's detail; filters crowd | Clear the detail when the filtered list is empty; filters on their own row. | S |
| REPORT-02 | A battle recorded as Auto says "commanded battles have no replay" | Footer text from the recorded mode. | S |
| PEACE-01 | "They are winning" at war score 0 with no battles | Show score and willingness separately ("They will not accept: their capital is safe, -10"). | S |
| PEACE-02 | Reparations peace does not say Agade stays theirs | The offer lists ownership changes, reparations and the truce end turn. | S |
| ECON / DIP-02 | Assigned diplomat shows no opinion effect | Check the diplomat rule; if it works, show its line in "Why"; if not, fix. | S |
| Settlers T87 | Agade's settlers stand in Israeli land with no known site | Ownership after capture: a captured city's settlers must change hands or go home; test. | S |

## 3. Wave C: layout on short phones (P1/P2, medium)

| ID | Problem | Fix | Size |
|---|---|---|---|
| START-01 | Setup People: about 3 rows at 667x375, 1 at 667x285 | List and detail split: a dense list (name, region, one line), details on tap; Next pinned outside the scroller; filter chips scroll with an overflow cue. | M |
| START-02 | Ready: values truncated beside wide Change buttons | Wrap values; a small pencil per row instead of the wide buttons. | S |
| MAP-01 | Reset zooms to a world view of mostly fog | Rename to "Fit world"; add Home (capital) and Selected army buttons through `mapCamera.js` `cameraTarget`. | S |
| Campaign sheets | Province and detail sheets compress the map | Already one-card-at-a-time on phones (useInteraction); check the province plus detail pair and fix the offender. | S |
| Siege offer | Mode and Begin can fall below the fold | Troops, risk and objective first; mode and Begin pinned in a sticky footer; Command restrictions explained before the tap (joins DEF-01). | S |

## 4. Wave D: RTS on a phone (P1, larger)

| ID | Problem | Fix | Size |
|---|---|---|---|
| RTS-01 | Placement and camera help speaks of right-click, right-drag, wheel | Touch-first help on touch devices: tap to select, tap ground to move, Attack then tap, two fingers to pan and pinch, drag a selection to draw a line. A short first-battle coach (3 steps, skippable, once per device). | M |
| RTS-02 | At 667x375 the two bottom groups nearly span the width; minimap, resources and panels compete; trees and small models hinder taps | Re-run the CB19 HUD measure at 667x375 (it was tuned at 844); collapse the logistics row behind one button on narrow screens; the new tap areas (squadPick.js) and the fog lane's tree hiding help selection. Target: 70% field visible at 667x375. | M |
| RTS-03 | Orders given while paused show nothing until Resume | Show the pending order (marker, ghost, cost) at once while paused. | S |

## 5. Wave E: verify, then balance (after A to D)

- Real iPhone Safari pass by the user (home-screen app): crash-free 100 turns, safe areas, toolbar collapse, gestures.
- Same-state Auto vs Command comparisons (battle-lab parity on the defence kinds), siege persistence after the attacker withdraws, tribute refusal as a cheap cause for war vs the paid claim, AI committing weak stacks to a fortified city (I091-style "poor commitment").
- GPT continues the campaign to turn 400 on the fixed build (late eras, fleets, conquest, victory) and reports in the same format.

## 6. Order and lanes

1. Now: crash hunt, map zoom and fog, battle fog and texts (running).
2. When the crash hunt lands: Wave A as one Opus lane (flows: DEF-01, ACT-01) and one Sonnet lane (ECON-01, ECON-02, BUILD-01).
3. Then Wave B (Sonnet) and Wave C (Sonnet) in parallel, then Wave D (Opus, battle UI).
4. Merge each to `claude/integration`; to `main` only after a full suite, a build and a crash-free memory run.

Counts: about 28 rows (5 already in running lanes), about 23 new tasks.
