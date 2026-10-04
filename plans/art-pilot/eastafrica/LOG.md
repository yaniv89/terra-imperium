# East Africa kit: towns and shared file from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (as the Nile run, plans/art-pilot/nile/LOG.md) from
`plans/art/downloads/blender-west-eastafrica40/` (made under the new quality bar, 2048 atlases):
Bronze, Classical and Kingdoms complete, with the Kingdoms palace-small, palace and walls-medium.

```
python scripts/blender/assemble_kit_towns.py <kits>/eastafrica <age> eastafrica <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared <kits>/eastafrica eastafrica <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-eastafrica.glb` (18 files: Bronze, Classical,
Kingdoms) and `src/assets/map/shared/shared-kingdoms-eastafrica.glb`, packed with `npm run pack:models`.
East Africa Gunpowder is not built (only its houses and street have arrived), and there is no Modern
kit yet. Every file passes `validate_model.py` (`*.validation.json` here, run on the unpacked file;
town footprint 4.0 / 6.0 / 8.0, height = the measured LOD0 top). Previews: `*-preview.png` (beauty
and top view from `render_map_previews.py`, 1600 px). `npx vitest run scripts/art src/components/map`:
44 tests pass.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-eastafrica.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (1.00) | 25766 / 9289 / 726 | 7.98 | 1.11 | 1.5 MB | pass |
| bronze-town-big-b-eastafrica.glb | 22 (12/9/1) | landmark-2 (1.00), landmark-1 (1.00) | 25700 / 9289 / 726 | 7.99 | 1.11 | 1.5 MB | pass |
| bronze-town-medium-a-eastafrica.glb | 12 (9/2/1) | landmark-1 (1.00), landmark-2 (1.00) | 15345 / 6432 / 626 | 5.97 | 1.11 | 1.2 MB | pass |
| bronze-town-medium-b-eastafrica.glb | 12 (9/2/1) | landmark-2 (1.00), landmark-1 (1.00) | 15425 / 6432 / 626 | 5.98 | 1.11 | 1.2 MB | pass |
| bronze-town-small-a-eastafrica.glb | 7 (6/1/0) | landmark-1 (0.70) | 9480 / 3836 / 466 | 3.99 | 0.90 | 1.0 MB | pass |
| bronze-town-small-b-eastafrica.glb | 7 (6/1/0) | landmark-2 (0.62) | 8748 / 3686 / 466 | 4.03 | 0.90 | 1.0 MB | pass |
| classical-town-big-a-eastafrica.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (1.00) | 39986 / 9442 / 726 | 8.01 | 2.28 | 1.8 MB | pass |
| classical-town-big-b-eastafrica.glb | 22 (14/5/3) | landmark-2 (1.00), landmark-1 (1.00) | 40390 / 9450 / 726 | 7.93 | 2.28 | 1.8 MB | pass |
| classical-town-medium-a-eastafrica.glb | 13 (10/2/1) | landmark-1 (0.93), landmark-2 (1.00) | 25435 / 9281 / 636 | 6.05 | 2.28 | 1.4 MB | pass |
| classical-town-medium-b-eastafrica.glb | 12 (10/1/1) | landmark-2 (1.00), landmark-1 (0.93) | 24012 / 9251 / 626 | 6.05 | 2.28 | 1.4 MB | pass |
| classical-town-small-a-eastafrica.glb | 6 (5/1/0) | landmark-1 (0.58) | 12525 / 5375 / 456 | 4.03 | 0.87 | 1.0 MB | pass |
| classical-town-small-b-eastafrica.glb | 6 (6/0/0) | landmark-2 (0.70) | 12498 / 5097 / 456 | 4.00 | 1.60 | 1.0 MB | pass |
| kingdoms-town-big-a-eastafrica.glb | 22 (14/6/2) | landmark-1 (0.93), landmark-2 (1.00) | 39643 / 9440 / 726 | 8.06 | 1.49 | 1.8 MB | pass |
| kingdoms-town-big-b-eastafrica.glb | 22 (15/5/2) | landmark-2 (1.00), landmark-1 (0.93) | 39066 / 9435 / 726 | 7.96 | 1.49 | 1.8 MB | pass |
| kingdoms-town-medium-a-eastafrica.glb | 12 (10/2/0) | landmark-1 (0.78), landmark-2 (0.98) | 22913 / 9937 / 626 | 6.05 | 1.25 | 1.4 MB | pass |
| kingdoms-town-medium-b-eastafrica.glb | 12 (7/5/0) | landmark-2 (0.98), landmark-1 (0.78) | 23108 / 9243 / 626 | 5.96 | 1.25 | 1.3 MB | pass |
| kingdoms-town-small-a-eastafrica.glb | 6 (5/1/0) | landmark-1 (0.49) | 12402 / 5313 / 456 | 3.99 | 0.87 | 1.1 MB | pass |
| kingdoms-town-small-b-eastafrica.glb | 6 (6/0/0) | landmark-2 (0.62) | 12342 / 5091 / 456 | 3.97 | 0.71 | 1.0 MB | pass |
| shared-kingdoms-eastafrica.glb: palace-small | - | - | 1248 / 1248 / 400 | 0.80 | 0.83 | 0.9 MB | pass |
| shared-kingdoms-eastafrica.glb: palace | - | - | 1488 / 1488 / 400 | 1.20 | 1.41 | 0.9 MB | pass |
| shared-kingdoms-eastafrica.glb: walls-medium | - | - | 3741 / 2183 / 379 | 6.80 | 0.77 | 0.9 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What each age reads as
- Bronze: beehive grass huts, walled compounds round the larger huts; a circle of standing stone
  posts and a long dark hall as the landmarks.
- Classical: flat-roofed dark stone houses and courtyard houses; a tall tapering stone tower with a
  crenellated top and a large flat-roofed hall with a stele.
- Kingdoms: the same stone houses; a Great-Zimbabwe-style enclosure round a conical tower and a
  tall flat-roofed coral-stone hall.
- Shared: palace-small and palace are two-storey flat-roofed stone houses with a parapet and a roof
  kiosk (the palace with a team pennant); walls-medium is a crenellated stone ring, gate at the south.

## LOD1 (tool change, see plans/art-pilot/westafrica/LOG.md)
These kits are dense: the fixed LOD1 ratio left nine towns at 10,132 to 17,612 LOD1 triangles. The
tool now rebuilds such a town with a lower LOD1 ratio; one retry each: bronze big a/b (x0.84),
classical medium a/b (x0.83, x0.89), classical big a/b (x0.53, x0.52), kingdoms medium-b (x0.91),
kingdoms big a/b (x0.54). LOD0 of the big Classical and Kingdoms towns is about 40,000 (budget 60,000).

## What did not match, and why
- The palaces are delivered 14 m tall (kept; validation height 1.41) and read as large town houses.
- The houses' stone reads dark grey-green at map scale (the delivered atlas colour).
- House counts sit at the low end (small 6 to 7, medium 12 to 13, big 22); rich houses do not fit
  small towns, and classical-town-small-b and kingdoms-town-small-b have no common house.
- Landmarks are scaled down in small towns (0.49 to 0.70).

## Test change
`src/components/map/closeView/townAssets.test.js` used East Africa as its example of a land with no
Classical kit (expecting the base Roman town). East Africa now has one, so that line now checks land
with no style gets the base town, and East Africa gets its own kit.
