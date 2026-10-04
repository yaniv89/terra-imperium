# Maghreb Bronze towns, from a Blender-delivered kit

Date: 2026-10-04. Source: GPT's Blender delivery `plans/art/downloads/blender-monsoon-maghreb40/`
(on `claude/bronze-towns`): `maghreb/bronze/houses` (round thatched houses, a flat-roofed rich
house), `landmark-1` the granary citadel, `landmark-2` the standing-stone shrine, `materials`.
Built with `scripts/blender/assemble_kit_towns.py <kits>/maghreb bronze maghreb <out> 2048`.
Files: `src/assets/map/towns/bronze-town-<size>-<v>-maghreb.glb` (6). All pass
`validate_model.py` (`*.validation.json` here; town heights validated against the measured
height, within the 16 / 24 / 36 m caps).

| File | Object | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|---|
| bronze-town-big-a-maghreb | town-big-a | 10,212 / 3,822 / 726 | 80.1 m | 14.4 m | 1.9 MB | passed |
| bronze-town-big-b-maghreb | town-big-b | 9,860 / 3,865 / 726 | 80.2 m | 14.4 m | 1.9 MB | passed |
| bronze-town-medium-a-maghreb | town-medium-a | 6,640 / 2,439 / 626 | 59.8 m | 13.4 m | 1.6 MB | passed |
| bronze-town-medium-b-maghreb | town-medium-b | 6,544 / 2,396 / 626 | 59.8 m | 13.4 m | 1.6 MB | passed |
| bronze-town-small-a-maghreb | town-small-a | 3,936 / 1,486 / 456 | 39.6 m | 8.4 m | 1.4 MB | passed |
| bronze-town-small-b-maghreb | town-small-b | 4,104 / 1,442 / 456 | 40.2 m | 7.3 m | 1.3 MB | passed |

## Layouts (houses; landmark scale)
- bronze-town-small-a-maghreb: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.58
- bronze-town-small-b-maghreb: 6 houses (poor: 6, common: 0, rich: 0); L2 x0.69
- bronze-town-medium-a-maghreb: 12 houses (poor: 9, common: 2, rich: 1); L1 x0.93 L2 x1.0
- bronze-town-medium-b-maghreb: 12 houses (poor: 8, common: 4, rich: 0); L2 x1.0 L1 x0.93
- bronze-town-big-a-maghreb: 22 houses (poor: 14, common: 6, rich: 2); L1 x1.0 L2 x1.0
- bronze-town-big-b-maghreb: 22 houses (poor: 14, common: 5, rich: 3); L2 x1.0 L1 x1.0

## Decisions and what differs from the delivery
- The granary citadel (17.2 x 12.2 m, 14.4 m high) is scaled to x0.58 in small-a and x0.93 in
  medium towns to fit the size caps; the standing-stone shrine (14.4 m across, 4.6 m high) to
  x0.69 in small-b. Both stand at full size in big towns.
- Maghreb Classical (houses, street, roofscape only) has no landmarks yet: skipped as asked.
- Ground: the tool's earth patch in the colours of the kit's street swatch.

Preview: `bronze-medium-a-maghreb-concept-vs-model.png` (the two landmark previews beside the
built town).

---

# Maghreb kit: towns and shared file from GPT's Blender delivery

Built by `scripts/blender/assemble_kit_towns.py` (as the Nile run, plans/art-pilot/nile/LOG.md) from
`plans/art/downloads/blender-monsoon-maghreb40/` (Classical houses, street, roofscape) and
`blender-maghreb-westafrica40/` (Classical landmarks and materials; Kingdoms, Gunpowder and Modern
complete; the Kingdoms palaces and walls), all zips unpacked into one tree, later zips winning:

```
python scripts/blender/assemble_kit_towns.py <kits>/maghreb <age> maghreb <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared <kits>/maghreb maghreb <out_dir> 2048
```

