# Modern Age Levant kit: the six towns of the Levant, Mesopotamia, Arabia and Persia

Date: 2026-10-04. Sources: the kit sheets in `plans/art/kits/levant/modern/` (`houses.png`,
`street.png`, `roofscape.png`, `materials.png`, `landmark-1` the glass tower with a mashrabiya
screen, `landmark-2` the refinery flare stack). Art spec section 3b: a town is layout x kit, so
every town stands on the base Modern layout of the same size and variant
(`build_town_modern_<size>_<v>.py`, see `plans/art-pilot/modern/LOG.md`) with the kit's buildings
on its spots. Code: `scripts/blender/ti_levant_modern.py` (imports `ti_modern.py`, which it does
not change), builders `build_town_modern_levant_<size>_<v>.py <out> [atlas]`. One 2048 WebP atlas
set per file. Files in `/tmp/claude-0/out/levant/`.

| File | Landmarks (replacing) | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|
| modern-town-small-a-levant.glb | compact flare stack, 22 m, one vessel (water tower) | 5,269 / 2,335 / 418 | 41 m | 23 m | 1.9 MB |
| modern-town-small-b-levant.glb | small mashrabiya tower, 15 m (clock tower; canopy shortened) | 4,435 / 1,997 / 422 | 41 m | 16.5 m | 1.8 MB |
| modern-town-medium-a-levant.glb | mashrabiya tower, 30 m (glass tower) | 12,976 / 5,728 / 760 | 61 m | 31.5 m | 2.8 MB |
| modern-town-medium-b-levant.glb | flare stack, 35 m on a 10 m pad (works and chimney) | 11,348 / 4,906 / 862 | 62 m | 36 m | 2.7 MB |
| modern-town-big-a-levant.glb | mashrabiya tower, 45 m (glass tower) | 17,892 / 7,840 / 1,172 | 81 m | 46.5 m | 3.4 MB |
| modern-town-big-b-levant.glb | mashrabiya tower, 45 m (stepped skyscraper); flare stack, 35 m (works) | 19,812 / 8,724 / 1,214 | 81 m | 46.5 m | 3.7 MB |

Every file passes `validate_model.py` (`*.validation.json` beside the GLBs). Previews here:
`<town>-concept-vs-model.png` (the street sheet's beauty panel beside the model; the kit has no
per-town sheet) and `<town>-front.png`.

## Decisions
- Houses: every base `block` and `house` call is swapped (as the Europe kits swap theirs) for a
  kit villa on the same spot and footprint (the base's widened footprints and lawn verges kept):
  one-storey houses become the poor white concrete house (parapet, steel roof tank, AC box, sail
  shade over a walled yard, timber gate); rendered blocks the common cream villa (lower floors over
  the plot, the top floor set back to one side, a stair tower, bronze mashrabiya screens, a roof
  terrace under a slatted pergola with planters, a walled front); brick blocks (45%) and a few
  rendered ones (12%) the rich villa (limestone ground floor, white upper volume with full-height
  glass, teak slat panel, glass balustrade, terrace pool, pergola). Shop blocks keep their
  shopfront and team awning. All roofs are flat; base gable and hip roofs are dropped.
- Windows, lattices, slats and pergola slats are painted by the materials (`lvm_*_win` via
  `ti_modern.mat_facade`; `mat_lattice` draws the mashrabiya as bars in four directions, which
  cross into eight-pointed stars), so blocks stay square to the map axes. At LOD2 each villa is one
  box at its full height, so LOD2 matches the base towns.
- The mashrabiya tower keeps the sheet's 45 m in the big towns (9 by 7.5 m and 10 by 8 m shafts on
  12.5 to 13.5 m podiums; the sheet's 18 m wide shaft would not fit beside the base layouts'
  blocks); it is 30 m in the medium town and 15 m in the small one, where 45 m would tower over a
  village. The flare stack keeps 35 m in the medium and big towns on the works' plot (10 and 13 m
  pads instead of 20 m); the small town's is 22 m with one vessel on a 5 m pad.
- Date palms replace the base street trees (one frond mesh per crown, single-sided, facing up).
  The town ground and plaza are travertine paving (`lvm_pave` triplet). Stations, the stadium,
  water towers, canopies, market tents, lamps and lawns stay from the base layouts.
- Variants: a carries the oil village (small), the tower town (medium) and the tower city (big);
  b the tower square (small), the refinery town (medium), and the tower and refinery city (big).
- New materials all carry `lvm_`. No shared or existing `ti_*.py` module was changed.

## Not matched
- The sheet's villas are walled plots with gardens, palms in every yard and gates on paved lanes;
  the base layouts pack blocks tightly, so yards are a thin front wall and the palms stand only
  where the base trees stood. The lawns stay the base kit's bright green.
- The rich villas' front pools sit on the ground-floor roof terrace, not in a courtyard.
- The tower's curtain wall reads as larger panes than the sheet's fine grid; its screens are flat
  panels (the lattice in the material), not perforated.
- The refinery's pipe racks are simplified (three runs, two valves); no stairs to the deck.
- Mashrabiya lattice and teak slats blur to bronze and brown at the far zoom.
