# Lane report: battle touch (claude/battle-touch)

ponytail read in full at 2026-10-28 08:43 UTC (session start hook also printed PONYTAIL MODE ACTIVE).

Goal: battle "Selection and orders on touch", "Powers", "Combat clarity", "Unit readability" at 8/10
(round 2 playtest run 40650979770 rated them 3 to 5). Lead additions during the lane: run 40650973042
step 84 to 87 (pause sheet Retreat), run 40651418969 step 29 to 32 (Attack + tap, radial, minimap do
nothing), run 40651416284 step 166 (Attack it with nothing selected).

Scope kept: HUD, input, render only. `git diff origin/claude/integration -- src/battle/sim` is empty:
no hash, parity or SETUP_VERSION change, no new order (the minimap reuses `attackMove`, `power`, `rally`).

## Root causes found

| Report | Cause in the code | Fix |
|---|---|---|
| "Attack still armed" after taps; Attack + tap does nothing, long press works (40651418969 step 29 to 32) | gestures.js took a touch as a tap only if lifted within 260 ms; a still press of 260 to 380 ms was neither a tap nor a long press and was dropped. In the headless browser the long-press timer also fired seconds late (slow frames), so a press past 380 ms could fall in the same hole. | A still press is a tap until the long press takes it; a press lifted past LONG_MS whose timer never ran is still a long press (ground) or opens the radial (a selected squad). 3 new tests in gestures.test.js. |
| Radial menu's Attack does nothing / "Attack toggles itself off" | The radial's Attack called `arm('attackMove')`, a toggle: with Attack already armed it disarmed. | The radial's Attack always arms. |
| Attack + minimap tap does nothing | The minimap only moved the camera. | With Attack, a strike or a rally point armed, a minimap tap lands that order there (`orderAtGround`, BattleMinimap `onOrderAt`); otherwise it moves the camera as before. |
| No feedback that an order landed | Only a 1.1 s ground marker. | A chip while Attack is armed ("Tap the ground or an enemy to attack", X to cancel) that goes when the order lands, and a note "Attack-move: N squads on their way." (arrival notes follow it; while paused the "starts when you resume" note leads). |
| "Attack it" vanishes before it can be tapped (40650979770 step 96 to 104) | It already ran on real time (setTimeout 7 s), but 7 s is shorter than a player reading at 3x. | The Enemy prompt stays until Attack it, its X, or its target falls (checked on each HUD update). Other notes stack above it. |
| Attack it with nothing selected silently does nothing (40651416284 step 166) | It already falls back to the whole army; it was silent only with no fighting squad on the field. | Says "No troops on the field to send..." instead. In the browser, Attack it with nothing selected put 4 to 10 of the army's squads on `attack` in all seven ages (see below). Step 166 itself (the warband stayed idle with the keep under fog) did not reproduce in the sandbox; if it recurs it is a sim targeting question for battle-engage. |
| 3x tap at x778 opened the pause sheet (step 12) | 8 px between the 3x button and Pause. | 20 px gap (`ms-3`), positions unchanged between states (hud-shot). |
| Pause sheet: a tap meant for Switch to Auto hit Retreat, then the confirm's top button routed the army (40650973042 steps 86 to 87) | Retreat sat next to Switch to Auto; the confirm listed "Sound the retreat" first. | Retreat moved to the bottom of the sheet, away from Switch to Auto; its confirm lists Keep fighting, Auto instead, then the retreat last with a gap. |
| Defence prompt: Command missed two taps at x=285 (same run, steps 201 to 203) | No hit-area bug found: ModeCards are three equal full-height grid cells, so x=285 is the Auto card in a ~470 px sheet, x=132 is Command. | None. Possible follow-up for the lead: a stronger selected state on the cards. |
| Powers show no visible effect (step 130) | Only strikes and Ambush drew a ring; Rally Cry drew small markers; EMP, Hijack, Cyber Jam and Drone Recon drew nothing. | src/battle/render/powerFx.js: every power of every age gets an area ring (held 2 s), a burst ring plus rising sparks in its colour on each squad it touched (Rally: your fighters; EMP: enemy machines in range; Jam: enemy squads; Hijack: the seized robot), and a label in the order note ("War Cry: 9 squads rallied, morale +30", "Drone Recon: the whole field revealed", "The enemy used Artillery Barrage!"). powerFx.test.js walks every POWERS entry. |
| Banners small and crowded; armies read as one blob (step 41) | Flags were bars only, no class, and overlapping flags piled up. | Each flag carries a class glyph (NATO style: infantry cross, cavalry slash, ranged chevron, siege dot, other plus) on the side's colour; flags of one side that would overlap on screen merge into one with "xN", the group's strength and its weakest morale (`clusterFlags`, tested). |

