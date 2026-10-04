# Gunpowder Age Sinic kit: the six towns for China and Korea, and for Edo Japan

Date: 2026-10-04. Sources: the kit sheets in `plans/art/kits/sinic/gunpowder/` (`houses.png`,
`street.png`, `roofscape.png`, `materials.png`, `landmark-1` the barbican gate, `landmark-2` the
yellow-roof temple, `landmark-japan` the Edo castle keep). Art spec section 3b: a town is layout x
kit, so every town stands on the base Gunpowder layout of the same size and variant
(`build_town_gunpowder_<size>_<v>.py`) with the kit's buildings on its spots, as the Europe kit
did (`plans/art-pilot/europe-gunpowder/LOG.md`). Code: `scripts/blender/ti_sinic_gunpowder.py`
(imports `ti_gunpowder.py` and `ti_classical.py`, materials prefixed `sng_`), builders
`build_town_gunpowder_sinic_<size>_<v>.py <out> [atlas] [sinic|japan]`. One 2048 atlas set per file.

| File | Landmarks | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|
| gunpowder-town-small-a-sinic.glb | barbican (NW), temple (NE spot) | 15,657 / 3,275 / 648 | 40 m | 9.6 m | 3.1 MB |
| gunpowder-town-small-b-sinic.glb | barbican (north spot), temple (windmill) | 16,413 / 4,147 / 618 | 40 m | 8.1 m | 3.2 MB |
| gunpowder-town-medium-a-sinic.glb | temple (church), barbican (hall) | 31,945 / 5,387 / 882 | 60 m | 12.5 m | 4.4 MB |
| gunpowder-town-medium-b-sinic.glb | barbican (hall), temple (windmill) | 32,407 / 5,245 / 924 | 60 m | 12.7 m | 4.4 MB |
| gunpowder-town-big-a-sinic.glb | temple, barbican, shrine, bastion | 54,992 / 8,788 / 954 | 80 m | 14.5 m | 6.6 MB |
| gunpowder-town-big-b-sinic.glb | temple, barbican, shrine, bastion | 48,767 / 7,787 / 898 | 80 m | 13.0 m | 6.0 MB |
| gunpowder-town-small-a-japan.glb | keep (NW), grey temple (NE spot) | 15,336 / 2,816 / 924 | 40 m | 12.0 m | 2.7 MB |
| gunpowder-town-small-b-japan.glb | keep (north spot), grey shrine (windmill) | 15,232 / 3,424 / 878 | 40 m | 9.5 m | 2.6 MB |
| gunpowder-town-medium-a-japan.glb | grey temple (church), keep (hall) | 27,758 / 4,612 / 1,158 | 60 m | 15.5 m | 3.7 MB |
| gunpowder-town-medium-b-japan.glb | keep (hall), grey temple (windmill) | 27,186 / 4,440 / 1,184 | 60 m | 15.8 m | 3.6 MB |
| gunpowder-town-big-a-japan.glb | grey temple, keep, shrine, bastion | 44,951 / 7,095 / 1,230 | 80 m | 18.0 m | 5.3 MB |
| gunpowder-town-big-b-japan.glb | grey temple, keep, shrine, bastion | 39,862 / 6,512 / 1,158 | 80 m | 16.1 m | 4.9 MB |

Every file passes `validate_model.py` (`*.validation.json` here). The height spec given to the
validator is the model's own measured height: the landmarks were scaled to fit the layouts (below),
so the sheets' 21 m and 16 m are not the targets. Previews: `*-concept-vs-model.png` (the street
sheet, the barbican, the temple and the keep beside the towns).

