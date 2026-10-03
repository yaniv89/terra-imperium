# Kingdoms Age towns (variants a and b), palaces, wall rings, the colony camp and fields

Date: 2026-10-03. Sources: GPT's combined 1254 px concept sheets, filed under
`plans/art/towns/kingdoms/<id>/reference-sheet.png` with their batch READMEs. Built in Blender 4.2
(`bpy` module) on the shared kit (`ti_map.py`, `ti_town.py`, `ti_bronze.py`, `ti_classical.py`)
plus `ti_kingdoms.py`, which now holds the whole Kingdoms kit; one 2048 WebP atlas set per file.
Builders: `build_town_kingdoms_<size>_<variant>.py`, `build_shared_kingdoms.py`.

| Object | File | Tradition / contents | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|---|
| town-small-b | kingdoms-town-small-b.glb | Abbasid / Andalusian: small mosque (white dome, 10 m square minaret) NE, courtyard houses, tiled roofs, pergola, team awnings, well, palms | 13,385 / 2,169 / 432 | 40 m | 10 m | 2.4 MB |
| town-medium-a | kingdoms-town-medium-a.glb | European: gothic church with 18 m spire NW, jettied hall NE, 21 half-timbered houses (slate, thatch), 4 team-grey stalls, well, gardens | 24,001 / 5,749 / 638 | 60 m | 18 m | 4.1 MB |
| town-medium-b | kingdoms-town-medium-b.glb | Abbasid / Andalusian: mosque with 18 m minaret NW, 5 stalls, packed flat-roofed and courtyard houses, two arcaded market halls under tiled hip roofs SE | 26,640 / 3,382 / 714 | 60 m | 18 m | 3.5 MB |
| town-big-a | kingdoms-town-big-a.glb | European: aisled church with transept and 28 m spire NW, 20 m keep NE, round corner towers SW/SE, about 50 half-timbered houses, stalls, gardens | 50,453 / 7,300 / 1,026 | 80 m | 28 m | 6.3 MB |
| town-big-b | kingdoms-town-big-b.glb | Abbasid / Andalusian: great mosque (dome, side domes, 28 m minaret) NW, caravanserai round an arcaded court NE, 18 m stone tower SW, 8 stalls, some 45 packed houses | 44,041 / 5,485 / 1,204 | 80 m | 28 m | 5.0 MB |
| palace-small | shared-kingdoms.glb | motte: turf mound, log palisade, plank keep, shingle roof, stair, team pennant | 2,343 / 522 / 100 | 11.9 m | 10.2 m | |
| palace | shared-kingdoms.glb | stone keep, four corner towers, merlons, corbels, gothic windows, stair, 2 team banners, pennant | 2,958 / 374 / 68 | 12.4 m | 13 m (merlons), 15.9 m (flag) | |
| walls-small | shared-kingdoms.glb | stone ring, 4 round towers with slate cones, 2 gate towers, arched gate | 4,907 / 1,235 / 252 | 49 m | 14.4 m | |
| walls-medium | shared-kingdoms.glb | stone ring, 5 round towers, bannered gatehouse, portcullis, stair | 6,421 / 1,549 / 336 | 71 m | 19.7 m | |
| walls-big | shared-kingdoms.glb | stone ring, 7 round towers, bannered gatehouse, portcullis, 2 stairs | 7,711 / 1,653 / 372 | 93 m | 24.6 m | |
| colony-camp | shared-kingdoms.glb | thatched half-timbered hut, two tents, fire ring, supplies, stakes, flag | 4,134 / 1,886 / 412 | 20 x 18 m | 5.4 m | |
| field-1 to field-4 | shared-kingdoms.glb | rye, apple orchard, pasture with wattle fence and trough, flax | at most 3,456 / 1,040 / 240 | 15 to 17 m | to 2.8 m | 5.5 MB (all ten) |

Every file passes `validate_model.py` (`*.validation.json` here and beside the GLBs): budgets,
Town / Ground (alpha-cut) / Team materials, one atlas set, nothing below ground. The shared
file's spec numbers are the measured sizes (towers, footing fringe and flags make walls and
palaces a little wider and taller than the sheets' bare numbers).
`kingdoms-*-concept-vs-model.png`: the sheet's beauty panel beside the model (walls-small, the
camp and fields from the 1024 test build, the rest from the final files).

## Decisions
- Variant a (European) keeps the small-a kit (`tudor_house`, `timber_frame`, `church` untouched,
  so `kingdoms-town-small-a.glb` needs no rebuild) and adds `town_house` (jettied upper storey,
  gable or eaves to the street, dormers, signs), `cathedral`, `keep_tower`, `round_tower`.
- Variant b (Abbasid / Andalusian) is new: `flat_house`, `court_house`, `mosque`, `minaret`,
  `arcade` (real horseshoe arch pieces, not painted), `arcade_hall`, `caravanserai`,
  `screen_box` (mashrabiya), `palm`, `fountain`. Walls cream (`kg_whitewash`) or ochre
  (`kg_ochre`), terracotta from the Classical `tile`, sandy cobbles (`kg_sand`).
- The b towns are packed with `cluster` (medium-b): plots of 0.6 to 0.95 units filled with a
  flat house or, on big square plots, a courtyard house. The sheets' cities are dense.
- LOD2 of every building is one bottomless box or gable prism (`lod2_block`, 10 to 14 triangles)
  so 50 houses stay inside 1,500; big-town houses keep only blocks and roofs at LOD1.
- Streets are single mitred strips; overlapping coplanar ground pieces bake dark (AO), so the
  ring lanes round the squares were left out and crossing paths are cut into pieces.
- Ring walls use `kg_ringstone`, a brick bond on (arc length, z): the (x + y, z) bond of
  `mat_mudwall` smears into horizontal bands on a curved wall.
- Palaces: the brief's 8 m / 12 m footprints won over the sheets' 18 m. palace-small is 11 m
  across (the motte needs its slopes, and it still fits the 12 m free centre) and 10 m to the
  flag; the stone keep is 12 m across with its height scaled to keep the sheet's square look
  (13 m to the merlons instead of 21 m).
- Walls follow the sheets' diameters and tower counts (the medium plan shows 5 towers plus
  the gate pair although its label says 6), heights raised 1.3x.
- Kept from the shared kit: the Bronze camp layout (with a half-timbered hut), canal, crop beds
  and fences; new Ground families `kg_soil` (tilled earth) and `kg_meadow` (grass).

## Not matched
- Procedural materials: walls and roofs read cleaner than the painted sheets; the shingles are
  plain stripes and the stone towers carry the (x + y) bond.
- The b houses are simpler boxes than the sheets' (fewer balconies, steps and roof clutter).
- The motte and round towers are flat shaded (the pipeline exports no smooth normals).
