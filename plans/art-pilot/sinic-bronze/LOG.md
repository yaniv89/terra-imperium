# Bronze Age towns in the Sinic kit (art spec 3b), built in Blender

Date: 2026-10-04. Sources: `plans/art/kits/sinic/bronze/` (houses, street, roofscape, materials,
landmark-1 bronze-casting hall, landmark-2 oracle shrine with a drum tower; GPT's concept sheets).
Kit: `scripts/blender/ti_sinic_bronze.py` (materials `snb_*`). Towns:
`scripts/blender/build_town_bronze_sinic_<size>_<v>.py`, each on the layout of the matching
`build_town_bronze_<size>_<v>.py` (the house plots, house kinds, stalls, prop spots and landmark
spots are the ones the Europe kit read off the base scripts, so the three kits share one layout).
Files: `bronze-town-<size>-<v>-sinic.glb`; the object inside keeps the base name
(`town-<size>-<v>`), so the game loads it the same way.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| bronze-town-small-a-sinic | 14,153 / 2,804 / 574 | 40 m | 9.7 m | 2.9 MB | passed |
| bronze-town-small-b-sinic | 14,618 / 3,190 / 628 | 40 m | 12.3 m | 3.1 MB | passed |
| bronze-town-medium-a-sinic | 29,823 / 5,822 / 916 | 59 m | 12.3 m | 4.1 MB | passed |
| bronze-town-medium-b-sinic | 29,467 / 5,830 / 916 | 59 m | 13.0 m | 4.1 MB | passed |
| bronze-town-big-a-sinic | 53,415 / 9,506 / 1,336 | 79 m | 12.6 m | 6.3 MB | passed |
| bronze-town-big-b-sinic | 53,619 / 9,338 / 1,396 | 79 m | 13.2 m | 6.4 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500. One 2048 WebP atlas set per file; Town, Ground
(alpha-cut) and Team materials. The height is the drum tower's knob (or the casting hall's ridge
crosses in small-a). Previews: `<size>-<v>-sinic-concept-vs-model.png` (the street sheet's beauty
panel beside the model's three-quarter view) and `<size>-<v>-sinic-top.png`.

## What stands where

| Town | Landmarks | Houses (poor / common / rich) |
|---|---|---|
| small-a | casting hall (11 x 8 m) in the base's landmark spot, north-east | 1 / 3 / 2 |
| small-b | oracle shrine (10 x 9 m, tower 12 m) in the landmark spot, north-west | 2 / 3 / 2 (one with a gate porch) |
| medium-a | casting hall (14 x 10 m) north-east; compact shrine east of the square | 2 / 7 / 4 |
| medium-b | shrine (14 x 11 m) north; small casting hall (10 x 7 m) west of the square | 2 / 7 / 4 (one with a gate porch) |
| big-a | casting hall (16 x 11 m) north-east; shrine (12 x 10 m) north-west; gatehouse at the south | 7 / 11 / 5 |
| big-b | shrine (17 x 12 m) north-west; casting hall (14 x 10 m) north; three raised granaries east | 6 / 12 / 5 (one with a gate porch) |

Variant a leans to craft (the casting hall is the main landmark), variant b to ritual (the oracle
shrine and its drum tower). Medium and big towns carry both.

## Decisions
- House types follow the houses sheet. Poor: a 4 x 6 m hut of rammed-earth panels between dark
  posts, door in the narrow front, a steep hip-and-gable thatch with a tied ridge and crossed
  poles, the rest of the plot a garden bed and drying rack (or a woodpile) inside a staked fence.
  Common: the 8 x 10 m walled courtyard: a rammed-earth wall round the plot, a small thatched
  gatehouse in its front, the hall (the materials sheet's house: earth panels, posts, mid rail,
  plank door, reed-mat windows, stone footing with two steps) across the back, two thatched side
  sheds facing the court, pots and a rack in the court. Rich: a rammed-earth platform with stone
  steps, a veranda of red-lacquered posts and a red railing round a dark plank-and-lattice hall
  with a red door, under a big hip-and-gable thatch; the porch slots get a gabled gate porch on
  red posts at the foot of the steps.
- The hip-and-gable roof is one closed solid (hips rise to a level line 40 to 45 percent up,
  then an upright gable) with a woven bamboo board on each gable; the ridge is a straw bundle, a
  dark pole with crossed pegs and crossed poles at the ends (the materials sheet's tied ridge).
- Every house fills its base plot; type by place as the Europe kit set it (poor outside, rich by
  the square). Heights raised 1.3x: poor 3.6 m, common 4.9 m, rich 6.5 m (sheet 2.8 / 3.8 / 5 m).
- Casting hall (sheet: 16 x 10 m hall on an 18 x 12 m platform, 10 m): a battered rammed-earth
  platform, a wide front stair between cheek blocks, an open frame of posts on stone bases with a
  plank back wall and bamboo gables, a gable thatch with poles held across the slopes, the tied
  ridge with tall end crosses; inside a beehive furnace with its stoke hole, charcoal heaps,
  crucibles, work tables with clay moulds and bronze ding, more along the back wall; a staked
  fence round the platform's sides and back.
- Oracle shrine (sheet: 18 m platform, 12 m hall 6 m high, 4 m drum tower 14 m): a platform
  faced with timber posts, the stair to the hall at the west, the hall's veranda of posts round
  plank walls under a hip-and-gable thatch, four bronze cauldrons and the altar table with an
  oracle shell on the veranda, a stone altar and a big cauldron in the open east court, and the
  drum tower at the back of the east end: four posts with X bracing, a plank-clad middle storey,
  the drum floor with a railing and the hide drum on its cradle, a pyramid thatch with a knob,
  a team pennant.
- Both landmarks scale their plan to the base's landmark spots; heights shrink only a little
  (casting hall 9.7 to 10 m, tower 12.3 to 13.2 m).
- Street: packed-earth ground (`snb_street`), stalls of dark posts under team cloth or reed mats
  with clay and bronze pots, big black storage jars, slatted plank sheds, drying racks,
  woodpiles, the shared stone well, bushes at plot corners and a few trees in the yards.
  big-a's south gate: a timber gatehouse with plank leaves between rammed-earth wall stubs.
- Budget: big towns land at 53,500 LOD0 and 9,500 LOD1. To get there the fence posts, wall
  posts, side-shed walls and most veranda posts stop at LOD0 and the houses' gable boards and
  end crosses show at LOD0 only (the landmarks keep theirs to LOD1). The tower has a one-box
  LOD2 stand-in.

## Not matched
- The street sheet's square grid of plots is not used: the towns keep the base's ring of plots
  round the free centre (the layout is shared by every kit).
- The rich house top view on the houses sheet is a U of roofs round a court; the model follows
  the sheet's front and beauty views (one big hall on a platform), which reads better at map
  scale and fits the plots.
- Thatch is procedural (courses and streaks), so roofs read smoother than the painted sheets;
  the materials sheet's slightly upswept eave corners are straight.
- The shrine's west side stair and the tower's inside stair are left out (a ladder stands in);
  the casting hall's bellows and tool racks are left out.
- Files were built at 2048 once each; the 2048 bakes needed about 2.4 GB each, so with six
  artists' jobs the first parallel runs were killed for memory and the builds were rerun one at
  a time.
