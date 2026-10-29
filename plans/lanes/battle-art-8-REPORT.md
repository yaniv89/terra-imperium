# battle-art-8 report (plan U11, user decision 29 Oct: buildings block movement)

Branch `claude/battle-art-8`, on top of `origin/claude/integration` c0d08286. Ponytail loaded by the session start hook ("PONYTAIL MODE ACTIVE").

## For the lead

Design questions (lead's call, nothing waits on them to merge):

1. **Camera (changed by the lead, user decision 29 Oct: "the camera should be where the player wants it to be").** No auto follow, no jump to the first clash (battle-truth's jump in BattleHud.jsx removed; its alert with Go stays), no centring at the end of a battle. The camera moves only on pan, zoom, Go, All / Find / squad and HUD buttons, the minimap, and Follow when the player turns it on. Guard test: src/components/battle/cameraPlayerOnly.test.js. Left as they were: the start view (frameGround on the first frame plus the 1.6 s intro settle) and the 3 s outro pull-back after the battle has ended; say if the outro should go too.
2. **Houses drawn across the main street** (the 3-tile street from the gate to the keep, which must stay walkable) are now cut out of the drawing, the same way as houses under the town hall (`underHall`). They keep their manifest ids and housing. Bronze europe towns, 8 seeds: the street cut adds 1 house in a small town (of 6 to 8), 2 in a medium one (of 14), 0 or 4 in a big one (of 23). The other way (moving the street) changes every town's layout; I did not do it.
3. **Roof fade kept as it is.** I did not fade roofs (your instruction). The older canopyFade.js (crowns and roofs fade round selected and fighting squads) is still on; say if it should go now that troops no longer stand inside houses.
4. **Assault row moved.** "assault classical>kingdoms, 5 squads vs 2" went from tactical 1.95 (1.71x auto) to 2.71 (2.38x auto), still IN (limit 3.5x), wins 26/32 to 19/32: the attackers now walk the streets round houses into the towers' fire instead of through the houses. No Auto retune (every row IN, autoCalib finds nothing better than the live constants).

No new 3D model is needed for any of this.

Files I share with other lanes (merge order matters):
- battle-skill-8 (flank, height, cover): we both may touch `src/battle/sim/movement.js` (mine: `nearBlockedGoal`, one line in `acquireTargets`) and `src/battle/render/BattleRenderer.js` (mine: drawSquads figures, bars, banners, hit flash constants). Both of us likely bump `SETUP_VERSION` in `src/battle/setup/buildBattleSetup.js` (mine is 31): the second to merge takes 32.
- sieges-sea-8 (walled defender AI, stores): `src/battle/setup/cityBattle.js` (mine: `FOOT_EDGE`, the street cut).

## Rows

| # | Item | What changed | Evidence |
|---|------|--------------|----------|
| 1 | Buildings block movement | A house, landmark or building now blocks every tile whose centre lies inside its drawn rectangle grown by 0.2 tile (was 0.9 of it shrunk): `cityBattle.js` FOOT_EDGE. Houses drawn across the main street are cut out (see question 2). A move onto a building ends beside it (`movement.js` nearBlockedGoal: within two tiles' walk of the nearest free tile). An attack-move keeps a building it picked while the streets lead it out of sight (it used to swing between that building and its goal for minutes). Gates, the gate rule, walls, the keep, Q3 and "a city falls only when its defence is beaten" are untouched. The renderer also steps any figure that would stand on a building tile in towards its squad's point (BattleRenderer `onBuilding`). SETUP_VERSION 31. | ghostScan (new, `.claude/skills/battle-lab/ghostScan.sim.js`, 8 seeds medium bronze town, attack-move on the keep): unwalled: squad centres inside a drawn house 3.6% to 0.0%, figures 8.1% to 0.5%, drawn house ground blocked 67% to 94%, stuck squads 0 to 0; walled (fort 2): 1.4% to 0.0%, 5.0% to 0.3%, 69% to 94%, stuck 1 to 0. Wins 8/8 both. Browser (844x390): soldiers drawn on building tiles 2 to 7 before, 0 after. Tests in cityBattle.test.js: drawn houses stand on blocked ground and none crosses the street (4 seeds), a squad sent onto a house ends idle on free ground beside it, an attack-move reaches the keep with nobody ever on a building tile. Shots: before-town (soldiers inside the green-roofed house), after-town (squads in the square by the gate, between houses). |
| 1b | parityEco and autoCalib | N=32, TYPES=assault,town, AGES bronze and classical>kingdoms, mixed terrain. | Before 12 of 12 IN, after 12 of 12 IN (rows in "Numbers"). autoCalib on both: best of its grid is 1/12 OUT before, 2/12 after, so the live AUTO_TUNE stays. |
| 1c | Phone frame time | Real GPU (Edge, d3d11), 844x390 DPR 2, town battle, `&perf`. | Frame p50/p95 7.1/14.0 ms before, 7.1/14.0 after (default zoom); near zoom 7.1/20.9 before, 7.0/20.9 after; main thread 2.1-2.2 to 2.2-2.3 ms (the per-figure tile test in towns); sim 0.2/0.4 ms a tick both. src/battle suite green (kernel, replay, hash tests). |
| 2 | One bar per squad in a melee | 3D bars (closer than zoom 1): a bar that would cover one already drawn this frame steps up a row (up to 3); the bar's track takes its side's colour so you can tell whose bar it is. Flags (zoom 1 and wider, squadBadges.js): fighting squads get one flag each, stacked up to 3 rows (`stackFlags`); idle squads still merge into one flag with a count. | Shots before-melee-bars (bars on top of each other) and after-melee-bars; after-default-zoom. Test squadBadges.test.js "stack fighting squads' flags". |
| 3 | Hit flash and corpses | The old flash only pushed the instance colour to white, which lit just the team cloth and the rim. Now the hit level rides in the instance colour's red channel (`packHit`, the attributes are full) and the soldier shader adds a warm glow to the whole figure: front rank, 0.35 s (was 0.18 s at most 0.65), holding near full for the first 150 ms then fading. Bars and flags flash 0.35 s too. Corpses: already 30 s plus a 3 s sink for every clip unit (BATTLE_GRAPHICS.corpseSeconds); no change. | Shot after-hit-glow-corpses (glowing front ranks, the fallen lying on the field, 97 to 115 corpses in view in the runs). Test hitFlash.test.js: >0.5 at 150 ms, the packed level decodes exactly. |
| 4 | Camera | Phone default zoom one wheel step (1.12) closer: PHONE_VIEW_TILES 13 to 11.6 (zoom limits keep the same widest view). Banners keep at least 24 css px on screen (scaled up when the camera is far): 32.8 px at the default phone zoom, 49 px one step in. No automatic camera moves (question 1). | town-shot.mjs prints bannerPx 32.8 at zoom 1 on 844x390. cameraPlayerOnly.test.js. |

## Numbers

parityEco before -> after (exchange tactical, ratio to auto, wins tactical/auto):
- assault bronze 3v3: 0.750 (0.99x) -> 0.807 (1.06x)
- assault classical 3v3: 0.923 (1.06x) -> 0.824 (0.95x)
- assault bronze 5v2: 1.228 (1.47x) -> 1.237 (1.48x)
- assault classical 5v2: 1.954 (1.71x) -> 2.711 (2.38x), wins 26 -> 19 of 32
- assault bronze with siege: 0.617 (1.53x) -> 0.708 (1.75x)
- assault classical with siege: 1.096 (2.02x) -> 1.081 (1.99x)
- town bronze 3v3: 1.174 (1.09x) -> 1.135 (1.05x), wins 0 -> 4
- town classical 3v3: 2.597 (0.99x) -> 2.505 (0.95x)
- town bronze 5v2: 0.371 (0.64x) -> 0.357 (0.61x)
- town classical 5v2: 0.867 (0.71x) -> 0.768 (0.63x)
- town bronze with siege: 0.528 (1.33x) -> 0.533 (1.35x)
- town classical with siege: 2.067 (2.02x) -> 1.526 (1.49x), wins 4 -> 10

## After merging integration (sieges-sea-8, e9d77f84)
SETUP_VERSION 34 (theirs 33 plus this lane). parityEco again 12 of 12 IN. Assault rows moved with their walled-city change (assault classical with siege 3.35x, close to the 3.5x limit; that row was 2.02x on their branch alone? not checked). ghostScan unchanged: centres in houses 0.0%, figures 0.5% / 0.2%, stuck 0. src/battle and src/components/battle: 103 files, 1095 tests pass.

## How to rerun
```bash
SEEDS=1-8 FORT=0 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/ghostScan   # WHY=1 lists each ghost, DEEP= tile margin
QUERY='&city=medium&fort=0&age=bronze&perf' node .claude/skills/battle-lab/town-shot.mjs <outDir> <prefix> 40   # vite on 5199
```
A dev server started in a `.claude/worktrees/` checkout serves its first transform of each file: restart it after edits (I lost one round of "after" shots to this).

## Not done / not checked
- Hebrew: no new strings.
- 1600x900 desktop shots not taken (all changes are scale-free except PHONE_VIEW_TILES, phone only).
- A fallen house is rubble in the sim but the renderer still steps figures off its tiles (shortcut noted in BattleRenderer `onBuilding`).
- Sea and field battles have no buildings, so only the hit glow, bars, banners and camera reach them; not shot separately.