Outputs: `src/assets/map/towns/<age>-town-<size>-<v>-maghreb.glb` (24 files: Classical, Kingdoms,
Gunpowder, Modern) and `src/assets/map/shared/shared-kingdoms-maghreb.glb`, packed with
`npm run pack:models`. Maghreb Bronze is built by another session and is not here. Every file passes
`validate_model.py` (`*.validation.json` here, run on the unpacked file; town footprint 4.0 / 6.0 /
8.0, height = the measured LOD0 top). Previews: `*-preview.png` (beauty and top view from
`render_map_previews.py`, 1600 px). `npx vitest run scripts/art src/components/map`: 44 tests pass.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| classical-town-big-a-maghreb.glb | 22 (14/6/2) | landmark-1 (0.81), landmark-2 (0.86) | 13824 / 7376 / 726 | 7.99 | 1.35 | 1.2 MB | pass |
| classical-town-big-b-maghreb.glb | 22 (16/4/2) | landmark-2 (0.86), landmark-1 (0.81) | 13440 / 7280 / 726 | 7.98 | 1.35 | 1.2 MB | pass |
| classical-town-medium-a-maghreb.glb | 12 (9/2/1) | landmark-1 (0.68), landmark-2 (0.73) | 11232 / 5716 / 626 | 6.02 | 1.14 | 1.1 MB | pass |
| classical-town-medium-b-maghreb.glb | 12 (10/1/1) | landmark-2 (0.73), landmark-1 (0.68) | 11552 / 5668 / 626 | 5.99 | 1.14 | 1.1 MB | pass |
| classical-town-small-a-maghreb.glb | 6 (5/1/0) | landmark-1 (0.42) | 9576 / 4452 / 456 | 3.98 | 0.86 | 1.0 MB | pass |
| classical-town-small-b-maghreb.glb | 6 (5/1/0) | landmark-2 (0.45) | 3568 / 1768 / 456 | 4.03 | 0.86 | 0.8 MB | pass |
| gunpowder-town-big-a-maghreb.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (0.90) | 11848 / 6168 / 726 | 8.04 | 2.39 | 1.1 MB | pass |
| gunpowder-town-big-b-maghreb.glb | 22 (15/5/2) | landmark-2 (0.90), landmark-1 (1.00) | 12024 / 6252 / 726 | 7.94 | 2.39 | 1.0 MB | pass |
| gunpowder-town-medium-a-maghreb.glb | 12 (9/2/1) | landmark-1 (0.86), landmark-2 (0.76) | 8696 / 4438 / 626 | 6.04 | 2.02 | 1.0 MB | pass |
| gunpowder-town-medium-b-maghreb.glb | 12 (9/2/1) | landmark-2 (0.76), landmark-1 (0.86) | 8792 / 4438 / 626 | 5.99 | 2.02 | 1.0 MB | pass |
| gunpowder-town-small-a-maghreb.glb | 6 (5/1/0) | landmark-1 (0.54) | 4356 / 2070 / 456 | 4.01 | 0.87 | 0.8 MB | pass |
| gunpowder-town-small-b-maghreb.glb | 6 (5/1/0) | landmark-2 (0.48) | 5660 / 2754 / 456 | 3.97 | 1.26 | 0.9 MB | pass |
| kingdoms-town-big-a-maghreb.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (0.90) | 12632 / 6556 / 726 | 8.02 | 2.75 | 1.1 MB | pass |
| kingdoms-town-big-b-maghreb.glb | 22 (13/7/2) | landmark-2 (0.90), landmark-1 (1.00) | 12680 / 6472 / 726 | 7.98 | 2.75 | 1.1 MB | pass |
| kingdoms-town-medium-a-maghreb.glb | 12 (9/2/1) | landmark-1 (0.97), landmark-2 (0.76) | 9228 / 4842 / 626 | 5.96 | 2.40 | 1.0 MB | pass |
| kingdoms-town-medium-b-maghreb.glb | 12 (9/2/1) | landmark-2 (0.76), landmark-1 (0.97) | 9628 / 4842 / 626 | 5.96 | 2.40 | 1.0 MB | pass |
| kingdoms-town-small-a-maghreb.glb | 6 (5/1/0) | landmark-1 (0.62) | 5072 / 2460 / 456 | 3.96 | 1.52 | 0.8 MB | pass |
| kingdoms-town-small-b-maghreb.glb | 6 (5/1/0) | landmark-2 (0.48) | 5688 / 2784 / 456 | 3.97 | 1.45 | 0.9 MB | pass |
| modern-town-big-a-maghreb.glb | 22 (14/6/2) | landmark-1 (0.75), landmark-2 (0.98) | 7252 / 5066 / 726 | 8.03 | 3.60 | 0.9 MB | pass |
| modern-town-big-b-maghreb.glb | 22 (14/5/3) | landmark-2 (0.98), landmark-1 (0.75) | 7728 / 5280 / 726 | 8.04 | 3.60 | 0.9 MB | pass |
| modern-town-medium-a-maghreb.glb | 12 (9/2/1) | landmark-1 (0.50), landmark-2 (0.82) | 4616 / 3352 / 626 | 5.96 | 2.40 | 0.8 MB | pass |
| modern-town-medium-b-maghreb.glb | 12 (9/2/1) | landmark-2 (0.82), landmark-1 (0.50) | 4616 / 3352 / 626 | 5.97 | 2.40 | 0.8 MB | pass |
| modern-town-small-a-maghreb.glb | 7 (6/1/0) | landmark-1 (0.33) | 2576 / 2092 / 466 | 3.97 | 1.60 | 0.7 MB | pass |
| modern-town-small-b-maghreb.glb | 6 (5/1/0) | landmark-2 (0.51) | 2188 / 1802 / 456 | 4.00 | 1.13 | 0.7 MB | pass |
| shared-kingdoms-maghreb.glb: palace-small | - | - | 452 / 452 / 400 | 0.80 | 0.79 | 0.9 MB | pass |
| shared-kingdoms-maghreb.glb: palace | - | - | 636 / 636 / 400 | 1.20 | 1.50 | 0.9 MB | pass |
| shared-kingdoms-maghreb.glb: walls-medium | - | - | 2208 / 2184 / 378 | 6.80 | 0.77 | 0.9 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What each age reads as
- Classical: whitewashed flat-roofed houses and courtyard houses; an amphitheatre (landmark-1) and an
  aqueduct arc (landmark-2).
