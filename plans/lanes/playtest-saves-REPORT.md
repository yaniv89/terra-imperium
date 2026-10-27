# Lane playtest-saves: report

Source: plans/ai-output/human-playtest/SUMMARY.md issue 4 and lane 6. The AI playtests of later ages started from
weak saves (size 1 capital, production 3, research 950+ turns), met nobody, and never reached RTS battles, sieges or naval.

## What changed

- **scripts/ai/build-era-saves.mjs** builds the era saves by playing the real engine. Nothing in a state is edited by hand.
  - One game: Israel on seed 4242, standard world, Normal speed. Israel is on the coast, and majors 900 to 1,300 km away
    are met in play.
  - The scripted player of balance-sim POLICY=scripted plays it with `rush` on (it buys like the AI). Without that it
    lagged the AI majors (5 cities against a median of 8 in the classical age).
  - The player keeps one ship on its coast once it can build one. On reaching an age it researches that age's ship tech
    first (RESEARCH_TECH).
  - Then a copy of the game is played on:
    1. It buys a ship, keeping 300 gold for the war.
    2. It declares war (DECLARE_WAR) on the nearest major it has met.
    3. It ends turns, refusing peace, until an enemy army is within 400 km of one of its cities or a battle waits for
       the player.
  - Each copy is written to scripts/ai/era-saves/<age>.json.gz, with its facts in index.json. A full rebuild takes
    about 12 minutes.
- **scripts/ai/human-playtest.mjs** loads the committed saves (`loadSlices`) instead of building weak ones at run time.
  The research boost is gone, and the slices are `bronze` to `future` (the start session is the stone age).
- **scripts/ai/eraSaves.test.mjs** checks each save, loaded as the browser does (migrateSave, LOAD_GAME):
  - auditGameState is clean and the age is right;
  - cities are at least min(AI median, 3) and research is under 60 turns a tech;
  - at least 3 majors are met, there is a coast and a ship;
  - there is a war with an enemy army in reach or a battle waiting.
- **Other scripts:** scripts/ai/era-saves-dry-run.mjs plays 20 headless turns on each save. scripts/ai/era-saves-shots.mjs
  loads each save in a real browser the playtester's way and takes a screenshot.

## Two real bugs found and fixed (they hit players too)

1. **Loading revived razed start cities and freed tiles.** `backfillDefaults` (src/engine/saveMigrations.js) filled
   `regions` and `world.tileOwner` from a fresh game of the same seed. A start city razed since came back on load, and a
   freed tile got its start owner back. The audit reported 22 to 110 tile_owner, tile_twice and city_spacing issues on
   every save from kingdoms on. Now only cities the save still has are backfilled, and the world's maps only when they
   are missing. Regression test in saveMigrations.test.js; it fails without the fix.
2. **Loading a save while the game is open replayed its whole battle history** as "N battles this turn" (cloud slot
   load, import, the playtester). Seen in the browser: 3 to 21 old "Sack of Hazor" results on load. BattleReportsHost.jsx
   now counts only the last turn's reports as new.

## Evidence

Facts per save (index.json):

| age | turn | cities (AI median) | science | research a tech | majors met | ship | at war with | nearest enemy army | battle waiting |
|---|---|---|---|---|---|---|---|---|---|
| bronze | 83 | 3 (4) | 10 | 5 turns | 4 | 1 | Pontus | 304 km | no |
| classical | 116 | 5 (7) | 15 | 2 | 4 | 1 | Akkad | 378 km | no |
| kingdoms | 183 | 8 (14) | 21 | 12 | 6 | 1 | Pontus | 383 km | yes (Begin defence card on load) |
| gunpowder | 331 | 15 (22) | 115 | 5 | 9 | 1 | Saba | 253 km | no |
| modern | 472 | 18 (23) | 181 | 24 | 9 | 1 | Saba | 253 km | no |
| information | 618 | 17 (23) | 306 | 1 | 9 | 1 | Kerma, Pontus | 279 km | no |
| future | 782 | 16 (24) | 453 | 10 | 9 | 1 | Saba | 337 km | no |

- **Headless dry run** (20 turns each, scripted policy): every save stays ACTIVE with audit 0 and is at war on 8 to 20
  of the 20 turns.
- **Real browser** (a VITE_QA_HOOK preview at 844x390): all seven load to their map, with the right turn and player, the
  war in the top bar and 0 page errors. Contact sheet: plans/lanes/playtest-saves-shots.jpg.
- **Tests:** lint clean; `npm run test:quick` passed 474 files and 4,043 tests after merging origin/claude/integration.

## Open points for the lead

- The player's empire is smaller than the AI median from kingdoms on (8 against 14 cities). The scripted player settles
  and builds like the AI but never conquers. It is still a real empire with research of 1 to 24 turns a tech.
- Only kingdoms opens on a waiting battle. The others have an enemy army 250 to 380 km away, about two turns of a march,
  so the playtester's first battle depends on that army moving in or the player attacking.
- The saves were built on the engine from before the latest integration merge. They pass on the merged engine. Rebuild
  with `node scripts/ai/build-era-saves.mjs` after rule changes that matter.
- Saves add about 2.1 MB to the repo (gzipped).
- No API was used. NEXT-ROUND.md lists the suggested runs; they still need the lead's budget yes.
