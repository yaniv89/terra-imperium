# Wave 1 checkpoint 06: Bronze raider and mercenary

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status `in_game_awaiting_review`.

[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png) (the real
loader and soldier shader, both team colours, beside the base chariot and spearman for scale).

| File | Unit | Triangles | Packed |
|---|---|---:|---:|
| `src/assets/units/bronze-raider.glb` | a light horseman with loot sacks, a bundle and a jar on the croup, a raised torch, a slung javelin; Team tunic and headcloth | 1,696 | 98 KB |
| `src/assets/units/bronze-mercenary.glb` | a hired foot soldier: feathered crown, banded corselet, greaves, Team kilt, neutral sash and coin pouch, round Emblem shield, long bronze sword | 1,410 | 79 KB |

177 KB added. Built by `scripts/blender/build_units_bronze_irregular.py` on the shared rig and body
(`ti_units.py`), original procedural geometry, flat colours (the torch flame is an orange `Flame`
material); rest pose like the general, the vertex rig walks the legs and trots the horse.

## Wired
- `src/battle/render/unitModels.js`: `LOOK_CLASS` (raider replaces cavalry, mercenary replaces
  infantry), `unitLookOf` (engine `unit.raidOf` or the attackers of a raid or sack battle: raider;
  `unit.mercenary`: mercenary), the models load with the battle's extras.
- The battle view carries each squad's `look` (view.js, packedView.js); `BattleRenderer.squadLook`
  draws the look's layer when its model is in (a people's signature unit still wins), else the base.
- Fallback: no file for the age, the base unit of the class.

## Checks
Lint clean; battle render and art tests pass (new: looks and their models). Budgets: person 1,500,
mounted 2,500 (both under).
