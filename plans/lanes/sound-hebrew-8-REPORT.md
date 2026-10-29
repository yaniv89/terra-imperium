# Lane sound-hebrew-8 report (U13, wave 5, 29 Oct)

Plan: plans/2026-10-29-1020-feat-every-area-to-8-plan.md, U13, R14, KTD6. Branch `claude/sound-hebrew-8`.

## For the lead

Design questions: none.

The user's part of KTD6: after one phone session, ask the user for a 1-10 sound score. The gate below passes.

Layout breaks seen in Hebrew shots (not fixed here: other lanes own these screens):
1. Turn 1 map: the culture "per turn, by city" reasons popup stays open over the map and over the era goal card (he-map_political.png, he-city_opened.png before the city opened). It looks like a popup left open by the start flow, not a Hebrew bug. Check in English too.
2. Battle HUD status card: "N arriving" (`bt.hud.arriving`, BattleHud.jsx:486) is the player's count but sits right after the enemy's base number, in the player's colour, so it reads as "7, 2 arriving". Same in English. It wants its own place by the player's number.
3. Map city badges draw "10k" on the canvas in Hebrew (sprite text, not scanned by the audit). Small.

## Findings

| # | Area | Cause | Fix | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Sound gate | No test said every battle sim event has a sound. 10 sim events had none: shieldHit, ability, reserveArrived, deployed, hijacked, looted, pursuit, plus garrisoned, ejected, sideSpent. | battleAudio.js `soundForEvent`: shield-hum, horn-order, bell, fire-crackle, cavalry-charge from existing recordings; garrisoned, ejected, sideSpent silent on purpose (`SILENT_EVENTS`: the order already clicked or the end fanfare follows). | soundRegistry.test.js "sound gate": scans every `w.events.push` type in src/battle/sim and fails on an event with no sound, cue or silent mark (checked: removing `sideSpent` fails it). |
| 2 | Sound gate | Map actions: already covered (ACTION_SOUNDS names every ActionTypes entry). | Gate case repeats it next to the battle one. | same test file |
| 3 | Sound gate | Every age has map and battle music: already true. | Gate case. | same test file, AGE_ORDER |
| 4 | Volumes and mute | Separate music and effects volume and switches already existed (audioSettings.js, Settings > Sound). Battle had a one-tap mute (speaker in the HUD); the map had none. | Speaker button in the world top bar (WorldTopBar.jsx, `top-bar-sound`), the same Sound switch as the battle's. | Gate case: one tap mutes music and effects, the next gives back 0.3 / 0.6. Shot: he-peoples / he-city_* top bar, speaker left of "turn 1". |
| 5 | Hebrew | Buy button title and label used the English city name ("...ב-Mycenae"). endTurnModel.js passed `c.name` raw. | `nameNow('city', null, c.name)`. | hebrew-audit city build steps: 14 screens LATIN before, the only Latin string. |
| 6 | Hebrew | War goal line on the enemy card (`ws.goalCity*`) used the raw English city name. | warStatusModel.js: `nameNow`. | grep of every `{ city: x.name }` in components; that was the other one. |
| 7 | Hebrew audit | The audit's city steps never reached the city: a new game starts as a band (no city), the turn-1 research card and the Settings sheet held the screen. All 14 city "clean" results scanned other screens. | hebrew-audit.mjs city step: let the advisor pick research, close sheets, found the city from the idle chip, open it from the Cities list. | Now "city sheet visible: true" and all 6 tabs, 6 build groups scanned; shots plans/ui/hebrew-audit/he-city_*.png. |
| 8 | Hebrew audit | No check for flipped signs ("10%-") in right-to-left text. | hebrew-audit.mjs: reports a visible RTL text node with a raw sign before a digit (kind `sign`). | Full run: 0 flipped (runtime `isolateSigned` in src/i18n/messageText.js and core.js already wraps them). |

## Hebrew run (844x390, he)

Full hebrew-audit on this branch (vite :5271): 114 screens, 0 Latin, 0 flipped signs, 25 skipped (old script paths for rail tabs, fleet, peace, march bar; they are script gaps, listed in plans/ui/hebrew-audit/report-he.txt). Battle section alone: 10/10 clean (deploy, HUD, HQ card, selection, wand, laborers, build sheet, pause, retreat card, result). City section after the fix: clean except finding 5, fixed.
Looked at by eye: start steps (ready), map, research card, tech web, peoples and nation card, city build, battle HUD, pause sheet. Hebrew reads in order; numbers are left to right; nothing clipped.

## Tests

`npx vitest run src/audio/soundRegistry.test.js src/battle/audio/battleAudio.test.js src/audio/audioSettings.test.js`: 29 passed (gate cases included). `npm run test:related` on the changed modules: 8 files, 50 passed. Lint: zero warnings on changed files.
