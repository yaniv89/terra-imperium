# Kingdoms Age, Levant kit (art spec 3b), built in Blender

Sources: `plans/art/kits/levant/kingdoms/` (houses, street, roofscape, materials, landmark-1 great
mosque with a spiral minaret, landmark-2 caravanserai gate, palace-small, palace, walls-medium).
Kit: `scripts/blender/ti_levant_kingdoms.py` (materials `lvk_*`; reuses ti_kingdoms.py's
flat_block, screen_box, palm, tree, street, market_stall, arcade_hall, banner_pointed unchanged).
Towns: `build_town_kingdoms_levant_<size>_<v>.py` (the base layouts' recorded calls, copied from
the Europe scripts) -> `kingdoms-town-<size>-<v>-levant.glb`. Shared: `build_shared_kingdoms_levant.py`.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | Validation |
|---|---|---|---|---|
| kingdoms-town-small-b-levant | 16,211 / 2,463 / 310 | 40 m | | passed |
| palace-small | 2,585 / 439 / 48 | 12 m | 12 m | passed |
| palace | 3,646 / 508 / 120 | 14.7 m (with steps) | 18 m | passed |
| walls-medium | 8,600 / 1,960 / 318 | 69 m | 15 m (pennants) | passed |
| other five towns (1024 test / layout counts) | small-a 12,261 / 2,687 / 368; big-a about 54,500 / 8,000 / 800 | | | 2048 builds were still running |

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
