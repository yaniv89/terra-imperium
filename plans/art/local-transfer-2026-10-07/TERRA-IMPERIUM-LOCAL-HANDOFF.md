# Terra Imperium — local-session handoff

Updated: 2026-10-07. Production stopped at the user's request. Read this before resuming.

## Instructions for the next agent

Continue the existing art production task; do not restart or regenerate finished assets. The user has authorized reading/fetching/pulling GitHub, Blender work, and pushes without further approval questions. Work autonomously, with factual progress updates. The immediate priority is delivering the 25-item backlog, then new art.

Repository: https://github.com/yaniv89/terra-imperium

- Read current plans, specs, loaders, and game code from `claude/integration`.
- Work, commit, and push art deliveries on **`claude/integration`**. This is the user's latest correction and supersedes the earlier bronze-towns destination.
- Do not modify game code, tests, or unrelated plans to make art work.
- Normally deliver every 20 logical items: four ZIP files, five logical items each, one checkpoint commit, verify downloadable ZIPs, then continue.
- Latest user preference: **2D design sheets before EVERY NEW model**. Existing 25-item backlog is exempt. No sheet approval pause was requested.
- **Run Blender locally on the user's PC for modeling, baking, rendering, and exporting.** Locate the installed Blender executable and use local GPU acceleration where supported. Do not resume Blender production in the cloud; cloud paths below identify files that must first be transferred. If local execution is unavailable, report that blocker.
- Style: bright, readable, stylised, flat-shaded town-like forms. The user rejected dark, low-quality icons. Historical accuracy and silhouette matter.
- Ships need to blend with the map's blue water. Water belongs in preview backgrounds; do not export a sea plane in the ship model.

## Exact status at stop

- **260 legacy logical items previously uploaded**, according to the published progress file. This is an inherited historical count, not a fresh quality acceptance of every old asset.
- **25 existing backlog items updated/built in this cloud workspace. None of these 25 has been committed or pushed in this phase.**
- First 20: all current validators pass; all Town/Team brightness checks pass; game copies have been packed. Four delivery ZIPs have NOT yet been created.
- Remaining 5: three ships plus two logical cathedral/town items, comprising four cathedral/town variant files. Validators pass; ships also pass brightness checks. Parent still needs to inspect the four cathedral/town previews and check their tone.
- **0 new Bronze unit models completed** under the updated style. Three new reference sheets exist: shared neutral body, Bronze infantry, Bronze ranged.
- Subagents were closed at stop. No additional production or push is authorized by this stop request; resume only in the next session at the user's direction.
- Actual game smoke test successfully displayed Battle Sandbox with no page errors. This **does not prove the 25 new assets are integrated or pass full in-game/performance acceptance**.

## Important: cloud files must be transferred

All absolute paths below are on the cloud machine, **not on the user's PC**. Opening this Markdown in a new local session does not transfer models. GitHub currently has the earlier deliveries, but NOT these 25 pending assets or the new sheets.

Before losing access to this workspace, copy/download these directories into the local workspace, preserving relative contents:

1. `/workspace/art-production/backlog` — first 20 models, packed editable BLENDs, uncompressed GLBs, maps, previews, reports, manifests and finishing scripts.
2. `/workspace/art-production/backlog-ships` — remaining three ships and `FINAL-HANDOFF.json`.
3. `/workspace/art-production/backlog-cathedral-town` — remaining cathedral/town variants and delivery manifest.
4. `/workspace/art-production/wave1-unit-design` — sheets, prompts, research and unit preparation.
5. `/workspace/art-production/checklist-draft` — scope reconciliation and supplemental queue drafts.
6. `/workspace/wave1/reference` — spec/validator/loader snapshots.
7. `/workspace/attachments/42348c40-4436-4d6c-a862-d642ec41e550/Pasted text.txt` — latest full user brief.
8. The 20 untracked packed GLBs in `/workspace/terra-art/src/assets/map/` — or rerun packing on copies of the uncompressed deliverables.

