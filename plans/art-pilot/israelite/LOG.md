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
- The delivered ground of the camp and fields is a dark brown-grey, and the camp tents are dark:
  that is the delivered colour (the delivery's own previews show the same).
- The camp is 17 m across against the base camp's 20 m, and the fields 14.5 by 12 m; kept as
  delivered (the brief's field size is 14 to 16 by 10 to 12 m).
- The small towns' landmarks are scaled to about 0.55; house counts sit at the low end (small 7,
  medium 12, big 23).
