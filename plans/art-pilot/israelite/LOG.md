# Israelite Bronze kit: towns and shared file from GPT's Blender delivery

A new architecture style, `israelite` (nation il; the game side, falling back to `levant`, is added
by the lead). Inputs: `plans/art/downloads/blender-remaining/checkpoint-01/`, `kits/israelite/bronze`
(houses, street, roofscape, materials, landmark-1, landmark-2) and `towns/bronze/*-israelite`
(palace-small, palace, walls-medium, colony-camp, field-1 to field-4). The delivery's notes cite
Megiddo, Hazor, Gezer and Beersheba (four-room houses, a six-chamber gate, pillared stores) and the
Samaria acropolis for the palaces.

```
python scripts/blender/assemble_kit_towns.py <kits>/israelite bronze israelite <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared-towns <towns>/bronze bronze israelite <out_dir> 2048
```

Outputs: `src/assets/map/towns/bronze-town-<size>-<v>-israelite.glb` (6 files) and
`src/assets/map/shared/shared-bronze-israelite.glb` (palace-small, palace, walls-medium, colony-camp,
field-1 to field-4, object names as in shared-bronze.glb), packed with `npm run pack:models`.
walls-small and walls-big are not delivered and fall back to shared-bronze.glb. Every file passes
`validate_model.py` (`*.validation.json` here, on the unpacked file; towns at footprint 4.0 / 6.0 /
8.0 and the measured height; the shared objects at their delivered sizes). Previews: `*-preview.png`.
`npx vitest run scripts/art src/components/map`: 44 tests pass. No town needed the LOD1 retry.

## Files

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-israelite.glb | 23 (14/7/2) | landmark-1 (1.00), landmark-2 (1.00) | 35547 / 7623 / 736 | 8.04 | 1.25 | 1.7 MB | pass |
| bronze-town-big-b-israelite.glb | 23 (14/7/2) | landmark-2 (1.00), landmark-1 (1.00) | 35243 / 7623 / 736 | 7.95 | 1.25 | 1.7 MB | pass |
| bronze-town-medium-a-israelite.glb | 12 (9/2/1) | landmark-1 (0.86), landmark-2 (0.88) | 19648 / 4983 / 626 | 5.99 | 1.08 | 1.2 MB | pass |
| bronze-town-medium-b-israelite.glb | 12 (9/2/1) | landmark-2 (0.88), landmark-1 (0.86) | 19632 / 4983 / 626 | 6.05 | 1.08 | 1.2 MB | pass |
| bronze-town-small-a-israelite.glb | 7 (6/1/0) | landmark-1 (0.54) | 11355 / 3012 / 466 | 3.98 | 0.67 | 0.9 MB | pass |
| bronze-town-small-b-israelite.glb | 7 (6/1/0) | landmark-2 (0.55) | 10639 / 2983 / 466 | 4.01 | 0.64 | 0.9 MB | pass |
| shared-bronze-israelite.glb: palace-small | - | - | 841 / 841 / 400 | 0.80 | 0.79 | 1.6 MB | pass |
| shared-bronze-israelite.glb: palace | - | - | 909 / 909 / 400 | 1.20 | 1.36 | 1.6 MB | pass |
| shared-bronze-israelite.glb: walls-medium | - | - | 6625 / 2184 / 379 | 6.80 | 0.77 | 1.6 MB | pass |
| shared-bronze-israelite.glb: colony-camp | - | - | 994 / 994 / 480 | 1.73 | 0.40 | 1.6 MB | pass |
| shared-bronze-israelite.glb: field-1 | - | - | 1061 / 1061 / 290 | 1.45 | 0.31 | 1.6 MB | pass |
| shared-bronze-israelite.glb: field-2 | - | - | 2887 / 1377 / 290 | 1.45 | 0.31 | 1.6 MB | pass |
| shared-bronze-israelite.glb: field-3 | - | - | 3983 / 1377 / 290 | 1.45 | 0.32 | 1.6 MB | pass |
| shared-bronze-israelite.glb: field-4 | - | - | 1031 / 1031 / 290 | 1.45 | 0.34 | 1.6 MB | pass |

