# Playtest session brief

Paste this into a fresh Claude session (desktop app, this repo) with the four fields at the top filled in. One session plays one persona. The plan is plans/2026-10-29-1020-feat-every-area-to-8-plan.md (KTD3, KTD4, U2).

- Round: `<A | B | interim-YYYY-MM-DD>`
- Persona: `<newcomer-phone | civ-veteran | warmonger | battle-commander | hebrew-speaker>`
- Language: `<en | he>`
- Build: the dev server on the main checkout (`claude/integration` at `<commit>`), port 3000 (the user's server) or your own `npx vite --port <free port>`

## Rules

1. First load the ponytail skill and follow it all session.
2. You are a player, not a developer. Do not read code, lane reports, plans or the dashboard. Do not edit any file except your own report and shots.
3. Play in the built-in browser (mcp__Claude_Browser__*). Emulate a phone held sideways: `resize_window` 844x390, then reload. Play one slice at 1600x900 near the end.
4. Persona text, goals and the actions you must do before you grade: `PERSONAS` and `MUST_DO` in scripts/ai/human-playtest.mjs. Do every MUST_DO action for your scene for real before you score its area.
5. Taps: use clicks and the page's own touch gestures. Say so when a gesture can only be tested with a mouse.
6. Self-check after 10 minutes: the game loaded, taps register, turns advance. If not, stop and report the blocker; that run does not count.

## What to play

- **newcomer-phone:** a new Fast game with a coastal people, about 250 actions: Stone to Classical, found cities, research, one commanded battle and one on Auto, a ship, a save and a reload.
- **civ-veteran:** about 400 actions on Normal: cities, tech tree, diplomacy, the World Congress or a crisis; then load a late-age save (Modern or later) and play 30 turns there.
- **warmonger:** about 330 actions: early army, declare war, march, a siege, a landing from the sea, every battle commanded.
- **battle-commander:** the battle sandbox (`/?battleSandbox`) in each setup of `BATTLE_SETUPS` (field, walls, naval, sack) across at least four ages, plus one campaign battle.
- **hebrew-speaker** (or any persona with Language he): the same as newcomer-phone in Hebrew.
- **interim:** 60 turns Fast with a coastal people, one commanded field battle, one siege, one sea action, a save and reload, one late-age save slice, 10 turns in Hebrew.

## Report

Write `plans/playtests/<round>-<persona>.md` with shots in `plans/playtests/<round>-<persona>/`, in the shape of plans/playtests/manual-2026-10-29.md:

1. What you played (people, speed, turns, battles).
2. Scores 1-10 for every area in `AREAS` (campaign) or `BATTLE_AREAS` (battle) from scripts/ai/human-playtest.mjs, using those exact names. For every score under 8: the cause, the step, and a shot.
3. Top 10 problems with a way to reproduce each.
4. Bugs (wrong text, wrong numbers, crashes, console errors from `read_console_messages`).
5. Best three things.
6. Would you keep playing, and what would bring you back.

End your turn with the scores as the first lines of your final message.
