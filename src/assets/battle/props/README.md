# Decorative Bronze battlefield props

`props-bronze.glb`: fence-a, field-wall-a, well, cart, haystack, crate, barrel,
market-stall, standard, campfire, shrine, road-marker. Each named root has LOD0,
LOD1, LOD2 with one shared 1024 color+AO atlas, matte Town and neutral grey Team cloth.
1 model unit = 10 metres, ground origin, glTF+Y up and +Z front. No alpha ground plates.

Source: scripts/blender/build_props_bronze.py; editable delivery in art-build/props-bronze.
Geometry and procedural texture synthesis are original, CC0-1.0. The generated 2D
sheet is a design reference only and is not sampled or embedded in the texture.

Placed by `src/battle/art/battleProps.js` (BattleRenderer): standards in the side's colour before the
keep and at the attacker's camp, a well, cart, stalls, crates, barrels, haystacks and a shrine round
the keep or in the city, a campfire and stores at the camp, marker stones by the roads, and up to
three farm corners (fences, a field wall, haystacks) in the open. Decorative only (no tiles, no
sim state); a prop under a new economy building hides. Scale: 2.75 battle tiles per model unit.
The age's file, else an earlier age's, but never for a Modern battle.
Campfire geometry is intentionally unlit logs; flames are a separate runtime effect.


`props-classical.glb` (2026-10-08, scripts/blender/build_props_classical.py, CC0-1.0): the same twelve
names in Classical dress: a post-and-rail fence, a dry ashlar field wall, a round ashlar well under a
pulley beam, a two-wheeled cart with spoked wheels, a haystack, a crate, an amphora rack (`barrel`), a
tile-roofed market stall, a vexillum standard (Team cloth under a bronze disc), a campfire, a small
marble altar under a pedimented niche (`shrine`) and a milestone (`road-marker`). Classical battles
draw them (artIndex.props: the age's file first).

`props-kingdoms.glb` (2026-10-08, scripts/blender/build_props_kingdoms.py, CC0-1.0): the twelve names
in medieval dress: a wattle hurdle, a dry-stone field wall with a coping, a stone well under a shingled
roof with a windlass, a plank cart with iron-tyred wheels and sacks, a haystack, a crate, two staved
barrels (`barrel`), a stall under a Team awning with a striped valance, a Team gonfanon under an iron
cross (`standard`), a campfire, a wayside stone cross (`shrine`) and a waymark stone (`road-marker`).

`props-gunpowder.glb` (2026-10-08, scripts/blender/build_props_gunpowder.py, CC0-1.0): a picket fence, a
brick field wall with a sandstone coping, a brick well under a tile roof, an ammunition cart with powder
barrels, a haystack, a crate, powder barrels (`barrel`), the kit's stall under a Team awning, a regimental
colour on a pike (`standard`), a campfire, a sandstone wayside shrine and a milestone.


## Raid and landing props

Six separate files, each with one root named exactly as its filename stem and
LOD0, LOD1, LOD2 children:

| File/root | Required design |
| --- | --- |
| `loot-sack.glb` | Canvas sacks and a clay amphora, shared across ages |
| `exit-marker.glb` | Neutral Team flag with an arrow pointing to local +Z (Blender -Y) |
| `burnt-field-overlay.glb` | Thin irregular scorched field overlay, cutout Ground edge |
| `landing-ancient.glb` | Beached galleys with gangplanks |
| `landing-middle.glb` | Ship's boats with a carrack offshore |
| `landing-modern.glb` | Open-bow landing craft with lowered ramps |

Source: `scripts/blender/build_raid_landing_props.py` and its dedicated
`raid_landing_support.py`. Original geometry and procedural textures, CC0-1.0.
The generated design sheet is reference only, never sampled into a texture.
The builder waits for a hash-matched visual review of the corrected six-item sheet.
Editable packed BLENDs, basecolor/normal/ORM PNG maps, 844x390 warm previews and
reports live in `/workspace/remaining-production/props/<root>/` during production.
No delivery is implied until the GLBs and their validation reports exist.

All six use embedded 1024 atlases, neutral Team cloth, matte Town material,
actual baked AO applied to basecolor once, no vertex RGB multiplication, and
uncompressed mesh data. Origin and axes match the existing props contract.
Landing roots include `socket-door` at the shore end of the ramp/gangplank.

`src/battle/art/raidLandingProps.js` resolves these exact files via `ART.url()`.
It instances exits at existing entry/fallback edges, goods beside live raid loot
structures and on visible workers listed in `eco.carrying`, scorch overlays on
explicitly destroyed field loot structures/farms, and the matching age's landing
root against the actual sea/sand boundary. Team alone takes the side's colour.
The shared kit loader selects LOD by camera zoom. Ordinary no-economy land setups
load only the exit marker; goods/scorch textures load only for an economy configuration,
loot-bearing structures or a raid/sack type. Landing textures load only for landing maps. Missing files leave existing
rendering in place. Placement reads snapshots and changes no simulation state.
There is no per-raider loot inventory in the current render view: this layer does
not claim to show such inventory or infer pillage merely from damaged HP.
