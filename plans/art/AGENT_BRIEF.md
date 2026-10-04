# Brief: building a regional kit from GPT's 2D concept sheets (Blender, remote session)

You are a 3D artist for **Terra Imperium**, working alone in a fresh cloud container on one
regional building kit for one age (plans/art-image-spec.md section 3b: a town is layout x kit;
every city is drawn in the architecture region of the land it stands on). Several sessions like
you work in parallel, each on its own kit and its own branch; a lead session merges your branch.
Read this whole brief first. Writing for the user: plain English, no em dashes.

## Setup (once)
```
python3.11 -m venv /tmp/bpyenv && /tmp/bpyenv/bin/pip install -q bpy==4.2.0 numpy
/tmp/bpyenv/bin/python -c "import bpy; print(bpy.app.version_string)"   # 4.2.0
```
ImageMagick (`convert`) is used to cut beauty panels from the sheets; `apt-get install -y
imagemagick` if it is missing. If pip cannot reach PyPI, read the environment docs and report it.

## What exists (read these files before writing code)
- `scripts/blender/ti_map.py`: the Mesher (`box`, `cyl`, `sphere`, `lathe`, `quad_strip`,
  `add(bm, mat, lod, matrix, only)`), `house_frame(x, y, yaw)`, `facing_centre(x, y)`, the
  procedural material makers (`mat_simple`, `mat_mudwall` = brick bond with optional wash,
  `mat_earth`, `mat_team`), baking, UV packing, export.
- `scripts/blender/ti_town.py`: constants `G` (ground top 0.03), `STOREY` (0.42), the base
  material list `PROC`, `TO_FINAL`, `FRINGES`, `EXTRA_MATERIALS`, `ground_patch`, props (`jar`,
  `crate`, `basket`, `clutter`, `woodpile`, `rack`, `ladder`, `pergola`, `front_shade`, `well`,
  `pennant`), `build_file` (bakes one atlas for a whole file), `main(name, layout, ground)` for
  a town file and `main_file(file_name, items)` for a shared file.
- `scripts/blender/ti_bronze.py`: stalls, temples, palaces, the wall-ring kit (`sweep`,
  `ring_frame`, `footing`, `merlon_ring`, `wall_tower`, `gate_doors`, `banner`,
  `mud_wall_ring(..., mat=, banners=, towers=, gate_towers=, ...)`), camp parts (`tent`,
  `hut`, `fire_ring`, `log_bundle`, `stakes`, `colony_camp(rng, hut_fn)`), field parts
  (`canal`, `crop_bed`, `fig_tree`, `rail_fence`, `field_1..4` with material parameters,
  `FIELD_GROUND`), `WALL_RAISE`.
- `scripts/blender/ti_classical.py`: how an age kit registers its materials (copy that pattern
  exactly: append names to `tt.PROC`, Ground-family names to `tt.TO_FINAL` and fringe names to
  `tt.FRINGES`, register `make_materials` in `tt.EXTRA_MATERIALS`), `mat_paving`, `gable_roof`,
  `hip_roof`, `roman_house`, `han_house`, `court_wall`, `temple`, `stoa`, `cypress`, `shrub`,
  `broadleaf`, `awning`, `paved_strip`, and the Classical shared file builders.
- `scripts/blender/ti_kingdoms.py`: half-timbered `tudor_house`, `timber_frame`, `church`,
  cobble ground (`COBBLED`).
- Example files to copy the shape of: `build_town_classical_medium_a.py`,
  `build_town_kingdoms_small_a.py`, `build_shared_classical.py`.
- Logs with the decisions so far: `plans/art-pilot/bronze-towns/LOG.md`,
  `plans/art-pilot/classical-kingdoms/LOG.md`. The model brief: `plans/model-brief-for-claude.md`.

Run Blender as a Python module: `/tmp/bpyenv/bin/python <script> <out_dir> [atlas_px]` (setup below).

## Rules (decided; keep them)
- 1 unit = 10 m, Z up, the front (south) faces Blender -Y. Footprints: town small 40 m (ground
  rx = ry = 2.0), medium 60 m (3.0), big 80 m (4.0). Every town keeps a free centre at the origin
  (about 12 m, `square=0.6`) for the capital's palace; landmarks go round it.
- Houses are raised 1.3x (`STOREY` = a 3.2 m storey x 1.3). Landmarks and palaces stand at the
  sheet's stated heights. Wall rings are raised 1.3x (`WALL_RAISE`). Fields keep real heights.
  palace-small fits about 8 m (0.8 units), palace about 12 m; both sit on the town's ground
  (no ground patch of their own).
- Walls: a ring just outside the town of that size with one gate at the south: small outer
  about 4.4 units across, medium 6.4 to 6.9, big 8.6 to 9.0.
- Fields: small flat patches about 14 to 16 m by 10 to 12 m with their own ground patch
  (`dict(tb.FIELD_GROUND, rx=..., ry=...)`).
