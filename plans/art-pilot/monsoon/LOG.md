# Monsoon towns (Southeast Asia and the Pacific), all five ages, from a Blender-delivered kit

Date: 2026-10-04. Source: GPT's Blender delivery `plans/art/downloads/blender-monsoon-maghreb40/`
(on `claude/bronze-towns`), plus the Bronze monsoon houses from `blender-next40/`. Built with
`scripts/blender/assemble_kit_towns.py` (no per-kit scripts: the tool reads the kit folders).

    python scripts/blender/assemble_kit_towns.py <kits>/monsoon <age> monsoon <out> 2048
    ONLY=small-a,small-b,medium-a,medium-b python scripts/blender/assemble_kit_towns.py <kits>/pacific bronze pacific <out> 2048
    python scripts/blender/assemble_kit_towns.py shared <kits>/monsoon monsoon <out> 2048

`<kits>/pacific/bronze` holds the monsoon Bronze houses and materials with `landmark-pacific` as
its only `landmark-1`. The house kits did not need export-houses.py: the tool imports each object
(house-poor / common / rich) on its own.

Landmarks: Bronze drum shrine (1) and megalith terrace (2); Classical Cham tower (1) and Borobudur
stupa (2); Kingdoms Angkor temple (1) and golden stupa (2); Gunpowder Thai prang (1) and canal
warehouse (2); Modern garden tower (1) and tin longhouse (2); Pacific marae (alone).

Files: `src/assets/map/towns/<age>-town-<size>-<v>-monsoon.glb` (30),
`src/assets/map/towns/bronze-town-<size>-<v>-pacific.glb` (small and medium, 4),
`src/assets/map/shared/shared-kingdoms-monsoon.glb`. All 35 pass `validate_model.py`
(`*.validation.json` here). Town heights were validated against the measured height (towns have
no single sheet height); the tallest stands within the spec caps (16 / 24 / 36 m, Modern 50 m).

