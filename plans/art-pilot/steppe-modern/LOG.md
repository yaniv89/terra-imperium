# Steppe Modern kit: towns from GPT's Blender deliveries

Built by `scripts/blender/assemble_kit_towns.py` (as the Nile run, plans/art-pilot/nile/LOG.md). Inputs,
unpacked into one tree, later zips winning: `plans/art/downloads/blender-eastafrica-steppe40/` (the
Steppe Modern houses, street and roofscape) and `plans/art/downloads/blender-remaining/checkpoint-01/`
(the Steppe Modern landmark-1, landmark-2 and materials).

```
python scripts/blender/assemble_kit_towns.py <kits>/steppe modern steppe <out_dir> 2048
```

Outputs: `src/assets/map/towns/modern-town-<size>-<v>-steppe.glb` (6 files), packed with
`npm run pack:models`. Every file passes `validate_model.py` (`*.validation.json` here, run on the
unpacked file; town footprint 4.0 / 6.0 / 8.0, height = the measured LOD0 top). Previews:
`*-preview.png` (beauty and top view, 1600 px). `npx vitest run scripts/art src/components/map`: 44
tests pass. No town needed the LOD1 retry.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| modern-town-big-a-steppe.glb | 22 (14/6/2) | landmark-1 (0.89), landmark-2 (0.89) | 38388 / 7360 / 726 | 7.96 | 4.20 | 1.7 MB | pass |
| modern-town-big-b-steppe.glb | 23 (15/6/2) | landmark-2 (0.89), landmark-1 (0.89) | 39754 / 7600 / 736 | 7.99 | 4.20 | 1.8 MB | pass |
| modern-town-medium-a-steppe.glb | 12 (9/2/1) | landmark-1 (0.51), landmark-2 (0.75) | 22971 / 4960 / 626 | 6.02 | 2.40 | 1.3 MB | pass |
| modern-town-medium-b-steppe.glb | 13 (9/3/1) | landmark-2 (0.75), landmark-1 (0.51) | 24522 / 5200 / 636 | 6.00 | 2.40 | 1.3 MB | pass |
| modern-town-small-a-steppe.glb | 7 (6/1/0) | landmark-1 (0.34) | 12249 / 2960 / 466 | 3.99 | 1.60 | 1.0 MB | pass |
| modern-town-small-b-steppe.glb | 6 (5/1/0) | landmark-2 (0.47) | 11551 / 2720 / 456 | 3.97 | 1.18 | 1.0 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What it reads as
Grey flat-roofed concrete blocks with rooftop boxes and courtyard blocks; a dark glass high-rise
(42 m in the big town, under the raised Modern big-town cap) and an open steel-frame tower, each on
its own dark plinth as delivered.

## What did not match, and why
- Landmarks are scaled down in small and medium towns (the small towns' tower reads small).
- House counts sit at the low end as in the other kits (small 6 to 7, medium 12, big 22 to 23).
- The ground uses the street swatch colours as packed earth.