- Budgets (LOD0 / LOD1 / LOD2 triangles): whole town 60,000 / 10,000 / 1,500; landmark,
  palace, camp 15,000 / 3,000 / 500; wall ring 12,000 / 2,500 / 400; field 8,000 / 1,500 / 300.
  One 2048 atlas per file. LOD1 and LOD2 are built from the same layout with less detail: a
  part's `lod` is the highest LOD it still shows in; `only=` shows a part at listed LODs only
  (for a simplified stand-in at LOD2). Bevels only at LOD0 (the Mesher does that).
- Materials: give every new material a prefix so the four of you never collide: Kingdoms
  `kg_`, Gunpowder `gp_`, Modern `md_`, Bronze Europe `eu_` (existing names stay). Ground-type
  materials (paved, cobbled, grass, asphalt...) come in threes, `<name>`, `<name>_fringe`,
  `<name>_square`, all mapped to `Ground` in `TO_FINAL`, the fringe in `FRINGES`. Team-coloured
  cloth (flags, awnings, banners) is `team_cloth` (authored grey, tinted in game).
- Facing: `yaw=None` turns a building's front toward the centre. By hand: north side yaw 0,
  south side 180, west side 90, east side -90.

## Pitfalls already hit (avoid them)
- Every separate small part becomes its own atlas island. Thousands of tiny parts (tufts,
  pebbles, tiles as geometry) starve the atlas and bake black. Keep LOD0 props to dozens or a
  few hundred per object, not thousands; let the procedural material carry fine detail.
- Small spheres under about 2 cm radius bake dark; make props at least 3 to 4 cm.
- Only call `bmesh.ops.recalc_face_normals` on closed solids; open surfaces get flipped.
- `import bpy` before `bmesh` (importing ti_town handles that).
- Never use `pkill -f` or `pgrep -f` with a pattern that matches your own shell command (it kills
  your shell); use `pgrep -f "name[x]"` style patterns.
- Do not edit `ti_map.py`, `ti_town.py`, `ti_bronze.py` or `ti_classical.py`: other sessions import
  them on their own branches, and changing them breaks their merges. Put new code in your own
  module; if you truly need a change there, write a wrapper in your module and say so in your
  report.

## Workflow per object
1. Look at the sheet (Read the PNG). Note dimensions, parts, colours, the layout from the top view.
2. Write the builder; build a quick test at atlas 1024 into your scratch dir.
3. Preview: cut the sheet's BEAUTY panel into `<concept_dir>/<object>.beauty.png`
   (`convert sheet.png -crop WxH+X+Y +repage ...`), then
   `ONLY=a,b /tmp/bpyenv/bin/python scripts/blender/render_map_previews.py <file.blend> <out_dir> <concept_dir> quick`
   and Read `<object>_concept_vs_model.png` (and `_view_front.png` if needed). Fix what differs:
   layout, proportions, colour, missing signature parts. One or two rounds is usually enough;
   aim for "reads as the sheet at map scale", not a perfect copy.
4. Final build at atlas 2048 into your final dir. Validate:
   `python3 scripts/blender/validate_model.py <file.glb> <out_dir> town <footprint> <height>` for a
   town, or a JSON spec per object for a shared file:
   `'{"palace": ["landmark", 1.2, 1.6], "walls-small": ["walls", 4.6, 0.6], "field-1": ["improvement", 1.5, 0.12]}'`
   (footprint and height in units, measured from your model; the check is that they match the
   spec within 5%, so put the intended sheet values). Fix anything that fails other than a
   spec number you guessed.

CPU: you have this machine to yourself. Test at 1024, build at 2048 once per file at the end. A
2048 town build takes 3 to 8 minutes; a shared file 5 to 10. Run independent builds two or three
at a time (background jobs), not more.

## Your deliverables (all inside the repo, on your branch)
- Kit module `scripts/blender/ti_<region>_<age>.py`, town scripts
  `scripts/blender/build_town_<age>_<region>_<size>_<v>.py`, and for a kit with palaces or walls
  `scripts/blender/build_shared_<age>_<region>.py`.
- Town models straight into the game: `src/assets/map/towns/<age>-town-<size>-<v>-<region>.glb`;
  a regional shared file (palace-small, palace, walls-medium as the sheets give) into
  `src/assets/map/shared/shared-<age>-<region>.glb`. Sub-variants (Japan, Korea) use their own
  suffix the same way (`-japan`, `-korea`).
- `plans/art-pilot/<region>-<age>/`: `LOG.md` (table: object, LOD0/1/2 triangles, footprint,
  height, file size; then the decisions and what did not match the sheets), the
  `*.validation.json` files, `*-concept-vs-model.png` previews (downscale to 1600 px wide).
- Touch nothing else: no edits to existing scripts or modules, no `src/` code, no `docs/`.
- Before committing new GLBs in src/assets/map, run `npm run pack:models` (meshopt compression,
  about half the size; the test in scripts/art fails on an unpacked file).
- Commit as you go and push your branch (`git push -u origin <your branch>`); end commit messages
  with the attribution lines the session gives you. Never push to `claude/bronze-towns` or `main`.

## Final message
Under 250 words: files delivered, triangles per LOD, validation results, anything you could not
match on the sheets and why, and anything the lead must wire in the game (a new sub-style, say).
