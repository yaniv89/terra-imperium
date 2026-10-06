# The last regional kits and the Classical palaces

Inputs from `plans/art/downloads/blender-remaining/` (unzipped in scratch, not committed):

| Kit | houses | landmark-1 | landmark-2 | materials (street swatch) |
|---|---|---|---|---|
| europe/modern | checkpoint-04 part 02 | quality-revision-01 (blue curtain-wall tower; supersedes checkpoint-04) | checkpoint-04 part 03 | checkpoint-04 part 03 |
| levant/bronze | checkpoint-04 part 03 | checkpoint-04 part 04 (ziggurat) | checkpoint-04 part 04 (blue glazed gate) | checkpoint-04 part 04 |
| indic/gunpowder | checkpoint-04 part 04 | checkpoint-05 part 01 | checkpoint-05 part 01 | checkpoint-01 part 01 |
| indic/modern | checkpoint-05 part 01 | checkpoint-05 part 02 | checkpoint-05 part 02 | blender-next30 part 01 (no newer swatch was delivered) |
| towns/classical | palace-small (Roman villa with a portico): checkpoint-05 part 02; palace (basilica): checkpoint-05 part 03 | | | |

Street and roofscape are only previews (the assembler lays its own towns). No Israelite item was
touched. Built with Blender 4.2 (the `bpy` 4.2.0 wheel on Python 3.11):

```
python scripts/blender/assemble_kit_towns.py <kits>/europe modern europe <out> 2048
python scripts/blender/assemble_kit_towns.py <kits>/levant bronze levant <out> 2048
python scripts/blender/assemble_kit_towns.py <kits>/indic gunpowder indic <out> 2048
python scripts/blender/assemble_kit_towns.py <kits>/indic modern indic <out> 2048
python scripts/blender/assemble_kit_towns.py shared-base <towns>/classical classical <out> 2048
npm run pack:models
```

Every file passes `validate_model.py` (`*.validation.json` here, run on the unpacked files; towns
at footprint 4.0 / 6.0 / 8.0 and the measured height). No town needed the LOD1 retry.