Heights and footprints are in units (1 unit = 10 m). Landmark scale 1.00 = as delivered.

## What it reads as
- Towns: dark mud-brick four-room houses with courtyards on stone footings; a twin-tower chambered
  gate and a pillared storehouse as the landmarks.
- Shared: the palaces are twin ashlar towers on a round paved terrace (the palace 13.6 m, as
  delivered); walls-medium is a casemate ring with the gate at the south; the camp is two tents, a
  stone ring and a millstone; the fields are terraced crops with a field shelter: field-1 vegetable
  rows, field-2 olives, field-3 vines with a tower and a press, field-4 date palms.

## Tool change: the shared-towns mode
`assemble_kit_towns.py` gains a mode for an age's delivered town objects (`shared-towns`): it reads
`<towns_dir>/<name>-<style>/model.glb` for each of palace-small, palace, walls-medium, colony-camp and
field-1 to field-4 that exists and writes `shared-<age>-<style>.glb`. LOD1 and LOD2 targets per
object: palaces 3,000 / 400, walls 2,300 / 380, camp 2,900 / 480, fields 1,450 / 290 (inside the
brief's budgets). The walls are scaled across to 6.8 units as in the Kingdoms shared files. Camps and
fields come with their own ground: kit materials named Ground now get a third role, baked into the
same atlas and exported as the final alpha-masked Ground material (the town and Kingdoms shared modes
still bake such faces as Town, so their output is unchanged).

## What did not match, and why
- The delivered ground of the camp and fields was a dark brown-grey (mean HSV value 0.15) and the
  tents dark (0.11). In the game the close view multiplies Ground by the land's tint
  (groundBlend.js), so they showed as near-black discs. Fixed in the shared-towns mode: each
  object's Ground is baked from a re-toned copy of its atlas whose texels under the Ground faces
  average the base files' level (shared-bronze.glb camp and fields, measured after the bake:
  value 0.355 to 0.395, saturation about 0.315), and the camp's Town (the tents) is lifted to at
  least 0.28 before the bake. Result after the bake: Ground value 0.361 to 0.386, saturation
  0.312 to 0.322; camp Town 0.27 (base camp 0.32). The pattern (rows, trees, terraces, tents) is
  unchanged and stays Town. The field crops stay as delivered (Town value 0.09 to 0.14, the base
  fields 0.23 to 0.38). Any later shared file with a delivered Ground gets the same rule.
- The camp is 17 m across against the base camp's 20 m, and the fields 14.5 by 12 m; kept as
  delivered (the brief's field size is 14 to 16 by 10 to 12 m).
- The small towns' landmarks are scaled to about 0.55; house counts sit at the low end (small 7,
  medium 12, big 23).

# Israelite Classical (checkpoint 02)

Inputs: `kits/israelite/classical` (houses and street from checkpoint-01; roofscape, materials,
landmark-1 and landmark-2 from `plans/art/downloads/blender-remaining/checkpoint-02/`) and
`towns/classical/*-israelite` (palace-small, palace, walls-medium). Built on the merged
frequency-100 branch; the art and map tests pass there (44).

```
python scripts/blender/assemble_kit_towns.py <kits>/israelite classical israelite <out_dir> 2048
python scripts/blender/assemble_kit_towns.py shared-towns <towns>/classical classical israelite <out_dir> 2048
```

