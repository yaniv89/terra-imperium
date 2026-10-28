# Lane art-animation: report

Branch `claude/art-animation`, from `claude/integration` 8ac856c7. Shots in
`plans/lanes/art-animation-shots/` (before-* and after-*, 844x390 at DPR 2 unless noted).
This machine has no GPU: every shot ran on SwiftShader (`SWGL=1`), Chromium from /opt/pw-browsers.

## Step 1: critique (before)

Captured with battle-lab clip-shots.mjs (Bronze, Gunpowder), zoom-shots.mjs (phone 844x390,
desktop 1600x900), screenshot.mjs (sea, Gunpowder), scripts/perf/city-assault-shot.mjs (Classical
walled city) and scripts/perf/map-shots.mjs (Akkad, k 1 / 6 / 30, phone and desktop).

| Area | Score | What an experienced RTS player would say | Reference |
|---|---|---|---|
| Unit size at phone default zoom | 4 | A soldier is 19 css px tall at the phone's default view (zoom-shots soldierPx=19.1); squads read as blobs of colour with a flag (before-z-phone-default.jpg). The battle playtest 40550100958 said the same. | AoE IV and Total War open close enough to read a silhouette; mobile RTS (Rise of Kingdoms) oversize units |
| Melee: whose soldier is whose | 3 | Both sides wear the same baked kit (brown leather, linen); the side's colour is only a belt and a pennant (teamTint 0 on the near level, GARMENT_TEAM_SHARE 0). In a melee the two blocks merge into one brown blob (before-crop-bronze-melee.jpg, before-bronze-12s-fight.jpg). Gunpowder: both sides in blue coats (before-gun-14s-fight.jpg). | AoE IV and StarCraft II put the player colour on big shapes and silhouettes: readability first |
| Death and corpses | 4 | The Death clip plays, but every corpse keeps the formation's exact heading: a row of identical bodies in parade order (before-bronze-24s-fallen.jpg). | Total War ragdoll-like variety; the "no twins" animation principle |
| Hit feedback in melee | 3 | The Hit clip only plays when a squad is NOT fighting (clipFigures: the hit branch sits after the fighting branch), so in a melee a blow lands with no visual answer except blood drops. | AoE IV and most action games: a short white hit flash |
| Sea battle readability | 3 | Every ship has white sails; the side shows only on a tiny pennant (before-sea.jpg). | AoE II and IV dye sails in the player colour |
| Idle, walk, attack clips | 6 | Clips are baked and blended (clipPlayer), front rank on the beat, rear ranks lag. Fine. Walk cadence was not measured. | |
| Projectiles, impacts, dust, fire | 5 | Muzzle flash and smoke puffs show on ships; blood sprays and scorch splats work. Arrows are thin and hard to follow at phone zoom. Not changed in this lane. | |
| Walled city, building damage | 6 | Town models are rich (before-city-city-assault-fight.jpg); rubble count stayed 0 in the 45 s run, so collapse was not seen. Not changed. | |
| Campaign map units and fog | 5 | Army figures on the map are small but crisp at k30 (before-map-akkad-phone-k30.jpg); turn 1 fog hides almost all the map at k1 and k6 (expected). Owner colours belong to the map-clarity lane. | Civ VI map units |
| Transitions into and out of battle | n/a | Not captured: the sandbox opens the battle directly. | |

## Step 2: fixes (code only)

Blender: installed later with `bash scripts/blender/install.sh` (Blender 4.0.2 from the Ubuntu
mirror, as the lead advised). Fixes 1 to 5 are in the renderer; fix 6 is an asset.

1. **Side-coloured rim on every soldier** (src/battle/render/soldierFactory.js, `rim` option of
   `createSoldierMaterial`; BattleRenderer.js `SIDE_RIM` near 0.55, far 0.9). A fresnel term
   `(1 - N.V)^2` times the instance's side colour is added to the emissive light, so silhouettes
   carry the army's colour while the authored kit stays as drawn. Skin is excluded (no lilac faces).
   No new vertex attribute (the 16-attribute limit), one varying, three ALU ops a pixel.
