# Lane tech-depth: report

Goal: make research choices meaningful and easy to read (playtests gave Tech 5 and 6 out of 10; runs 40550097406 and 40550092795; SUMMARY issue 12; the lock text at step 51 had no turns-left hint).

## What changed
1. **A recommended next tech.** This copies Civ VI's advisor "recommended" mark and its eurekas, where a boost you earned pays 40% of the tech, plus Humankind's idea of rating a pick by what it opens now. New `recommendTechs` in src/engine/research.js. It takes the same startable techs as `suggestTechs` and scores each one within its age:
   - boost earned (met or paid): +3
   - a new unit of your age while you are at war: +2
   - unlocks anything: +1
   - your research focus line: +1

   Ties go to the tech with the least science left (diffusion, a paid boost), then to `suggestTechs`' order. Pure and deterministic. Agriculture keeps its first place for foragers.
   - The player's advisor (End Turn's auto pick and `advisorPlan`) now picks what it recommends. **The AI keeps `suggestTechs`**, so its calibrated pace does not change.
   - Choice sheet: the first option is marked "Recommended" with its reason in plain words. Every option now lists what it unlocks (before, only effect lines were shown).
   - Research tab: a "Recommended" card in the Next section shows the tech, its turns, the reason, and a Research or Queue button. A line on the tech's own row says the same, because the lines start collapsed.
2. **Locked units and buildings name the tech and its turns.** Examples: "Needs Hunting Bands, researching, 7 turns left", "Needs Copper Working, queued, 14 turns left", "about 14 turns of research, 2 techs", "waits for the Bronze Age". "Research it" is hidden when the tech is already planned. Code: researchView.js `techEta` / `techEtaText` and cityBuildModel.js `lockOf`.
3. **Tech cards list the laws they unlock** (for example "Land Tax (law)"). Before, laws were missing from "Unlocks".
4. `scripts/tech-audit.mjs` lists every tech's payoffs (`--dead` lists the ones with none).

## Evidence
- **Dead techs:** none. Every tech gives at least one effect, unit, building, improvement, law or map effect (Future Tech is the repeatable one). The thinnest give one line each:
  - mass_politics, global_institutions and planetary_federation: opinion only, plus World Congress hooks
  - provincial_administration and bureaucratic_reform: map effects only

  Each now shows what it gives on its card. No content change was made.
- **Research pace** (`node scripts/research-pace.mjs --seeds 11,12,13 --turns 300`, Normal, scripted akkad on auto research, base vs this branch):

  | | base | head |
  |---|---|---|
  | player's longest single tech | 48 / 46 / 52 turns | 21 / 22 / 23 turns |
  | player enters Bronze | T31-32 | T28 |
  | player enters Classical | T81 | T74 |
  | player enters Kingdoms | T194-199 | T187-191 |
  | player techs by T300 | 31-32 | 33 |
  | half the majors enter Bronze / Classical / Kingdoms / Gunpowder | 60-61 / 121-127 / 198-201 / 291-300 | 60-61 / 123-126 / 197-200 / 292-299 (unchanged, AI not touched) |

  The base advisor sent the player into governance_feudal_charters for about 48 turns. The new one picks the cheaper techs (diffusion) and boosted techs first.
- **Pace against plan KTD9** (Normal targets: Bronze ends T108, Classical T217, Kingdoms T384). Half the majors enter Bronze at about T60 (on target), Classical at about T125 (about 17 turns after the T108 target) and Kingdoms at about T200 (17 before the T217 target). Gunpowder starts near T295 against a target of T384, so **Kingdoms lasts about 95 turns, not 167**. This was not changed: the comment in research.js says an earlier lane kept Kingdoms at Civ VI's share on purpose. Making it longer would also lengthen the player's slowest age (the player already needs 16 turns a tech in Kingdoms, against 6 to 9 for the AI). It is the lead's call.
- **Tests:** src/engine/researchAdvice.test.js has 8 tests: same set as suggestTechs and deterministic, a paid boost moves a tech up, the war unit reason, the player's advisor picks the recommendation while the AI keeps suggestTechs, reason wording, ETA current and path, laws in unlocks. These also pass: research, researchStatus, researchChoice, GameContext, challenges and aiEconomy (304 tests). Lint is clean.
- **Engine rules review** (engine-rules-reviewer agent): no violations. Its note: action logs recorded with the advisor on before this change replay to a different hash. Risk is low while CHALLENGES_ON is false.
- **Mobile check:** `node scripts/ui/tech-depth-shots.mjs` checks 844x390 and 1600x900, en and he: 24 of 24 pass, no page errors. Shots are in plans/ui/tech-depth/.

## Not done
- Pre-queueing a locked unit so it starts when its tech lands (the playtest's second idea). It needs a queue rule in cities.js, so it is left for the lead to decide.
- The Research tab layout belongs to the phone-pass lane. Only content was added.
