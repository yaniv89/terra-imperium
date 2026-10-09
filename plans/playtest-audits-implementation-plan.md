# Terra Imperium: complete playtest remediation and implementation plan

**Status: planning only. No game changes are implemented by this document.**

Prepared 8 October 2026. Baseline: `yaniv89/terra-imperium`, `claude/integration`, commit [`0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091`](https://github.com/yaniv89/terra-imperium/commit/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091).

**Coverage correction:** The original 42 count describes only the main audit's labeled headings, not the total actionable scope. Re-reading all three files and splitting independently testable behaviors produces **224 gameplay items: 55 reported defects, 108 UX issues, 31 balance concerns, 16 requests, and 14 investigations**. Repeated observations are merged. These are not 224 independent root causes or independently confirmed bugs. Separate lists track **8 commercial/product entries**, **9 explicitly untested areas**, and this plan's **22 additional risks**; those are excluded from the 224 total. The raw log's 165 rows are evidence records, not a defect count.

**Authoritative item inventory:** [All 224 items, evidence and completion checks](playtest-audits-item-inventory.md), with [sortable item CSV](playtest-audits-item-inventory.csv). The earlier broad W00–W16 mapping is now supplemented by individual I001–I224 IDs. Mark completion at item level, not merely by finishing an umbrella package or ticking off an audit heading.

**Work breakdown:** [Code versus art, fixes versus additions/changes, and major to small scope](playtest-audits-work-breakdown.md), with [all 238 gameplay/request rows](playtest-audits-work-breakdown.csv) and [all 54 overlapping visual rows](playtest-audits-visual-work-breakdown.csv). These are planning classifications, not additional items or completed work.

**Reading guide:** [Source findings](#2-important-corrections-and-source-findings), [design decisions](#3-product-decisions-and-recommended-defaults), [17 work packages](#5-work-packages), [22 additional risks](#6-additional-loopholes-and-design-safeguards), [delivery sequence](#7-sequencing-dependencies-and-reviewable-implementation-slices), [validation](#8-validation-strategy-and-measurable-completion), [original 42-label subset](#9-traceability-original-42-label-subset), [complete test-log ledger](#11-complete-raw-test-log-ledger), and [14 later player requests](#12-player-follow-up-rts-and-iphone-layout).

Companion: [coverage CSV with all 165 original test observations](playtest-audits-coverage.csv).

Art-production companion: [animation, model, prop and icon checklist](playtest-audits-animation-model-brief.md). It distinguishes existing assets that need integration/repair from candidate new production, with 26 motion/effect families, 12 model/prop packages and 14 icon/overlay groups. The [detailed art production plan](playtest-audits-art-production-plan.md) reconciles branch specifications and pre-audit backlog overlap, defines production batches and acceptance, and adds two explicit supporting checks (herd motion and projectile/FX synchronization); its [manifest](playtest-audits-art-production-manifest.csv) tracks 54 visual requirements, not 54 new assets. The 14 player requests added after the audits are tracked separately as U01–U14 below, outside the 224 audited items.

## 1. Scope, evidence, and intended outcome

This plan covers all findings, suggestions, positive behaviors to preserve, and test gaps in:

1. [Playtest 2 report](https://github.com/yaniv89/terra-imperium/blob/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091/plans/playtest-2-report.md), including session 1, session 2, and monetization ideas. References below use `P2 §n` or `P2 session 2`.
2. [Playtest 3 audit](https://github.com/yaniv89/terra-imperium/blob/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091/plans/playtest-3-audit.md). References use its original C/H/M/L finding IDs or section number.
3. [Playtest 3 test log](https://github.com/yaniv89/terra-imperium/blob/0c08cf853f0fbfc350367b4e7f8c2fa3f7ccf091/plans/playtest-3-test-log.md). References use `R<number>`.

The implementation should make battle outcomes trustworthy, mobile interaction predictable, spending meaningful, AI behavior purposeful, and a full campaign engaging. It should preserve the settling flow, readable loyalty breakdown, RTS economy, formations, construction animation, and useful rally abilities.

Evidence labels:

- **Observed:** reported by Claude during the original sessions; not independently replayed for this plan.
- **Source-confirmed:** inspected in the pinned source snapshot while preparing this plan.
- **Hypothesis:** plausible explanation requiring reproduction before a fix is chosen.
- **Proposal:** a recommended design or tuning experiment, not an existing rule or an approved balance value.

Source was inspected through GitHub. A runnable checkout, historical saves, and original battle command logs were not available for this planning pass; no gameplay tests or balance simulations were run. Reproduction and measurement are implementation tasks. The report's statement that localhost matched production is historical audit context, not a fresh deployment comparison.

This is a multi-stage program, not a promise that all findings are a week of wiring. The original audit's one-week P0 estimate should be replaced with evidence-based estimates after reproduction. This is a planning deliverable; committing its documents does not authorize asset production, gameplay implementation, merging to main or deployment.

## 2. Important corrections and source findings

### 2.1 The battle bridge already exists; verification can change the battle

**Source-confirmed:** `src/engine/battleOutcome.js` already provides `makeBattleOutcome` and `applyBattleOutcome`, including operation IDs and applied-ID memory. Creating a second outcome service would duplicate the architecture.

The current flow is:

`live worker → result preview → Continue → RESOLVE_TACTICAL_BATTLE → replayBattle → sanitizeTacticalResult → applyBattleOutcome`.

`src/engine/gameReducer.js` replays the submitted command log and substitutes the replay result for the displayed result. `src/battle/sim/replay.js` accepts movement, attacks, retreat, reserves, abilities, powers, and garrison orders, but its allowed-order set excludes **deploy, gather, build, assist, repair, train, cancelTrain, rally, and cancelBuild**. Those orders exist in `orders.js` / `economy.js` and run in the live worker. Replay target validation also recognizes only squad/structure targets, while economy orders use additional payload fields and economy targets.

This is a concrete verification defect and a strong explanation for the Kerma mismatch: a replay can omit the player's barracks, reinforcements, repairs, and cannons. It does **not** establish the exact cause of every historical casualty discrepancy without the original setup and log. The plan must fix the order contract, setup identity, and verification/display lifecycle together. Removing verification or trusting the client result would create a different defect.

### 2.2 Development really is overwritten

**Source-confirmed:** `DEVELOP_PROVINCE` increments `region.dev`. `resolveTurn.js` subsequently assigns tile-city `dev.tax`, `dev.production`, and `dev.manpower` from current city yields/size. `cityYields` does not use a persistent purchased-development delta in that calculation.

P3 R129's immediate `17 → 18` confirms the button changed state, not that it survived future turns. P2's next-turn reversal and P3's immediate success can both be true. Test through turn resolution, save/load, focus changes, and conquest.

### 2.3 Land pricing passes different inputs

**Source-confirmed:** `CityPanel.jsx` calls `claimCandidates` with `{ ageId, researched }`. The reducer's `BUY_TILE` path passes `ageId` but omits `researched`. `claimCandidates` reads research-based tile-cost and reach modifiers. This supports the repeated quoted-price/debited-price mismatch and may also reject research-unlocked border purchases.

Use a shared quote/eligibility selector; do not patch the reported 15-gold difference as a constant.

### 2.4 Location bugs can affect rules, not only labels

**Source-confirmed:** tile and `regionId` coexist. Army normalization can retain an old home region while a unit is in the field. Reinforcement in `resolveTurn.js` checks whether `regions[u.regionId]` is owned territory. That can qualify a supplied field army for home reinforcement using its old base.

Do not blindly replace `regionId` with the nearest city: consumers may use it as a base, fallback, or legacy location. Define physical location and home assignment separately, then migrate the consumers.

### 2.5 Supply attrition already exists

**Source-confirmed:** `applySupplyMeter` reduces strength at zero supply; the subsequent recovery phase also blocks recovery for zero-supply units. Therefore “add starvation at zero” is not a sufficient diagnosis. Trace the actual unit through phase ordering, battle locks, identity replacement, normalization, and save/resume. A long zero-supply duration is a diagnostic warning, not proof that an army must immediately be deleted.

### 2.6 Other existing contracts to respect

- `useExclusivePanel` temporarily tucks panels and restores them on close. That helps explain returning city cards. It is not a global interaction coordinator.
- `processSieges` reports a city as fallen whenever siege HP reaches zero. The free-surrender concern has a concrete rule behind it.
- Tactical auxiliaries intentionally demobilize in `toStrategicResult`. Their disappearance is an existing design choice; persistent recruits would be a new mechanic.
- P3 R113b corrects R113: Cyrene **was** in battle reports. Keep the ghost-unit finding; do not invent a missing-report bug from the superseded observation.
- P3 shows strong AI settlement expansion despite P2's weak early growth. The target is useful military behavior and healthy pacing across speeds, not indiscriminately increasing settlement rate.
- Source training orders reserve resource costs immediately. R94's “not deducted until it starts” needs reproduction and display-state tracing, not an assumed engine rewrite.
- “Balanced never works hills” is too categorical: allocation scores production but prioritizes food sufficiency. Investigate the yield/food constraint and surface why focus changes have no effect.

## 3. Product decisions and recommended defaults

These are decisions to settle in design before implementing the dependent mechanics. They do not block writing this plan. Entries marked proposed should not be silently treated as previous user approval.

| Decision | Recommended direction | Consequences and checks |
|---|---|---|
| D1: economy battle defeat | Honor the reported user requirement that losing squads alone must not end a battle while the side's base remains. Define the eligible building set explicitly. | Recommended symmetric rule for base/economy battles. Field/naval battles without bases retain their own objectives. Route/kill outcomes from historical builds remain historical regression fixtures, not the new base-defeat rule. |
| D2: what counts as a building | Proposed: completed, owned, destructible base/economy buildings and designated military objectives count; unstarted ghosts, neutral scenery, walls as independent segments, and protected civilian decoration do not. | Explicitly review houses, the defender's keep, construction sites, and civilian manifests. Counting protected houses conflicts with the existing city-damage protection. UI text removal alone must not alter that protection. |
| D3: stalled base battles | Prefer draw/withdrawal or an explicitly announced objective timeout over secretly overriding D1 when units are gone. | No cheap remote house can guarantee a win. Define legal expansion bounds, unfinished-site behavior, no-worker/no-income situations, simultaneous destruction, and manual withdrawal. |
| D4: retreat | “Withdraw selected” orders movement to an exit; “Withdraw army” requires an in-game confirmation. | Survivors reaching safety persist; pursuit can cause actual losses. Neither action is synonymous with deleting every regiment or rerunning Auto. |
| D5: battle-trained troops | Keep auxiliaries temporary for the first remediation release; label this before training and in results. | Rebalance their role/cost before considering conversion to permanent units. Persistent conversion requires manpower, upkeep, capacity, and anti-farming rules. |
| D6: campaign capture | Use one capture-decision workflow for eligible conquered/surrendered cities: Conquer, Raze, Make tributary, Free. | Show disabled reasons when a choice is inapplicable. Multi-city majors, capital capture, liberation recipients, and last-city elimination need explicit rules. |
| D7: production and speed | Test a normal-speed early-city production target near 3 and Marathon near 2.5×, alongside cheaper opening builds. | These are trial values. Preserve meaningful terrain differences; compare several viable designs before setting constants. |
| D8: scaling costs | Scale content by era and intended duration; avoid charging an individual city more merely because it became productive. | Literal per-city output scaling cancels the reward for improvements and invites focus-switch exploits. Use reference output per era and bounded repeat-purchase escalation instead. |
| D9: expansion pressure | Add a soft administrative capacity only if calibrated upkeep, loyalty, and AI investment still fail to control runaway growth. | Reuse existing overextension/authority systems. Do not install a hidden hard city cap or punish terrain-poor starts. |
| D10: research history | Preserve date gates initially; make waiting, banked science, and next availability honest. | Removing historical gates is a separate design fork, not necessary to fix the ETA bug. |
| D11: map/intel trading | Add scoped map exchange as a later diplomacy choice. | Reveal explored geography at a known date; never reveal live armies or future resources without a distinct intel agreement. |
| D12: explicit user UX requests | One cycling Idle N chip, map Hold order, and remove “50% rule / at most N houses” text in all three battle surfaces. | Siege and held units leave idle counts. Keep the underlying housing-damage rule unless D2 separately changes it. |
| D13: later RTS control and economy requests | Adopt the U01–U14 follow-up as the target behavior: visible stone and battle supply, compact icon launchers, full starting roster instead of manually called reserves, clickable trees, purposeful worker loads, protected iPhone cutout space, and exactly +10 housing capacity per village house. | Reconcile older W05 reserve/menu acceptance against these later instructions. Treat the separate stone account and initial deployment as versioned gameplay changes; trace the reported +100 village-house gain before changing an existing +10 rule. |

## 4. Architecture and delivery rules

1. Extend existing deterministic engine modules and `applyBattleOutcome`; keep rule logic outside React.
2. Every calculation exposed as a price, ETA, eligibility check, or consequence preview comes from the same pure engine selector used to execute it.
3. Actions return a structured success/rejection reason. UI feedback must distinguish accepted, rejected, queued, completed, and invalidated actions.
4. Randomness remains seeded; macro rules use `state.rngSeed`, tactical rules use the deterministic fixed-point sim. No wall-clock values in gameplay decisions.
5. Every added persistent field gets a save default/migration and every replay-affecting change gets a protocol/setup version policy.
6. Add player/AI parity deliberately. Shared economics need shared resource costs; limited AI simulation tiers need documented behavior budgets.
7. Preserve maps and units at the same camera location through ordinary layout changes. Camera movement requires an explicit focus intent.
8. Balance changes require paired seeded measurements. A prettier screenshot or one winning battle does not validate a rule change.
9. When implementation begins, use feature branches from the integration baseline and small reviewable changes. Updating `main` deploys the live site; merging/deployment is a separate task.

## 5. Work packages

Each package includes implementation work, dependencies, evidence, and acceptance criteria. Sizes are relative: S is localized, M spans a subsystem, L spans several subsystems, XL contains substantial gameplay design and calibration. They are not calendar commitments.

### W00. Reproduction fixtures, baseline metrics, and coverage ledger

**Priority P0; size M; dependencies none.** Evidence: all three source reports.

Implementation tasks:

1. Record build SHA, save schema, replay/setup version, seed, scenario, nation, difficulty, speed, viewport, actual input modality, and battle economy mode in every fixture.
2. Obtain original audit saves/logs if available. Otherwise create minimal scenarios reproducing each defect and label them reconstructed. Do not claim reconstructed seed runs reproduce the exact historical Kerma campaign.
3. Build fixtures for: economy siege won with trained cannons; withdrawal with living cavalry; untouched and called reserves; militia-only city; zero-garrison city; sack with population loss; conquest followed by unrest; gated research; discounted land; purchased development; simultaneous tribute and battle arrival.
4. Preserve baseline result, army identities/strength, ownership, resources, RNG state, command log, final tick/hash, and operation IDs. Capture worker and authoritative replay outputs separately.
5. Add campaign telemetry to the existing simulation harness: early build completion, meaningful-action gaps, treasury-to-income ratio, currency utilization, contacts, reachable war targets, actual army progress, siege time, conquest retention, trade uptime, demand frequency, and rebellions by cause.
6. Make run policies explicit. Passive players, expansion players, and military players generate different findings. Auto-answer pending events/peace/battles/capture choices in long runs so blocked turns are not counted as inactivity.

Acceptance:

- Every C/H issue has a minimal reproducible fixture or an explicit evidence gap and next diagnostic step.
- Baseline and changed builds can run the same scenario and report comparable checkpoints.
- R113b is recorded as a correction, and untested areas remain marked untested.
- Simulation summaries distinguish completion, player defeat, and unresolved-decision stalls.

### W01. Complete battle command verification and immutable setup identity

**Priority P0; size L; dependencies W00.** Evidence: C1/C2, R96–103, R144–158; source findings §2.1.

Primary source: `src/battle/sim/replay.js`, `orders.js`, `economy.js`, `hash.js`, `headless.js`; `src/battle/worker/battleLoop.js`; `src/battle/setup/buildBattleSetup.js`; `src/engine/gameReducer.js`; edge-engine consumers built by `build:edge`.

Implementation tasks:

1. Define a versioned, exhaustive command schema shared by live input validation, worker admission, recording, replay, and edge verification. Separate external player commands from internal AI commands without losing either sim behavior.
2. Add the missing deployment and economy command types with their complete payloads: tile coordinates, building key versus building index, role, count, slot, node, target kind/index, rally location, and worker/squad references. Validate each field according to its command; merely extending `ORDER_TYPES` is insufficient.
3. Enforce side ownership, known catalogs, integer/index bounds, finite coordinates, legal timing, affordability, capacity, visibility, and target legality in the authoritative sim. Replays must not permit commanding enemy workers or creating unsupported buildings.
4. Define admitted-versus-executed command semantics. Legal no-ops can remain logged; malformed/truncated logs must fail verification explicitly. Do not silently drop a legitimate order then stamp the altered replay as verified.
5. Preserve same-tick order ordering and deployment-at-tick-zero semantics. Test sequential build/train commands whose generated IDs depend on earlier orders.
6. Pin a complete battle-start setup or reproducible immutable setup reference. Include campaign/game identity, participating units, reinforcements, city manifest, terrain, economy, modifiers, seed, controller sides, setup version, and rules version. Avoid rebuilding from a changed campaign state.
7. Carry live final hash, hash chain, tick, setup identity, and command-log identity through the host to verification. Compare them before applying campaign effects. Current host dispatch does not carry all of the worker's end metadata.
8. Validate checkpoint/full-log and trusted-segment replay equivalence. Define handling for older saves, incompatible checkpoints, worker fallback, and interrupted result submission.
9. Move long verification work off the interactive UI path where practical, or provide a responsive verification stage. Confirm edge execution/time budgets for long economy battles. Never weaken authority to improve speed.
10. Make log-size overflow visible and recoverable before it changes a result; test the 20,000-order cap, maximum squads per order, oversized counts, and malformed target IDs.

Acceptance:

- A siege involving deployment, gathering, building, repair, training, cancellation, rally, reserve calls, and attacks produces identical final world hash, result, and unit ledger live and through authoritative replay.
- Every supported external command has schema/round-trip coverage. An exhaustiveness check fails when a new command is implemented in the sim without verifier support.
- Reload at deployment, mid-construction, during a reserve entry, and after battle end preserves the verified outcome.
- Invalid logs produce a recoverable verification error with preserved evidence; they do not become an unexplained defeat.
- Browser and edge bundles use compatible rule/schema versions.

### W02. Verified outcome display, casualty conservation, and atomic persistence

**Priority P0; size L; dependencies W01.** Evidence: C1/C2, P2 §7/session 2, R57/103/113b/157–158.

Primary source: `battleOutcome.js`, `battleInputs.js`, `battleReports.js`, `gameReducer.js`; `TacticalBattleHost.jsx`, `BattleResultScreen.jsx`, `battleReportView.js`; `src/battle/sim/result.js`.

Implementation tasks:

1. Use a lifecycle such as `running → ended → verifying → committed → acknowledged`. The final result screen must render the verified, committed outcome. A preview, if retained, must be explicitly provisional.
2. Extend the existing outcome contract with a stable participant ledger: campaign units, militia, synthetic troops, allied reinforcements, reserve units, workers, and temporary auxiliaries each have explicit identity and disposition.
3. Account separately for killed, escaped, routed, still on the field, never deployed, and demobilized. Preserve surviving strength without double conversion between internal strength and displayed men. Show campaign casualties separately from auxiliary casualties and totals with declared denominators.
4. Require a result row for each committed participant. Historical battles with reserves need an explicit untouched-reserve record under their old rules version; new battles use the U10 full starting-roster rule. Current fallback to original strength for missing reported rows must not mask an incomplete verified result.
5. Compute conquest, control damage, loot, XP, commander fates, city damage, retreat location, war score, and supplies once. UI, log, replay report, map ownership, and archive all reference that same committed receipt.
6. Preserve battle-type distinctions: raid success can mean a city was sacked but not conquered; “held, but walls damaged” is incorrect for an unwalled city that was successfully sacked.
7. Save the outcome atomically with operation completion and pending-capture state. Clear checkpoints only after durable resolution; keep replay evidence through acknowledgement/error recovery.
8. Review applied-ID memory expiry. A replayed operation older than the current 64-entry memory must still be rejected through game/operation identity, pending-state validation, or a durable operation index.
9. Audit canceled/invalidated battles: peace, target deletion, city ownership change, or missing queued-defense record must produce an explicit cancellation reason, not silently discard a finished battle.
10. Add reconciliation diagnostics to `stateAudit`: duplicate IDs, negative/impossible strength, dead participants retained, missing survivors, total casualty mismatch, and conflicting battle/capture receipts. Keep long low-supply warnings separate from hard structural invariants.
11. For a correctly recorded one-round Auto battle, show an informative immediate summary rather than implying a longer tactical replay exists. This is a presentation investigation from R58, not a missing-round defect.

Acceptance:

- Kerma-style historical rules fixture: displayed victory, verified verdict, report, ownership/control result, and surviving cavalry all agree. Under the later D1 rule, routing alone continues the battle where a base still stands.
- A 355-strength survivor never reappears at 1,000 without a separately recorded legal reinforcement transaction.
- Repeat Continue, duplicate network submission, refresh, cloud retry, and older operation replay cannot pay loot/XP twice.
- Retreat does not report living escaped soldiers as killed. Historical untouched reserves retain their original state during legacy replay; new committed troops use the full starting-roster rule.
- Closing the app after verification but before Continue cannot lose or duplicate the result.

### W03. Physical location, movement, supply, and army command integrity

**Priority P1, with P0 escalation if it independently reproduces C2; size L; dependencies W00/W02 interfaces.** Evidence: M4/M17, C2 supply observation, P2 §2/4, R26–34/74–75/82–83/119–120.

Primary source: `armies.js`, `routes.js`, `marchAttack.js`, `fieldBattle.js`, `supplyMeter.js`, `supplies.js`, `resolveTurn.js`; `ArmySheet.jsx`, `armySheetModel.js`, map march/prompt models.

Implementation tasks:

1. Introduce shared selectors for physical tile, territory actually occupied, assigned base, co-located stack, and reinforcement eligibility. Inventory every `regionId` consumer before deciding whether to migrate the field or add an explicit base field.
2. Fix labels and city “Armies here” lists to use physical co-location. Display “near Siwa, based at Men-nefer” only when both facts are relevant.
3. Make city-card attacks, march-to-attack, Move now, keyboard, and map taps use the same route/adjacency and movement-point validation. Preserve working march-to-assault behavior. Eliminate any remaining teleport path.
4. Compute ETA from remaining movement now plus future turns, including terrain, embarkation, zones of control, and movement already spent. Show supply estimates for both ordinary and attack routes.
5. Add explicit attack/intercept selection for visible hostile armies and moving raiders, using `canFight`/`canAttack`. Define what happens when the target moves, becomes unseen, becomes friendly, or shares a tile with a city.
6. Trace zero-supply attrition turn by turn. Test battles/resume, supply refills, ownership changes, blocked routes, starvation and reinforcement ordering. Fix the actual bypass rather than imposing arbitrary deletion after N turns.
7. Block home reinforcement unless the physical tile and logistics conditions qualify. Make national supply stock, local supply meter, attrition, and refill messages distinct.
8. Define map orders `hold`, `garrison`, `guard`, `siege`, `march`, and `explore` clearly enough for idle detection. Canceling an assault should not covertly start a siege against an independent; require explicit hostile intent or an explicitly visible ongoing siege order.
9. Add stack splitting/individual unit selection without moving every unit assigned to the same home city. Give settlers civilian presentation rather than combat morale/recruit labels.
10. Show route lines for settlers and smooth visual interpolation for map marches while keeping turn-based positions authoritative. Restyle thick route lines for zoom and phone readability.

Acceptance:

- A unit in Sinai is absent from Men-nefer's “here” list and cannot reinforce merely because its base is Men-nefer.
- Movement previews match observed arrival for partially spent moves, Move now, long marches, attacks, and reroutes.
- Unsupported movement/attack paths reject with a visible reason; no teleport or distance-free capture.
- Supply forecast and actual drain agree in fixtures; zero-supply units lose strength when the rule requires it and never recover simultaneously without a valid transition.
- Held, marching, guarding, retreating, and actively besieging units are excluded from idle prompts.

### W04. One active interaction, stable phone controls, and queued decisions

**Priority P1; size L; dependencies W00; coordinate with W02/W12.** Evidence: H5, L1/L7/L11, P2 §5/6/9/10/session 2, P3 §7, R24/57/73/79/81/85/106/109–110/138–141.

Primary source: `useExclusivePanel.js`, `useAutoPeek.js`, `useLayoutMode.js`, `MapInsetsContext.jsx`, panel/sheet/modal hosts, `NextPrompt.jsx`, `nextPromptModel.js`, `turnBlockers.js`, `index.css`.

Implementation tasks:

1. Add a single UI interaction coordinator with one active sheet/dialog on constrained layouts, a selected context, and a persistent queue of mandatory decisions. Cosmetic notices should not become engine blockers.
2. Give each request a stable ID, type, priority, related entity, blocking status, and resolved/invalidated state. Capture, defense, peace, research, event, tribute, first contact, and era notices must not replace each other's engine state.
3. Define priority: finish/verify current battle first; then mandatory battle/capture/peace/event decisions according to valid game order; informational contacts/era news wait. Show the queue count and why End Turn is blocked.
4. Opening a city directly opens the actionable city view. Closing it returns to the map once, without restoring a hidden card. Optional explicit navigation history can use a Back control.
5. Put modal decisions in a viewport-level portal with focus trapping and sensible reading width. Use `min(available viewport width, intended card width)`; a hard 480-pixel minimum must not cause overflow on smaller landscape devices or zoomed text.
6. Anchor End Turn, queue/idle chips, pause, and speed controls to stable viewport slots. Reserve their space; panel opening must not move them beneath an in-flight pointer.
7. Size every overlay using visible height, safe-area insets, and virtual-keyboard changes. Support 844×340 as well as 844×390; keep action footers reachable with scrollable content.
8. Replace multiple idle chips with `Idle N`; successive taps cycle a stable list. Keep selection separate from unwanted camera jumps. Give low-supply and urgent risks their own compact priority indicators.
9. Show full or accessible city names in CTAs; labels must not degrade to ambiguous fragments. Provide a concise reason when a helper points at research or production.
10. Auto-dismiss informational era banners into history, with accessible announcements. No multi-turn obstruction of gold/research. Replace native New Game confirmation with an in-game dialog that states save consequences.
11. Convert Empire section headers to real buttons with `aria-expanded`, named resource icons, logical keyboard focus, and adequate touch targets. Clarify duplicate Map/Authority headings.
12. Ensure overlay close/open never forwards the same pointer-up to underlying controls. Test cancel-to-Tower and tribute-to-disappearing-battle sequences explicitly.
13. Give war declarations a durable, actionable notification even when another decision is active (R88). Keep the march instruction banner from covering its route/destination (P2 session 2); these require explicit checks beyond the general one-sheet rule.

Acceptance:

- At 844×340, battle arrival + tribute + first contact + era notice yields one readable active decision and recoverable queued items; no 170-pixel card or lost pre-battle choice.
- All primary actions are reachable without sideways scrolling. Focus returns to the initiating control on close.
- End Turn/speed controls remain in the same screen coordinates as sheets open/close, apart from actual viewport resizing.
- Closing a city requires one close. Opening another panel cannot dismiss an unresolved engine decision.
- Real touch, keyboard, screen reader, Safari visible-height changes, and portrait-to-landscape transitions are covered in W15.

### W05. Battle placement, orders, navigation, starting roster, and usable HUD

**Priority P1; size XL; dependencies W01 and W04 primitives.** Evidence: H6/H7, M13, L2/L3, P2 §7/10, R92–102/134–156.

Primary source: `TacticalBattleScreen.jsx`, `BattleHud.jsx`, `EconomyHud.jsx`, `battleHudModel.js`, `inspectModel.js`, battle renderer/picking, `orders.js`, `economy.js`, `movement.js`, `tacticalAI.js`.

Placement:

1. Use the sim's placement predicate for preview, legal-area tint, footprint, and final validation. Account for bounds, fog, slope/obstacles, resource footprints, spacing, access, and cost. Do not reveal unseen terrain/resources through the legal overlay.
2. Draw the playable field edge, building/resource footprints, and selected build footprint. Show a specific rejection reason beside disabled Build here.
3. Make phone placement an explicit preview/confirm/cancel mode. Keep the build menu collapsed while positioning the ghost. After successful placement, clear the ghost/error and reopen the build menu for the still-selected worker, with its X close control; prevent the confirming tap from placing another building or passing through the menu. On cancel, return to the same menu unless the worker was deselected.
4. Keep close-menu, cancel-placement, cancel-construction, and Stop working distinct. Canceling the menu must not halt builders or trigger a refund.
5. Support worker-to-site assignment and repair through understandable touch actions; the same action must work by right-click and touch. Explain long-press details or provide a visible info affordance.
6. Generate a legal-build-space diagnostic for each map preset, culture layout, and economy start. If a map has almost no valid space, improve layout generation as well as the overlay; initial camps should have reachable room for core economy buildings.

Orders and navigation:

7. “All N” selects without centering. Add explicit Find army, Find base, Find enemy objective, and a toggled minimap. Objective navigation respects discovered intel.
8. Give touch an explicit order mode with a visible target marker and accepted/rejected feedback. Test taps on squads, walls, gates, economy buildings, terrain, and mixed overlapping targets at multiple zoom levels.
9. Provide attack-move as an explicit default combat command while retaining ordinary Move and Hold semantics. On target destruction, acquire nearby threats within leash/stance rules; Hold must not chase, and a withdrawal Move must not turn into an attack.
10. Preserve distinct class speeds in actual travel and animation. When a mixed selection uses group pace, show that it is matching the slowest unit and provide an explicit way to release the group; cavalry should not silently charge a tower alone, while cavalry ordered by itself should outrun infantry and siege should remain slower.
11. Start every eligible committed battle regiment with the opening army and remove the manual Reserve button/panel. Reconcile deployment space, field cap, starting supply, balance, live/replay parity, retreat and the participant ledger. Delayed allied reinforcements still need their own arrival signal; they are not player-callable reserves.
12. Add concise casualty/arrival notifications without stacking permanent alerts. Differentiate killed, routed, starting troops, and genuine later reinforcements rather than only decrementing All N.
13. Add desktop keyboard/edge panning, documented drag alternatives, optional follow selection, and predictable zoom-to-pointer. Keep touch drag/lasso/pinch modes unambiguous.

HUD and rendering:

14. Collapse defender housing by default and fix its collapse behavior. Remove the 50% rule text from pre-battle, housing, and results; retain useful actual damage/population summaries.
15. Aim for at least 70% unobscured field in the ordinary playing state, measured as the union of HUD occlusion. A selected worker shows only a circular hammer launcher until the player opens the build menu; a circular wand launcher similarly contains abilities and powers. A dedicated icon-only deselect control clears the active selection or armed action. Temporary placement, pause, or inspection states may use more space with an explicit exit. Do not achieve the target by shrinking controls below usable touch size.
16. Keep pause/speed positions fixed. Shorten deployment help, use touch-specific instructions, avoid overlay collisions with optional performance stats, and make the default field lighting readable.
17. Preload or render fallbacks for first-open build icons. Use consistent camp naming or visibly label an era upgrade. Distinguish friendly/enemy buildings by flags, silhouettes, outlines, and text, not color alone. Display Food, Materials, Stone, Gold and Battle Supply with distinct symbols and accessible names; keep the critical values visible on iPhone without requiring horizontal scrolling.
18. Verify a compact pause-sheet layout separately from fixed pause/speed button positions. Recheck Keep focusing in each battle type and loading state, preserving the working P3 case while reproducing P2's failure. Reconcile R94's training-cost display with the source's immediate reservation and provide clear queue acknowledgement.

Acceptance:

- Most first-time core placements succeed on legal visible ground; every failure gives the same reason the sim uses. No ghost stuck at camp, stale rejection text, or accidental second build.
- All visible interaction paths emit an accepted command or explicit reason. Automated touch tests use actual touch events, not synthetic mouse clicks.
- Selected troops obey pullback, attack-move, Hold, group pace, and structure targeting in a traced battle. No unbounded full-squad scans per unit are added to the sim.
- Every eligible starting unit can be deployed and used without a Reserve button; later reinforcements remain distinguishable. Friendly buildings are distinguishable in grayscale/accessibility checks.
- No routine HUD arrangement leaves only a narrow strip of battlefield at 844×340.

### W06. Battle objectives, retreat, auxiliaries, siege balance, and pre-battle truth

**Priority P1; size XL; dependencies W01/W02/W05; decisions D1–D5.** Evidence: H8, M11/M12/M14/M16, P2 §7, P3 §6, R28–29/86/91/100–103/133/146/150/157.

Primary source: tactical `step.js`, `orders.js`, `morale.js`, `economy.js`, `economyAI.js`, `result.js`; `battleInputs.js`, `autoBattle.js`, `battleOdds.js`, `sieges.js`; pre-battle and defense view models.

Implementation tasks:

1. Write a battle-type objective table for town assault, field, raid, sack, sally, river, landing, and naval combat. Define success, capture eligibility, partial victory, withdrawal, time limit, and simultaneous defeat separately.
2. Implement D1 in base/economy battles: lack of fielded squads alone does not cause defeat while eligible owned buildings remain. Recruitment, workers, and existing resource capacity remain usable.
3. Resolve D2/D3 before code: protected civilian buildings, cheap remote houses, unfinished sites, no builders/resources, buildings outside navigable space, and endless repairs cannot make an unwinnable permanent battle. Bound build territory and expose stalemate/withdrawal terms; do not silently turn army loss into defeat again.
4. Implement selected withdrawal and whole-army withdrawal with exit routing, pursuit, full starting-roster handling, later reinforcement handling, and preserved survivors. Explain likely losses before whole withdrawal; do not promise every living squad survives.
5. Use identical `battleInputs` for Command, Auto, odds, and empty-side handling. Pre-battle defender counts, militia, walls, keep condition, era, supply and reinforcements must match the actual setup.
6. Offer Command for militia/economy defense when playable. If setup truly cannot support Command, say why before selecting it. Do not silently auto-resolve a promised battle.
7. Show numerical Auto estimate before the choice, with a clear “estimated Auto chance” label and uncertainty when based on sampling/intel. Avoid presenting it as the probability a skilled player wins Command. Reuse/cache a fixed seed sample without advancing game RNG.
8. Add pre-battle siege guidance when the attacker lacks tools for towers/walls: bring an unlocked siege regiment, build a siege workshop in battle, continue a legitimate siege, or withdraw.
9. Normalize defenses into distinct fortification tier, siege endurance/blockade progress, wall/gate HP, and keep HP. An unwalled town can have siege endurance; do not label that as walls.
10. Rework zero-HP automatic surrender. A healthy, supplied, stronger garrison should not capitulate solely because a siege bar emptied. Evaluate morale, supplies, encirclement, relief prospects, relative effective strength, and negotiated terms; permit a sally/last defense where appropriate. Some no-battle surrenders should remain possible and satisfying.
11. Price siege waiting with attacker upkeep/supply, exposure to relief/sallies, and opportunity cost. Avoid deterministic fixed-duration free city/treasury farming.
12. Calibrate auxiliary strength/cost, towers, repair throughput, siege weapons, and era matchups with a matrix of traced battles. A 200-strength squad being smaller than a 1,000-strength regiment is not itself a bug; show scale and intended role and tune aggregate investment efficiency.
13. Re-run Auto/tactical parity after objective/economy/AI changes and make each result share the same campaign conversion rules.

Acceptance:

- A base survives an army wipe and can rebuild forces under D1. Field/naval battles still terminate according to their declared objectives.
- Retreat preserves escaped campaign survivors, and full withdrawal has a visible confirmation. Committed starting regiments and genuine later reinforcements cannot be lost through a misleading selected-unit action.
- Empty-garrison/militia setup, wall data, displayed men, and battle actuals agree for all modes.
- Healthy cities do not surrender to a token unsupported siege; weaker isolated cities can surrender under transparent conditions.
- Auxiliary/cannon/tower/repair outcomes stay within documented parity bands across at least 32 seeds per relevant matchup, with remaining outliers investigated.

### W07. Persistent investment, useful currencies, and campaign pacing

**Priority P1; size XL; dependencies W00/W03; decisions D7–D9.** Evidence: H1/H9, P2 §2/6/session 2, P3 §6, R20–22/41–42/49–56/63/104/126/129–130.

Primary source: `world/cities.js`, `development.js`, `economy.js`, `population.js`, `aiEconomy.js`, `aiProduction.js`, `nationalPower.js`, `gameReducer.js`, `resolveTurn.js`, action-cost and speed data.

Persistent development and growth:

1. Separate purchased investment from derived tile yields. Suggested schema: `city.investment = { tax, production, manpower }`; retain a derived compatibility view only where legacy readers require it. Name and export the formula for each effect.
2. Decide how ADM/DIP/MIL investment feeds at least two existing systems, such as local output plus upkeep/manpower or growth plus capacity. Do not create unexplained +1 values with no economic consequences.
3. Recompute derived values without erasing investment. Define capture, razing, migration, infrastructure damage, focus changes, and building upgrades consistently.
4. For old saves, default new investment to zero unless trustworthy historical information supports reconstruction. Do not infer paid bonuses from inflated derived yields. Preserve existing banks and disclose migration behavior in release notes.
5. Show what Invest in growth buys: people/food progress, growth threshold, expected turns saved, and housing/amenity limits. Reject ineffective purchases or clearly explain the capped benefit before payment.

Production and first cities:

6. Compare three prototypes: smarter Balanced allocation, a modest city-center production baseline, and a temporary first-build/outpost bonus. Test combinations only after measuring each; do not stack all buffs blindly.
7. A provisional trial may target at least 3 production for a normal viable early settlement, but poor desert sites must still have opportunity costs. Show food-first allocation and unavailable worker choices at size 1–2.
8. Make first settler, first defender, and first economic building fit useful early decision intervals. Reduce oppressive settler per-city escalation while retaining a real expansion cost.
9. Add first-time guidance for a build above roughly 20 Normal-equivalent turns: focus change if helpful, improvement, cheaper alternative, purchase, or wait. Scale warnings with speed and suppress repeated nagging once understood.
10. Calibrate costs against intended era output. Proposed general form: `cost = baseItemCost × speedProductionFactor × eraCostFactor × boundedRepeatFactor`, with explicit exceptions for opening builds and unique projects. Use era reference output for tuning, not the current city's live production.
11. Test Marathon production/research/growth/movement/event/reign timing as a coordinated pacing table. Changing the global multiplier alone can distort supply range, diplomacy, and ruler relevance. Compare 4× and approximately 2.5× as experiments, not a foregone result.

Spending:

12. Add a premium gold purchase of remaining production through the existing queue. Quote remaining cost, resources/manpower, completion timing, and resulting upkeep before commitment.
13. Proposed quote form: `ceil(remainingProduction × goldPerProduction[era] × rushPremium × boundedRushEscalation)`. Zero-cost completions, queue switching, overflow and rounding must not produce free production or refunds greater than payment.
14. First release eligibility: ordinary units/buildings only when prerequisites, coast, resource stocks, population/manpower, and capacity permit them. Explicitly decide settlers, wonders, damaged buildings, and besieged-city purchases; default to restrictions where instant purchases bypass major strategic costs.
15. Make existing currency uses worthwhile before adding new meters: ADM for durable administration/development/reforms, DIP for credible agreements/intel/influence, MIL for training/readiness/leadership with tradeoffs. Avoid a generic one-click permanent combat-stat purchase.
16. Scale advisor/infrastructure/defense/scholar actions with their actual value, repeat use, and era. Display first-hire versus additional-hire differences. Never scale demands or every price directly to the player's saved treasury.
17. Show compact ADM/DIP/MIL access and explanatory tooltips. Add spend recommendations with projected effects; do not demand the player empty their treasury to make telemetry look healthy.
18. Consider soft currency storage limits only after useful sinks exist. Prefer diminishing generation/overflow choices over confiscating old-save balances. Do not ship a hard cap as the sole fix for meaningless decisions.
19. Teach AI to budget reserves, building investment, settlers, upkeep, and any shared rush rules. Diagnose bankruptcy/civil-war feedback rather than adding income indefinitely.
20. Evaluate a soft administrative burden using existing authority/overextension only if large-empire concentration still runs away after these changes. Give compact and wide empires viable distinct strategies.

Acceptance and initial tuning targets:

- Development remains effective through 20 resolved turns, save/load, focus changes, and lawful ownership transitions.
- An affordable displayed purchase debits the quoted amount; all prerequisites are revalidated atomically and repeated taps cannot overspend or duplicate completion.
- In deliberately viable starter fixtures, a first useful defender/building generally completes within 5–15 Normal turns and a first settler within roughly 12–25; these are proposed tuning ranges, not universal terrain guarantees.
- New cities have a useful growth or production path; bad sites remain allowed with explicit warnings.
- Currency utility is measured by meaningful available choices and spend patterns across playstyles, not a forced zero bank. A wealthy player can save toward a goal.
- Balance comparison includes early/late production, science, first expansion, bankruptcy, rebellions, city concentration, and AI parity at multiple speeds.

### W08. City actions, build queues, shared quotes, and resource clarity

**Priority P1/P2; size L; dependencies W07 selectors; can start display/queue work alongside W07.** Evidence: M7/M8/M9/M18, P2 §4/5, R23/48/51–56/64/68/128–130.

Primary source: `CityPanel.jsx`, `CityBuildings.jsx`, `CityPolitics.jsx`, `CityRail.jsx`, their models; `world/cities.js`, reducer queue/purchase actions, building/unit catalogs, `describeEffects.js`, coast/naval eligibility readers.

Implementation tasks:

1. Put Focus and its actual yield change at the top. Explain food constraints, locks, size, and outpost status when a different focus produces no change.
2. Give every building, upgrade, law-linked city action, and improvement effect text: current → next effect, cost, upkeep, prerequisites, growth/production impact, and meaningful limitations. Use the existing effects-description machinery where appropriate.
3. Make row interaction deliberate: row opens details; a stable, adequately sized action queues the item. Do not make an entire scrolling row an accidental purchase target.
4. Keep catalog ordering and row heights stable while queue counts change. Use stable item keys; rapid taps on Spearmen must never shift to Chariots or Settlers.
5. Keep a compact queue visible, confirm additions with a restrained toast/count, and preserve scroll position. Support move up/down/front with accessible controls; drag can be optional.
6. Store progress per queue item or define an explicit switching rule. Reorder should preserve progress. Cancellation must disclose any lost/refunded progress; repeated switch/rush/cancel cannot duplicate stored production.
7. Identify improvements by stable tile reference, direction/distance/terrain, resource and yields. Tap highlights the exact tile and previews its effect. Label repair versus new improvement.
8. Unify `quoteBuyTile`/eligibility across UI and reducer, including research, border reach, age, discounts, repeat-buy escalation, and city identity. Stale quotes require a visible refresh or reconfirmed changed price, never a silent higher debit.
9. Centralize naval eligibility: actual usable coast, appropriate port rules, unlocked ship type, and valid launch tile. Apply it to every tab, quick-build, production advisor, AI, rush, and reducer action. A river/oasis is not automatically navigable coast; distinguish ocean, lake, and river rules.
10. Disabled quick-build buttons must explain unmet requirements. No inert enabled buttons. Defense tab should link to real garrison, fortification, reserve, or training actions where available, otherwise explain its read-only role.
11. Derive city rail ETA from the same production model as the queue. Remove “Settlers in 2800 t” discrepancies.
12. Explain ownership versus extraction: iron requires an eligible mine/worked tile and tech; display why a resource is not entering stocks. Use era discovery rules consistently in site cards, map icons, and buying previews.
13. Explain the outpost stage, expected maturation, name selection, and growth blockers before founding and afterward. Give the new settlement an appropriate visual immediately, even if a small camp is intentional.
14. Investigate R55's Iron entry remaining after purchase using exact tile IDs. If it is the purchased tile, invalidate/remove the stale candidate; if it is a different iron tile, disambiguate the rows. Do not infer duplicate land purchase from the shared label alone.

Acceptance:

- Ten rapid taps enqueue ten intended actions or a documented queue-limit response; no wrong rows, lost taps, or silent rejection.
- Reordering, partial progress, removal, rush, completion and invalidated prerequisites obey one tested ledger.
- Every disabled item has a readable reason, and every enabled action has an observable result.
- Inland ship/harbor queueing fails consistently at UI and engine boundaries; valid coastal and intended lake cases still work.
- Quoted land price and actual delta match with discounts, consecutive buys, save reload, and extended border reach.

### W09. Research, governments, laws, rulers, and visible goals

**Priority P1/P2; size L; dependencies W04/W07.** Evidence: M1/M2, L4/L6, P2 §2/6, P3 §8, R6/20/41–43/76/78/105–108/114/117/127/133.

Primary source: `research.js`, `researchView.js`, `researchSheetModel.js`, tech/age data; `authority.js`, `nationalPower.js`, `lawRules.js`, government/law actions; `rulers.js`, `peopleNames.js`, `eraGoals.js`, `LegacyPanel.jsx`.

Implementation tasks:

1. Produce one research status object: active, queued, waiting for date, missing prerequisite, no legal choices, completed; include current progress, banked science, expected completion, next available date, and estimated turns to that date.
2. Compute waiting time using the actual calendar/speed schedule, including BCE/CE transitions and changing years per turn. Display `max(science readiness, date readiness)` only when its assumptions hold; otherwise show the two constraints separately.
3. Preserve science banking and overflow. Advisor mode should show “waiting for an available technology” and automatically resume when one becomes legal, without a misleading Choose research blocker.
4. Feed Empire, top bar, Research, and helpers from the same selector. Distinguish calendar era from technology expertise if they can differ; fix wrong-age headings and anachronistic unit naming through explicit unlock/display rules.
5. Preview Fund Scholars: gold cost, science added, turns saved now or banked for a future gate. Make boost Map actions focus a real eligible tile, highlight it, and explain the lens/action activated.
6. Government changes use a pure projected-state preview: immediate stability, authority before/after, law eligibility, default reforms, costs, cooldown, and downstream upkeep/loyalty. Confirm high-impact changes using the in-game dialog.
7. Offer explicit reform choices or clearly show the selected defaults. Do not advertise only -2 stability while producing a larger authority penalty through hidden rules.
8. Every law shows current versus proposed effects, why it is locked, and how to regain eligibility. Avoid silent compounded multipliers between government, stability and authority.
9. Tune ruler duration in calendar and turn terms across speeds. Add succession logs, distinguish recurrent personal names with house/ordinal where appropriate, and show meaningful traits over enough turns to matter. Deduplicate advisor display names where ambiguity harms selection.
10. Add a compact optional era-goal tracker on the map, achievement progress, a recommended next action, and links to Research/Legacy. Track clear completion and avoid repeating banners every turn.

Acceptance:

- A date-gated technology never says “1 turn” for 20 turns without exposing the gate. Advisor waiting never falsely blocks End Turn.
- Research progress and era wording agree across every surface; no banked science disappears at a gate or migration.
- Government preview equals post-action state, including the Authority 25 law threshold and automatically selected reforms.
- Rulers' actual succession and log entries agree. Goals have measurable progress and do not cover key controls.

### W10. Credible tribute, diplomatic consequences, grudges, trade, and intelligence

**Priority P1; size XL; dependencies W03/W04/W07.** Evidence: H2, M3/M10, L5/L9, P2 §2/3/6, R36/59–67/71–72/80/88/112/116/122–124/162–164.

Primary source: `diplomacy.js`, `opinion.js`, `accords.js`, `raids.js`, `grudges.js`, `indepPolicy.js`, `hostility.js`, `tradeRoutes.js`, `plunder.js`, demand/peace models and nation actions.

Tribute and peace:

1. Inventory and unify major one-off demands, independent demands, voluntary recurring protection tribute, tribute paid by independents, peace reparations, and war threats. Each has a distinct cost, duration, enforcement and UI label.
2. Gate demands by contact/intel, reachable military pressure, relation, existing agreement/truce, recent payment/refusal, and economic viability. Friendly trading partners should need an explicit relationship breakdown before coercion.
3. Base credible pressure on deployable strength and reach, not total units anywhere on Earth. Use bounded demand values tied to expected income/value and relative force. Cap by actual ability to pay; avoid taxing the entire saved bank at a fixed fraction.
4. Add both a per-pair cooldown and a global incoming-demand pacing budget. Otherwise 20 nations can each obey a cooldown while producing a demand every turn. Proposed starting experiments: 20–30 Normal-equivalent turns per pair, with a longer protection period than a few turns.
5. Accepting a protection demand atomically spends gold, establishes exact truce scope/expiry, applies the promised opinion effect, clears that demand, and invalidates conflicting pending war/raid orders.
6. Put truce checks at execution in `declareWar`, AI operations, raid dispatch, field attack, city assault, and indirect/pact-triggered escalation. Define what happens to raiders already en route and wars already active. Disable or relabel a peace-buying payment that cannot legally stop an existing war.
7. Treaty status and AT WAR cannot both represent the same pair as protected at the same time. If a deliberately breakable treaty exists, state the breach and penalties rather than retaining a misleading green safety chip.
8. Refusal promises only what can actually happen. If raiders cannot reach anything, say it increases hostility rather than promising an immediate attack. Scale late waves so delayed grudges do not synchronize into unavoidable city collapse.

Grudges and opinion:

9. Attribute aggression, defense, casualties, sack, tribute, and city loss separately. Being attacked should not automatically produce “you killed their soldiers” moral blame as if the defender started the conflict.
10. Preserve any intentional hostility after casualties, but label its cause truthfully and bound/decay it. Warm kin/culture affinity and active raiding need a coherent combined attitude/threat presentation.
11. Give Why? a full breakdown of base standing, treaties, gifts, grievances, fear, kinship, and temporary effects; reconcile the sum to the displayed opinion.
12. First-contact text uses the actual discovery cause: scouts, settlers, border expansion, trade, or incoming travelers. Independent arrivals should distinguish emergence from a second settlement by an existing polity.

Trade and intel:

13. Trade preview shows current route viability, projected benefit, setup cost, and known threats. A valid agreement may be unprofitable temporarily, but the player must see why and what can restore it.
14. Show route on map, known blockage location, land/sea alternatives, and useful actions: escort/clear a raider, restore access, repair route, switch route, suspend or cancel. Avoid showing hidden rebels precisely when the player lacks intel.
15. Aggregate repeated plunder into a persistent route status plus milestone updates. Track downtime and losses; avoid 90 identical lines. Plunder rewards must come from actual forgone/transported value, not an infinite payment for a permanently blocked empty route.
16. Add scoped map exchange after basic trade works: define explored-tile snapshot, partner eligibility, reciprocal value/cost, expiry for intel, and denial reasons. Prevent map resale loops generating unlimited rewards or leaking live enemy positions.

Acceptance:

- Paying valid protection prevents same-turn and queued hostile actions inside its scope. A trade partner cannot simultaneously promise no raids and launch one through a separate subsystem.
- Payment/refusal consequences and expiry are visible before action and match opinion/treaty state afterward.
- Many nearby nations do not overwhelm the player through staggered demand spam.
- An interrupted route has a causal explanation and at least one feasible restoration path or a clear reason none exists.
- Opinion and grudge messages match who initiated the battle and who suffered the loss; no duplicate event attribution.

### W11. Purposeful macro AI, sustainable economies, scouting, and tactical initiative

**Priority P1; size XL; dependencies W03/W06/W07/W10.** Evidence: H3, P2 §3, P3 §5, R71/111/121/124–125.

Primary source: `aiOperations.js`, `aiProduction.js`, `aiEconomy.js`, `src/utils/aiLogic.js`, `diplomacy.js`, `civilWar.js`, `sight.js`, `settlers.js`; `tacticalAI.js`, `economyAI.js`.

Implementation tasks:

1. Instrument operation states and reasons: defend, scout, muster, stage, march, intercept, besiege, assault, retreat, recover. Record target, path/reachability, supply needs, committed force, next transition, and turns without progress.
2. Reproduce the Kanesh colony pileup. Check adjacency versus region IDs, target selection, stack ownership, movement budgets, stage thresholds, fear estimates, path failures, and AI tier scheduling before choosing a fix.
3. Give each reachable war goal an operation with bounded staging time and reserved units. If blocked, retarget or release units; do not permanently gather 30 regiments in a size-2 colony.
4. Retain local defenders and respect supply capacity. Require a real reason to attack; success means purposeful progress, not every army moving every turn.
5. Base war exhaustion/peace proposals on actual costs, duration, blockades, sieges, casualties and stalled goals. “Worn out” should describe a measured burden, not a war that did nothing and cost nothing.
6. Add peacetime scouting through existing light units or a deliberately costed scout role. Explore safe reachable routes, return/resupply, make contact, and obey fog. Do not give AI omniscient targets merely to make it active.
7. Give players equivalent low-cost exploration options and reasonable early logistics, so supply does not shut off the entire discovery/diplomacy loop.
8. Add settlement quality, supply/reach, homeland development, administrative cost, and credible colony defense to site scoring. Keep P3's successful AI expansion while avoiding endless settlers or unviable remote claims.
9. Repair bankruptcy-driven collapse with budget-aware recruitment/upkeep, emergency responses, and recovery windows. Distinguish legitimate civil wars from repeated bankruptcy/rebellion loops; avoid suppressing them solely to quiet the log.
10. Respect performance tiers while ensuring a nation at war with the player can execute its operation every required tick/turn. Use cached indexes, bounded path searches, and staggered strategic reconsideration.
11. Tactical AI should defend intelligently, detect exposed siege camps/workers, choose sallies when favorable, react to artillery, reposition after tower loss, and avoid wasteful reinforcement trickles. Keep this separate from enlarging AI resource bonuses.
12. Explain difficulty's actual bonuses and aggression. Test behavior at Prince and King before extending across all difficulties.

Acceptance:

- In reachable, adequately supplied war fixtures, an AI leaves staging and makes measurable progress within a bounded interval; unreachable goals produce a logged reason and retarget/recovery path.
- Kanesh-style mass stacking no longer stalls indefinitely. Defense is not abandoned to chase an unreachable target.
- Contacts grow through visible exploration/trade/expansion; proposed pacing is several meaningful contacts by T100 on connected Standard starts, adjusted for geography rather than forced globally.
- Paired simulations improve productive war actions and contact while maintaining viable economies, diversity of powers, and performance budgets.
- No AI path uses information inaccessible under its sight/intelligence rules.

### W12. Capture decisions, occupation, loyalty, and liberation

**Priority P1; size XL; dependencies W02/W04/W06/W10; decision D6.** Evidence: H4/H4b, P2 conquest loops, R86–87/158/161/163/165.

Primary source: `conquest.js`, `regionTransfer.js`, `loyalty.js`, `razing.js`, `indepPolicy.js`, `vassals.js`, `sieges.js`, `battleOutcome.js`, `resolveTurn.js`, turn blockers and new capture UI/model.

Implementation tasks:

1. Introduce a durable capture operation keyed to the originating battle/surrender. Decide whether ownership becomes provisional or transfers immediately with a pending disposition; choose one model and make it atomic across all callers.
2. Route invasion, defense capture, siege surrender, landing, AI capture, and applicable civil-war/liberation paths through shared disposition logic. Peace cessions remain distinct where treaty terms already determine the outcome.
3. Offer Conquer, Raze, Make tributary, Free with projected loyalty, income/treasury, aggressive expansion, grudge, population/building loss, diplomacy, and capital consequences. Show unavailable reasons.
4. Define exact semantics: Free restores a valid former owner or creates an independent; Tributary applies to a polity, not a city secretly left under incompatible ownership; last-city elimination/revival and major capitals need dedicated cases.
5. Connect Raze to the existing gradual razing system. Specify cancellation, liberated population handling within existing game abstractions, army location after city deletion, trade routes, tile ownership, wonders, capitals, and save behavior. Do not add new captive mechanics.
6. Add a Hold the city summary with forecast and actionable levers: real garrison, governor, local control, unrest reduction, cultural pressure, supply, and expected stabilization time.
7. Tune a temporary occupation grace period/floor with a bounded decay and explicit expiry. It should create an opportunity to act, not permanent invulnerability. Coordinate loyalty flips, unrest uprisings, and former-owner restoration so one city does not revolt through three systems independently.
8. Evaluate garrison from physical location and strength; a tiny unit or an army based elsewhere cannot buy full occupation stability. Show the effect before spending on Quell unrest or Gain control.
9. Provide a visible map warning and queued notice before preventable loss. Track cooldowns for repeated surrender/rebellion and make former-owner pressure understandable.
10. Prevent loot, capture XP, grace periods, and diplomatic rewards from being farmed by repeated conquer/free/reconquer or surrender/rebel cycles. Cooldowns and rewards attach to stable operation/city history, not just current owner.
11. Define AI disposition preferences by goal, viability and relationships using the same cost rules. Never block a headless world forever on an AI choice.

Acceptance:

- Siwa/Kerma surrender and commanded/Auto conquest expose the appropriate disposition exactly once, including after reload.
- Each choice produces correct owner, capital, war score, buildings, units, obligations, and logs; canceled/inapplicable choices cannot leak treasury rewards.
- A reasonably managed occupation can be retained; abandonment can still fail. The player sees the pressure and has enough time for an available response.
- Hagmatana-style repetition cannot yield infinite gold or reset unrest immunity forever.
- Razing never leaves orphan units, ownership tiles, route endpoints, or pending decisions.

### W13. Map interaction, settling, fog, labels, and resource visibility

**Priority P1/P2; size L; dependencies W03/W04/W08/W11 selectors.** Evidence: M5/M6, L8/L10, P2 §4, R4/7/25/31/37–47/56/68–70/74–75/126/131–132.

Primary source: `mapCamera.js`, `mapView.js`, `GLMapView.jsx`, scene/territory/sprite models, `TileSheet.jsx`, `settlers.js`, `sight.js`, `fog.js`, globe political/lens rendering, `citySpacing.js`.

Implementation tasks:

1. Use explicit map interaction modes with a single active tool/lens. Switching to settlement closes incompatible tool mode and records/restores the previous passive lens deliberately.
2. Settlement mode persists through invalid sites and sheet closure until confirm/cancel. Center on the selected settler and fit nearby known candidate sites into the visible map area.
3. Add Next good site with ranked, reachable, known options and explanations: yields, food surplus, resource extraction needs, travel/supply, spacing, outpost stage, and threats. Do not reveal sites under unexplored fog through the recommendation algorithm.
4. Warn on zero-food/production sites and severe growth blockers without forbidding deliberate challenge settlements. Explain when no good reachable land remains and reduce advisor/AI recommendations for additional settlers.
5. Add Hold and Disband for settlers, with safe confirmation/refund rules. Held settlers do not indefinitely occupy the primary helper. Give a route line and progress for Go and found city.
6. Explain distance/spacing exceptions from the shared `citySpacing` rule, including water crossings and grid scale; do not hard-code a 306-km UI claim that disagrees with valid edge cases.
7. Opening a city from a list explicitly centers it. Ordinary panel resizing/closing preserves camera center and does not replay an old fly-to intent. Clear or sequence camera intents so the same request cannot retrigger on layout changes.
8. Make city/army/tile picking reliable at every zoom. Strategic icons remain actionable in march mode; overlapping army and city targets offer a compact chooser. Tapping owned terrain must allow tile inspection rather than always opening the city.
9. Cluster/declutter low-priority labels at world zoom; distinguish majors, independents, raid parties, and outposts. Respect HUD occlusion and improve wheel zoom steps.
10. Verify globe fog: unseen territory ownership, army positions, and resource intel must use the same visibility policy as the flat map. Hiding a color layer alone is insufficient if labels or picking still reveal hidden owners.
11. Fix disconnected/closed-ring border artifacts at fog seams and map wrapping. Test close view, strategic view, globe, and legacy map settings without globally exposing borders.
12. Add consistent visible icons for wheat, cotton, papyrus and other resources, with sensible scale and colorblind differentiation. Hide/relabel undiscovered future strategic resources such as Oil according to D10's history policy.
13. Assess the reported 37% resource density with regional distribution and strategic scarcity metrics. Adjust generation only if density harms choices; update scenario/start viability and extraction balance together.
14. Test settlement eligibility contrast specifically at strategic zoom (R69), with non-color cues for legal/illegal sites. Keeping the lens active is not sufficient if its colors become unreadable. Reserve space for the march instruction banner so the current route remains visible.

Acceptance:

- Supply lens → Settlers wait → invalid tile → another tile → successful founding works without mode loss or hidden action buttons.
- Recommendations never expose unknown geography/resources and never select an unreachable site as immediately available.
- A city/army can be selected at all supported zooms, and UI controls do not mask essential labels or taps.
- Globe and flat map reveal equivalent strategic information for the same sight state.
- Founding preview, actual name/stage, spacing, yields, and route time are consistent.

### W14. Contextual events, useful news, art, onboarding, and polish

**Priority P2/P3; size L; dependencies W04/W06/W08/W09/W13.** Evidence: M15, L1–L11, P2 §2/3/8/9, P3 §8, R1–19/35/84/89/92/109/114–118/134–143.

Primary source: event data/chains and event selection/effects, `peopleNames.js`, `battleNames.js`, `turnReportModel.js`, `LogConsole.jsx`, start/settings components, art manifests/renderers and existing animation pipeline.

Implementation tasks:

1. Add declarative event prerequisites for era/date, geography/climate, coast/river, actual buildings, population, recent outcomes, and scenario context. Choose a context-specific text variant or reject the event when a granary does not exist.
2. Add per-event, event-family, city, and empire cooldowns with bounded repetition and starvation-safe fallback. Scale cadence across speeds. A river/famine/refugee family should not dominate because only its exact title is cooled down.
3. Make Bronze Age Collapse an appropriate historical/systemic event rather than an arbitrary heavy penalty at T30. Preserve meaningful bad events while giving response options and early-game recovery.
4. Curate turn reports: urgent local actions first, known-world changes second, optional global history behind filters. Preserve complete debug/history data without showing unmet foreign civil wars as the player's main task list.
5. Collapse recurring upkeep/plunder/rebellion notices into trends and summaries. Show event order for a sack followed by growth so “size 1” then “size 2” is understandable rather than contradictory.
6. Fix grammar/pluralization centrally and remove doubled battle names such as “sacks Sack of Kish.” Use neutral encounter wording when contact direction is ambiguous. Keep major/independent identity clear.
7. Improve start search: either add modern capital aliases such as Cairo or narrow the placeholder to supported names. Add a scroll affordance for cut-off region chips. Preserve working random pick, direct step navigation, difficulty change, and Enter progression without accidental double-start.
8. Improve settings organization, disabled-control explanations, save status, duplicate Map headings, and log export. Keep performance overlay correctly labeled battle-only unless a real map overlay is added.
9. Add contextual, dismissible guidance for focus, outposts, supply, power points, siege weapons, the full starting roster and genuine later reinforcements, temporary auxiliaries, and conquest retention. Prefer information at the relevant action rather than a giant tutorial modal.
10. Improve tree silhouettes/material variation and reduce noisy repetition within mobile draw/triangle budgets. Verify scale, biome and cultural town styles, including Bronze Mesopotamia and Nubian settings.
11. Connect/validate the existing animation bake before commissioning more animations. Prioritize readable march, attack, death/rout, work/build, and hit reactions, then optional variations. Keep game timing independent of render animation.
12. Improve settler/resource visuals and squad selection targets without changing combat hitboxes. Preserve the good construction scaffold, rising walls, marching formations, realistic Earth, and rivers.
13. Profile the 5–20-second battle load with cold/warm cache, asset loading, setup generation and worker startup separately. Add progress and failure/retry feedback; avoid an unmeasured asset-preload increase that hurts startup or memory.
14. Check R134's green Nubian farmland against the actual river/tile context and biome mapping. A regional label alone is insufficient to call the terrain wrong; record the outcome as verified intentional geography or a corrected asset/context mismatch.

Acceptance:

- Events cannot reference nonexistent granaries, inland sea raids, or implausible climate without an intentional justified variant.
- Repeated news is summarized; actionable local crises remain visible. Succession and capture appear reliably in history.
- First-open icons work with a cold cache; camp names/era variants are explained; field lighting is readable at phone size.
- Art/animation changes pass real-device visibility and performance comparisons. No assumption that desktop 90–118 fps predicts phone performance.

### W15. Untested surfaces, accessibility, save/replay compatibility, and release validation

**Priority P1 for affected persistence/fog paths; P2 for broader coverage; size L; dependencies appropriate completed packages.** Evidence: P3 §2 untested list, R1/3–12/93; additional gaps identified in this plan.

Implementation tasks:

1. Test export/import round trips, malformed/older files, schema migration, missing content, duplicate IDs, and recovery from interrupted saves. Recommend explicit local save slots/checkpoints as a later quality-of-life feature; do not imply that adding slots fixes corruption.
2. Test cloud sign-in and synchronization using authorized test accounts: offline edits, conflicting versions, duplicate battle/capture receipts, multiple devices, logout, and stale clients. No account creation or real-user data is needed merely to write this plan.
3. Test naval battles, landing/intercept queues, vassals/tributaries, island supply, ports and razing interactions, especially after shared outcome and diplomacy changes.
4. Test real touch in iOS Safari and Android/Capacitor landscape, browser bars, safe areas, pinch/drag/tap/long-press, pointer cancellation, suspend/resume, app backgrounding, portrait rotate screen, and keyboard focus when signing in.
5. Test sound toggles, simultaneous battle sounds, pause/background behavior, and accessibility with sound disabled. Screen-reader navigation, contrast, reduced motion and non-color ownership cues remain part of acceptance.
6. Include deep globe use and legacy map options in fog/picking checks. Disabled fog/cache controls need honest reasons; Copy log should retain useful diagnostics with clearly identified sections.
7. Validate long battles and 300/1,000-turn campaigns for memory growth, worker crashes, unbounded notifications, logs, replay size, stale caches, and nonfinite values.
8. Make cache invalidation explicit for yield, path, price, opinion and trade-route selectors. Persistent investment, territory transfer, treaty changes and map-mode switches must invalidate the right inputs.
9. Test a balanced scenario matrix: Akkad/Kemet plus coastal, island, cold-climate, low-yield, and sparse-contact starts; Standard plus small/large worlds; Normal/Marathon; Prince/King; both attacker/defender roles.
10. Save before high-risk actions in test scenarios, and verify restart after every lifecycle boundary: payment, government change, battle verification, conquest choice, razing tick, research gate, and queue purchase.

Acceptance:

- The original untested list is replaced by a tested matrix with outcomes and remaining explicit gaps.
- Invariants and deterministic replay hold after migrations. Incompatible checkpoints fail safely with a clear policy rather than being silently interpreted by new rules.
- Persistence, fog and tactical command fixes are covered in the browser and any server/edge engine consumers.
- Required repository checks pass for each implementation increment; no test claim is made in this planning document.

### W16. Retention, scenarios, and optional monetization roadmap

**Priority P3/later; size M for design, implementation sized separately; dependencies stable W01–W15 core.** Evidence: P2 §12 and P3 §8. These are product options, not required purchases to fix gameplay.

1. Add shareable seed/scenario descriptors that include rules/build version, world generation options, difficulty, and mod/content availability. A seed alone does not reproduce a changed generator.
2. Trial curated community challenges with deterministic settings and verifiable submissions. Leaderboards require replay/version validation and clear assisted/modded categories; no live-service build is assumed in this remediation phase.
3. Design historical scenario packs with objectives, starting armies, scripted events and an ending. Candidate themes from the audit: Bronze Age Collapse and Rise of Rome. Measure whether they solve the missing-goal problem.
4. Compare commercial models explicitly: free base plus age/region expansions; one-time full mobile purchase; optional supporter/early-access tier. Choose a coherent model before entitlements or storefront work.
5. Consider premium people/content packs only with fair power budgets, complete cultural art and clear save compatibility. A “cosmetic and content” pack cannot covertly deliver a stronger army.
6. Cosmetic candidates: banners, shields, unit/town styles, and map themes. Preserve battlefield identification, accessibility, and historical/settings options.
7. If curated paid seasons are pursued, first establish a sustainable free challenge cadence and offline access policy. Avoid using remediation work as a reason to introduce subscriptions prematurely.
8. Do not sell gold, timers, speed-ups or battle advantage. Keep multiplayer/deterministic verification and existing saves compatible with optional content ownership.
9. Define expansion save behavior, unavailable-content fallbacks, purchase restoration, account/offline support, asset budgets, and content QA before implementation.

Acceptance:

- A product brief states the selected model, value delivered, fairness policy, platform needs, and entitlements/save behavior.
- Core fixes are not gated behind monetization. No payment/storefront implementation is bundled into battle or economy remediation.

## 6. Additional loopholes and design safeguards

These are independent recommendations beyond simply repeating the audits. Several are source-supported risks, but they still need dedicated reproduction.

| Risk | Failure or exploit | Planned safeguard / validation |
|---|---|---|
| A01: accepted commands differ from verified commands | Build/training/deploy actions disappear during replay; legitimate wins become losses. | W01 shared command schema, complete payloads, hash comparison, exhaustive protocol coverage. |
| A02: canonical-looking unverified results | The client displays a win before replay; an error, reload, or duplicate submission changes/loses it. | W02 verified committed receipt and atomic checkpoint lifecycle. |
| A03: missing participant means full health | Sanitizer fallback restores original strength when a result omits a deployed unit. | W02 explicit participant/disposition ledger; untouched reserves are explicit, not inferred from missing data. |
| A04: stale base masquerades as current location | Remote supplied units get home reinforcement or appear in distant city stacks. | W03 physical tile selectors and reinforcement/action eligibility migration. |
| A05: price preview and reducer disagree | Discounts/reach differ; rapid clicks purchase a different item or exceed available resources. | W07/W08 shared immutable quote inputs, stable rows and engine revalidation. |
| A06: production investment punishes itself | Dynamic cost rises when a city improves; players switch focus to obtain cheaper quotes. | W07 era reference costs, not per-city instantaneous-output pricing. |
| A07: rush/refund/overflow arbitrage | Switch queues, hurry cheap items, cancel, or overflow into expensive ones for free production. | W07/W08 per-item progress/payment ledger, bounded overflow, no refund above unconsumed payment. |
| A08: fast settler/cheap rush snowball | Early pacing fixes cause AI/player exponential settlement and instant border saturation. | W07/W11 multi-speed expansion and viable-land measurements; tune settler costs/upkeep before adding a capacity rule. |
| A09: tribute race | Payment and war declaration both succeed in the same turn; already spawned raiders ignore peace. | W10 transactional protection plus execution-time truce checks on every hostile path. |
| A10: alliance bypass of protection | Protected nation enters war through a pact or shared army and attacks anyway. | W10 explicit truce scope and precedence; test indirect declarations and allied participation. |
| A11: per-nation cooldown still spams | Twenty independent cooldowns yield a demand every turn. | W10 global incoming-pressure budget plus per-pair limits. |
| A12: surrender/rebellion farming | Repeated captures pay treasury/XP, refresh immunity, or farm diplomatic favor. | W12 persistent city operation history, reward limits and non-resetting grace/cooldown rules. |
| A13: invincible cheap buildings | A remote house or unfinished foundation prevents defeat indefinitely. | W06 eligible-building definition, valid build territory, explicit stalemate handling, simultaneous-destruction tests. |
| A14: incompatible housing protection | “Destroy every building” is impossible while protected civilian houses cannot be destroyed. | Resolve D2 against the city manifest/damage rule before objective implementation; removing text is not changing mechanics. |
| A15: purchase permanent troops with temporary battle economy | Persistent trained troops allow farming weak battles for free armies. | W06 keep auxiliaries temporary initially; any conversion later consumes campaign manpower/resources and obeys caps. |
| A16: hidden-information leaks | Globe, site recommendations, placement tint, minimap, or map trade expose unseen armies/resources. | W05/W10/W13 information-policy tests for display, picking, queries and exported intel. |
| A17: “helpful” auto-engagement defeats user intent | Squads chase after Hold/pullback; cavalry breaks formation; workers abandon construction. | W05 explicit stance, leash, target priority, group pace, and worker-order separation. |
| A18: durable queue loses mandatory choices | One-sheet redesign hides a defense/capture/peace choice or stalls simulation forever. | W04 engine-backed decision IDs, invalidation reasons, blocking order and headless answer policies. |
| A19: safe-looking migrations change strategy | Existing currency removed by caps; investment invented from derived yields; old replay interpreted under new rules. | W07/W15 conservative migrations, preserved banks, explicit replay version compatibility. |
| A20: performance regressions from helpful overlays | Legal-area scans, full AI path searches, or replay verification stall phones. | W01/W05/W11 cached/incremental computations, bounded search, production-build profiling and worker budgets. |
| A21: rewarding empty blocked routes | A permanent obstruction generates plunder every turn even when no value travels. | W10 conservation of trade income/plunder, suspension state and no double reward. |
| A22: disagreement across engines | Browser, worker, fallback and edge bundle run different protocol/rules. | W01/W15 version checks and shared fixtures across runtime consumers. |

## 7. Sequencing, dependencies, and reviewable implementation slices

This order prevents balance tuning against broken results and prevents UI redesign from hiding engine defects. Independent presentation work can proceed concurrently during future implementation, but this plan does not assume delegated agents or a particular staffing level.

| Stage | Scope and proposed slices | Exit gate |
|---|---|---|
| S0: establish evidence | W00 fixtures; exact baseline; D1–D6 battle/capture decision record; source-backed defect tickets. | Reproductions distinguish source-confirmed defects from hypotheses; original corrections retained. |
| S1: trust commanded battles | W01 command schema/payload parity; setup/hash identity; then W02 verified receipt, participants and persistence. | Live/replay/campaign agreement, refresh/retry safety, no casualty resurrection. |
| S2: trustworthy macro actions | W03 physical-location and supply trace; W08 quote/coast/ETA fixes; W07 persistent development slice. | Actions charge, move, reinforce and persist exactly as displayed. |
| S3: readable interaction | W04 coordinator/decision queue; stable controls; W05 HUD/navigation/placement; W13 camera/lens fixes. | 844×340 real-touch critical flows pass without lost decisions or moving targets. |
| S4: battle gameplay rules | W06 objectives/withdrawal; W05 combat order behavior and full starting roster; siege/auxiliary balance. | D1/D2 and U10 implemented coherently, tactical/Auto parity and no stalemate exploit. |
| S5: city/economy/research | Remaining W07/W08/W09; production, rush, currency utility, queues, effects, government previews. | Paired pacing/economy metrics improve without runaway expansion or refund exploits. |
| S6: credible world | W10 tribute/trade/grudges; W11 operation/scouting/economy AI. | Reachable wars act, paid protection holds, trade is actionable, contacts grow. |
| S7: conquest retention | W12 common capture flow, disposition, loyalty and razing integrity. | Every capture path produces exactly one valid choice; managed occupations can survive. |
| S8: finish and broaden | Remaining W13/W14; W15 scenario/device/save/naval/cloud matrix. | Full regression and release gates pass; every audit row has evidence or an explicit deferred decision. |
| S9: optional product growth | W16 scenario/retention/product design; separately scoped implementation. | Stable core, selected business model, tested value and compatibility rules. |

Critical dependencies:

- `W00 → W01 → W02` is the first critical path.
- `W03 → W07/W10/W11/W12` ensures geography and supply are reliable before balance/AI decisions use them.
- `W04 → W05/W09/W12/W13` provides a shared interaction and pending-decision model.
- `W01/W02 + D1–D5 → W06`; protocol work precedes new RTS commands/objectives.
- `W07 + W10 → W11` supplies credible budgets and treaty constraints to AI.
- `W02/W04/W06/W10 + D6 → W12` avoids a capture card wrapping inconsistent capture mechanics.
- W15 runs continuously for changed shared systems and again at release; it is not a last-day testing phase.

Suggested first reviewable changes, each independently verified:

1. Add economy/deploy replay regression fixtures and demonstrate the current mismatch.
2. Introduce the complete order codec and verification mismatch handling.
3. Pin setup/end metadata and unify the committed result screen/report.
4. Correct physical location consumers and purchase quote inputs.
5. Persist purchased city investment through turn resolution.
6. Introduce the interaction coordinator with the exact simultaneous-arrival regression.
7. Implement the selected battle objective/withdrawal design before large balance changes.

Avoid a single mega-change that rewrites AI, pricing, objectives, and mobile layout simultaneously. Each mechanic change should include its intended effect, failure cases, migration story, before/after evidence, and the next relevant acceptance gate.

## 8. Validation strategy and measurable completion

### 8.1 Unit and integration coverage

Use existing adjacent Vitest suites and fixed-seed integration tests. Add tests for contracts and meaningful edge cases, not snapshots that merely duplicate implementation.

- **Replay protocol:** every command type and payload; invalid commands; same-tick order; economy target IDs; historical reserve joins under old rules; full starting roster in new battles; deployment; log truncation; incompatible versions.
- **Outcome ledger:** field/city/raid/sack/naval/landing; player attacker/defender; militia; allied reinforcements; dead/fled/starting-roster/auxiliary distinctions; historical reserve distinction under old rules; draw/withdrawal/time limit; duplicate operation submission.
- **Campaign actions:** no distance-free attack; supply/attrition/reinforcement transitions; current location; held/idle status; quote equality and prerequisites; persistent investment; reordered progress and purchase/refund conservation.
- **Diplomacy/capture:** payment-versus-war phase ordering; truce execution checks; conquest/surrender/raze/free/tributary; capital loss; last-city elimination; liberation; rewards exactly once.
- **UI behavior:** pending-decision lifecycle, pointer reuse, stable queue rows, camera intent consumption, lens transitions, visible research wait, same government preview and action state.
- **Save/cache:** migrations/defaults, action replay after load, cache invalidation after research/ownership/treaty/investment changes, checkpoint hash and schema compatibility.

### 8.2 Balance experiments

Start with at least 8 paired seeds for campaign balance and 32 for relevant battle economy matchups. Use the same scenario and active-player policy for baseline and candidate. Extend a sample when important confidence intervals remain broad; do not claim a single seed proves a general improvement.

Checkpoint campaign metrics at T25, T50, T100, T172/T200 and T300; use a longer 1,000-turn safety run for boundedness. Compare normalized campaign duration/calendar progress across speeds as well as raw turn counts.

| Area | Measure | Acceptance intent |
|---|---|---|
| Trust | Live/replay hash and result mismatch; duplicate payouts; unexplained participant changes | Zero in the supported fixture/runtime matrix. |
| Opening pace | First useful build/settler; median viable-city production; turns with no meaningful optional action | Improve long empty stretches without eliminating the value of terrain and investment. |
| Economy | Gold/power generation, available choices, spend ratio, reserve buffer, bankruptcy | Several worthwhile spending paths and sustainable AI budgets; neither forced poverty nor unbounded accumulation. |
| AI war | Reachable operations advancing, staging duration, failed-path recovery, actual battles/sieges | No indefinite unexplained colony pileups; defensive/resting units can remain still. |
| Exploration | Contacts by geographic start, explored area, scout survival/resupply | Meaningful contact in connected starts without omniscience or island penalties disguised as AI failure. |
| Tribute | Demands per pair and globally, payment protection breaches, actual threat reach | Zero unannounced protection breaches; pressure remains strategic and geographically credible. |
| Conquest | Retention at 10/25/50 turns by investment strategy; repeated capture payouts | Occupation actions materially improve retention; no repeated loot/grace farming. |
| Trade | Profitable uptime, blocked duration, restoration actions, repeated notices | Long closures have a visible cause and response; no infinite plunder from empty routes. |
| World health | Rebellion causes, nations alive, effective nations, city/wealth/land concentration | Avoid both constant collapse and one unchallenged runaway empire. |
| RTS | Casualty exchange, elapsed time, placement success, command rejection visibility, auxiliary value | Improved control and fair outcomes with honest Auto parity. |
| Mobile | Ordinary HUD coverage, accidental actions, required closes, visible primary actions | Stable controls, one active interaction, usable field and readable decisions at 340px height. |

Do not optimize “unit movement percentage” or “low bank balance” in isolation. A garrison that should hold is correct; a player saving for an expensive project is making a valid decision.

### 8.3 Existing commands to use during implementation

The repository guidance provides these tools; commands below are future verification instructions, not checks run during this planning task.

```bash
npm run lint
npx vitest run
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test

# Relevant tactical suites before broad integration checks:
npx vitest run src/battle

# Paired campaign comparisons; choose a stable surviving player/scenario and record the policy.
PLAYER=au .claude/skills/balance-sim/compare.sh <base-ref> 300 11-18

# Campaign tactical/Auto parity, with economy enabled:
N=32 TYPES=field,assault,town AGES=bronze:bronze,classical:kingdoms TERRAIN=mixed \
  npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/battle-lab/parityEco

# Tactical scale and economy performance:
node scripts/battle-bench.mjs --eco

# Rebuild any authoritative edge-engine consumer after shared rule/protocol changes:
npm run build:edge
```

Adapt the legacy balance harness to the audited peoples scenarios when necessary; a France/Australia legacy-world run alone does not validate Akkad/Kemet. Use the battle-lab squad traces for actual ignored-order claims, screenshots for rendering, and real touch for mobile input. Measure timing interleaved against baseline on the same machine. Repository reference budgets include dedicated 80ms macro-turn checks and tactical p95 ≤10ms tick checks; do not reinterpret desktop FPS as proof of phone budget compliance.

### 8.4 Release gate

An implementation release is ready only when:

1. C1/C2 and source-confirmed replay/quote/development defects are resolved with deterministic regressions.
2. Mandatory battle/capture/event/peace decisions survive overlay changes, refresh and save/resume.
3. The critical phone flows pass at 844×340 with actual touch semantics; there is real-device iOS/Android evidence for affected inputs and visible-height behavior.
4. Prices, ETAs, research gates, government effects, physical army locations, wall terminology and final outcomes agree across UI and engine.
5. Balancing changes have paired results and documented regressions/tradeoffs, with zero invariant/nonfinite violations.
6. Migration, replay versioning and browser/edge compatibility are documented and tested.
7. Lint, required tests and production build pass; unrelated existing failures are explicitly distinguished, not quietly ignored.
8. Every I001–I224 inventory item has a status: implemented with evidence, intentionally retained with explanation, deferred with a named decision, or still unverified. Evaluate P01–P08 product entries and T01–T09 test gaps separately. No audit item disappears because it was inconvenient; a passing umbrella heading or work package cannot conceal an unresolved subitem.

## 9. Traceability: original 42-label subset

This table preserves the main audit's original labels for navigation. It is not the full issue inventory. Several labels bundle multiple separately testable behaviors, and both the earlier report and raw log contain additional unlabeled findings. Use the [224-item inventory](playtest-audits-item-inventory.md) for implementation tracking and completion counts.

| Audit ID | Issue | Package(s) / disposition |
|---|---|---|
| C1 | Victory becomes campaign defeat | W00–W02; W06 distinguishes historical outcome parity from revised objectives. |
| C2 | Ghost units and result/map disagreement | W01–W03; participant ledger and supply trace, not arbitrary unit deletion. |
| H1 | All currencies pile up | W07/W08/W09/W10; meaningful costs and choices. |
| H2 | Bank-scaled tribute spam and payment without peace | W10/W11. |
| H3 | Idle major armies and inactive wars | W03/W11. |
| H4 | Conquests rapidly break away | W12/W10; occupation tuning and feedback. |
| H4b | Missing post-capture choices | W12/W04. |
| H5 | Squeezed/stacked phone cards | W04/W15. |
| H6 | Battle placement guessing | W05; legal overlay plus actual valid-space generation. |
| H7 | Silent battle orders/camera moves/idle squads | W05/W01; distinguish input, sim and replay. |
| H8 | Retreat forfeits battle/survivors | W06/W02. |
| H9 | Very slow early production | W07/W08. |
| M1 | Date-gated research says 1 turn | W09. |
| M2 | Government switch hides authority/law consequences | W09. |
| M3 | Trade route perpetually plundered | W10/W14. |
| M4 | Wrong army place/base labels | W03. |
| M5 | Lenses block one another | W13/W09. |
| M6 | Settle mode loss, bad sites, idle settlers | W13/W03/W04. |
| M7 | Duplicate build rows, reflow, no reorder, lost progress | W08. |
| M8 | Inland ships and enabled coast-required harbor | W08/W15. |
| M9 | No building effect descriptions | W08/W09. |
| M10 | Inverted grudge attribution | W10. |
| M11 | Auto probability hidden until after battle | W06. |
| M12 | Siege waiting guarantees free surrender | W06/W11/W12. |
| M13 | Hidden second wave | W05/W02. |
| M14 | Contradictory wall labels | W06. |
| M15 | Repetitive/context-free events | W14. |
| M16 | Weak battle-trained squads | W06; role/size/cost calibration and temporary-unit explanation. |
| M17 | Move now ETA differs from arrival | W03. |
| M18 | Buy-land quote differs from charge | W08; source-confirmed missing research inputs. |
| L1 | Era banner obstructs bar for many turns | W04/W14. |
| L2 | First-open blank icons | W05/W14. |
| L3 | Inconsistent camp name | W05/W14. |
| L4 | Anachronistic unit/resource names | W09/W13/W14. |
| L5 | Opinion Why? lacks reasons | W10. |
| L6 | Short reigns and absent succession logs | W09/W14. |
| L7 | Upkeep log spam and tiny visible log | W04/W14. |
| L8 | Independents indistinguishable on map | W13/W14. |
| L9 | Incorrect first-contact narrative | W10/W14. |
| L10 | City list camera and strategic march picking | W13. |
| L11 | Native New Game confirm | W04/W15. |
| L12 | Remove 50% rule text | W05; underlying mechanic unchanged unless D2 is separately resolved. |

## 10. Traceability: additional Playtest 2 and audit-section material

This ledger captures items that are broader than, or absent from, the named findings above.

| Source / topic | Planned handling |
|---|---|
| P2 §2: Balanced focus, hills and first settler at turn 89 | W07/W08; test allocation/food constraints and visible alternatives. |
| P2 §2: Marathon 4×, long normal campaign, settler escalation | W07 multi-speed timing table and opening-cost experiments. |
| P2 §2: no actions between events, supply ends exploration | W03/W07/W11/W14; scouts, viable purchases and contextual goals. |
| P2 §2: Invest in growth appears ineffective | W07 threshold/people/housing preview and post-turn tests. |
| P2 §2: development undone | W07 persistent investment; source confirms recomputation issue. |
| P2 §2/3: delayed independent raids then overwhelming waves | W10 credible reach, cadence and queued-raid protection rules. |
| P2 §3: weak early expansion versus P3 strong expansion | W11 compare speed/scenario; do not apply a blanket settlement buff. |
| P2 §3: bankruptcy, civil-war/rebellion spam | W07/W11 root-cause budgets; W14 relevance and aggregation. |
| P2 §3: Lapita emergence described as expansion | W10/W14 accurate arrival/settlement language. |
| P2 §4: camera Gulf jump on resize/close | W13 consume focus intent once, preserve center. |
| P2 §4: movement waits, thick arrows, tile jumps | W03 honest Move now/ETA plus smooth render-only interpolation/routes. |
| P2 §4: false borders-attack prompt and teleport | W03 unify city-card, march and engine attack checks. |
| P2 §4: fog ring artifact | W13 fog/territory/wrap regression. |
| P2 §4: own tile opens city; army banner loses to city | W13 target chooser and explicit tile inspection. |
| P2 §4: tiny wagon, no settler route | W03/W13/W14 civilian presentation and routes/art. |
| P2 §4: tent/outpost unexplained | W08/W13/W14 stage preview and appropriate early model. |
| P2 §4: missing wheat/cotton/papyrus icons; 37% density | W13 distribution assessment and consistent art/visibility. |
| P2 §5: city card under real panel, two closes | W04 single active city flow. |
| P2 §5: inert quick-build; small-only queue arrow | W08 shared eligibility and explicit accessible action. |
| P2 §5: read-only defense | W08 useful action links or honest informational role. |
| P2 §5: rail says 2800t vs queue 94t | W08 shared ETA. |
| P2 §6: duplicate Authority, duplicate advisors | W04/W09 labels and identity. |
| P2 §6: Nothing researched / wrong era | W09 shared research status and calendar/tech-era distinction. |
| P2 §6: unexplained hidden ADM/DIP/MIL | W07/W09 visible currency access, effects and choices. |
| P2 §6: no map trading | W10 scoped map/intel exchange. |
| P2 §7: Command promised for empty defender setup | W06 honest guards and shared battle inputs. |
| P2 §7: hopeless defense, off-camera death | W05 navigation/alerts; W06 odds and player choice with viable base rule. |
| P2 §7: cannot find enemy; Keep link; panning/follow | W05 objective navigation/minimap/desktop controls; preserve P3's working keep focus. |
| P2 §7: unused reserves/economy after retreat | W05/W06 survivor-preserving withdrawal and the U10 full starting roster; historical reserves only in legacy replay. |
| P2 §7/8: Mediterranean town in Bronze Mesopotamia | W14 culture/era town validation. |
| P2 §8: tree noise, small figures, unbuilt animation bake | W14 renderer/asset/readability work and performance gates. |
| P2 §9: unrelated news, simultaneous cards, moving CTA | W04/W14 queued interactions and relevant reports. |
| P2 §9: grammar/pluralization/battle-name errors | W14 central message formatting. |
| P2 §10: help clipped/right-click on touch; housing collapse | W05/W15 touch-specific help and HUD tests. |
| P2 §10: Cancel triggers Tower, Safari clipped sheets | W04/W05/W15 pointer lifecycle and visible-height sizing. |
| P2 §11 positive findings | Preserve checklist below; no rewrite should degrade them. |
| P2 session 2: auto siege, repeated surrender/rebellion | W03 explicit siege intent; W06/W12 meaningful siege and retention. |
| P2 session 2: 902 lost but 175 survive | W01/W02 participant and display parity. |
| P2 session 2: focus below fold, three build rows, queue hidden | W04/W08 focus/queue layout at 340px. |
| P2 session 2: disappearing settling lens, clipped CTA | W13/W04 durable mode and reachable footer. |
| P2 session 2: dark field, speed tap hits Pause | W05 fixed HUD and lighting. |
| P2 §12: all eight monetization/retention proposals | W16 compares each model and explicitly excludes selling power. |
| P3 §2: naval/landings/vassals/save/cloud/touch/sound/globe/portrait untested | W15 test matrix; no assumed passes. |
| P3 §3 scorecard | Use as qualitative baseline, not a precise numeric KPI; W00 metrics provide measurable comparisons. |
| P3 §5 AI expansion/war/exploration/independents/tactical behavior | W10/W11 preserve expansion and improve meaningful agency. |
| P3 §6: cost scaling, city soft cap, science banking, auxiliary demobilization | D5/D7–D10 and W06–W09; preserve useful constraints and test alternatives. |
| P3 §7: entire nine-point mobile redesign | W04/W05/W08/W13/W15, including Idle N and Hold. |
| P3 §8: empty late game and buried era goals | W07/W09/W11/W14/W16 measurable objectives and strategic choices. |
| P3 §9/10/11 priorities and roadmap | Covered in stages S0–S9, with verification and dependencies added before balance. |

Positive behavior to preserve explicitly:

- Settling green/red eligibility, useful site yields/resources/river/distance, and Go and found city progress/cancel.
- Clear tribute/diplomacy choices, opinion explanations where already good, loyalty/unrest breakdowns, and research banking/boosts.
- Working RTS gathering/training, construction bars/scaffolds/rising walls, formations, Rally Cry, Arrow Storm and Shaken/Rally behavior.
- Working numerical military counts where already consistent; do not globally multiply/divide by ten to fix one bad report.
- Working pre-battle portal sizing, P3 keep-centering, replay access, resource breakdown, queue removal, and sensible government/legacy navigation, while addressing their limitations.
- Stable 300-turn operation without crashes, fast turns, realistic Earth/rivers/towns, and existing deterministic replay/performance architecture.

## 11. Complete raw test-log ledger

The following ledger maps every actual row of `playtest-3-test-log.md` to work packages. Row 77 is absent in the source; row 113b is an additional correction; row 66 appears at the end of the file. The source therefore contains 165 actual data rows despite the main audit's older “164 rows” description. Preserve these identifiers instead of renumbering evidence.

PASS entries mean preserve and regression-test the behavior when the owning package changes it. NOTE/UX entries are observations or design input, not automatically proven defects. UNTESTED entries require W15 verification. The companion CSV retains each full original observation as well as its package assignment.

| Row | Area / action | Source signal | Work packages | Item IDs / disposition |
|---|---|---|---|---|
| R1 | Settings | NOTE | W14, W15 | I165 |
| R2 | Settings | UX | W14, W15 | I164 |
| R3 | Settings > Globe view | PASS | W13, W15 | T08 |
| R4 | Globe | FAIL | W13, W15 | I079; T08 |
| R5 | Globe/Map switch | PASS | W13, W15 | T08 |
| R6 | Map prompts | FAIL | W09 | I135 |
| R7 | Map at full zoom-out | UX | W13 | I080 |
| R8 | Settings > Performance overlay | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R9 | Settings > Copy turn log | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R10 | Settings > Cloud saves | NOTE, UNTESTED | W15 | T02 |
| R11 | Settings > Export/Import save | UNTESTED | W15 | T01 |
| R12 | Menu > New game | PASS, UX | W04, W15 | I166 |
| R13 | Start > Search | PASS, FAIL | W14, W15 | I167 |
| R14 | Start > Random | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R15 | Start > region chips | UX | W14, W15 | I168 |
| R16 | Start > step 4 button | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R17 | Start > Ready > Change (difficulty) | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R18 | Start > King | NOTE | W14, W15 | Preserve / neutral evidence (see CSV) |
| R19 | Start > Enter key | PASS | W14, W15 | Preserve / neutral evidence (see CSV) |
| R20 | Research choice | NOTE | W07, W09 | Preserve / neutral evidence (see CSV) |
| R21 | End Turn CTA | UX | W04 | I158 |
| R22 | City > Overview focus | NOTE | W07, W08 | I023 |
| R23 | City > Build | FAIL | W08 | I045 |
| R24 | Peoples panel | UX, NOTE | W04, W11 | I151, I156 |
| R25 | Map labels | UX | W13 | I082 |
| R26 | Army sheet | FAIL | W03 | I058 |
| R27 | March to attack | PASS | W03 | Preserve / neutral evidence (see CSV) |
| R28 | March arrival | PASS | W03, W06 | Preserve / neutral evidence (see CSV) |
| R29 | Pre-battle close (X) | PASS, NOTE | W03, W04, W06 | I130 |
| R30 | March banner | FAIL | W03 | I058, I224 |
| R31 | Map labels vs HUD | UX | W13 | I081 |
| R32 | "Army idle" chip | FAIL | W03, W04 | I061 |
| R33 | Unit data | FAIL | W03, W04 | I058 |
| R34 | City card (Men-nefer) | FAIL | W03, W04 | I059, I060 |
| R35 | Events | NOTE | W14 | I223 |
| R36 | Independents | NOTE | W10 | I100 |
| R37 | Settling lens | UX | W13 | I086 |
| R38 | Site sheet | UX | W04, W13 | I090 |
| R39 | Site sheet | UX | W08, W13 | I088 |
| R40 | Founding | PASS | W08, W13 | I056 |
| R41 | Empire > Advisors | NOTE | W07, W09 | I033 |
| R42 | Research > Fund Scholars | PASS | W07, W09 | I138 |
| R43 | Research > Boosts > "Map" (Build a road) | UX | W09, W13 | I085 |
| R44 | Settlers wait chip with Supply lens on | FAIL | W13 | I084 |
| R45 | Settling lens | UX | W13 | I088 |
| R46 | Site sheet | NOTE | W13 | I094, I096 |
| R47 | Go and found city | PASS | W13 | Preserve / neutral evidence (see CSV) |
| R48 | City card (Men-nefer) | UX | W03, W08 | I057 |
| R49 | City card | NOTE | W07, W08 | I026, I027 |
| R50 | City > Overview focus Production (size 1) | FAIL | W07, W08 | I023 |
| R51 | City > Build list | UX | W07, W08 | I039, I041 |
| R52 | Queue | PASS | W07, W08 | I019, I046, I047 |
| R53 | Queue add | UX | W07, W08 | I048 |
| R54 | All city tabs | NOTE | W07, W08 | I019, I020 |
| R55 | Buy land (Iron, label 120g) | PASS, FAIL | W07, W08 | I036, I037, I038 |
| R56 | Citizens tab | NOTE | W08, W13 | I091 |
| R57 | Defence (auto) | UX, NOTE | W02, W04, W06 | I006, I151 |
| R58 | Battle report > Full report > View replay | PASS, NOTE | W02, W15 | I016 |
| R59 | First contact card (D'mt) > Open diplomacy | PASS, NOTE | W10, W11 | I122 |
| R60 | Opinion "Why?" | UX | W07, W08, W10 | I112 |
| R61 | Diplomacy > Trade | PASS | W07, W08, W10 | Preserve / neutral evidence (see CSV) |
| R62 | More actions | NOTE | W07, W08, W10 | I116 |
| R63 | Assign diplomat | PASS, NOTE | W07, W08, W10 | I018 |
| R64 | Resources | NOTE | W07, W08, W10 | I038 |
| R65 | Libu (raiders) panel | FAIL | W07, W08, W10 | I108, I110, I111 |
| R67 | Turn report | NOTE | W10, W14 | I114 |
| R68 | Cities tab | NOTE | W08, W13 | I054 |
| R69 | Settle lens at normal zoom | UX | W13 | I087, I089 |
| R70 | Founding on an iron hill | PASS | W13 | Preserve / neutral evidence (see CSV) |
| R71 | AI expansion | NOTE | W10, W11, W14 | I118 |
| R72 | Helper paid Kanesh 219 gold tribute (T~88) | NOTE | W10 | I104, I109 |
| R73 | Event "Refugees at the Border" | PASS, UX | W04, W14 | I152, I159 |
| R74 | March from city card > tap a moving raid party | FAIL, UX | W03, W13 | I067 |
| R75 | March to attack Siwa | PASS, NOTE | W03, W13 | I068 |
| R76 | Research | NOTE | W09 | I135 |
| R78 | Research > Let my advisor pick | PASS | W09 | Preserve / neutral evidence (see CSV) |
| R79 | Arrival at Siwa | FAIL, UX | W04 | I152 |
| R80 | Kanesh second demand (246 gold, 16 turns after the first) | PASS, NOTE | W10 | I104 |
| R81 | Siege card | FAIL | W04 | I153 |
| R82 | Army sheet at Siwa | FAIL | W03, W06 | I009, I058 |
| R83 | "Army idle" chip on a besieging army | UX | W03, W04 | I061 |
| R84 | Event "A Harsh Winter" in Abdju (Upper Egypt) | NOTE | W14 | I222 |
| R85 | Gold chip in top bar | PASS, UX | W04, W07 | I162, I163 |
| R86 | Siege of Siwa | NOTE | W06, W12 | I125, I131 |
| R87 | Siwa capture feedback | UX | W04, W12 | I128 |
| R88 | Refusing Kanesh's tribute | NOTE | W04, W10 | I117 |
| R89 | Event "Refugees at the Border" | NOTE | W14 | I221 |
| R90 | Arrival at Cyrene | NOTE | W04, W06 | I154 |
| R91 | Siege of Cyrene card (full width) | PASS | W05, W06 | I008 |
| R92 | Command > Begin battle | PASS, UX | W05, W14, W15 | I204, I205, I214, I220 |
| R93 | Battle camera | PASS, NOTE | W05, W14, W15 | I197, I198, I200; T06 |
| R94 | Base > Train Laborer x2 | PASS, UX | W01, W05, W06 | I185 |
| R95 | Laborer > Build menu | FAIL | W01, W05 | I186 |
| R96 | Build Barracks | FAIL, UX | W01, W05 | I177, I178, I179 |
| R97 | Build panel "Stop" | FAIL, UX | W01, W05 | I182 |
| R98 | Laborer + tap a site (mouse) | UX | W01, W05 | I184 |
| R99 | Archery range > 5 Composite Archers | PASS, NOTE | W01, W06 | I211 |
| R100 | Attack order on the keep, all 8 squads | FAIL | W05 | I192 |
| R101 | Move order (right-click open ground near the wall) | FAIL | W05 | I190 |
| R102 | Towers vs archers | NOTE | W06 | I212 |
| R103 | Retreat button with survivors | FAIL | W01, W02, W06 | I003, I010, I012, I013 |
| R104 | Economy | NOTE | W07 | I017, I018 |
| R105 | Research | FAIL, UX | W09 | I133, I134 |
| R106 | Empire > Overview | UX | W04, W09 | I143 |
| R107 | Government > Become a Monarchy (300 ADM) | FAIL | W09 | I139, I140, I141 |
| R108 | Laws | UX | W09 | I142 |
| R109 | Map at 844x340 with Empire open | UX | W04, W13, W14 | I080, I151, I224 |
| R110 | Turn report at 844x340 | UX | W04, W13, W14 | I151, I161 |
| R111 | Peoples | NOTE | W11 | I122 |
| R112 | Turn reports | NOTE | W10, W11, W14 | I115, I171 |
| R113 | Units after the Cyrene battle | FAIL | W00, W01, W02, W03 | I003 |
| R114 | Legacy tab | PASS, UX | W09, W14 | I150 |
| R115 | Log tab | PASS, UX | W04, W14 | I169, I170 |
| R116 | Trade agreement with D'mt | FAIL | W10 | I113, I114, I115 |
| R117 | "Achievement unlocked: Dynasty" | NOTE | W09, W14 | I146, I147 |
| R118 | Era banner "A new era dawns" | PASS, UX | W04, W14 | I161 |
| R119 | Army sheet (cavalry at Cyrene) | FAIL | W03 | I004, I005 |
| R120 | March > "Move now" (new button next to March) | PASS, FAIL | W03 | I065, I066 |
| R121 | AI activity census (state) | NOTE | W00, W11 | I035, I120, I123, I124 |
| R122 | Kanesh tribute demands | NOTE | W10 | I100, I101, I104 |
| R123 | Kanesh demand of 1,239 | FAIL | W10 | I103, I105 |
| R124 | Kanesh war | NOTE | W10, W11 | I120, I121 |
| R125 | Kanesh took Jerusalem | NOTE | W10, W11 | Preserve / neutral evidence (see CSV) |
| R126 | Settling the last sites | FAIL, UX | W07, W11, W13 | I091, I092 |
| R127 | Top bar research | FAIL | W09 | I133 |
| R113b | Correction to row 113 | Correction | W00, W02, W03 | I003 |
| R128 | Buildings tab (Siwa) | UX | W08 | I040, I043, I044 |
| R129 | Infrastructure (80 g), Defenses (60 g), Develop x3 (123 ADM/DIP/MIL) in 6 cities | PASS, NOTE | W07, W08 | I017, I021, I031 |
| R130 | Build tab, same unit twice fast | FAIL | W08 | I028, I045 |
| R131 | Opening a city from the Cities list | UX | W13 | I073 |
| R132 | Map at strategic zoom | FAIL, UX | W13 | I074, I075 |
| R133 | Siege of Kerma card | NOTE | W06, W09, W14 | I148 |
| R134 | Command battle load | NOTE | W14, W15 | I216, I220 |
| R135 | Camp name | NOTE | W05, W14 | I208 |
| R136 | Build menu first open | FAIL | W05, W14 | I186 |
| R137 | Place Farm on open grass | UX | W05, W14 | I174 |
| R138 | User suggestion | IDEA | W03, W04, W05 | I157 |
| R139 | User suggestion | IDEA | W03, W04, W05 | I062 |
| R140 | Place Barracks in battle 2 | FAIL, UX | W05 | I173, I175 |
| R141 | Battle HUD at 844x340 | UX | W05 | I201, I202, I203 |
| R142 | Build placement feedback | FAIL, UX | W05 | I180, I181 |
| R143 | Hover detail on build tiles | PASS | W05 | I187 |
| R144 | Barracks > 7 Musketeers | PASS | W01, W06 | Preserve / neutral evidence (see CSV) |
| R145 | Move to staging point (right-click) | PASS | W05 | Preserve / neutral evidence (see CSV) |
| R146 | Attack the near tower | NOTE | W06 | I211 |
| R147 | After the tower fell | FAIL | W05 | I191 |
| R148 | Second wave (cavalry) | FAIL | W05 | I193 |
| R149 | Selection count | UX | W05 | I195 |
| R150 | My own play (user caught it) | NOTE | W06, W14 | I213 |
| R151 | Selecting my building | FAIL, UX | W05 | I209 |
| R152 | "Reserve 1" button | PASS, UX | W05 | I193 |
| R153 | Gun foundry > 3 Field Cannon (120 mat, 60 gold) | PASS | W01, W05, W06 | Preserve / neutral evidence (see CSV) |
| R154 | "All N" button | FAIL, UX | W05 | I188 |
| R155 | Attack button then tap a structure | FAIL, UX | W05 | I189 |
| R156 | Cannons + 12 musketeers on the last tower | PASS | W01, W02, W06 | Preserve / neutral evidence (see CSV) |
| R157 | Battle end | PASS, NOTE | W01, W02, W06 | I010, I015 |
| R158 | Campaign result of the Kerma Victory | FAIL | W00, W01, W02 | I001, I002, I003 |
| R159 | First contact | NOTE | W11 | I122 |
| R160 | User decision | CUT | W05, W06 | I210 |
| R161 | Kerma | NOTE | W06, W12 | I128, I132 |
| R162 | Tribute demands | NOTE | W10 | I101, I102 |
| R163 | Kerma after capture | NOTE | W12 | I126, I127, I132 |
| R164 | Tribute | NOTE | W10 | I100 |
| R165 | After Siwa surrender, Kerma Victory, Kerma surrender | FAIL | W12 | I129 |
| R66 | Libu panel | NOTE | W02, W14 | I172 |

## 12. Player follow-up: RTS and iPhone layout

**Added after the three Claude audits.** U01–U14 are 14 new player requests, not revisions to the 224 audited-item count or the 165 raw-log rows. The latest behavior below takes precedence where an earlier W05 task said to expose callable reserves or keep the build menu closed after placement. The companion [art production plan](playtest-audits-art-production-plan.md) covers the motion, models, icons and previews. This section defines gameplay and interface acceptance; it does not implement those changes.

### 12.1 Source facts and scope

At `9d7b49b81865eef92ad3a85d309bdff6ad2499f8`, the battle economy has three spendable resources: `food`, `materials`, `gold`. `stone` and `ore` nodes produce the shared `materials` account, and the HUD labels that account with a timber icon. The simulation also has a separate **Battle Supply** meter used by powers, reserve calls and regeneration. The top bar shows that meter only in battles without the economy. The player's request therefore needs a resource rule change for stone and a HUD change for supply; changing an icon alone does neither.

The worker's existing job stores the target node, carried amount/type, gather phase and drop-off. The renderer needs those states exposed clearly enough to show the correct tool, visible load, barrow trip and unload. Unit speed is already class-specific in `battleStats.js` (base examples in battle tiles per second: cavalry 3.2, infantry 1.6, siege 0.9), but `movement.js` can apply `groupSpeed` to a mixed group, so trace the observed movement before retuning values. The current selection chip already has a small X for selected squads; the requested cancel icon should be consistently available for the applicable battle selection/action states.

The current battle setup splits forces at `combatWidth`; `callReserve` charges Battle Supply and delays entry. `BattleHud` renders a Reserve button/panel. This is a gameplay rule, not merely an unwanted button. The new starting-roster rule must update setup, field limits, deployment, outcomes, AI, Auto and replay together. The same HUD currently puts a fixed-height top bar at `top: 0` with safe-area padding, while side sheets use fixed top/bottom offsets. iPhone Dynamic Island and landscape cutouts need layout testing at the actual visible viewport and safe insets.

For U14, the current battle catalog already sets `HOUSE_HOUSING = 10`, the `house` building uses that value, `housingCap` sums it once per living completed house, and build details advertise `+10 housing`. `population` counts living squads and training, so a house should raise the **capacity** by 10 and should not spawn 10 people. The reported +100 needs a reproducible capture and trace of the displayed current population, housing cap, construction completion and any same-tick training or roster changes before a constant is altered.

### 12.2 Request ledger and concrete behavior

| ID | Player request and owning package | Implementation plan and acceptance |
|---|---|---|
| U01 | Stone must matter and appear in the RTS resource bar. W05/W06 and battle economy. | Add `stone` as a distinct stock/resource with its own pickup, drop-off, icon and number. Keep `materials` for timber/ore until a later explicit material split. Stone-bearing nodes produce stone. Price a meaningful, age-appropriate subset of construction and repairs with stone (starting candidates: walls, towers, keep upgrades or stone civic structures); show it in build quotes, affordability/rejection and AI spending. Ensure stone-poor maps have a viable first base and access to stone or substitutes/trade. Show Food, Materials, Stone and Gold separately. An extra column must not silently change old battle saves/replays; specify versioned migration and baseline allocation rather than converting every existing material unit to stone. Tests cover gather → drop → spend, refund, capture/loot, replay, AI and resource exhaustion. |
| U02 | Build menu hidden until a worker taps a circular hammer button, with an X to close. W05/UI11. | Selecting an eligible worker shows one persistent 44–48 px circular hammer icon with no visible label; it opens the build sheet. A worker-only selection never opens the sheet automatically. X closes only the sheet and retains selection/work orders. Mixed selections must identify eligible workers before showing the launcher. Give icon buttons accessible names/tooltips and clear focus/pressed state. Test first-open icon fallback, rapid open/close and no click-through to the field. |
| U03 | iPhone Dynamic Island/cutout and side panels. W04/W05/UI12. | Define the battlefield's usable rectangle from safe-area insets and `visualViewport`, including landscape left/right insets, rotation and keyboard changes. Keep top resources, pause/speed, bottom launchers, X, placement confirmation and side sheet close controls inside it. Let contextual sheets open toward the side with room, reverse/resize on cramped viewports, and use scrollable content rather than clipped controls. Preserve battlefield hit testing under overlays and at least the ordinary-state 70% field target. Test physical iPhone orientations/cutout placement plus 844×390 and 844×340 emulation; CSS env values alone are not proof. |
| U04 | Better trees and selectable trees. W05/W14, MD05/UI13. | Review tree silhouettes/material/LOD at the battle camera; use the seven-climate art work already planned. Make visible grove/tree nodes pickable by a forgiving screen-space target matched to the rendered trunk/canopy, taking precedence over empty ground only when intended. A tap with no worker selected opens the node info/selection ring; with worker(s) selected, it issues a gather order and shows accepted/rejected feedback. Dragging the map must not select. Distinguish decorative trees with no resource node so they do not falsely promise gathering; fog and depleted states remain honest. |
| U05 | Dedicated icon-only deselect button. W05/UI11. | Provide a visible 44–48 px circular cancel/X action for a selected unit, worker, building, node, ability target or placement state. Define close precedence: cancel the currently armed target/ghost first, otherwise clear selection; a build-sheet X closes the sheet only. Escape/right-click equivalents on desktop use the same state transition. It must never issue Stop, cancel construction, drop carried goods or trigger a refund. |
| U06 | Food visibly collected into a barrow; stone/gold with a pickaxe; trees with an axe; loaded return and drop-off. W05/AP03/MD07, AN15–AN17. | Expose per-worker `job.phase`, `node.kind`, `carry`, `carryRes`, drop point and movement to the renderer. At food nodes, visibly harvest/collect, put goods into the worker's barrow, wheel it back and unload at the actual drop-off. At stone/gold nodes use a pickaxe and show the respective load; at tree nodes use an axe and show logs. Ore uses the same pickaxe family with its own visible load. Empty outbound and loaded return states differ. Stock increases at the sim's actual delivery, not at a cosmetic animation beat; interrupt, depletion, no drop point, death and job switch do not duplicate or teleport goods. The wheelbarrow/handcart assembly must fit the era and existing body rig, with readable contents at phone zoom. |
| U07 | Different movement speeds, especially fast cavalry and slow siege. W05/W06. | Verify class values, age overrides, terrain cost, group-speed matching and displayed animation cadence. A cavalry-only order crosses a fixed clear distance faster than infantry, and siege slower; a mixed selected group moves together only when cohesion is explicitly active/indicated. Releasing cohesion restores individual speed. Match gait/wheel rotation to distance and avoid foot sliding. Record measured 20-Hz sim travel times across same seed/map rather than changing speed values until a reproducible discrepancy is found. Rebalance pursuit, pathing and AI only if measured outcomes require it. |
| U08 | Cannons, tanks and artillery should display bigger. W14/MD09–MD10. | Inspect runtime `MODEL_SCALE`, age-specific height metadata, LOD simplification, camera zoom and squad spacing. Increase apparent size of cannon, tank and artillery silhouettes as needed, keeping crew and vehicle proportions coherent. Check that barrels/tracks/wheels survive far LOD and that selection/visibility improve at 844×390 and 844×340. Treat display scale separately from collision, weapon range, squad occupancy and actual combat stats. Measure overlap/clipping and phone performance before accepting a larger renderer scale. |
| U09 | Ability buttons packed behind a circular wand button with no visible text. W05/UI11. | Use one circular wand launcher for both selected-unit abilities and applicable commander powers, with a compact popover/sheet showing names, costs, cooldowns and disabled reasons. Retain target aiming/confirmation and a clear X/cancel. Hidden abilities must still show readiness or urgent feedback on the launcher; the toolbar stays slim when unopened. Screen readers get names and states despite icon-only launcher. Test mixed unit selection, multiple powers, paused/deployment views and touch target overlap. |
| U10 | Remove Reserve button and put committed regiments in the starting force. W01/W02/W05/W06. | Build the full eligible roster into the initial deployment/start state with no player-callable reserve pool or reserve charge. Expand/reconcile legal deployment positions and combat-width/field-cap rules so large rosters do not overlap, spawn outside bounds or vanish. Keep genuine later allied/reinforcement arrivals as clearly labelled events, without a Reserve button. Reconcile base survival, retreat, casualty and participant dispositions, AI setup, Auto estimates and replay compatibility. Baseline balance against the old staged entry. Test large attacking/defending armies, city/field/raid/naval cases, deployment reload and historical logs whose old reserve command must still replay under the old rules version. |
| U11 | Units in enemy territory must respond when attacked. W05/W06. | Reproduce with idle, attack-move, explicit attack, Hold, ordinary Move, retreat, garrison and low-supply states. Idle/combat stance should acquire a visible nearby attacker and retaliate or close within a bounded leash; a unit already attacking a distant target may switch to an immediate threat under documented priority. Hold may strike in reach but not chase, and Move/retreat do not unexpectedly turn into attack-move. Check line of sight, range, facing/path, ammunition/reload, target validity, friendly fire and suppression; show a reason when a unit cannot respond. Use the existing target grid, avoiding per-unit scans of the whole army. Same trace must hold for player and AI. |
| U12 | Show current Battle Supply. W05/UI14. | Display numeric current/cap supply in the battle top bar in both economy and non-economy battles, beside but visually separate from Food, Materials, Stone and Gold. Show gain/drain and power cost in the expanded tooltip/panel, with a low-supply state. Campaign army supply meter and RTS Battle Supply are distinct concepts; label them accordingly. On cutout phones, shorten title/secondary labels before hiding supply or stone. The number must update as objectives/buildings change supply and match the sim after pause/resume/replay. |
| U13 | Build sheet hides during placement, reopens after placement; X still closes it. W05/UI11. | Model explicit `closed → build sheet open → placement preview → placement confirmed → build sheet open` states while the eligible worker remains selected. Picking a building collapses the sheet so the field/ghost is visible. Successful confirmation reopens the sheet once, now showing updated stock; cancel placement returns to the sheet without spending. X closes the sheet at any non-placement point; deselect clears placement and sheet. An invalid placement retains the preview and rejection reason, with cancel available. Ensure no tap used for confirmation also activates an underlying building, opens an ability or places a second site. |
| U14 | Village house must add 10 population capacity, not 100. W05/W06 and battle economy. | Treat “population” here as the battle housing/population **cap**: one completed village house adds exactly 10 capacity, never 100, and does not instantly create residents or alter squad strength. Reproduce the observed +100 in the battle HUD, build detail and simulation state before changing code; verify whether it comes from display scaling, duplicate house registration, city-manifest housing, an unrelated training/roster update or a true rules bug. Compare immediately before/after one house, after a second house, after destruction/repair, and after save/replay; each living completed house contributes once. Keep `HOUSE_HOUSING`, house catalog text, build quotes, AI training affordability and displayed current/cap consistent. Add a regression only for the diagnosed cause and test all age names for the same house role. |

### 12.3 Sequence, risks and test fixtures

1. **Rules first:** U01 and U10 need versioned resource/setup contracts and balance fixtures. Update battle input/setup, economy stock/cost arrays, worker carry/drop, AI, Auto and replay in the same coherent change before making UI numbers authoritative. Keep old saves and old command logs tied to their original rules version. For U14, first trace the claimed +100 against the existing +10 catalog and sim; change only the layer actually at fault.
2. **Input state second:** implement the worker hammer sheet, placement/cancel/reopen flow, wand sheet and deselect precedence as one interaction state machine. Correct `contextFor`/selection transitions as well as `BattleHud` and `TacticalBattleScreen`; avoid independent booleans that can leave two sheets open.
3. **Space and visibility:** measure actual iPhone cutout and safe areas, then adapt top-bar information density and side panel anchors. The four economy stocks plus Battle Supply are all required even when the title shrinks. Scroll/expand details; do not use unreadable 8 px values or 30 px touch targets.
4. **World feedback:** integrate worker `job`/`carry` presentation, clickable grove nodes, class-speed animation and larger machine silhouettes. Art changes follow the art plan's source/rig/LOD proof and do not change sim inventory or collision by themselves.
5. **Trace combat:** capture a deterministic enemy-territory scene where several player units are attacked. Log order, target, perceived enemies, legal range/line of sight, path, damage and state each tick; compare idle, Hold, Move and attack-move. Add regression cases only for the actual cause, then test AI parity and performance.

Release checks: at 844×340 and on a cutout iPhone, the player can select a worker, open the hammer sheet, choose a building, see an unobscured legal footprint, confirm, see the sheet return, and close it with X. The player can select a tree, observe an axe/load/barrow/drop cycle and the corresponding stock increase; stone has its own balance and cost use; Battle Supply remains readable. Each completed village house raises battle housing capacity by exactly 10 and does not instantly create people; the displayed current/cap pair matches the simulation. A cavalry-only force overtakes infantry over the same ground, while a mixed group communicates its pace. Every starting regiment appears without a reserve action, every eligible idle unit defends against a visible immediate attack, and cannons/tanks/artillery remain recognizable without overlapping or exceeding the phone scene budget.
