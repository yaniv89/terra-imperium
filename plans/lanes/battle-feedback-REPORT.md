# Lane report: battle feedback (claude/battle-feedback)

Goal: battles that read clearly (playtest summary: combat clarity 3/10, unit readability 4/10), in
the renderer, HUD and result screen only. The sim is untouched: `git diff claude/integration -- src/battle/sim`
is empty, so battle hashes, SETUP_VERSION and parity cannot move. No new sim order was needed.

Shots: `plans/game/battle-feedback/` (before-*, after-*), sandbox at 844x390 (phone, DPR 2) and
1600x900, a field battle (`fort=0`) and a walled city (`city=medium&fort=2`), bronze and modern.
Before shots come from the base commit served by a second dev server (its HUD font falls back to
the system font: a symlink quirk of that copy, the battlefield is the same).
Scripts: `.claude/skills/battle-lab/feedback-shots.mjs` (the staged fight shots, `ZOOM=2.2` for a close
camera) and `feedback-cost.mjs` (the overlay code timed alone).

## Research (the patterns, not the assets)

- Total War: each unit's banner carries a bar for morale that goes from green to yellow to red; the
  banner flashes while the unit wavers and turns white when it routs
  ([Total War manual, morale](https://r2encv2.totalwar.com/en/manual/single-player/0087_enc_page_battle_play_phase_conflict_morale/index.html),
  [Warhammer wiki, Break](https://totalwarwarhammer.gamepedia.com/Break)).
- Age of Empires IV: players ask for health bars that stay up on injured units without clicking
  them ("smart" health bars) ([forum](https://forums.ageofempires.com/t/needed-per-unit-health-bar-always-on-better-micro/178869),
  [forum](https://forums.ageofempires.com/t/smart-healthbars-disappear-after-a-few-seconds/233920)).
- Hit feedback: highlight the HP bar the moment a unit is hit, so the player sees damage land
  ([RotMG remaster notes](https://remaster.realmofthemadgod.com/?p=330)).
- StarCraft II / AoE: every order answers at once with a marker at the target in the order's colour
  (move, attack) plus a voice line ([Blizzard unit controls](https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls)).
  The game already plays a voice line per order (battleAudio `orderConfirmed`); the marker was small.
- Attacking buildings: in AoE and SC2 a click on an enemy building with troops selected is an attack;
  Total War adds an attack button on the target. Here the tap already attacks a structure
  (`attack`, target kind `structure` / `eco` in sim/orderSchema.js), so only the HUD path was missing.

## What was weak (before) and what changed

| # | Weak (evidence) | Change | Reference | After evidence |
|---|---|---|---|---|
| 1 | Result screen said "Yours lost 0 of 63,000" next to "1 regiment destroyed" (playtest 40550100958 steps 82, 102). Cause: outside a campaign (`battleResultModel`, no receipt) losses were `sum(start) - sum(end)` over the army list, but the end list includes reinforcements that joined (not in the start), so a joined 700 strength hid a destroyed regiment, clamped to 0. | `lossOf` now matches unit by unit (army and joined reinforcements as the start) and uses the ledger's own arithmetic (`sideTotals`, battleLedger.js), so lost, destroyed and fled come from one source, the same as the campaign path. | Playtest: "compute men lost and regiments destroyed from the same source". | New test in battleHudModel.test.js (a joined reinforcement and a destroyed regiment: lost 30, destroyed 1). |
| 2 | "No clear way to attack walls, gates or buildings": the Enemy button showed the target but could not order an attack (steps 42 to 63). | The Enemy caption gets an **Attack it** button (44 px tall): the selection, else the whole army, attacks that target (keep: `structure` 0; a base building: `eco`), with the same ring, marker and pending mark as a tap. The caption stays 7 s while it has the button (3.5 s otherwise). | Total War's attack on a target; AoE/SC2 click-to-attack buildings (already worked by tapping a building). | `after-enemy-caption-en-phone.jpg`, `after-enemy-caption-he-phone.jpg` (Hebrew mirrors). Browser check: after the tap 8 of 10 player squads had order `attack` (the two others were not checked; likely not on the field yet). In Hebrew the caption and button render mirrored; the tap there was not confirmed by the script (the first-battle tip was still open). |
| 3 | Repeated unwanted radial menu after arming Attack and tapping near own troops (steps 11, 41, 46, 49, 52): a press on a selected squad held past 380 ms opened the radial even with Attack armed. | With an order armed, a press is that order's target (long press = attack-move there), never the radial (gestures.js `isArmed`). | Playtest suggestion: "never open it while an Attack order is armed". | New test in gestures.test.js. |
| 4 | Order confirmation hard to see: the marker ring was 1.7 tiles (about 20 px on a phone at the default zoom), grew outward and vanished in 0.8 s. | Markers are at least 46 px on screen, close in on the spot (a ring shrinking from 1.6x to a point over 1.1 s) round a small steady inner ring, the SC2-style "order taken" pulse. | SC2/AoE order markers. | Drawing only; seen in the browser runs (not caught in a still: it lives 1.1 s). |
| 5 | Squad flags (the phone readout at the default zoom, squadBadges.js) showed only side colour and strength share: no morale, no hit, no rout. In `before-field-modern-phone.jpg` every enemy flag looks the same full red bar; a squad that broke kept its normal flag. | Each flag: strength in the side's colour over a dark red "lost" track, a morale strip under it (parchment, amber when shaken under 40), a white flash for 4 ticks when the squad is hit, and when routed a grey bar, a blinking white strip and a small white flag on a pole. 30x13 px (was 26x9). | Total War banner (morale colours, white on rout); hit flash on the HP bar. | `after-field-bronze-phone.jpg` (lost segments, a routed enemy with its white flag), `after-city-bronze-phone.jpg` (routed squad: grey flag, white flag, pale disc). |
| 6 | Close up (zoom above 1) the 3D strength bar was green on red only, 1.08 x 0.16 tiles, and drawn as well under the flags at the default zoom (two bars on one squad). | 3D bars only closer in than the default zoom (the flags cover the default and wider); green / amber / red by strength, a morale strip under the bar, the track flashes pale when hit, routed bars pulse grey; at least 34 x 5 px on screen. Shown on any squad hit in the last 3 s too, not only one swinging. | AoE "smart" health bars; Total War morale colours. | `after-close-field-bronze-phone.jpg`, `after-close-field-modern-phone.jpg`. |
| 7 | A hit was not visible on the figures except the Hit clip on a couple of front men. | The squad's figures flash warm white for 3 ticks (0.15 s) after a hit (team parts on GLB models). | Hit flash (CoH, SC2 shields). | Drawing only; too short for a still. |
| 8 | A routed squad was only greyed and turned to run. | Its ground disc shows and pulses pale (with the grey bar and white flag above). | Total War: white banner on rout. | `after-city-bronze-phone.jpg`. |

Not changed, with reason:
- Death and fall: soldiers already fall as corpses with a blood spray where they stood
  (`dropCorpses`, `spillBlood`); the shots show it reads.
- Selection rings, attack lines (order target ring and dashes, orderTarget.js), projectiles and
  impact puffs: already present and visible in the shots; no evidence they were the weak point.
- The melee "blob": the flags (side colour, strength, morale) now say who is who and who is losing
  in a blob; separating figures would be a sim or layout change, out of this lane.
- Damage numbers: no RTS reference above uses floating numbers for squads; they would clutter a
  phone screen.

## Frame cost

The container has no GPU (SwiftShader, about 1.5 s a frame), so whole-frame times from
render-bench are noise (two base runs differ by 2x). Instead `feedback-cost.mjs` times the changed
code alone on one frozen frame of the 300-a-side bench battle (612 squads, about 118 hurt), median
of 60 repetitions, base and change interleaved twice (Chromium's timer resolution is 0.1 ms):

| zoom | drawSquads before | drawSquads after | flags before | flags after |
|---|---|---|---|---|
| 1 (default) | 0.4, 0.9 ms | 0.5, 0.3 ms | 0.2, 0.3 ms | 0.3, 0.2 ms |
| 2.2 (close) | 0.2, 0.2 ms | 0.2, 0.2 ms | 0, 0 ms | 0, 0 ms |
| 0.45 (far) | 0.6, 0.3 ms | 0.4, 0.4 ms | 0.1, 0.1 ms | 0.2, 0.2 ms |

Within the timer's noise: at most about 0.1 ms a frame. Draw calls: one more instanced mesh (the
morale strip) closer in; at the default zoom render-bench counted 109 to 111 calls after against 116
before (the 3D bars no longer draw under the flags).

## Tests

- `npx vitest run src/battle src/components/battle src/engine/tacticalBattle.test.js src/engine/battleVerify.test.js`:
  93 files, 1051 passed, 1 skipped (kernel hash chain, replay, parity guardrail, golden tests included).
- `npx vitest run src/i18n src/components/battle/battleHebrew.test.js`: passed (new keys in en and he).
- ESLint on every changed file: clean.

## Files

- src/components/battle/battleHudModel.js (+test): result losses unit by unit; objectives carry their target.
- src/components/battle/TacticalBattleScreen.jsx: Attack it on the Enemy caption; `isArmed` for gestures.
- src/battle/input/gestures.js (+test): no radial while an order is armed.
- src/components/battle/squadBadges.js (+test): morale strip, hit flash, rout cue, lost track.
- src/battle/render/BattleRenderer.js: 3D bars (colours, morale strip, hit flash, size on screen, only
  closer than the default zoom), figure hit flash, routed disc, order markers.
- src/i18n/locales/ui/hud.en.js, hud.he.js: `bt.screen.attackIt`, `bt.screen.attackingIt`.

## Left open

- The land battle stall (both armies idle) belongs to another lane.
- A real-phone frame check (real GPU) is still worth doing: `?battleSandbox&bench=300&autostart&perf`.
