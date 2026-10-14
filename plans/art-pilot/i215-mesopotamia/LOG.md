# I215: the Mesopotamian town and building theme

Date: 2026-10-14. Branch `claude/art-i215-mesopotamia` (from `claude/integration` at 6a5a6c3b).
Akkad, Elam, Mari and Dilmun built in the Levant kit; they now have a theme of their own, built in
Blender by script for the Bronze and Classical Ages, and fall back to the Levant kit (then the
age's base) for everything else.

## 1. How themes work (read before touching a theme)

**Two keys, one chain.**
- A people's **theme** (`src/data/peoples.js`, field `theme`): what its capital's palace and its
  battle buildings are drawn in (`themeOfNation`, `src/data/architecture.js`).
- A city's **style** (`styleOfLand(landNation || owner, ageId)`, `src/data/architecture.js`): the
  look of the TOWN, from the land it stands on (the tile's modern country on Earth, via
  `landOf` in `src/engine/world/cultureZones.js`; a culture zone's people id on a generated world,
  which reads as that people's theme), whoever owns it. Special land rules live there too (Israel
  builds `israelite`, Iberia `andalus` in the Kingdoms Age, Russia `easteurope`, ...).
- `STYLE_FALLBACK` + `styleChain(style)`: a sub-style and what it falls back to, most specific
  first (`['israelite', 'levant']`). Every file lookup walks the chain, then the age's base file.
- `src/engine/cityManifest.js` gathers `{ ageId, tierId, style, seed, ... }` for a city and
  `buildTownManifest` (`src/data/townLayout.js`) picks the town file with `townFileKey`: the first
  style in the chain with a file for that age and size (variant a or b by the city's seed; the
  other variant if only one exists), else the base town in the layout `TOWN_VARIANT_BY_AGE` gives
  that tradition (Bronze: a Mesopotamian, b Egyptian; Kingdoms: b Abbasid). The close view
  (`src/components/map/closeView/townAssets.js townAssetUrl`) makes the same pick, so the battle
  loads the town the map shows.

**Files per theme and age** (any of them may be missing: the chain fills it):

| What | File | Read by | Fallback |
|---|---|---|---|
| Towns | `src/assets/map/towns/<age>-town-<small/medium/big>-<a/b>-<theme>.glb`, object `town-<size>-<v>` with LOD0..2 | townAssets.js, townLayout.js (+ `src/data/townLayouts.json`) | style chain, then base town |
| Shared (palaces, walls, camp, fields) | `src/assets/map/shared/shared-<age>-<theme>.glb`, objects `palace-small`, `palace`, `walls-small/-medium/-big`, `colony-camp`, `field-1..4` | townAssets.js `sharedAssetUrls` | per object: the theme's file first, then the chain, then `shared-<age>.glb` |
| Battle culture skins | `src/assets/battle/rts/rts-<age>-<theme>.glb`: `barracks`, `tower`, `trade-post` and `-damaged` | economyLayer.js via `artIndex.rtsSkin(age, sideTheme)` | chain, then the age's shared `rts-<age>.glb`; `-ruined` always from the shared file (MD13: "a skin without one takes the shared file's") |
| Civic hall (the battle keep) | `src/assets/battle/city/civic-<age>-<theme>.glb`: `keep`, `keep-damaged`, `keep-ruined` | `artIndex.civic` | chain, then `civic-<age>.glb` (only Bronze has themed halls) |
| Damaged and ruined houses | `src/assets/battle/city/<age>-<theme>-houses-damage.glb`: `house-<kind>-damaged`, `-ruined` | cityLayer.js, closeView/townDamage.js via `artIndex.housesDamage` | chain, then `<age>-houses-damage.glb`, never another age |
| Palace damage | `src/assets/battle/city/palace-damage-<age>[-<theme>].glb` | `artIndex.palaceDamage` | chain, then base (no theme has its own yet) |

**How the regional kits are built** (`scripts/blender/`):
- `ti_town.py build_file(file, [(object, layout, ground)], out, atlas)`: a layout adds parts to a
  `ti_map.Mesher` (boxes, cylinders, lathes; each with the lowest LOD that still shows it, or an
  `only=` stand-in); the file's LOD0 is joined, unwrapped, its procedural materials baked by Cycles
  into ONE atlas (base colour with AO, normal, ORM; WebP), LOD1 and LOD2 reuse the UVs; materials
  end as `Town`, `Ground` (alpha-cut fringe) and `Team` (grey, tinted in game).
- Procedural kits: `ti_<region>_<age>.py` (materials with a prefix, house functions, landmarks)
  plus one builder per town (`build_town_<age>_<region>_<size>_<v>.py`) on the base layouts' plots.
  Delivered GPT kits go through `assemble_kit_towns.py` instead (houses + two landmarks laid round
  a free centre; also the shared-file modes).
- The hall-clear rule (`assemble_kit_towns.py HALL_CLEAR_DEFAULT`, `scripts/art/hall-clear-towns.mjs`):
  a landmark keeps out of the square round the centre the battle's town hall needs (Chebyshev 1.1
  units in medium and big towns, 0.84 in small ones) and stays under 1.5 x 1.2 units (1.15 x 0.95
  small), so the hall is the largest building and centred.
