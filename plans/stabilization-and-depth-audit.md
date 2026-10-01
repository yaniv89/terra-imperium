# Terra Imperium: stabilization, depth, and battle presentation

Audit date: 2026-10-01. Starting commit: `26cc31c2e975aaf62319e18d28f8f55f06b0c39e`.
Branch: `audit/stabilization-and-battle-depth`.

## Verdict

### Implementation update, 2026-10-01

The following sections preserve the initial audit. The branch now also contains:

| Area | Implemented behavior |
|---|---|
| Province selection | The globe listens to real pointer taps and picks exact geographic polygon containment from the camera ray. The 2D map accepts fill hits only; its mode and zoom controls avoid the desktop sidebar. Real browser clicks passed at two zoom levels in both renderers. |
| Conquest actions | Exhausted, unfunded and otherwise invalid attacks show their reason and are disabled; the authoritative reducer validates them independently. |
| Emergent worlds | Seeded 15/30/45/60/75-nation starts, distinct connected provinces, visible microstate relocation, equal starting strength, neutral resistance, costly expeditions, integration and later emergence. Claims consume the army's movement. |
| Operational AI | Legal adjacency movement, capital defense, reinforcement and reclamation, actual troop commitments, queued-defense reservations, naval transport and amphibious operations through shared combat. |
| Territory lifecycle | Shared ownership reconciliation, capital relocation, elimination/revival, war/offer cleanup, ownership-cache invalidation and acyclic reciprocal subject links. |
| AI economy | Real recruitment/upkeep and strategic stocks, supply and oil constraints, borrowing and bankruptcy with army desertion, stability/law/advisor/estate decisions and treasury reserves. |
| Connected depth | Supply production/consumption and reserves are visible, taxes/recruitment affect estates, and trade checks land access, ports and blockades. |
| Save/load | Sparse scenario rosters persist; destroyed starting armies stay destroyed; neutral nulls remain null; timed modifier IDs derive from saved collections. |
| Battle presentation | Smooth body and helmet normals, rounded horses, period equipment, tracked tanks and swept-wing aircraft; far meshes retain their class silhouettes. The 21 legacy blocky recipes are disabled. Presets bound DPR, shadows and effects; renderer diagnostics expose frame and draw statistics. |
| Regression tooling | Exact completed-turn simulation, all-mode seeded audits with next-turn save/load comparisons, a short PR gate and scheduled long matrix. |

All 18 combinations of six world modes and three seeds completed 150 audited turns with save/load continuation comparisons. The original four priority sections below are no longer an accurate list of wholly unimplemented work. See `validation-results.md` for final checks and remaining limits.

Remaining scope limits: these are stylized procedural figures, not a finished realistic art roster; actual phone GPU/FPS targets have not been measured. Sea AI can embark and land but does not yet plan an interior army's journey to a port or relocate an unavailable fleet. AI borrowing uses a deficit-covering principal rather than the player's income-based loan size, and automatic debt repayment is not implemented. The future depth table below remains a roadmap, including new battle objectives and age-specific capability redesigns. No zero-defect guarantee or completion of that entire roadmap is claimed.

### Initial audit findings

Keep the Civilization-style growth campaign, CK3-style internal politics, and commanded RTS battles as the design direction. Stabilize the shared campaign rules before adding the proposed 15/30/45/60/75-nation world modes. The checked-out source does **not** contain the emergent-world implementation or commit `d3b146a` described in the pasted conversation. The recommendations below are based on the code at the starting commit and the fixes on this branch, not that earlier summary.

There is a substantial working foundation: deterministic campaign RNG, tactical replay tests, a shared invasion aftermath path, real province development, AI treasuries, supply, conquest markers, multi-war diplomacy, succession, estates, and save migrations. However, passing tests does not establish that every interaction is correct. This audit found real defects and significant unfinished mechanics. Treat this branch as a stabilization increment and a reviewable plan, not a zero-defect certification or the complete redesign.

## Implemented and regression-tested

