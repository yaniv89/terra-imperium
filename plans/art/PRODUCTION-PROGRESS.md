# Art production progress

Legacy Part B/C scope: `plans/art/ITEMS.md`, Part B (276) and Part C (74): **350 logical items**. Part A’s 402 in-game items are excluded. A/B variants stay together as one logical item.

**Legacy Part B/C at the 2026-10-07 import: delivered and in the game: 285 / 350. Remaining: 65.** (260 uploaded in the checkpoints below, plus the 25 of the local transfer.)

Legacy Part B/C built but not yet delivered: 0.

**Expanded queue after Wave 7 checkpoint 38: 1,135 rows — 285 accepted, 490 in game awaiting review, 349 pending, 11 superseded.** These are item-array status counts, including two legacy fort aliases; they are not unique model counts. Superseded rows are not deliveries. The 350-item legacy aggregates above remain separate historical scope.

Import check 2026-10-07: every item in every ZIP below is in the game (`node scripts/art/downloads-coverage.mjs`). The 25 items built in the cloud (8 buildings, 13 base tile improvements, classical town-big a and b, warships bronze, classical and kingdoms) came through the transfer archives in [local-transfer-2026-10-07](local-transfer-2026-10-07/README.md) and were validated, fixed where needed and imported the same day (details in [IMPLEMENTED.md](IMPLEMENTED.md), "Imported 2026-10-07").

Wave 0 backlog repair 2026-10-07 (Codex, committed by Claude): the 13 base tile improvements got continuous Ground and readable distant LODs, the three warships and the Classical big towns A and B were re-exported and brightened; the cathedral and the 7 buildings are unchanged in the game. Checkpoints [01](downloads/wave0-backlog/checkpoint-01/README.md) (20 items, 4 ZIPs) and [02-final](downloads/wave0-backlog/checkpoint-02-final/README.md) (5 items, 1 ZIP); the ZIPs are kept outside git (see those READMEs).

Wave 1 (plans/ART-MODELS-PLAN.md) [checkpoint 01](downloads/wave1/checkpoint-01/README.md), 2026-10-07: the 7 Bronze base units and general (4 by Codex, 3 by Claude) and the 13 Bronze battle buildings with damaged states (`rts-bronze.glb`), 20 items in the game, status `in_game_awaiting_review` in production-queue.json; the 4 ZIPs are kept outside git (see that README).

Wave 1 [checkpoint 02](downloads/wave1/checkpoint-02/README.md), 2026-10-07 (Claude, Blender 5.2 headless): the Bronze construction stages (in `rts-bronze.glb`), the Bronze wall kit, ruin library and fort, the Bronze projectiles, the four resource nodes, the two herds and the temperate, mediterranean and desert vegetation kits, 14 items in the game, status `in_game_awaiting_review`; the 3 ZIPs are kept outside git (see that README).

Wave 1 [checkpoint 03](downloads/wave1/checkpoint-03/README.md), 2026-10-07: the 13 Bronze damaged-and-ruined house files (base and 12 themes), the 8 ground materials (colour in the game) and the 8 core battle effect sheets; 20 queue items `in_game_awaiting_review` (the effect sheets have no queue items); the 4 ZIPs are kept outside git.

**Legacy Part B/C quality review at the 2026-10-07 import: 0 delivered items require revision; 285 accepted. 65 items remain to finish in that scope.** Upload verification alone does not establish visual quality. Previously rejected batches have been replaced and verified. Delivery links and exact item lists are below.

| Checkpoint | Items | ZIPs | Files and exact item list |
|---|---:|---:|---|
| 01 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-01/README.md) |
| 02 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-02/README.md) |
| 03 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-03/README.md) |
| 04 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-04/README.md) |
| 05 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-05/README.md) |
| 06 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-06/README.md) |
| 07 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-07/README.md) |
| 08 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-08/README.md) |
| 09 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-09/README.md) |
| 10 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-10/README.md) |
| 11 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-11/README.md) |
| 12 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-12/README.md) |
| 13 | 20 | 4 | [Manifest and previews](downloads/blender-remaining/checkpoint-13/README.md) |

