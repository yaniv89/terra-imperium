# Kingdoms Age towns in the Indic kit (art spec 3b), built in Blender

Date: 2026-10-04. Region `indic` (India, Pakistan, Bangladesh, Sri Lanka, the Maldives), Kingdoms
Age (Chola temples and the Delhi Sultanate). Sources: `plans/art/kits/indic/kingdoms/` (houses,
street, roofscape, materials, landmark-1 gopuram temple gate, landmark-2 Sultanate tomb,
palace-small, palace, walls-medium; no READMEs). Kit: `scripts/blender/ti_indic_kingdoms.py`
(materials `ink_*`; uses ti_kingdoms.py's palm, tree, street, market stalls, garden, stone_wall,
lod2_block, box_only, lathe2, banner_pointed and ti_classical.py's gable_roof, shrub and
mat_paving, all unchanged). Towns: `build_town_kingdoms_indic_<size>_<v>.py` hold the base town's
calls (copied from `build_town_kingdoms_europe_<size>_<v>.py`, the same recording the Levant kit
uses) and `ink.replay` builds each with this kit. Shared: `build_shared_kingdoms_indic.py`.
Objects keep the base names (`town-<size>-<v>`, `palace-small`, `palace`, `walls-medium`).

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| kingdoms-town-small-a-indic | 14,922 / 2,568 / 398 | 41 m | 17.3 m (gopuram) | 2.8 MB | passed |
| kingdoms-town-small-b-indic | 17,617 / 2,977 / 432 | 42 m | 12.0 m (haveli chhatris) | 3.2 MB | passed |
| kingdoms-town-medium-a-indic | 28,040 / 4,845 / 768 | 62 m | 21.4 m (gopuram) | 3.8 MB | passed |
| kingdoms-town-medium-b-indic | 33,637 / 5,721 / 794 | 61 m | 21.4 m (gopuram) | 4.3 MB | passed |
| kingdoms-town-big-a-indic | 56,174 / 9,726 / 1,274 | 82 m | 26.2 m (gopuram) | 6.5 MB | passed |
| kingdoms-town-big-b-indic | 47,751 / 7,836 / 918 | 82 m | 26.2 m (gopuram) | 5.6 MB | passed |
| palace-small (shared-kingdoms-indic) | 2,387 / 465 / 134 | 11 x 10 m (with steps) | 11.9 m (pennant) | | passed |
| palace (shared-kingdoms-indic) | 4,633 / 835 / 236 | 12 x 13 m (with steps) | 15.9 m (dome finial) | | passed |
| walls-medium (shared-kingdoms-indic) | 9,191 / 1,760 / 326 | 68 m | 13.9 m (gate chhatris) | 3.7 MB (all three) | passed |

Budgets: town 60,000 / 10,000 / 1,500; palace 15,000 / 3,000 / 500; wall ring 12,000 / 2,500 /
400. One 2048 WebP atlas set per file. Previews: `<size>-<v>-concept-vs-model.png` (the street
sheet beside the model) and `<size>-<v>-top.png`, `gopuram-`, `tomb-`, `palace-small-`,
`palace-`, `walls-medium-concept-vs-model.png`, `houses-model.png` (poor, common, rich side by
side). The landmark-alone previews come from a 1024 test build of the same code.

## What stands where
- small-a: the gopuram in the base church's spot.
- small-b: the Sultanate tomb in the base mosque's spot (a small town has one landmark).
- medium-a: the gopuram in the cathedral's spot, the tomb in the big house's.
- medium-b: the gopuram in the mosque's spot, the tomb in the big market hall's, a pillared
  market hall (mandapa) under a tiled hip roof in the other hall's.
- big-a: the gopuram and the tomb in the cathedral's and keep's spots; the base's two round
  corner towers become round battered bastions with chhatris.
- big-b: the gopuram in the mosque's spot, the tomb in the caravanserai's, a bastion in the
  stone tower's.
