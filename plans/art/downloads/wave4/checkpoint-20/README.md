# Wave 4 checkpoint 20: the Kingdoms base units and general

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). "Wave 4" = the Kingdoms
(medieval) age. Status `in_game_awaiting_review` (7 queue items: `units/kingdoms-infantry`, `-ranged`,
`-cavalry`, `-siege`, `-support`, `-worker`, `-general`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): the in-game lineup (two team colours,
standing), the sandbox's knights, its wide opening view and the pikemen at 844x390.
Shots and Blender proofs: `plans/art/shots/wave4/units-kingdoms/`.

## Delivered (`scripts/blender/build_units_kingdoms.py`, packed without quantization)
| File | Look | LOD0 triangles |
|---|---|---:|
| `src/assets/units/kingdoms-infantry.glb` | Pikemen: padded Team gambeson with quilting, kettle hat, a long pike, sword at the side | 1,234 |
| `kingdoms-ranged.glb` | Longbowmen: tall self bow, arrow bag at the hip, padded Team jack, hood, dagger | 1,352 |
| `kingdoms-cavalry.glb` | Knights: mail, Team surcoat, great helm, lance, kite shield (Emblem), warhorse in a Team caparison | 1,756 |
| `kingdoms-siege.glb` | Trebuchet: counterweight engine on the skid frame (A-frame uprights, axle, cocked beam, counterweight box, sling with a stone), three crew | 1,801 |
| `kingdoms-support.glb` | Pioneers: a pavise (Emblem) on the back, shovel, sapping pick, padded coat, coif | 1,212 |
| `kingdoms-worker.glb` | Villager: Team tunic, hood, axe, a sack on the back | 1,198 |
| `kingdoms-general.glb` | a mounted lord (mail, Team surcoat, crowned great helm, Team cloak, sword) on a caparisoned horse; a banner bearer with the Emblem banner | 2,347 |

No new rigs were needed: the person rig, the horse (`ti_mounts.horse`) and the siege frame
(`ti_mounts.frame`, without wheels) carry them. The old disabled Kingdoms recipe sidecars
(`kingdoms-*.json`, a CC0 soldier recipe) are replaced by the base units' enabling JSON. Together
0.62 MB.

## Wired
Nothing new needed: `findUnitModel('kingdoms', class)` and `findGeneralModel('kingdoms')` now find the
files, so every Kingdoms side fields GLB units. Tests updated (`unitPipeline.test.js`,
`unitExtras.test.js`: Kingdoms ships; Gunpowder and Modern still procedural). No console errors
besides the dev server's font 403s.