[Five-item quality correction](downloads/blender-remaining/quality-revision-01/README.md) supersedes the original versions of those five items. Current quality status for all archives is listed above.

The machine-readable checklist is [production-queue.json](production-queue.json). It lists every item and its delivery status.

Wave 1 [checkpoint 04](downloads/wave1/checkpoint-04/README.md), 2026-10-07 (interim): base Bronze civic keep in three states and tundra ground delivered, `in_game_awaiting_review`. Twelve themed civic variants, four palace damage states and the twelve-piece Bronze props kit are being verified for the follow-up. The original Part B/C counters above are unchanged; civic is added handoff scope.

Wave 1 [checkpoint 05](downloads/wave1/checkpoint-05/README.md), 2026-10-07 (Claude): the twelve Bronze theme civic halls (keep, damaged, ruined), the Bronze palace damage set and the twelve-piece Bronze props kit, 14 queue items `in_game_awaiting_review`; wired in battle (civic by theme, palace damage, wonders as their map models, props placed by battleProps.js) and in the close view (a damaged capital's palace). Shipped atlases at 1024: 5.75 MB for the 15 files, about 3.7 MB net added.

Wave 1 [checkpoint 06](downloads/wave1/checkpoint-06/README.md), 2026-10-07 (Claude): the Bronze raider (mounted, loot and torch) and the Bronze mercenary (mixed foreign kit), 2 queue items `in_game_awaiting_review`, drawn for raid parties and hired bands in battle (unitModels.js LOOK_CLASS); 177 KB added.

Wave 1 [checkpoint 07](downloads/wave1/checkpoint-07/README.md), 2026-10-07 (Claude): fixes, no new files (0 MB). The town hall is drawn at the plan's 20 m and stands clear of temples (the city's biggest building in battle), cut houses leave no shadow or baked footprint, the civic proof renders are framed, and the battle sandbox has a raid option (`&raid=raid|sack`, `&merc` for a hired band) with the raider and mercenary looks verified end to end.

Wave 1 [checkpoint 08](downloads/wave1/checkpoint-08/README.md), 2026-10-07 (Claude): Bronze culture skins for the battle buildings, 48 variants (barracks, tower and trade post with damaged states for 12 themes in `rts-bronze-<theme>.glb`, plus the 12 civic halls as town-hall skins), 12 queue items `in_game_awaiting_review`; a side builds in its people's theme. 9.38 MB added.

Wave 2 [checkpoint 09](downloads/wave2/checkpoint-09/README.md), 2026-10-07 (Claude): the 34 Bronze signature units (27 on foot, 6 light chariots, 1 heavy chariot) and the horse, light chariot, heavy chariot and ox rigs, 38 queue items `in_game_awaiting_review`; each Bronze people's signature unit shows in battle. 2.79 MB added.

Wave 3 [checkpoint 10](downloads/wave3/checkpoint-10/README.md), 2026-10-07 (Claude): the Levant Bronze medium and big towns rebuilt so their landmarks keep out of the square (`assemble_kit_towns.py HALL_CLEAR`): the battle town hall is 5.5 tiles (20 m) and centred in every Levant Bronze town and is the largest building; townLayouts.json rebuilt, close view and battle match. 1 queue item `in_game_awaiting_review`; +0.11 MB.

Wave 3 [checkpoint 11](downloads/wave3/checkpoint-11/README.md), 2026-10-07 (Claude): the camel, elephant and siege-frame rigs (`ti_mounts.py`) and the Classical base units and general (swordsmen, composite archers, heavy cavalry, ballista, engineers, laborer, general; `build_units_classical.py`), 10 queue items `in_game_awaiting_review`; every Classical side now fields GLB units. 0.64 MB added.

Wave 3 [checkpoint 12](downloads/wave3/checkpoint-12/README.md), 2026-10-07 (Claude): the 38 Classical signature units (18 on foot, 13 horsemen, 2 light chariots, 2 camels, 2 war elephants, the Bosporan stone-thrower; `build_units_classical_signature.py`), 38 queue items `in_game_awaiting_review`; each Classical people's signature unit shows in battle, camels and elephants drawn at their own height. 3.38 MB added.