## Decisions
- Houses swap the base layout's builders, not its spots. Every spot (about 6 x 5.5 m) gets one of
  three houses picked by plan area and the town seed (poor under about 30 m2 or 25% of draws,
  rich over about 50 m2 or 20%):
  - poor: a white plaster cottage on a grey brick dado with timber corner posts, a grey tiled
    gable with upturned ridge ends, a plank door and lattice window, a yard beside it behind a
    plaster wall and timber fence with jars, a rack, sometimes a team-grey lean-to awning;
  - common: a courtyard house: a hall with dark lattice posts and panels under a hip roof with
    upturned corners across the back, one gabled side wing with plaster gable ends, a grey brick
    front wall with a small roofed gate, a court tree or jars;
  - rich: the siheyuan: the same hall, wings down both sides, a plastered front wall on a brick
    footing, a gatehouse with red lacquer posts and doors, team-grey hangings and steps, two trees.
  The sheets' houses are 14 to 24 m across; on 6 m spots they are compressed to their parts (hall,
  wings, wall, gate) rather than their size.
- Landmark 1, the barbican, replaces every town hall: a battered grey brick bastion on a D plan
  (round to the front), a paved platform, merlons, a projecting gate block with an arched passage
  and plank doors, two team banners on timber arms on the front, a double-eave gate tower with red
  posts, lattice, a railing and painted bracket bands, timber stairs up the back and team-grey
  awning pavilions on the back corners. Width is the hall's spot x 1.3 (1.0 to 2.2 units), depth
  0.72 of that, height 0.75 of the width (the sheet's 21/28), walls 9/21 of the height. So the
  big towns' barbican is about 18 m across and 14 m tall, not 28 m and 21 m: at full size it does
  not fit the hall's corner of an 80 m town.
- Landmark 2, the temple, replaces the churches: a white stone terrace on a stone footing with
  balustrades, three flights of stairs and four bronze urns, the red hall with posts all round,
  lattice doors and two team hangings under a double-eave yellow glazed hip roof with painted
  brackets, corner pavilions under yellow pyramids joined by short galleries (from 12.5 m wide).
  Width 1.45 x the church's length (1.0 to 2.0 units), height 0.6 of the width; the sheet's 38 m
  by 16 m is too wide for the church spots.
- Windmills become the temple without pavilions (a yellow-roof shrine, about 7 m), the big
  towns' bastions stay. Small-a gets the temple on its north-east house spot, small-b the
  barbican on its north house spot, so every Sinic town shows both landmarks.
- Street pieces: wells get grey tile roofs, iron lamps become red paper lanterns on posts,
  barrels dark glazed jars, the cobbles grey stone paving (`sng_paving`, a pale `_square`).
  Stalls, gardens, trees and rail fences stay.
- Japan (`-japan`): the keep replaces the town hall (and takes small-b's north spot): a battered
  fitted-granite base 6/21 of the height with a roofed gate and steps, five white plaster tiers
  shrinking upward with a dark boarded band on the first, barred slit windows on every face,
  grey tile eaves with upturned corners, triangular chidori gables on the lower roofs, a balcony
  on the top tier, gold ridge fish. Base 1.05 x the hall's larger side (up to 16 m), height at the
  sheet's 21/18 ratio. The temple stays but grey-tiled; the shrine too. Houses are Edo ones (no
  sheet exists for them): two-storey machiya (dark lattice ground floor, team-grey noren, a tiled
  pent roof, a low plaster upper storey with barred windows, a gable to the street), one-storey
  board row houses with two doors and noren, and plaster-walled houses with a roofed gate, a hip
  roof and a pine. Lamps are stone lanterns; the ground is packed earth (`sng_earth`).

## What does not match the sheets
- Landmark sizes, as above (scaled to the layouts' spots, proportions kept).
- Roof tiles are a procedural course pattern, not modelled round tiles; ridge dragons are plain
  upturned blocks; the painted brackets are a blue-green band.
- The barbican's plan is a half ellipse on a straight back; the sheet's back stair wings are two
  timber ramps.
- The keep's tiers are boxes and its eaves still read heavier than the sheet's; the plaster walls
  were raised and the eaves made shallower after the first preview to show more white. No
  boarded oriel windows on the first tier.

## For the lead
- New sub-style: `japan` (the Japan region's Gunpowder towns use `gunpowder-town-<size>-<v>-japan.glb`).
  China, Taiwan, Hong Kong, Macau and the Koreas use `-sinic`.
- No shared file (palaces, walls) was in this brief.