## Towns

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| modern-town-big-a-europe.glb | 22 (14/6/2) | landmark-1 (1.00), landmark-2 (0.88) | 27146 / 6616 / 726 | 8.0 | 4.77 | 1.7 MB | pass |
| modern-town-big-b-europe.glb | 22 (15/5/2) | landmark-2 (0.88), landmark-1 (1.00) | 26657 / 6616 / 726 | 8.0 | 4.77 | 1.6 MB | pass |
| modern-town-medium-a-europe.glb | 12 (9/2/1) | landmark-1 (0.50), landmark-2 (0.74) | 15121 / 4216 / 626 | 6.0 | 2.40 | 1.2 MB | pass |
| modern-town-medium-b-europe.glb | 12 (9/2/1) | landmark-2 (0.74), landmark-1 (0.50) | 15121 / 4216 / 626 | 6.0 | 2.40 | 1.2 MB | pass |
| modern-town-small-a-europe.glb | 7 (6/1/0) | landmark-1 (0.34) | 8740 / 2752 / 466 | 4.0 | 1.60 | 1.0 MB | pass |
| modern-town-small-b-europe.glb | 6 (5/1/0) | landmark-2 (0.47) | 7143 / 2184 / 456 | 4.0 | 1.03 | 0.9 MB | pass |
| bronze-town-big-a-levant.glb | 23 (14/7/2) | landmark-1 (1.00), landmark-2 (1.00) | 33960 / 7360 / 736 | 8.0 | 1.51 | 1.8 MB | pass |
| bronze-town-big-b-levant.glb | 23 (14/7/2) | landmark-2 (1.00), landmark-1 (1.00) | 34024 / 7360 / 736 | 8.0 | 1.51 | 1.8 MB | pass |
| bronze-town-medium-a-levant.glb | 12 (9/2/1) | landmark-1 (0.84), landmark-2 (0.86) | 20322 / 4720 / 626 | 6.0 | 1.28 | 1.4 MB | pass |
| bronze-town-medium-b-levant.glb | 12 (9/2/1) | landmark-2 (0.86), landmark-1 (0.84) | 19634 / 4720 / 626 | 6.0 | 1.28 | 1.4 MB | pass |
| bronze-town-small-a-levant.glb | 7 (6/1/0) | landmark-1 (0.52) | 11028 / 2720 / 466 | 4.0 | 0.80 | 1.0 MB | pass |
| bronze-town-small-b-levant.glb | 7 (6/1/0) | landmark-2 (0.54) | 11844 / 3012 / 466 | 4.0 | 0.69 | 1.1 MB | pass |
| gunpowder-town-big-a-indic.glb | 23 (14/7/2) | landmark-1 (0.94), landmark-2 (0.94) | 35888 / 7652 / 736 | 8.0 | 1.89 | 1.9 MB | pass |
| gunpowder-town-big-b-indic.glb | 23 (15/7/1) | landmark-2 (0.94), landmark-1 (0.94) | 34432 / 7652 / 736 | 8.0 | 1.89 | 1.8 MB | pass |
| gunpowder-town-medium-a-indic.glb | 12 (9/2/1) | landmark-1 (0.79), landmark-2 (0.79) | 21245 / 5012 / 626 | 6.0 | 1.59 | 1.4 MB | pass |
| gunpowder-town-medium-b-indic.glb | 12 (9/2/1) | landmark-2 (0.79), landmark-1 (0.79) | 21389 / 5012 / 626 | 6.0 | 1.59 | 1.4 MB | pass |
| gunpowder-town-small-a-indic.glb | 7 (6/1/0) | landmark-1 (0.50) | 12443 / 3012 / 466 | 4.0 | 0.98 | 1.1 MB | pass |
| gunpowder-town-small-b-indic.glb | 7 (6/1/0) | landmark-2 (0.50) | 11644 / 3012 / 466 | 4.0 | 0.99 | 1.1 MB | pass |
| modern-town-big-a-indic.glb | 23 (14/7/2) | landmark-1 (0.98), landmark-2 (1.00) | 31553 / 7148 / 736 | 8.0 | 4.73 | 1.8 MB | pass |
| modern-town-big-b-indic.glb | 22 (14/6/2) | landmark-2 (1.00), landmark-1 (0.98) | 30143 / 6908 / 726 | 8.0 | 4.73 | 1.8 MB | pass |
| modern-town-medium-a-indic.glb | 12 (9/2/1) | landmark-1 (0.83), landmark-2 (0.51) | 17513 / 4508 / 626 | 6.0 | 2.40 | 1.3 MB | pass |
| modern-town-medium-b-indic.glb | 12 (9/2/1) | landmark-2 (0.51), landmark-1 (0.83) | 17513 / 4508 / 626 | 6.0 | 2.40 | 1.4 MB | pass |
| modern-town-small-a-indic.glb | 7 (6/1/0) | landmark-1 (0.52) | 10437 / 2960 / 466 | 4.0 | 1.04 | 1.1 MB | pass |
| modern-town-small-b-indic.glb | 7 (6/1/0) | landmark-2 (0.34) | 8646 / 2508 / 466 | 4.0 | 1.60 | 1.0 MB | pass |

The old Indic Modern prototypes (`blender-indic-modern-five`) were never imported as towns, so
nothing had to be removed: South Asia now builds these files in the Modern Age.

## shared-classical.glb: the palaces

