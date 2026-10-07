# Wave 3 checkpoint 15: the town hall is the largest building in every town

2026-10-08, branch `claude/bronze-towns` (Claude). Status `in_game_awaiting_review` (1 new queue
item: `towns/all/hall-clear`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): 844x390 battle sandbox, a Classical big Roman town (europe) and a West
African one with the hall in the middle; model renders before and after (Classical big b, Kingdoms
medium a West Africa, Bronze big a); Kingdoms medium Maghreb and Nile battles.

## The problem
After checkpoint 10 only the Levant Bronze towns gave the battle's town hall (20 m, 5.5 tiles; 4.2
tiles in a small town) its full size. In 81 other town files the hall had to shrink (down to 3 tiles)
and in many more a temple, tower or pylon was wider or taller than the hall (the Classical big
towns' temples were 17 m across and 17 to 24 m tall).

## The fix
`scripts/art/hall-clear-towns.mjs` applies the HALL_CLEAR rule to the shipped files themselves, so the
map's close view and the battle read the same models (a Blender rebuild of 200 towns from the kit
archives would have taken many hours; the result is the same rule):
- each landmark keeps out of the square the hall needs (1.1 units round the centre, 0.84 in a small
  town) and is no wider than 15 m (11.5 m small) and no taller than 12 m (9.5 m small); Modern towers
  keep their height (art spec 3b), there the hall is the largest by footprint;
- it shrinks uniformly about the middle of its far edge and, where its neighbours leave room, steps
  outward along that axis so it shrinks as little as it can (it never reaches further into a
  neighbour than shrinking in place would, never off the solid ground);
- exactly the landmark's own pieces move in LOD0 (the pieces `townComponents.mjs` joined into it), the
  matching simplified pieces in LOD1 and LOD2; textures, UVs, names and materials are untouched; the
  file is unpacked with gltfpack, edited and packed again with the repository's flags;
- the file records its landmarks (`extras.landmarks` on the town node) so the layout builder keeps
  them as landmarks (a shrunk temple is not a house: housing and HP stay as they were), and the old
  plots (`extras.clearGround`): the baked shade they left on the town ground is lifted in the battle
  and the close view (`townDamage.js fileGroundClear`, the same ground clear as for houses under the
  hall).

199 of 416 town files changed; `npm run build:town-layouts` rebuilt townLayouts.json. Scales: 119
landmarks kept 70% or more of their size, 115 kept 50 to 70%, 32 under 50% (the Bronze ziggurats
and the Gunpowder corner towers, 25 to 36 m tall, 3 of them at about a third).

`scripts/art/townComponents.mjs` also stops reading a kit's repeated house type as landmarks (the
Monsoon and Pacific stilt houses, the Israelite courtyard houses: same height, several of them): 16
towns list 63 more houses and fewer false landmarks. `assemble_kit_towns.py` now applies the same
HALL_CLEAR numbers to every kit (`hall_clear`), so a future rebuild keeps the rule.

## Checks
New test in `src/battle/setup/cityBattle.test.js`: every town file leaves a full-size, centred hall
and no landmark as wide as it (or, before the Modern Age, taller than about the hall); a
`townDamage.test.js` case for the file's ground-clear rectangles. Lint clean; 127 related test files
pass (battle, data, scripts/art, map). Shots: `plans/art/shots/wave3/hall-clear/` (no console errors).
Size: the 416 town files went from 627.59 MB to 626.98 MB (-0.61 MB).
