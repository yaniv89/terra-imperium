# Classical Age towns in the Sinic kit (Han; art spec 3b), built in Blender

Date: 2026-10-04. Sources: `plans/art/kits/sinic/classical/` (houses, street, roofscape,
materials, landmark-1 double-eave gate tower, landmark-2 Han que watchtower). Kit:
`scripts/blender/ti_sinic_classical.py` (materials `snc_*`; it reuses ti_classical.py's
broadleaf, shrub, gable_roof and mat_paving unchanged). Towns:
`scripts/blender/build_town_classical_sinic_<size>_<v>.py` on the layouts of
`build_town_classical_<size>_<v>.py`. Files: `classical-town-<size>-<v>-sinic.glb` in
`/tmp/claude-0/out/sinic/`; the object inside keeps the base name `town-<size>-<v>`.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| classical-town-small-a-sinic | 14,122 / 4,742 / 806 | 40 m | 8.8 m | 2.9 MB | passed |
| classical-town-small-b-sinic | 11,840 / 3,554 / 824 | 40 m | 10.5 m | 2.6 MB | passed |
| classical-town-medium-a-sinic | 31,748 / 8,312 / 1,430 | 60 m | 16.6 m | 4.7 MB | passed |
| classical-town-medium-b-sinic | 28,142 / 7,520 / 1,366 | 60 m | 16.6 m | 4.3 MB | passed |

Previews: `<size>-<v>-sinic-concept-vs-model.png` (the street sheet beside the model) and
`-top.png`; the parts on their own (first test round, before the brick and tile were darkened):
`house-poor|common|rich-`, `gate-tower-` and `que-tower-concept-vs-model.png`.

## What stands where
- small-a: the gate tower (6.8 x 5 m base, 8 m) in the temple's spot; a walled residence at the
  north-east, courtyard houses and a cottage down the west, a stall and a well at the south-east.
- small-b: a que watchtower scaled to 10 m in the shrine pavilion's corner; a residence hall behind
  its gate and a courtyard house along the north, courtyard houses and cottages in walled yards.
- medium-a: the gate tower at full sheet height (12 x 8.6 m base, 12 m) at the north-west; a pair
  of que towers (16 m) flanking a gate in a courtyard wall where the stoa stood, the stalls before
  them; two shallow residences, courtyard houses, cottages.
- medium-b: a que tower (16 m) in the drum tower's place; a smaller gate tower (9 x 6 m, 10 m) set
  in the east courtyard wall, its passage opening onto the square. One inner-ring house moved
  from (1.25, -0.25) to (1.15, -0.6) and became a cottage to make room for it.

## Decisions
- House types: poor = the cottage (stone base, cream plaster between natural timber posts, a grey
  gable with its eaves to the street and upturned ridge ends, a door canopy, lattice windows, a
  fenced yard with jars, a rack and a team-cloth awning when the plot is wide); common = the
  courtyard house (grey brick dado, red-brown posts and beam, double door up two steps, a grey hip
  roof ringed round a planted court with upturned corners, as in the sheet's top view); rich = the
  walled residence (compound wall with grey-tiled coping, a gatehouse, the main hall, side halls,
  a paved court with trees); in a shallow plot only the hall behind the front wall and gate.
- Han roofs are written fresh in the kit (`han_roof`, `ring_solid`): ti_classical's hip_roof
  hard-codes a terracotta ridge, and the sheets want grey tile and dark grey ridges, hip ridges and
  ridge-end ornaments. The roof ring and the gate tower's lower eave drop to plain stand-ins at LOD2.
- The gate tower's passage is a real opening (battered piers, an arched brick block with a
  soffit, a stone voussoir ring); LOD2 closes it.
- Ground: tan stone slabs over packed earth (`snc_paving`), the square and streets grey stone.
- Some trees blossom pink/red (`snc_blossom`), as on the street sheet.

## Not matched
- Bracket sets (dougong), the lotus column bases and the tile-end discs on the wall copings are
  stepped boxes or left to the texture. The sheet's balcony brackets on the que are single struts.
- Small towns carry the landmarks scaled down (gate tower 8 m, que 10 m) to fit the base slots;
  the medium towns have them at the sheets' heights.
- The rich residence's full plan (14 x 18 m) does not fit the base plots (about 10 x 8 m), so it
  is compressed; the street sheet's grey-brick poor houses are plaster over a stone base here.
