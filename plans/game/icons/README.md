# 2D icons in the game UI

The delivered icons (art spec section 8: blender-remaining checkpoints 05 to 11, plus the icon
redesign pilot) are now the game's icons. The screenshots here are at desktop 1440x900 and phone
844x390, both at 2x.

## Assets
- `node scripts/icons/import-ui-icons.mjs <unzipped dirs...>` writes `src/assets/icons/<group>/<id>`.
  Each delivered `source.svg` ships minified, so one vector file serves every size. The pilot's
  five raster redesigns (horses, timber, gems, stone, copper) replace checkpoint 06's versions and
  ship as 128 px WebP. The masks are not shipped. Their alpha matches the colour file's, so
  CSS mask-image on the colour file gives the same silhouette.
- 129 files, 144.6 KB on disk:

  | Group | Files | Size |
  |---|---:|---:|
  | resources | 35 | 56.7 KB |
  | improvements | 11 | 10.4 KB |
  | buildings | 33 | 31.3 KB |
  | wonders | 15 | 17.2 KB |
  | units | 7 | 6.1 KB |
  | ships | 4 | 3.2 KB |
  | cities | 15 | 14.2 KB |
  | ages | 5 | 3.7 KB |
  | markers | 4 | 2.5 KB |

  Each minified SVG renders within 1.3% RMSE of its delivered PNG.
- `assetsInlineLimit: 0` keeps the icons as separate cached files. The main JS chunk grows by
  about 19 KB.
- The index is `src/data/icons.js`: `iconUrl(group, id)` plus one helper per kind of thing. Components:
  - `src/components/ui/GameIcon.jsx`: a fixed-size img that shows a fallback when there is no art.
  - `src/components/ui/icons.jsx`: BuildingIcon, UnitIcon, WonderIcon, ResourceIcon, ImprovementIcon, AgeIcon and ExtractionIcon.

  A faint light rim keeps the dark outline readable on dark panels.

## Deliberate fallbacks (tested in src/data/icons.test.js)
- Defense tiers (Palisade, Stone Walls, Star Fort, Bunker Network): the spec has no art for them, so they keep the old silhouette.
- Cathedral / Mosque: not delivered yet, so it keeps the old silhouette.
- solomons_temple and masada are scenario wonders outside the spec, so they keep lucide glyphs.
- Naval units draw by their line (ships/*). A mixed army banner keeps its plus glyph.

## Where the art now shows
- Resource bar (ResourceBadge): gold, copper, iron, oil.
- City sheet:
  - Build list and queue: units, ships, settlers, armies, buildings, wonders, improvements.
  - Army template editor.
  - Tiles tab: resources and improvements.
  - Buildings tab: tier icons, with deposits shown as their extraction buildings.
- Region card (RegionInfoModal): buildings, wonders, deposits, units. Domestic panel: wonders.
- Tile sheet: resource and improvement. Army sheet: each unit's class or ship line.
- Flat map (Map2DView):
  - Resource discs, improvement stamps, battle marks and settler wagons.
  - Each wonder's silhouette on its tile.
  - City badges: a skyline for the owner's age, sized by town tier (small, medium or big from the city's buildings, as the 3D towns are).
  - A capital star and a size pill on each badge.
- Map banners (flat map and globe): army class, the line of your own fleets, battle, wonder, event scroll.
- Close-view city banners: capital star and siege mark. City rail: capital star.
- Age: the top bar (compact and full), the research web's age columns, and the new-age banner.

## Not changed
- Globe city markers: the globe draws no city badges today, only the shared banners above.
- Text glyphs in the battle HUD, the air lens (✈) and the district letters: none of these are in the delivery.
- src/effects (the animated globe effects) keeps the game-icons.net silhouettes.
