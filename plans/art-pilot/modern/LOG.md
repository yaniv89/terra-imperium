# Modern Age towns, palaces, perimeters, the outpost camp and fields

Date: 2026-10-03. Sources: GPT's combined 1254 px concept sheets, filed under
`plans/art/towns/modern/<id>/reference-sheet.png` (batch READMEs beside them). Built in Blender
4.2 (`bpy` module) on the shared kit (`ti_map.py`, `ti_town.py`, with `sweep` and `ring_frame`
from `ti_bronze.py` and `gable_roof` from `ti_classical.py`) plus the new
`scripts/blender/ti_modern.py`; one 2048 WebP atlas set per file. Builders:
`build_town_modern_<size>_<variant>.py`, `build_shared_modern.py`.

| Object | File | Contents | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|---|
| town-small-a | modern-town-small-a.glb | street round a paved square, 6 houses (render and brick, hip and gable roofs), 12 m water tower | 4,140 / 1,576 / 556 | 40 m | 12 m (tower) | 1.9 MB |
| town-small-b | modern-town-small-b.glb | asphalt square, 4 blocks, 2 gabled brick houses, glazed canopy, 11 m clock tower | 4,126 / 1,602 / 402 | 40 m | 11.6 m | 1.9 MB |
| town-medium-a | modern-town-medium-a.glb | 20 m glass tower, station and tracks, 21 blocks, market tents, south street, park | 10,012 / 3,468 / 696 | 60 m | 21 m (mast) | 2.5 MB |
| town-medium-b | modern-town-medium-b.glb | 18 m water tower in a green, sawtooth works and chimney, 14 blocks and gabled houses, market tents, north lawn | 7,644 / 2,738 / 870 | 60 m | 18 m | 2.3 MB |
| town-big-a | modern-town-big-a.glb | 42 m glass tower, stadium, diagonal station, 18 m water tower, 27 blocks and gabled houses, market tents, five streets | 14,610 / 5,178 / 1,176 | 80 m | 43 m (mast) | 3.0 MB |
| town-big-b | modern-town-big-b.glb | stepped 42 m skyscraper, water tower park, sawtooth works and 16 m chimney, covered market, bus shelter, 28 blocks | 14,058 / 5,106 / 1,186 | 80 m | 42 m | 2.9 MB |
| palace-small | shared-modern.glb | town hall: two-storey civic block, five window bays, canopy, steps, two flags | 914 / 726 / 22 | 11.7 m | 8.8 m | |
| palace | shared-modern.glb | parliament: portico of 8 columns, ribbed dome and lantern, two wings, forecourt, two flags | 2,532 / 1,400 / 204 | 12.2 m | 12.3 m | |
| walls-small | shared-modern.glb | grassed berm, 4 bunkers, posts and barbed wire, timber barrier | 3,986 / 1,482 / 192 | 45 m | 4.4 m | |
| walls-medium | shared-modern.glb | berm with crest trench, 6 pillboxes, wire, barrier | 6,018 / 2,126 / 216 | 68 m | 5.1 m | |
| walls-big | shared-modern.glb | berm with crest trench, 7 bunkers, wire, barrier | 6,466 / 2,174 / 300 | 90 m | 5.7 m | |
| colony-camp | shared-modern.glb | three prefab cabins with corrugated roofs, fire ring, crates, sandbags, jerrycans, pipes, boards, chain-link fence, flag | 2,494 / 1,264 / 400 | 20 x 18 m | 5.2 m (flag) | |
| field-1 to field-4 | shared-modern.glb | wheat with an irrigation pipe; apple orchard with drip line; fenced pasture with steel trough and gate; two polytunnels with vegetable beds | at most 3,184 / 1,077 / 238 | 17 x 13 m | 1.3 to 2.5 m | 4.3 MB (all ten) |

Every file passes `validate_model.py` (`*.validation.json` beside the GLBs in
`/tmp/claude-0/out/modern/`): budgets, Town / Ground (alpha-cut) / Team materials, one atlas set,
nothing below ground. `*-concept-vs-model.png` here: the sheet's beauty panel beside the model.

## Variants
Both variants share the age's palette (off-white render, red brick, slate, grey membrane roofs,
blue-grey glass, steel, asphalt) and differ in layout and landmark, as the sheets do:
- a: the water tower village (small), the station and glass-tower market town (medium), the
  tower, stadium and station city (big).
- b: the clock tower and canopy square (small), the works town with its water tower (medium),
  the stepped skyscraper, works and water tower park city (big).
No regional tradition is implied; the lead can pick by city as with the Bronze kit.

## Decisions
- Windows are painted by the material, not modelled: `mat_facade` draws a grid of framed,
  sky-lit glass panes on object (x + y, z), one row per raised storey (`STOREY`), so a whole
  facade costs two triangles. Blocks therefore stay axis-aligned (yaw 0, 90, 180, -90).
  Towers use the same material at a 3.5 m floor pitch as a curtain wall; shopfronts, glazed
  canopy roofs (a grid on x, y) and the stadium's rows are separate materials.
- Ordinary buildings are raised 1.3x (two storeys 8.4 m, three 12.6 m). The sheets' blocks are
  deeper than a house, so the medium and big layouts widen every block's footprint (1.25x and
  1.35x) and ring it with a lawn verge, which gives the sheets' density and green.
- Landmarks at the sheets' heights: water towers 12 m and 18 m, clock tower 11 m, glass tower
  20 m, big towers 42 m, works chimneys 14 to 16 m. The 1.3x raise makes the medium town's 20 m
  tower stand less above its blocks than on the sheet.
- Palaces depart from the sheets' heights: at the free centre's 12 m footprint the sheets' 11 m
  town hall and 22 m parliament stood like towers. The town hall is widened to 11.7 m and kept at
  a raised two-storey 8.8 m; the parliament keeps its plan at 12.2 m and is scaled to 12.3 m to the
  lantern (`scaled()` in ti_modern.py wraps the builders). Say if the sheet heights are wanted.
- Walls are earthworks, not masonry: a grassed berm (a mud trench along the crest of the medium
  and big rings), concrete pillboxes on the crest, steel posts with two plain strands and a barbed
  one, and a timber barrier across the south gap (4, 5, 6 m). Berm, bunker and fence heights are
  raised 1.3x like the other ages' rings. Outer sizes 45, 68 and 90 m (the brief's ranges); the
  berm's inner foot runs just inside each town's edge, so the corners of the square towns pass
  under it.
- Fields keep real heights: wheat 0.9 m, apple trees 2.5 m, tunnels 2.2 m. The orchard and
  pasture lie on lawn, the wheat and market garden on a new tilled-soil ground.
- New materials all carry the `md_` prefix; the four Ground triplets are `md_pave`,
  `md_asphalt`, `md_lawn` and `md_tilled`.
- No shared module was changed.

## Not matched
- Window counts and mullion patterns are a regular grid, not each sheet building's own pattern.
- The apples barely show red at map scale (the crown material mixes a little red into the green).
- The stadium's outer wall hides most of its stands from the low preview camera.
- Chain-link mesh reads as strands (an opaque mesh panel looked like a wall).
- The big towns' station runs on a diagonal; its glass roof grid follows the world axes.
