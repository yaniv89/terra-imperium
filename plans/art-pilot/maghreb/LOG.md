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