| Problem | Change | Evidence |
|---|---|---|
| Province clicks could select a nearby region | Preserve the actual polygon hit; remove the centroid override; keep province caps at one low altitude to reduce sidewall occlusion | `regionClickAssist.test.js`; WebGL pointer behavior still needs device verification |
| After conquest, attack actions remained clickable with no movement remaining | Use the engine validators in the province panel and battle dialog, disable invalid actions, display the reason, and revalidate before dispatch | `attackAvailability.test.js`, including a real conquest followed by a blocked second attack |
| Peace gold demands minted money; AI recipients were never debited | Indemnities move gold between the actual player/AI pools, reject negative/nonfinite/unfunded demands, check aggregate split demands, and clamp stale payments to available funds | `src/engine/peace.js`, `stabilization.test.js` |
| AI recruited into occupied provinces and prioritized distant population centers | Choose controlled provinces; prioritize current invasions, threatened war goals, then enemy borders; retain population as a tie-breaker | `src/utils/aiLogic.js`, `stabilization.test.js` |
| Eliminated nations still participated in passive growth and military ranking | Skip eliminated nations in growth, ranking, coalition-leader selection, recruitment, and war decisions; skip their turn economy credits/spending | `aiLogic.js`, `resolveTurn.js` |
| War progress read the previous turn's unit map | Pass current regions and current units into recruitment, war decisions, and war progress, so new defenders and reinforcement/attrition changes count | `resolveTurn.js`; affected conquest fixture made independent of recruitment rolls |
| Eliminating a belligerent removed its wars without refreshing surviving opponents' flags | Refresh affected nations' war flags after elimination, preserving other active wars | `resolveTurn.js`, `campaignAudit.test.js` |
| The simulation script could count blocked peace/defense iterations as turns | Explicit passive response policy, automatic defense, exact turn-progress assertion, input validation, actual completed-turn denominator, portable file URL loading | `scripts/simulate.mjs`, `simulate.test.mjs` |
| Corruption lacked a reusable campaign audit | Read-only auditor reports numeric failures, invalid identities/owners/regions, war-flag mismatch, invalid belligerents, cargo references, vassal reciprocity, and stale peace offers; used by audited campaigns and the 150-turn determinism test | `src/engine/stateAudit.js` and associated tests |
| Battle resolution stayed reduced on ordinary 60 Hz displays after a slowdown | Allow sustained ~16.7 ms frames to recover resolution, while retaining the slower-frame downgrade threshold and native-DPR cap | `BattleRenderer.js`, `resolution.test.js` |

The original 12 new stabilization cases all failed before the fixes. The first focused post-fix run passed 104 tests. Final verification details are recorded in `validation-results.md`.

## Highest-priority remaining work

### 1. Operational AI and counter-invasions — P1

`src/engine/diplomacy.js::resolveWarProgress` explicitly excludes player-aggressor wars from AI capture attempts. `processAIRecruitment` creates real units but has no campaign movement planner. Forward recruitment improves defense; it does not solve armies already stranded in the interior or create counterattacks.

Build one persistent, deterministic operational plan per front: defend a threatened capital, reinforce a front, liberate lost land, then attack. Route along legal region adjacency, consume movement, reserve units once, account for transport/supply, and commit actual units through shared combat validation. Do not simply turn on an extra arbitrary capture roll against the player. Such a roll would preserve the disconnect between visible armies and conquest.

Acceptance: a funded defender under a scripted invasion recruits and moves help within a measured turn limit; it can reclaim a lost province; no army teleports, fights twice with one move, crosses neutral/hostile land without authorization, or participates in two queued battles. Cover player-started, AI-started, multi-front, island, and capital-loss scenarios.

### 2. Territory and diplomacy lifecycle — P1

Ownership changes span `conquest.js`, `regionTransfer.js`, `peace.js`, revolt handling, civil war, and direct vassal annexation. `ANNEX_VASSAL` directly rewrites region ownership, while `VASSALIZE` and peace subjugation use separate guards. These paths need a common lifecycle contract before sparse worlds and respawning nations amplify inconsistencies.

Specific remaining static findings:

