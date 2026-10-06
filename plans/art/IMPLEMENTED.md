# Art in the game: the running count

Every item by name, one by one: `plans/art/ITEMS.md`. Counted from the model files in the game (`src/assets/map/towns/*.glb`, `src/assets/map/shared/*.glb`)
on 2026-10-04 (updated after checkpoint 01; sections 4, 5, 8 and the Israelite row updated 2026-10-06 after the blender-remaining checkpoints 02 to 13), in the item ids of `plans/art-image-spec.md`. One item = one id in the spec (an id
with variants a and b counts once). Give this file to GPT with each batch so its count matches.

## Totals

| Section of the spec | In the spec | In the game | Left |
|---|---|---|---|
| 3. Base towns and their parts (13 ids per age x 5 ages) | 65 | 64 | 1 |
| 3b. Regional kits (6 items per region and age: houses, street, roofscape, materials, landmark-1, landmark-2; 11 regions x 5 ages) | 330 | 330 | 0 |
| 3b. Sub-landmarks (extra regional variants) | 7 | 7 | 0 |
| 3b.5 Kingdoms palaces and walls per region (palace-small, palace, walls-medium x 11) | 33 | 33 | 0 |
| 4. Buildings | 34 | 25 | 9 |
| 5. Wonders (3 tiers each) | 15 | 15 | 0 |
| 6. Tile improvements (sheets) | 19 | 0 | 19 |
| 7. Units, settlers and ships | 45 | 0 | 45 |
| 8. Icons | 130 | 129 | 1 |
| **Spec total** | **678** | **603** | **75** |
| Israelite theme (`plans/art/israelite-theme.md`) | 74 | 63 | 11 |
| **With the Israelite theme** | **752** | **666** | **86** |

The battles run on 21 placeholder unit models built from free CC0 packs; they are not the spec's
units and are not counted.

## 3. Base towns (62 of 65)

| Age | town-small | town-medium | town-big | palace-small | palace | walls-small | walls-medium | walls-big | colony-camp | field-1..4 |
|---|---|---|---|---|---|---|---|---|---|---|
| bronze | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| classical | yes | yes | **no** | **no** | **no** | yes | yes | yes | yes | yes (4) |
| kingdoms | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| gunpowder | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| modern | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |

Missing: classical `town-big` (a and b), classical `palace-small`, classical `palace`. Because the
base classical big layout is missing, the Classical big towns of Europe, Levant, Sinic and Indic
are not built either (their kits are complete; they show the medium town until it exists).

## 3b. Regional kits (306 of 330: 51 of 55 region and age kits)

A kit counts as in the game when its towns are built from it (its houses, street, roofscape,
materials and both landmarks).

| Region | bronze | classical | kingdoms | gunpowder | modern | Kits |
|---|---|---|---|---|---|---|
| europe | yes | yes | yes | yes | **no** | 4 |
| levant | **no** | yes | yes | yes | yes | 4 |
| nile | yes | yes | yes | yes | yes | 5 |
| maghreb | yes | yes | yes | yes | yes | 5 |
| westafrica | yes | yes | yes | yes | yes | 5 |
| eastafrica | yes | yes | yes | yes | yes | 5 |
| steppe | yes | yes | yes | yes | yes | 5 |
| indic | yes | yes | yes | **no** | **no** | 3 |
| sinic | yes | yes | yes | yes | yes | 5 |
| monsoon | yes | yes | yes | yes | yes | 5 |
| americas | yes | yes | yes | yes | yes | 5 |
| **Total** | 10 | 11 | 11 | 10 | 9 | **51** |

The 4 missing kits (24 items) and what is still needed for each:
- `europe/modern`: all six items (landmarks: office tower, railway station with an iron shed).
- `levant/bronze`: all six items (ziggurat with a triple stair, gate with glazed brick lions). Low priority: the base Bronze town is already Mesopotamian.
- `indic/gunpowder`: houses and materials delivered; still needed: street, roofscape, landmark-1 (Mughal gateway), landmark-2 (Rajput palace).
- `indic/modern`: the early prototypes must be redone under `plans/art/blender-delivery-spec.md`: all six items.

## 3b. Sub-landmarks (7 of 7)

`landmark-japan` (kingdoms, gunpowder), `landmark-korea` (kingdoms), `landmark-east` (Eastern
Europe, kingdoms), `landmark-north` (Northern Europe, classical), `landmark-colonies` (gunpowder),
`landmark-pacific` (the marae, bronze).

## 3b.5 Kingdoms palaces and walls (33 of 33)

`palace-small`, `palace` and `walls-medium` for all 11 regions: europe, levant, nile, maghreb,
westafrica, eastafrica, steppe, indic, sinic, monsoon, americas.

## Israelite theme (14 of 74)

In the game (Bronze): the kit (houses, street, roofscape, materials, the six-chamber gate, the
pillared storehouse), palace-small, palace, walls-medium, colony-camp and field-1 to field-4.
Delivered and being built: the Classical kit, Classical palaces and walls, the 10 buildings and
the 2 wonders (checkpoint 02). The full list is in `plans/art/ITEMS.md`.

## Added 2026-10-06

- **Section 4 buildings (25 of 34)** in `src/assets/map/buildings/<id>.glb`: granary, irrigation,
  farm_estate, crop_rotation_farm, mechanized_farm, market, bazaar, bank, stock_exchange,
  barracks, drill_yard, military_academy, war_college, library, scriptorium, university,
  research_lab, workshop, manufactory, factory, shrine, temple, civic_center, harbor, shipyard.
  Missing: cathedral, naval_base, carrier_dock, road_post, highway, rail_depot, iron_foundry,
  oil_well, copper_mine (base).
- **Section 5 wonders (15 of 15)** in `src/assets/map/wonders/<id>.glb`, tiers 1 to 3.
- **Section 8 icons (129 of 130)** in `src/assets/icons/<group>/`: ages 5, buildings 33, cities 15,
  improvements 11, markers 4, resources 35, ships 4, units 7, wonders 15. Five resource icons are
  the redesign pilot versions (horses, timber, gems, stone, copper).
- **Israelite (41 of 74)**: the Bronze set (14), the Classical kit (6), Classical palace-small,
  palace and walls-medium (3), the 10 buildings, Solomon's Temple and Masada (2), and 6 tile
  improvements (farm, plantation, pasture, fishing boats, fort Bronze, fort Modern).
- Section 6 tile improvements: none of the base sheets yet (the Israelite set above is regional).
- **Regional kits complete (330 of 330)**: Europe Modern, Levant Bronze, Indic Gunpowder and
  Indic Modern added; every region has all five ages.
- **Base Classical palace-small and palace** added (base towns 64 of 65; only Classical
  town-big is left).
- **Israelite (63 of 74)**: plus the Kingdoms, Gunpowder and Modern kits (18), Kingdoms
  palace-small and palace, Gunpowder walls-medium and the Modern colony camp; every Israelite
  town rebuilt lighter from the corrected deliveries.

## Not started (as of 2026-10-04; see "Added 2026-10-06" above)

Section 4 buildings (34), section 5 wonders (15, three tiers each), section 6 tile improvements
(19 sheets), section 7 units, settlers and ships (45), section 8 icons (130).
(The spec's own estimates said 20, 41 and 133; the counts here are from its tables.)
