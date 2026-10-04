# Gunpowder Age Europe kit: the six towns in the European manner and for the colonies

Date: 2026-10-04. Sources: the kit sheets in `plans/art/kits/europe/gunpowder/` (`houses.png`,
`street.png`, `roofscape.png`, `materials.png`, `landmark-1` the Baroque church, `landmark-2`
the arcaded town hall, `landmark-colonies` the New England clapboard church). Art spec section
3b: a town is layout x kit, so every town here stands on the base Gunpowder layout of the same
size and variant (`build_town_gunpowder_<size>_<v>.py`, see `plans/art-pilot/gunpowder/LOG.md`)
with the kit's buildings on its spots. Code: `scripts/blender/ti_europe_gunpowder.py` (imports
`ti_gunpowder.py`), builders `build_town_gunpowder_europe_<size>_<v>.py <out> [atlas] [europe|colonies]`.
One 2048 WebP atlas set per file.

| File | Landmarks | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|
| gunpowder-town-small-a-europe.glb | arcaded hall with clock cupola | 14,926 / 3,180 / 642 | 41 m | 10 m | 3.5 MB |
| gunpowder-town-small-b-europe.glb | Baroque church, windmill | 12,788 / 3,342 / 712 | 41 m | 11 m | 3.2 MB |
| gunpowder-town-medium-a-europe.glb | Baroque church, arcaded hall | 31,698 / 5,624 / 1,100 | 61 m | 20 m | 4.8 MB |
| gunpowder-town-medium-b-europe.glb | arcaded hall (20 m), windmill | 33,052 / 5,938 / 1,180 | 61 m | 20 m | 5.0 MB |
| gunpowder-town-big-a-europe.glb | Baroque church, arcaded hall, windmill, bastion | 57,353 / 8,697 / 1,388 | 81 m | 28 m | 7.2 MB |
| gunpowder-town-big-b-europe.glb | Baroque church, arcaded hall, windmill, bastion | 47,736 / 8,052 / 1,228 | 81 m | 28 m | 6.4 MB |
| gunpowder-town-small-a-colonies.glb | clapboard church, arcaded hall | 13,130 / 3,232 / 654 | 41 m | 11 m | 3.2 MB |
| gunpowder-town-small-b-colonies.glb | clapboard church, windmill | 11,404 / 3,156 / 598 | 41 m | 11 m | 3.0 MB |
| gunpowder-town-medium-a-colonies.glb | clapboard church, arcaded hall | 27,622 / 5,246 / 954 | 61 m | 20 m | 4.4 MB |
| gunpowder-town-medium-b-colonies.glb | arcaded hall, clapboard church, windmill | 27,442 / 5,508 / 1,018 | 61 m | 20 m | 4.5 MB |
| gunpowder-town-big-a-colonies.glb | clapboard church, arcaded hall, windmill, bastion | 46,379 / 7,845 / 1,106 | 81 m | 28 m | 6.3 MB |
| gunpowder-town-big-b-colonies.glb | clapboard church, arcaded hall, windmill, bastion | 39,924 / 7,462 / 1,026 | 81 m | 28 m | 5.7 MB |

Every file passes `validate_model.py` (`*.validation.json` here and in
`/tmp/claude-0/out/gunpowder/`). Previews: `*-kit-vs-model.png` (the kit sheet beside the model).

## Decisions
- The kit swaps the base layout's builders, not its spots: every house spot gets one of the
  kit's three houses, chosen by the spot's size and the town's seed (poor under about 30 m2
  of plan, rich over about 47 m2, common between, with some mixing):
  - poor: a one-storey red-brick cottage under a terracotta gable with a dormer and green
    shutters;
  - common: a narrow brick house over a rusticated sandstone ground floor, iron balconies on
    the first floor, a slate mansard with dormers, railings at the front;
  - rich: a cream stucco house on a sandstone ground floor with balconies, a pedimented door,
    steps, railings and pots, under a slate mansard (sometimes a hip) with three dormers.
  Small towns keep to two storeys, the rest up to three, so the landmarks still lead.
- Landmark 2, the arcaded town hall, replaces every base town hall: a sandstone arcade on the
  ground floor (arched openings, lanterns, two team banners), brick upper floors, a slate
  mansard with dormers and iron cresting, a sandstone clock cupola with a slate pyramid. It
  keeps the base hall's spot and height.
- Landmark 1, the Baroque church, replaces the domed and twin-tower churches: the base domed
  church with a copper (verdigris) dome and scrolled volutes beside the front gable, capped
  at 8 by 13 m of plan. The small towns, which had no church, get one on a house spot (the
  north house of small-b, the north-east house of small-a), at 11 m.
- Colonies (the US, Canada, Australia, New Zealand): the clapboard church (stone foundation,
  white clapboard with corner boards, tall sash windows, a grey shingle gable, a front steeple
  with a louvred belfry, lantern and white spire) takes the churches' spots; poor and common
  houses become white clapboard cottages and two-storey side-gabled clapboard houses under grey
  shingles, rich houses Georgian brick under slate hips with shutters. The arcaded hall stays
  (the kit has no colonial civic building), as do the windmills, bastions, stalls and lamps.
- Windmills, the big towns' bastions, stalls, wells, lamps, trees and the cobbled ground come
  unchanged from the base Gunpowder kit; the kit's street sheet shows the same cobbles, lamps,
  well and awnings.
- `town-small-a-europe` was rebuilt after delivery with the Baroque church on its north-east
  spot (15,286 / 3,444 / 768, 11 m, passes validation, in `/tmp/claude-0/work/gunpowder/final_eu/`);
  the delivered file is the first build without the church.
