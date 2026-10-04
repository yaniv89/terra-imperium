# Terra Imperium roadmap: the ancient world, independents and nine ages

Date: 2026-10-04. **Start here.** This file ties together everything decided with the user in
the planning session of 2026-10-03 and 2026-10-04. The details live in three plans and one data
folder; this file says what to build, in what order, and what is already done.

**Branch (build):** `claude/ancient-world`, started 2026-10-04 from `claude/bronze-towns` (the art
branch: town kits, `src/data/architecture.js`, the frequency-100 grid) merged with
`game/settle-rules` (the settling prototype). All the work below except the new ages is built here.
**Branch (plans only):** `claude/plan-eras-origins-future` (the plans, and Phase 0 of the ages on
the old `main` base; Phase 0 is **not** on `claude/ancient-world`, it comes with the ages work).
Big features go on a side branch; merge to `main` only when the user asks, then rebuild `docs/`
(see the `ship` skill). Messages to the user: plain English, no em dashes.

---

## 1. The documents

| File | What it holds |
|---|---|
| `plans/ROADMAP.md` | this file: decisions, order, status |
| `plans/peoples-and-world-setup.md` | **phase W0 and M**: the 150-people pool (names, capitals, themes, weights), world sizes (measured), the start screen, city names, the art theme survey, map resolution and quality |
| `plans/independent-cities.md` | **phases W1 to W4**: independent cities (one city, never expand, raid like barbarians), their AI, what players and AI majors can do to them, naming of independents and free cities |
| `plans/eras-origins-and-future.md` | **phases 0 to 5**: nine ages from 5000 BCE to 2500 CE (Neolithic, Age of Cities, Bronze, Classical, Kingdoms, Gunpowder, Modern, Information, Future), tech, units incl. robot armies, buildings, wonders, diplomacy, governments, AI, events, art, pacing, saves |
| `plans/settle-rules.md` | **phase S**: one Civ-style city spacing rule for founding and starts (4 rings, 3 across water), no founding on others' land, extra start cities checked against everyone, the settler lens, an audit check |
| `plans/data/cities/*.json` | draft city names: 150 peoples x 20 real historical names (3,000), capital first, one file per region |
| `.claude/skills/balance-sim/stateHash.sim.js` | the "nothing changed" check for refactors (whole-state hashes on fixed seeds) |

---

## 2. Every decision so far (from the user)

**The world**
1. The full 240-nation world is dropped for new games: its button is **commented out**, not
   deleted; old full-world saves keep loading.
2. New games are emergent worlds in **three sizes: Small 24, Standard 36 (default), Large 42**
   major nations, decided by measurement on the real grid (`peoples-and-world-setup.md` 2).
3. Majors are picked by history weight with a **minimum gap of 6 hexes**, not "as far apart as
   possible" (that left a quarter of nations alone).
4. Every other people is an **independent city**: one city, never conquers or settles, raids
   like barbarians. Small uses 96 independents, Standard and Large every remaining people.
5. **Independents stay independent forever** (no awakening into majors). Today's emergence of
   new majors every 50 turns is removed in these modes; the late-settled islands appear as
   independents in their historical year.
6. Raids may do **everything**: pillage tiles, cut trade routes, capture settlers, burn outposts,
   and **sack** weak cities (gold, -1 size, a building damaged; never a capture).
7. **Razing**: any city size, one size per turn until gone (can be retaken meanwhile).
8. **Friendly independents may join peacefully.**
9. Breakaway cities (loyalty 0, nobody to join) become **new independents**, not ownerless.
10. **Every nation starts equal**: one city, same size, same army and treasury, no head starts.
11. The **world seed is random and hidden** (drawn at Start, saved with the game). Today it
    defaults to 1, so every emergent world is the same map.

**Peoples and names**
12. A pool of **150 peoples** with new names, ancient empires and peoples, **none copied from
    Civilization** (checked against Civ I to VII and their synonyms and city-states).
13. **The Kingdom of Israel is always in the world** (capital Jerusalem, the `israelite` art
    theme), with no other advantage.
14. Names researched on the web; several peoples share an art theme.
15. Every people has **20 real historical city names**; conquered cities keep their names.
16. Majors show a title by government and size ("Kingdom of Akkad", "the Akkadian Empire") and
    the modern land underneath ("in modern Iraq").

**The start screen**
17. World size as **rounded radio cards**, like the difficulty cards but rounder; one row on a
    landscape phone. No seed field.

**Ages**
18. **Nine ages**: Neolithic (5000 to 3300 BCE), Age of Cities (3300 to 2000 BCE), Bronze,
    Classical, Kingdoms, Gunpowder, Modern (1900 to 1990), Information (1990 to 2100), Future
    (2100 to 2500).
19. **Default start: Origins, 5000 BCE.** The game ends in **2500**.
20. Historical names for the ancient ages; **robot armies** in the second half of the Future
    age; the Synthetics estate, Technocracy and the Corporate State are in.
21. **Out of scope**: tin as a resource, sea level rise.

**The map**
22. Improve the **resolution and quality** of the map (finer tiles, real hillshade, land cover,
    rivers, a sharper globe); the decided look (real Earth, faint hexes) stays.

---

## 3. What is already done