| File | Object | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|---|
| bronze-town-big-a-monsoon | town-big-a | 13,328 / 5,486 / 726 | 80.0 m | 12.2 m | 2.1 MB | passed |
| bronze-town-big-b-monsoon | town-big-b | 13,840 / 5,465 / 726 | 79.8 m | 12.2 m | 2.1 MB | passed |
| bronze-town-medium-a-monsoon | town-medium-a | 9,024 / 3,485 / 626 | 60.3 m | 12.2 m | 1.6 MB | passed |
| bronze-town-medium-a-pacific | town-medium-a | 9,100 / 3,485 / 526 | 59.8 m | 12.2 m | 1.6 MB | passed |
| bronze-town-medium-b-monsoon | town-medium-b | 9,056 / 3,485 / 626 | 60.1 m | 12.2 m | 1.6 MB | passed |
| bronze-town-medium-b-pacific | town-medium-b | 8,748 / 3,485 / 526 | 59.6 m | 12.2 m | 1.6 MB | passed |
| bronze-town-small-a-monsoon | town-small-a | 5,100 / 2,106 / 456 | 39.9 m | 8.7 m | 1.3 MB | passed |
| bronze-town-small-a-pacific | town-small-a | 4,844 / 2,026 / 456 | 39.9 m | 8.7 m | 1.2 MB | passed |
| bronze-town-small-b-monsoon | town-small-b | 4,892 / 1,786 / 456 | 40.3 m | 8.7 m | 1.2 MB | passed |
| bronze-town-small-b-pacific | town-small-b | 5,300 / 2,078 / 456 | 39.8 m | 8.7 m | 1.3 MB | passed |
| classical-town-big-a-monsoon | town-big-a | 15,508 / 6,346 / 726 | 80.4 m | 22.0 m | 2.3 MB | passed |
| classical-town-big-b-monsoon | town-big-b | 15,356 / 6,412 / 736 | 79.3 m | 22.0 m | 2.3 MB | passed |
| classical-town-medium-a-monsoon | town-medium-a | 10,044 / 4,256 / 616 | 59.8 m | 22.0 m | 1.7 MB | passed |
| classical-town-medium-b-monsoon | town-medium-b | 10,676 / 4,476 / 626 | 59.7 m | 22.0 m | 1.8 MB | passed |
| classical-town-small-a-monsoon | town-small-a | 4,344 / 1,738 / 456 | 39.6 m | 15.6 m | 1.1 MB | passed |
| classical-town-small-b-monsoon | town-small-b | 7,980 / 3,174 / 456 | 40.2 m | 7.7 m | 1.5 MB | passed |
| gunpowder-town-big-a-monsoon | town-big-a | 10,364 / 4,046 / 726 | 80.0 m | 26.0 m | 1.9 MB | passed |
| gunpowder-town-big-b-monsoon | town-big-b | 10,736 / 4,069 / 726 | 79.7 m | 26.0 m | 1.9 MB | passed |
| gunpowder-town-medium-a-monsoon | town-medium-a | 7,336 / 2,623 / 626 | 59.7 m | 21.9 m | 1.5 MB | passed |
| gunpowder-town-medium-b-monsoon | town-medium-b | 7,148 / 2,626 / 626 | 60.2 m | 21.9 m | 1.5 MB | passed |
| gunpowder-town-small-a-monsoon | town-small-a | 4,380 / 1,530 / 456 | 40.1 m | 13.7 m | 1.3 MB | passed |
| gunpowder-town-small-b-monsoon | town-small-b | 4,752 / 1,550 / 456 | 39.8 m | 6.0 m | 1.2 MB | passed |
| kingdoms-town-big-a-monsoon | town-big-a | 16,520 / 6,848 / 726 | 79.3 m | 32.0 m | 2.4 MB | passed |
| kingdoms-town-big-b-monsoon | town-big-b | 16,360 / 6,826 / 726 | 80.5 m | 32.0 m | 2.4 MB | passed |
| kingdoms-town-medium-a-monsoon | town-medium-a | 11,288 / 4,772 / 626 | 59.4 m | 24.0 m | 1.9 MB | passed |
| kingdoms-town-medium-b-monsoon | town-medium-b | 11,416 / 4,772 / 626 | 59.7 m | 24.0 m | 1.9 MB | passed |
| kingdoms-town-small-a-monsoon | town-small-a | 6,116 / 2,310 / 456 | 39.8 m | 13.4 m | 1.3 MB | passed |
| kingdoms-town-small-b-monsoon | town-small-b | 6,724 / 2,942 / 456 | 39.8 m | 16.0 m | 1.4 MB | passed |
| modern-town-big-a-monsoon | town-big-a | 17,700 / 8,446 / 725 | 79.6 m | 41.6 m | 2.9 MB | passed |
| modern-town-big-b-monsoon | town-big-b | 17,144 / 8,196 / 725 | 80.1 m | 41.6 m | 2.8 MB | passed |
| modern-town-medium-a-monsoon | town-medium-a | 11,096 / 5,475 / 625 | 60.3 m | 24.0 m | 2.1 MB | passed |
| modern-town-medium-b-monsoon | town-medium-b | 11,096 / 5,475 / 625 | 60.2 m | 24.0 m | 2.1 MB | passed |
| modern-town-small-a-monsoon | town-small-a | 6,968 / 3,563 / 465 | 39.7 m | 16.0 m | 1.6 MB | passed |
| modern-town-small-b-monsoon | town-small-b | 3,852 / 2,052 / 456 | 40.0 m | 5.6 m | 1.0 MB | passed |
| shared-kingdoms-monsoon | palace-small | 236 / 236 / 236 | 8.0 m | 8.0 m | 1.0 MB | passed |
| shared-kingdoms-monsoon | palace | 260 / 260 / 260 | 12.0 m | 13.5 m | 1.0 MB | passed |
| shared-kingdoms-monsoon | walls-medium | 1,600 / 1,600 / 378 | 68.3 m | 7.5 m | 1.0 MB | passed |