Landmark spots follow the Levant kit's overrides; base houses and trees a landmark covers are
left out.

## Decisions
- House types by plot size, as in the other kits. Poor: one storey of lime-washed red brick
  under a terracotta gable, a small tiled upper room on wider plots, a timber veranda, a low
  walled yard with a gate, a thatched lean-to, a grey cloth shade or a tree, jars. Common: lime
  plaster on a sandstone plinth, tiled hip roofs round a court (back range with a pillared porch,
  a two-storey corner tower room, a side wing), a front wall with a sandstone gateway up steps,
  a tree in a stone planter, a cloth shade; narrow plots get a closed block with a pillared porch
  and a tiled upper room. Rich (haveli): two storeys of sandstone round a court with a pool and
  palms, a tall cusped portal with a jharokha over it, jali balconies, grey awnings hung from the
  upper floor, two front corner towers with domed chhatris, balustraded roof, tiled hip roofs on
  the back range and side wings.
- Ground: sandy earth (`ink_earth`) with grey stone paving for the lanes and the square
  (`ink_earth_square`). Two of three trees are palms.
- Landmarks at the sheets' proportions scaled to the town: the gopuram at s 0.5 / 0.62 / 0.76 of
  the sheet (18 m wide, 33 m tall at s 1), so 17, 21 and 26 m; the tomb at 0.78 / 0.9 / 1.0 of
  the sheet (12 m square, 13 m to the finial).
- The gopuram: granite gateway storey with pilasters, door guardians and a team-cloth swag, low
  granite walls either side, seven receding ochre carved tiers with lime-plaster bands, a dark
  niche in a carved pavilion on each face, the barrel-vaulted crown with horned ends and seven
  bronze kalasha finials.
- The tomb: sandstone cube on a red sandstone plinth with front steps, red bands, pointed
  merlons, a red pishtaq round a pointed arch, jali windows, octagonal corner turrets with
  chhatris, an octagonal drum with jali arches and a lime-plastered dome with a bronze finial.
- palace-small built at 10 x 9 m (11 m with the steps) and palace at 11 x 11 m (12 x 13 with
  steps) so they fit the 12 to 14 m free centre; the palace's 24 m dome is scaled to 16 m.
- walls-medium: the sheet draws a rectangle with four round bastions; the game's wall rings are
  round, so it is built as a 68 m ring (brief: 6.4 to 6.9 units) with seven round battered
  bastions (chhatris on three), a red sandstone gate portal between two slim towers with
  chhatris and team banners, pointed merlons, red bands. Wall stone is a weathered pinkish
  grey (`ink_wallstone`) as on the sheet, the town buildings warmer buff sandstone.
- The kit has its own hip roof (`hip`) instead of ti_classical's hip_roof so the ridge tiles are
  LOD0 only; that and LOD1 cone stand-ins for the chhatri domes keep big-a's LOD1 under 10,000.

## Not matched
- The gopuram's hundreds of sculpted figures are boxes and a procedural carved texture; at map
  zoom it reads as an ochre stepped tower with white bands, not as figure sculpture.
- The street sheet's stone yard walls round every plot are only on the poor houses and the
  common houses' fronts (the base layouts pack plots tightly).
- Carved timber, bronze trim and jali are procedural or flat panels; cusped (multi-foil) arches
  are drawn as pointed arches.
- The palace's outer enclosure wall, its side stair towers and many roof kiosks are simplified
  to four ranges, four tiled corner towers, a gate block and the domed pavilion.

## For the lead
- New regional sub-style `indic` for the Kingdoms Age: towns `kingdoms-town-<size>-<v>-indic.glb`
  and `shared-kingdoms-indic.glb` (palace-small, palace, walls-medium) need wiring like the
  Europe and Levant kits. No edits to ti_map, ti_town, ti_bronze, ti_classical or ti_kingdoms.
