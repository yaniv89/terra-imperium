# Classical Age towns in the Levant kit (art spec 3b), built in Blender

Date: 2026-10-04. Sources: `plans/art/kits/levant/classical/` (street, roofscape, materials,
landmark-1 Apadana with bull capitals, landmark-2 Petra-style rock-cut tomb; there is no
houses.png, so the three house types come from the street and roofscape sheets). Kit:
`scripts/blender/ti_levant_classical.py` (materials `lvc_*`; reuses ti_classical's cypress,
shrub and mat_paving, ti_town's jar, well and front_shade, ti_bronze's stall, all unchanged).
Towns: `scripts/blender/build_town_classical_levant_<size>_<v>.py` on the layouts of
`build_town_classical_<size>_<v>.py` (the same house spots, sizes, yaws, free centre, ground).
Files: `classical-town-<size>-<v>-levant.glb`; the object inside keeps the base name.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| classical-town-small-a-levant | 22,726 / 4,092 / 550 | 41 m | 9.3 m | 3.3 MB | passed |
| classical-town-small-b-levant | 19,260 / 4,046 / 670 | 41 m | 8.4 m | 3.2 MB | passed |
| classical-town-medium-a-levant | 50,970 / 9,272 / 922 | 61 m | 13.5 m | 6.2 MB | passed |
| classical-town-medium-b-levant | 44,804 / 8,528 / 994 | 61 m | 13.0 m | 5.7 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500; one 2048 WebP atlas set per file. Previews:
`<size>-<v>-levant-concept-vs-model.png` (the street sheet beside the model) and `-top.png`.

## What stands where
- small-a: the Apadana (7 x 5.6 m, 9 m, six bull-capital columns) in the base temple's spot at
  the north-west, facing south; the rich residence at the north-east, courtyard houses and a
  cottage down the west, a cottage and a courtyard house on the east, the well on its cobble ring.
- small-b: the rock-cut tomb (7.4 x 5.6 m cliff, 7.8 m) in the base pavilion's north-east corner,
  facing south; a rich residence and a courtyard house along the north, courtyard houses and
  cottages each side behind limestone yard walls (the base's court walls).
- medium-a: the Apadana (10 x 7.8 m, 12.5 m) in the temple's place at the north-west; the rock
  tomb (cliff 17 m long, 13 m high, carved front 11 m) along the east edge in place of the stoa,
  facing west over the market stalls; rich residences on the north row, south row and inner ring.
- medium-b: the rock tomb in the drum tower's north-east corner (cliff 13 m, 12.5 m high); the
  Apadana (11.5 m) at the south-west where the base town has its market, facing east; the six
  stalls become three along the south. The west court wall starts 3 m further north to clear
  the Apadana's stair.

## Decisions
- House types: poor = the cottage (sheet 8 x 8 m, 3 m): buff stone plaster, a flat earthen roof
  behind a parapet with corner piers and cedar beam ends, a plank door under a reed-mat awning on
  cedar posts, a low yard wall at a front corner, jars and pots; some carry a team-cloth stall
  awning. common = the courtyard house (10 x 10 m, 4.5 m): rooms in a ring round an open court
  with an olive tree and potted plants, buff ashlar below and cream gypsum plaster above (the
  materials sheet's two-tone wall), a projecting porch with two rose sandstone columns, a grey
  cloth half over the court, a team-cloth awning beside the porch. rich = the two-storey residence
  (12 x 10 m, 8 m): pale limestone, a four-column porch up two steps carrying a balcony with a
  balustrade, two rows of windows, the upper storey over the front and a roof terrace behind with
  a canvas awning on poles and pots (terrace=False on shallow plots gives a full upper storey),
  cypresses at the back corners. Kinds follow the plot sizes as in the Europe towns.
- Flat roofs: the earthen roof slab, a cornice, a parapet and cedar beam ends under the cornice
  on the front (the materials sheet's beam joint). Courts stay open: every slab and band over a
  court is a ring of four boxes; at LOD2 the courtyard house is one block.
- Apadana: podium with a relief band (procedural deep-cavity material), a central stair of nine
  steps between carved cheek walls with sloping copings, a porch of six fluted columns plus the
  second row's end columns, double bull capitals (bell, block, two bull foreparts with horns
  facing sideways), a cedar architrave with beam ends, a cornice and a crown of stepped Persian
  merlons (a plain band at LOD1 and LOD2), a plaster hall with pilasters and a tall door.
- Rock tomb: a cliff of jittered rock blocks (back mass, two wings, a cap over the niche; plain
  boxes at LOD1 and LOD2) with the carved front in its niche: six columns, entablature and
  pediment, a dark doorway up three steps, two statue panels; above, the tholos with columns,
  conical roof and urn between two half pavilions with broken pediments; scree at the foot.
- Ground: grey-beige cobbles (`lvc_paving`, 6 x 5 m cells with low-contrast joints; finer cells
  striped at the game zoom), streets and the well's ring a lighter beige. Trees: olives (grey-
  green lumped crowns), cypresses and date palms.
- Landmark sizes: the sheets give 18 m (Apadana) and 20 m (tomb); they are fitted to the base
  landmark spots (9 m in small towns, 11.5 to 13 m in medium ones), as the Europe kit did.

## Not matched
- The sheets are much greener: vines on walls, dozens of potted plants per house and planters
  along every wall. Kept to a few pots, shrubs and trees per house to hold the atlas and budget.
- Relief friezes (animals, rosettes) on the Apadana podium and the tomb's carved statues are only
  procedural texture and plain panels; the bull heads read as shapes only at close zoom.
- Window grilles, door studs, the cobble pattern of the well ring and the dusty earth edges of
  the sheet are procedural or left out; the plot curbs and stepped plot platforms of the street
  sheet are not drawn (the base layouts pack plots too tightly).
- Rich houses on south and east plots face the centre as in the base layout, so from the game
  camera some show their plain backs.
- medium-b's Apadana faces east into the town, so the game camera (from the south) sees its
  side with the end columns, not the six-column front.
- Validation heights are the measured model heights (the tallest landmark), not sheet values.
