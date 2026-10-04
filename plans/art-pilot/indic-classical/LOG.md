# Classical Age towns in the Indic kit (art spec 3b), built in Blender

Date: 2026-10-04. Region `indic` (India, Pakistan, Bangladesh, Sri Lanka, the Maldives), Classical
Age (Maurya and Gupta). Sources: `plans/art/kits/indic/classical/` (houses, street, roofscape,
materials, landmark-1 the Sanchi stupa, landmark-2 a rock-cut chaitya facade).
Kit: `scripts/blender/ti_indic_classical.py` (materials `inc_*`; it reuses ti_classical.py's
`gable_roof`, `mat_paving` and the `tile` / `tile_dark` materials unchanged). Towns:
`scripts/blender/build_town_classical_indic_<size>_<v>.py` on the layouts of
`build_town_classical_<size>_<v>.py` (the same house spots, sizes, yaws, free centre and ground
size). Files: `src/assets/map/towns/classical-town-<size>-<v>-indic.glb`; the object inside keeps
the base name `town-<size>-<v>`.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| classical-town-small-a-indic | 17,874 / 5,012 / 814 | 41 m | 9.3 m | 3.5 MB | passed |
| classical-town-small-b-indic | 16,502 / 4,120 / 756 | 41 m | 9.3 m | 3.3 MB | passed |
| classical-town-medium-a-indic | 38,724 / 9,504 / 1,250 | 61 m | 16.2 m | 5.4 MB | passed |
| classical-town-medium-b-indic | 34,152 / 7,694 / 1,288 | 61 m | 9.3 m | 4.7 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500; one 2048 WebP atlas set per file. Previews:
`<size>-<v>-indic-concept-vs-model.png` (the street sheet beside the model), `-top.png`, and the
kit parts against their sheets: `stupa-`, `chaitya-`, `house-poor-`, `house-common-`,
`house-rich-concept-vs-model.png`.

## What stands where
- small-a: the stupa (railing 9.6 m across, 7 m to the chattra) in the base temple's spot at the
  north-west, palms and mango trees round it; a haveli at the north-east, a cottage beside it,
  town houses down the west and east, a thatched cottage at the south-west, a wayside shrine and
  the well at the south-east.
- small-b: a small chaitya facade (6.6 m wide, about 7 m high) cut into a basalt outcrop in the
  base pavilion's north-east corner; red-brick compound walls with plastered copings in place of
  the cream court walls; a haveli and a town house on the north row, town houses and cottages
  behind the inner walls each side.
- medium-a: the stupa (13.6 m across, 9.5 m) at the north-west; the chaitya (facade 15 m wide,
  15 m high, cliff 19 m long) along the east edge in place of the stoa, the market stalls before
  it; havelis on the north row, the forum ring and the south-west (with a forecourt).
- medium-b: the stupa (11 m across, 7.7 m) in the drum tower's north-east corner; brick compound
  walls; two havelis on the north row (the big one with a forecourt and palms), the market at the
  south-west.

## Decisions
- House types follow the sheet. Poor: a one-room cottage of lime plaster over a red-brick base on
  a sandstone plinth, a terracotta gable with its eaves to the street (a third are thatched hips,
  as on the street sheet's bottom row), a door up a step under a team-cloth shade, a jali window,
  a bamboo lean-to with a sloping mat roof, an earth yard behind a bamboo fence with a gate, pots,
  a charpai, a banana plant or a small mango. Common: two storeys, a timber belt at the floor line,
  a tiled hip roof round a small court with a tree, a carved balcony (jharokha) with a jali rail
  under a front gable with a finial, a team-cloth awning on posts, brick planters at the steps.
  Rich (haveli): two storeys round a court with a lotus pool, a carved timber verandah and a
  gallery above hung with three team-cloth shades, a pavilion storey under its own hip at the
  back, a flat terrace wing with a balustrade and a chhatri (plots 8 m wide or more), and a walled
  forecourt with a stepped gate, potted plants and palms where the plot is deep.
- The courtyard roof is the Europe kit's ring roof (copied into this module so the kit stands on
  its own); LOD2 swaps it for a plain hip.
- The stupa follows the sheet's proportions scaled by its railing diameter D: drum 0.2 D/2, dome
  0.8 D/2, harmika and three chattra discs to 1.4 D/2. The railing is posts, three crossbars and a
  coping in four arcs broken by the toranas (LOD1 one band per arc, LOD2 one plain ring). The
  toranas were first built at the full 0.86 D/2 and looked too tall next to the dome; they now
  stand at 0.7 D/2 with heavier beams, nearer the sheet.
- The chaitya is built in its own frame: a jittered, subdivided basalt mass with heaped boulders,
  rock jambs and an overhang round a facade recess; a flagged floor up three steps, eight pillars
  with pot bases and bell capitals before a dark hall with a small stupa, a carved rail, the
  horseshoe arch (window, eleven timber ribs, an inner timber ring, a double arch band, a finial),
  two frieze bands with rows of small kudu arches, pilasters, four guardian figures in niches and
  team-cloth awnings at the front corners. LOD2 keeps plain boxes for the rock.
- Ground: grey stone paving (`inc_paving`), the square and the streets a lighter grey. Trees are
  coconut palms, mango trees and banana plants (the sheets' few cypresses are left out).
- Heights: the haveli's roof pavilion is the tallest thing in small-a, small-b and medium-b (9.3 m;
  it was 10.5 m and taller than the small-town stupa, so it was lowered). The small towns' spots
  leave room for a stupa of about 10 m across only, so it stands at 7 m, not the sheet's 14 m; the
  medium towns' chaitya stands at 15 m of the sheet's 16 m.

## Not matched
- The sheet's sculpture (torana reliefs, elephant capitals, facade figures, the stupa's lens
  crossbars) is reduced to blocks with the carved-stone material's relief; jali screens and
  carved timber are procedural.
- The railing's L-shaped entrance returns behind each torana and the stupa's upper stair landing
  are left out.
- The haveli's chhatri is a tiled pyramid on four posts, not a small dome.
- Compound walls round every plot (street and roofscape sheets) are drawn only where the base
  layouts have court walls (small-b, medium-b) and round the havelis' forecourts; the base
  layouts pack the other plots too tightly.

## For the lead
- New region suffix `-indic` for the Classical towns; nothing else to wire. No shared file (the
  sheets give no palace or walls for this kit).
