# r3-battle lane report

ponytail read in full at 2026-10-28 18:32 UTC (session start hook printed PONYTAIL MODE ACTIVE; `cat` of the whole SKILL.md at the first step).

Source: round 3 Opus battle playtest, branch ai/human-playtest-40736779836 (battle-commander, 844x390, en).
Branch claude/r3-battle from origin/claude/integration. No sim change, so SETUP_VERSION stays 30 and parityEco was not rerun. No API use.

## The finding behind most of the report: the harness's taps were long presses

`scripts/ai/human-playtest.mjs` sent a tap as `await touchStart; wait 60 ms; touchEnd`. CDP answers a touch only after
the page handled it, and a battle frame on the CI browser takes seconds, so touchEnd was sent seconds later.
Measured on the canvas (pointerdown and pointerup timeStamp): the old tap was **4,326 ms** long, the same tap with
explicit event timestamps **60 ms**. Every canvas tap the persona made was a long press (LONG_MS 380).
A long press with nothing selected did nothing, which is exactly "tapping a squad shows no selection" (steps 3 to 6,
10 to 11, 17 to 18, 31 to 32). The drag of step 47 likewise took about 12 x 4 s while the ships moved.

Fix in the harness: every touch event carries its own timestamp (tap, double tap, long press and drag). Grades
from earlier battle playtests on touch input (deploy, selection, box select) were measured with stretched gestures.

## 1. Deploy: tap a squad, then place it (fixed)

- Root cause in the game too: a press held past LONG_MS with nothing selected had nothing to order, so it was dropped.
  A real player who presses a squad a little slowly (or a slow phone frame) got the same dead tap.
  Now such a press is a tap and selects (src/battle/input/gestures.js, both the timer and the starved-timer path;
  new test in gestures.test.js). With a selection the long press is still attack-move or the radial, unchanged.
- The deploy card names the selection in the player's colour: "Selected: Hunters. Tap inside your zone to place it."
  (BattleHud.jsx `battle-deploy-selected`, en and he). Before, the selection pill was hidden until Start.
- Evidence, `.claude/skills/battle-lab/deploy-tap.mjs` (stone open field, 844x390 touch, Line then a tap on a squad, then a tap in the zone):
  - before: `tap on squad middle: rings 0 sel []`, `tap in zone: squad now at 391,183 (was 391,183)`
  - after: `rings 1 sel [2] panel "Selected: Hunters. Tap inside your zone to place it."`, `squad now at 301,223 (was 391,183)`
  - shots: r3-battle-shots/deploy-before.png, deploy-after-selected.png, deploy-after-placed.png, deploy-he.png

## 2. Laborer cost: the HUD said 50, 80 was spent (explained, one source already; note added)

- The price shown (EconomyHud `UNITS.worker.cost`) and the price charged (sim/economy.js `pay(UNITS[role].cost)`)
  are the same table. New test (sim/economy.test.js "a laborer costs exactly the price the HUD shows"): the train
  order moves `spent` by exactly UNITS.worker.cost.
- The extra 30 food: on a phone the steward runs the base from Start (TacticalBattleScreen: `layout.startsWith('phone')`)
  and spends from the same stock in the seconds between the persona's steps.
- Fix: training a laborer now says "Queued: Laborer, paid 50 food" and, with the steward on, "Your steward spends
  from the same stock." (EconomyHud `laborerNote`, en and he).

## 3. Sea battle opening and box select of ships

- Opening (`.claude/skills/battle-lab/navalOpen.sim.js`, the sandbox's 5 against 4 ships, you idle, 2,400 ticks):
  first hit 2.3 s after Start in every age (kingdoms 5.2 s, gunpowder 4.0 s); first ship lost at 63 to 74 s
  (classical), 112 s or never (information, future). No ship is lost before a human can act; the step 47 loss came
  from the harness's 4 s taps at 1x over several steps. Spawn spacing (NAVAL_GAP, "close enough to meet at once")
  is left as is: no sim change.
- Box select: it tested only each ship's centre, while a ship is a long hull (picked by SHIP_PICK_TILES on a tap).
  Now a box that reaches the hull takes the ship (TacticalBattleScreen lassoEnd, the same SHIP_PICK_TILES).
  `.claude/skills/battle-lab/naval-select.mjs` with a box 12 px inside the outer ships' centres (`PAD=-12`):
  classical 6 of 6, information 6 of 6 caught (the old centre test would take 3 of 6 in the classical box).
  With a box around the centres both old and new take 6 of 6.

## 4. Units small at the default zoom on a phone

Measured at deploy, 844x390 touch (soldier height on screen, own squads on screen):

| case | before (15 tiles) | after (13 tiles + fit) |
|---|---|---|
| stone field | 22.1 px, 7/7 | 25.8 px, 7/7 |
| kingdoms sack | 21.7 px, 8/8 | 25.1 px, 8/8 |
| gunpowder field | 21.7 px, 8/8 | 21.5 px, 8/8 (spread line: framed out) |
| modern walls | 22.3 px, 7/8 | 20.6 px, 8/8 |
| future sack | 21.3 px, 8/8 | 24.6 px, 8/8 |
| classical / information sea | | 26.2 px, 6/6 |

- PHONE_VIEW_TILES 15 -> 13 (BattleRenderer.js; the farthest zoom is unchanged, minZoom scales with it).
- The first frame now frames the army (`frameGround`, zooms out only, middle 75%) instead of only centring on it, so
  a long line is never cut by the HUD. Models untouched.
- Shots: r3-battle-shots/zoom-*.png.

## 5. Sack defence: the opening (end rule left to lead-battle-fixes)

- `sackTrace` (kingdoms, fort 2, seeds 7 to 9, you idle): raiders reach the town and lose men at 10 to 20 s; they
  withdraw at 43 to 54 s (the end rule, lead-battle-fixes' area, untouched).
- The deploy phase is paused and untimed, so the player can already prepare before Start; nothing said so.
  Now the deploy card of a raid or sack defence says first: "First: the raiders reach your houses seconds after Start.
  Place your squads between them and the town now." and Start says "The raiders are coming. Tap Enemy to see them,
  then All and Attack to meet them." (en and he).
- Not done, for the lead to decide: holding the raiders at their edge for a beat after Start (a sim change in
  tacticalAI.js thinkRaider: SETUP_VERSION bump and parityEco rerun). I did not do it because the untimed deploy
  already gives the time, and the battle's length is the end rule's question.

## Tests

- New: gestures.test.js (a held press with nothing selected is a tap), economy.test.js (laborer price).
- Targeted: src/components/battle, src/battle/input, src/battle/sim/economy.test.js, src/i18n: all green.
- Full `npx vitest run`: see the last section.

## Not checked / risks

- The closer phone camera is tuned on the sandbox armies; a campaign army much wider than these frames out to fit.
- The deploy card still covers the right third of the screen (playtest issue 6, not in this brief).