Wave 3 [checkpoint 13](downloads/wave3/checkpoint-13/README.md), 2026-10-07 (Claude): the Classical battle buildings (`rts-classical.glb`: 13 roles with damaged states, construction stages 0-3; `build_rts_classical.py`), 14 queue items `in_game_awaiting_review`; Classical economy battles draw them. 1.54 MB added.

Wave 3 [checkpoint 14](downloads/wave3/checkpoint-14/README.md), 2026-10-07 (Claude): the Classical city kit for battle (walls, ruins, fort and the civic hall with damaged and ruined states; `build_city_classical.py`), 4 queue items `in_game_awaiting_review`; Classical sieges draw their own walls, hall and rubble. 2.42 MB added.

Wave 3 [checkpoint 15](downloads/wave3/checkpoint-15/README.md), 2026-10-08 (Claude): the town hall is the largest building in every town: 199 of 416 town files have their landmarks shrunk off the square (`scripts/art/hall-clear-towns.mjs`, the HALL_CLEAR rule on the shipped files; the old plots' baked shade lifted in game), townLayouts.json rebuilt, 1 queue item `in_game_awaiting_review`; the hall is 5.5 tiles (4.2 small), centred, in every town. -0.61 MB.

Wave 3 [checkpoint 16](downloads/wave3/checkpoint-16/README.md), 2026-10-08 (Claude): the 13 Classical damaged-and-ruined house files (base and 12 themes) and the Classical palace damage set, 14 queue items `in_game_awaiting_review`; Classical battles and the close view draw them. 6.98 MB added.

Wave 3 [checkpoint 17](downloads/wave3/checkpoint-17/README.md), 2026-10-08 (Claude): the Classical raider and mercenary, the Classical projectiles (arrow, pilum, lead sling bullet, ballista bolt, stone) and the twelve Classical battlefield props, 4 queue items `in_game_awaiting_review`. 0.58 MB added.

Wave 3 [checkpoint 18](downloads/wave3/checkpoint-18/README.md), 2026-10-08 (Claude): the 12 Classical culture skins of the battle buildings (barracks, tower, trade post with damaged states, `rts-classical-<theme>.glb`) and the map's Classical fort (`fort-classical.glb`), 13 queue items `in_game_awaiting_review`. 9.99 MB added. The Classical remainder is done.

Wave 3 [checkpoint 19](downloads/wave3/checkpoint-19/README.md), 2026-10-08 (Claude): the battle sandbox has a `siege` army preset (`&siege`, or the army menus), so siege models such as the Bosporan stone-thrower (`&people=bosporan_kingdom&age=classical`) can be checked live. 0 MB.

Wave 4 [checkpoint 20](downloads/wave4/checkpoint-20/README.md), 2026-10-08 (Claude): the Kingdoms (medieval) base units and general (pikemen, longbowmen, knights, trebuchet, pioneers, villager, general; `build_units_kingdoms.py`), 7 queue items `in_game_awaiting_review`; every Kingdoms side now fields GLB units. 0.62 MB added.

Wave 4 [checkpoint 21](downloads/wave4/checkpoint-21/README.md), 2026-10-08 (Claude): the 36 Kingdoms signature units (24 on foot, 9 horsemen, 2 war elephants, Kitara's cattle guard with an ox; `build_units_kingdoms_signature.py`), 36 queue items `in_game_awaiting_review`; each Kingdoms people's signature unit shows in battle. 2.76 MB added.

Wave 4 [checkpoint 22](downloads/wave4/checkpoint-22/README.md), 2026-10-08 (Claude): the Kingdoms battle buildings (`rts-kingdoms.glb`: 13 roles with damaged states, construction stages 0-3; `build_rts_kingdoms.py`), 14 queue items `in_game_awaiting_review`; Kingdoms economy battles draw them. 1.94 MB added.

Wave 4 [checkpoint 23](downloads/wave4/checkpoint-23/README.md), 2026-10-08 (Claude): the Kingdoms city kit for battle (walls, ruins, fort and the civic hall with damaged and ruined states; `build_city_kingdoms.py`), 4 queue items `in_game_awaiting_review`; Kingdoms sieges draw their own walls, hall and rubble. 2.68 MB added.

Wave 4 [checkpoint 24](downloads/wave4/checkpoint-24/README.md), 2026-10-08 (Claude): the Kingdoms remainder: the 13 damaged-and-ruined house files, the palace damage set, the raider and mercenary, the projectiles, the twelve props, the 12 culture skins of the battle buildings and the map's Kingdoms fort, 31 queue items `in_game_awaiting_review`. 17.96 MB added. The Kingdoms age is done.

Wave 4 [checkpoint 25](downloads/wave4/checkpoint-25/README.md), 2026-10-08 (Claude): `scripts/art/improvement-shots.mjs` works with the peoples start screen again (four steps, Begin on Ready), and the close-view shots of the map's Classical and Kingdoms forts at 844x390. 0 MB.

Wave 5 [checkpoint 26](downloads/wave5/checkpoint-26/README.md), 2026-10-08 (Claude): the Gunpowder base units and general (line infantry, riflemen, dragoons, a field cannon on its own carriage rig, sappers, laborer, general; `build_units_gunpowder.py`), 7 queue items `in_game_awaiting_review`; every Gunpowder side now fields GLB units. 0.69 MB added.

Wave 5 [checkpoint 27](downloads/wave5/checkpoint-27/README.md), 2026-10-08 (Claude): the 32 Gunpowder signature units (26 on foot, 4 horsemen, the Khoekhoe ox rider, the Tondo lantaka crew; `build_units_gunpowder_signature.py`), 32 queue items `in_game_awaiting_review`; each Gunpowder people's signature unit shows in battle. 2.30 MB added.

Wave 5 [checkpoint 28](downloads/wave5/checkpoint-28/README.md), 2026-10-08 (Claude): the Gunpowder battle buildings (`rts-gunpowder.glb`: 13 roles with damaged states, construction stages 0-3, a clock-tower town hall, a bastion gun platform, a gun foundry; `build_rts_gunpowder.py`), 14 queue items `in_game_awaiting_review`; Gunpowder economy battles draw them. 1.98 MB added.

Wave 5 [checkpoint 29](downloads/wave5/checkpoint-29/README.md), 2026-10-08 (Claude): the Gunpowder city kit for battle (walls, ruins, a star fort and the clock-tower civic hall with damaged and ruined states; `build_city_gunpowder.py`), 4 queue items `in_game_awaiting_review`; Gunpowder sieges draw their own walls, hall and rubble. 2.65 MB added.

Wave 5 [checkpoint 30](downloads/wave5/checkpoint-30/README.md), 2026-10-08 (Claude): the Gunpowder remainder: the 13 damaged-and-ruined house files, the palace damage set, the raider and mercenary, the projectiles (cannonball), the twelve props, the 12 culture skins of the battle buildings and the map's star fort, 31 queue items `in_game_awaiting_review`. 18.03 MB added. The Gunpowder age is done.

Wave 6 [checkpoint 31](downloads/wave6/checkpoint-31/README.md), 2026-10-08 (Claude): the vehicle rigs (`ti_mounts.py`: tracked `tank`, `wheeled`, `jet`) and the Modern base units and general (rifle infantry, ATGM team, tank, towed howitzer, AA truck, engineer, the command car, and the fighter jet for air squads; `build_units_modern.py`), 11 queue items `in_game_awaiting_review`; every Modern side now fields GLB units, vehicles at the people's scale and spread so they do not overlap. 0.86 MB added (16 files). "Wave 6" here is the Modern age.

Wave 6 [checkpoint 32](downloads/wave6/checkpoint-32/README.md), 2026-10-08 (Claude): the 10 Modern signature units (the Merkava and the LT vz. 38 on the tracked rig, Kindah's camel riflemen, and 7 on foot; `build_units_modern_signature.py`), 10 queue items `in_game_awaiting_review`; all 150 peoples now have their signature unit in battle. 0.79 MB added (20 files).

Wave 6 [checkpoint 33](downloads/wave6/checkpoint-33/README.md), 2026-10-08 (Claude): the Modern battle buildings (`rts-modern.glb`: 13 roles with damaged states, construction stages 0-3 in steel scaffold, a headquarters block, a bunker and observation tower, a vehicle works hangar, an artillery park, a field hospital, plus the Modern extras generator, airfield and radar-aa; `build_rts_modern.py`, `ti_modern_battle.py`), 17 queue items `in_game_awaiting_review`; Modern economy battles draw them. 1.97 MB added (1 file).

Wave 6 [checkpoint 34](downloads/wave6/checkpoint-34/README.md), 2026-10-08 (Claude): the Modern city kit for battle (concrete T-wall and wire wall kit with a guard tower and pillbox gateway, ruins, a bunker-line fort and the headquarters civic hall with damaged and ruined states; `build_city_modern.py`), 4 queue items `in_game_awaiting_review`; Modern sieges draw their own walls, hall and rubble. 2.04 MB added (4 files).

Wave 6 [checkpoint 35](downloads/wave6/checkpoint-35/README.md), 2026-10-08 (Claude): the Modern remainder: the 13 damaged-and-ruined house files, the palace damage set, the raider (a technical) and the mercenary (a contractor), the projectiles (shell, missile), the twelve props, the 12 culture skins of the battle buildings and the map's bunker-line fort, 31 queue items `in_game_awaiting_review`. 16.79 MB added (33 files). The Modern age is done.

Wave 6 [checkpoint 36](downloads/wave6/checkpoint-36/README.md), 2026-10-08 (Claude): a known gap closed: the standing walls of ruined houses get a lit plaster inner face (no more dark interiors at the cut) in 51 house-damage files of the Classical, Kingdoms, Gunpowder and Modern ages (`build_houses_damage_bronze.py` `INTERIOR`); no new queue items. +0.99 MB net (files replaced, none added).

Wave 6 [checkpoint 37](downloads/wave6/checkpoint-37/README.md), 2026-10-08 (Claude): a known gap closed: the Gunpowder battle walls are a bastion trace (turf-topped battered scarp curtains, an arrow-head bastion with a cannon, a sentry-box corner, the sandstone gatehouse; `build_walls_bastion_gunpowder.py`), the queue item `battle-city/gunpowder/wall-kit` re-delivered. -0.15 MB (the file replaced).

Wave 7 [checkpoint 38](downloads/wave7/checkpoint-38/README.md), 2026-10-08 (Codex, `gpt/art-remaining`): 14 new battle models: river-kit, ford, wood/stone/steel bridges; conifer/tropical/cold vegetation; loot-sack, exit-marker, burnt-field-overlay and ancient/middle/modern landings — are `in_game_awaiting_review`. Packed game models total 5.50 MB; three editable source ZIPs total 90.11 MB, with at most five assets per ZIP. Queue rows link their packed game hashes, uncompressed source hashes, source inventories and [source validation](downloads/wave7/checkpoint-38/checks/source-validator.json)/[actual loader and tone checks](downloads/wave7/checkpoint-38/checks/packed-loader-tone.json). Source/loader checks, lint, the final 31-test regression set and 14 browser cases passed; native terrain, Middle landing and map views were inspected at both sizes. This records delivery on the work branch, not quality acceptance or lead integration. The newer integration loader must preserve the authored LOD UVs before merge; see the checkpoint compatibility note. Intact bridges are wired; damaged/destroyed variants remain unused without bridge HP. Map canopy impostors and map river redraw are separate scope.

Checkpoint 38 [reconciliation](downloads/wave7/checkpoint-38/checks/queue-reconciliation.json): two legacy Classical/Modern map-fort rows alias the existing checkpoint-18/checkpoint-35 deliveries and inherit their awaiting-review status; no models were rebuilt for them. Eleven obsolete Israelite unit rows are `superseded` by `plans/ART-MODELS-PLAN.md` section 4.4 and the delivered Merkava signature row. They remain auditable non-delivery records. Net queue change: 16 rows pending → awaiting review, 11 rows pending → superseded; accepted stays 285.
