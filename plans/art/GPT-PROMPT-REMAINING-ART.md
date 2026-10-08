# Prompt for GPT: finish the remaining Terra Imperium art (2026-10-08)

Copy everything below the line into GPT (Codex or ChatGPT with repository access).

---

You are a 3D and 2D game artist and a JavaScript developer working on **Terra Imperium**
(GitHub: `yaniv89/terra-imperium`), a grand-strategy game on a real Earth map with real-time
battles. React 18 + Vite + three.js. Write to the user in plain English, no em dashes.

## Where the art stands

The five ages of battle art are done and in the game: base units, generals, all 150 signature
units, battle buildings with culture skins, city kits (walls, ruins, forts, damaged houses, palace
damage), raiders, mercenaries, projectiles, props, ground materials and the core effects
(commits "Wave 1 checkpoint 01" to "Wave 6 checkpoint 37" on `claude/integration`). The queue
`plans/art/production-queue.json` has 1,135 items: 285 accepted, 474 in the game awaiting
review, **376 still `pending`**. Your job is the pending ones and the code that shows them.

## Start

1. Clone the repo, `git checkout -b gpt/art-remaining origin/claude/integration`, `npm ci`.
2. Blender as a Python module, the same way every earlier checkpoint was built:
   `python3.11 -m venv /tmp/bpyenv && /tmp/bpyenv/bin/pip install bpy numpy` (the latest
   checkpoints used Blender 5.2; 4.2 also works). Run builders as
   `/tmp/bpyenv/bin/python scripts/blender/<builder>.py <out_dir> [atlas_px]`.
3. Read first, in this order: `CLAUDE.md`, `plans/ART-MODELS-PLAN.md` (sections 2 style bible,
   4 to 12), `plans/art/blender-delivery-spec.md`, `plans/art/AGENT_BRIEF.md` (the scale and
   budget rules), `plans/art/PRODUCTION-PROGRESS.md` (how each checkpoint was delivered), one
   finished checkpoint as the pattern, e.g. `plans/art/downloads/wave6/checkpoint-35/README.md`,
   and the README.md in every asset folder you deliver into (file names, object names, scale,
   budgets, fallback).
4. Reuse the existing builder modules in `scripts/blender/` (`ti_map.py`, `ti_town.py`,
   `ti_bronze.py`, `ti_classical.py`, `ti_kingdoms.py`, `ti_mounts.py`, `build_nature.py`,
   `build_fx_sheets.py`, ...). Copy the shape of the nearest existing builder; never hand-edit a
   GLB. Every builder goes into `scripts/blender/` so the art can be rebuilt.

## What to make (the 376 pending items, in this order)

List them with:
```
node -e 'const q=require("./plans/art/production-queue.json");(q.items||q).filter(i=>i.delivery_status==="pending").forEach(i=>console.log(i.path,"|",i.section,"|",i.description))'
```
Each item's `section` and `description` is its spec.

**Batch 1, battle and map 3D (most visible):**
- Battle terrain: `battle-terrain/river-kit`, `ford`, `bridge-wood`, `bridge-stone`,
  `bridge-steel` (with `-damaged`, `-destroyed`, sockets `socket-end-a/b`) into
  `src/assets/battle/terrain/` (README there; placed by `src/battle/render/battleTerrain.js`).
- Vegetation: `nature/vegetation-conifer`, `-tropical`, `-cold` into
  `src/assets/battle/nature/` (same object names as the existing temperate kit:
  tree-s, tree-m, tree-l, stump, felled, bush, rock-s, rock-m, grass-tuft).
- Raid and landing props: `props/loot-sack`, `exit-marker`, `burnt-field-overlay`,
  `landing-ancient`, `landing-middle`, `landing-modern`.
- Wonder ruins: the 15 `battle-city/wonders/<id>-ruined`.
- Fishing boats: `units/fishing-boat-ancient`, `-modern`.
- Map independents: the 12 `independents/<early|middle|modern>/<kind>-dressing` and the 5
  `independents/tribal-camp-<steppe|forest|desert|tropical|cold>`.
- Map improvements still missing: `oil_well` (pumpjack and tank), `fort-bronze`,
  `fort-classical`, `fort-modern` where the queue still lists them, and the 4 `plans/art/kits`
  gaps (steppe/modern houses, street, roofscape; indic/modern materials). Check what already
  exists in `src/assets/map/` first; only build what is really missing, and mark a queue item
  that is already delivered instead of building it twice.
- Map terrain kits: `map-terrain/mountain-ridges`, `hills`, `cliffs`, `dunes`, `coasts`,
  `lakes`, `wetlands`, `field-edges`, `roads`, `shore-harbour`, and the 5
  `town-ground-<age>` patches, into `src/assets/map/terrain/` (README there).
  **Skip `map-terrain/rivers`:** another branch (`claude/map-river-lines`) is redrawing the
  map rivers as vector lines.
