# Kingdoms Age, Levant kit (art spec 3b), built in Blender

Sources: `plans/art/kits/levant/kingdoms/` (houses, street, roofscape, materials, landmark-1 great
mosque with a spiral minaret, landmark-2 caravanserai gate, palace-small, palace, walls-medium).
Kit: `scripts/blender/ti_levant_kingdoms.py` (materials `lvk_*`; reuses ti_kingdoms.py's
flat_block, screen_box, palm, tree, street, market_stall, arcade_hall, banner_pointed unchanged).
Towns: `build_town_kingdoms_levant_<size>_<v>.py` (the base layouts' recorded calls, copied from
the Europe scripts) -> `kingdoms-town-<size>-<v>-levant.glb`. Shared: `build_shared_kingdoms_levant.py`.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | Validation |
|---|---|---|---|---|
| kingdoms-town-small-a-levant | 12,261 / 2,687 / 368 | 41 m | 16 m | passed |
| kingdoms-town-small-b-levant | 16,211 / 2,463 / 310 | 41 m | 12.5 m | passed |
| kingdoms-town-medium-a-levant | 26,580 / 4,417 / 532 | 61 m | 20 m | passed |
| kingdoms-town-medium-b-levant | 29,952 / 4,966 / 566 | 62 m | 20 m | passed |
| kingdoms-town-big-a-levant | 55,191 / 8,033 / 810 | 82 m | 24 m | passed |
| kingdoms-town-big-b-levant | 44,218 / 7,309 / 646 | 81 m | 24 m | passed |
| palace-small (shared-kingdoms-levant) | 2,585 / 439 / 48 | 12 m | 12 m | passed |
| palace (shared-kingdoms-levant) | 3,646 / 508 / 120 | 14.7 m (steps, pots) | 18 m | passed |
| walls-medium (shared-kingdoms-levant) | 8,600 / 1,960 / 318 | 69 m | 15 m (pennants) | passed |

## Decisions
- Houses by plot size: poor = mud-brick block with a walled yard, reed pergola, cloth or palm;
  common = plastered courtyard house with a two-storey back room, wind catcher, pointed portal,
  pool or tree; rich = two storeys round a court with a long pool and palms, blue-tiled pishtaq,
  mashrabiya balconies, two wind catchers, roof pergola, cypresses.
- Landmarks: small-a mosque; small-b caravanserai gate; medium and big: both. The mosque is
  scaled to the town (body 10 to 14 m, the sheet's is 20 m) but its spiral minaret keeps 16, 20
  and 24 m; base houses it covers are dropped automatically.
- Ground: sandy earth (`lvk_sand`), grey flagstone lanes and square.

## Not matched
- Muqarnas, tile patterns, carved doors are simplified; the mosque court is narrower than the sheet.
- Wall-walk and towers follow the sheet, but the sheet's brick foot courses are plain grey stone.
