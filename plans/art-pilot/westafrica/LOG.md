# West Africa kit: towns from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (as the Nile run, plans/art-pilot/nile/LOG.md) from
`plans/art/downloads/blender-maghreb-westafrica40/` (West Africa Bronze and Classical complete):

```
python scripts/blender/assemble_kit_towns.py <kits>/westafrica <age> westafrica <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-westafrica.glb` (12 files: Bronze, Classical),
packed with `npm run pack:models`. West Africa Kingdoms is not built: its landmark-2 and materials
have not arrived (the delivery holds only the houses, street, roofscape and landmark-1), and there is
no West Africa Kingdoms palace or wall kit, so there is no shared file. Every file passes
`validate_model.py` (`*.validation.json` here, run on the unpacked file; town footprint 4.0 / 6.0 /
8.0, height = the measured LOD0 top). Previews: `*-preview.png` (beauty and top view from
`render_map_previews.py`, 1600 px). `npx vitest run scripts/art src/components/map`: 44 tests pass.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-westafrica.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (1.00) | 16304 / 6716 / 726 | 7.96 | 1.28 | 1.3 MB | pass |
| bronze-town-big-b-westafrica.glb | 23 (15/7/1) | landmark-2 (1.00), landmark-1 (1.00) | 16426 / 6879 / 736 | 7.95 | 1.28 | 1.3 MB | pass |
| bronze-town-medium-a-westafrica.glb | 12 (9/2/1) | landmark-1 (1.00), landmark-2 (1.00) | 11116 / 4613 / 626 | 5.99 | 1.28 | 1.2 MB | pass |
| bronze-town-medium-b-westafrica.glb | 12 (9/2/1) | landmark-2 (1.00), landmark-1 (1.00) | 11196 / 4613 / 626 | 6.04 | 1.28 | 1.2 MB | pass |
| bronze-town-small-a-westafrica.glb | 6 (5/1/0) | landmark-1 (0.62) | 6740 / 2744 / 456 | 4.01 | 0.94 | 1.1 MB | pass |
| bronze-town-small-b-westafrica.glb | 7 (6/1/0) | landmark-2 (0.67) | 6842 / 2564 / 466 | 4.00 | 0.94 | 1.1 MB | pass |
| classical-town-big-a-westafrica.glb | 23 (17/4/2) | landmark-1 (1.00), landmark-2 (1.00) | 11776 / 6554 / 736 | 8.00 | 1.15 | 1.0 MB | pass |
| classical-town-big-b-westafrica.glb | 22 (15/5/2) | landmark-2 (1.00), landmark-1 (1.00) | 11460 / 6462 / 726 | 7.98 | 1.15 | 1.0 MB | pass |
| classical-town-medium-a-westafrica.glb | 12 (9/2/1) | landmark-1 (0.97), landmark-2 (0.84) | 9140 / 4934 / 626 | 5.96 | 1.07 | 0.9 MB | pass |
| classical-town-medium-b-westafrica.glb | 12 (9/2/1) | landmark-2 (0.84), landmark-1 (0.97) | 9236 / 4934 / 626 | 6.03 | 1.07 | 0.9 MB | pass |
| classical-town-small-a-westafrica.glb | 6 (5/1/0) | landmark-1 (0.61) | 8276 / 3934 / 456 | 4.02 | 1.05 | 0.9 MB | pass |
| classical-town-small-b-westafrica.glb | 7 (7/0/0) | landmark-2 (0.53) | 3132 / 1640 / 466 | 4.04 | 0.64 | 0.8 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What each age reads as
- Bronze: round mud huts with conical thatch, walled compounds round the larger huts; a long
  thatched hall and a sacred grove with carved posts as the landmarks.
- Classical: rectangular red-earth houses under hipped thatch, courtyard compounds; a gated
  compound with red-tiled pavilions and a courtyard hall as the landmarks.

## What did not match, and why
- The house counts sit at the low end as in the Nile run (small 6 to 7, medium 12, big 22 to 23);
  rich houses do not fit small towns. classical-town-small-b has seven poor houses and no common one
  (the planner traded the common house for the count).
- The Bronze landmarks fit medium and big towns as delivered (scale 1.00); in small towns they are
  scaled to 0.62 and 0.67. The Classical landmarks drop to 0.53 to 0.61 in small towns.
- The ground uses the street swatch's colours as packed earth.
- The lead must not expect kingdoms-town-*-westafrica or shared-kingdoms-westafrica yet; the game
  falls back as it does for any style without a kit for that age.
