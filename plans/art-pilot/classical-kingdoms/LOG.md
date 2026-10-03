# Classical Age towns, walls, camp and fields; the first Kingdoms village

Date: 2026-10-03. Sources: GPT's combined 1254 px concept sheets, filed under
`plans/art/towns/classical/<id>/reference-sheet.png` and
`plans/art/towns/kingdoms/town-small-a/reference-sheet.png` (their READMEs beside them). Built in
Blender 4.2 (`bpy` module) on the shared kit (`ti_map.py`, `ti_town.py`) plus the new
`ti_classical.py` and `ti_kingdoms.py`; one 2048 WebP atlas set per file, packed with the
repacking step described in `plans/art-pilot/bronze-towns/LOG.md`.

| Object | File | Tradition / contents | LOD0 / LOD1 / LOD2 | Footprint | Height |
|---|---|---|---|---|---|
| town-small-a | classical-town-small-a.glb | Roman: temple with four columns, cypresses, five houses, awnings, well | 5,390 / 1,946 / 768 | 40 m | 7 m (temple) |
| town-small-b | classical-town-small-b.glb | Han: two halls, a shrine pavilion, four houses in walled yards, well | 5,842 / 2,460 / 800 | 40 m | 7 m |
| town-medium-a | classical-town-medium-a.glb | Roman: hexastyle temple (12 m), stoa and market, 17 houses | 13,212 / 3,328 / 1,438 | 60 m | 12 m |
| town-medium-b | classical-town-medium-b.glb | Han: drum tower (12 m), halls and compounds, market, 15 houses | 12,824 / 4,682 / 1,348 | 60 m | 12 m |
| walls-small | shared-classical.glb | ashlar ring, four towers, gatehouse | 8,032 / 1,820 / 348 | 48 m | 8.8 m |
| walls-medium | shared-classical.glb | ashlar ring, four towers, bannered gatehouse | 10,586 / 2,158 / 348 | 69 m | 11 m |
| walls-big | shared-classical.glb | ashlar ring, seven towers, bannered gatehouse | 10,456 / 2,096 / 384 | 90 m | 15 m |
| colony-camp | shared-classical.glb | plastered tile-roofed hut, tents, fire ring, supplies, stakes, flag | 3,890 / 1,814 / 436 | 20 x 18 m | 5.2 m |
| field-1 to field-4 | shared-classical.glb | wheat, olives, pasture with stone trough, vineyard | at most 3,078 / 1,158 / 264 | 15 to 17 m | to 2.7 m |
| town-small-a | kingdoms-town-small-a.glb | European village: stone church with spire, six half-timbered houses (slate and thatch), well | 5,534 / 2,630 / 810 | 40 m | 10 m (spire) |

Every file passes `validate_model.py` (`*.validation.json` here): budgets, Town / Ground
(alpha-cut) / Team materials, one atlas set, nothing below ground. Files: 2.0 to 3.0 MB per town,
5.7 MB for shared-classical. `*-concept-vs-model.png`: the sheet's beauty panel beside the model.

## In the game
- `townAssets.js` picks the variant by age: in the Classical Age East Asia (China, Taiwan, the
  Koreas, Japan, Mongolia, mainland South-East Asia) builds the Han town (b), everyone else the
  Roman one (a); the Bronze Age keeps its Nile and Mesopotamia rule. The Kingdoms Age has only
  variant a so far, so every Kingdoms town of that size is the village.
- Classical towns get the age's walls, fields and outpost camp from `shared-classical.glb`.
  Classical capitals stand without a palace and big Classical towns stay procedural until
  those sheets arrive (next on GPT's list: town-big-a/b, palace-small, palace). Kingdoms towns
  have no shared file yet: no walls, fields or camp in that age.
- `ingame-*.png`: Cairo as a Classical Roman town with walls and fields, Beijing as a Han town,
  Paris as the Kingdoms village (a Dawn game with the ages set by hand).

## Decisions
- Same scale rules as the Bronze kit: houses raised 1.3x, landmarks at the sheets' heights.
  The small Roman town's two-storey house was lowered to one tall storey to keep the sheet's
  6 m house height under the temple.
- The medium sheets are dense; the first layouts left a 40 m empty forum, so an inner ring of
  houses and trees now closes round the 12 m free centre (the palace's place).
- Han roofs are hip roofs with deep eaves and corners turned up; Roman roofs pitched tile gables.
  Tile and slate are brick-bond materials on the slope, so the courses read at the super zoom.
- Classical walls reuse the Bronze wall-ring builder in ashlar with square towers and team
  banners hung on the gate towers; the camp reuses the Bronze camp with a plastered hut; the
  fields reuse the Bronze field builders (olive leaves and stone-ringed basins, a stone trough)
  plus a new vineyard.