References used: StarCraft II / AoE IV order feedback (a marker plus an acknowledgement for every order;
an armed command shows a targeting state until the next click), Rise of Kingdoms (a tap on the map or
the minimap is the order target once a command is chosen), NATO unit symbols for class at a glance.

## Evidence (844x390, touch, Chromium headless; shots in plans/game/battle-touch/)

Before: `before-attack-it-gone-playtest-step104.jpg`, `before-rally-no-effect-playtest-step130.jpg`,
`before-flags-blob-playtest-step041.jpg` (playtest shots), `before-flags-844x390.jpg`, `before-pause-sheet-844x390.jpg` (hud-shot on the base).
After: `after-attack-it-10s-modern.jpg`, `after-attack-armed-chip-bronze.jpg`, `after-ground-order-stone.jpg`,
`after-minimap-order-kingdoms.jpg`, `after-rally-cry-gunpowder.jpg`, `after-war-cry-stone.jpg`,
`after-drone-recon-information.jpg`, `after-pause-sheet-844x390.jpg`, `after-flags-844x390.jpg`, `after-flags-zoom04-kingdoms.jpg`.

Script: `.claude/skills/battle-lab/touch-shot.mjs` (`PART=orders` / `PART=powers`, `AGES=`). Result of
`PART=orders`, all seven ages (stone to future), no console errors:
- Armed chip shown; one ground tap lands the order ("Attack-move: N squads on their way.").
- A 320 ms still press lands it (was dropped before).
- A minimap tap with Attack armed lands it with the same note.
- Enemy at 3x with nothing selected: Attack it still there after 10 real seconds; after the tap
  8/9, 10/10, 6/8, 10/10, 9/9, 10/10, 4/5 squads had an `attack` order (the rest were already fighting).
- Radial: confirmed in a separate probe (bronze): a long press on a selected squad opens it, its Attack
  arms, the next ground tap lands. In the all-ages script the radial check timed out: headless frames
  starve the long-press timer by about 3.5 s, which is why the starved-timer fallback was added.
`PART=powers`: Rally/War Cry label, wash and per-squad bursts in all seven ages; Ambush and Drone Recon
labels seen. Most strikes were "not ready" in that run (Rally Cry spent the supply first), and the EMP
tap missed (the card sat off screen in the wand list). The rings for strikes were seen on the enemy's
Artillery Barrage; every power's ring and label is covered by powerFx.test.js.

hud-shot.mjs after: field share unchanged in every state (deploy 56.3%, army 68.8%, paused 54%),
speed group at 640 (was 652), pause at 792 in every state, no console errors.

Tests: battle, render, input and i18n tests green (842). Full `npx vitest run` before the merge: 3 failures
outside this lane's files (sight, stoneAI "two raids at once", cities 150 ms timing), all three green
alone (load flakes). After merging origin/claude/integration (fad52830..): `npm run lint` clean, full `npx vitest run` 504 files passed, 2 skipped, 4,720 tests passed, 0 failed.

## Not done / open for the lead
- Not checked on a real phone; Hebrew strings are mine, unreviewed by a native speaker.
- A first tap on the pause sheet's Retreat now needs a scroll at 844x390 (it sits under the tally); intended.
- Grades: no fresh playtest run (no API use in this lane). Suggest re-running the battle-commander persona.
