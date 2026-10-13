# Playtest audit work: lane briefs (wave 0 and wave 1)

One brief per agent. Schedule and merge order: [conflicts, section 7](playtest-audits-conflicts.md).
Plan: [implementation plan](playtest-audits-implementation-plan.md), [addendum](playtest-audits-addendum-2026-10-13.md),
[item inventory](playtest-audits-item-inventory.md), [code batches CSV](playtest-audits-code-batches.csv).

## Common rules (every lane)

1. Work in your own git worktree on the branch named in your brief, created from the current
   `claude/integration`. If `node_modules` is missing in the worktree, link it, do not install:
   `cmd //c "mklink /J node_modules C:\GitWotkspace\terra-imperium\node_modules"`.
2. Read first: `CLAUDE.md`; the project skills your brief names (`.claude/skills/*/SKILL.md`) and follow
   them; the plan sections and inventory rows your brief names; the user's answers in conflicts
   section 9 (they override the plan's proposed defaults).
3. Test first where practical. Tests that create a game pass a fixed `rngSeed`. No `Math.random()`
   or `Date.now()` in engine or sim code.
4. Run targeted vitest files while working. Before finishing: `npm run lint` (zero warnings) and
   `npx vitest run` once. If unrelated long tests time out under load, rerun those alone and say so.
5. Small coherent commits, plain English, with the item IDs. End every commit message with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push your branch to origin.
6. Do NOT merge into `claude/integration` or `main`. Do not bump the save version
   (`saveMigrations.js`): default any new persisted field on read and report it (the number is
   assigned at merge time). Only lane L1 may bump `SETUP_VERSION`.
7. Stay inside your files. In `resolveTurn.js` edit only your own phase. In `gameReducer.js` and
   `types.js` only append.
8. A dev server on http://localhost:3000/terra-imperium/ serves the main checkout
   (`claude/integration`), not your worktree: use it only to reproduce the baseline. To see your own
   change run `npx vite --port <free port>` in your worktree. If you cannot check something in a real
   browser, say "not verified in a browser"; never claim it.
9. Report back, short, plain English, no em dashes: branch, commits, IDs done / partly done / not
   done and why, test and lint numbers, what a player would notice, new persisted fields, decisions
   needed from the user, files other lanes must rebase on.

Research dossiers with line references (read the one your brief names), in
`C:/Users/yaniv/AppData/Local/Temp/claude/C--GitWotkspace-terra-imperium/fc4f568c-2b92-414d-8ad1-93cd40e50139/scratchpad/`:
`ce-plan-r2/repo-battle-bridge.md`, `ce-plan-r2/repo-phone-ui.md`, `ce-plan-r2/repo-economy-ai.md`
(plus `econ-probe.mjs` and its outputs), `ce-plan-r2/repo-rts-controls.md`, `ce-plan-r2/learnings.md`,
`ce-plan-research/repo-map-units.md`.

## L1 Battle trust (CB01). Branch `claude/pa-l1-battle-trust`. Hard.

Skills: battle-lab, add-mechanic. Plan: sections 2.1, 4, W00, W01; conflicts traps T3, T4; addendum
X03 to X06; inventory I001, I007, I008. Dossier: repo-battle-bridge.md.

Goal: the verified replay of a commanded battle equals what the player saw.
1. The replay codec admits every order the live worker accepts (deploy, gather, build, assist,
   repair, train, cancelTrain, rally, cancelBuild and the rest) with target and payload validation:
   one shared order schema for live admission and replay.
2. The verified setup is built by one function used by the live screen and by
   `RESOLVE_TACTICAL_BATTLE`, including `commandedSetup` (player squads never rout). X03.
3. Setup identity and version: bump `SETUP_VERSION` once; old-version logs are handled safely
   (evidence kept, existing fallback, never a crash).
4. Tests: a commanded economy fixture (deploy, build, train, and a squad that would rout without
   the rule) proving live result equals replay result; extend `replay.test.js` and
   `tacticalBattle.test.js`. X06.
5. X04: a unit that took the field and is missing from the result must not silently get full
   strength back in `sanitizeTacticalResult` `clampUnits`: make it an explicit invariant with a test
   (minimal safe fix; the full participant ledger is CB02, next wave).

Not in scope: battle rules (end conditions, retreat, reserves), HUD layout.

## L2 Army geography (CB03). Branch `claude/pa-l2-army-geography`. Hard.

Skill: add-mechanic. Plan: sections 2.4, 2.5, 4, W03; conflicts duplicates D11, section 5 (I064 and
I072 may already be fixed), trap T12; inventory I004, I005, I058 to I069, I130. Dossiers:
repo-map-units.md, repo-economy-ai.md.

Goal: physical position, movement, supply and command integrity on the campaign map.
1. One physical-location selector: `unit.tile` is the truth, `regionId` is the home base, defined
   separately. Fix "Army at Men-nefer" while the army is elsewhere; the city card must not list far
   armies as "here"; reinforcement must not use a stale home region for a field army.
2. I004 / I005: trace why a unit sat at supply 0 for 50 turns without attrition, fix the real
   cause, add a `stateAudit` warning for long zero supply.
3. March preview equals execution (Move now said 2 turns, arrived at once): one selector.
4. A besieging army is not idle. Add the user's macro **Hold** order: the unit stays put and is not
   counted idle (engine flag, reducer action, default on read).
5. I060 stack split and per-unit march only if it fits cleanly, else report. I130 as listed.
6. Re-check I064 and I072 against current code first; close with evidence if fixed.

UI only where needed to surface the selectors (army sheet header, city card units list, the idle
lines of `src/components/ui/nextPromptModel.js`). Lane L4 owns panels and chips.

## L4 Panels (CB13). Branch `claude/pa-l4-panels`. Hard.

Read `plans/UI-DESIGN.md`. Plan: sections 4, W04; conflicts section 5 (I152, I159, I156, I160) and
section 6 (you own the Idle N chip and the queue); addendum X16 to X20; inventory I151 to I169.
Dossier: repo-phone-ui.md.

Goal, on phone landscape (844x340 with Safari bars, `data-layout=phone-landscape`) without
regressing desktop and tablet:
1. One priority registry (generalise `src/hooks/useExclusivePanel.js`): one sheet, dock or decision
   card active at a time; lower-priority ones tuck into a chip and restore. Replace the three
   separate "busy" lists. X16.
2. Decision cards (pre-battle, event, peace offer, tribute, first contact) never share the row with
   a dock and never squeeze below a readable width. End Turn and chips do not move when panels
   open. X17.
3. Backdrop taps never close a decision card; closing the pre-battle card never cancels a march
   without an explicit choice. X18.
4. Era banner and `NationEliminatedBanner` timers independent of turn changes. X19.
5. One stacked "Idle N" chip that cycles to the next idle unit on each tap (user request). Other
   prompt kinds follow the same stacking rule, with "+N more".
6. Opening a city from the Cities list centres the map (copy `selectRegion` + `focusPlace` from
   `TurnReportSheet.jsx`). Leave the settle mode to CB06.
7. The remaining I151 to I169 items as their rows specify (gold popover labels on touch, Empire
   headers, and so on).

Lane L2 adds a Hold flag and "besieging is not idle" to `nextPromptModel.js` at the same time: keep
your idle model change a small pure function with tests. No engine rule changes. Extend
`e2e/landscape.spec.js` if Playwright can run; if not, say so.

## L5 Research (CB12 engine selectors). Branch `claude/pa-l5-research`. Medium.

Skill: add-mechanic. Plan: sections 4, W09; conflicts C9 (rulers are NOT yours), duplicates D8 and
D9, traps T10 and T11; inventory I133 to I150. Dossiers: repo-phone-ui.md, repo-economy-ai.md.

1. One research status selector for every surface (top bar chip, research sheet, End Turn blocker,
   "Choose research" prompt) with a generic gate field (wait or extra cost, T10). It says "waits for
   500 CE, about N turns" with banked science, never "1 turn". "Let my advisor pick" picks when
   something can start and says why when nothing can.
2. Government change: an engine preview selector with the true consequences (stability, resulting
   authority, whether laws lock under 25); the existing card text reads it. The full confirm dialog
   is next wave.
3. Laws: show each law's real effects only if the data matches what the engine applies; if it does
   not, report instead of showing wrong text.
4. Other I133 to I150 items that are selector or logic level. Leave layout to L4. In
   `nextPromptModel.js` change only the research lines. Do not edit `useExclusivePanel.js`, panel
   hosts or `index.css`.

## L7 News (CB14). Branch `claude/pa-l7-news`. Medium.

Skill: add-mechanic. Plan: sections 4, W14 (events and news only); conflicts duplicate D14, trap T11
(cooldowns in years or through the speed helpers, never hardcoded turns); inventory I170 to I172,
I221 to I224. Evidence: test log rows 35, 73, 84, 89, 112, 115, 116; playtest 2 sections 2 and 9.

1. Event prerequisites by context (climate, terrain, coast, buildings) and per-event cooldowns.
2. One summarizer for recurring log and turn-report lines (upkeep, trade-route plunder): one line
   with a count, detail still available.
3. Turn report: news about unmet peoples filtered or collapsed.
4. The listed grammar fixes through the shared naming helpers where possible.
5. The remaining items as their rows specify. Report before and after event counts from a short
   headless run (balance-sim skill) if practical. Ruler logging is not yours.

## L8 Diplomacy words (CB08 slice). Branch `claude/pa-l8-diplomacy-words`. Medium.

Skill: add-mechanic. Plan: sections 4, W10; inventory I110, I111, I112, I118, I119 only. Evidence:
test log rows 60, 65, 66, 71; audit M10, L5, L9.

Grudge must not rise against the victim for defending a raid the other side started; the attitude
label reflects an active raid; "Why?" lists the real opinion reasons; first-contact wording depends
on who met whom; raid result wording is consistent. Not in scope: tribute rules, truces, trade, AI.

## W00 Telemetry. Branch `claude/pa-w00-telemetry`. Medium.

Skills: balance-sim, battle-lab. Plan: W00 and section 8; conflicts section 6 (W00 owns
`scripts/simulate.mjs`), trap T1; addendum X15, X22, X24. Reuse `ce-plan-r2/econ-probe.mjs`.

Tools and measurements only, no game rule changes.
1. The balance harness measures the peoples world with a scripted player that answers blockers,
   with these metrics: player gold, ADM, DIP, MIL over time; city count and production per city
   (player, AI top and median); ETAs of first units and buildings; tribute demands (count, amounts,
   outcome); wars declared and their length; sieges, captures, conquests kept after 20 turns,
   rebellions; AI unit movement rate; majors met over time; overextension and authority of top AIs.
2. A per-war "one stack per turn" trace for AI armies (why a stack waits or shuttles).
3. battle-lab `squadTrace`: add `ORDER=attackStructure` and `ECO=1`.
4. Run the baseline (seeds 11 to 14 at least, 150+ turns, Normal; Marathon if time allows) and
   write `plans/data/playtest-audits-baseline-2026-10-13.md` plus raw files, with the commands.
Extend `worldStats` additively; do not change output existing tests assert.

## W0 Re-check. Branch `claude/pa-w0-recheck`. Medium. Docs only.

For each item in conflicts section 5 (I217, I218, part of I209, I215, I072, I064, I007, I176, I183,
I197, I152, I159, I156, I160, I129): read its inventory row, inspect current code, the named
commits and tests, and decide CLOSED (with evidence), PARTLY (what remains) or OPEN. Targeted
vitest and headless battle-lab runs are fine. Visual items: check on the dev server at 844x390 and
844x340 if you have browser tooling, else mark "needs a visual check" and say what to look at.
Write `plans/playtest-audits-recheck-2026-10-13.md` (ID, verdict, evidence, what remains).

## W0 Art branch review. No branch. Medium. Read only.

Use only `git fetch`, `git log`, `git diff`, `git show`, `git merge-tree` and file reads. Decide
whether `origin/gpt/art-remaining` should be merged into `claude/integration` before battle-art work
(conflicts trap T6). Report what it adds, binary size, licence notes (CC0 rule), whether it merges
cleanly, whether it could regress `58527447`, `375dc995`, `bf979d33`, `1d31e518`, `d135e898`,
triangle budgets against `plans/art/TRIANGLE-BUDGET.md`, and which tests cover the touched code.
Recommend: merge as is, merge after named fixes, or reject.

## W0 Plan rows. Branch `claude/pa-w0-plan-rows`. Easy. Docs only (`plans/`).

Correct the rows as conflicts section 7 "Wave 0" asks, in both the markdown and CSV files where the
row exists:
1. I178: completion check becomes U13's rule (the confirming tap is consumed and the sheet reopens
   once, with no second building armed).
2. I193, I194: "Superseded by U10". I195: "reserve" becomes "not yet entered / later reinforcement".
3. I146: superseded by phase RU (decision 39). I147: a small log line until RU. Fix their path in
   the CSVs to `src/engine/rulers.js`.
4. A14 premise: houses are passive structures that only an explicit order or bombardment destroys;
   per answer Q4 the base is the HQ, camp or keep plus economy and military buildings; taking the
   keep alone no longer wins.
5. I192: closed against answer Q6 (each unit walks at its own speed), with the addendum's X13 note.
6. Implementation plan section 3: under D1, D2, D3, D6, D7 point to conflicts section 9 as settled;
   add decisions 40 and 41 from the addendum as rows D14 and D15.
7. For each duplicate group in conflicts section 4, add "done with <owner ID>" to the non-owner
   rows' notes in the inventory markdown.
Keep CSVs valid (same column count, quoting intact). Do not renumber or delete rows.
