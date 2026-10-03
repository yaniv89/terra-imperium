# Bronze Age towns in the Europe kit (art spec 3b), built in Blender

Date: 2026-10-03. Sources: `plans/art/kits/europe/bronze/` (houses, street, roofscape, materials,
landmark-1 stone circle, landmark-2 Minoan palace; GPT's concept sheets, READMEs beside them).
Kit: `scripts/blender/ti_europe_bronze.py` (materials `eu_*`). Towns:
`scripts/blender/build_town_bronze_europe_<size>_<v>.py`, each on the layout of the matching
`build_town_bronze_<size>_<v>.py` (house plots, sizes, the free centre, the square and the ground
are the base town's; the plots were read off the base scripts by replaying their random draws).
Files: `bronze-town-<size>-<v>-europe.glb`; the object inside keeps the base name
(`town-<size>-<v>`), so the game loads it the same way.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| bronze-town-small-a-europe | 10,378 / 2,490 / 648 | 40 m | 6.1 m | 2.5 MB | passed |
| bronze-town-small-b-europe | 10,208 / 2,628 / 662 | 40 m | 8.7 m | 2.4 MB | passed |
| bronze-town-medium-a-europe | 22,714 / 4,938 / 1,024 | 59 m | 8.7 m | 3.4 MB | passed |
| bronze-town-medium-b-europe | 21,792 / 4,768 / 1,024 | 59 m | 8.7 m | 3.3 MB | passed |
| bronze-town-big-a-europe | 38,334 / 7,922 / 1,360 | 79 m | 8.7 m | 4.8 MB | passed |
| bronze-town-big-b-europe | 37,092 / 7,892 / 1,388 | 79 m | 8.7 m | 4.8 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500. One 2048 WebP atlas set per file; Town, Ground
(alpha-cut) and Team materials. Previews: `<size>-<v>-europe-concept-vs-model.png` (the street
sheet beside the model's three-quarter view) and `<size>-<v>-europe-top.png`.

## What stands where

| Town | Landmarks | Houses (poor / common / rich) |
|---|---|---|
| small-a | stone circle (11 m) in the base's landmark spot, north-east | 1 / 3 / 2 |
| small-b | compact Minoan palace (10 x 9 m) in the landmark spot, north-west | 2 / 3 / 2 (one with a porch) |
| medium-a | stone circle (14 m) north-east; compact palace east of the square | 2 / 7 / 4 |
| medium-b | Minoan palace (14 x 11 m) north; small stone circle (10 m) west of the square | 2 / 7 / 4 (one with a porch) |
| big-a | Minoan palace (16 x 14 m) north-east; stone circle (11 m) north-west; timber gate at the south | 7 / 11 / 5 |
| big-b | Minoan palace (17 x 12 m) north-west; stone circle (14 m) north; three raised granaries east | 6 / 12 / 5 (one with a porch) |

Variant a leans to the Atlantic north (the stone circle is the main landmark of the small and
medium towns), variant b to the Aegean (the Minoan palace). Medium and big towns carry both.

## Decisions
- House types follow the sheet: poor = a 4 x 6 m reed-thatch hut (crossed poles at both ridge
  ends) on one side of its plot with a fenced garden or hay and logs beside it; common = an ochre
  wattle-and-daub longhouse between oak posts on a fieldstone footing under a hipped turf roof
  (some straw) with a pegged ridge pole; rich = a lime-washed hall with close-set posts, carved
  door posts, a straw hip and a wattle-fenced front yard (garden bed, bench, pots). Big towns'
  outer ring keep their yards as wattle-fenced plots behind the houses.
- Every house's eaves fill its base plot, so the roofscape keeps the base town's rhythm; the
  roofscape sheet's golden and green checker comes from straw and turf alternating.
- Type by place: poor on the outskirts (the big towns' outer ring), rich next to the square
  (where the base had two storeys), common between. Heights: houses raised 1.3x (poor 4.2 m,
  common 4.6 m, rich 5.2 m at the eaves-to-ridge of the sheet); landmarks at the sheets' heights
  (stone circle 5 m, palace 8 m, horns to 8.7 m).
- The stone circle keeps the sheet's stone size; smaller rings (10 to 14 m to fit the spots)
  get fewer stones. LOD2 swaps uprights and lintels for one ring band.
- The palace scales to its spot (the sheet's 20 x 18 m does not fit a 60 m town's landmark
  corner); below about 14 m it keeps the same parts, thinner wings, a narrower court.
- European props: stone well (the shared kit's), lean-to log stores, warp-weighted looms with
  woad-blue cloth, hide racks, haystacks, barrels, baskets and pots; stalls of oak with team-cloth
  or straw canopies, cheeses and baskets. Team cloth: door awnings, stalls, the palace awning and
  the gate's pennant.
- The ground is the Bronze towns' packed-earth patch recoloured to the sheet's street earth with
  a little green in it (`eu_earth`, its fringe and square).
- Every big-town LOD2 stays under 1,500 (1,360 and 1,388), so fences, props and the palace's
  detail stop at LOD1; the big towns land at 38,000 LOD0 (the base Bronze big towns are about
  50,000: the hipped roofs are cheaper than the base's flat roofs with parapets, beam ends and
  roof clutter).

## Not matched
- The sheets' palisade round the block is not in the town files: walls are the shared wall
  rings (shared-bronze.glb) and are not part of this kit.
- Thatch and turf are procedural (courses, streaks, grass noise), so roofs read flatter than the
  painted sheets; the gable-front porches of the street sheet are only on the porch houses.
