# Wave 3 checkpoint 17: Classical raider, mercenary, projectiles and props

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (4 queue items: `units/classical-raider`, `units/classical-mercenary`,
`fx/projectiles-classical`, and the new `props/classical`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): a Classical sack in the battle sandbox
(`city=small&age=classical&raid=sack&merc`, the raiders top left), the in-game lineup (two team
colours), the props and projectile proofs. Shots: `plans/art/shots/wave3/irregular-classical/`.

## Delivered (packed)
| File | What | Triangles | Packed |
|---|---|---:|---:|
| `src/assets/units/classical-raider.glb` | a light horseman on a fleece, loot sacks, a rolled bundle and a looted bronze cauldron on the croup; Team tunic, pinned cloak, felt cap, raised torch (`Flame`), two javelins | 1,764 | 102 KB |
| `src/assets/units/classical-mercenary.glb` | crested helmet with cheek pieces, mail shirt with shoulder capes, Team tunic, sash and coin pouch, greaves, oval Emblem shield with spine and boss, curved sword | 1,392 | 77 KB |
| `src/assets/battle/projectiles/classical.glb` | arrow, javelin (pilum), sling-stone (lead), bolt (ballista), stone | under 60 each | 34 KB |
| `src/assets/battle/props/props-classical.glb` | fence-a, field-wall-a, well, cart, haystack, crate, barrel (amphora rack), market-stall, standard (vexillum), campfire, shrine (altar), road-marker (milestone); CC0-1.0 | 92 to 708 LOD0 | 362 KB |

Builders: `build_units_classical_irregular.py`, `build_projectiles_classical.py`,
`build_props_classical.py` (the Bronze kits' machinery and helpers, Classical shapes and materials).
validate_model.py `auto` passes the projectile and props files. Together 0.58 MB.

## Wired
Nothing new needed: unitModels.js looks for `<age>-raider.glb` and `<age>-mercenary.glb`
(LOOK_CLASS), projectiles.js and battleProps.js take the age's file first, so Classical raids, hired
bands, shots and battlefield dressing now use Classical art. No console errors.
