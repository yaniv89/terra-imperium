# Nile kit: towns and shared file from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` from `plans/art/downloads/blender-next30/` (bronze to
gunpowder, kingdoms palaces and walls) and `blender-next40/` (the Modern landmarks):

```
python scripts/blender/assemble_kit_towns.py <kit_dir>/ <age> nile <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared <kit_dir>/ nile <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-nile.glb` (30 files, all five ages) and
`src/assets/map/shared/shared-kingdoms-nile.glb`. Every file passes `validate_model.py`
(`*.validation.json` here; town footprint 4.0 / 6.0 / 8.0, height = the measured LOD0 top).
Previews: `*-preview.png` (beauty and top view from `render_map_previews.py`, 1600 px).

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-nile.glb | 22 (12/7/3) | landmark-1 (0.95), landmark-2 (1.00) | 10004 / 3779 / 724 | 7.97 | 1.43 | 1.8 MB | pass |
| bronze-town-big-b-nile.glb | 22 (14/5/3) | landmark-2 (1.00), landmark-1 (0.95) | 9460 / 3715 / 724 | 8.02 | 1.43 | 1.7 MB | pass |
| bronze-town-medium-a-nile.glb | 12 (9/2/1) | landmark-1 (0.80), landmark-2 (0.89) | 5836 / 2331 / 624 | 6.04 | 1.20 | 1.4 MB | pass |
| bronze-town-medium-b-nile.glb | 12 (10/2/0) | landmark-2 (0.89), landmark-1 (0.80) | 6024 / 2272 / 624 | 5.97 | 1.20 | 1.4 MB | pass |
| bronze-town-small-a-nile.glb | 6 (5/1/0) | landmark-1 (0.50) | 4092 / 1430 / 456 | 4.00 | 0.93 | 1.1 MB | pass |
| bronze-town-small-b-nile.glb | 6 (5/1/0) | landmark-2 (0.56) | 3780 / 1374 / 454 | 3.97 | 0.93 | 1.1 MB | pass |
| classical-town-big-a-nile.glb | 22 (14/6/2) | landmark-1 (0.95), landmark-2 (1.00) | 11724 / 4758 / 725 | 8.08 | 2.30 | 2.0 MB | pass |
| classical-town-big-b-nile.glb | 22 (15/5/2) | landmark-2 (1.00), landmark-1 (0.95) | 12180 / 4726 / 725 | 8.04 | 2.30 | 2.0 MB | pass |
| classical-town-medium-a-nile.glb | 12 (10/2/0) | landmark-1 (0.80), landmark-2 (1.00) | 7916 / 3026 / 625 | 6.01 | 2.30 | 1.6 MB | pass |
| classical-town-medium-b-nile.glb | 12 (10/1/1) | landmark-2 (1.00), landmark-1 (0.80) | 8312 / 3211 / 625 | 5.96 | 2.30 | 1.7 MB | pass |
| classical-town-small-a-nile.glb | 6 (5/1/0) | landmark-1 (0.50) | 4816 / 2054 / 456 | 4.01 | 0.93 | 1.3 MB | pass |
| classical-town-small-b-nile.glb | 6 (5/1/0) | landmark-2 (0.70) | 4028 / 1452 / 455 | 3.98 | 1.60 | 1.1 MB | pass |
| gunpowder-town-big-a-nile.glb | 22 (17/4/1) | landmark-1 (0.90), landmark-2 (1.00) | 15976 / 6595 / 726 | 8.00 | 1.32 | 2.5 MB | pass |
| gunpowder-town-big-b-nile.glb | 23 (18/5/0) | landmark-2 (1.00), landmark-1 (0.90) | 16532 / 6773 / 736 | 8.00 | 1.32 | 2.5 MB | pass |
| gunpowder-town-medium-a-nile.glb | 12 (10/2/0) | landmark-1 (0.76), landmark-2 (0.91) | 10932 / 4422 / 626 | 5.95 | 1.11 | 1.9 MB | pass |
| gunpowder-town-medium-b-nile.glb | 12 (10/1/1) | landmark-2 (0.91), landmark-1 (0.76) | 10992 / 4449 / 626 | 5.95 | 1.11 | 1.9 MB | pass |
| gunpowder-town-small-a-nile.glb | 6 (5/1/0) | landmark-1 (0.48) | 5616 / 2138 / 456 | 4.00 | 0.86 | 1.3 MB | pass |
| gunpowder-town-small-b-nile.glb | 6 (5/1/0) | landmark-2 (0.57) | 6764 / 2712 / 456 | 4.00 | 0.86 | 1.5 MB | pass |
| kingdoms-town-big-a-nile.glb | 22 (17/4/1) | landmark-1 (1.00), landmark-2 (1.00) | 13930 / 5652 / 726 | 7.94 | 2.22 | 2.3 MB | pass |
| kingdoms-town-big-b-nile.glb | 22 (16/6/0) | landmark-2 (1.00), landmark-1 (1.00) | 13878 / 5657 / 726 | 7.96 | 2.22 | 2.3 MB | pass |
| kingdoms-town-medium-a-nile.glb | 12 (10/2/0) | landmark-1 (0.91), landmark-2 (1.00) | 9126 / 3479 / 626 | 6.00 | 2.03 | 1.7 MB | pass |
| kingdoms-town-medium-b-nile.glb | 12 (9/3/0) | landmark-2 (1.00), landmark-1 (0.91) | 8494 / 3511 / 626 | 6.02 | 2.03 | 1.7 MB | pass |
| kingdoms-town-small-a-nile.glb | 6 (5/1/0) | landmark-1 (0.57) | 5314 / 2059 / 456 | 4.03 | 1.27 | 1.3 MB | pass |
| kingdoms-town-small-b-nile.glb | 6 (5/1/0) | landmark-2 (0.70) | 4908 / 1848 / 456 | 4.01 | 0.86 | 1.2 MB | pass |
| modern-town-big-a-nile.glb | 22 (14/6/2) | landmark-1 (0.77), landmark-2 (0.86) | 19540 / 9408 / 726 | 8.00 | 3.60 | 3.1 MB | pass |
| modern-town-big-b-nile.glb | 22 (15/4/3) | landmark-2 (0.86), landmark-1 (0.77) | 19528 / 9402 / 726 | 8.00 | 3.60 | 3.1 MB | pass |
| modern-town-medium-a-nile.glb | 12 (9/2/1) | landmark-1 (0.52), landmark-2 (0.73) | 14040 / 6936 / 626 | 5.96 | 2.40 | 2.5 MB | pass |
| modern-town-medium-b-nile.glb | 12 (9/2/1) | landmark-2 (0.73), landmark-1 (0.52) | 14040 / 6936 / 626 | 5.97 | 2.40 | 2.5 MB | pass |
| modern-town-small-a-nile.glb | 6 (5/1/0) | landmark-1 (0.34) | 10404 / 5283 / 456 | 3.98 | 1.60 | 2.1 MB | pass |
| modern-town-small-b-nile.glb | 6 (5/1/0) | landmark-2 (0.45) | 3984 / 2073 / 456 | 3.99 | 1.03 | 1.2 MB | pass |
| shared-kingdoms-nile.glb: palace-small | - | - | 892 / 892 / 400 | 0.80 | 0.80 | 1.4 MB | pass |
| shared-kingdoms-nile.glb: palace | - | - | 932 / 932 / 400 | 1.20 | 1.30 | 1.4 MB | pass |
| shared-kingdoms-nile.glb: walls-medium | - | - | 2100 / 2100 / 378 | 6.80 | 0.78 | 1.4 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## How the tool works
- Imports the kit GLBs, keeps each object's own UVs as a second layer and gives it a build material
  that samples the kit's atlas, so `ti_town.build_file` bakes kit textures, the ground and the props
  into one 2048 atlas per file (two wrappers in the tool, `ti_map` / `ti_town` untouched).
