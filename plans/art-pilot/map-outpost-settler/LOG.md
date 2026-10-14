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

## Task 2: the settler party (units/settler-<age>, MD01)

Before: a settler was a wagon disc sprite at every zoom (before/before-settler-k60.jpg).

Built: `scripts/blender/build_units_settler.py` on the unit figure parts (ti_figure.py crew, legs,
arms, head, torso, skirt, hood, straw_hat, ball_cap; ti_mounts.fine_ox, fine_horse, fine_disc_wheel,
fine_wheel, wheeled), rest pose, flat colours, baked shade in COLOR_0, a person 1 tall:

| File | Party | Triangles (by rig) |
|---|---|---|
| bronze-settler | ox, two-wheeled cart with a Team cover, jars, basket; a man leading with a staff, a woman with a Team bundle | 3,942 (ox 824, cart 752, man 1,162, woman 1,204) |
| kingdoms-settler | horse, four-wheeled hooped canvas wagon with a Team band, barrels; a man in a Team hood with a staff, a woman with a Team bundle | 4,526 (horse 858, wagon 1,336, man 1,128, woman 1,204) |
| modern-settler | a small pickup with the household under a Team tarp, a chair on top; a man in a Team jacket and cap | 1,536 (truck 568, man 968) |

All under the machine budget (4,000 target, 6,000 hard) but the kingdoms wagon (4,526, under the
hard cap). Files in `src/assets/units/<age>-settler.glb` with a JSON (quadruped for the animals,
triangleBudget 6,000), packed unquantized like every unit. `validate_model.py ... unit-machine`
fails only `material_names` (the extra flat colours Coat, Mane, Sack, Clay, Rope...), exactly as
the shipped bronze-support does.

Wiring: `unitModels.js` `findSettlerModel` (the latest band at or below the age) and
`preloadSettlerModel` (registered under the key `settler`, baked as class support);
`closeView/settlerModels.js` (which settlers stand a party: yours and others' in sight; whether the
model is in); `closeViewScene.js` stands one party on each settler's tile, turned and walking toward
its target, at 60% of an army figure's size floor so it never outgrows the camp; `sceneModel.js`
`settlerSprites` drops the disc in the close view for a modelled settler but keeps its tap target;
the far map keeps the disc. Test: `settlerModels.test.js` (bands, readiness, who stands, the disc
rule, the shipped files load and bake).

After: after/after-t2-<age>-settler-k60.jpg and after-t2-<age>-outpost-k60.jpg (bronze, kingdoms,
modern; the age set through LOAD_GAME, so the header still says 2000 BCE).

Reads weakly: the modern pickup reads large beside the modern camp; the figures stand in the rig's
ready pose (arms a little forward), the walk cycle only moves the legs.

## Task 3: the independent city badge and banner (I082 placeholder)

Before: a violet diamond behind the far map's disc and a diamond size mark on the close view's pill
(before/before-t3-indep-k8.jpg, before/before-indep-k60.jpg). CityBanners.jsx (the HTML banners)
already asked for `src/assets/icons/independents/<personality>.svg` and drew a dot without it.

Drawn (SVG, the icon style: #292C29 outline at width 7, flat fills, the 256 box, no letters), in
`src/assets/icons/independents/` (contact sheet: independent-icons.png):

| File | What |
|---|---|
| raiders.svg | a horse's head on a shield in the Raiders colour (#C2410C) |
| mercantile.svg | a holed coin over a stack of coins, Mercantile colour (#CA8A04) |
| fortress.svg | a crenellated tower with a gate and an arrow slit, Fortress colour (#57534E) |
| tribal.svg | a winged totem pole with two carved faces, Tribal colour (#15803D) |
| banner-frame.svg | a swallow-tailed dark ribbon with a brass inner rule, 256 x 64, drawn in three slices |

Wiring: `data/icons.js` adds the `independents` group (INDEPENDENT_ICON_IDS);
`data/independents.js` `independentPersonality`; `gl/sceneModel.js` passes the personality to the
sprites; `gl/spriteArt.js` draws the personality's shield in place of the far badge's disc and
skyline (size box and capital star as before), and on the close view's banner the swallow-tailed
frame in place of the pill with the shield in place of the size disc and the size on its foot. Each
falls back to the old diamond while its image loads. CityBanners.jsx picks the shields up by
itself. Tests: `gl/independentArt.test.js` (personality, one shield each, keys apart) and
`data/icons.test.js` (every personality has a shield, vector only, no text, the outline colour,
the boxes, each shield in its personality's colour, no file the game never asks for).

After: after/after-t3-indep-k8.jpg (Ugarit tribal; Men-nefer, Adumattu, Hegra raiders),
after/after-t3-indep-k60.jpg, after/after-t3-banner-zoom.png.

Reads weakly: at the far zoom the shield's emblem is about 20 px on a phone: the colour and the
shape carry it, the emblem only half; the raiders' horse reads a little like a chess knight.
City-state type badges (UI18) were not made (on hold).
