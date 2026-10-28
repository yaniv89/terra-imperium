# Lane battle-hud-8: report

ponytail read in full at 12:09 UTC (28 Oct): `cat .claude/skills/ponytail/SKILL.md`, whole file, and the session start hook printed "PONYTAIL MODE ACTIVE".

Scope: the battle's deploy phase, camera, Economy HUD, powers and the phone layout of those (src/components/battle/, src/battle/input/).
Targets: 8/10 in Deploy (round 2: Sonnet 5, Opus 4), Camera (5, 4), Economy HUD (5, 3), Powers (4, 6), Mobile layout (6, 4).
Inputs: battle playtests ai/human-playtest-40650979770 (Sonnet) and 40651418969 (Opus), report.md and shots.

## Every complaint in my areas (step, shot) and what happened to it

| # | Complaint | Run, steps (shot) | Status |
|---|---|---|---|
| D1 | The deploy card and tips cover about 70% of the field | Opus 3 (step-003), Sonnet 1-11 | Fixed twice: my branch shrank the card and added a slim bar (field 56% -> 72%, hud-shot 1c). battle-screens merged first with the same idea (card on the far side, fold to a slim bar with Start); the merge keeps theirs |
| D2 | The chevron grows the card instead of folding it, and once hid Start | Opus 7-8, 100-101, 242-243, 281-282 (step-101) | Fixed by battle-screens' card (kept in the merge) |
| D3 | The player never positioned a unit: deploy is too slow on a phone | Sonnet coverage, Opus 43, 123, 201, 283 | Fixed (mine): one-tap formations on the deploy card: Line, Wings (cavalry on both flanks; shown only with cavalry), Wide (one long rank, no blob). The chosen one says what it does; placing a squad by hand clears the pick. The default stays the starting line. src/battle/input/deployPresets.js sends one `deploy` order per squad, so the sim is unchanged |
| D4 | Naval deploy says "Take the keep" and "Tap a squad" | Opus 83, 117, 241, 276 (step-083) | Fixed by battle-screens (`bt.hud.goalSea`, `deployTouchSea`); my duplicate keys were dropped in the merge |
| D5 | Single ships cannot be tapped in deploy | Opus 255-256 | Not touched (pick radius is battle-touch's squadPick.js) |
| C1 | Pinch does not zoom (or barely) | Opus 24, 180-181; Sonnet 17 | Fixed. Root cause found with the new camera-probe.mjs (the playtest's own CDP pinch): a pinch out starts with the fingers apart and one lands on a HUD button, so the field saw one finger. Before: pinch 0.6 left the zoom at 1.00; after my fix 1.00 -> 0.52. battle-screens merged the same fix (`pinchFrom`) first; the merge keeps theirs |
| C2 | Drag does not pan | Opus 14-16, 206-208 | Partly: probe shows drag pans in play; in deploy the drag started on the deploy card. The card is now smaller and can be hidden |
| C3 | Idle throws the camera home | Opus 229-231, 236 | Fixed by both lanes; the merge keeps battle-screens' version (stay while one is on screen, else the nearest) |
| C4 | Can't get army and target on one screen | Opus 5, Sonnet 10 | Partly: Find and a control group's second tap now frame the whole army (zoom out until it fits, never in), not its empty middle |
| C5 | Camera lost the fleet; breach Go does not move the camera | Sonnet 68; Opus 232-233 | Not reproduced; Go calls the same lookAt as every alert |
| E1 | Steward toggles with no visible panel | Opus 20-21 | Fixed: the bar's button is now "Economy" and opens an Economy sheet: steward on/off with what it does, gather focus (Balanced, Food, Wood, Stone, Gold, each with how many laborers are on it now), train a laborer at the camp (cost, +n queued), Idle laborers, Auto rebuild. Every change is two taps |
| E2 | The worker mix was one button that cycled five values, only with laborers selected | (code read) | Fixed by E1: one tap per focus |
| E3 | Fire Circle panel covers much of the screen | Sonnet 20 (step-020) | Not touched (info card is battle-screens/art territory) |
| E4 | Only the camp trains; other buildings open nothing | Opus 55-58 | Not touched (needs a barracks-building check, not a HUD fix) |
| P1 | Powers give no visible effect / no idea what they do | Sonnet 16, 129-130; Opus 87, 248, 269 | Fixed: every ability and power has a one-line effect in the wand sheet (numbers from effects.js: "+25% damage for 10 s", "morale +30, no rout for 8 s"); using an ability now says "Charge, 4 squads: ...". A test keeps every POWERS and ABILITIES id described in en and he |
| P2 | Arrow Storm row truncated, "Needs 150 supply, you have 135" squeezed | before shot 3-wand | Fixed: name, effect, then cost or the reason it is blocked, on their own lines |
| P3 | Arrow Storm does nothing while paused (one session) | Opus 132-136 | Not reproduced here; battle-touch owns paused orders |
| P4 | Land powers at sea | Opus 87, 248 | Not touched (needs a naval power set: a design call for the lead) |

## Evidence

Shots (844x390 and 1600x900, en and he) are in plans/lanes/battle-hud-8-shots/. See the "Results" section.

## Results

Field share left by the HUD (hud-shot.mjs, now with `--lang`, a preset, the slim bar and the Economy sheet):

| State | 844x390 before | 844x390 after (en / he) | 1600x900 after (en / he) |
|---|---|---|---|
| Deploy card open | 56.3% | 54.9% / 55.2% (merged card with presets: 48.7% / 49.8%) | 86.2% / 86.2% |
| Deploy card folded | (none) | 72.1% / 72.5% | 90.8% / 90.9% |
| Powers sheet | 38.7% | 35.8% / 36.4% (now with one effect line each) | 80.5% / 80.5% |
| Economy sheet | (none) | 43.9% / 44.1% | 83.5% / 83.5% |

No console errors in any run. Speed and pause never move. Every button is 44 px or more (the Hebrew More button was 36 px; fixed).

Camera probe (`.claude/skills/battle-lab/camera-probe.mjs`, the playtest's own CDP gestures) at 844x390, in play:
- before: pinch 0.6 -> zoom 1.00 (no change)
- after: pinch 0.6 -> 0.52
- drag pans in play both times; in deploy a drag that starts on the card does not pan (fold the card)

Tests:
- new: deployPresets.test.js (slots inside the zone and on open ground for both sides, shooters behind, Wings flanks, Wide wider)
- new: battleHud.test.js Economy sheet case and "every ability and power has an effect line in en and he"
- full `npx vitest run` after merging origin/claude/integration: 507 files passed, 2 skipped; 4747 tests passed, 17 skipped
- `npm run lint`: clean

Sim: no rule changed. The only file under src/battle/sim/ is economy.js `ecoView`: a view field (`gathering`, laborers per stock) for the screen. It is not hashed and not in the replay, so there is no SETUP_VERSION bump and no parity rerun.

## Merge with battle-screens

battle-screens merged into integration while this lane ran and had already done three of my items: the deploy card (far side, fold to a slim bar with Start, sea words), the pinch with a finger on the HUD (`pinchFrom`), and Idle (stay while one is on screen, else the nearest). The merge keeps their versions and drops my duplicates (keys `goalNaval`, `deploy*Naval`, the slim bar). My formation presets sit inside their card, above its scrolling words.

## Shots

plans/lanes/battle-hud-8-shots/: before-844-deploy, before-844-wand; after-844 deploy-wings, deploy-hidden, wand, economy (en and he); after-1600 deploy-wings, economy, he-wand; merged-844 deploy-wings (en, he) and he-economy.

## Not done, and questions for the lead

1. Naval powers: at sea the wand offers land powers (Forced March, Charge). Hiding them, or a naval set (Broadside, Ramming speed)? A design call; I left it.
2. Ships hard to tap (Opus 103-106, 255-256): squadPick.js belongs to battle-touch.
3. Only the camp trains (Opus 55-58): the barracks may not be built yet in those runs; worth a playtest check before a lane.
4. Camera follow: Follow (F) exists and stays manual. I did not make it automatic: moving the camera under a finger is what I188 removed.
5. Grades: not given here (a lane's own score is not a grade). A fresh battle playtest should check Deploy (presets used?), Camera (pinch out), Economy HUD (two taps) and Powers (effect lines).
