# Art in the game: the running count

Every item by name, one by one: `plans/art/ITEMS.md`. Counted from the model files in the game (`src/assets/map/towns/*.glb`, `src/assets/map/shared/*.glb`)
on 2026-10-04 (updated after checkpoint 01; sections 4, 5, 8 and the Israelite row updated 2026-10-06 after the blender-remaining checkpoints 02 to 13), in the item ids of `plans/art-image-spec.md`. One item = one id in the spec (an id
with variants a and b counts once). Give this file to GPT with each batch so its count matches.

## Totals

| Section of the spec | In the spec | In the game | Left |
|---|---|---|---|
| 3. Base towns and their parts (13 ids per age x 5 ages) | 65 | 65 | 0 |
| 3b. Regional kits (6 items per region and age: houses, street, roofscape, materials, landmark-1, landmark-2; 11 regions x 5 ages) | 330 | 330 | 0 |
| 3b. Sub-landmarks (extra regional variants) | 7 | 7 | 0 |
| 3b.5 Kingdoms palaces and walls per region (palace-small, palace, walls-medium x 11) | 33 | 33 | 0 |
| 4. Buildings | 34 | 33 | 1 |
| 5. Wonders (3 tiers each) | 15 | 15 | 0 |
| 6. Tile improvements (sheets) | 19 | 13 | 6 |
| 7. Units, settlers and ships | 45 | 3 | 42 |
| 8. Icons | 130 | 129 | 1 |
| **Spec total** | **678** | **628** | **50** |
| Israelite theme (`plans/art/israelite-theme.md`) | 74 | 63 | 11 |
| **With the Israelite theme** | **752** | **691** | **61** |

The battles run on 21 placeholder unit models built from free CC0 packs; they are not the spec's
units and are not counted.

## 3. Base towns (65 of 65)

| Age | town-small | town-medium | town-big | palace-small | palace | walls-small | walls-medium | walls-big | colony-camp | field-1..4 |
|---|---|---|---|---|---|---|---|---|---|---|
| bronze | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| classical | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| kingdoms | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| gunpowder | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |
| modern | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes (4) |

Classical `town-big` (a and b) was imported on 2026-10-07 (see "Imported 2026-10-07"). The
Classical big towns of Europe, Levant, Sinic and Indic are still not assembled from their kits:
until they are, those lands show the base Classical big town.

## 3b. Regional kits (330 of 330: 55 of 55 region and age kits)

The table and the list below are the state of 2026-10-04; the four missing kits were added on
2026-10-06 (see "Added 2026-10-06").

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

## Israelite theme (14 of 74 on 2026-10-04; 63 of 74 now, see below)

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

## Checked 2026-10-07: the downloads folder is fully imported

`node scripts/art/downloads-coverage.mjs` (and its test in scripts/art) reads the file list of every
ZIP under `plans/art/downloads` and maps each delivered item to the file the game ships: 119 ZIPs,
564 items, every one in the game (kits as their towns, palaces and walls in the shared files,
buildings, wonders, improvements and icons by id; the two early prototypes, `indic-modern-five`
and `rajput-palace`, are superseded by the Indic Modern and Gunpowder kits). The ZIPs are no
longer the only copy of any art the game needs; they are the only copy of the editable sources
(.blend, the delivered model.glb, build.py), so keep them outside git before purging them.

The 25 items then marked `built_awaiting_validation_upload` were imported the same day from the
transfer archives in `plans/art/local-transfer-2026-10-07` (next section).

## Imported 2026-10-07: the 25 built items

Taken from the uncompressed GLBs in `plans/art/local-transfer-2026-10-07` (pending-20-part-1 to 4,
pending-cathedral-town, pending-ships), checked with `scripts/blender/validate_model.py` (all
pass), packed with `npm run pack:models`; `production-queue.json` status `in_game_quality_accepted`.
Close-view screenshots: `plans/art/shots/import-2026-10-07/`.

- **Section 4 buildings (8, now 33 of 34)**: cathedral (Gothic, `cathedral.glb`) and its mosque
  variant (`cathedral-levant.glb`: Levant, Israelite and Andalus land), naval_base, carrier_dock,
  road_post, highway, rail_depot, copper_mine, iron_foundry. Fixed on import: the eight battle
  socket empties (`socket-banner`, `socket-door`, `socket-fire-1` to `-4` ...) were dropped from
  each root, which must hold only LOD0 to LOD2, and the mosque's root was renamed `cathedral` (the
  bare id). Only oil_well is left.
- **Section 6 tile improvements (13 of 19)**: `<kind>-<age>.glb` for farm, mine and fishing_boats
  (bronze and modern), road (bronze and modern), pasture, camp, quarry, lumber_camp and plantation
  (bronze). Fixed on import: the Ground texels were brightened to the warm earth the land tint
  assumes (the rule of `import_improvement.py`, one gain for all channels: luminance about 0.25 up
  to 0.58), so the patches no longer read as dark discs on the land. A later age's base file beats
  an earlier regional one (a Modern Israelite farm is `farm-modern`). The road models are bundled
  but not drawn: roads are drawn as the road network, not as tile works.
- **Section 3 classical town-big a and b** (`classical-town-big-a.glb`, `-b.glb`); `townLayouts.json`
  rebuilt. Tone (Town / Team): a 0.47 / 0.29, b 0.24 / 0.25, a little darker than the Classical
  medium town (0.27 / 0.38). Their Ground has no alpha (a round patch with a hard edge), tinted
  to the land like every town ground.
- **Section 7 warships (3 of 45)**: `src/assets/map/ships/warship-bronze`, `-classical`, `-kingdoms`.
  Now drawn: a fleet in the close view shows one to three warships of its owner's age
  (`src/components/map/closeView/shipModels.js`; the latest age with a file, so gunpowder and
  modern fleets use the kingdoms ship until their own exist). The swell animation (morph targets)
  is not played: the hull stands at rest.

## Not started (as of 2026-10-04; see "Added 2026-10-06" above)

Section 4 buildings (34), section 5 wonders (15, three tiers each), section 6 tile improvements
(19 sheets), section 7 units, settlers and ships (45), section 8 icons (130).
(The spec's own estimates said 20, 41 and 133; the counts here are from its tables.)

## Added 2026-10-07: civic keeps and tundra (checkpoint 04 interim)

Base civic keep replaces the castle/cone placeholder in unfortified Bronze battles and non-palace city centers, with intact/damaged/ruined states. Capitals reuse the existing palace and avoid overlapping civic copies. Tundra color/AO detail supports an explicit terrain selector; campaign routing remains pending. See [checkpoint 04](downloads/wave1/checkpoint-04/README.md) for sources, validation, phone screenshots and the follow-up scope.