- `VASSALIZE` does not reject a player that is itself a vassal; a sufficiently strong player can attempt to vassalize its own overlord. Peace subjugation also lacks a general cycle check. Add a shared acyclic-subject validator and regression cases before expanding vassal gameplay.
- `transferRegion` removes occupation but retains the old conquest marker unless overridden. Define whether a revolt, event transfer, or peaceful annexation should still score in an earlier war; clear/rewrite markers consistently.
- The ownership and bordering-nation caches in `regions.js` are keyed by the regions object's identity. `resolveTurn` both caches and mutates a working regions map. Audit each ownership-changing phase so elimination, borders, and income see the intended snapshot. The occupation-score index separately documents an intentional one-turn lag; do not confuse that design choice with an accidental stale cache.
- Capital relocation and subject release after elimination need consistent treatment across all transfers, not just military conquest and peace.

Acceptance: every transfer preserves an existing live owner or explicit neutral/rebel owner; live nations with land have a valid capital; closed wars leave no dangling offers/defenses; subject graphs have no cycles; victory, borders, and elimination agree after a transfer.

### 3. Complete AI economic parity — P1/P2

`aiEconomy.js` explicitly omits AI strategic-resource gates, AI loans/bankruptcy, and AI law/estate/advisor decisions. Meanwhile `resolveTurn` applies oil grounding and several shortages primarily to the player. That makes additional difficulty bonuses harder to interpret.

Unify resource access through `nationState.getPool`, then share affordability and upkeep rules. Keep difficulty focused on planning horizons, reserves, and reaction speed. Preserve transparent bonuses only where intentionally documented. `resolveTurn`'s AI insolvency lookup currently reads `economy.resources.gold`, although the real field is `economy.gold`; fix that alongside real AI debt behavior rather than treating it as an effective insolvency mechanic today.

Acceptance: the same treasury, manpower, and strategic-resource constraints hold for identical player/AI formations; an insolvent army has a visible consequence; recruitment cannot consume funds reserved for survival or an active strategic objective.

### 4. Reliable scenario benchmarks — P1

The repaired `simulate.mjs` and new auditor establish a starting point. Existing `aiQualityBenchmark.test.js` still uses randomly seeded worlds and a separate advance helper that does not answer pending peace offers. Its nominal iteration count can therefore differ from real turns. Replace that helper with the audited policy, fix seeds, and separate correctness checks from hardware-sensitive timing gates. Do not raise budgets merely to make a shared machine pass.

Add scenarios for a competent expanding player, invasion defense, multi-front wars, island logistics, capitulation, vassal independence, bankruptcy, succession crisis, and save/load mid-war. Record completed turns, p50/p95 turn times, front response time, idle armies, resource shortages, territory changes, and audit violations. Run short deterministic scenarios on every PR and a longer seed matrix in CI.

## Add depth by connecting existing systems

| Priority | Feature | Player decision and consequence | Release gate |
|---|---|---|---|
| First | Army supply and reserves | Mobilize faster at economic cost; choose a depot/route; keep a reserve instead of stacking every army at one border | Supply interruption, recovery, costs, and AI response are observable and tested |
| Next | Politics driven by actions | Taxes and levies shift estate loyalty; war losses affect legitimacy; conquered cultures affect integration; succession can redirect an agenda | UI explains cause, duration, and a countermeasure for each major modifier |
| Next | Geography-aware trade and diplomacy | Ports and chokepoints matter; disrupted routes change trade value; allies respond to threatened theaters | Route eligibility and disruption use real ownership/access rules |
| Next | Technology changes capabilities | Unlock roads/depots, siege methods, ocean transport, mechanization, and air support rather than only numerical buffs | Each major age changes at least one meaningful operational choice |
| Then | Battle objectives | Field engagement, siege, relief, crossing defense, and withdrawal have different victory conditions and campaign costs | Both manual and auto results use the same aftermath contract |
| Then | Contextual UI | Map army stacks, supply/front overlays, and prioritized alerts link directly to an actionable decision | Player can identify a threat, its cause, and a response without reading the log |

Avoid adding independent currencies or more menus before these connections exist. A province's population, production, recruitment, casualties, unrest, and recovery should form a visible chain.

## Emergent-world implementation order

Keep the full-world scenario available. Treat 45 nations as a proposed default to validate with playtesting, not a balance conclusion established by this audit.

