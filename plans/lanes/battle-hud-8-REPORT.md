# Lane battle-hud-8: report

ponytail read in full at 12:09 UTC (28 Oct): `cat .claude/skills/ponytail/SKILL.md`, whole file, and the session start hook printed "PONYTAIL MODE ACTIVE".

Scope: the battle's deploy phase, camera, Economy HUD, powers and the phone layout of those (src/components/battle/, src/battle/input/).
Targets: 8/10 in Deploy (round 2: Sonnet 5, Opus 4), Camera (5, 4), Economy HUD (5, 3), Powers (4, 6), Mobile layout (6, 4).
Inputs: battle playtests ai/human-playtest-40650979770 (Sonnet) and 40651418969 (Opus), report.md and shots.

## Every complaint in my areas (step, shot) and what happened to it

| # | Complaint | Run, steps (shot) | Status |
|---|---|---|---|
| D1 | The deploy card and tips cover about 70% of the field | Opus 3 (step-003), Sonnet 1-11 | Fixed: the card is shorter on a phone (goal moves to More, the objective card above already says it) and a Hide button folds it to a slim "Deploy / Start" bar: field 56% -> 72% (hud-shot 1c) |
| D2 | The chevron grows the card instead of folding it, and once hid Start | Opus 7-8, 100-101, 242-243, 281-282 (step-101) | Fixed: the chevron now hides the card (slim bar keeps Start); More/Less is a labelled text button next to Start, so Start never moves |
| D3 | The player never positioned a unit: deploy is too slow on a phone | Sonnet coverage, Opus 43, 123, 201, 283 | Fixed: one-tap formations on the card: Line, Wings (cavalry on both flanks; shown only with cavalry), Wide (one long rank, no blob). Each says what it does. The default stays the starting line |
| D4 | Naval deploy says "Take the keep" and "Tap a squad" | Opus 83, 117, 241, 276 (step-083) | Fixed: "Sink or scatter the enemy fleet before the clock runs out", "Tap a ship ..." (en, he) |
| D5 | Single ships cannot be tapped in deploy | Opus 255-256 | Not touched (pick radius is battle-touch's squadPick.js) |
| C1 | Pinch does not zoom (or barely) | Opus 24, 180-181; Sonnet 17 | Fixed, root cause: a pinch out starts with the fingers apart and the second one lands on the HUD (bottom bar), so the field saw one finger and panned. camera-probe.mjs before: pinch 0.6 left zoom at 1.00. Now a second finger anywhere joins the pinch (gestures.js, test) |
| C2 | Drag does not pan | Opus 14-16, 206-208 | Partly: probe shows drag pans in play; in deploy the drag started on the deploy card. The card is now smaller and can be hidden |
| C3 | Idle throws the camera home | Opus 229-231, 236 | Fixed: Idle only moves the camera when none of the idle squads is on screen |
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

(filled after the runs)