## Layouts (houses; landmark scale)
- bronze-town-small-a-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.79
- bronze-town-small-b-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L2 x0.56
- bronze-town-medium-a-monsoon: 12 houses (poor: 9, common: 2, rich: 1); L1 x1.0 L2 x0.89
- bronze-town-medium-b-monsoon: 12 houses (poor: 9, common: 2, rich: 1); L2 x0.89 L1 x1.0
- bronze-town-big-a-monsoon: 22 houses (poor: 14, common: 6, rich: 2); L1 x1.0 L2 x1.0
- bronze-town-big-b-monsoon: 22 houses (poor: 14, common: 7, rich: 1); L2 x1.0 L1 x1.0
- classical-town-small-a-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.71
- classical-town-small-b-monsoon: 6 houses (poor: 6, common: 0, rich: 0); L2 x0.53
- classical-town-medium-a-monsoon: 11 houses (poor: 10, common: 1, rich: 0); L1 x1.0 L2 x0.81
- classical-town-medium-b-monsoon: 12 houses (poor: 9, common: 3, rich: 0); L2 x0.86 L1 x1.0
- classical-town-big-a-monsoon: 22 houses (poor: 14, common: 6, rich: 2); L1 x1.0 L2 x1.0
- classical-town-big-b-monsoon: 23 houses (poor: 20, common: 3, rich: 0); L2 x1.0 L1 x1.0
- kingdoms-town-small-a-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.45
- kingdoms-town-small-b-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L2 x0.5
- kingdoms-town-medium-a-monsoon: 12 houses (poor: 10, common: 2, rich: 0); L1 x0.73 L2 x0.75
- kingdoms-town-medium-b-monsoon: 12 houses (poor: 10, common: 2, rich: 0); L2 x0.75 L1 x0.73
- kingdoms-town-big-a-monsoon: 22 houses (poor: 17, common: 4, rich: 1); L1 x0.86 L2 x1.0
- kingdoms-town-big-b-monsoon: 22 houses (poor: 18, common: 3, rich: 1); L2 x1.0 L1 x0.86
- gunpowder-town-small-a-monsoon: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.53
- gunpowder-town-small-b-monsoon: 6 houses (poor: 6, common: 0, rich: 0); L2 x0.5
- gunpowder-town-medium-a-monsoon: 12 houses (poor: 9, common: 2, rich: 1); L1 x0.84 L2 x0.8
- gunpowder-town-medium-b-monsoon: 12 houses (poor: 8, common: 4, rich: 0); L2 x0.8 L1 x0.84
- gunpowder-town-big-a-monsoon: 22 houses (poor: 14, common: 6, rich: 2); L1 x1.0 L2 x0.95
- gunpowder-town-big-b-monsoon: 22 houses (poor: 14, common: 5, rich: 3); L2 x0.95 L1 x1.0
- modern-town-small-a-monsoon: 7 houses (poor: 6, common: 1, rich: 0); L1 x0.39
- modern-town-small-b-monsoon: 6 houses (poor: 6, common: 0, rich: 0); L2 x0.67
- modern-town-medium-a-monsoon: 12 houses (poor: 9, common: 2, rich: 1); L1 x0.58 L2 x1.0
- modern-town-medium-b-monsoon: 12 houses (poor: 9, common: 2, rich: 1); L2 x1.0 L1 x0.58
- modern-town-big-a-monsoon: 22 houses (poor: 14, common: 6, rich: 2); L1 x1.0 L2 x1.0
- modern-town-big-b-monsoon: 22 houses (poor: 15, common: 5, rich: 2); L2 x1.0 L1 x1.0
- bronze-town-small-a-pacific: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.71
- bronze-town-small-b-pacific: 6 houses (poor: 5, common: 1, rich: 0); L1 x0.71
- bronze-town-medium-a-pacific: 13 houses (poor: 10, common: 2, rich: 1); L1 x1.0
- bronze-town-medium-b-pacific: 13 houses (poor: 10, common: 2, rich: 1); L1 x1.0

## Decisions and what differs from the delivery
- Landmarks are scaled down to the tool's per-size caps (small 10 m across / 16 m high, medium
  16 / 24 m, big 19 / 36 m). The tall ones shrink most in small towns: Angkor temple x0.45, Thai
  prang x0.53, garden tower x0.39 (29.4 m to 16 m). In big Modern towns the cap is raised to 50 m
  (spec: Modern landmarks up to 50 m), so the garden tower stands at its full 41.6 m there.
- classical-town-medium-a holds 11 houses (the tool wants 12 to 14): the Cham tower and the
  Borobudur stupa together take most of the north half. Left as is.
- The Pacific towns put the marae alone at the north (small x0.71, medium x1.0) and use the
  monsoon Bronze stilt houses; no big Pacific towns (not asked).
- Shared file: palace-small 8 m, palace 12 m (13.5 m to the finial), walls-medium scaled across
  from 65.4 m to 68 m (the tool's ring size), height unchanged. The delivered pieces are low-poly
  (236, 260, 1,600 triangles), so LOD1 equals LOD0; the plain wall ring and its gate read as
  delivered (no merlons or towers round the ring in the kit).
- Ground: the tool's earth patch in the colours of each age's street swatch.

## Tool changes (assemble_kit_towns.py)
- A kit with only `landmark-1` (the Pacific marae) now gets it alone at the north of every town;
  before, a missing landmark-2 silently built houses-only towns.
- Modern big towns raise the landmark height cap to 50 m (`MODERN_BIG_CAP`).

Previews: `*-concept-vs-model.png` (the kit's own previews beside the built town, medium-a per
age, Modern big-a, Pacific small-b and medium-a, the shared file).