- Kingdoms: ochre mud-brick houses and riads; a kasbah tower block (landmark-1) and a Sahel mud
  mosque with buttress towers (landmark-2).
- Gunpowder: green-tiled roofs and riads; a Sahel mosque with three towers and a green-roofed courtyard compound.
- Modern: grey flat-roof blocks with rooftop water tanks; a minaret mosque and a factory with silos.
- Shared: palace-small and palace are crenellated kasbah blocks with a roof keep (the palace carries a
  team pennant); walls-medium is a crenellated rammed-earth ring with the gate at the south.

## What did not match, and why
- The palace is delivered 15 m tall (its keep and pennant), not the brief's about 12 m; kept as
  delivered, so its validation height is 1.50.
- As in the Nile run, the kit houses are larger than the base houses, so the counts sit at the low
  end (small 6 to 7, medium 12, big 22) and rich houses do not fit small towns.
- Landmarks are scaled down to fit the size caps: the Classical amphitheatre and the Modern minaret
  read small in 40 m towns (scale 0.33 to 0.45).
- The Classical small-a town carries most of its triangles in the amphitheatre (9.6k LOD0 against
  3.6k for small-b); every file is far inside the 60k / 10k / 1.5k budget.
- The ground uses the street swatch's colours as packed earth, not paving.
