# Map close view: outpost camp, settler party, independent city badge and banner

Branch `claude/art-map-outpost-settler` (from `claude/integration`, 2026-10-14). Audit items I055
(outpost), MD01 / `units/settler-<age>` (settler), the independents' W1 badge placeholder (I082).

## How the shots were taken

The production build exposes no game state (`window.__game` is dev only), so the shots come from
the dev server in this worktree (`npx vite --port 5217`, restarted after every change: its watcher
ignores `.claude/`), Chrome (`--ignore-gpu-blocklist --enable-webgl --use-angle=d3d11`) at 844 x 390,
device scale 3:

    node scripts/art/outpost-settler-shots.mjs <out_dir> <prefix> [age|-] [k,k,...]

It starts Israel, founds an outpost on the best site near Jerusalem (FOUND_CITY, a third grown),
stands a second party of settlers on the next site, and focuses the map on the outpost, the
settlers and the nearest independent city (Ugarit, tribal) at each zoom. Fonts load as 403 in the
worktree (the node_modules junction is outside Vite's allow list): the banners fall back to the
system font in these shots, not in the game.

`before/`: the integration branch as it was. `after/`: each task's result. `blender/`: the
Blender previews (render_map_previews.py, quick).

## Task 1: the outpost camp (I055)

Before: an outpost drew the shared file's `colony-camp` (18 x 16 m) at its natural size, a speck in
the hex at close zoom (before/before-outpost-k60.jpg: the brown dot above Samaria).

Built: `scripts/blender/build_map_outposts.py` (ti_town's Mesher and bake, ti_bronze's log bundle),
three files in `src/assets/map/outposts/`, each one root with LOD0..LOD2, materials Town, Team,
Ground, one 1024 atlas, an earth Ground patch of 40 m, the front to -Y, an empty `smoke` over the
fire pit (socket for a later smoke effect):

| File | Age band | What stands in it | LOD0 | LOD1 | LOD2 |
|---|---|---|---:|---:|---:|
| outpost-bronze | bronze, classical | a conical hide tent, a hide ridge tent, a linen ridge tent with a Team fly, a stone fire ring, an ox cart with a hide-covered load, jars, crates, sacks, logs, sharpened stakes along the back, a pole with the Team pennant | 3,318 | 1,116 | 228 |
| outpost-kingdoms | kingdoms, gunpowder | a canvas bell tent with a Team streamer, two canvas wall tents, the fire pit with a cooking tripod, a covered wagon and its horse, barrels, crates, sacks, a post and rail fence, the pole and pennant | 2,896 | 1,410 | 252 |
| outpost-modern | modern | two dome tents with flies, a frame tent with a Team ridge fly, the fire ring with stools, a pickup with a Team tarp, jerry cans, crates, a water tank, steel posts and wire, a steel flagpole | 2,570 | 1,166 | 250 |

Budget: the improvements' row (8,000 / 1,500 / 300). `validate_model.py <file> <dir> improvement 4.0`:
PASSED for all three. Packed with `npm run pack:models -- <files>`: 2 MB to 1 MB.

Wiring: `src/components/map/closeView/outpostModels.js` picks the file of the owner's age band
(the latest age at or below, as the ships do); `closeViewScene.js` draws it in place of the colony
camp for an outpost or an ownerless colony, fitted to 72% of the room a small town takes on its hex
(the colony camp stays while the file loads or when no file exists). `scripts/art/glbInfo.mjs`
lists the new folder for the packer. Test: `outpostModels.test.js` (band pick, which cities take
it, the hex share, the shipped files' root, levels, smoke socket and materials).

After: after/after-t1-outpost-k60.jpg, after/after-t1-outpost-k150.jpg.

Reads weakly: the ox and horse are block animals (fine at map zoom, crude at k 150); the camp's
earth patch is darker than the desert around it (the land tint multiplies the authored earth).
