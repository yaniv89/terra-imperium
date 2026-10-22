# Terra Imperium lead handoff, 22 October evening

Replaces plans/HANDOFF-2026-10-22.md for current state (that file keeps the role and merge routine).

## State
- `claude/integration` = `main` after the last push of this session (merges of the leftover bugs lane, eight ages E3, report ranks 12, 13, 16). If the last push did not happen, integration is ahead of main locally: run lint, `npm run test:quick`, `npm run build`, then push both.
- No lane is running. Known Windows-only failure: `src/services/challengeFiles.test.js`. Load flakes that pass alone: stoneAI, battleLoop, sim, legacy.
- SETUP_VERSION 26. Save version 20.

## Merged today (22 Oct)
Battle length (clocks 10/20 min, quick field battle, assault threshold, Auto until siege ends); battle readability and phone HUD; campaign phone layout; the user's playtest fixes (trade, gift, improvement replace warning, reminder chips, units 0.85 of a hex, farm plots); eight ages E2 (robots, Future powers, automation with an uprising warning and a way out, Planetary Council, Weapons Ban blocks all new robots) and E3 (U73 to U77, Auto breach rule); report ranks 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 16; differentiation U43 to U46; stronger playtest era saves; leftover bugs (field card loop, defence odds, Hebrew log, gift reason, roof fading).
Dropped by the user: rank 7 per-city Auto build (reverted), rank 14 field-built rams and ladders. New rule: every game-design feature needs the user's own yes first (memory: confirm-report-features).

## Open questions for the user
1. Stone Age population: a size-7 capital shows about 232k people (one table, 1000 x size^2.8, every age) and the player's capital reaches size 7 to 8 by turn 40 while AI capitals sit at 4 to 6. Not caused by today's merges (same numbers on 73f09853). Options: A, scale the shown number per age (display only); B, slow Stone Age growth (villages capped until Agriculture); lead recommends both.
2. E3's Auto breach rule: on Auto a walled city can fall when attackers survive and the garrison is at 65% or less; defenders with no other city are lost. Keep?
3. Older: business model (U42), Supabase deploy for U36, U34 economy cuts (parked), 3D hex terrain prototype, land cap above 45%.
- The user said no to a new AI playtest round (do not spend); the saves and plans/ai-output/human-playtest/NEXT-ROUND.md stay for later.

## Left to do
- Eight ages Phase G: U95 to U98 (U95 audio can start; U96 to U98 calibration, budgets, docs). U52, U53 deferred.
- Report: rank 15 waits for U34; the AI math work stays parked.
- Follow-ups: Auto robot term for robot garrisons; Information events `global_pandemic` and `automation_riots` use `cityUnrest`, which does nothing on story events; abilities' names in English in the Hebrew battle HUD; the battle radial does not register with useInteraction; steward toggle only in the HUD; plans/FOLLOW-UPS-2026-10-21.md items still open.
- Art for the art session: a naval robot model (`future-robot-naval`), Orbital Strike, EMP and Hijack effects, robot unit icons.

## Machine notes
- The main checkout's node_modules was half deleted once today (a forced worktree removal through a link); `npm install` restored it. scripts/prune-worktrees.mjs now skips any worktree with a link inside; compare.sh unlinks first. Always dry-run the prune and read the list.
- Worktrees that failed to delete with "Permission denied" (files held by idle sessions): ages-e2-173375 (maybe gone), bold-ritchie-28e576, strange-rosalind-06c2b0, zz-pop-base (scratch, no links). Retry the prune later.
- Status page data artifact: https://claude.ai/artifact/XwVgyvXzntx58knL5nMVyb (datasets agents and plans).
