# Art production progress

Authoritative scope: `plans/art/ITEMS.md`, Part B (276) and Part C (74): **350 logical items**. Part A’s 402 in-game items are excluded. A/B variants stay together as one logical item.

**Delivered and in the game: 285 / 350. Remaining: 65.** (260 uploaded in the checkpoints below, plus the 25 of the local transfer.)

Built but not yet delivered: 0.

Import check 2026-10-07: every item in every ZIP below is in the game (`node scripts/art/downloads-coverage.mjs`). The 25 items built in the cloud (8 buildings, 13 base tile improvements, classical town-big a and b, warships bronze, classical and kingdoms) came through the transfer archives in [local-transfer-2026-10-07](local-transfer-2026-10-07/README.md) and were validated, fixed where needed and imported the same day (details in [IMPLEMENTED.md](IMPLEMENTED.md), "Imported 2026-10-07").

Wave 0 backlog repair 2026-10-07 (Codex, committed by Claude): the 13 base tile improvements got continuous Ground and readable distant LODs, the three warships and the Classical big towns A and B were re-exported and brightened; the cathedral and the 7 buildings are unchanged in the game. Checkpoints [01](downloads/wave0-backlog/checkpoint-01/README.md) (20 items, 4 ZIPs) and [02-final](downloads/wave0-backlog/checkpoint-02-final/README.md) (5 items, 1 ZIP); the ZIPs are kept outside git (see those READMEs).

Wave 1 (plans/ART-MODELS-PLAN.md) [checkpoint 01](downloads/wave1/checkpoint-01/README.md), 2026-10-07: the 7 Bronze base units and general (4 by Codex, 3 by Claude) and the 13 Bronze battle buildings with damaged states (`rts-bronze.glb`), 20 items in the game, status `in_game_awaiting_review` in production-queue.json; the 4 ZIPs are kept outside git (see that README).

Wave 1 [checkpoint 02](downloads/wave1/checkpoint-02/README.md), 2026-10-07 (Claude, Blender 5.2 headless): the Bronze construction stages (in `rts-bronze.glb`), the Bronze wall kit, ruin library and fort, the Bronze projectiles, the four resource nodes, the two herds and the temperate, mediterranean and desert vegetation kits, 14 items in the game, status `in_game_awaiting_review`; the 3 ZIPs are kept outside git (see that README).

Wave 1 [checkpoint 03](downloads/wave1/checkpoint-03/README.md), 2026-10-07: the 13 Bronze damaged-and-ruined house files (base and 12 themes), the 8 ground materials (colour in the game) and the 8 core battle effect sheets; 20 queue items `in_game_awaiting_review` (the effect sheets have no queue items); the 4 ZIPs are kept outside git.

**Quality review: 0 delivered items require revision; 285 accepted. 65 items remain to finish.** Upload verification alone does not establish visual quality. Previously rejected batches have been replaced and verified. Delivery links and exact item lists are below.

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
