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

## 3. Gunpowder Age: Ottoman and Safavid Iraq

Kit `scripts/blender/ti_mesopotamia_gunpowder.py` (materials `mgp_*`), on the Kingdoms kit.
- Houses: yellow-brown Ottoman brick, a shanasheel oriel on every common and rich house, wind
  catchers on most roofs, small domes on the rich ones.
- Landmark 1: the shrine (Kadhimiya, Najaf, Karbala): a court wall with a tiled gate, the shrine block,
  a tall tiled turquoise dome on a tiled drum with a pale band, two minarets with balconies and tiled
  caps. Landmark 2: the covered bazaar (qaysariyya) under two rows of small brick domes with skylights,
  shop arches with awnings, a tiled portal and a khan gate.
- big-a: the brick gate between round towers under a turquoise dome (the Kingdoms gate).
- Shared file: palace-small (a pasha's house with two shanasheel, a wind catcher, a tiled dome),
  palace (the serai: arcaded two-storey front, tiled portal, a clock tower), brick wall rings with
  round bastions. Camp and fields: the base file's.
- Battle: rts-gunpowder-mesopotamia.glb, gunpowder-mesopotamia-houses-damage.glb (`kit_house` is the
  entry). No theme has a Gunpowder civic hall.

| File | Size (unpacked) | LOD0 / LOD1 / LOD2, height |
|---|---|---|
| gunpowder-town-small-a | 2.8 MB | 13,220 / 2,678 / 518, 7.5 m |
| gunpowder-town-small-b | 3.1 MB | 16,493 / 2,926 / 482, 9.1 m |
| gunpowder-town-medium-a | 3.8 MB | 26,996 / 4,874 / 658, 10.9 m |
| gunpowder-town-medium-b | 3.8 MB | 25,893 / 4,790 / 648, 11.1 m |
| gunpowder-town-big-a | 5.1 MB | 39,309 / 7,037 / 984, 11.1 m |
| gunpowder-town-big-b | 5.4 MB | 41,855 / 7,280 / 920, 11.3 m |
| shared-gunpowder-mesopotamia | 4.3 MB | palace 850 / 235 / 36; palace-small 1,019 / 259 / 24; walls 6,012 to 7,760 / 1,772 to 1,860 / 300 |
| rts-gunpowder-mesopotamia | 2.0 MB | barracks 2,972 / 652 / 148; tower 872 / 196 / 148; trade-post 3,664 / 548 / 124 |
| gunpowder-mesopotamia-houses-damage | 1.1 MB | damaged up to 1,798 / 316 / 80; ruined up to 1,096 / 226 / 38 |

All passed validate_model.py; packed 31 MB to 17 MB; hall-clear --dry changes 0 of 6; landmark
hints written; townLayouts.json: houses 7 / 8 / 11 / 11 / 21 / 24, landmarks 1 / 1 / 2 / 2 / 2 / 2.
Contact sheets: `contact-gunpowder-towns.png`, `contact-gunpowder-battle-shared.png`.

## 4. Modern

Not built: Iraq's Modern towns keep falling back to the Levant Modern kit (as before this work).

## Atlas sizes (each file's one texture set: base colour, normal, ORM)

The same sizes the existing theme files of each kind use (no atlas raised):

| Kind | Files | Atlas |
|---|---|---|
| Towns | kingdoms-town-*-mesopotamia (6), gunpowder-town-*-mesopotamia (6) | 2048 |
| Shared files | shared-kingdoms-mesopotamia, shared-gunpowder-mesopotamia | 2048 |
| Civic hall | civic-classical-mesopotamia (as every civic-bronze-<theme>) | 2048 |
| Battle skins | rts-kingdoms-mesopotamia, rts-gunpowder-mesopotamia | 1024 |
| Damaged houses | kingdoms-mesopotamia-houses-damage, gunpowder-mesopotamia-houses-damage | 1024 |

## 5. In-game evidence (`shots/`, 844 x 390, device scale factor 3, production build)

`npm run build`, `npx vite preview --port 5214`, then
`node scripts/art/mesopotamia-shots.mjs plans/art-pilot/i215-mesopotamia-2/shots <age> <size> battle`:
the battle sandbox's city with `style=mesopotamia&enemy=akkad`, next to `style=levant&enemy=ugarit`.
- `battle-classical-big-*`: the Classical city with the new town hall (baked brick, glazed gate
  towers) in place of the white Roman hall.
- `battle-kingdoms-medium-*`: the Abbasid town (spiral minaret, madrasa, brick houses).
- `battle-gunpowder-big-*`: the Ottoman town (tiled shrine dome and minarets, the domed bazaar).
A production build has no `window.__game`, so the map close view can show only the turn-1 Bronze
town (part 1's shots); the later ages' towns are shown in battle and in the contact sheets.

## 6. Open points and what reads weakly

- In Kingdoms and Gunpowder city battles the town hall is still the shared civic file (a pale hall
  in Kingdoms, a red brick European town hall with a blue roof in Gunpowder): no theme has a hall
  in those ages; the Gunpowder one stands out most.
- The Classical hall is drawn at the hall's battle size, so its glazed gate towers stand tall
  behind the economy buildings; it reads as Babylonian but its houses are cut-down kit houses.
- The battle wall ring is the age's shared kit (pale stone): see section 1 for the code a themed
  ring needs.
- The canal with a noria asked for in medium-a and big-b (Kingdoms, Gunpowder) found no free spot
  in the scatter, so no town shows one; a fixed spot in the layout would place it.
- Kingdoms and Gunpowder houses differ mostly in brick tone and the number of shanasheel and wind
  catchers; the landmarks carry the age.
- The serai's clock tower (Gunpowder palace) is small against the building at map zoom.
- Modern: not built, falls back to the Levant Modern kit.
