# Wave 4 checkpoint 24: the Kingdoms remainder

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (31 queue items: `battle-city/kingdoms/<theme>/houses-damage` for the 13
themes, the new `battle-city/kingdoms/palace-damage`, `units/kingdoms-raider`, `units/kingdoms-mercenary`,
`fx/projectiles-kingdoms`, the new `props/kingdoms`, the new `rts/kingdoms/skins/<theme>` for 12 themes and
`improvements/kingdoms/fort`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): Kingdoms cities in the battle sandbox at 844x390 (Europe wide and close
with ruined and damaged houses, Sinic), a Kingdoms sack with a hired band, the raider and mercenary
lineup in two team colours, an economy battle whose Egyptian side builds in its Nile skin, and the
proofs of the palace damage, the props and the map fort. Shots: `plans/art/shots/wave4/damage-kingdoms/`,
`irregular-kingdoms/`, `skins-kingdoms/`. With this the Kingdoms age is complete, like the Classical age
after checkpoint 18.

## Delivered (1024 atlases, packed)
| Files | What | Builder | Packed |
|---|---|---|---:|
| `src/assets/battle/city/kingdoms[-<theme>]-houses-damage.glb` (13) | house-poor, -common, -rich, each `-damaged` and `-ruined`, from the theme's own Kingdoms houses (procedural base, Europe, Indic, Levant, Sinic kits; the delivered kits for the other 8) | `build_houses_damage_kingdoms.py` | 6.87 MB |
| `src/assets/battle/city/palace-damage-kingdoms.glb` | palace (the stone castle) and palace-small (the motte and timber hall), each damaged and ruined from shared-kingdoms.glb; the motte's ruin keeps its mound with the hall burnt to stubs on top | `build_palace_damage_kingdoms.py` | 0.47 MB |
| `src/assets/units/kingdoms-raider.glb` | a light horseman on a sheepskin with loot sacks, a rolled bundle, a looted iron pot and a church candlestick; padded Team jack, hood, raised torch, slung spear (1,968 triangles) | `build_units_kingdoms_irregular.py` | 110 KB |
| `src/assets/units/kingdoms-mercenary.glb` | pointed bascinet with a mail aventail, riveted brigandine over Team sleeves, greaves, striped sash and coin pouch, round Emblem buckler, falchion (1,408 triangles) | same | 78 KB |
| `src/assets/battle/projectiles/kingdoms.glb` | arrow (longbow bodkin), javelin, sling-stone, bolt (crossbow quarrel), stone (trebuchet ball), under 60 triangles each | `build_projectiles_kingdoms.py` | 30 KB |
| `src/assets/battle/props/props-kingdoms.glb` | the twelve prop names: wattle hurdle, dry-stone wall, shingled well, plank cart, haystack, crate, staved barrels, awning stall, gonfanon, campfire, wayside cross, waymark stone; CC0-1.0 | `build_props_kingdoms.py` | 334 KB |
| `src/assets/battle/rts/rts-kingdoms-<theme>.glb` (12) | barracks, tower, trade post and their `-damaged` states in the theme's Kingdoms houses, the tower in the theme's stuff (wall stone in Europe, ashlar in the Levant and Maghreb, sandstone in India, brick in China, stone in the Americas, East Africa and Israel, timber on posts in the Steppe and Monsoon lands, mud elsewhere) | `build_rts_skins_kingdoms.py` | 9.47 MB |
| `src/assets/map/improvements/fort-kingdoms.glb` | the battle's Kingdoms fort on a round earth patch in the 50 m circle, LOD0 / LOD1 / LOD2 6,525 / 1,407 / 255 triangles | `build_improvement_fort_kingdoms.py` | 0.60 MB |

Together 17.96 MB. validate_model.py: all 31 files pass (house-damage, `auto` for the rest).

## Wired
Nothing new needed in the game code; the existing lookups now find the files:
`artIndex.housesDamage('kingdoms', style)` and `palaceDamage('kingdoms')` (battle and close view),
unitModels.js LOOK_CLASS (`kingdoms-raider`, `kingdoms-mercenary`), `artIndex.projectiles` and `props`
(the age's file first), `artIndex.rtsSkin('kingdoms', style)` (economyLayer.js; the build menu keeps
one shared icon per role, the user's decision) and improvementModels.js (the latest age's base fort
first: from the Kingdoms Age on every land's fort is the Kingdoms fort, the Israelite Modern fort in the
Modern Age; `improvementModels.test.js` says so). Sandbox runs: no console errors from the game (the
only failures are the worktree's font files outside the Vite root, 403).
