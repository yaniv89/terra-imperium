# I215, part 2: the Mesopotamian theme's Classical town hall and later ages

Date: 2026-10-14. Branch `claude/art-i215-mesopotamia-2` from `claude/integration` (ca90e28a,
which holds part 1: plans/art-pilot/i215-mesopotamia/LOG.md explains how themes work).

## 1. The Classical town hall

**Lookup.** The battle's town hall (the keep, the objective) draws `keep`, `keep-damaged` and
`keep-ruined` from `artIndex.civic(ageId, style)`: `battle/city/civic-<age>-<theme>.glb` along the
style chain, then `civic-<age>.glb` (src/battle/art/artIndex.js, read by src/battle/render/cityLayer.js
with the city's style). cityLayer scales the piece to the hall's drawn size (`s.hall`, cityBattle.js
hallSize) at the centre, so the hall keeps its size and place whatever the file's model measures;
the hall-clear rule is about the town file's landmarks, which part 1 already keeps clear.

**Built:** `src/assets/battle/city/civic-classical-mesopotamia.glb` by `build_civic_bronze.py`, which
now takes an age: `-- <out> mesopotamia classical`. It fits the Classical kit's rich and common
courtyard houses (ti_mesopotamia_classical.py) into the compound like the Bronze hall, with
baked-brick court walls under stepped merlons, and at the entrance two gate towers faced in blue
glazed brick (ochre bands, plain rosettes, stepped merlons, team banners) joined by a glazed lintel
band, in place of the Bronze hall's mud tower. Damaged and ruined: the same cut, rubble and charred
beams as the Bronze halls (a charred beam that dipped 1 cm under the ground is lifted to Z = 0 for
non-Bronze builds).

| Object | LOD0 / LOD1 / LOD2 | Height |
|---|---|---|
| keep | 6,384 / 760 / 92 | 9.2 m |
| keep-damaged | 1,749 / 527 / 92 | 9.2 m |
| keep-ruined | 949 / 276 / 80 | 3.7 m |

2.5 MB before packing, 2.0 MB packed; validate_model.py passed. Contact sheet:
`contact-civic-classical.png` (intact, damaged, ruined). Test: `mesopotamiaTheme.test.js` checks the
shipped index finds the theme's Bronze and Classical halls.

**The battle wall ring cannot take a theme yet.** `artIndex.walls(ageId)` reads
`battle/city/walls-<age>.glb` by age only and cityLayer.js asks `this.art.walls(this.city.ageId)`.
For a Babylon ring the code would need:
1. `walls: (ageId, style = null)` in artIndex.js walking `[...styleChain(style), 'base']` over
   `battle/city/walls-<age>-<theme>.glb`, then the current by-age chain for the base file (the same
   shape as `housesDamage`), with a test in art.test.js;
2. cityLayer.js passing `this.city.style` (refs.walls), and the fort layer the same if forts should
   follow (forts stand outside towns, so probably not);
3. a themed kit with every piece the base kit has: `wall-straight`, `wall-corner`, `tower`,
   `gate-open`, `gate-closed`, each with `-damaged` and `-breached` (15 objects, budgets wall-kit
   1,500 / 400 / 80), built like build_city_classical.py's wall pieces in baked brick with stepped
   merlons and a blue glazed band, and the gate between glazed towers.
Not done here: the code change is small, the 15-piece kit is a build of its own.

## 2. Kingdoms Age: Abbasid Baghdad and Samarra

Kit `scripts/blender/ti_mesopotamia_kingdoms.py` (materials `mkg_*`), on the Bronze kit's courtyard
houses (`ti_mesopotamia_bronze.HOUSE_WALLS` / `POOR_WALLS` now let a later age swap the wall stuff; the
Bronze and Classical outputs are unchanged) and the Levant Kingdoms kit's helpers (spiral minaret,
pointed arches, portal, wind catcher, muqarnas), unchanged.
- Houses: buff Abbasid baked brick in fine courses, wind catchers, and on the rich houses an upper
  storey with a carved timber shanasheel oriel over the street and a small brick dome. Fewer reed
  huts (a quarter of the poor plots).
- Landmark 1: the Great Mosque of Samarra in small (brick enclosure, half-round towers, arcade) with
  the spiral minaret (Malwiya) before it. Landmark 2: the Mustansiriya madrasa, its portal iwan in
  cobalt and turquoise tile with a muqarnas hood, and the muqarnas cone of the Zumurrud Khatun tomb.
- big-a: the round city's gate (two round towers, a turquoise domed chamber); medium-a and big-b
  were asked for a canal with a noria: the scatter found no free spot big enough, so neither shows
  one (an open point).
- Shared file: palace-small (courtyard house, tiled iwan, turquoise dome, shanasheel), palace (the
  great iwan of an Abbasid palace between blind-arcaded wings, a turquoise dome), the round city's
  brick wall rings with half-round towers. Camp and fields: the base file's.
- Battle: rts-kingdoms-mesopotamia.glb and kingdoms-mesopotamia-houses-damage.glb through the existing
  builders (`house(...)` is the kit's entry, the light version without wind catcher and dome). No
  theme has a Kingdoms civic hall, so none is made.

| File | Size (unpacked) | LOD0 / LOD1 / LOD2, height |
|---|---|---|
| kingdoms-town-small-a | 2.9 MB | 13,166 / 2,775 / 494, 9.4 m |
| kingdoms-town-small-b | 2.9 MB | 14,088 / 2,505 / 530, 9.2 m |
| kingdoms-town-medium-a | 3.7 MB | 24,410 / 4,476 / 682, 11.8 m |
| kingdoms-town-medium-b | 3.6 MB | 23,268 / 4,318 / 672, 11.2 m |
| kingdoms-town-big-a | 5.0 MB | 36,148 / 6,505 / 1,008, 12.0 m |
| kingdoms-town-big-b | 5.1 MB | 37,335 / 6,650 / 944, 11.6 m |
| shared-kingdoms-mesopotamia | 4.5 MB | palace 1,134 / 444 / 24; palace-small 800 / 295 / 36; walls 6,188 to 8,288 / 1,860 to 2,124 / 300 |
| rts-kingdoms-mesopotamia | 1.9 MB | barracks 2,684 / 628 / 148; tower 872 / 196 / 148; trade-post 3,664 / 548 / 124 |
| kingdoms-mesopotamia-houses-damage | 1.1 MB | damaged up to 1,764 / 320 / 80; ruined up to 866 / 189 / 47 |

All passed validate_model.py; packed 31 MB to 18 MB; hall-clear --dry changes 0 of 6; landmark
hints written; townLayouts.json: houses 7 / 8 / 11 / 11 / 21 / 24, landmarks 1 / 1 / 2 / 2 / 2 / 2.
Contact sheets: `contact-kingdoms-towns.png`, `contact-kingdoms-battle-shared.png`.