- Battle side: `build_rts_skins_<age>.py OUT THEME`, `build_houses_damage_<age>.py OUT THEME`,
  `build_civic_bronze.py OUT THEME` take a procedural kit's `<theme>_house(ms, rng, slot)` (or a
  delivered kit's houses) and fit them into each role.
- Then `validate_model.py`, `npm run pack:models` (gltfpack, meshopt) and `npm run
  build:town-layouts` (splits every town file back into houses and landmarks for the battle).

## 2. Routing (commit 84dff6c4)

- `mesopotamia` added to `STYLE_FALLBACK` (to `levant`).
- Peoples with the theme: **Akkad** (Kish), **Elam** (Anshan; Susa's Elamite mud brick and
  ziggurats, Chogha Zanbil), **Mari** (on the Euphrates, its palace and temples the type of the
  e-gal and the niched temple), **Dilmun** (the Gulf, Ur's trading partner; its temples and towns
  in Mesopotamian mud brick). Left in the Levant theme: Media (a highland people, its later look is
  Persia's), Magan (stone tower tombs), Urartu (stone fortresses), the Arabian and Anatolian
  peoples, Ugarit (coastal Levant).
- Land: Iraq and Kuwait build `mesopotamia` in every age (it falls back to the Levant's Abbasid
  and later kits, so later ages look as before); Iran and Bahrain in the Bronze Age only (from the
  Classical Age the Levant kit's Apadana is Persia's own look). Mari's capital is in modern Syria:
  its towns stay Levant on the real Earth map (its palace and battle buildings are Mesopotamian).
- `TOWN_VARIANT_BY_AGE`: the theme keeps the Levant's base traditions (Bronze a, Kingdoms b).
- Kinship was read from the art theme (opinion "Our kin", grudges, razing). An art sub-theme must
  not change diplomacy, so `kinThemeOf` (peoples.js) folds `mesopotamia` back into `levant`: the
  game plays exactly as before.
- Start screen: the theme's label "Mesopotamia" and a placeholder glyph (stacked layers).
- Tests: `src/data/mesopotamiaTheme.test.js` (routing, the Levant and base fallback for towns,
  shared files, skins, damaged houses, civic halls; kinship unchanged).

## 3. The kit (Bronze: commit 222fea2a, Classical: commit 3f529d04)

There is no GPT concept sheet; the references are Ur's Old Babylonian houses, the Ziggurat of Ur,
the White Temple and Eanna at Uruk, the palace and temples of Mari, Susa and Chogha Zanbil, the
marsh mudhif, and for the Classical Age Babylon (Etemenanki, Esagila, the Ishtar Gate's palette).

| Script | What it is |
|---|---|
| `scripts/blender/ti_mesopotamia_bronze.py` | Bronze kit (materials `msb_*`): houses, reed huts, ziggurat, niched temple, palms, reed bundles and fences, shaduf well, tannur ovens, stalls, gate; the shared file's mudhif hall and e-gal palace. `mesopotamia_house(ms, rng, slot)` is the entry the battle builders use |
| `scripts/blender/ti_mesopotamia_classical.py` | Classical kit on the Bronze one (glazes `msc_*`): stepped merlons, beam ends, roof gardens, Etemenanki, glazed-gate temple, glazed town gate, residence, throne-room palace, Babylon's wall rings (`ti_bronze.mud_wall_ring` with a blue glazed foot band) |
| `scripts/blender/ti_mesopotamia_layout.py` | Layouts: the base plots (parsed from `build_town_bronze_indic_<size>_<v>.py`), the hall-clear check, dropping plots under a landmark and refilling the rings, seeded props; `landmark_hints` |
| `build_town_bronze_mesopotamia.py`, `build_town_classical_mesopotamia.py` | One town per run: `-- <out> <size> <a/b> [atlas]` |
| `build_shared_bronze_mesopotamia.py`, `build_shared_classical_mesopotamia.py` | The shared files |
| `build_rts_skins_<age>.py`, `build_houses_damage_<age>.py`, `build_civic_bronze.py` | Take `mesopotamia` now (it goes last in THEMES so other themes' seeds stay) |
| `scripts/art/town-landmark-hints.mjs` | Writes the landmark rectangles into a town file's root extras, so `build-town-layouts` reads the ziggurat and temple as landmarks (a small town's ziggurat is no bigger than a rotated house plot, so the size rule called it a house) |

Landmark spots (units; all pass hall-clear: `hall-clear-towns.mjs --dry` changes 0 of 12 files):
small-a ziggurat north, small-b temple north; medium-a ziggurat north and temple east; medium-b
temple north-west and ziggurat east; big-a ziggurat north, temple north-west, gate south; big-b
temple north, ziggurat east (Classical: and a glazed gate south). Houses from the layouts:
Bronze 7 / 9 / 11 / 11 / 23 / 25, Classical 7 / 8 / 11 / 11 / 22 / 21 (small-a .. big-b), plus
2 to 3 free-standing reed huts per town as props.

### Commands
```
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; P=".../5.2/python/bin/python.exe"
"$B" -b --factory-startup -P scripts/blender/build_town_bronze_mesopotamia.py -- <out> medium a 2048   (each size and variant; classical the same)
"$B" -b --factory-startup -P scripts/blender/build_shared_bronze_mesopotamia.py -- <out> 2048
"$B" -b --factory-startup -P scripts/blender/build_rts_skins_bronze.py -- <out> mesopotamia
"$B" -b --factory-startup -P scripts/blender/build_houses_damage_bronze.py -- <out> mesopotamia
"$B" -b --factory-startup -P scripts/blender/build_civic_bronze.py -- <out> mesopotamia
"$P" -I scripts/blender/validate_model.py <file> plans/art-pilot/i215-mesopotamia/validation town   (auto for the rest)
npm run pack:models -- <files>
"$P" -I scripts/blender/ti_mesopotamia_layout.py build_town_bronze_mesopotamia bronze > hints.json
node scripts/art/town-landmark-hints.mjs hints.json src/assets/map/towns/bronze-town-*-mesopotamia.glb
npm run build:town-layouts
```
A town takes 1.5 to 3 minutes on this machine (Cycles bake, 2048 atlas); the battle files 20 to 70 s.

### Triangles (LOD0 / LOD1 / LOD2), height, size before packing (all passed validate_model.py)

| File | Size | Objects |
|---|---|---|
| bronze-town-small-a | 2.4 MB | 11,366 / 2,208 / 530, 8.2 m |
| bronze-town-small-b | 2.7 MB | 13,518 / 2,472 / 558, 8.7 m |
| bronze-town-medium-a | 3.5 MB | 24,300 / 4,006 / 732, 10.5 m |
| bronze-town-medium-b | 3.3 MB | 22,184 / 3,848 / 722, 10.7 m |
| bronze-town-big-a | 4.3 MB | 33,656 / 5,836 / 1,030, 10.6 m |
| bronze-town-big-b | 4.4 MB | 34,606 / 6,006 / 1,008, 10.7 m |
| shared-bronze-mesopotamia | 2.1 MB | palace 2,776 / 480 / 144 (8.9 m); palace-small 1,136 / 488 / 74 (7.4 m) |
| rts-bronze-mesopotamia | 1.8 MB | barracks 2,684 / 628 / 148; tower 872 / 196 / 148 (14.8 m); trade-post 3,276 / 536 / 124; -damaged up to 3,669 / 815 / 129 |
| civic-bronze-mesopotamia | 2.0 MB | keep 2,620 / 572 / 92; keep-damaged 2,307 / 557 / 92; keep-ruined 1,010 / 268 / 80 |
| bronze-mesopotamia-houses-damage | 1.0 MB | damaged up to 1,608 / 292 / 80; ruined up to 562 / 164 / 47 |
| classical-town-small-a | 2.7 MB | 14,156 / 2,232 / 530, 8.5 m |
| classical-town-small-b | 3.0 MB | 16,886 / 2,402 / 544, 9.0 m |
| classical-town-medium-a | 4.1 MB | 30,460 / 4,226 / 732, 10.8 m |
| classical-town-medium-b | 3.7 MB | 26,904 / 3,884 / 722, 11.2 m |
| classical-town-big-a | 5.5 MB | 44,628 / 5,936 / 1,016, 10.8 m |
| classical-town-big-b | 5.4 MB | 44,194 / 5,910 / 982, 11.2 m |
| shared-classical-mesopotamia | 5.4 MB | palace 7,132 / 508 / 144 (9.5 m); palace-small 2,768 / 236 / 48 (8.7 m); walls-small 5,588 / 1,556 / 300; walls-medium 8,384 / 1,928 / 360; walls-big 10,512 / 2,296 / 384 (14 m at the gate flags) |
| rts-classical-mesopotamia | 2.0 MB | barracks 2,948 / 628 / 148; tower 872 / 196 / 148; trade-post 5,008 / 536 / 124 |
| classical-mesopotamia-houses-damage | 1.1 MB | damaged up to 2,188 / 292 / 80; ruined up to 1,096 / 228 / 51 |

Packed (gltfpack): the 19 files go from 61 MB to 34 MB (towns 1.7 to 2.4 MB each).
Budgets: a town 60,000 / 10,000 / 1,500; houses-damage 2,500 / 600 / 120 (the Classical rich
house first came to 2,908; the battle builds now drop its roof garden); prefabs 8,000 / 2,000 / 400.

Not built (and why):
- Bronze walls, camp and fields: the base Bronze file's mud-brick rings, camp and barley fields
  already fit Mesopotamia; they fall back per object.
- `-ruined` battle buildings: the skins never carry them (MD13), the shared wreck stands in.
- A Classical civic hall: no theme has one; `civic-classical.glb` is used.
- Palace damage per theme: no theme has one.
- Kingdoms, Gunpowder and Modern: not built; Iraq and Kuwait fall back to the Levant kit (the
  Abbasid courtyard town and later), exactly as before.

## 4. In-game evidence (`shots/`, 844 x 390 at device scale factor 3, production build)

`npm run build`, `npx vite preview --port 5214 --strictPort`, Chrome with ANGLE / D3D11, then
`node scripts/art/mesopotamia-shots.mjs plans/art-pilot/i215-mesopotamia/shots <age> <size> <map|battle>`.
- `map-bronze-start-mesopotamia-k150.png` / `-k60`: Kish, Akkad's capital, on turn 1 (a small town:
  the ziggurat at the back, the reed guest hall as the capital's palace in the square, reed huts,
  palms, courtyard houses). `map-bronze-start-levant-*`: the same city and camera with the Levant
  town file and the base shared file served in place of the Mesopotamian ones (the old look).
  A production build has no `window.__game`, so the map shots show the starting small town; the
  medium and big towns are in the battle shots and the contact sheets.
- `battle-bronze-medium-mesopotamia-town.png` (`style=mesopotamia&enemy=akkad`) next to
  `battle-bronze-medium-levant-town.png` (`style=levant&enemy=ugarit`): the city battle's town (the
  hall in the centre, houses and the ziggurat and temple as landmarks from townLayouts.json).
