# MD13: three states for the battle buildings (2026-10-13)

Manifest row MD13 (plans/playtest-audits-art-update-2026-10-13.md): a side now loses only when its
base buildings are destroyed, so whole, damaged and destroyed must read at a glance at battle zoom
on a phone (844x390).

## What was built
- `<role>-ruined` for every role of the five shared files (`rts-bronze`, `rts-classical`,
  `rts-kingdoms`, `rts-gunpowder`, `rts-modern`): 13 roles each, and Modern's `generator`,
  `airfield` and `radar-aa`. 68 wrecks in all.
- One script makes them all: `ruined(role, layout)` in `scripts/blender/build_rts_bronze.py`, used
  by the five builders through `ruined_items`. It takes the role's OWN parts, so each wreck stays in
  its age's stuff:
  - every part is cut off by a tilted plane at knee to waist height (the tower keeps a stump of
    30% of its height), so the stumps are jagged;
  - big blocks become a burnt-out shell: a rim of wall round a sunken ash floor;
  - one or two posts stay standing, burnt; cloth is cut lower than walls; all Team cloth is gone;
  - what stood low (racks, troughs, stalls, cut stone, log piles) stays where it was;
  - the stuff is charred (`ti_town.charred`: the part's own material multiplied down, with soot
    patches), the cuts are closed in ash;
  - under it a scorch mark the size of the footprint, heaps of the building's own wall stuff along
    the stumps, a broken tooth of wall on the highest corners, seven burnt beams (three leaning).
  - Same origin and footprint as the whole building. Sockets: only `socket-fire-1..4` and
    `socket-smoke-1`, brought down onto the wreck.
  - Each wreck has its own random stream (seeded from its role name) and is added after every other
    object of the file, so no part of a whole building, a damaged building or a construction stage
    moved.
- Second pass on the two weakest wrecks:
  - the mine: the rock is broken down to under half its height, the adit's black mouth is gone
    and choked with heaps of the rock, three broken frame timbers lie and lean across it;
  - the farm plot: the crop beds are trampled flat (20 to 50% of their height) and burnt darker,
    with burnt-through patches over the rows and the fence's rails lying broken round the field.
- The damaged state was too close to the whole building at phone size (a few heaps at the foot and
  some missing cloth), so it was strengthened (`_breach` in the same file): one corner of the main
  body is cut away by a sloping plane and closed in ash, walls and roofs carry soot blotches, and the
  fallen corner lies as heaps on a scorch mark. Only the main body and what stands on or against it
  is cut (the yard's things stay), and where the main body has more building on one side (a second
  house) the corner on the other side falls. It runs last on its own random stream, so the rest of
  the file is unchanged.
- The 60 culture skins (`rts-<age>-<theme>.glb`: barracks, tower, trade post) were rebuilt with
  their builders (`build_rts_skins_<age>.py`), which call the same `damaged`, so they have the
  stronger damaged state too. By decision they get NO themed wreck: a destroyed skinned building
  leaves the shared file's wreck for its age and role.
- LOD textures: `ti_map.transfer_uvs` gave the corners of one simpler face uvs from different atlas
  islands, so LOD1 and LOD2 were smeared in stripes (in the shipped Bronze file 10,007 of 16,686
  LOD1 triangles and 1,982 of 2,878 LOD2 triangles had a uv edge longer than a fifth of the atlas).
  `ti_map.transfer_uvs_by_face` keeps every simpler face on one face of the full model (0 such
  triangles in the first rebuilt Bronze file). This changes the LOD1 and LOD2 uvs of the whole
  buildings too (their triangles are the same), in the shared files and in the skins.
- Validator: `<role>-ruined` in a battle building file is held to the ruin budget
  (1,200 / 300 / 80), the HQ roles too (it was 8,000 / 2,000 / 400 by default).
- Game: `economyLayer.js` draws `<role>-ruined` for a destroyed building (see "Code").

## Numbers
`TRIANGLES.md` in this folder: every role and state of the five shared files, and every skin file,
before and after, written by a script from the packed files.
- Shared files, packed: Bronze 3,983,868 -> 4,093,236 bytes, Classical 1,538,768 -> 2,031,732,
  Kingdoms 1,935,928 -> 2,168,908, Gunpowder 1,978,412 -> 2,251,124, Modern 1,973,256 -> 2,276,704.
- The 60 skins together, packed: 47,836,168 -> 48,602,804 bytes (+766,636, 1.6%).
- Whole buildings and construction stages: the same triangle counts as shipped, in all 65 files
  (packed against packed). Only `-damaged` objects changed, and the wrecks are new.
- Wrecks: LOD0 264 to 1,011, LOD1 139 to 287, LOD2 35 to 73 (budget 1,200 / 300 / 80).
- All 65 files passed `validate_model.py` (kind `prefab`) before packing.