- **All the plans above**, pushed to the branch.
- **Phase 0 of the nine-age plan (the age registry), in code**: `src/data/ages.js` is the one
  place ages are defined (`FIRST_AGE_ID`, `LAST_AGE_ID`, `isAgeAtLeast`, `isAgeBefore`,
  `agesFrom`, `formatYear`, explicit unit stats per age); every hard-coded age check goes through
  it; the tech tree, naval names and era goals are keyed by age; `src/data/ageRegistry.test.js`
  lists what a new age must fill. Verified **bit-identical** to the commit before (whole-state
  hashes at every checkpoint, 2000 BCE to 1995 CE). Lint clean, e2e 7 of 7.
- **The city name drafts** (3,000 names), validated for counts and duplicates.
- **The world-size measurement** (section 2 of `peoples-and-world-setup.md`).

---

## 4. The order of work (each phase on its own branch, merged when the user says)

| # | Phase | Plan | Size |
|---|---|---|---|
| 0 | **S. Settle rules** (`plans/settle-rules.md`): R1 shared spacing with the water exception, R2, R5, R6 settler lens, R7 audit. R3 and R4 (crowded capitals of the 240-nation world) matter only for the legacy full world, which new games no longer offer; the peoples pool is spaced by construction (its build script uses R1) | settle-rules | 1 session |
| 1 | **W0. Peoples and start screen**: `peoples.js` + build script (capital tiles, spacing, colours), world sizes, the picker with the 6-hex gap, equal starts, random hidden seed, radio cards, full world commented out, the 150-people picker, city names wired into `cityNames.js`, palaces by `nation.theme`, the id switch from country codes (with a legacy map for tests), the web check of the city names | peoples-and-world-setup 3, 4, 6 | 2 to 3 sessions |
| 2 | **W1. Passive independents**: one-city `kind: 'independent'` nations, `canFight` (attack without war), nation-loop guards for speed, breakaway cities as independents, late island arrivals, balance-sim at 24/36/42 | independent-cities 2, 3, 6, 9, 10 | 2 to 3 sessions |
| 3 | **W2. Independent AI**: personalities, garrison, raids, sack, grudges, tribute demands | independent-cities 4 | 2 to 3 sessions |
| 4 | **W3. Interactions and major AI**: tribute both ways, trade, mercenaries, raze over time, peaceful joining; AI majors conquer independents; every major Tier 1 | independent-cities 5 | 2 sessions |
| 5 | **W4. UI and art for independents**: hatched borders, personality shields, raid markers, the independent sheet | independent-cities 7 | 1 to 2 sessions |
| 6 | **Ages 1. Age of Cities** (3300 to 2000 BCE) | eras 16 | 3 to 4 sessions |
| 7 | **Ages 2. Neolithic and the Origins start** (5000 BCE, the default) | eras 16 | 3 to 4 sessions |
| 8 | **Ages 3. The Information split** (Modern 1900 to 1990, Information 1990 to 2100) | eras 16 | 3 sessions |
| 9 | **Ages 4. The Future** (2100 to 2500, END_YEAR 2500, robot armies) | eras 16 | 4 to 5 sessions |
| 10 | **Ages 5. Art and polish** (models, towns, wonders, icons, audio, historical names) | eras 16 | ongoing |
| any | **M. Map quality**: measure, levels 6 and 7 from finer data, a smarter close-zoom shader, rivers and lakes, the globe, size and speed | peoples-and-world-setup 6b | 4 to 6 sessions, in parallel |

Why this order: W0 to W3 change who exists on the map, and the Origins and Age of Cities designs
build on independents; the ancient ages come before the late ones because every game plays the
opening; map quality touches only the renderer, so it can run alongside anything.

**Save version 9** is shared by W0 (new nation ids), W1 (independents) and the ages work; bump it
once, in W0, with a migration that keeps old saves loading.

---

## 5. How to start the next session

1. `git fetch origin claude/plan-eras-origins-future && git checkout claude/plan-eras-origins-future`
   (or branch from it for the phase).
2. Read this file, then the plan of the phase (W0: `plans/peoples-and-world-setup.md`).
3. Use the project skills: `add-mechanic` before any rule change, `balance-sim` for every
   balance change (and `stateHash.sim.js` for refactors that must not change play), `battle-lab`
   for battle work, `ship` for commits and merging.
4. Checks before every push: `npm run lint`, `npx vitest run`, and for UI or gameplay the
   Playwright e2e (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx playwright test`).

---

## 6. Known issues to keep in mind
- `src/engine/worldgen/emergentWorld.test.js` "later starts give more cities and more land"
  times out at 5 s **on main too** (not caused by this work); fix or raise its timeout in W0,
  which rewrites that module anyway.
- `scripts/build-edge-engine.test.mjs` times out only under full-suite load; passes alone.
- The art branch `claude/bronze-towns` holds the town kits and `src/data/architecture.js`
  (themes); W0's "palaces by `nation.theme`" needs it merged or rebased in first.
- The city name drafts were not checked name by name on the web yet; W0 runs that check.
- The peoples' capital coordinates are approximate; the W0 build script snaps them to tiles and
  re-checks spacing with the settle rule (R1). They passed 3 rings on the frequency-75 grid on
  2026-10-04; `bronze-towns` uses the **frequency-100 grid** (hexes about 80 km, spacing 4 rings,
  306 km), so the check reruns there and nudges any pair that fails.
- Hex counts in the plans (land per major, the 6-hex gap) were measured on the frequency-75 grid;
  at frequency 100 the same distances are about 1.33 times as many hexes (the gap becomes 8).
