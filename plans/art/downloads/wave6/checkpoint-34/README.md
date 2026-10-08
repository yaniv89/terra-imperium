# Wave 6 checkpoint 34: the Modern city kit (walls, ruins, bunker-line fort, civic hall)

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (4 queue items: `battle-city/modern/wall-kit`, `ruin-library`, `fort` and the new
`battle-city/modern/civic`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): medium Modern cities in the sandbox at 844x390 (Europe and Levant: the
headquarters block as the keep, the T-wall ring) and the Blender proofs of the wall kit, the civic hall,
the fort and the ruins. Shots: `plans/art/shots/wave6/city-modern/`.

## Delivered (`scripts/blender/build_city_modern.py`, 1024 atlases, packed)
| File | Objects | Packed |
|---|---|---:|
| `src/assets/battle/city/walls-modern.glb` | wall-straight, wall-corner, tower, gate-open, gate-closed, each `-damaged` and `-breached`: precast concrete T-wall slabs on a footing with concertina wire and an inner sandbag step; a concrete guard tower on a bunker foot (cab, slits, searchlight, pennant); a gateway of two pillboxes with a sliding steel mesh gate and a barrier arm. Damaged: slabs askew and one fallen, the wire cut; breached: the slabs down in a concrete heap with bent rebar | 0.64 MB |
| `ruins-modern.glb` | rubble-s, rubble-m, rubble-l (concrete, render, brick, corrugated sheet), beams, scorch | 0.35 MB |
| `fort-modern.glb` | fort: a bunker line in the 50 m circle (ti_modern's grassed berm with a crest trench, barbed wire and four pillboxes) round a sunken command bunker with a radio mast, two prefab barrack huts, two sandbagged AA gun pits, a lorry and the flag; 6,514 / 1,414 / 236 triangles | 0.52 MB |
| `civic-modern.glb` | keep, keep-damaged, keep-ruined: the headquarters of rts-modern.glb (a three-storey rendered block behind its wall and sandbagged gate); ruined, its walls stand as stubs | 0.53 MB |

Together 2.04 MB (4 files). validate_model.py `auto`: all four pass (the fort's far levels trimmed to the
improvement budget, the breached tower's far rubble kept to one heap).

## Wired
Nothing new needed: `artIndex.walls/ruins/fort('modern')` and `civic('modern')` resolve the new files
(before, a Modern city drew the Gunpowder walls and ruins by the age chain and a greybox keep). No console
errors from the game.

## Next
The Modern remainder: damaged and ruined houses for the 13 themes, palace damage, raider and mercenary,
projectiles, props, culture skins and the map fort.