Optional reconstruction/source backup: `/workspace/blender-delivery/all-remaining`. The completed delivery BLENDs are packed; old source paths in scripts still need remapping if those scripts are rerun.

If pending files are unavailable locally, say so explicitly. Do not mark them uploaded, assume they are in Git, or silently regenerate them as though starting fresh.

## Cloud repository locations

- `/workspace/terra-imperium`: sparse clone of `claude/integration`; previously used read-only, but integration is now the authorized working/delivery branch. Reference commit `76d72140fce57835f76532ec6e642675509ba03f`; fetch the latest before resuming.
- `/workspace/terra-art`: existing cloud art worktree is still on `claude/bronze-towns`; 20 untracked packed GLBs. This is a historical workspace location, **not the destination branch**. Preserve/copy those pending assets into the local integration checkout. No branch switch or push occurred during this handoff correction.
- Integration source dependencies installed; art worktree `node_modules` is a symlink to integration. **Do not copy that symlink as a functioning local installation**; install dependencies locally.
- Blender in this cloud used CPU rendering. The local agent should locate installed Blender and use the user's GPU where supported. Permission to use the PC does not itself supply remote access to it.

## First checkpoint: exact 20 items and ZIP split

Source directory `/workspace/art-production/backlog`; authoritative target paths in `delivery-manifest.json`.

| ZIP | Five logical items |
| --- | --- |
| part-1.zip | naval_base, carrier_dock, road_post, highway, rail_depot |
| part-2.zip | copper_mine, iron_foundry, farm-bronze, farm-modern, mine-bronze |
| part-3.zip | mine-modern, fishing_boats-bronze, fishing_boats-modern, road-bronze, road-modern |
| part-4.zip | pasture-bronze, camp-bronze, quarry-bronze, lumber_camp-bronze, plantation-bronze |

First seven targets: `src/assets/map/buildings/<id>.glb`; other thirteen: `src/assets/map/improvements/<id>.glb`. Keep existing underscore spellings. Ancient legacy improvements were mapped to `bronze`.

Every item folder contains its BLEND, uncompressed GLB, basecolor/normal/ORM PNGs, preview, validation JSON and delivery metadata. Include useful reports and source notes. Exclude backup `.before-*` files and obsolete previews/logs.

Suggested destination: `plans/art/downloads/wave0-backlog/checkpoint-01/part-1.zip` through `part-4.zip`, with README, manifest, checksum list and refreshed contact sheet. Suggested commit: `Deliver wave0-backlog checkpoint 01: 20 items`.

### Corrections already completed — do not undo

- Preview camera fitted to full model at 844×390; original first-three framing was cropped and corrected.
- Road post LOD2 fixed to budget: triangle counts 3206 / 2910 / 485.
- Iron foundry Town texture brightened using a Town-only UV mask: final Town tone ~0.456, Team ~0.451. Preserved alpha, normal, ORM and baked AO.
- Bronze and Modern farms now have visible gold/green crop strips and soil paths. Ground-only texture correction preserves geometry, UVs, Town/Team texels, alpha, normal and ORM. Both pass validation and 211×98 phone previews.
- `tone-all20.json`: all first 20 pass the actual tone checker.
- `contact.png` predates final farm/foundry changes; regenerate it.
- First 20 game GLBs packed through actual `npm run pack:models -- <exact paths>`: approximately 25 MB → 19 MB. ZIPs must retain **uncompressed** GLBs, separate from packed game copies.

Scripts in this folder include `finish_model.py`, `run.py`, `repair_lods.py`, `fix_foundry_tone.py`, `farm_readability.py`, and `rerender.py`. Remap cloud absolute paths before running locally. Do not rebuild already-passing assets without a concrete failure.

## Remaining five backlog items

### Three ships

Root `/workspace/art-production/backlog-ships`; read `FINAL-HANDOFF.json`, README, per-item delivery records and `review-25pct-water.png`.

