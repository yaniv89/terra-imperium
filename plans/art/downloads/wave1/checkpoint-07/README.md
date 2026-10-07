# Wave 1 checkpoint 07: the town hall reads as the main building, civic proof framing, raid sandbox

2026-10-07, branch `claude/bronze-towns` (Claude). No new art files (0 MB added); code, tools and
screenshots. [Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png)
(844x390: medium europe, eastafrica, westafrica, nile, levant, sinic; small indic; big americas,
monsoon; the raid sandbox's raiders, the hired band, the defender's deployment).

## 1. The town hall is the city's main building (battle)
Before: the civic hall was fitted to the 3 x 3 keep, about 11 m, smaller than many houses.
Now `src/battle/setup/cityBattle.js` `hallPlacement` sizes it by the plan row (town-hall 20 x 20 m):
5.5 tiles in medium and big towns, 4.2 in small ones, clear of the town's landmarks and the region's
buildings. Where a temple hugs the centre it steps up to 3 tiles aside (never toward the gate; a
capital's stays centred under its palace) and only then shrinks (never under 3 tiles; a shrunk hall
stands up to 1.45x taller). Over the 72 Bronze town layouts: 37 at full size, the rest 3.5 to 5.2
tiles (levant and maghreb temples sit almost on the square).
- The keep structure stands at the hall's centre, blocks the cells under it, and its radius reaches
  the hall's walls (attackers stand at the walls, the street stays open; deterministic).
- Houses the hall overlaps are cut out of the town model (`underHall`, no ground claimed, still in
  the manifest for housing and ids, not pickable). Their baked dark footprints on the town ground are
  lifted (`townDamage.js enableGroundClear`), and cut houses no longer cast shadows (a damage-aware
  shadow depth material; this also fixes the shadows of ruined houses).
- A capital's palace on the keep is drawn at least at the hall's size.
Shots: `plans/art/shots/wave1/bronze-hall-<size>-<theme>-844x390.png` (scripts/art/city-shots.mjs).

## 2. Civic proof renders framed
`scripts/blender/render_civic_bronze.py`: the sinic, eastafrica and israelite sources keep loose
geometry about 24 units out along +X in the intact keep's LOD0 (not exported: the shipped GLBs
measure 1.9 x 1.7 units), which stretched the frame. Each state is now framed on its own LOD0
within 30 m of its root. Rerendered: `plans/art/shots/wave1/civic-proof/<theme>-contact.png`.

## 3. Raid sandbox, mercenaries verified
`?battleSandbox&age=bronze&raid=raid&merc` (or the Battle menu and the hired band checkbox): an
independent's raid party (`raidOf`) attacks, you defend; `raid=sack` with a city burns the town.
`&merc` makes your infantry a hired band (`unit.mercenary`). The raiders are revealed at the start
in the sandbox (`intel.defenderSeesAttacker`, sandbox only). The engine's flags survive every copy
to the drawn squad (new test `src/battle/render/irregularLooks.test.js`: setup, sim, plain and
packed views; a raid's attackers draw as raiders even unflagged). Shots in
`plans/art/shots/wave1/raid-sandbox/` (layers: `bronze:raider` 1,694 and `bronze:mercenary` 1,410
triangles, the GLB models).

## Checks
Lint clean; 61 battle, close view and render test files and 12 engine battle test files pass.