- `units/impostors/classical-infantry-lod3`: **skip for now.** Another branch
  (`claude/battle-unit-zoom-look`) is fixing how units look when zoomed out and their scale
  (men were drawn bigger than horses). Do not change any unit GLB, rig or unit render code
  until that branch is merged; then follow its rules.

**Batch 2, map markers and effects:**
- `map-markers/*` (badge plate, army base, the 5 age standards, AI battle clash and smoke,
  battle result, route dots) and `fx/map/burning-town` (sprite sheet: frames plus `sheet.json`,
  the format of `src/assets/map/sprites/` and `src/assets/fx/`).
- `fog/style-frame`, `fog/unexplored-mask`, `fog/unexplored-edge`, `fog/last-seen-lut`.

**Batch 3, 2D icons and emblems (your image generation is the right tool here):**
- `peoples/emblems/<people>` (151: one per people of `src/data/peoples.js` plus `unknown`) and
  `peoples/frames/shield|banner|pennant`.
- `icons/battle/*` (54), `icons/themes/*` (15), `icons/independents/*` (12),
  `icons/regions/*` (6), `icons/markers/*` (4), `icons/units/worker`.
- `ui/battle/header-<age>` (7), `ui/start/*` (5: backgrounds wide and phone, world sizes).
- Match the existing icons' style, size and format in `src/assets/icons/` (look at several
  before drawing), transparent background, readable at 24 px on a phone. Historical emblems:
  plain motifs from the people's own art; no modern national flags or trademarks.

## Rules (keep them)
- Scale: 1 Blender unit = 10 m, Z up, the front faces Blender -Y, origin at the footprint
  centre on the ground. LOD0, LOD1, LOD2 children on every model; budgets per kind in
  `plans/ART-MODELS-PLAN.md` (it wins over older plans).
- Style: the style bible in `plans/ART-MODELS-PLAN.md` section 2 (low-poly, baked atlases,
  muted natural tones, team colour only on cloth accents).
- Every GLB passes `python3 scripts/blender/validate_model.py <file.glb> /tmp/validate auto`
  (`auto` reads the kind from the file's game path).
- After adding art: `npm run pack:models` (packs the new folders), and for town art
  `npm run build:town-layouts`.
- Never commit raw downloads or a Blender venv; keep GLBs at the sizes the earlier
  checkpoints used (1024 atlases).

## Wire them into the game (the code part)
The loaders already exist (`src/battle/art/`, the folder READMEs), so most files show up as soon
as they land. These parts still need code; implement each with a test:
1. Map terrain kits: cliffs, dunes, coasts, lakes, wetlands, field-edges, roads and
   shore-harbour load (`mapTerrainKit()`) but **nothing places them yet**. Write the placement
   in the close view (`src/components/map/closeView/terrainPlacement.js`, `mountainModels.js`)
   from the tile data (`src/data/geo/terrainData.js`, `footprints.js`, `hexCoast.js`), instanced
   per chunk, cached per tile, never on water or on a town's ground.
2. Town ground patches per age under each town in the close view.
3. Ground materials: the normal and ORM maps of `src/assets/terrain/<id>/` are indexed but not
   drawn; use them in the battle ground shader and the close-view terrain shader.
4. Bridges: draw `-damaged` and `-destroyed` from the battle state when bridges get HP (if the
   sim has no bridge HP, draw intact only and say so; do not change the sim).
5. Independents: the dressings and tribal camps on independent cities in the close view, by age
   and climate.
6. Map markers, fog art, icons and emblems: wire each where its queue item's spec says (the
   start screen, the people picker, the battle HUD, the map sprites atlas `spriteArt.js`).
Do not change game rules or the battle sim (battle hashes must stay identical). Keep the map's
frame time: measure `node scripts/perf/map-pan.mjs --gpu` before and after.

## Check, commit, push (each checkpoint)
Work in checkpoints of about 20 items, numbered on from the last one (the next is
**Wave 7 checkpoint 38**). For each checkpoint:
1. `npm run lint` (zero warnings), `npx vitest run` (rerun a timed-out test alone),
   e2e `npx playwright test`.
2. Screenshots in the real game at 844x390 (phone landscape) and 1600x900: battle sandbox
   (`npx vite`, `/?battleSandbox`) and the map close view. Look at them; fix what looks wrong.
3. A checkpoint folder `plans/art/downloads/wave7/checkpoint-NN/` with `README.md` (what,
   files, builder, sizes, wiring, open gaps), `manifest.json`, `SHA256SUMS.txt` and a
   `contact.png`, as in checkpoint 35.
4. Set each delivered queue item's `delivery_status` to `in_game_awaiting_review` and add one
   line to `plans/art/PRODUCTION-PROGRESS.md`.
5. Commit the builders and GLBs together, one commit per checkpoint, a message that says what
   changed in plain words, then push:
   `git push -u origin gpt/art-remaining`.
Do not merge into `claude/integration` or `main`; the lead session merges after review.

## When done
Report to the user: the checkpoints delivered, the items per checkpoint, the MB added, what is
wired and where, screenshots, items skipped and why (rivers, impostors), and anything still open.
