# Art in the game: the running count

Every item by name, one by one: `plans/art/ITEMS.md`. Counted from the model files in the game (`src/assets/map/towns/*.glb`, `src/assets/map/shared/*.glb`)
on 2026-10-04 (updated after checkpoint 01), in the item ids of `plans/art-image-spec.md`. One item = one id in the spec (an id
with variants a and b counts once). Give this file to GPT with each batch so its count matches.

## Totals

| Section of the spec | In the spec | In the game | Left |
|---|---|---|---|
| 3. Base towns and their parts (13 ids per age x 5 ages) | 65 | 62 | 3 |
| 3b. Regional kits (6 items per region and age: houses, street, roofscape, materials, landmark-1, landmark-2; 11 regions x 5 ages) | 330 | 306 | 24 |
| 3b. Sub-landmarks (extra regional variants) | 7 | 7 | 0 |
| 3b.5 Kingdoms palaces and walls per region (palace-small, palace, walls-medium x 11) | 33 | 33 | 0 |
| 4. Buildings | 34 | 0 | 34 |
| 5. Wonders (3 tiers each) | 15 | 0 | 15 |
| 6. Tile improvements (sheets) | 19 | 0 | 19 |
| 7. Units, settlers and ships | 45 | 0 | 45 |
| 8. Icons | 130 | 0 | 130 |
| **Spec total** | **678** | **408** | **270** |
| Israelite theme (`plans/art/israelite-theme.md`) | 74 | 14 | 60 |
| **With the Israelite theme** | **752** | **422** | **330** |

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

## Not started

Section 4 buildings (34), section 5 wonders (15, three tiers each), section 6 tile improvements
(19 sheets), section 7 units, settlers and ships (45), section 8 icons (130), and the Israelite
theme (74). (The spec's own estimates said 20, 41 and 133; the counts here are from its tables.)