- LOD1: each kit object decimated to about 45% (houses) or 50% (landmarks). LOD2: houses become plain
  blocks, landmarks are decimated to about 110 triangles; the atlas reaches them by UV transfer.
- Layout (seeded per style, age, size and variant): the outer ring of poor houses pushed to the
  edge, an inner ring of common and rich houses by the square, all facing the centre, 30 cm apart
  at least, nothing within the 12 m free centre, every corner inside 90% of the ground radius (92%
  in small towns). The gap is widened by bisection so the ring spreads evenly. Landmarks at the
  north, by the square in medium and big towns, pushed outward in small towns with a clear
  forecourt. Variant b shuffles the house order and swaps and moves the landmarks.
- Ground: `ground_patch` with an earth material in four tones sampled from the kit's street swatch
  (`materials/street-surface.png`), alpha-cut edge. A well and a few jar heaps (not in Modern).
- Shared file: palace-small and palace as delivered; walls-medium joins the delivered ring, gate
  (south, -Y) and tower, scaled across to 6.8 units (delivered 7.11, brief 6.4 to 6.9), height kept.

## Time
One kit (six towns) at 2048: about 5 minutes a town, 25 to 30 minutes for the age with three
jobs in parallel; the shared file 3.5 minutes. All five ages plus the shared file: about one
hour of wall time, then 15 minutes of validation and previews.

## What did not match, and why
- The kit houses are about 1.4 times the base houses' area, so the counts sit at the low end:
  small 6, medium 12, big 22 to 23. Rich houses do not fit a 40 m town at all; in medium towns a
  rich house fits only when it does not cost the count (the planner tries that layout first).
- Landmarks are scaled down to fit: small towns to 10 to 12 m across and at most 16 m tall
  (scale 0.34 to 0.70; the Modern small landmark reads small), medium 16 m, big 19 m across.
- The street swatch is a khaki paving grid; the ground uses its colours as packed earth, not tiles.
- Houses carry the kit's own AO; the town bake adds its AO on top (slightly darker contact shadows).
