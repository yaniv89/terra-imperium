# Audit work breakdown: code, art, and scope

Planning only. This classifies the 224 source-audit gameplay items (I001–I224), the 13 later player requests (U01–U13), and the 54 *overlapping* visual production requirements (AN/AX/MD/UI). It does not authorize or record implementation. The individual titles and classifications are in [the 237-row gameplay CSV](playtest-audits-work-breakdown.csv) and [the 54-row visual CSV](playtest-audits-visual-work-breakdown.csv); the full behavior and acceptance criteria remain in the [item inventory](playtest-audits-item-inventory.md), [implementation plan](playtest-audits-implementation-plan.md), and [art plan](playtest-audits-art-production-plan.md).

## Counting rules

- **Primary Code or Art** means the discipline that must deliver the central result. The `support` column names the other discipline when the item needs both. This is an ownership view, not a count of people or source files.
- **Fix** corrects observed or reported behavior or existing presentation. **Addition** adds a missing capability/control. **Change** deliberately changes a working rule, balance parameter or design. **Investigation** is an unresolved observation; it is not counted as a proven bug until reproduced.
- **Major** crosses multiple systems, needs versioned rules/data, broad AI/replay/balance coverage, or a substantial asset pipeline/package. **Medium** changes one feature with multiple states or assets. **Small** is localized once its dependency is ready. These are *item impact* labels, not a promise that each row equals one commit or session. A small interface item may be blocked by a major rule change.
- The 54 visual rows refine or support the 237 gameplay items. **Do not add 54 to 237.** Some visual rows also cover pre-audit art backlog. The 8 product ideas, 9 untested areas and 22 self-identified risks remain separate, as in the baseline plan.

## Gameplay/request primary ownership and size

| Primary owner | Major | Medium | Small | Total |
|---|---:|---:|---:|---:|
| Code | 93 | 45 | 92 | 230 |
| Art | 1 | 4 | 2 | 7 |
| **All 237** | **94** | **49** | **94** | **237** |

Of the 230 code-primary rows, **155 are fixes, 23 additions, 38 changes, and 14 investigations**. Of the 7 art-primary rows, 6 are visual asset/legibility work and U06 is a new tool-and-barrow animation package with code integration. Thirty-one code-primary gameplay rows explicitly need art support; all seven art-primary rows need code integration or runtime selection. The support count identifies interfaces, not a second set of 38 independent gameplay tasks.

### Code: fixes, additions, changes, investigations

| Code action | Count | Examples |
|---|---:|---|
| Fix | 155 | Outcome/casualty mismatch (I001–I003), wrong build tap (I045), unresponsive units after target loss (I191) |
| Addition | 23 | Gold hurry action (I019), queue reorder (I046), stone account and spend path (U01), compact launchers (U02/U09) |
| Change | 38 | Campaign pacing (I024), AI pressure (I120), class-speed presentation (U07), full starting roster without Reserve (U10) |
| Investigation | 14 | Zero-supply persistence (I004), land tile remaining in purchase list (I037), battle load variance (I220) |

The 14 investigation rows need a reproduction/trace before committing to a fix. Some additions and changes share implementation with fixes; for example U02/U13 and I178/I183 should ship as one build-sheet state machine.

### Art-primary gameplay requests

| Size | IDs | Core deliverable |
|---|---|---|
| Major | U06 | Tool-specific harvesting, visible load, wheelbarrow return and deposit; code exposes the actual job phase and cargo. |
| Medium | I209, I215, I217, U08 | Ownership readability, era/culture town assignment, tree graphic repair, heavy-weapon silhouettes. |
| Small | I097, I099 | Resource and settler icon registration, size and consistency. |

## Visual production breakdown (54 overlapping rows)

| Primary owner | Major | Medium | Small | Total |
|---|---:|---:|---:|---:|
| Art | 20 | 8 | 2 | 30 |
| Code | 3 | 10 | 11 | 24 |
| **All 54** | **23** | **18** | **13** | **54** |

Art-primary visual rows cover rigged locomotion/combat/work clips, resource and climate models, age/culture town sets, heavy-weapon silhouettes and building states. Code-primary visual rows cover route/state interpolation, construction and damage state rendering, FX timing, selectors, icon overlays, compact battle controls, and cutout-safe layout. Their exact AN/AX/MD/UI IDs, descriptions, acceptance references and size labels are in the visual CSV. A primary Code visual row may still need a design/texture/icon contribution; a primary Art row still needs runtime integration.

## How to use the sizes

1. Start with the major correctness contracts: W01–W03 battle outcomes and persistence, W04–W05 interaction state, U01 stone versioning, U10 roster versioning, and W07–W12 pacing/AI/conquest rules. Close a shared root cause against every linked I/U item.
2. Follow with medium feature slices and art dependencies. In particular, reconcile all 54 visual rows against the actual GLB/rig/clip/source inventory before creating files. Reuse, repair and new-file counts are **unknown until art Gate G1**, as the art plan states.
3. Batch small items only after their owning system is stable. A localized label or icon should not be used to hide a wrong simulation state.
4. For each investigation, save a reproducible seed, input log and phone/browser capture or trace; then reclassify it as a confirmed fix, design clarification or invalid report. Update the CSV when evidence changes.

The prior **45–80 focused-session** estimate is a rough capacity range for combined engineering, art and validation. The 94 major item labels do **not** imply 94 separate sessions: several are linked outcomes of the same root change, and some are blocked by the same asset or product decision. Re-estimate by work-package slice after reproduction and art Gate G1.
