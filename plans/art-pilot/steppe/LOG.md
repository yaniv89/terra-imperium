# Steppe kit, Bronze to Gunpowder: towns and shared file from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (see plans/art-pilot/nile/LOG.md for the method)
from `plans/art/downloads/blender-eastafrica-steppe40/`. Modern is not built: its landmarks and
materials have not arrived.

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-steppe.glb` (24 files, Bronze to Gunpowder)
and `src/assets/map/shared/shared-kingdoms-steppe.glb` (palace-small, palace, walls-medium; the
walls scaled across from 6.54 to 6.8 units, gate to the south). Every file passes
`validate_model.py` (`*.validation.json` here). Previews: `*-preview.png`.

`townAssets.test.js` used Steppe (and Mongolia) as its example of land with no kit of its own; that
is no longer true, so those two checks now use the Levant (Bronze) and test the Mongolia rule and
its new Steppe towns directly.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-steppe.glb | 23 (17/4/2) | landmark-1 (0.97), landmark-2 (1.00) | 30644 / 6992 / 736 | 7.96 | 1.26 | 4.9 MB | pass |
| bronze-town-big-b-steppe.glb | 22 (13/9/0) | landmark-2 (1.00), landmark-1 (0.97) | 30690 / 6752 / 726 | 8.06 | 1.26 | 4.9 MB | pass |
| bronze-town-medium-a-steppe.glb | 12 (9/3/0) | landmark-1 (0.73), landmark-2 (0.79) | 17538 / 4352 / 626 | 5.97 | 0.99 | 3.1 MB | pass |
| bronze-town-medium-b-steppe.glb | 12 (9/2/1) | landmark-2 (0.79), landmark-1 (0.73) | 18107 / 4352 / 626 | 5.97 | 1.12 | 3.2 MB | pass |
| bronze-town-small-a-steppe.glb | 6 (5/1/0) | landmark-1 (0.51) | 8959 / 2399 / 456 | 4.00 | 0.82 | 2.0 MB | pass |
| bronze-town-small-b-steppe.glb | 6 (5/1/0) | landmark-2 (0.55) | 9219 / 2433 / 456 | 4.00 | 0.82 | 2.0 MB | pass |
| classical-town-big-a-steppe.glb | 22 (14/6/2) | landmark-1 (0.90), landmark-2 (1.00) | 39780 / 7403 / 725 | 7.95 | 1.48 | 6.1 MB | pass |
| classical-town-big-b-steppe.glb | 22 (15/4/3) | landmark-2 (1.00), landmark-1 (0.90) | 41115 / 7405 / 725 | 7.96 | 1.48 | 6.3 MB | pass |
| classical-town-medium-a-steppe.glb | 12 (9/2/1) | landmark-1 (0.76), landmark-2 (1.00) | 24155 / 5007 / 625 | 5.94 | 1.27 | 3.9 MB | pass |
| classical-town-medium-b-steppe.glb | 12 (9/3/0) | landmark-2 (1.00), landmark-1 (0.76) | 23395 / 5006 / 625 | 5.99 | 1.27 | 3.8 MB | pass |
| classical-town-small-a-steppe.glb | 6 (5/1/0) | landmark-1 (0.48) | 13075 / 2771 / 455 | 4.03 | 0.87 | 2.3 MB | pass |
| classical-town-small-b-steppe.glb | 7 (7/0/0) | landmark-2 (0.62) | 13180 / 3009 / 466 | 4.03 | 0.80 | 2.4 MB | pass |
| gunpowder-town-big-a-steppe.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (1.00) | 40217 / 7323 / 726 | 7.96 | 3.08 | 6.2 MB | pass |
| gunpowder-town-big-b-steppe.glb | 22 (11/9/2) | landmark-2 (1.00), landmark-1 (1.00) | 41292 / 7320 / 726 | 7.96 | 3.08 | 6.3 MB | pass |
| gunpowder-town-medium-a-steppe.glb | 12 (9/2/1) | landmark-1 (0.85), landmark-2 (0.78) | 24736 / 4927 / 626 | 6.01 | 2.40 | 4.0 MB | pass |
| gunpowder-town-medium-b-steppe.glb | 12 (9/2/1) | landmark-2 (0.78), landmark-1 (0.85) | 24896 / 4927 / 626 | 6.00 | 2.40 | 3.9 MB | pass |
| gunpowder-town-small-a-steppe.glb | 6 (5/1/0) | landmark-1 (0.53) | 11719 / 2688 / 456 | 3.98 | 0.87 | 2.2 MB | pass |
| gunpowder-town-small-b-steppe.glb | 7 (6/1/0) | landmark-2 (0.52) | 15214 / 3011 / 466 | 3.98 | 1.60 | 2.6 MB | pass |
| kingdoms-town-big-a-steppe.glb | 22 (14/6/2) | landmark-1 (0.85), landmark-2 (1.00) | 40363 / 7203 / 726 | 8.06 | 1.72 | 6.1 MB | pass |
| kingdoms-town-big-b-steppe.glb | 23 (15/6/2) | landmark-2 (1.00), landmark-1 (0.85) | 41809 / 7443 / 736 | 7.98 | 1.72 | 6.3 MB | pass |
| kingdoms-town-medium-a-steppe.glb | 12 (9/2/1) | landmark-1 (0.71), landmark-2 (0.94) | 24264 / 4807 / 626 | 6.05 | 1.45 | 3.9 MB | pass |
| kingdoms-town-medium-b-steppe.glb | 13 (10/2/1) | landmark-2 (0.94), landmark-1 (0.71) | 26206 / 5047 / 636 | 5.98 | 1.45 | 4.1 MB | pass |
| kingdoms-town-small-a-steppe.glb | 6 (5/1/0) | landmark-1 (0.45) | 13654 / 2771 / 456 | 4.02 | 0.91 | 2.4 MB | pass |
| kingdoms-town-small-b-steppe.glb | 6 (5/1/0) | landmark-2 (0.59) | 11783 / 2568 / 456 | 4.01 | 0.87 | 2.2 MB | pass |
| shared-kingdoms-steppe.glb: palace-small | - | - | 1163 / 1163 / 400 | 0.80 | 0.83 | 2.1 MB | pass |
| shared-kingdoms-steppe.glb: palace | - | - | 1551 / 1551 / 400 | 1.20 | 1.49 | 2.1 MB | pass |
| shared-kingdoms-steppe.glb: walls-medium | - | - | 3741 / 2183 / 379 | 6.80 | 0.77 | 2.1 MB | pass |

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