2. **Hit flash** (BattleRenderer.js `hitFlash`, `HIT_FLASH_S` 0.18 s): the front rank of a squad
   hit this moment is drawn with its side colour pushed up to 65% towards white, which lights both
   the team-coloured parts and the new rim. Works while fighting, where the Hit clip never plays.
3. **Corpse variety** (BattleRenderer.js `dropCorpses`): each body turns up to about 50 degrees off
   the formation's heading and staggers back a little, seeded per figure.
4. **Phone default view** (`PHONE_VIEW_TILES` 18 to 15): soldiers 19.1 to 22.9 css px tall at the
   phone's default zoom; desktop unchanged (26.4 px). Players can still zoom out to the old view.
5. **Striped sails** (soldierFactory.js `mast`): every sail carries a broad band in the side's
   colour on both faces.

6. **Team crest on the Bronze spearman** (scripts/blender/build_bronze_infantry.py `TeamCrest`,
   rebuilt and packed into src/assets/units/bronze-infantry.glb). From the iso camera the head is
   what shows; the kilt is Team-tagged but the loader keeps lower garments undyed
   (GARMENT_TEAM_SHARE 0) and the chest is a leather corselet. A horsehair crest on the Team
   material (Head bone, an attachment like the cap) puts the side's colour on top of every
   spearman, the way crested helmets mark sides in Total War: Rome and AoE IV's player-colour
   plumes. 2,084 triangles (budget 3,000), file 182 to 187 KB, packed with the project's unit
   flags (`gltfpack -cc -kn -km -ke -noq -af 0`, scripts/art/glbInfo.mjs packFlags).
   Shots: after-bronze-crests.jpg (blue crests left, orange right), after-bronze-crest-fight.jpg.
   Blender 4.0 needed two small guards: ti_units.py `set_sharp_from_angle` (4.1+) falls back to
   auto smooth, and the bronze-infantry export passes `export_colors` on 4.0 instead of the 4.2
   vertex colour keys; install.sh now also installs python3-numpy (the glTF exporter needs it).

Tests: src/battle/render/hitFlash.test.js (flash timing, rim in the shader and the program key,
sail bands). `npm run test:related` on both files: 32 files, 520 tests pass.

## Re-score (after, same scripts)

| Area | Before | After | Evidence |
|---|---|---|---|
| Unit size at phone zoom | 4 | 6 | after-z-phone-default.jpg, soldierPx 22.9 |
| Melee side readability | 3 | 7 | after-crop-bronze-melee.jpg: blue rims on the left block, orange on the right |
| Death and corpses | 4 | 6 | after-bronze-24s-fallen.jpg: bodies at varied angles |
| Hit feedback | 3 | 5 | unit-tested; a still shot cannot catch a 0.18 s flash on SwiftShader (1.5 s frames) |
| Sea readability | 3 | 7 | after-sea.jpg: blue and orange striped sails |
| Others | | unchanged | |

## Speed

Probe (scratchpad tool: the sandbox Bronze battle at 3x, 844x390, timers on render, drawSquads and
three's render), base and change interleaved twice on the same machine (SwiftShader):

| run | frame p50 ms | drawSquads p50 / p95 ms | renderer cpu p50 ms |
|---|---|---|---|
| base 1 | 1600 | 0.5 / 0.7 | 7.7 |
| after 1 | 1517 | 0.5 / 1.6 | 8.1 |
| base 2 | 1500 | 0.6 / 1.0 | 6.8 |
| after 2 | 1500 | 0.5 / 1.0 | 9.0 |

No difference beyond the run-to-run noise. On SwiftShader the fragment work is on the CPU, so a
costly shader would show in the frame time; it does not. render-bench.mjs at 300 a side could not
finish here (its screenshots time out on software GL). **Open for the lead:** re-run
`render-bench.mjs --bench 300` and `battle-phone-bench.mjs` on the real-GPU machine before main.

## Open items (not done)

- Arrows and javelins: thicker trails at phone zoom (projectile readability).
- The Hit clip in melee for a figure or two between strikes (needs a clipPlayer slot check).
- Building collapse was not seen in the city run (rubble stayed 0): needs a longer assault shot.
- The same crest (or a dyed plume) for the other Bronze and Classical foot units, and the other
  build scripts' export call need the same 4.0 guard before they can be rebuilt on a cloud machine.
