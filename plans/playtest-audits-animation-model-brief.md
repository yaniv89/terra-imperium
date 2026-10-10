# Audit fixes: animation, model and visual-asset production checklist

Planning only. No assets or game changes are produced by this document.

**Scope clarification and production detail:** this is an audit-scoped checklist, including overlap with previously planned work, not the complete pre-audit backlog. Read the [detailed art production plan](playtest-audits-art-production-plan.md) and [54-row production manifest](playtest-audits-art-production-manifest.csv) for reconciled specifications, production batches, acceptance gates and backlog boundaries. The plan preserves AN01–AN26 / MD01–MD12 / UI01–UI10, adds four later player-requested UI groups and two supporting checks for herd motion and projectile/FX synchronization. The 13 later player requests are tracked separately in [implementation plan §12](playtest-audits-implementation-plan.md#12-player-follow-up-rts-and-iphone-layout). Its source-authority decisions supersede conflicting technical guidance below.

Sources: the three playtest reports and their [224-item inventory](playtest-audits-item-inventory.md), plus the repository's existing unit art brief and asset/rendering source at `0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091`.

## 1. What actually needs production

The audits directly identify missing map travel animation, limited soldier animation, poor trees, an unclear settler representation, an unexplained early settlement, wrong cultural town appearance, tiny soldiers, weak ownership/resource readability, and missing/blank icons on screen.

They do not establish that every corresponding source asset is missing. Inspection found:

- Existing infantry, ranged, cavalry, siege, general and worker GLBs for the audited Bronze/Classical/Kingdoms/Gunpowder eras.
- Existing damaged-house kits, wall/gate damage-state contracts and regional town infrastructure.
- Existing desert, Mediterranean and temperate vegetation GLBs. The selector also names tropical, conifer, steppe and cold kits, whose corresponding GLB filenames are absent from the inspected nature directory.
- Existing ore, stone, gold, fish and herd resource-node models, including depletion-state conventions.
- Existing `wheat.svg`, `cotton.svg`, `papyrus.svg` and `settler.svg`. Missing icons on the map therefore require visibility/atlas/scale checks before new illustration.
- A map outpost renderer that selects `colony-camp` from shared town assets. Verify that the expected object loads and is visible before commissioning another camp.
- A detailed unit-animation brief, but a renderer using a limited procedural limb shader for movement/attack. File presence does not establish that authored clips exist, export correctly, or play in the active renderer.

**Production rule:** inspect and preview the existing asset first; reuse it if correct, repair it if deficient, and commission only the actual gap. “Produce” below is a deliverable requirement, not a claim that each deliverable must be authored from scratch.

The animation/model budgets in older art status documents are broader than these audits and contain historical progress snapshots. Do not order a complete replacement army or all cultural town packs from those counts.

## 2. Animation checklist

**Priority:** A = first playable remediation batch; B = next quality batch; C = optional polish. These are art priorities, not the implementation plan's P0/P1 severities. Battle result correctness remains an engineering P0 even though it has no art commission.

### 2.1 World map and settling

| ID | Animation | Deliverable / behavior | Production status | Priority / evidence |
|---|---|---|---|---|
| AN01 | Army travel between tiles | Smooth position and heading interpolation along the real route, including stopping at arrival. | Renderer work using existing markers/models; no new skeletal clip required. Never change authoritative movement time. | A; I070, P2 §4 |
| AN02 | Settler caravan travel | Civilian walk plus pack-animal walk and wagon wheel rotation when those parts are used. Stationary version when held. | Reuse humanoid/quadruped locomotion and animate only the chosen caravan parts. | A if using a 3D caravan; I095/I099 |
| AN03 | Founding a settlement | Short unpack/place supplies/raise the camp transition, followed by the persistent outpost. | Recommended visual feedback; simple procedural reveal is sufficient before bespoke character motion. | B; I054/I055/I056 |
| AN04 | Outpost to village growth | Clear transition from small camp to inhabited settlement, retaining location and cultural identity. | Procedural crossfade/build reveal with existing town stages; no cinematic required. | B; I054/I055 |

### 2.2 Shared unit motion and state readability

Use the current model plan and delivered rig: **20-fps** in-place authoring, neutral `Idle` frame 1, seamless loops and event-aligned contact/release timing. The older unit brief's 30-fps specification is superseded by `ART-MODELS-PLAN.md` section 4.1 and `ti_units.py`; do not copy its frame numbers unchanged. Preserve its movement-quality principles. Authored animation must follow the deterministic simulation, not drive damage or movement. Clip-name aliases and root displacement for terminal poses are resolved in the detailed production plan.

| ID | Animation family | Clips / motions to deliver or validate | Production status | Priority / evidence |
|---|---|---|---|---|
| AN05 | Ground-unit locomotion | `Idle`, `IdleAlt`, `Walk`, `Run`; combat `Charge` for appropriate units. | Inspect existing clips, bake/connect them, then repair missing or sliding motion. Share rigs across compatible units. Match visible gait/wheel speed to actual cavalry, infantry and siege travel, including explicit mixed-group pace. | A; I219/U07, P2 §8 |
| AN06 | Foot melee combat | `Attack`, `Attack2`, `Block`; spear/pike thrusts versus sword/axe swings need appropriate weapon motion. | Retarget common rig; weapon-specific pose cleanup. Do not author a full unique library per nation. | A; I219 |
| AN07 | Bow combat | `Attack` draw/release, `Reload` nock, `Attack2` rapid shot; `Volley`, `AimHold`, defensive `Block` in the existing brief. | Core firing/reload first; volley/hold variants next. Synchronize arrow release to simulated events. | A core, B variants; I219 |
| AN08 | Firearm combat | `Attack` aim/fire/recoil, era-correct `Reload`, `Attack2` variant, `Kneel` where used. | Reuse existing gunmen; musket loading must differ from modern magazine actions. | A for audited musketeers; I219/R144–157 |
| AN09 | Mounted combat and travel | Horse/rider `Idle`, `IdleAlt`, `Walk`, `Run`, `Charge`, `Attack`, `Attack2`, `Block`, `Hit`, `Death`, `DeathAlt`, `Rout`; `Rear`/`Victory` as polish. | Horse and rider synchronized; shared mount rig with weapon-specific rider actions. | A core, B/C extras; I192/I219 |
| AN10 | Chariot travel and combat | Horse gait, wheel rotation, driver reins, mounted bow `Attack`, `Reload`, `Attack2`, `Block`, `Hit`, `Death`, `Rout`. | Validate existing chariot rig before custom work. Needed only for deployed chariot models in the audited roster. | B; Akkad/P2, existing art brief |
| AN11 | Impact and death | `Hit`, `Death`, `DeathAlt` for relevant unit families; stable final body/wreck pose. | Reuse where anatomy/equipment permits; mounted and machine destruction require their own motions. | A core, B alternate deaths; I195/I219 |
| AN12 | Routing versus controlled withdrawal | `Rout` for actual routed units; disciplined walk/run withdrawal for a player order. | Route uses existing run variation; controlled withdrawal usually needs state selection/blending, not a new clip. | A; I012/I013/I188–I191 |
| AN13 | Hold, shaken and rally feedback | Ready/guard pose while holding; subdued shaken posture; brief return-to-ready/rally cue. | Recommended state readability. Reuse `Idle`/`Block`/`Hit` first; any new semantic clip names require renderer support. | B; Hold request and existing Shaken/Rally behavior |
| AN14 | Victory reaction | `Victory` cheer or weapon raise for surviving eligible troops after verified victory. | Existing brief already specifies it; optional for the audit fixes. Never play based solely on an unverified client result. | C; I001/I219 |

Do not require new root-motion turning, start/stop, climbing, mount/dismount, or hand-to-hand execution systems merely to fix these audits. In-place clips and controlled blends cover the current orders. New state-specific animations must correspond to a real supported state.

### 2.3 Workers, gathering and siege machinery

| ID | Animation family | Clips / motions to deliver or validate | Production status | Priority / evidence |
|---|---|---|---|---|
| AN15 | Gathering work | Food collection into a barrow; axe at trees; pickaxe at stone, gold and ore; appropriate generic gather action for supported jobs. | Inspect current worker `Chop`, `Mine`, `Harvest`, `Build`, `Repair` and related exported actions first. Retain `Attack` only as a compatibility alias where required by the consumer; map supported jobs and visible loads explicitly. | A; I219/U06, working RTS economy |
| AN16 | Carrying and delivery | Empty outbound trip, wheelbarrow/handcart with visible food/log/stone/ore/gold cargo on the return, short unload at the real drop-off. | Share locomotion; attach interchangeable props and rotate wheels. Stock increases at the sim's deposit, never from the clip. | A; U06 |
| AN17 | Construction and repair labor | Hammer/build loop; repair loop; worker start/stop/idle transitions. | Existing worker mesh/rig and work clip can be reused; distinguish repair with tool/target context before commissioning extra clips. | A; I182/I184/I219 |
| AN18 | Siege-machine travel | Crew pushing/hauling, wheel rotation, rest/settle. | Validate existing siege GLBs/rigs; crew and chassis must remain synchronized. | A for relevant machines; I213/I219 |
| AN19 | Siege-machine attack/reload | Ram swing; ballista draw/fire/reload; trebuchet arm/sling launch/reset; cannon aim/recoil/reload. | Shared timing contract, machine-specific moving parts. Author only missing relevant machine cycles. Cannon is especially relevant to Kerma. | A; I211–I213, R150–157 |
| AN20 | Siege-machine impact/destruction | Short hit reaction, broken wheel/frame/barrel state and crew response. | Existing damage states plus small procedural motion may suffice; mechanical clips only where needed. | B; I219 and objective readability |

Workers already have GLBs for the audited eras. A separate new worker body per task is unnecessary; compatible tools and action variants are enough.

### 2.4 Buildings, effects and interaction motion

| ID | Animation / effect | Deliverable / behavior | Production status | Priority / evidence |
|---|---|---|---|---|
| AN21 | Construction progress/completion | Scaffold and rising walls, then finished building. | Preserve the working effect. Extend only to assets that fail to participate correctly. | A regression check; P2 §7/8 |
| AN22 | Building damage, breach and repair | Intact → damaged → ruined/breached; repaired state restored when actual HP recovers. Optional short collapse transition. | Reuse existing damaged-house/wall kits and procedural dust/debris; no mandatory full destruction simulation. | A state correctness, B transition; W06/W12 |
| AN23 | Gate opening/closing | Correct open/breached presentation; open/close motion only if the sim supports that transition. Current city README says gates remain open in battle. | Existing gate variants; procedural hinge/slide where supported. Never alter passability solely for an animation. | B; siege/retreat readability |
| AN24 | Ownership/capture cue | Visible banner/owner change, optional short flag raise. | Team material/badge update is sufficient for A; authored flag raise is optional. | A identity, C motion; I130/I209 |
| AN25 | Order and placement feedback | Accepted-target pulse, move/attack marker, valid/invalid footprint response, selected-building outline. | UI/shader effects. Not exported character animations or new building meshes. | A; I173–I191 |
| AN26 | Resource depletion | Full → half → depleted node; felled/stump grove state; optional small change transition. | Existing model-state contract; validate readability and correct state selection. | A; I175 |

Projectile flight, muzzle flash, smoke, dust and impact effects should use the existing FX system first. Add or repair an effect only when it is missing or obscures the audited action. Art cues must not fire for rejected orders.

## 3. Model and prop checklist

These are **12 model/prop work packages**, not a claim that 12 meshes or 12 entirely new kits are missing. Exact exports depend on existing-file inspection and accepted variants.

| ID | Model / kit | Required pieces or treatment | Reuse versus new production | Priority / evidence |
|---|---|---|---|---|
| MD01 | Readable settler/caravan | Civilian silhouette; baggage; optional cart/wagon and pack animal; mobile-readable distant representation. | Candidate for new assembly. Reuse worker/person, horse/donkey and wagon pieces if suitable; a clearer 2D marker remains a valid minimal fix. | A; I095/I099, P2 §4 |
| MD02 | Early outpost / small village | Camp shelter, supplies, a few small dwellings/utility props and a coherent growth silhouette. | Inspect shared `colony-camp` first; integrate or improve it. New kit only if existing assets cannot meet the requirement. | A; I054/I055 |
| MD03 | Correct Bronze Mesopotamian battle-town assembly | Flat-roof/mud-brick dwelling set, local storage/civic pieces and era-correct defensive appearance; correct intact/damaged/ruined variants. | Existing base/Levant/regional art must be checked first. Wrong red roofs may be a fallback/theme selection bug. No automatic whole-city re-author. | A; I215 |
| MD04 | Egyptian/Nile and Nubian assignment review | Correct relevant town, field and vegetation mapping; any genuinely absent culture-specific pieces identified afterward. | Nile assets exist. Nubian appearance must be reviewed against the intended culture, date and actual terrain. Green Nile farmland is not inherently wrong. | A mapping, B verified art gap; I216 |
| MD05 | Better vegetation across seven climate families | Desert, Mediterranean, temperate, tropical, conifer, steppe, cold. Each needs readable large/medium/small silhouettes and compatible bush/grass/rock/felled/stump pieces. | Fix the trees' graphics and inspect the 3 present kits; add the 4 absent dedicated kit files. Make harvestable groves selectable through node picking; decorative trees must not promise gathering. | A first 3, B remaining 4; I217/U04 |
| MD06 | Readable battle resource nodes | Ore, stone, gold, wood groves, fish, sheep/goats and cattle; full/half/depleted where meaningful. | Named node GLBs already exist. Improve silhouette/material/scale only if needed; footprint overlay handles exact placement obstruction. | A; I175 |
| MD07 | Worker tools and carried goods | Axe, pickaxe, hammer, shovel/hoe as appropriate; wheelbarrow/handcart, food/log/stone/ore/gold loads and attachment points. | Reuse tools already present in worker/unit files; create missing compatible props rather than new worker bodies. | A; AN15–AN17/U06 |
| MD08 | Friendly/enemy building identity pieces | Readable banners/pennants, ownership sockets and team cloth/signage where geometry is useful. | Reuse flags and team materials. Outline/label/selection treatment may solve the issue with zero new mesh. | A; I209 |
| MD09 | Soldier/mount/weapon readability repairs | Preserve identifiable weapon, shield, rider/horse, cannon, tank and artillery silhouettes at close/mid/far LOD; improve selection presentation. | Existing unit GLBs. Check class scale, camera and LOD before adjusting larger machine models; keep crew proportions and battle footprint stable. | A; I218/U08 |
| MD10 | Siege-machine moving parts and crew attachments | Correct wheels, ram/launcher arm, sling/string, cannon/artillery barrel recoil, tank tracks/turret, crew sockets and stable ground footprint. | Existing siege models; rig/part-separation fixes where required by AN18–AN20. New geometry only for verified missing parts. | A/B; I213/I219/U08 |
| MD11 | Building/wall/gate damage compatibility | Matching damaged/ruined houses, breached walls/towers/gates, rubble and repair-state matching. | Existing extensive kits. Extend only missing size/culture variants; keep physical footprint consistent across states. | A validation, B gap fill; W06/W12 |
| MD12 | Construction-stage compatibility | Scaffold bounds, supports or construction proxy for newly introduced/repaired structures. | Existing construction already looks good. Reuse modular scaffold and rising-wall effect; produce only incompatible adapters. | A validation; P2 §7/8 |

Suggested vegetation content, as an art proposal rather than a fixed procurement count:

- Desert/oasis: date-palm silhouette, acacia-like spreading tree, sparse scrub and dry grass.
- Mediterranean: olive-like spreading canopy, cypress-like upright form, pine and scrub.
- Temperate: broadleaf canopy variety, small/young trees, bushes and grasses.
- Tropical: broadleaf canopy, palms and understory shapes.
- Conifer: pine/fir/spruce-like forms at multiple sizes.
- Steppe: grasses and scrub as the main cover, sparse appropriate trees.
- Cold: sparse hardy vegetation/low scrub and rock, with snow-compatible material treatment where applicable.

Favor several distinct silhouettes over many recolored copies. Do not pack every biome densely with trees or add impassable collision just because a decorative mesh was added.

## 4. Icons and overlays needed for the same fixes

These are 2D assets or renderer/UI features and must not be mistakenly budgeted as 3D models.

| ID | Asset / surface | Work |
|---|---|---|
| UI01 | Wheat, cotton and papyrus map symbols | Existing SVGs: check atlas registration, era visibility, scaling and contrast; redraw only if still illegible. |
| UI02 | Settler / caravan map symbol | Make the existing symbol readable at strategic zoom and coordinate it with any 3D caravan. |
| UI03 | Major, independent, outpost, raid-party badges | Distinct shapes/labels at small size; add missing glyph variants only. |
| UI04 | Friendly/enemy/selected building treatment | Team banner plus outline/base marker; readable without color alone. |
| UI05 | Build-menu thumbnails and fallbacks | Fix first-open loading/preload; generate a consistent thumbnail only when a real image is absent. |
| UI06 | Placement footprints and field boundary | Shader/line/overlay work with valid/invalid/blocked/fog states from the real placement predicate. |
| UI07 | Formation/order/route markers | Move, attack, Hold, retreat, target accepted/rejected, route preview and settler destination. |
| UI08 | Starting force, later reinforcements, Idle N and navigation controls | Remove manual Reserve control when all committed regiments start on the field. Keep genuine later reinforcement arrival cues and find army/base/keep/minimap controls. |
| UI09 | Conquest/loyalty/supply/trade warnings | Reuse the icon language for actionable map/notification states; no mandatory new animated character or building. |
| UI10 | Settlement legality and tile highlight | Legible strategic-zoom legal/illegal overlay, selected improvement tile and known recommended site. |
| UI11 | Compact battle action controls | Circular icon-only hammer for a selected worker, wand for abilities/powers, cancel/deselect button and build-sheet X. Sheet hides for placement and returns after a successful build. Each icon still has an accessible name. |
| UI12 | iPhone cutout-safe sheets and HUD | Keep top resources, supply, side sheets, close/confirm actions and fixed battle controls inside the visible safe area around the Dynamic Island in both landscape orientations. |
| UI13 | Tree/grove selection | Give harvestable trees a clear selectable ring and readable resource/remaining display; decorative trees and dragging must not trigger a false gather action. |
| UI14 | Stone and Battle Supply display | Show distinct Food, Materials, Stone and Gold values plus current/cap Battle Supply, with critical numbers visible on the short iPhone viewport. |

## 5. What should not become an unnecessary art commission

- Formation speed, failed attacks, idle squads, starting-force deployment and retreat behavior require input/simulation/HUD fixes. New attack clips cannot fix them.
- Battle/campaign disagreement and ghost units require protocol/outcome fixes. Death animations must follow the corrected result.
- Inland ships need eligibility fixes. They do not justify new ships or harbors.
- Oil in an ancient UI and Riflemen naming at an unexpected date need visibility/naming/unlock decisions first.
- Dark battlefields need lighting/exposure/material evaluation before remaking every terrain texture.
- Wrong town styles need culture/era/fallback mapping inspection before replacing town packs.
- Small troops may need camera, LOD, scale and selection work before new high-detail bodies.
- Global movement smoothing, camera following and zoom behavior are renderer interactions, not motion-capture tasks.
- Monetary packs, modern vehicles/aircraft and complete naval animation sets belong to separately approved product/coverage work. These audits do not establish a need to produce all of them now. The broader unit art brief already describes those families if later commissioned.

## 6. Production order and delivery requirements

1. **Asset reconciliation:** inspect the GLB contents/clip names, renderer fallback logs and current screenshots; record reuse/repair/new for every AN/MD item. File-path inspection alone cannot confirm internal animation completeness or visual quality.
2. **One working animation pilot:** foot unit plus worker, showing walk, attack/work, hit, death and withdrawal correctly through the actual instanced renderer. Prove the playback/bake path before authoring a large library.
3. **Readability batch:** map travel smoothing, settler representation, existing outpost activation, Bronze cultural mapping, three existing vegetation-kit repairs, resource/ownership overlays.
4. **Combat batch:** bow, musket, cavalry and siege core cycles; correct reserve/withdrawal/held-state presentation. Add chariot work for active applicable units.
5. **World coverage batch:** missing vegetation climates and only verified town/node/damage/prop gaps.
6. **Polish:** founding, growth, subtle rally/flag transitions, alternate attacks/deaths and victory reactions after functional fixes are stable.

For each authored item deliver:

- Editable source, game-ready GLB and required textures/options; retain the repository's existing rig/material/object-name conventions.
- For clips: name, loop flag, intended state, frame rate/duration, contact/release events and root-motion policy. Use the exact existing unit brief conventions where already defined.
- For props/buildings: pivot, attachment/footprint dimensions, ownership material channel, intact/damaged states and compatible near/mid/far representations.
- Mobile-scale preview at the actual battle/world camera, including the standard 844×390 and audited 844×340 viewports and multiple zooms; cold-cache loading and renderer-fallback verification.
- No simulation effects triggered by render frame timing. Keep true game movement, damage, resource delivery and capture authoritative.
- Instancing-compatible animation/baking. Do not add one heavyweight animation mixer per visible soldier without measuring the architecture change.
- Reduced-motion handling for UI/camera transitions and no needless motion for stationary Hold/idle states.

Use the [ART-MODELS-PLAN.md](ART-MODELS-PLAN.md) and the detailed production plan as the governing current 3D/animation contract. Use the older [unit art brief](https://github.com/yaniv89/terra-imperium/blob/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091/plans/unit-art-brief.md) and [Blender delivery specification](https://github.com/yaniv89/terra-imperium/blob/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091/plans/art/blender-delivery-spec.md) for detailed skeleton, orientation and export requirements. Reconcile older delivery requirements with the active renderer before commissioning optional high-detail sprite-only assets.

**Checklist totals:** 26 animation/motion/effect families, 12 model/prop work packages, and 14 icon/overlay groups, plus two supporting animation/FX checks in the production plan. These totals include reuse, repair, integration and optional polish. They are not counts of new unique meshes or authored animation clips.
