# Wave 3 checkpoint 10: the Levant town hall gets its full size

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (1 queue item: `towns/bronze/levant/hall-clear`).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png)
(844x390: the battle sandbox's medium and big Levant towns with the hall in the middle; the medium-b
and big-a town models before and after).

## The problem
In the Bronze Levant towns the kit's two big landmarks (the ziggurat and the blue glazed gate, 19 and
18.7 m across) were placed against the free centre, so the battle's town hall (plan row town-hall,
20 x 20 m = 5.5 battle tiles, `src/battle/setup/cityBattle.js hallPlacement`) had to shrink: 4.78 and
3.51 tiles in medium a and b, 4.01 and 3.96 in big a and b.

## The fix (in the town files, so the map's close view and the battle match)
- `scripts/blender/assemble_kit_towns.py`: new per-kit `HALL_CLEAR` (Levant Bronze only): in medium and
  big towns the landmarks keep out of a square of half size 1.1 units round the centre (measured on
  their axis-aligned bounds, as `scripts/art/townComponents.mjs` reads them) and are capped at 15 m
  across and 12 m tall, so the 20 m hall stays the largest building. Other kits build as before.
- Rebuilt from the GPT kit (blender-remaining checkpoint 04 parts 03 and 04):
  `src/assets/map/towns/bronze-town-{medium,big}-{a,b}-levant.glb` (validate_model.py town: all pass;
  LOD0 / LOD1 / LOD2 triangles 21,594 / 4,960 / 636 medium a, 20,838 / 4,960 / 636 medium b,
  33,960 / 7,360 / 736 big a, 32,888 / 7,120 / 726 big b), packed; landmark scale 0.71 to 0.80.
- `src/data/townLayouts.json` rebuilt (`npm run build:town-layouts`): only these four towns changed.
  The hall is now 5.5 tiles and centred in every Levant Bronze town (all 6; small towns were already
  full). Over every town file, 85 other towns (other kits and ages) still shrink their hall; the same
  `HALL_CLEAR` entry fixes a kit when it is rebuilt.
- New test in `src/battle/setup/cityBattle.test.js`: every Levant Bronze town leaves a full-size,
  centred hall and no landmark is as wide as it.
- `scripts/blender/render_glb_top.py`: an 844x390 three-quarter render of a map model's LOD0 (before
  and after proofs).

Size: the four packed files went from 6.42 MB to 6.53 MB (+0.11 MB).

## Checks
Lint clean; 8 related test files (cityBattle, cityArt, art, townAssets, townLayout, cityManifest,
pack-map-models, town-tone) pass. Shots: `plans/art/shots/wave3/levant-hall/`.
