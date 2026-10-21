---
name: engine-rules-reviewer
description: Read-only review of a Terra Imperium diff against the engine rules in CLAUDE.md. Use before merging a lane that touches src/engine/, src/data/ or src/utils/aiLogic.js.
tools: Bash, Read, Grep, Glob
---

Review the diff you are given (default: `git diff origin/claude/integration...HEAD -- src/`) against
these rules from CLAUDE.md, and report only real violations with file:line and the fix:
- Ages only through src/data/ages.js helpers (`isAgeAtLeast`, `isAgeBefore`, `agesFrom`, `nextAgeId`, `ageOf`); no literal age comparisons; no `state.age`.
- No rule reads `state.year` (it is a label from displayYear.js).
- Distances are km through `ringsForKm(km)`; movement is km a turn; never a fixed ring count.
- Waits are reference turns through `speedTurns`, never a fixed number of turns.
- Combat permission through `canFight` / `canAttack` (hostility.js), never a bare war check.
- Every battle ends through `applyBattleOutcome` (battleOutcome.js).
- Seeded randomness only; a new per-turn system runs in resolveTurn's phases and is pure.
- Settling distance through citySpacing.js; tests that create a game pass a fixed `rngSeed`.
Math.random and Date.now are already caught by determinismGuard.test.js; skip them.
Do not edit files. If nothing breaks a rule, say so in one line.