| Item | LOD0 / LOD1 / LOD2 triangles | Town / Team tone |
| --- | --- | --- |
| warship-bronze | 1354 / 1138 / 288 | 0.540 / 0.666 |
| warship-classical | 1458 / 1242 / 352 | 0.544 / 0.631 |
| warship-kingdoms | 1450 / 1034 / 242 | 0.517 / 0.557 |

All validated, structural audits pass, full and LOD2 water views inspected without bright fringe. Sea is preview-only. Original 30fps ship timing retained; unit 20fps rule does not apply here. LOD0 uses eight-phase morph snapshots; LOD1/2 use root-heave approximation, disclosed in reports. Original animation/source parts remain editable in BLEND.

Proposed paths: `src/assets/map/ships/warship-<age>.glb`. **No corresponding ship resolver was found in current code**; all delivery records flag `runtime_integration_pending: true`. Deliver art and document the missing integration; do not invent a loader or claim the ships already appear in-game.

### Two logical items, four variants

Root `/workspace/art-production/backlog-cathedral-town`; read README and `delivery-manifest.json`.

| Variant folder | Game target | LOD triangles |
| --- | --- | --- |
| deliveries/cathedral-a | src/assets/map/buildings/cathedral.glb | 12488 / 2886 / 476 |
| deliveries/cathedral-b | src/assets/map/buildings/cathedral-levant.glb | 12090 / 2896 / 474 |
| deliveries/classical-town-big-a | src/assets/map/towns/classical-town-big-a.glb | 45821 / 9700 / 1445 |
| deliveries/classical-town-big-b | src/assets/map/towns/classical-town-big-b.glb | 50137 / 9696 / 1450 |

All four validator and structural audits pass. Towns assembled into correct single-root/direct-LOD game exports; original source parts remain editable and packed. Atlas consolidation lowers texel density compared with separate source parts; disclosed. Irregular alpha ground receiver prevents a hard plinth. Parent preview/tone review remains pending.

After first 20 are pushed, deliver these last **five logical items as a clearly labeled final partial backlog checkpoint**, one ZIP. Do not count variants as four extra logical items or duplicate assets to fake a 20-item batch.

## Binding art requirements

Read fresh authoritative files from integration before new production:

- `plans/ART-MODELS-PLAN.md` — master; current art scope/style.
- `plans/ART-PRODUCTION-PLAN.md` — M01–M29 now 2D only; older 3D rows remapped.
- `plans/art/blender-delivery-spec.md`, `plans/art/AGENT_BRIEF.md`, `plans/art/ITEMS.md`.
- `src/data/signatureUnits.js` — 150 signature entries.
- `scripts/blender/validate_model.py`; `scripts/art/town-tone.mjs`.
- Actual target loaders and relevant asset-directory READMEs.

Map assets: single root with direct LOD0/LOD1/LOD2; material contracts Town/Ground/Team; alpha MASK 0.5 where required. Three 2048² maps: basecolor, normal, ORM (R=AO/G=roughness/B=metallic), WebP quality 90. AO baked once into base color; avoid multiplying it again. Town tone >=0.26; Team >=0.30.

Budgets: landmarks 15k/3k/500; improvements 8k/1500/300; towns 60k/10k/1500; ships 12k/3k/400. Use current validator for exact category rules.

Deliver packed editable BLEND, uncompressed GLB, maps, report, warm 844×390 preview and phone-size review. Preview light colors: key #FFE7C2, sky #E3EEF8, bounce #5A503F. Actual in-game checks at 1280×800 and 844×390 remain required for acceptance; record pending checks honestly.

New units: flat tagged materials Team/Skin/Emblem/Metal/Wood/Leather/Cloth rather than atlas; standing person 1 unit tall, feet at zero, Blender Z-up/front -Y → glTF Y-up/front +Z. Person target 1500 triangles, hard cap 3000; mounted latest cap 2500; machine/vehicle 3000; units LOD0 only. 20fps archetype clips. Bones: Root, Hips, Spine, Chest, Neck, Head, Arm_L/R, Forearm_L/R, Hand_L/R, Leg_L/R, Shin_L/R, Foot_L/R, Prop_R/L/Back.

