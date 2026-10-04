# Bronze Age towns in the Indic kit (art spec 3b), built in Blender

Date: 2026-10-04. Sources: `plans/art/kits/indic/bronze/` (houses, street, roofscape, materials,
landmark-1 the Great Bath, landmark-2 the granary; GPT's concept sheets).
Kit: `scripts/blender/ti_indic_bronze.py` (materials `inb_*`). Towns:
`scripts/blender/build_town_bronze_indic_<size>_<v>.py`, each on the layout of the matching
`build_town_bronze_<size>_<v>.py` (the house plots, sizes, free centre, stalls and landmark spots
as the Europe kit read them off the base scripts). Files: `bronze-town-<size>-<v>-indic.glb` in
`src/assets/map/towns/`; the object inside keeps the base name (`town-<size>-<v>`), so the game
loads it the same way as the base and Europe towns.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| bronze-town-small-a-indic | 13,736 / 3,140 / 706 | 40 m | 6.1 m | 2.6 MB | passed |
| bronze-town-small-b-indic | 14,690 / 2,888 / 502 | 40 m | 8.8 m | 2.8 MB | passed |
| bronze-town-medium-a-indic | 29,664 / 5,936 / 922 | 59 m | 8.8 m | 4.0 MB | passed |
| bronze-town-medium-b-indic | 28,666 / 5,924 / 922 | 59 m | 9.3 m | 4.0 MB | passed |
| bronze-town-big-a-indic | 50,102 / 9,792 / 1,222 | 79 m | 8.9 m | 6.1 MB | passed |
| bronze-town-big-b-indic | 49,056 / 9,824 / 1,162 | 79 m | 9.7 m | 6.0 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500. One 2048 WebP atlas set per file; Town, Ground
(alpha-cut) and Team materials. Heights are the tallest landmark (the granary's roof beams; in
small-a the Great Bath and a rich house's upper room). Previews: `<size>-<v>-indic-concept-vs-model.png`
(the street sheet beside the model's three-quarter view) and `<size>-<v>-indic-top.png` (to lay
beside the roofscape sheet).

## What stands where

| Town | Landmarks | Houses (poor / common / rich) |
|---|---|---|
| small-a | compact Great Bath (11 x 10 m) in the landmark spot, north-east | 1 / 3 / 2 |
| small-b | granary (10 x 7 m) in the landmark spot, north-west | 2 / 3 / 2 |
| medium-a | Great Bath (14 x 12 m) north-east; granary (10 x 7 m) east of the square | 2 / 7 / 4 |
| medium-b | granary (14 x 9 m) north; small Great Bath (10 x 9 m) west of the square | 2 / 7 / 4 |
| big-a | Great Bath (16 x 14 m) north-east; granary (11 x 7 m) north-west; brick gateway south | 7 / 11 / 5 |
| big-b | granary (17 x 10 m) north-west; Great Bath (14 x 12 m) north; three pottery kilns east | 6 / 12 / 5 |

Variant a leans to the Great Bath (the main landmark of the small and medium towns), variant b to
the granary. Medium and big towns carry both. The house kinds per plot are the Europe kit's
(poor on the outskirts, rich next to the square).

## Decisions
- House types follow the houses sheet: poor = one brick room at the back of its plot behind a
  walled yard with a reed lean-to, jars and baskets (the street sheet's bottom row); common = rooms
  on three sides of an open paved court (a tree in a brick bed, a grey awning on timber posts along
  the back range, a stair up the open side to the roof); rich = rooms on four sides, a bathing pool
  of green-grey brick and a tree in the court, and a second-storey room over one corner.
- Every house stands on a low paved plinth that fills its base plot, with the covered street drain
  (stone curbs, water, cover slabs, a brick inspection pit) along its front. That is the kit's
  signature; at LOD1 the drain keeps its curbs and pit, the water strip is LOD0 only.
- Roofs are flat mud plaster inside a brick parapet (parapets LOD0), with reed screens on poles,
  hatches with timber grilles and jars on top, which gives the roofscape sheet's busy flat roofs.
- Heights: the brief's 1.3x storey (0.42) made the 6 to 9 m plots read as towers and hid the
  courts; the sheet houses are low and wide, so rooms are 2.8 m (common), 3.1 m (rich) and 2.7 m
  (poor), raised by the plinth, with the rich upper room to 5.6 m. Landmarks at the sheets'
  heights where they fit: the granary 3 + 3.5 + 2.5 m (9 m) at full size; both landmarks scale
  their heights gently with their footprint (to about 80 percent in the smallest spots).
- The Great Bath (37 x 33 m on the sheet) does not fit a town's landmark corner, so it scales to its
  spot and keeps every part: the raised fired-brick plinth with stairs at the front corners, the
  paved deck, the sunken pool (green-grey lining, stepped coping, steps down at both ends), the
  brick-column galleries west, east and north with grey awnings, the four corner towers (doors on
  the front pair, timber roof lattices on the back pair). The pool depth is the plinth's (about
  1 m) because nothing may go below the ground.
- The granary keeps the sheet's three tiers: the brick plinth with pilasters and the central front
  stair, timber-post storage bays (plank doors, a grey team awning over each bay), the slatted
  ventilation storey and the flat reed roof on timber beams. Bays: 3 to 6 by width.
- Street props: brick-lined round wells, brick-countered stalls under team cloth or reed mats,
  reed lean-tos, round brick pottery kilns with fuel, reed drying racks, neem trees, jars, baskets
  and grain sacks. The big-a gate is a brick gateway (two bastions, timber lintel, team pennant)
  in place of the Europe kit's timber gate.
- Materials from the materials sheet: baked brick (`inb_brick`, warm tan-orange with light mortar
  and a few patches of mud plaster; `inb_fired` pinker for the landmarks), mud plaster, sandstone
  paving, dark timber, reed mat, grey stone drain lining, teal water, green-grey pool brick and
  the packed-earth street (`inb_earth`, its fringe and square). Team cloth: door and court awnings,
  stall canopies, the bath's and granary's awnings, the gate pennant.
- Big-town LOD1 first came to 10,236 and 10,280; moving the drain water and the back-yards' floors
  to LOD0 brought it to 9,792 and 9,824. LOD2 is one brick block with a plaster top per house.

## Not matched
- The street sheet lays houses on a square grid of paved streets with drains on every side; the
  towns keep the base layouts (rings of plots round the free centre), so the drains run along
  each house front only and the street is packed earth, not brick paving.
- The brick bond is procedural and reads finer and more striped than the painted sheets; courts
  are small at 6 to 9 m plots, so the court awnings show mostly from above.
- No walls or palaces in this kit: no Indic shared file was asked for; the shared Bronze wall
  rings and palaces still apply.