New mode `shared-base` in `assemble_kit_towns.py`: it builds the base shared file of an age from
its `build_shared_<age>.py` ITEMS (with that script's seed, 2000) plus the delivered
`<towns_dir>/palace-small` and `palace` folders, all in one atlas. The procedural walls, camp and
fields come out with exactly the triangle counts of the shipped file (8,032 / 10,586 / 10,456 walls,
3,890 camp, as in plans/art-pilot/classical-kingdoms/LOG.md), so only the palaces are new.

| Object | LOD0 / LOD1 / LOD2 | Footprint | Height |
|---|---|---|---|
| palace-small (villa) | 1,153 / 1,153 / 400 | 0.80 | 0.82 |
| palace (basilica) | 1,221 / 1,221 / 400 | 1.20 | 1.42 |

Capitals in the Classical Age now stand a palace in the free centre: palace-small in a small town,
the basilica in a medium one (`rome-classical-capital-*.png`). Classical big towns have no base or
regional model yet, so they keep the procedural town (and its own palace) as before.

## Lightness (no double darkening)

- The close view does not multiply COLOR_0: `assemble_kit_towns.py` bakes each file to one atlas
  through Cycles from the kit's base colour PNG only, and the exported towns carry no vertex
  colours. The delivered COLOR_0 AO is therefore dropped, and the only AO is the town bake's
  (`ti_town.build_file`, base x (0.35 + 0.65 AO)), once.
- First build, screenshots at k 150 (mean HSV value / saturation of the town crop, same crop for
  all): Paris Modern 0.29 / 0.36 against Baghdad's Levant Modern 0.39 / 0.23; Damascus Bronze 0.41 /
  0.48 against Cairo's Nile Bronze 0.48 / 0.31; Delhi Gunpowder 0.35 / 0.51 against Baghdad's Levant
  Gunpowder 0.36 / 0.27; Delhi Modern 0.34 against 0.39. All four read darker than their neighbours.
- Fix: `KIT_TONE` in the assembler lifts a kit's Town texels before the bake by a gamma curve
  (dark texels rise most, highlights do not clip) and scales their saturation: Europe Modern
  x1.40 / x0.75, Levant Bronze x1.25 / x0.68, Indic Gunpowder x1.10 / x0.62, Indic Modern x1.22 / x1.
  Team keeps the delivered neutral grey.
- After: Paris 0.40 / 0.32, Damascus 0.46 / 0.40, Delhi Gunpowder 0.38 / 0.39, Delhi Modern 0.38 /
  0.26, so within about 5% of the neighbours' value. Atlas means of the files 0.29 to 0.34; texels
  under Town faces 0.37 to 0.52. Ground (the street swatch's colours, multiplied by the land tint in
  the game) 0.32 to 0.36 with saturation 0.07 in Modern, 0.45 to 0.51 with saturation 0.25 in Bronze
  and Gunpowder, as the other kit towns.
- Remaining difference: the Levant Bronze (blue glazed gate) and the Mughal red sandstone stay
  more saturated than their neighbours; that is the material, not shading.

## Screenshots

`npx vite`, a game started as the nation, the save edited to the age and town size (the city's
buildings), then `window.__map2DTest.focus(lat, lng, k)` on the flat map; 844 x 390 at k 150 and
1280 x 720 at k 120 to 200:
paris-modern-medium-844, paris-modern-big-1280, damascus-bronze-medium-844, baghdad-bronze-big-1280,
new-delhi-gunpowder-medium-844, new-delhi-gunpowder-big-1280, new-delhi-modern-medium-844,
new-delhi-modern-big-1280, rome-classical-capital-small-844, rome-classical-capital-medium-844 and
-desktop; `compare-*` are the neighbour towns used for the lightness check. No console errors.

## Code

- `scripts/blender/assemble_kit_towns.py`: the `shared-base` mode; `KIT_TONE` and `lifted`.
- `scripts/blender/build_shared_classical.py`: header points to the shared-base build.
- `src/components/map/closeView/townAssets.test.js`: the Levant now builds its own Bronze kit;
  the new Europe and Indic kits are found; every base shared file has both palaces.
- `src/data/architecture.js` and `TOWN_VARIANT_BY_AGE` needed no change: europe (with colonies),
  levant (with israelite and andalus falling back to it) and indic already route to these files by
  name; the Bronze rule for the Levant now only steers a city with no style.
