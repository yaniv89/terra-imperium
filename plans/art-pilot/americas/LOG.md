# Americas kit: towns and shared file from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (see plans/art-pilot/nile/LOG.md for how it works)
from `plans/art/downloads/blender-next40/` (on claude/bronze-towns), all five ages complete:

```
python scripts/blender/assemble_kit_towns.py <kit_dir>/ <age> americas <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared <kit_dir>/ americas <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-americas.glb` (30 files) and
`src/assets/map/shared/shared-kingdoms-americas.glb`. Every file passes `validate_model.py`
(`*.validation.json` here). Previews: `*-preview.png` (beauty and top view, 1600 px).

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-americas.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (0.95) | 8044 / 4662 / 724 | 8.00 | 1.05 | 1.7 MB | pass |
| bronze-town-big-b-americas.glb | 22 (14/7/1) | landmark-2 (0.95), landmark-1 (1.00) | 8008 / 4694 / 724 | 8.01 | 1.05 | 1.7 MB | pass |
| bronze-town-medium-a-americas.glb | 12 (9/2/1) | landmark-1 (1.00), landmark-2 (0.80) | 6416 / 3294 / 624 | 6.05 | 1.05 | 1.5 MB | pass |
| bronze-town-medium-b-americas.glb | 12 (9/3/0) | landmark-2 (0.80), landmark-1 (1.00) | 6396 / 3326 / 624 | 6.00 | 1.05 | 1.5 MB | pass |
| bronze-town-small-a-americas.glb | 6 (5/1/0) | landmark-1 (0.82) | 3760 / 1868 / 456 | 4.03 | 0.86 | 1.2 MB | pass |
| bronze-town-small-b-americas.glb | 6 (5/1/0) | landmark-2 (0.50) | 4196 / 1990 / 454 | 4.03 | 0.65 | 1.2 MB | pass |
| classical-town-big-a-americas.glb | 23 (14/7/2) | landmark-1 (0.86), landmark-2 (0.86) | 7432 / 4392 / 736 | 8.05 | 1.73 | 1.6 MB | pass |
| classical-town-big-b-americas.glb | 22 (16/5/1) | landmark-2 (0.86), landmark-1 (0.86) | 6892 / 4183 / 726 | 7.95 | 1.73 | 1.6 MB | pass |
| classical-town-medium-a-americas.glb | 12 (8/3/1) | landmark-1 (0.73), landmark-2 (0.73) | 5252 / 2687 / 626 | 5.94 | 1.46 | 1.3 MB | pass |
| classical-town-medium-b-americas.glb | 12 (10/1/1) | landmark-2 (0.73), landmark-1 (0.73) | 5252 / 2591 / 626 | 6.00 | 1.46 | 1.3 MB | pass |
| classical-town-small-a-americas.glb | 6 (5/1/0) | landmark-1 (0.45) | 3468 / 1578 / 456 | 4.03 | 0.96 | 1.1 MB | pass |
| classical-town-small-b-americas.glb | 7 (6/1/0) | landmark-2 (0.45) | 3644 / 1760 / 466 | 3.96 | 0.96 | 1.1 MB | pass |
| gunpowder-town-big-a-americas.glb | 22 (14/6/2) | landmark-1 (0.93), landmark-2 (1.00) | 8644 / 4610 / 725 | 8.06 | 2.19 | 1.8 MB | pass |
| gunpowder-town-big-b-americas.glb | 22 (15/4/3) | landmark-2 (1.00), landmark-1 (0.93) | 8456 / 4780 / 725 | 8.03 | 2.19 | 1.8 MB | pass |
| gunpowder-town-medium-a-americas.glb | 12 (9/2/1) | landmark-1 (0.78), landmark-2 (0.86) | 5672 / 3052 / 625 | 5.98 | 1.84 | 1.4 MB | pass |
| gunpowder-town-medium-b-americas.glb | 12 (9/2/1) | landmark-2 (0.86), landmark-1 (0.78) | 5832 / 3052 / 625 | 6.04 | 1.84 | 1.4 MB | pass |
| gunpowder-town-small-a-americas.glb | 6 (5/1/0) | landmark-1 (0.49) | 3652 / 1804 / 456 | 3.95 | 1.15 | 1.2 MB | pass |
| gunpowder-town-small-b-americas.glb | 6 (5/1/0) | landmark-2 (0.54) | 3624 / 1774 / 455 | 4.01 | 1.00 | 1.2 MB | pass |
| kingdoms-town-big-a-americas.glb | 22 (14/6/2) | landmark-1 (0.86), landmark-2 (1.00) | 7504 / 4002 / 726 | 8.00 | 1.81 | 1.5 MB | pass |
| kingdoms-town-big-b-americas.glb | 23 (14/5/4) | landmark-2 (1.00), landmark-1 (0.86) | 8048 / 4153 / 736 | 7.97 | 1.81 | 1.6 MB | pass |
| kingdoms-town-medium-a-americas.glb | 12 (9/2/1) | landmark-1 (0.73), landmark-2 (0.92) | 5444 / 2650 / 626 | 6.04 | 1.53 | 1.3 MB | pass |
| kingdoms-town-medium-b-americas.glb | 12 (9/2/1) | landmark-2 (0.92), landmark-1 (0.73) | 4964 / 2650 / 626 | 5.95 | 1.53 | 1.3 MB | pass |
| kingdoms-town-small-a-americas.glb | 6 (5/1/0) | landmark-1 (0.45) | 3424 / 1649 / 456 | 3.98 | 0.95 | 1.1 MB | pass |
| kingdoms-town-small-b-americas.glb | 7 (6/1/0) | landmark-2 (0.57) | 3544 / 1745 / 466 | 3.99 | 0.86 | 1.1 MB | pass |
| modern-town-big-a-americas.glb | 23 (14/7/2) | landmark-1 (0.86), landmark-2 (0.86) | 11096 / 5398 / 735 | 8.02 | 2.00 | 2.0 MB | pass |
| modern-town-big-b-americas.glb | 22 (16/4/2) | landmark-2 (0.86), landmark-1 (0.86) | 11088 / 5395 / 725 | 7.94 | 2.00 | 2.0 MB | pass |
| modern-town-medium-a-americas.glb | 12 (9/2/1) | landmark-1 (0.73), landmark-2 (0.73) | 7708 / 3880 / 625 | 5.98 | 1.68 | 1.7 MB | pass |
| modern-town-medium-b-americas.glb | 13 (9/3/1) | landmark-2 (0.73), landmark-1 (0.73) | 7956 / 3991 / 635 | 6.02 | 1.68 | 1.7 MB | pass |
| modern-town-small-a-americas.glb | 7 (6/1/0) | landmark-1 (0.45) | 4392 / 2309 / 466 | 4.02 | 1.05 | 1.3 MB | pass |
| modern-town-small-b-americas.glb | 7 (6/1/0) | landmark-2 (0.45) | 4592 / 2408 / 465 | 4.00 | 0.99 | 1.3 MB | pass |
| shared-kingdoms-americas.glb: palace-small | - | - | 144 / 144 / 144 | 0.81 | 0.80 | 0.9 MB | pass |
| shared-kingdoms-americas.glb: palace | - | - | 172 / 172 / 172 | 1.22 | 1.37 | 0.9 MB | pass |
| shared-kingdoms-americas.glb: walls-medium | - | - | 1152 / 1152 / 378 | 6.80 | 0.78 | 0.9 MB | pass |

Heights and footprints in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## Time
About 5 minutes a town at 2048; 20 to 30 minutes an age with three jobs in parallel, the shared
file under 4 minutes; about one hour for the region, plus 20 minutes of validation and previews.

## What did not match, and why
- Same limits as Nile: kit houses are larger than the base houses, so counts sit at the low end
  (small 6 to 7, medium 12 to 13, big 22 to 25) and rich houses do not fit small towns.
- Landmarks are scaled down to fit small towns (to 10 m across, at most 16 m tall) and capped at
  16 m (medium) and 19 m (big) across.
- walls-medium is delivered 6.54 across; it is scaled across to 6.8 (brief 6.4 to 6.9), height kept.
- The street swatch is used for the ground's colours as packed earth, not as a tiled surface.