## Rebuild
```
blender -b --factory-startup -P scripts/blender/build_rts_bronze.py -- art-build/rts-bronze 2048
blender -b --factory-startup -P scripts/blender/build_rts_<age>.py -- art-build/rts-<age> 1024     (classical, kingdoms, gunpowder, modern)
blender -b -t 8 -P scripts/blender/build_rts_skins_<age>.py -- art-build/skins/<age> <theme> 1024   (12 themes an age)
<Blender's python> scripts/blender/validate_model.py <built .glb> art-build/validation prefab
copy the built .glb to src/assets/battle/rts/, then: npm run pack:models -- <files>
blender -b --factory-startup -P scripts/blender/render_rts_states.py -- <built .glb> OUT.png 2 0 844
blender -b --factory-startup -P scripts/blender/render_rts_states.py -- <built .glb> OUT-phone.png 4 1 281
```
- `ONLY=barracks,tower` in the environment builds only those roles (all five shared builders).
- A shared file takes about 3 minutes (Blender 5.2.2, CPU bake), a skin about 16 seconds (GPU bake).
- The validator runs with Blender's own Python (`<Blender>/5.2/python/bin/python.exe`); this machine
  has no other Python.
- The skins of the themes with delivered house kits read `art-build/kitsrc/plans/art/kits/<theme>/
  <age>/houses/model.glb` (gitignored). They are in the delivery ZIPs kept outside git in
  `C:\GitWotkspace\art-downloads-backup`; 44 kits were unpacked from there for this rebuild (the
  latest delivery of each). The whole skin objects came out with the shipped triangle counts, so
  these are the kits the shipped files were built from.

## Review sheets (this folder)
- `<age>.jpg`: every role as whole, damaged, ruined, left to right, LOD0, each tile the phone
  screen's width. The Team material is tinted red as a side's colour would be.
- `<age>-phone.jpg`: the same at a third of the size on LOD1, about what battle zoom shows.
- `skins-<age>.jpg`: the culture skins of three themes (one row a theme; barracks, tower, trade
  post), each as whole and damaged. Bronze: nile, sinic, steppe. Classical: americas, levant, europe.
  Kingdoms: israelite, indic, westafrica. Gunpowder: maghreb, monsoon, sinic. Modern: eastafrica,
  europe, steppe.

## Code
- `src/battle/render/economyLayer.js`: `buildingStateName(b, role)` names the state (whole, damaged
  under 70% HP, ruined once dead; null for a building that never stood), `ruinCovered` hides a wreck
  once a standing building covers it. `update` no longer skips dead buildings: a dead, finished
  building draws its wreck when its file has one (no greybox wreck). A culture skin has no wreck of
  its own, so the shared file's is drawn, at the shared building's scale.
- The wreck stays for the rest of the battle (by decision: no fade, no fire).
- The sim was not changed and does not need to be: `ecoView` (src/battle/sim/economy.js) keeps
  dead buildings in the view with `alive: false`, `built` as it was and `hp: 0`.
- Tests: `src/battle/render/economyArt.test.js` (the name choice, the wreck drawn, built over, the
  shared wreck for a skinned side), `src/battle/render/rtsStates.test.js` (every role of every age
  has its three states with three LODs, a wreck has only fire and smoke sockets),
  `scripts/blender/validate_model.test.mjs` (the ruin budget name rule; that file runs only where
  `python3` exists).

## Against the concept sheets (plans/art/concepts/oct13/buildings-<age>-states-*.png)
The concepts show the destroyed state as pale rubble of the building's own stuff with little soot;
these wrecks are burnt black on a scorch mark. That is darker than the concepts, on purpose: at
phone size the dark patch is what tells a wreck from a low building. The concepts' damaged state
has holes in walls and torn cloth; here it is one fallen corner, soot and heaps, which reads about
as strongly at phone size but shows fewer separate holes close up.

## Known gaps, said plainly
- Still the weakest reads: the mine (rock on rock: the wreck is now lower with a choked mouth, but
  it is still a grey mound next to a grey mound), the Kingdoms tower's wreck (a pale lime stump),
  and the damaged state where the fallen corner is at the back or small (the Modern stable, the
  Kingdoms food depot).
- A skinned tower's damaged state loses its whole look-out house (everything above the fallen
  corner goes), so it reads clearly as damaged but shows less of the theme.
- A skinned side's wreck is the shared one: a Shang barracks falls into the generic Bronze wreck.
- The wrecks were judged in Blender renders (LOD0 and LOD1), not in a running battle.
- The atlas of each shared file now also holds the wrecks and the soot materials, so every other
  object has a little less texture area than before (same atlas size).
- Greybox buildings (no art file) still leave nothing when destroyed.
