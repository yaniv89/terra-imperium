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
