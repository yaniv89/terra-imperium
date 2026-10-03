# Model pilot: Bronze Age `town-small-a`, built in Blender from the 2D approval sheet

Date: 2026-10-03. Source: `plans/art/towns/bronze/town-small-a/approval.png` (GPT's concept:
front, side, back, top, beauty, scale, materials). Built by
`scripts/blender/build_town_bronze_small_a.py` with Blender 4.2's `bpy` module, no manual
modelling. One build takes about 2 minutes on four CPU cores, most of it the atlas bake.

## Result
- `src/assets/map/towns/bronze-town-small-a.glb`, 2.6 MB (budget 12 MB): one object
  `town-small-a` with `LOD0`, `LOD1`, `LOD2`.

| LOD | Triangles | Budget | What is in it |
|---|---|---|---|
| LOD0 | 11,520 | 60,000 | everything: beam ends, doors, windows, ladders, jars, woodpiles, shades, the well |
| LOD1 | 3,996 | 10,000 | walls, roofs, parapets, the stair, roof shades and vents, the flag, big doors |
| LOD2 | 1,094 | 1,500 | wall blocks, roof slabs, the tower's three stages, the ground patch |

- One atlas set, 2048 px, WebP (EXT_texture_webp): base colour with baked ambient occlusion
  and contact shadows, a tangent-space normal map, and a packed map (cavity R, roughness G,
  metalness B). Every LOD samples it.
- Materials: `Town`, `Ground` (alphaMode MASK, cutoff 0.5: the ragged edge of the earth patch
  is cut out of the atlas alpha, never blended), `Team` (the flag on the tower and the awning
  over the south house's door).
- `validate_model.py`: every check passes (`town-small-a.validation.json`, `manifest.json`).
  Footprint 3.98 units (40 m), height 2.08 (the 16 m tower raised 1.3x), nothing below ground.
- In the game: `src/components/map/closeView/townAssets.js` loads the file the first time a
  Bronze Age small town is on screen and replaces the procedural town; the LOD follows the
  zoom (LOD2 below k 20, LOD1 below 40, LOD0 from 40); Team takes the owner's colour.
  `ingame-k30.png` and `ingame-k80.png` are a Dawn game as Iraq at 844 x 390.

## Compared with the concept (`sheet_concept_vs_model.png`)
Same village: the ring of six flat-roofed lime-washed houses, the open centre, the stepped tower
at the north-east with its stair and team flag, the well at the south-west, reed shades on roofs
and over doors, ladders, jars. Where the model is weaker than the sheet:
- Materials are procedural (noise, a brick bond), so the walls read cleaner and more uniform
  than the painted sheet; the brick courses and the weathering of the concept need either
  hand-painted texture work or photo-sourced CC0 textures in the bake.
- Less clutter than the concept: the sheet has more crates, baskets, racks and roof jars.
- The tower stands taller relative to the houses than on the sheet, because the brief's 1.3x
  height rule applies to its 16 m and the houses are single storeys.
- The ground is paler than the sheet's warm ochre.
- The palace and walls are not part of this file: capitals show the town without its palace
  until `palace-small` and the wall rings are built.
- In the game the town reads a little darker than in Blender: the close view's lights were
  tuned for the old flat-colour towns and should be retuned for textured models.

## Deviations from the model brief
- LOD1 and LOD2 are rebuilt from the same layout with less detail (every part is tagged with
  the lowest LOD that keeps it) and take their UVs from LOD0 by projection, instead of
  Blender's decimate: decimating a 11,520-triangle town to 1,094 collapses roofs and walls,
  and the brief's own LOD2 description (roofs, the landmark, the ground) is what the tags give.
- The normal and packed maps are WebP like the base colour, not PNG: the exporter writes one
  format per file, and a 2048 PNG normal map alone would be about 6 MB.
- The file ships in `src/assets/map/towns/` (bundled by Vite) rather than through
  `src/assets/raw-models/map/` and an `import:map-models` step; that step can come with the
  kit pipeline.
- This is a whole-town model (art spec section 3), not the brief's layout x kit system (4.1).
- The .blend is not committed (10 MB); the script rebuilds it.

## Pipeline (scripts/blender/)
- `ti_map.py`: parts with an LOD tag, procedural materials (lime-washed mud brick, packed earth,
  thatch, timber, team cloth), the atlas bake, UV transfer for LODs, the GLB export.
- `build_town_bronze_small_a.py`: the town. `validate_model.py`: brief section 6 read straight
  from the GLB (no Blender needed). `render_map_previews.py`: the game camera at k 10, 40 and
  150 on grass and nation blue, front, top and three-quarter views, and the concept comparison.
- Setup: `python3.11 -m venv bpyenv && bpyenv/bin/pip install bpy==4.2.0`, then
  `bpyenv/bin/python scripts/blender/build_town_bronze_small_a.py <out_dir> 2048`.
