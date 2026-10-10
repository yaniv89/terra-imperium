# Audit remediation: animation and model production plan

Planning only. No models, animations, images, game code or production-queue statuses are changed by this document.

Prepared 2026-10-09 against `claude/integration` at [`f135336418d86021325a399d92dbf65024ed630f`](https://github.com/yaniv89/terra-imperium/tree/f135336418d86021325a399d92dbf65024ed630f). Audit evidence is the [three-report implementation plan](playtest-audits-implementation-plan.md), [224-item inventory](playtest-audits-item-inventory.md) and [original visual checklist](playtest-audits-animation-model-brief.md). The [production manifest](playtest-audits-art-production-manifest.csv) provides one trackable row per requirement below. The later U01–U13 player requests are specified in [implementation plan §12](playtest-audits-implementation-plan.md#12-player-follow-up-rts-and-iphone-layout); they are distinct from the original audits.

## 1. Answer about scope

**The earlier list was audit-scoped, not the complete pre-audit art backlog. It includes both previously planned assets that the audits exposed as unfinished or unreadable, and new audit-driven presentation work.** Its 26 animation/motion/effect families and 12 model/prop packages were not counts of 26 clips and 12 missing meshes. Ten additional groups were icons or overlays.

Examples of overlap with the old backlog: settler caravans, outpost camps, unit locomotion/combat/work/death clips, the VAT playback pipeline, seven vegetation climates, resource nodes, construction stages, damaged houses and wall states. Examples of audit-driven integration work: visible map travel, understandable controlled withdrawal, readable placement feedback, correct cultural asset selection, ownership cues and fixing tiny figures. A missing on-screen effect does not prove a missing asset.

This plan completes the audit visual requirements and their production dependencies. It also identifies broader pre-audit work so it is not lost, but does not silently commission the entire old backlog. Optional founding/growth flourishes, victory reactions and expanded ambient motion remain separately scheduled polish. Correct battle results, valid orders, supply and campaign persistence remain engineering work in W01–W06 of the implementation plan.

### 1.1 Verified baseline and evidence limits

Repository files, delivery records, queue rows and relevant source were inspected. This planning pass did not run Blender, decode every GLB, measure a phone, or visually certify the assets. “Present” below means a runtime file or documented delivery exists, not that it passes final quality review.

| Area | Evidence at the pinned revision | Consequence for production |
|---|---|---|
| Base/general/irregular units | 46 top-level unit GLBs; 31 base units including workers and modern-air, plus 5 generals, 5 raiders and 5 mercenaries | Inspect and repair; no replacement army order |
| Signature units | 150 GLBs in `src/assets/units/signature/`; checkpoint 32 records all 150 delivered | Reuse compatible rigs and retarget clips; do not build 150 new models |
| Actual unit animation | Unit README documents authored 20-fps clips on Bronze infantry/ranged/siege/worker, other deliveries largely rest-pose; the loader uses the first Idle pose and the procedural shader, with no clip playback yet | Prove VAT baking and playback before scaling animation production; enumerate actual exported actions per file |
| Nature | Desert, Mediterranean and temperate vegetation; ore, stone, gold, fish, sheep/goat and cattle files exist | Review these nine files before repair orders |
| Missing nature files | No dedicated `vegetation-conifer`, `-tropical`, `-steppe`, `-cold` GLBs | Four named kit deliveries are confirmed file gaps, already in the older seven-climate scope |
| Settler representation | Settler SVG exists; no settler/caravan model filename in the inspected runtime tree; five generic age-specific settler rows remain pending | Existing icon is the minimum strategic representation; 3D caravan is a pre-existing production gap, with new assembly only after checking reusable people/ox/cart parts |
| Towns and outposts | Regional towns/shared camps already delivered; renderer selects `colony-camp` | Diagnose resolution, scale and visibility before rebuilding |
| Buildings and destruction | Five ages of battle buildings, construction stages, city kits and house damage deliveries recorded; many are awaiting review | Audit mapping, sockets, state coverage and silhouettes; commission only proven gaps |
| Effects | Eight runtime sheets documented: `impact-sparks`, `explosion`, `smoke`, `fire-small`, `fire-large`, `debris`, `muzzle-flash`, `dust` | Repair routing/timing/visibility before expanding to the old plan's 22 effect concepts |
| Queue | 1,135 unique path rows: 260 `uploaded_quality_accepted`, 25 `in_game_quality_accepted`, 474 `in_game_awaiting_review`, 376 `pending` | These are mixed historical scopes and statuses, not a clean count of missing art |

The queue's top-level 350/285/65 counters explicitly cover only `ITEMS.md` Parts B/C. They do not describe the entire current queue. Old snapshots saying “0 battle units,” “42 missing units,” or “all art complete” are not reliable current production totals. Neither the old approximately 564-item model program nor the 376 pending queue rows can be subtracted mechanically to obtain remaining audit work.

### 1.2 Scope notation and counting

- **Existing requirement:** an older specification already asks for the asset or motion. Its audit ticket is a second source, not a second commission.
- **Audit remediation:** a fix or integration task motivated by observed playtest behavior.
- **Proposed polish:** a recommendation with a lower priority and a usable simpler fallback.
- **Conditional new art:** commission only after a named inspection fails; the inspection itself is mandatory.

Keep AN01–AN26, MD01–MD12 and UI01–UI10 stable. Add **AX01 herd motion** and **AX02 projectile/FX synchronization** as explicit cross-cutting checks omitted as standalone rows in the first list. These are not two new confirmed audit defects. U02–U05/U09/U12–U13 add UI11–UI14 for compact controls, iPhone safe zones, tree selection and readable stocks/supply. This produces **54 visual requirement rows**, not 54 new files: 26 original motion families, 2 supporting checks, 12 model packages and 14 UI groups. The 13 U IDs in the implementation plan track all later player requests, including gameplay changes outside this art manifest. The detailed export/clip count is fixed at Gate G1 after inspection; only the four missing climate-kit filenames are presently a firm new-file count.

## 2. Source authority and conflicts resolved before production

Read the sources at the pinned branch revision. Relative links below are repository paths; the revision above freezes their meaning for this plan.

| Source | Use in this plan |
|---|---|
| [ART-MODELS-PLAN.md](ART-MODELS-PLAN.md), especially decisions D1–D12 and sections 2, 4, 6, 7, 11 | Governing 3D production scope, unit budgets, seven climates, VAT direction, shared ordinary units and one signature unit per people |
| [ART-PRODUCTION-PLAN.md](ART-PRODUCTION-PLAN.md), S1/S4/S9/S12 and delivery checklist | 2D/icon requirements and useful production checks; its older 3D limits are superseded where the model plan says so |
| [Blender delivery spec](art/blender-delivery-spec.md), especially 3b | Building geometry quality, naming, dimensions, grounding, atlas and source delivery; does not prohibit rigs on animated units |
| [Model brief](model-brief-for-claude.md), [image spec](art-image-spec.md), [town brief](town-art-brief.md), [unit brief](unit-art-brief.md) | Historical reference, camera intent, era silhouettes, material detail and movement craft; superseded technical numbers must not be copied blindly |
| [Regional production brief](art/AGENT_BRIEF.md) and [Bronze town log](art-pilot/bronze-towns/LOG.md) | Existing scripted town construction, palette modules, material registration and assembly conventions |
| [Local handoff](art/local-transfer-2026-10-07/TERRA-IMPERIUM-LOCAL-HANDOFF.md) | Latest recorded user preferences: design sheets before every new model; bright readable town-like style; local PC Blender; preserve editable sources; integration branch delivery |
| [PRODUCTION-PROGRESS.md](art/PRODUCTION-PROGRESS.md), [IMPLEMENTED.md](art/IMPLEMENTED.md), [ITEMS.md](art/ITEMS.md), [production queue](art/production-queue.json) | History and item identity; distinguish delivered, imported, reviewed and accepted |
| [Unit README](../src/assets/units/README.md), [signature README](../src/assets/units/signature/README.md), [nature README](../src/assets/battle/nature/README.md), [city README](../src/assets/battle/city/README.md), [RTS README](../src/assets/battle/rts/README.md), [FX README](../src/assets/fx/README.md) | Actual runtime filenames, object/state contracts, loading fallbacks and delivered-state caveats |
| [LOD repair QA](art/downloads/wave0-backlog/checkpoint-01/LOD-REPAIR-QA.md), checkpoint 36/37 in the progress log | Preserve completed ground/LOD, ruin interior and bastion-wall repairs; no accidental regression during regeneration |
| [World/city destruction plan](terra-imperium-world-art-and-city-destruction-plan.md), [building references](game/building-models.md), [improvement references](game/improvement-models.md), [UI revision](ui/SPEC-REVISION.md), [CLAUDE.md](../CLAUDE.md) | Campaign/battle consistency, historical appearance, mobile context and current architecture |

### 2.1 Explicit decisions

1. **20 fps for the current animation production path.** `ART-MODELS-PLAN` 4.1 and `ti_units.py` agree. The earlier checklist's unconditional 30-fps instruction is corrected. Retain the old unit brief's anticipation/contact/recovery, seamless loops, planted feet and neutral Idle principles. Do not reuse its 30-fps contact frame numbers at 20 fps; convert times, then align presentation to the simulation event contract.
2. **Instanced VAT plus procedural fallback.** The branch does not play the authored clip libraries yet. Do not substitute hundreds of independent skeleton mixers. The engineering pilot must validate animated positions, normals, bounds, shadow/depth treatment where used, picking, team colour and LOD transitions. Art remains deliverable in source/GLB form even while the pilot is blocked, but it is not accepted in-game.
3. **Current low-cost flat-colour units.** The model plan's D1/D4 replaces the model brief's 8,000/12,000-triangle textured soldiers and the older multi-render-model/sprite-library expectation. Textured buildings remain detailed and town-like. A unit impostor is a derived optimization, not a separate high-detail army.
4. **Ordinary units stay shared by age.** Do not revive 75 culture-by-age unit kits or the obsolete multi-unit Israelite queue. Preserve one signature unit per people in its designated age. Town geography and army identity are separate inputs.
5. **Buildings/props carry explicit LODs; units use the runtime path.** Non-units retain `LOD0/1/2` children. Units deliver LOD0 and canonical rigs, with derived runtime levels and impostors according to the current loader. Validate silhouettes instead of assuming automatic decimation is sufficient.
6. **Static-building export rules do not remove unit armatures.** Clean cameras/lights/unused objects from production exports; retain necessary skins, animated bones and attachment metadata on units. Retain documented sockets on battle prefabs. A previous map-landmark import removed sockets because that importer required LOD-only roots: do not apply that repair indiscriminately to RTS prefabs.
7. **Art-frame-rate and sim-rate are not gameplay authority.** The fixed 20-Hz sim controls position, attack, delivery, HP, death and ownership. Rendering at 30/60/120 fps must produce identical game outcomes. Never delay a casualty, projectile or capture to finish an animation.
8. **Gate motion is conditional.** The city README says gates stay open in battle. Open/closed/breached assets do not establish a supported open/close command. AN23's baseline is correct existing gate/breach presentation; opening/closing clips ship only if engineering supplies a real authoritative transition.
9. **Do not restore stale map architecture.** The model plan's river-raster decision is contradicted by current `CLAUDE.md`, which documents vector rivers. This audit plan does not rework rivers, grid dimensions or zoom thresholds based on obsolete art prose. Evaluate models through the current camera.
10. **Production location and design sheets.** Future modeling/baking/rendering/exporting follows the handoff's local-PC Blender requirement. This cloud planning session does not provide access to that PC and is not starting production. New models get design sheets before modeling; repair-only work gets annotated before/after references unless the silhouette is redesigned. The handoff says no separate sheet-approval pause was requested. Quality gates below mean evidence-based reviews, not automatic repeated permission questions.

## 3. Art direction and delivery contract

### 3.1 Appearance

Match the shipped towns: bright, readable, stylised, flat-shaded forms with grounded historical silhouettes and believable materials. Avoid generic toy blocks, smooth plastic sheen, miniature decorative noise and dark muddy atlases. Use `kingdoms-town-medium-a-europe.glb` for detail/scale comparison and same-age Levant files for brightness comparison, not as a cultural template for every land.

Buildings retain roof thickness, 0.3–0.6 m eaves where applicable, 0.4–0.8 m parapets on flat roofs, 10–25 cm window/door recesses, footings, and at least two distinct volumes per house. Ancient irregularity is subtle, roughly 1–2 degrees; modern work remains straight. Landmarks read as base/body/crown. Use the age/theme modules' palettes, baked AO under eaves and at contacts, weathering and modest within-material variation. Preserve the hall's clear centre and the existing HALL_CLEAR repair; a new ornament must not eclipse the objective building.

Bronze Mesopotamian work uses mudbrick, appropriate flat roofs and local forms; Nile and Nubian references must follow place, era and available evidence. Green cultivated Nile land is valid. Do not repaint all Nubia as desert or assign architecture solely from the attacking army's nationality. Ordinary units remain culture-neutral; signature equipment retains the roster's historical identity.

Trees need distinct canopy/trunk silhouettes, readable clumps and species appropriate to climate. Steppe and cold ground must remain sparse. Use several distinct shapes before producing many recolours. Vegetation decoration never changes collision, passability, harvest yield or fog visibility.

### 3.2 Geometry and texture budgets

Use these current limits from the model plan and runtime READMEs. Targets are not invitations to fill every budget. Whole-scene measurements are still required.

| Class | LOD0 | LOD1 | LOD2 / far | Notes |
|---|---:|---:|---:|---|
| Person/worker | target 1,500; hard 3,000 | runtime | runtime | Flat material tags; no texture atlas |
| Mount plus rider | target 2,500; hard 4,000 | runtime | runtime | Count mount, rider, tack and accessories together |
| Siege/machine/vehicle | target 3,000; hard 5,000 | runtime | runtime | Count crew as part of the assembly |
| Battle building | 8,000 | 2,000 | 400 | HQ/camp exception below |
| RTS HQ/camp | 15,000 | 3,000 | 600 | Civic keep uses city README's 500 far limit |
| Damaged house | 2,500 | 600 | 120 | Keep intact footprint |
| Ruined house/rubble | 1,200 | 300 | 80 | Interior surfaces readable; no black cut faces |
| Wall piece | 1,500 | 400 | 80 | Distinguish from map wall-ring budget |
| Resource node | 1,500 | 300 | 80 | Full/half/depleted object roots |
| Herd animal | 400 | 150 | 60 | Actual instance count included in scene budget |
| Tree | 600 | 150 | at most 150 or 2-triangle impostor | Keep recognizable canopy and stump/felled states |
| Map camp/landmark | 15,000 | 3,000 | 500 | Camp ground is allowed |
| Map house type | 2,500 | 600 | 120 | Town assembly 60,000 / 10,000 / 1,500 |
| Map field/improvement | 8,000 | 1,500 | 300 | Rounded irregular ground boundary |

Phone battle budget from D3: **500k triangles total**, allocated up to 300k soldiers, 120k buildings/walls, 50k vegetation/props and 30k effects/projectiles; fewer than 120 draw calls; resident textures below 128 MB. VAT textures and effect sheets must fit inside that same memory budget. Desktop may use the plan's doubled limits, but phone success is the release gate. Measure 300 and 500 per side, and use 1,000 per side as a degradation/fallback stress case; do not present the old high-end-phone result as a new mid-phone measurement.

Non-unit materials are `Town`, `Team`, and where appropriate `Ground`. `Team` is neutral `#BFBFBF`, normally 5–15% of building surface; flags and ownership marks must survive the far LOD. `Ground` uses alpha MASK 0.5 and an irregular soft-looking cutout edge, not a square/hex plinth or transparent sorting-heavy plate. No ground plate under an ordinary building. Fields/camps/improvements may include the specified patch.

One atlas set per file, up to 2048 for the source building asset; retain the current 1024 shipping convention where established and visually adequate. Nature uses 1024. Base colour is sRGB with baked AO; normal and ORM are linear, ORM channels R=AO/G=roughness/B=metal. Use the branch packing pipeline; no unsolicited 4K escalation. The 200 px/m house and 100 px/m landmark detail goals must be reconciled with a shared atlas through tiling/reuse and camera proofs, not falsely claimed for every unique face. Unit materials use the existing flat tags (`Team`, `Skin`, `Emblem`, `Metal`, `Wood`, `Leather`, `Cloth` and established variants).

Tone checks preserve the model plan's effective-value floors (Town 0.26, Team 0.30) and same-age reference comparisons. Lighting/exposure and runtime tint must also be checked; increasing atlas brightness cannot repair a wrong shader or broken colour space. No gore assets; hit feedback uses dust/sparks. UI and banner cues must remain readable without colour alone.

### 3.3 Scale, rig and sockets

- Static map/battle scenery: 1 Blender unit = 10 m, Z up, front -Y; glTF +Y up/+Z forward. Origin at footprint centre and ground. Use true widths/depths, existing 1.3x building-height convention, and applicable landmark heights. Battle scenery conversion is 2.75 tiles per model unit. Never apply unit normalization to scenery.
- Units: standing human reference height 1.0 in the authored file, with class-specific runtime scaling; glTF feet at y=0, +Z forward. Preserve current metadata for vehicle height and squad spacing. Compare a repaired figure to its unchanged neighbors before adjusting dimensions.
- Humanoids: preserve canonical `Root`, `Hips`, torso/head, arm/forearm/hand, leg/shin/foot and `Prop_R`, `Prop_L`, `Prop_Back`. Copy actual bone names from `ti_units.py`, not abbreviated prose.
- Mounts: actual `Mount_*` names in `ti_units.py`/`ti_mounts.py`, including front/hind left/right conventions and `Rider`. Resolve the older `Mount_LegFL` prose aliases in a manifest; do not rename delivered bones blindly.
- Machines: preserve `Hull`, `Turret`, `Barrel`, `Wheel_*`, `Track_L/R` and existing rig-specific moving parts. Inventory crew namespaces and attachment flags; two crew members with the same local bone name must not collapse onto one VAT channel.
- Prefabs: preserve applicable door, rally, banner, drop, fire/smoke and worker sockets. Sockets are not additional gameplay spawn rules. Verify transformed socket positions after scale, mirroring and LOD selection.

### 3.4 Per-item delivery

Every new or repaired model package contains an editable packed `.blend`, uncompressed `.glb`, reproducible `build.py` or repository builder reference with exact revision, design/reference sheets, textures where used, packed game export, previews at all shipped LODs, validation/tone reports and a manifest with hashes, paths, object names, dimensions and provenance/licensing. Retain the original source when repairing; never overwrite the only editable copy with a packed runtime export.

Animated packages additionally contain exported clip inventory, rig/rest-pose signature, loop/one-shot flags, duration in seconds, sample rate, root displacement, contact/release phase, end-pose policy, attachment tracks and bake metadata. Proposed VAT schema must be versioned and agreed in the pilot before mass export; no invented path is an existing runtime contract. Keep VAT derivatives out of hand-authored source data.

Use current runtime filenames. Examples: `src/assets/units/<age>-<class>.glb`, `src/assets/units/signature/<model>.glb`, `src/assets/battle/nature/vegetation-<climate>.glb`, `src/assets/battle/rts/rts-<age>[-<theme>].glb`, `src/assets/battle/city/...`. Settler close-view asset paths require resolver design at G1; do not place them in a unit folder and assume automatic world-map use.

## 4. Production stages and dependency gates

These are future tasks, not work performed by this planning change. Role labels describe responsibility and do not presume staffing or delegated agents.

| Batch | Work and deliverable | Depends on | Exit evidence |
|---|---|---|---|
| AP00: reconcile | Technical artist inventories GLB objects, skins, clips, LODs, textures, sockets, packed/source correspondence, runtime resolver and queue ancestry. Reproduce audit camera shots. Produce exact reuse/repair/new/blocked decisions for all 54 rows. | Pinned branch and all editable sources available | G1: no unexplained missing asset, duplicate commission or unassigned requirement |
| AP01: playback pilot | Renderer engineer implements the separately tracked VAT/bake/state contract; animator proves Bronze foot melee and worker walk/work/hit/death plus one multi-part siege clip. | AP00 rigs and runtime constraints | G2: plays in actual instanced renderer, obeys events, survives LOD/pause/resume, within phone budget; screenshots alone are insufficient |
| AP02: map/civilian clarity | Integrator fixes movement/route/icon visibility; artist assembles Bronze settler from reusable parts if 3D is selected, verifies camp and village growth states. | AP00; AP01 only for skeletal caravan motion | Army/settler stops at correct tile; icon/close view agree; outpost clearly differs from mature settlement |
| AP03: core foot/work library | Animator finishes reusable melee, bow, gun and worker libraries; technical artist retargets audited Bronze through Gunpowder meshes and signature exceptions. Include food-to-barrow loading, tree/axe and stone/ore/gold/pickaxe work, loaded return and real drop-off. | AP01 | Correct job/weapon actions, stable death and withdrawal; no wrong material or rig deformation |
| AP04: mounts/machines | Horse/rider, audited chariots, ram/ballista/trebuchet/cannon cycles; repair missing wheel/weapon/crew separation. | AP01 plus AP03 shared crew motion | Matching crew, chassis and event timing; correct moving/rest states; no weapon sliding |
| AP05: landscape/node readability | Review three delivered vegetation kits and six node/herd files; produce four missing climate kits from design sheets; verify depletion and click targets for harvestable trees. | AP00; AX01 skeletal motion also AP01 | Seven climate selectors resolve intentionally; nodes readable and spatially consistent |
| AP06: towns/structures | Repair culture/era/fallback assignments first; then only failing camp/house/wall/damage/scaffold/ownership components. | AP00; objective/HP contracts from implementation W06/W12 | Same city identity in campaign/battle; damage/repair state matches actual data; construction quality retained |
| AP07: presentation integration | Wire effects, accepted/rejected order markers, footprints, compact hammer/wand/deselect controls, resource/supply labels and all UI groups. Remove the manual Reserve control after the new starting-roster rule is implemented. | Correct order/visibility/sim contracts; AP03/04 for release timing | Readable phone behavior; no cues for rejected orders or hidden enemies; actual eight FX ids resolve |
| AP08: compatibility and release | Retarget compatibility pass on all five ages and 150 signatures; stress performance, archive sources, package checkpoint and mark only evidenced rows accepted. | Required portions of AP02–07 | G3/G4 below; no missing/unsupported rig silently called complete |
| AP09: optional polish | Founding/growth reveals, alternate attacks/deaths, cheer/rally detail, ambient herd motion and supported gate transitions. | Core acceptance and budget headroom | Each feature justified by readability; reduced-motion/static fallback; no rule changes |

**G0: prerequisites recorded.** Confirm local Blender access for actual production; resolve missing archived source files by retrieving delivery archives. The historical handoff's “25 not yet uploaded” is superseded by later import records and is not a reason to rebuild those 25 assets.

**G1: quantity lock.** Export an asset-to-rig-to-clip matrix. Each model revision references all applicable audit IDs and one existing queue identity, or documents why it needs a new one. Report counts separately for models to repair, models to build, clip masters, per-model retarget/bakes, procedural effects and UI tasks. No fixed total of new meshes is promised before this gate.

**G2: playback proof.** Prototype must include all of: supported vertex texture/precision path; deterministic clip selection from sim state; ordinary and signature unit resolution; invalid-data fallback; bounds/picking; material tags; one-shot death; LOD transitions; resource unloading; repeated battle cleanup. If VAT is unsuitable on a supported device, preserve the approved cheap fallback and document the alternate instanced strategy before mass production.

**G3: audit acceptance.** Required A-priority checklist items below pass the audit reproduction scenes and mobile review. Optional rows can remain deferred with an explicit reason; never mark their art delivered just because a fallback exists.

**G4: delivery acceptance.** Source and packed files match manifests, archive downloads and checksums work, in-game/performance evidence is stored, queue statuses distinguish imported from accepted. Future gameplay/renderer changes run repository lint, Vitest and relevant battle/e2e checks; an art-only delivery does not edit engine tests or gameplay rules to make bad art pass.

## 5. Animation production tickets

Priority A is necessary audit remediation or its prerequisite; B is the next quality/coverage pass; C is optional polish. Some A work is validation or renderer integration with no new clip.

### 5.1 Map and settlement motion

| ID / priority / batch | Production task | Reuse and output | Acceptance |
|---|---|---|---|
| AN01 / A / AP02 | Interpolate army position and heading along accepted routes; handle route change, arrival, interruption, zoom and map wrap | Existing marker/models; procedural transform animation, no authored locomotion requirement at icon zoom | I070: no teleport between visible route segments, overshoot or travel after cancellation; animation never changes turn cost; fog hides unknown movement |
| AN02 / A conditional / AP02 | Settler walk, pack animal gait and wheel rotation for the chosen caravan assembly | Existing humanoid/ox/cart rig where suitable; Idle and Move/Walk adapters; wheel speed follows distance and radius | I095/I099: civilian silhouette at close zoom, stationary when held, matches icon route; no generic “walk” deforming wagon/driver |
| AN03 / B / AP09 | Founding: supplies/unpacking and camp reveal | Prefer procedural staged appearance; bespoke hand placement only if visible at real camera | I054–I056: starts only on accepted founding; cancel/reload never duplicates camp; reduced motion reveals final state immediately |
| AN04 / B / AP09 | Camp to village growth | Existing camp/small-town assets, bounded crossfade or reveal; no new town tier by default | I054/I055: persistent city ID/location, stable terrain contact and cultural appearance; no wrong walls/palace appearing during transition |

### 5.2 Shared combat and locomotion

| ID / priority / batch | Production task | Reuse and output | Acceptance |
|---|---|---|---|
| AN05 / A / AP01, AP03 | Idle/alternate idle, Walk, Run; Charge only where the state exists | Canonical humanoid masters; retarget compatible units; preserve neutral Idle frame 1 | I219/U07: planted feet, no root travel duplication, no T-pose during loading, stable start/stop/heading; animation pace follows actual cavalry/infantry/siege travel speed and group matching |
| AN06 / A / AP03 | Melee anticipation, strike and recovery; second strike/block where supported | Spear/pike thrust master and sword/axe swing master with weapon-length cleanup | I219: contact pose follows the actual attack event; blocked/out-of-range orders do not play a successful strike; pikes do not whip like swords |
| AN07 / A core, B variants / AP03 | Bow draw/aim/release/nock; rapid/volley/aim-hold variants only for supported use | Existing Bronze bow clips first; transfer to appropriate bow geometry, quiver and string | Arrow remains in hand until release, does not duplicate projectile; reload interrupted safely by move/death; high/low aim fits target elevation |
| AN08 / A audited guns / AP03 | Gun aim/fire/recoil/reload; musket ramrod versus later mechanisms; kneel/bayonet only where useful | Gunpowder master first, compatible firearm variants second | I219 and Kerma log R144–157: one muzzle event per shot, correct attachment, no magazine swap on a musket, no gameplay cooldown extended to match art |
| AN09 / A core, B variants / AP04 | Horse/rider idle, walk/trot/gallop, charge, rider attack, hit, death and rout | Existing horse rig; coupled mount/rider tracks with weapon-specific overlays | Rider remains seated, feet/tack/weapon aligned, correct gait rather than all legs in phase; no live moving mount left behind by a dead-unit visual |
| AN10 / B, required when fielded / AP04 | Chariot gait, wheels, driver, archer/spearman, hit and wreck | Existing Bronze chariot and relevant signature rigs; driven-wheel motion and crew retarget | Audited Akkad-era roster plus Kemet/Andronovo-type exceptions: wheel axes correct, harness continuous, driver does not perform attack, no cloned crew weights |
| AN11 / A first death/hit, B alternate / AP03, AP04 | Hit reaction and terminal death/wreck for each applicable anatomy | Share humanoid reactions; separate mount, chariot and machine terminal poses | I195/I219: exactly one terminal transition; corpse holds final pose without sinking, resurrection or repeated falling; hit never interrupts death |
| AN12 / A / AP03, AP04 | Routed run versus ordered withdrawal | Keep established `Retreat-run` or `Rout` aliases in metadata; controlled withdrawal uses locomotion/ready state | I012/I013/I188–I191: disciplined retreat does not visually imply panic; cancelled withdrawal resumes correct order; no retreat animation during fighting unless sim says so |
| AN13 / B / AP07, AP09 | Hold/guard, shaken and rally readability | Reuse ready Idle/Block/Hit and a brief overlay; new semantic clips only with state hooks | Hold is stationary, shaken cue modest, rally ends at actual state change; no permanently raised shield or additive pose drift |
| AN14 / C / AP09 | Victory reaction | Adapt existing Cheer/Victory concept; no unique animation per people | Only survivors after verified result; not triggered by a premature local victory; skip for retreat/dead/hidden units and reduced motion |

### 5.3 Workers and machinery

| ID / priority / batch | Production task | Reuse and output | Acceptance |
|---|---|---|---|
| AN15 / A / AP01, AP03 | Food collection into a barrow/handcart; axe Chop at trees; pickaxe Mine at stone, ore and gold; supported generic gather cycles for other real jobs | Use actual worker clips rather than assuming all jobs use `Attack`; compatibility alias only when current consumer requires it | I219/U06: correct tool makes contact with the correct node and the gathered object enters the barrow; no chopping fish, picking trees or harvesting empty ground; loop halts on depletion, move, death or job cancellation |
| AN16 / A / AP03 | Empty outbound trip, loaded wheelbarrow return and Deposit at the actual drop-off | Shared walk plus barrow/handcart, wheel rotation and visible food/log/stone/ore/gold load; short unload variant | U06: inventory/visible load and trip phase agree; stock changes at the sim deposit, not earlier; goods disappear only on real deposit or loss; no double load baked into mesh and attached prop |
| AN17 / A / AP01, AP03 | Build and Repair with transitions | Existing worker body, task tools and shared work master | I182/I184/I219: worker faces real target and remains in work range; assist/repair/cancel state switches do not imply progress when blocked |
| AN18 / A relevant machines / AP04 | Move/push/haul and stationary deployment pose | Existing chassis, wheel/crew rigs; procedural wheel angle where possible | I213/I219: crew pushes in correct direction; no firing carriage translated by animation; movement stops immediately when authoritative state stops |
| AN19 / A / AP04 | Ram swing; ballista tension/fire/reload; trebuchet arm/sling/reset; cannon aim/recoil/reload | One cycle per actual machine mechanism, shared crew masters; keep external projectiles in FX path | I211–I213: release aligns to sim event, moving parts do not intersect crew, reload resets mechanical pose; interruption leaves a valid state |
| AN20 / B / AP04 | Machine hit/destroyed and crew terminal response | Existing damage/wreck components, brief procedural jolt/debris before bespoke destruction | Destruction is one shot and ends in stable low-cost wreck; no moving surviving crew that falsely represents active units |

### 5.4 Structures, UI effects and resources

| ID / priority / batch | Production task | Reuse and output | Acceptance |
|---|---|---|---|
| AN21 / A preserve / AP06 | Scaffold/progress/completion | Keep current four `construction-stage-0..3` roots and rising-wall fallback; fit new/repaired geometry | Preserve praised construction; stages match actual progress, no float/ground pop or scaffold occluding the finished doorway |
| AN22 / A states, B transitions / AP06 | Intact/damaged/ruined/breached and repair restoration | Existing house/wall/palace/ruin assets; limited dust/debris transition | Correct HP/damage state in battle and campaign, matching footprint; no visual healing before actual repair or civilian destruction outside supported rules |
| AN23 / B conditional / AP06 | Gate state readability and optional hinge/slide | Baseline uses existing open/breached geometry; motion only for a supported transition | Gate appearance matches passability; no fake open/close order, blocking animation or invented collision rule |
| AN24 / A identity, C flag raise / AP06, AP07 | Ownership material/banner change; optional flag raise | Existing Team materials, emblem and sockets | I130/I209: update after verified capture, correct side in all LODs and fog states; no stale enemy tint after refresh |
| AN25 / A / AP07 | Accepted/rejected order pulse, placement footprint, selection | Shader/UI motion with non-motion alternative | I173–I191: accepted pulse only after acceptance, rejected reason distinct, doesn't obscure target or imply legal placement through fog |
| AN26 / A / AP05 | Full/half/depleted and tree/felled/stump transitions | Existing named node objects and new vegetation equivalents | I175: state follows actual resource amount; collision/placement uses sim footprint, not decorative outline; depleted nodes do not visually remain harvestable |
| AX01 / B supporting / AP05, AP09 | Herd idle/graze and any supported movement/flee/death | Existing sheep/goat/cattle; minimal rigid motion until rig/VAT is justified | Animals do not leave their actual node, imply nonexistent movable food rules or turn depletion into graphic slaughter; far state can remain static |
| AX02 / A supporting / AP07 | Projectile socket/release, muzzle flash, dust/smoke/impact synchronization | Existing projectiles and eight FX sheets; alias older 22 concept names to current IDs where semantically appropriate | One projectile/impact per event, correct gun/bow/machine origin, no ghost projectile on cancel; effect caps, overdraw and reduced-flash setting checked |

### 5.5 Clip production rules and counts

Animation masters are shared by compatible anatomy and action, not by nationality. A unit may need several weapon-specific adaptations, but that does not imply a new body. A model's retarget and VAT bake remain distinct deliverables even when the source action is shared.

At AP00 build the matrix for: humanoid melee, bow, firearm, worker, horse/rider, chariot, ram, ballista, trebuchet, cannon and supported herd motion. General/standard-bearer, support and signature rigs enter through the relevant family. Include firearm-using cavalry and unusually long spears as exceptions. AP08 checks Modern vehicles/ATGM/aircraft and camel/elephant/ox signatures for regressions and unsupported rig behavior; their complete optional motion libraries remain the broader art program unless an actual audit-relevant state depends on them.

For each action: select filmed/reference motion or licensed motion capture; establish poses; retarget; clean weapon grip and feet; remove travel root motion; preserve local falling displacement for terminal poses; export at 20 fps; record seconds/phase for contact; bake; inspect runtime. Translate `Victory`/`Cheer`, `Rout`/`Retreat-run`, and generic `Attack` versus `Fire`/`Chop` names through an explicit compatibility table. Do not rename existing clips on speculation. Maintain anticipation/contact/recovery quality at the actual cooldown; cap presentation speed adjustment and use holds/blends where a short sim interval cannot fit a long physical reload.

Loop tests compare first/last pose and velocity without duplicating the endpoint frame. One-shot clips hold the final pose or transition explicitly. Random idle phase is cosmetic and must not consume game RNG; attacks synchronize to their own event phase, not random per-soldier offsets. Pause, tab suspension, speed changes, checkpoint resume and LOD re-entry select current state rather than replaying old events in a burst.

VAT sizing is a production constraint: record vertices × samples × bytes per position/normal stream plus metadata and mip/format overhead. Bake mesh correspondence after the chosen packing/reordering stage, or preserve a stable vertex index and regenerate when it changes. Check bounds over every clip frame, not just Idle; melee weapons, falls and wheel motion must not disappear at the screen edge. A far LOD must not render a standing live silhouette for a dead unit.

## 6. Model and prop production tickets

| ID / batch | Required content and source reuse | When new geometry is justified | Exit check |
|---|---|---|---|
| MD01 / AP02 | Civilian traveler, baggage and chosen wagon/pack animal. Reuse worker/body, Bronze support ox/cart and props where suitable. New design sheet must distinguish settler from soldier and raider. | Current marker plus reusable assembly cannot meet close-view silhouette/era needs. Bronze first; carry forward five-era settler backlog rather than produce culture duplicates. | Icon/3D transition keeps identity, readable bag/cart at phone size, correct pivots/rig, no army weapon loadout; exact new filenames and resolver documented at G1 |
| MD02 / AP02, AP06 | Existing `colony-camp` shelter/supplies and small-town village silhouette; growth uses existing layout. | Camp missing required pieces or too weak after scale/placement fix. Add only necessary props/variant, not an entire city family. | Fits 18×16 m camp convention, irregular ground, clear early status, no mature-city walls; camera and culture match growth destination |
| MD03 / AP06 | Bronze Mesopotamian town assembly: inspect base/Levant Bronze assets and actual culture/era resolver; match house damage variants. | A specific incorrect roof/landmark survives mapping correction and fails reference review. | I215: no unexplained red-roof fallback; correct intact/damaged/ruined style and free civic centre; campaign and battle compare side by side |
| MD04 / AP06 | Nile/Nubian town, field and vegetation assignments; preserve Nile farming and terrain data. | Historically grounded, named component genuinely missing after selectors are checked. | I216: wrong culture fallback corrected without replacing valid green farmland; place/age recorded, no blanket “African” style |
| MD05 / AP05 | Seven climate kits with `tree-s/m/l`, `stump`, `felled`, `bush`, `rock-s/m`, `grass-tuft`; use current three kits as baseline, four new kit files. | Conifer/tropical/steppe/cold files are missing. Existing three get silhouette/material/LOD repairs where the tree graphics fail; selection geometry and resource-node identity are checked separately from decoration. | I217: all nine roots per kit, LODs and 1024 atlas; distinct climate silhouettes, no noise/floating trees, stumps/felled align with standing base |
| MD06 / AP05 | Ore/stone/gold/fish full/half/depleted plus sheep/goat/cattle and wood-grove pieces. Reuse six present node/herd files. | Node remains unrecognizable after scale/material/lighting correction, or required state/root absent. | I175: users can identify resource and blocked footprint, depleted node readable; fish remain water-linked, no new gameplay node type |
| MD07 / AP03 | Tool and load inventory: axe, pickaxe, hammer, mattock/hoe/shovel where used; wheelbarrow/handcart, basket/sack and distinct food/log/stone/ore/gold contents. Inventory embedded props first. | A job supported by sim has no compatible visible tool/barrow/load. | U06: grip/sockets correct in all motions and LODs; cargo fills and unloads once at the real phases; wheels roll while moving; tools match era/job; no unnecessary worker body variants |
| MD08 / AP06, AP07 | Team banners/pennants, ownership sockets and persistent silhouette marker. Reuse existing Team surfaces and emblems. | Outline/icon alone insufficient or a socket/cloth surface is absent. | I209: friendly/enemy/selected distinguishable in colour and shape; far LOD preserves marker; no new building mesh solely for ownership |
| MD09 / AP03, AP04, AP08 | Repair existing soldier, mount, shield, weapon, cannon, tank, artillery and crew silhouettes; verify camera, class scaling, height metadata and auto-LOD first. | Specific rig, geometry, material tag, scale or far-LOD feature fails. Preserve signature identity. | I218/U08: large machines read bigger at actual zoom, with crew and weapons in proportion; no disappearing barrel/tank tracks, high-poly escalation, collision change or overlap with squad positions |
| MD10 / AP04 | Separate/rig existing wheels, launcher parts, ram beam, cannon/artillery barrel, tank tracks/turret and crew attachments; maintain machine footprint. | Part missing or joined so required motion cannot be represented. | I213/I219/U08: anatomy/axes correct, pivots stable, cannon recoils along bore, tracks/crew remain aligned at increased display scale, sling/string release plausible, crew count included in budget |
| MD11 / AP06 | Existing house, wall, gate, civic/palace and rubble states. Preserve checkpoint 36 lit ruin interiors and checkpoint 37 Gunpowder bastions. | Named culture/size/state missing or inconsistent after mapping repair. | Same footprint, ground and orientation across states; repair restores original; no black cuts, overlapping rubble or replacement of bastions with medieval wall |
| MD12 / AP06 | Four construction stages and scalable scaffold adapters around changed structures. | Existing scaffold cannot fit without clipping door/footprint or breaking progress readability. | Current good construction remains good; stage bounds and socket access correct, no new foundation collisions; finishes at actual progress |

### 6.1 Vegetation batch design

Each kit is one file containing nine named roots; each root has the applicable LOD children. The four new files therefore introduce **36 required object roots**, not merely four tree meshes. This is a structural count; silhouette variants inside each kit must be listed separately at G1.

| Climate | Reference direction | Production treatment |
|---|---|---|
| Desert/oasis | Date palm, spreading acacia, dry scrub | Existing kit: improve only failed forms; keep sparse and avoid making every desert an oasis |
| Mediterranean | Olive-like spreading form, upright cypress, umbrella pine and scrub | Existing kit: retain distinct silhouettes at far LOD |
| Temperate | Broadleaf crowns, young tree, bush/grass | Existing kit: stop noisy repeated cones; canopy and trunk survive reduction |
| Conifer | Pine/spruce/fir silhouette family | New kit: needle canopy clusters, small/medium/large profiles; snow handling only where terrain selects it |
| Tropical | Broadleaf canopy, palm accents and low understory | New kit: large readable masses, controlled alpha overdraw; avoid jungle density around every building |
| Steppe | Grass and scrub dominate, sparse trees appropriate to location | New kit: no mandatory dense forest; tree roots satisfy loader contract but placement reflects ecology |
| Cold | Dwarf birch/larch or low hardy scrub and rock | New kit: sparse profiles and compatible snow tint; do not blanket tundra with tall temperate forest |

The queue has an old `vegetation-scrub` row marked delivered while runtime uses `vegetation-desert`; it has no straightforward seven-row climate inventory. AP00 must reconcile this alias and explicitly account for steppe without counting desert twice or deleting the historical scrub delivery.

## 7. UI and icon tasks attached to art production

These remain in the manifest because they close visual audit findings, but they are not mesh commissions. Existing SVGs and UI systems are the starting point. Use current interface specifications, landscape 844×390 reference plus the audited 844×340 short viewport, 44–48 px touch targets where interactive, and static/reduced-motion alternatives.

| ID / batch | Work | Completion evidence |
|---|---|---|
| UI01 / AP07 | Wheat/cotton/papyrus registration, visibility, contrast and scale; redraw only if necessary | All three existing icons readable at the intended map zoom and era; no hidden tile information revealed |
| UI02 / AP02 | Settler glyph and 3D handover, destination/route distinction | Civilian symbol visible before selecting it; stable identity across zoom and both map modes |
| UI03 / AP07 | Major/independent/outpost/raid-party badges | Shape/text distinction at phone size; no reliance on tint or animated pulse alone |
| UI04 / AP06, AP07 | Friendly/enemy/selected building outline/base marker | Both teams and selected state distinguishable over bright/dark terrain; structure itself remains legible |
| UI05 / AP07 | Build-menu preload, placeholder and thumbnail consistency | First cold-cache open never blank; one consistent thumbnail per missing real asset, no duplicate generation for already shipped images |
| UI06 / AP07 | Legal/illegal/blocked/fog placement footprint and field boundary | Overlay follows exact placement predicate and real obstruction, no hidden-resource leakage; hit tests agree |
| UI07 / AP02, AP07 | Move/attack/Hold/retreat/route accepted and rejected markers | Clear command identity, stable at all zooms; pulse cannot conceal refusal or suggest completed action |
| UI08 / AP07 | Full starting-roster and genuine later reinforcement status, Idle N, find army/base/keep and minimap controls | No manual Reserve button/panel remains after U10; every committed starting regiment is accessible, and actual later arrivals still have an identifiable event/marker |
| UI09 / AP07 | Conquest/loyalty/supply/trade warning icon reuse | Correct severity and action; map cue does not invent a 3D character or cinematic requirement |
| UI10 / AP02, AP07 | Settlement legality, selected improvement tile and known recommended sites | Highlight readable under fog/tint; invalid and selected states distinct; recommendation only uses known legal sites |
| UI11 / AP07 | Worker-only circular hammer launcher; compact wand launcher for abilities/powers; icon-only cancel/deselect and build-sheet X; sheet closes for placement and reopens after success | U02/U05/U09/U13: 44–48 px targets with accessible names, one active sheet/ghost, correct close precedence, no tap-through, stock refreshed after placement, no visible text on the three launchers |
| UI12 / AP07 | iPhone Dynamic Island/notch and landscape safe-zone layout; sheets adapt to available left/right width | U03: top values and fixed controls remain inside physical cutout-safe visible bounds at both phone orientations and 844×390/844×340; side sheets reverse/resize/scroll without hiding X or confirm |
| UI13 / AP05, AP07 | Selectable harvestable tree/grove node ring, resource name/remaining amount and touch target matched to the rendered tree | U04: tapping a tree selects/inspects it or sends the selected worker to gather; decorative trees and drag gestures do not trigger false selection; fog/depleted feedback honest |
| UI14 / AP07 | Distinct Food, Materials, Stone and Gold stocks plus numeric current/cap Battle Supply at the top | U01/U12: no timber icon masquerades as stone; critical stone and supply numbers remain visible on short cutout phones, update from sim, and have accessible full labels without cramped tiny text |

### 7.1 Later player-requested art and interface contract

The U01–U13 addition was checked against the current battle sources at `9d7b49b81865eef92ad3a85d309bdff6ad2499f8`. Stone currently feeds shared Materials; the art team supplies a distinct stone glyph and stock readout only after engineering gives it a distinct account and useful spend paths. Battle Supply is a separate existing meter and must remain visible in economy battles. UI14 needs five simultaneous current values, with current/cap for supply. On narrow phones, shorten the battle title and secondary labels before hiding any of those values; an expanded resource detail view may explain gain, spending and node provenance.

For U02/U05/U09/U13, mock the full interaction at 844×390 and 844×340: worker selected → circular hammer → build sheet → choose building → sheet hides and ghost appears → successful placement → sheet returns → X closes it. An invalid placement keeps a readable reason and a cancel action. The circular wand opens a single sheet for applicable abilities and powers, with readiness/cooldown/cost visible inside. The icon-only cancel control first disarms the current target/ghost, then clears selection when nothing is armed. These launchers have no visible text, but each needs an accessible name, pressed/disabled state, pointer and keyboard focus treatment and 44–48 px hit area. An X on the selection chip already exists for squads; extend the interaction consistently to workers, buildings, nodes and armed actions rather than stacking duplicate overlapping X buttons.

For U03, author previews on a cutout iPhone in both landscape orientations. The safe region must be measured from the physical screen and the browser's `visualViewport`; `env(safe-area-inset-*)` is an input, not a passing test by itself. Top resources/supply, pause/speed, bottom launchers, sheet X, placement confirm and dismiss action must stay clear of the Dynamic Island/notch, home indicator and rounded corners. Side sheets should choose the side with usable width or collapse to a scrollable compact sheet, preserving the field and touch targets.

For U04, a harvestable grove's visible tree, selectable screen target, resource ring, info card and worker gather target must name the same node. Tree artwork may be repaired for silhouette and LOD, but a decorative tree cannot pretend to yield wood. For U06, the worker rig needs an axe, pickaxe, barrow/cart and distinct visible cargo, with animation tied to the existing gather/return/drop job phases. Food loads into the barrow, logs accumulate after axe work, and stone/gold/ore follow pickaxe work; an empty barrow travels out and a loaded one returns to the drop point. The stock change remains the simulation's deposit event. For U07/U08, body gait and wheels follow actual class speed, and larger cannon/tank/artillery display scale must keep crew, hit tests, footprint and phone budgets aligned.

U10 replaces the manual Reserve button with the full committed starting force. Art/UI work must remove the button and reserve sheet when the new battle rules land, then preserve a distinct cue only for genuinely later allied/reinforcement arrivals. A mockup that merely hides the button while units remain off-field fails. U11's nonresponding units require a target/order trace and sim fix; do not commission a new attack animation to conceal an ignored order.

## 8. Acceptance scenes and engineering handoffs

### 8.1 Required scene matrix

Capture the same seeded scenes before/after. Store version, seed, people, age, map/battle settings, camera, viewport, renderer quality and device with every proof. Use a screen recording for motion and screenshots for silhouette; Blender beauty renders alone do not close an audit.

1. **Akkad/Bronze:** march at icon and close zoom; civilian settler moves, stops and founds; outpost grows; town style; spear, archer, chariot and ram; wood/stone/ore depletion and ownership. Include audited signature models actually selected, not only generic substitutes.
2. **Nile/Kerma:** cultivation in valid Nile terrain, local town style, early bow troops, and Gunpowder-era musket/cannon sequence matching the audit. Inspect whether every visual uses land theme, owner/army identity and age appropriately.
3. **Workers:** every supported job, food loading, axe/tree, pickaxe/stone/gold/ore, empty/loaded wheelbarrow travel and actual deposit; build/assist/repair, unreachable target, cancelled job, depleted node, death while carrying and resume after pause. Verify stock rises only after delivery.
4. **Combat:** idle/walk/run/attack, ranged release, damage/death, full initial roster, genuine later reinforcements, Hold, controlled withdrawal, actual rout, interrupted attack, verified victory and defeat. Include mixed weapons and general/standard-bearer assemblies. Compare cavalry, infantry and siege travel over the same ground, and inspect enlarged cannon/tank/artillery at the actual camera.
5. **Buildings:** construction at each boundary, damage/ruin/repair, keep versus capital palace, capture tint, wall breach and current open gate; campaign/battle manifestation of the same damage record.
6. **Environment:** all seven climate selectors including fallbacks, three zoom bands, dense town plus vegetation, clickable harvestable trees versus decorative trees, water/fish, resource depletion and placement rejection on resource footprints.
7. **Compatibility:** all five ages and 150 signature assets enumerated by resolver/rig check; visual contact sheets for every changed model; motion review per distinct rig/weapon and every exception. A shared rig pass does not certify a differently weighted model.
8. **Stress/accessibility:** 844×390, 844×340, a physical cutout iPhone in both landscape orientations, and 1280×800; low/high quality; 300/500 per side; stress degradation at 1,000; cold/warm cache, reduced motion, pause/tab suspension/resume, camera edge and fog transition. Exercise hammer → place → sheet reopens → X, wand, deselect, four stock values and Battle Supply. Verify acceptable contrast without depending on red/green.

### 8.2 What art needs from engineering

- AP01 receives a versioned presentation state/event interface and VAT format; current code remains the authority on supported states. Animation events never create damage, resources or capture.
- AP02 receives true route progress, wrapped-world interpolation, settlement phase and visibility. The artist does not fabricate a route or arrival timer.
- AP03/04 receives actual attack timing, job ID/phase, node kind, carried resource/amount, drop-off, interruption/death and attachment origins. Core order/retreat and U11 defensive-response defects must be fixed independently; clips cannot make an ignored order work.
- AP06 receives culture/era selection, city manifest, real HP/damage state, construction progress and gate/breach semantics. Campaign buildings and temporary battle economy buildings must not accidentally share persistence rules.
- AP07 receives accepted/rejected command responses, exact placement footprint, stone/supply values, new starting-roster/reinforcement states, safe viewport rectangle and information visibility. Cues cannot reveal an enemy through fog or display success before acknowledgement.

Future art-only work must not modify game code or tests to conceal an asset defect, in line with the local handoff. Necessary playback/selector/UI changes are explicitly assigned engineering tickets, reviewed and tested separately from asset deliveries. Their existence is a dependency, not permission to implement them during this planning task.

### 8.3 Additional loopholes to close

1. **Rig inheritance is not enough:** differing rest poses, bone scales, weapon grips, cloak weights and multi-armature crews can break retargeting even when names match. Compare bind poses and joint transforms before bulk bake.
2. **Mesh packing can invalidate animation:** meshopt/reindexing and generated LODs may reorder vertices. Tie VAT data to the exact packed geometry hash and fail visibly to a valid static/procedural fallback on mismatch.
3. **Deformed silhouettes need correct bounds:** include spear tips, recoil and fallen bodies; update visible and depth passes consistently. Do not enlarge gameplay collision to match animated bounds.
4. **Memory leaks hide in repeated battles:** measure texture residency after entering/exiting several battle types; reference-count shared VAT/atlas resources and release per-battle instances. Lazy load by roster/age instead of preloading 150 signature libraries.
5. **State events can replay twice:** visual event IDs should deduplicate reconnect/replay/late-snapshot bursts; a dead soldier must not emit another death or projectile when returning from a background tab.
6. **Idle and job motion must not imply success:** working while unreachable, spinning cannon wheels while stationary, celebrating disputed victory and moving animals outside static food nodes mislead even when attractive.
7. **Cultural fallback can be correct or wrong by context:** town land style, army people's signature and owner's colour are separate. Capture changes ownership without instantly replacing the city's architecture.
8. **LOD can erase function:** test distant flags, doors, wagon wheels, spear/shield identity, node depleted silhouettes and continuous ground. Preserve the prior LOD ground/prop repairs when re-exporting.
9. **Four new climates are nine-root kits:** an attractive single tree cannot satisfy bush/rock/grass, felled, stump and LOD contracts. All roots and terrain selection must be tested together.
10. **FX names and file counts are different concepts:** the old 22-sheet plan and current eight IDs require an explicit mapping. Do not generate `cannon-smoke` and assume a loader that asks for `smoke` will discover it.
11. **Source availability is a delivery dependency:** runtime GLBs do not prove editable BLENDs are archived. Retain sources, generated clip manifests, licenses and checksums before replacing old assets.
12. **Timing quality is independent of FPS labels:** 20-fps authoring is not permission for jerky playback. Interpolate samples where supported, test fast weapons and wheel rotation, and record contact in seconds/phase rather than copied 30-fps frame numbers.

## 9. Pre-audit backlog relationship and exclusions

| Earlier requirement | Relationship to this audit plan | Next treatment |
|---|---|---|
| Five generic settler models plus older Israelite variants | MD01/AN02 overlap; ordinary culture-unit expansion was later dropped, but generic settlers remain pending | Bronze pilot, then supported five-age coverage; reconcile obsolete culture rows before scheduling |
| VAT Wave 0b and shared unit animation libraries | Direct prerequisite for I219 and AN05–AN20 | AP01 is first animation engineering gate; preserve delivered meshes |
| Seven climate kits | MD05 directly overlaps; four files still absent | Complete four missing kits and repair existing three only where needed |
| Full ordinary/signature unit roster | 46 + 150 runtime GLBs already present | Compatibility, animation retargeting and specific repairs; no second model roster |
| Buildings, camps, houses, walls, ruins, construction | Reused by MD02/03/04/08/11/12 and structure motion | Mapping/state validation first; gap-specific geometry only |
| Remaining ships/carrier/transports and naval motion | Broader pre-audit backlog; inland-ship audit is primarily an eligibility bug | Keep in old roadmap; no new fleet commission from this audit |
| Complete Modern vehicle/aircraft and exotic-mount motion | Broader library requirement with shared-pipeline compatibility dependency | AP08 must preserve fallback and identify unsupported rigs; full new motion expansion is separately sized |
| Mountain/coast/river/bridge/terrain kit program | Existing map/battle art roadmap, not automatically required by poor-tree or dark-field findings | Repair lighting/placement first; no global terrain re-author here |
| Wonder ruins, optional independent dressings, remaining improvements | Older content coverage; can intersect a reproduced structure-state failure | Add only the exact affected item to MD11 if reproduced; retain rest in old program |
| 150 people emblems, remaining illustrations and cosmetic packs | Broader 2D/product scope | UI rows cover audit visibility/readability; paid-content production follows W16 decisions separately |
| New per-culture ordinary armies | Explicitly dropped by the newer model plan | Do not revive from stale pending rows |

The backlog register should eventually mark aliases and superseded requirements explicitly instead of silently deleting history. Do not mark a pending oil-well entry “ancient” merely because of its legacy path. This planning change leaves the production queue unchanged; its remediation is AP00 work, with a reviewable mapping.

## 10. Packaging, schedule and definition of complete

Sequence the first delivery around AP00 + AP01 proof, then AP02/03 for civilian/readable core action, AP04/05/06 for mechanical/environment/structure coverage, AP07 integration and AP08 acceptance. AP05 concept sheets and AP06 mapping diagnosis may proceed independently of the VAT pilot. Avoid finishing a large clip library before the renderer proves it can use it.

Do not promise a calendar date from the audit counts. After AP00 estimate separately: inspection hours, new design sheets, model repairs/new kits, master clips, retarget/bake exports, runtime engineering and device QA. After AP01 use measured effort for one complete character and one multi-part machine to estimate remaining animation work. A shared clip saves authoring, not all export/review effort. Allocate explicit rework and device-compatibility time rather than claiming a one-week art completion.

Follow the handoff's normal delivery cadence of 20 logical items in four archives of five, when there are that many completed items. A pilot or a smaller final batch should report its actual size rather than padding it. Define a logical item as a versioned model/kit or coherent clip delivery, not every LOD/preview as a separate completion. List object/clip/file counts additionally. Archive original sources outside Git where the repository requires it, retain download links/checksums and commit runtime exports/manifests and evidence through the existing workflow.

Statuses for this remediation ledger should distinguish `inventory-needed`, `reuse-verified`, `repair-needed`, `new-needed`, `blocked-on-engineering`, `delivered`, `in-game-awaiting-review`, `accepted` and `deferred-polish`. These are proposed tracking states; reconcile them with the existing queue schema rather than silently replacing that schema. Only evidence moves an item to accepted.

**Audit visual work is complete when:** every required row has a tested implementation or explicitly justified existing solution; all audit source links are preserved; no confirmed new-file gap is hidden behind a generic fallback; all changed animation/model packages satisfy the technical/style contract; required scenes and phone performance pass; source archives are retrievable; and the user can distinguish the completed audit work from deferred polish and the remaining broader art backlog.

**Deliverables of this planning task:** this plan, the 54-row production manifest, and a correction/link in the previous animation/model checklist. No asset production or gameplay implementation is included.
