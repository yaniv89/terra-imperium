# East Africa kit, Gunpowder and Modern: towns from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (see plans/art-pilot/nile/LOG.md for the method)
from `plans/art/downloads/blender-west-eastafrica40/` (Gunpowder houses and street) and
`blender-eastafrica-steppe40/` (the rest). Bronze to Kingdoms are another session's work.

Outputs: `src/assets/map/towns/{gunpowder,modern}-town-<size>-<v>-eastafrica.glb` (12 files).
Every file passes `validate_model.py` (`*.validation.json` here). Previews: `*-preview.png`.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size | Valid |
|---|---|---|---|---|---|---|---|
| gunpowder-town-big-a-eastafrica.glb | 23 (14/7/2) | landmark-1 (0.89), landmark-2 (0.94) | 41397 / 7643 / 735 | 8.04 | 2.13 | 6.2 MB | pass |
| gunpowder-town-big-b-eastafrica.glb | 22 (14/5/3) | landmark-2 (0.94), landmark-1 (0.89) | 40758 / 7405 / 725 | 8.02 | 2.13 | 6.2 MB | pass |
| gunpowder-town-medium-a-eastafrica.glb | 12 (9/2/1) | landmark-1 (0.75), landmark-2 (0.79) | 24053 / 5008 / 625 | 5.99 | 1.79 | 3.8 MB | pass |
| gunpowder-town-medium-b-eastafrica.glb | 12 (9/2/1) | landmark-2 (0.79), landmark-1 (0.75) | 24133 / 5008 / 625 | 5.96 | 1.79 | 3.8 MB | pass |
| gunpowder-town-small-a-eastafrica.glb | 6 (5/1/0) | landmark-1 (0.47) | 13162 / 2771 / 455 | 4.03 | 1.12 | 2.3 MB | pass |
| gunpowder-town-small-b-eastafrica.glb | 6 (5/1/0) | landmark-2 (0.49) | 11850 / 2769 / 456 | 3.97 | 0.87 | 2.2 MB | pass |
| modern-town-big-a-eastafrica.glb | 23 (17/4/2) | landmark-1 (0.89), landmark-2 (0.94) | 35272 / 7600 / 736 | 7.96 | 3.15 | 5.4 MB | pass |
| modern-town-big-b-eastafrica.glb | 22 (16/4/2) | landmark-2 (0.94), landmark-1 (0.89) | 34164 / 7360 / 726 | 7.97 | 3.15 | 5.2 MB | pass |
| modern-town-medium-a-eastafrica.glb | 12 (9/2/1) | landmark-1 (0.61), landmark-2 (0.71) | 21745 / 4960 / 626 | 6.00 | 2.16 | 3.5 MB | pass |
| modern-town-medium-b-eastafrica.glb | 12 (11/1/0) | landmark-2 (0.79), landmark-1 (0.68) | 20602 / 4960 / 626 | 5.95 | 2.40 | 3.4 MB | pass |
| modern-town-small-a-eastafrica.glb | 6 (5/1/0) | landmark-1 (0.45) | 12011 / 2720 / 456 | 4.01 | 1.60 | 2.2 MB | pass |
| modern-town-small-b-eastafrica.glb | 6 (6/0/0) | landmark-2 (0.49) | 9071 / 2720 / 456 | 4.03 | 0.63 | 1.9 MB | pass |

Heights and footprints in units (1 unit = 10 m). Landmark scale 1.00 = as delivered. Validation ran
on the files as built; `npm run pack:models` then compressed them in place (meshopt, about 3 MB
down to 1 MB a town), so the sizes above are before packing.

## Time
About 5 minutes a town at 2048 (25 to 28 minutes an age, three ages in parallel), then 25 minutes
of validation and previews for the batch and under a minute to pack.

## What did not match, and why
- Counts sit at the low end of the ranges (small 6 to 7, medium 12 to 13, big 22 to 23): the kit
  houses are 8 to 13 m, larger than the base houses. Rich houses do not fit small towns.
- Landmarks are scaled down to fit: about half size in small towns (at most 10 m across, 16 m tall),
  16 m (medium) and 19 m (big) across; in a few medium towns the planner shrank them another 10 to
  20% so the town still has 12 houses.
- These kits are heavy (houses of 900 to 2,500 triangles), so LOD1 cuts each house to about 240
  triangles and each landmark to about 800 (big towns stay near 7,500 of their 10,000).
- The kit houses carry their own AO; the town bake adds its AO on top, so they read a little dark.
- The ground takes its colours from the kit's street swatch, which is pale in these kits.