1. Stabilize invariants, AI fronts, and lifecycle transitions above.
2. Introduce a versioned scenario record: mode, generation version, seed, requested count, active nation IDs, generated starts, and neutral-state data.
3. Implement 15/30/45/60/75 starts with guaranteed player inclusion, unique regions, geographic spacing, reachable expansion, and a documented policy for isolated starts. Show a relocation before launch rather than silently changing geography.
4. Model neutral inhabitants and defense separately from eliminated modern nation records. Separate active, dormant, eliminated, and neutral entities in turn processing.
5. Make frontier expeditions cost gold, administration, supply, and a unit's movement. Scale resistance nonlinearly, impose integration costs, and prevent same-turn claim chaining.
6. Migrate saves and test save/load determinism. `backfillDefaults` currently adds the full modern nation/region roster from a fresh world; make it scenario-aware before shipping this mode.
7. Scale victory to the chosen scenario and test 15/30/45/60/75/full worlds across seeds, including island players, eliminated nations, and late emergence.

## Battle graphics: researched direction

The renderer already uses an orthographic camera, instanced soldiers, shader animation, low-detail imposters, a fitted shadow view, environment lighting, terrain color variation, and impact effects. Replacing all of that with high-poly characters would not address the most important presentation problems.

### Recommended first visual milestone

Create one polished classical-age battle that includes infantry, ranged troops, cavalry, and siege. Compare a plains encounter, wooded crossing, and fortified town at identical seeds and camera positions. Judge readability at phone size before expanding the full art roster.

- Establish silhouettes and consistent scale: broad shields for infantry, readable bows for ranged, visible mounted height for cavalry, and distinct siege profiles. Preserve team-color areas and banners at every detail level. These are art-direction recommendations inferred from the present pipeline.
- Improve animation timing: anticipation, contact, recoil, death, and retreat should follow simulation events; vary gait phase per soldier, not authoritative outcomes. The existing GLB baker keeps an idle pose and maps limbs into a procedural shader rig, so buying richer animation clips alone will not preserve those clips in combat. A richer animation system requires an explicit GPU animation/baking extension.
- Use terrain context already available in `buildBattleSetup`: fortifications and real buildings, then add controlled variation from development, devastation, and region identity. Make forests and structures readable without hiding selections or objectives.
- Add restrained dust, trails, muzzle flashes, and impact decals with strict pooled budgets. Optional ambient occlusion and bloom can improve contact/contrast, but keep expensive passes in a measured high-quality preset. Three.js documents post-processing as additional render passes; it is not free. [Official post-processing guide](https://threejs.org/manual/pages/how-to-use-post-processing.html).
- Preserve instancing and profile draw calls/triangles. Spatially partition large troop batches if profiling shows off-screen work is costly; the current soldier meshes disable automatic frustum culling. Do not simply enable culling without maintaining correct bounds for moving instances. [Official InstancedMesh documentation](https://threejs.org/docs/pages/InstancedMesh.html).
- Use one main shadow-casting sun and bounded shadow quality. Shadows render casters again from the light's viewpoint, so measure their cost before adding more dynamic lights. [Official shadow guide](https://threejs.org/manual/pages/shadows.html).

### Asset and delivery choices

Use a consistent small roster before sourcing all 21 age/class slots. The repository already has an import pipeline and model manifests. [Kenney Blocky Characters](https://www.kenney.nl/assets/blocky-characters) provides animated CC0 assets useful for a prototype/style evaluation; it is not a complete historical military roster. The license and art fit of each final asset still belong in the asset manifest.

Meshopt/Draco can reduce geometry transfer size; KTX2/Basis can reduce texture delivery/GPU storage where actual textures are retained. Three.js exposes the relevant decoder hooks. However, this project's current importer skips compressed assets and its soldier baker samples texture pixels into vertex colors. Therefore compressed palette textures are **not** a drop-in change: bake uncompressed sources offline, or revise the loader/material pipeline first. [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

Proposed acceptance targets, not measured claims: stable 30 FPS on the selected low-end phone, 60 FPS on the selected desktop, readable teams at far zoom, no selection occlusion, bounded memory across repeated battles, and unchanged deterministic replay hashes across graphics presets. Capture p95 frame time, draw calls, triangle count, memory, loading time, and screenshots on named devices. No new art assets, full graphics overhaul, or device visual QA are claimed by this branch.
