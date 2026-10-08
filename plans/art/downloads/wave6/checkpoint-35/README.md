# Wave 6 checkpoint 35: the Modern remainder

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (31 queue items: `battle-city/modern/<theme>/houses-damage` for the 13 themes,
the new `battle-city/modern/palace-damage`, `units/modern-raider`, `units/modern-mercenary`,
`fx/projectiles-modern`, the new `props/modern`, the new `rts/modern/skins/<theme>` for 12 themes and the
new `improvements/modern/fort`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): Modern cities with damaged and ruined houses in the battle sandbox at 844x390
(Europe, Nile), a Modern sack with a hired band, an economy battle whose Egyptian side builds in its Nile
skin, the culture skins side by side, and the proofs of the houses, the palace damage, the irregulars, the
props, the projectiles and the map fort. Shots: `plans/art/shots/wave6/damage-modern/`, `irregular-modern/`,
`skins-modern/`. With this the Modern age is complete.

## Delivered (1024 atlases, packed)
| Files | What | Builder | Packed |
|---|---|---|---:|
| `src/assets/battle/city/modern[-<theme>]-houses-damage.glb` (13) | house-poor, -common, -rich, each `-damaged` and `-ruined`, from the theme's own Modern houses (procedural base, Levant and Sinic kits; the delivered kits for the other 10, Europe included); concrete rubble | `build_houses_damage_modern.py` | 6.09 MB |
| `src/assets/battle/city/palace-damage-modern.glb` | the domed government palace and the smaller ministry (palace-small), each damaged and ruined from shared-modern.glb | `build_palace_damage_modern.py` | 0.40 MB |
| `src/assets/units/modern-raider.glb` (+ `.json`, true height) | a technical: a pickup on the wheeled rig with a machine gun on a pintle, loot (sacks, a crate, a television, jerrycans), a Team tailgate and doors, a gunner with a raised torch (2,108 triangles) | `build_units_modern_irregular.py` | 0.12 MB |
| `src/assets/units/modern-mercenary.glb` (+ `.json`) | a contractor: ball cap and headset, Team chest rig, striped sash and coin pouch, beard, carbine (1,409) | same | 0.08 MB |
| `src/assets/battle/projectiles/modern.glb` | shell (155 mm), missile (ATGM, fins), cannonball | `build_projectiles_modern.py` | 29 KB |
| `src/assets/battle/props/props-modern.glb` | the twelve prop names: chain-link fence, concrete road barrier, hand pump, army trailer, round bales, ammunition boxes, oil drums, market gazebo, flag on a steel pole, campfire, concrete memorial, road sign; CC0-1.0 | `build_props_modern.py` | 0.23 MB |
| `src/assets/battle/rts/rts-modern-<theme>.glb` (12) | barracks, tower and trade post and their `-damaged` states in the theme's Modern houses; the tower a concrete bunker foot, a shaft of the theme's stuff and a sandbag parapet | `build_rts_skins_modern.py` | 9.45 MB |
| `src/assets/map/improvements/fort-modern.glb` | the battle's bunker line on a round earth patch in the 50 m circle | `build_improvement_fort_modern.py` | 0.39 MB |

Together 16.79 MB in 33 files. validate_model.py: all pass (steppe's houses on a second rubble draw, the
missile at 4-sided segments to stay under 60 triangles, the map fort's trench clamped to the ground).

## Wired
Nothing new needed in the game code: `artIndex.housesDamage('modern', style)` and `palaceDamage('modern')`,
unitModels.js LOOK_CLASS (raider squads draw the technical, at its true height; hired bands the
contractor), `artIndex.projectiles` (howitzers fire `shell`, ATGM teams and AA trucks `missile`),
`props`, `artIndex.rtsSkin('modern', style)` (one shared build-menu icon per role) and
improvementModels.js (from the Modern Age every land's fort is the bunker line; Israel keeps its own
Modern fort; `improvementModels.test.js` says so). No console errors from the game.

## Not shot live
The map fort's close view: scripts/art/improvement-shots.mjs plays Israel, whose Modern fort is its own
(fort-modern-israelite.glb); the Blender proof is in `skins-modern/proof-map-fort-modern.png`.