Outputs: `src/assets/map/towns/classical-town-<size>-<v>-israelite.glb` (6) and
`src/assets/map/shared/shared-classical-israelite.glb` (palace-small, palace, walls-medium; the
camp, fields and the small and big walls fall back to shared-classical.glb). All pass
`validate_model.py`; no town needed the LOD1 retry.

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|---|
| classical-town-big-a-israelite.glb | 23 (14/7/2) | landmark-1 (0.99), landmark-2 (1.00) | 35387 / 7569 / 736 | 7.92 | 2.30 | 1.7 MB | pass |
| classical-town-big-b-israelite.glb | 23 (13/8/2) | landmark-2 (1.00), landmark-1 (0.99) | 36060 / 7568 / 736 | 7.94 | 2.30 | 1.7 MB | pass |
| classical-town-medium-a-israelite.glb | 12 (9/2/1) | landmark-1 (0.83), landmark-2 (1.00) | 19532 / 4934 / 626 | 5.94 | 2.30 | 1.3 MB | pass |
| classical-town-medium-b-israelite.glb | 12 (9/2/1) | landmark-2 (1.00), landmark-1 (0.83) | 19388 / 4934 / 626 | 5.93 | 2.30 | 1.3 MB | pass |
| classical-town-small-a-israelite.glb | 7 (6/1/0) | landmark-1 (0.52) | 10977 / 3011 / 466 | 4.01 | 0.77 | 1.0 MB | pass |
| classical-town-small-b-israelite.glb | 7 (6/1/0) | landmark-2 (0.70) | 10461 / 2935 / 466 | 3.98 | 1.60 | 1.0 MB | pass |
| shared-classical-israelite.glb: palace-small | - | - | 1061 / 1061 / 400 | 0.80 | 0.79 | 1.1 MB | pass |
| shared-classical-israelite.glb: palace | - | - | 1342 / 1342 / 400 | 1.20 | 1.44 | 1.1 MB | pass |
| shared-classical-israelite.glb: walls-medium | - | - | 3741 / 2183 / 379 | 6.80 | 0.77 | 1.1 MB | pass |

Reads as: fieldstone courtyard houses with parapets and outside stairs (Jerusalem Upper City,
Capernaum); a crenellated ashlar tower and a gabled hall as the landmarks. palace-small is a
two-storey ashlar tower house on a paved terrace; the palace a round fortress-palace on a
battered mound with corner towers (14.4 m, kept as delivered); walls-medium an ashlar ring with
the gate at the south. The small towns' landmarks are scaled to 0.52 and 0.70.

# Israelite buildings and wonders (checkpoint 02)

Converted with `scripts/blender/import_model.py` from `plans/art/buildings/*-israelite` and
`plans/art/wonders/{solomons_temple,masada}`, at their delivered size (scale 1.0). Not wired into
the game yet (the lead does that).

```
python scripts/blender/import_model.py <buildings>/<id>/model.glb src/assets/map/buildings/<id>.glb <id> landmark
python scripts/blender/import_model.py <wonders>/<id>/model.glb src/assets/map/wonders/<id>.glb tier1,tier2,tier3 wonder
```

- Buildings: `src/assets/map/buildings/<id>.glb`, one root named as the file (for example
  `granary-israelite`) with LOD0 to LOD2, kind landmark (15,000 / 3,000 / 500).
