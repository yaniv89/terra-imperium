# Wave 1: checkpoint 01 (Bronze battle: base units, general, battle buildings)

20 logical items, 2026-10-07, branch `claude/art-wave1` (plans/ART-MODELS-PLAN.md section 12, Wave 1).
All 20 are in the game (packed copies in `src/assets/units/` and `src/assets/battle/rts/rts-bronze.glb`);
the ZIPs hold the editable sources, uncompressed GLBs, previews, validation reports and the build
scripts. [Manifest](manifest.json) · [Checksums](SHA256SUMS.txt) · [Contact sheet](contact.png) ·
in-game shots in [plans/art/shots/wave1](../../../shots/wave1/).

| Archive | Logical items |
|---|---|
| part-1.zip | bronze-infantry, bronze-ranged, bronze-cavalry, bronze-siege, bronze-support (+ the shared neutral body and rig) |
| part-2.zip | bronze-worker, bronze-general, expedition-camp, town-hall, food-depot (+ the rts-bronze source) |
| part-3.zip | materials-yard, trade-post, farm-plot, mine, barracks (+ the rts-bronze source) |
| part-4.zip | range, stable, siege-workshop, aid-post, tower (+ the rts-bronze source) |

**Where the ZIPs are:** the GitHub CLI is not installed on this PC, so no release could be created.
The four ZIPs (SHA-256 in [SHA256SUMS.txt](SHA256SUMS.txt)) are kept outside the repository in
`C:\GitWotkspace\art-deliveries\wave1-2026-10-07\`. To publish them as release assets:
`gh release create wave1-2026-10-07 C:\GitWotkspace\art-deliveries\wave1-2026-10-07\part-*.zip`
(the manifest already names those URLs). `node scripts/art/downloads-coverage.mjs --items` checks
every item of this checkpoint against the game (file and object name).

## Units (src/assets/units/bronze-*.glb)

| Item | Triangles (target) | By | Notes |
|---|---:|---|---|
| bronze-infantry | 1,508 (1,500) | Codex | spearman: kilt, leather corselet, bronze cap, round Emblem shield, 2.2 m spear; 12 clips |
| bronze-ranged | 1,494 (1,500) | Codex, Claude | archer: self bow, quiver, knife; Claude made the kilt Team so the side reads at 30 px; 9 clips |
| bronze-cavalry | 2,388 (2,500) | Claude | light chariot: two small horses side by side (0.78 H at the withers), six-spoke wheels, axle at the rear, driver with reins and archer with a self bow, Team-dyed front |
| bronze-siege | 2,900 (3,000) | Codex | covered ram on four wheels with hide roof and four pushers; 7 clips |
| bronze-support | 2,000 (3,000) | Claude | baggage train: one long-horned ox in shafts with a withers yoke, solid-wheeled cart, terracotta jars, sacks under a Team cover, seated driver with a goad |
| bronze-worker | 1,348 (1,500) | Codex | laborer: Team kilt, headcloth, basket and mattock; 12 worker clips |
| bronze-general | 2,005 (2,500) | Claude | mounted commander (Team cloak, saddle cloth and plume, bronze scale and helmet, mace) with a standard bearer on foot whose banner prints the squad's Emblem |

Every unit passes `validate_model.py` (unit, unit-mounted, unit-machine): flat colours on the tag
materials only, no textures, bones the loader maps (rider and crew legs stand still, horse and ox
legs trot in diagonal pairs). In the battle sandbox (`?battleSandbox&bench=20&autostart&age=bronze`,
844x390) every class draws its own model at full detail and walks with the vertex rig.
**Animation:** Codex's units carry authored 20 fps clips; the three Claude units are rest pose only.
No clip plays in battle yet: that needs the VAT bake of Wave 0b (plan decision D5).

## Battle buildings (src/assets/battle/rts/rts-bronze.glb)

13 roles, each with a `<role>-damaged` sibling (part of the upper works and cloth fallen, rubble
heaps of the building's own material, scorched ground, fallen beams) and sockets (`socket-door`
facing -Y, `socket-rally`, `socket-drop` on depots, `socket-banner` at the pennant, `socket-fire-1..4`,
`socket-smoke-1`). Built from the Bronze town kit (mud-brick houses, granaries, tents, stalls, the
watch tower) so a battle's buildings match the towns. One 2048 atlas (Town, Team; no ground plate),
LOD0/LOD1/LOD2 for every object, all within the prefab budgets (largest LOD0: town-hall 3,156,
trade-post 3,084; HQ budget 15,000, others 8,000). Seen in an economy battle at 844x390
(expedition camp, barracks, range). Not yet built: the construction stages and farm growth stages
(next checkpoint) and the per-theme culture skins (plan section 5, later waves).

Note: until `rts-classical.glb` and later files exist, Classical to Modern battles also draw these
Bronze buildings (the loader falls back to the nearest earlier age, src/assets/battle/rts/README.md).
