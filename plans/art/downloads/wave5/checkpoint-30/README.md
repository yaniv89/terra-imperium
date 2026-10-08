# Wave 5 checkpoint 30: the Gunpowder remainder

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (31 queue items: `battle-city/gunpowder/<theme>/houses-damage` for the 13
themes, the new `battle-city/gunpowder/palace-damage`, `units/gunpowder-raider`, `units/gunpowder-mercenary`,
`fx/projectiles-gunpowder`, the new `props/gunpowder`, the new `rts/gunpowder/skins/<theme>` for 12 themes
and `improvements/gunpowder/fort`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): Gunpowder cities in the battle sandbox at 844x390 (Europe wide and close with
ruined and damaged houses, Nile), a Gunpowder sack with a hired band, the raider and mercenary lineup, an
economy battle whose Egyptian side builds in its Nile skin, the palace damage and props proofs, and the
star fort on the map's close view. Shots: `plans/art/shots/wave5/damage-gunpowder/`, `irregular-gunpowder/`,
`skins-gunpowder/`. With this the Gunpowder age is complete.

## Delivered (1024 atlases, packed)
| Files | What | Builder | Packed |
|---|---|---|---:|
| `src/assets/battle/city/gunpowder[-<theme>]-houses-damage.glb` (13) | house-poor, -common, -rich, each `-damaged` and `-ruined`, from the theme's own Gunpowder houses (procedural base, Europe, Levant, Sinic kits; the delivered kits for the other 9, Indic included) | `build_houses_damage_gunpowder.py` | 6.82 MB |
| `src/assets/battle/city/palace-damage-gunpowder.glb` | the domed baroque palace and the manor (palace-small), each damaged and ruined from shared-gunpowder.glb; the manor's ruin is cut inside its ground floor (its storeys are closed boxes) | `build_palace_damage_gunpowder.py` | 0.51 MB |
| `src/assets/units/gunpowder-raider.glb` | a horseman on a blanket with loot sacks, a brass kettle and a clock on the croup; loose Team coat, slouch hat, bandolier, raised torch, carbine slung (2,028 triangles) | `build_units_gunpowder_irregular.py` | 0.11 MB |
| `src/assets/units/gunpowder-mercenary.glb` | buff leather coat over a Team waistcoat, broad plumed hat, bandolier of chargers, striped sash and coin pouch, boots, matchlock and short sword (1,442) | same | 0.09 MB |
| `src/assets/battle/projectiles/gunpowder.glb` | cannonball, plus the Kingdoms arrow, javelin, sling-stone, bolt and stone for the age's signature archers and slingers | `build_projectiles_gunpowder.py` | 33 KB |
| `src/assets/battle/props/props-gunpowder.glb` | the twelve prop names: picket fence, brick field wall, brick well under tile, ammunition cart, haystack, crate, powder barrels, awning stall, regimental colour, campfire, wayside shrine, milestone; CC0-1.0 | `build_props_gunpowder.py` | 0.37 MB |
| `src/assets/battle/rts/rts-gunpowder-<theme>.glb` (12) | barracks, tower, trade post and their `-damaged` states in the theme's Gunpowder houses, the tower in the theme's stuff | `build_rts_skins_gunpowder.py` | 9.68 MB |
| `src/assets/map/improvements/fort-gunpowder.glb` | the battle's star fort on a round earth patch in the 50 m circle | `build_improvement_fort_gunpowder.py` | 0.42 MB |

Together 18.03 MB. validate_model.py: all 31 files pass.

The Gunpowder house kits of the nine delivered themes were not in `art-build/kitsrc` yet; they were
unpacked from the delivery ZIPs kept outside git (`C:\GitWotkspace\art-downloads-backup`, the
`plans/art/kits/<theme>/gunpowder/houses` and `modern/houses` folders).

## Wired
Nothing new needed in the game code: `artIndex.housesDamage('gunpowder', style)` and
`palaceDamage('gunpowder')`, unitModels.js LOOK_CLASS, `artIndex.projectiles` (siege and towers fire
`cannonball`) and `props`, `artIndex.rtsSkin('gunpowder', style)` (one shared build-menu icon per role) and
improvementModels.js (from the Gunpowder Age on every land's fort is the star fort, the Israelite Modern
fort in the Modern Age; `improvementModels.test.js` says so). No console errors from the game.
