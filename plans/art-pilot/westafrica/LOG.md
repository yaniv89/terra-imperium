# West Africa kit: towns and shared file from GPT's Blender deliveries

Built by `scripts/blender/assemble_kit_towns.py` (as the Nile run, plans/art-pilot/nile/LOG.md). Inputs,
all zips unpacked into one tree, later zips winning:
- `plans/art/downloads/blender-maghreb-westafrica40/`: Bronze and Classical complete; Kingdoms houses,
  street, roofscape and landmark-1.
- `plans/art/downloads/blender-west-eastafrica40/` (made under the new quality bar, 2048 atlases):
  Kingdoms landmark-2, materials, palace-small, palace and walls-medium; Gunpowder and Modern complete.

```
python scripts/blender/assemble_kit_towns.py <kits>/westafrica <age> westafrica <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared <kits>/westafrica westafrica <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-westafrica.glb` (30 files, all five ages) and
`src/assets/map/shared/shared-kingdoms-westafrica.glb`, packed with `npm run pack:models`. Every file
passes `validate_model.py` (`*.validation.json` here, run on the unpacked file; town footprint 4.0 /
6.0 / 8.0, height = the measured LOD0 top). Previews: `*-preview.png` (beauty and top view from
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
| gunpowder-town-big-a-westafrica.glb | 23 (17/4/2) | landmark-1 (1.00), landmark-2 (1.00) | 36541 / 9417 / 736 | 8.03 | 1.40 | 1.6 MB | pass |
| gunpowder-town-big-b-westafrica.glb | 23 (19/2/2) | landmark-2 (1.00), landmark-1 (1.00) | 36453 / 9417 / 736 | 7.95 | 1.40 | 1.6 MB | pass |
| gunpowder-town-medium-a-westafrica.glb | 11 (9/2/0) | landmark-1 (0.88), landmark-2 (0.95) | 20049 / 8891 / 616 | 6.05 | 1.23 | 1.2 MB | pass |
| gunpowder-town-medium-b-westafrica.glb | 11 (8/3/0) | landmark-2 (0.95), landmark-1 (0.88) | 20325 / 8972 / 616 | 6.02 | 1.23 | 1.2 MB | pass |
| gunpowder-town-small-a-westafrica.glb | 5 (4/1/0) | landmark-1 (0.55) | 10082 / 4515 / 446 | 4.00 | 0.93 | 0.9 MB | pass |
| gunpowder-town-small-b-westafrica.glb | 6 (5/1/0) | landmark-2 (0.59) | 11863 / 4908 / 456 | 3.98 | 0.93 | 0.9 MB | pass |
| kingdoms-town-big-a-westafrica.glb | 23 (17/4/2) | landmark-1 (1.00), landmark-2 (1.00) | 14784 / 5960 / 736 | 7.96 | 1.27 | 1.0 MB | pass |
| kingdoms-town-big-b-westafrica.glb | 22 (13/8/1) | landmark-2 (1.00), landmark-1 (1.00) | 14116 / 5823 / 726 | 7.99 | 1.27 | 1.0 MB | pass |
| kingdoms-town-medium-a-westafrica.glb | 13 (11/2/0) | landmark-1 (0.97), landmark-2 (0.85) | 10120 / 4196 / 636 | 5.96 | 1.07 | 0.9 MB | pass |
| kingdoms-town-medium-b-westafrica.glb | 12 (9/2/1) | landmark-2 (0.85), landmark-1 (0.97) | 9516 / 4097 / 626 | 5.96 | 1.07 | 0.9 MB | pass |
| kingdoms-town-small-a-westafrica.glb | 6 (5/1/0) | landmark-1 (0.61) | 5624 / 2117 / 456 | 3.98 | 1.05 | 0.8 MB | pass |
| kingdoms-town-small-b-westafrica.glb | 6 (5/1/0) | landmark-2 (0.53) | 6484 / 2451 / 456 | 4.03 | 1.05 | 0.9 MB | pass |
| modern-town-big-a-westafrica.glb | 23 (17/4/2) | landmark-1 (0.89), landmark-2 (1.00) | 36658 / 9413 / 736 | 7.94 | 4.70 | 1.7 MB | pass |
| modern-town-big-b-westafrica.glb | 22 (17/3/2) | landmark-2 (1.00), landmark-1 (0.89) | 35346 / 9413 / 726 | 8.01 | 4.70 | 1.6 MB | pass |
| modern-town-medium-a-westafrica.glb | 12 (8/4/0) | landmark-1 (0.75), landmark-2 (0.51) | 22504 / 9263 / 626 | 5.98 | 2.40 | 1.3 MB | pass |
| modern-town-medium-b-westafrica.glb | 12 (10/1/1) | landmark-2 (0.51), landmark-1 (0.75) | 22855 / 9273 / 626 | 6.01 | 2.40 | 1.3 MB | pass |
| modern-town-small-a-westafrica.glb | 6 (5/1/0) | landmark-1 (0.47) | 10238 / 5013 / 456 | 4.04 | 0.91 | 0.9 MB | pass |
| modern-town-small-b-westafrica.glb | 6 (5/1/0) | landmark-2 (0.34) | 12354 / 6071 / 456 | 4.01 | 1.60 | 1.0 MB | pass |
| shared-kingdoms-westafrica.glb: palace-small | - | - | 1008 / 1008 / 400 | 0.81 | 0.83 | 0.8 MB | pass |
| shared-kingdoms-westafrica.glb: palace | - | - | 1210 / 1210 / 400 | 1.21 | 1.41 | 0.8 MB | pass |
| shared-kingdoms-westafrica.glb: walls-medium | - | - | 3741 / 2183 / 379 | 6.80 | 0.77 | 0.8 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What each age reads as
- Bronze: round mud huts with conical thatch, walled compounds round the larger huts; a long
  thatched hall and a sacred grove with carved posts as the landmarks.
- Classical: rectangular red-earth houses under hipped thatch, courtyard compounds; a gated
  compound with red-tiled pavilions and a courtyard hall as the landmarks.
- Kingdoms: red-earth houses under thatch, courtyard compounds; a dark-timber palace compound
  with a gatehouse and a second thatched courtyard compound as the landmarks.
- Gunpowder: timber-roofed houses with verandas; a crenellated courtyard fort.
- Modern: tin-roofed houses; a domed mosque and twin high-rise blocks (47 m in the big town, under
  the raised Modern big-town cap).
- Shared: palace-small and palace are two-storey brick houses under a hipped roof (the palace with
  a team pennant); walls-medium is a crenellated red-earth ring with the gate at the south.

## LOD1 on the dense kits (tool change)
The new-quality Gunpowder and Modern kits are about twice as dense as the earlier ones. The tool's
fixed LOD1 ratio (houses 45%, landmarks 50%) left the big Gunpowder towns and the medium and big
Modern towns at 10,780 to 17,146 LOD1 triangles, over the 10,000 budget. `assemble_kit_towns.py` now
checks a town's LOD1 after the build and, when it is over 97% of the budget, rebuilds that town with
the LOD1 ratio scaled to land at about 92% (up to two retries). Rebuilt here: gunpowder big a/b
(x0.57, x0.58), modern medium a/b (x0.85, x0.84), modern big a/b (x0.54, x0.56); one retry each.
Towns already in budget build exactly as before.

## What did not match, and why
- The palaces read as large two-storey houses rather than palaces: that is the delivered model
  (14 m tall, kept as delivered; validation height 1.41).
- The house counts sit at the low end as in the Nile run (small 6 to 7, medium 12, big 22 to 23);
  rich houses do not fit small towns. classical-town-small-b has seven poor houses and no common one.
- Landmarks are scaled down in small towns (scale about 0.5 to 0.7).
- The ground uses each age's street swatch colours as packed earth.
- LOD0 of the big Gunpowder and Modern towns is about 36,500 triangles (budget 60,000).