- Wonders: `src/assets/map/wonders/<id>.glb` with the roots `tier1`, `tier2`, `tier3`, each with
  LOD0 to LOD2 (Blender names the later tiers' LODs LOD0.001 and so on, as in the shared files), one
  shared atlas, kind wonder (60,000 / 10,000 / 1,500). The tiers share one frame: their joint
  footprint is centred at the origin, so they stand on the same spot as they grow.
- `npm run pack:models` packs both folders: `MAP_MODEL_DIRS` in `scripts/art/glbInfo.mjs` now lists
  `buildings` and `wonders`, so the pack test covers them too.
- Every file passes `validate_model.py` at its measured footprint and height (`*.validation.json`
  here). Previews: `buildings-israelite-preview.png` (top row barracks, library, scriptorium,
  granary, harbor; bottom row copper_mine, irrigation, market, shrine, workshop) and
  `wonders-israelite-preview.png` (Masada tiers 1 to 3, then Solomon's Temple tiers 1 to 3).

| File | Object | LOD0 / LOD1 / LOD2 triangles | Footprint | Height | Size (packed) | Valid |
|---|---|---|---|---|---|---|
| buildings/barracks-israelite.glb | barracks-israelite | 2038 / 2038 / 485 | 1.82 x 1.23 | 0.85 | 0.11 MB | pass |
| buildings/copper_mine-israelite.glb | copper_mine-israelite | 1255 / 1255 / 485 | 1.70 x 1.09 | 0.70 | 0.10 MB | pass |
| buildings/granary-israelite.glb | granary-israelite | 1261 / 1261 / 485 | 1.47 x 1.44 | 0.71 | 0.11 MB | pass |
| buildings/harbor-israelite.glb | harbor-israelite | 697 / 697 / 484 | 1.63 x 1.34 | 0.90 | 0.12 MB | pass |
| buildings/irrigation-israelite.glb | irrigation-israelite | 426 / 426 / 426 | 1.60 x 1.08 | 0.40 | 0.05 MB | pass |
| buildings/library-israelite.glb | library-israelite | 2172 / 2172 / 485 | 1.82 x 1.23 | 0.85 | 0.11 MB | pass |
| buildings/market-israelite.glb | market-israelite | 948 / 948 / 484 | 1.70 x 1.05 | 0.56 | 0.09 MB | pass |
| buildings/scriptorium-israelite.glb | scriptorium-israelite | 2172 / 2172 / 485 | 1.82 x 1.23 | 0.85 | 0.11 MB | pass |
| buildings/shrine-israelite.glb | shrine-israelite | 728 / 728 / 485 | 1.47 x 1.10 | 0.70 | 0.08 MB | pass |
| buildings/workshop-israelite.glb | workshop-israelite | 1028 / 1028 / 485 | 1.73 x 1.12 | 0.60 | 0.10 MB | pass |
| wonders/masada.glb | tier1 | 5065 / 5065 / 1455 | 9.60 x 6.72 | 2.50 | 0.54 MB | pass |
| wonders/masada.glb | tier2 | 6729 / 6729 / 1455 | 9.60 x 6.72 | 2.60 | 0.54 MB | pass |
| wonders/masada.glb | tier3 | 7613 / 7613 / 1455 | 9.60 x 7.26 | 2.60 | 0.54 MB | pass |
| wonders/solomons_temple.glb | tier1 | 2128 / 2128 / 1455 | 8.61 x 8.61 | 1.20 | 0.38 MB | pass |
| wonders/solomons_temple.glb | tier2 | 4200 / 4200 / 1455 | 8.61 x 8.61 | 1.95 | 0.38 MB | pass |
| wonders/solomons_temple.glb | tier3 | 5884 / 5884 / 1455 | 8.61 x 8.61 | 1.95 | 0.38 MB | pass |

## Importer change
`import_model.py` took one object per file (it joins every mesh). Passing several comma-separated
names (`tier1,tier2,tier3`) now keeps those objects apart: one root each, its own LODs, all in one
frame. One name works exactly as before.

## What did not match, and why
- LOD1 equals LOD0 everywhere: every delivered model is already under its LOD1 budget, and the
  importer only decimates above the budget. LOD2 is cut to the budget (about 485 triangles per
  building, 1,455 per wonder tier; the irrigation channel is 426 at every level).
- barracks, library and scriptorium share one two-wing hall shell (same footprint 1.83 x 1.23,
  height 0.85) and differ only in small details; the notes cite Megiddo stables, Qumran and Tiberias.
  Worth a distinct shape from GPT if they are to read apart on the map.
- Solomon's Temple tier 1 is mostly an empty paved platform with an altar and a basin; the temple
  appears at tier 2 and the side buildings at tier 3. Masada tiers 2 and 3 differ only slightly
  (tier 3 adds the northern extension, 7.3 deep against 6.7); the Roman ramp does not read.