No ready `ti_units.py` or RTS helper module was found despite older plan claims. Build art-side tooling when needed without modifying game code.

## New sheets and historical accuracy notes

`/workspace/art-production/wave1-unit-design` contains `prompts.json`, research notes, `shared-neutral-body.png`, `bronze-infantry.png`, and `bronze-ranged.png`.

Generated sheets are 1536×1024, not true 2048; top views are approximate. Written dimensions override illustrated rulers: spear 2.2m (sheet drawn short); bow 1.5m (sheet drawn long). Correct dimensions in the model and verify in Blender. Shared body target about 900 triangles, faceted adult ~6.5 heads tall.

Prepare remaining unit sheets before those new models. Covered Bronze ram is a gameplay reconstruction based partly on later Assyrian evidence; mounted Bronze general is a role abstraction. Do not label those archaeologically exact. Chariot: two horses, two crew, six-spoke wheels; ox cart: one ox, two solid wheels, correct withers yoke. Avoid unsupported culture ornaments on ordinary culture-neutral units.

## Scope and remaining count — avoid misleading totals

Old 350-item ledger: 260 uploaded, 25 built pending, 65 not built in that legacy scope. Its published headline was 90 not uploaded. The newer full art scope is broader, so **90 is not the current all-art remaining count**.

Reconciliation drafts in `/workspace/art-production/checklist-draft` are NOT committed. Use `supplemental-active-queue.json`, `SUPPLEMENTAL-ACTIVE-ITEMS.md`, `HANDOFF.md`, `supplemental-town-presence.json`, and `supplemental-verification.json`; older draft totals are superseded.

Current draft: 1588 required checklist records, with different verification granularity, NOT 1588 remaining models:

- 820 definitive missing declared-target records.
- 312 required scope/binding-verification records.
- 17 recorded built/delivery-validation records.
- 22 recorded uploaded/acceptance-verification records.
- 417 tracked-artifact/acceptance-verification records.

Deduplicated declared missing target bindings: **757 = 443 3D + 314 2D**. This is a draft target-binding count, not a final remaining logical-model count. Town coverage: 484 required variant filenames, 400 tracked, 84 missing. 150 signatures. 73 concrete RTS build jobs; optional houses held separately. 300 culture-skin root bindings need resolution. Twelve provisional rows held for scope verification.

Preserve all old progress/checkpoint history and completed statuses. Append unique requirements only; annotate superseded older rows. Older 11 ordinary Israelite unit rows now map to a single Modern Merkava requirement; ordinary units remain culture-neutral. Oil is Modern-only. Do not discard the user-requested 25 backlog items just because eight are history-only in the newer canonical checklist.

## Resume sequence

1. Verify transferred files and local Blender, install local project dependencies, and fetch fresh integration specs. Use `claude/integration` as the local working branch; pull safely and preserve/copy pending cloud assets without overwriting unrelated changes.
2. Finish first-20 packaging and refreshed contact sheet; use exact ZIP split above. Run only unresolved checks, not repeated full rebuilding.
3. Commit only intended art/progress files to `claude/integration`; push to `origin claude/integration` and verify all four downloadable ZIP hashes. Report exact contents and honest quality/runtime status.
4. Review last five, pack game copies, package partial checkpoint, push, verify downloads. Keep unresolved ship integration explicit.
5. Reconcile/add current scope without losing history, then start new models with sheets first. Priority: Bronze battle/signatures → map → Classical → Kingdoms → Gunpowder → Modern → remaining 3D → remaining 2D. Continue checkpoint uploads every 20 logical items.

## Local performance

Local Blender with a suitable GPU should accelerate rendering/AO baking compared with this cloud CPU renderer. Geometry scripting and validation may gain less. Image generation runs separately and will not become faster from installing Blender locally. Use bounded parallel jobs to fit available RAM/VRAM; there is no universal safe batch size. Keep durable per-item outputs and checkpoints so a disconnected session can resume.

User has now asked to stop this session and continue locally. This document records the stop point; it is not a claim that the pending deliveries were uploaded.