- `battle-classical-big-mesopotamia-town.png` and the Levant one: the Classical big town, with the
  glazed gate, the ziggurat's blue shrine and the merlons.
- A closer battle shot was tried with synthetic wheel zoom; it did not move the camera in the
  production build, so only the HUD's Enemy view is kept.

## 5. Open points and what reads weakly

- The town hall in a Classical city battle is the shared `civic-classical.glb` (a white hall under
  a red tiled roof): it stands out among the mud brick. No theme has a Classical civic hall yet.
- The battle's wall ring is the age's shared `walls-<age>.glb` kit (pale stone in the Classical
  Age), not the theme's shared-file walls, which only the map shows.
- Team colour is small on the Mesopotamian towns (door awnings, stall cloths, banners): on the
  map the Levant towns' painted blue bands read as the owner's from further out.
- Reed-mat shades and date mats are small and read as specks below k 60.
- Mari's capital lies in modern Syria, so on the real Earth its towns stay Levant (its palace and
  battle buildings are Mesopotamian). A rule by longitude (the Euphrates east of about 39 E) would
  need the tile, which `styleOfLand` does not take: a decision for the user.
- Kinship was kept as before (Mesopotamian peoples still kin of the Levant peoples). If the
  theme should also be a culture of its own, drop `KIN_THEME` in peoples.js.
- Later ages (Kingdoms, Gunpowder, Modern) are not built: they use the Levant kit.

Contact sheets (Eevee, game camera): `contact-bronze-towns.png`, `contact-bronze-battle-shared.png`,
`contact-classical-towns.png`, `contact-classical-battle-shared.png` (row order: towns small, medium,
big for a then b; shared objects, then the battle files' objects).
