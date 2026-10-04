# Kingdoms Age towns in the Europe kit (art spec 3b), built in Blender

Date: 2026-10-03/04. Sources: `plans/art/kits/europe/kingdoms/` (houses, street, roofscape,
materials, landmark-1 Gothic church, landmark-2 stone keep, landmark-east onion-domed church,
palace-small, palace, walls-medium; no READMEs came with these). Kit:
`scripts/blender/ti_europe_kingdoms.py` (materials `ek_*`; uses ti_kingdoms.py's street, trees,
gardens, market stalls, lod2_block, round_tower and stone_ring, and ti_classical.py's gable_roof,
all unchanged). Towns: `build_town_kingdoms_europe_<size>_<v>.py` hold the base town's calls
(recorded from `build_town_kingdoms_<size>_<v>.py` by replaying its random draws: positions,
sizes, yaws, streets, trees, stalls, the ground) and `ek.replay` builds each with this kit;
`build_town_kingdoms_easteurope_<size>_<v>.py` builds the same town with the onion-domed church.
Shared: `build_shared_kingdoms_europe.py`. Objects keep the base names (`town-<size>-<v>`,
`palace-small`, `palace`, `walls-medium`).

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| kingdoms-town-small-a-europe | 9,780 / 2,628 / 662 | 41 m | 15.9 m | 2.8 MB | passed |
| kingdoms-town-small-b-europe | 14,798 / 2,840 / 358 | 41 m | 13.5 m | 3.3 MB | passed |
| kingdoms-town-medium-a-europe | 22,942 / 4,058 / 680 | 61 m | 19.9 m | 3.9 MB | passed |
| kingdoms-town-medium-b-europe | 26,212 / 4,828 / 704 | 61 m | 19.9 m | 4.2 MB | passed |
| kingdoms-town-big-a-europe | 47,504 / 7,668 / 1,054 | 81 m | 23.9 m | 6.2 MB | passed |
| kingdoms-town-big-b-europe | 37,554 / 6,276 / 802 | 81 m | 23.9 m | 5.3 MB | passed |
| kingdoms-town-small-a-easteurope | 10,950 / 3,310 / 622 | 41 m | 15.0 m | 2.9 MB | passed |
| kingdoms-town-small-b-easteurope | 15,694 / 3,400 / 374 | 41 m | 15.0 m | 3.4 MB | passed |
| kingdoms-town-medium-a-easteurope | 24,112 / 4,740 / 640 | 61 m | 18.8 m | 4.0 MB | passed |
| kingdoms-town-medium-b-easteurope | 27,382 / 5,510 / 664 | 61 m | 18.8 m | 4.3 MB | passed |
| kingdoms-town-big-a-easteurope | 48,674 / 8,350 / 1,014 | 81 m | 22.6 m | 6.2 MB | passed |
| kingdoms-town-big-b-easteurope | 38,724 / 6,958 / 762 | 81 m | 22.6 m | 5.4 MB | passed |
| palace-small (shared-kingdoms-europe) | 1,666 / 342 / 82 | 11 x 9 m | 12.8 m (pennant) | | passed |
| palace (shared-kingdoms-europe) | 3,573 / 681 / 322 | 13 x 12 m | 19.3 m (pennants) | | passed |
| walls-medium (shared-kingdoms-europe) | 6,945 / 1,645 / 372 | 69 m | 18.7 m (gate banners) | 3.2 MB (all three) | passed |

Budgets: town 60,000 / 10,000 / 1,500; palace 15,000 / 3,000 / 500; wall ring 12,000 / 2,500 /
400. One 2048 WebP atlas set per file. Previews: `<size>-<v>-europe-*` and
`<size>-<v>-easteurope-*` (the street sheet beside the model, and from above),
`palace-small-`, `palace-`, `walls-medium-concept-vs-model.png`.

## What stands where
- small-a: the Gothic church (16 m spire at small scale) in the base church's spot.
- small-b: the stone keep in the base landmark's spot (east: the onion church there instead, as
  a small town has one landmark).
- medium-a: the Gothic church in the base church's spot, the keep in the base hall's spot.
- medium-b: the church in the base mosque's spot, the keep in the big market hall's, a
  half-timbered market hall in the other hall's.
- big-a: the church (24 m) and the keep in the base cathedral's and keep's spots; the base's two
  round corner towers kept.
- big-b: the church in the mosque's spot, the keep in the caravanserai's, a round tower in the
  stone tower's.

## Decisions
- House types follow the sheet: poor = the 4 x 6 m ochre daub cottage in an oak frame on a rubble
  footing, slate gable (gable to the street when narrow), stone chimney; common = the 6 x 10 m town
  house, a grey stone ground floor, a jettied half-timbered cream upper floor on joist ends, a
  steep slate gable, chimney, team-cloth awning where the base had one; rich = the merchant house:
  stone ground floor, jettied frame, a cross gable over a bay window, dormer, two chimneys, and a
  stone-walled yard with a shed and a tree on wide plots. Type by the base plot's size and storeys
  (court houses of the base b towns become rich houses). All roofs slate (the sheets show no
  thatch); the base towns' thatched houses were changed to slate.
- Variant b's base layouts are Andalusian (courtyard houses, mosque, caravanserai); here they get
  the same European kit on the same plots, so a and b differ by layout, not by tradition.
- Ground: grey cobbles (`ek_cobble`) and lighter cobbled streets; cobble size raised so the
  pattern does not stripe at the game zoom.
- Landmarks at the sheets' heights, scaled to the town: Gothic church 16, 20 and 24 m to the
  cross (small, medium, big), the keep 12 to 18 m; the onion church 15, 19 and 23 m.
- The shared palace was built at 13 x 12 m (the sheet's 20 m does not fit the 14 m free centre)
  and walls-medium at 69 m outer, 64 m inner (the brief's 6.4 to 6.9 units).

## Not matched
- Leaded glass, ironwork and slate relief are procedural; the sheets' stepped Dutch gables and
  window boxes are not modelled.
- The street sheet's yard walls round every plot are only on the rich houses (the base layouts
  pack plots too tightly).
