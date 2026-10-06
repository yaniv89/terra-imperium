# Review: the RTS plan, the world art plan, speed, fog and the globe

Date: 2026-10-06. Reviews `plans/terra-imperium-rts-plan.md` (the RTS plan) and
`plans/terra-imperium-world-art-and-city-destruction-plan.md` (the world plan), both written
against commit 81b933b7. This file does not replace them: it says what is wrong or missing,
what to decide, and adds the two things they lack: a speed plan for the campaign map (fog of
war, draw only what you can see) and a decision on the globe. Section 9 is the revised order
of work. Every number marked "measured" was measured on this branch on 2026-10-06.

---

## 1. Verdict in one paragraph

Both plans are careful, honest about uncertainty, and right about most engineering details
(determinism, ledgers, idempotent outcomes, no free armies, instancing, LOD). Their problem is
scope and order. They describe a full Age of Empires game inside every city attack of a
240-turn grand strategy game, at 500 to 1,000 soldiers per side on a phone, with a building-for-
building copy of the map city. That is 24 to 48 person-weeks by their own estimate, before the
world art plan's 24 to 48 more, and the hardest unknown (can a phone run it at all) sits behind
months of contracts. Meanwhile the game the player meets every turn, the campaign map, is slow
and has no fog of war. Recommendation: make the campaign map fast and fogged first, ship a
playable destructible-city siege with the battle system we already have, and keep the full
economy RTS as an optional later mode, gated on a measured kernel.

---

## 2. What the plans get right (keep)

- One deterministic 20 Hz worker sim, Three.js, no engine switch, no physics library.
- Every soldier a real entity with a conserved share of campaign strength; no free armies
  (regular vs auxiliary recruits, escrow, exactly-once outcome).
- City identity: the battle shows the city that is on the map, not a generic one.
- Geographic north kept, attacker enters from the real approach side (today
  `tileContext.js:31` rotates every approach to west).
- Instancing, LOD down to 50 to 100 triangles, impostors, pooled effects, quality tiers,
  suspend the map renderer during battle.
- Real-device soak tests as release gates; no silent unit cuts on phones.
- Pin the ruleset per pending battle; snapshots plus short journal on resume.

## 3. Factual problems found in the code

| Plan claim | What the code says | Consequence |
|---|---|---|
| Worker tick p95 at most 10 ms with 1,200 units, 2,200 later | Measured (`.claude/skills/battle-lab/scale.sim.js`, desktop container, AI vs AI, all on the field): 12 squads 0.31 ms/tick, 48 squads 0.65, 192 squads 2.9, **768 squads 26.8 ms/tick**. Cost grows about 9x per 4x units, close to quadratic | The current kernel is about 3x over budget at 768 entities on a desktop. 2,200 on a phone needs roughly a 30x to 100x faster kernel: spatial buckets for every target and separation query, typed arrays, staggered AI. It is a rewrite of `src/battle/sim`, not an extension. M1 must be first and must be a go/no-go gate |
| End verification under 3 s by replay | A 45-minute battle is 54,000 ticks; at the plan's own 10 ms budget a replay takes 9 minutes, at today's measured cost far longer | Full replay cannot verify a long battle in single player. Use a hash chain of checkpoints written as the battle runs and verify only the last segment; drop "replay from tick zero" for long battles (single player trusts the device anyway) |
| 5 eras | The roadmap on `claude/ancient-world` (plans/ROADMAP.md) decided 9 ages (Neolithic to Future, robot armies) | Every "x 5 eras" count is low: 30 unit profiles become 54, 78 prefabs become about 140. Key the RTS catalogs by the age registry (`src/data/ages.js`) from day one |
| 240 nations, any city | The roadmap decided new games have 24/36/42 majors plus independent cities that raid and sack | The RTS plan has no case for raids and sacks by independents, which will be the most common fights. A raid is a 5-minute field or sack battle, not a 45-minute siege |
| City structures can be re-exported from Blender sources | Our town GLBs are assembled by our own script, `scripts/blender/assemble_kit_towns.py`, which places every house module from the kits | Much cheaper than the plan says: make the assembler also write a per-town component manifest (module id, transform, footprint). No reverse engineering of merged GLBs |
| Exact building-for-building parity map to battle | On the map a whole city is one assembled town model shown inside a 77 km hex at an exaggerated map scale; the battle area is 0.5 to 1.5 km | Parity of the logical roster (same houses, same landmarks, same damage) is achievable; parity of positions needs one documented scale transform. Keep it, but as the manifest contract, not "identical placement" |
| Siege rules | The macro game already has sieges (`src/engine/sieges.js`: walls HP, encirclement, falls) and field battles (`fieldBattle.js`) | The plans must say when a commanded city battle happens relative to the macro siege (only on assault, after walls are worn down, which is what makes the battle short) and feed the battle result back into `sieges.js`, not beside it |
| Unit animations from Blender clips | `gltfUnitLoader.js` converts a pose into a rigid shader rig; GPT's deliveries are static models | Worker gather/build animations need a new pipeline (vertex animation textures). Decide it before commissioning any unit art |

## 4. Design criticism

1. **Pacing.** A 240-turn game has dozens of city captures. At 20 to 35 minutes each that is
   10 to 20 hours of base-building on top of the campaign; the plan admits it (4.3). Total War,
   the closest genre match, has no economy inside battles for exactly this reason. Base-building
   should be an opt-in "great siege" for capitals and wonders, not the default for every city.
2. **1,000 individuals on a 844x390 screen** cannot be commanded one by one. The control unit
   must be the regiment (box select regiments, regiment cards), with individuals as sim entities
   only. The plan says this in passing (groups); make it the rule, and size the default to what
   the screen can show: about 20 regiments a side.
3. **Two economies.** The four battle resources plus campaign gold, manpower, copper, iron and
   oil, plus regular vs auxiliary recruit pools, is a lot for a phone player. Cut to two battle
   resources (supplies, materials) in the first version and one recruit pool (regulars, paid
   from campaign escrow).
4. **No early fun milestone.** M1 is a stress sandbox, M2 an economy sandbox, M3 a ledger; the
   first playable siege is M4. Put a playable destructible-city siege first (section 9, phase B).
5. **The world plan wants true 3D terrain** (height mesh, one depth buffer) while the map is a
   flat SVG plus raster plus an orthographic overlay. That is a renderer rewrite. It should be
   the same decision as section 7 (drop the globe, one WebGL map), not a separate track.
6. **Missing:** naval and amphibious beyond "later", the independent raids and sacks, AI-vs-AI
   battles near the player (shown or abstract), what the player sees of fog in battle vs on the
   map (one rule), accessibility of tiny units on phones, and save size across many pending
   battles.

## 5. Speed today (measured and read from code)

| Where | Today | Cost |
|---|---|---|
| Turn | `resolveTurn` runs on the main thread in the reducer (`gameReducer.js:83`); 136 to 330 ms a turn (plans/math/perf.md, combined.md) | The UI freezes for each turn; long on phones |
| Start | `tiles.json` 8.2 MB is a static import in the main bundle (main chunk 6.1 MB) | Slow first load, memory on phones |
| Pan and zoom, flat map | SVG: about 4,500 territory paths, a band and clipPath per nation, one badge per city; `pathElements`, bands, war borders and badges depend on `zoomK`, so every zoom step rebuilds them; `glyphElements` scans all 100,002 tiles on every pan frame at hex zoom (`cityFeatures.js:146`) | Jank while panning; grows with more hexes |
| Close view | Layout effect runs on every transform: scans all cities, `landTilesOnScreen` scans all 29,250 land tiles (`landscape.js:47`); `townGapUnits` does a 3-ring search per town per frame, also in `CityBanners` | Hundreds of ms of scripting per second of panning |
| Globe | `react-globe.gl` chunk 1.32 MB; a 4096x2048 canvas texture fully repainted on any ownership, war, selection or lens change; markers are DOM elements; default view | Slow, blurry close up, duplicate code for every map feature |
| Fog | `sight.js` computes visible tiles but nothing remembers explored tiles and no renderer reads it | Everything is drawn everywhere, always |

## 6. The speed plan: fog of war and drawing only what you see

The idea the user named is how Civilization and Age of Empires stay fast: the world you have not
found is black, the world you found but cannot see is a frozen picture, and only the part you can
see right now is alive. It is good design (exploration matters again) and the biggest speed win.

### 6.1 Rules (engine, `add-mechanic`)
- Per nation, a bitset of **explored** tiles (`Uint8Array`, 100 kB, saved run-length encoded)
  and the **visible** set from `sight.js` each turn. Explored grows from visible.
- A per-tile **last seen** snapshot for the player only: owner, city size and tier, improvement,
  turn seen. Updated only for visible tiles at end of turn.
- AI uses the same explored set for settling and war targets (it already reads `canSeeTile`);
  the sieges dice rule stays.
- Starting knowledge: your land plus a radius (era maps, trade and alliances share explored
  tiles; a tech, Cartography, reveals coasts). Options: "explored world" for those who want the
  old look.

### 6.2 Rendering
- **Unexplored:** one dark parchment fill, no territory, no city, no hex glyph, no tree, no
  model, no raster detail beyond the base world image. Drawn as one mask, not per tile.
- **Explored, not visible:** territories and cities from the last-seen snapshot, desaturated,
  no animation, no units, no close-view trees or works (towns only, static).
- **Visible:** everything as today.
- This alone removes most of the world from the draw lists early in a game. Late in a game, the
  next points do the work.

### 6.3 Draw only what is on screen
- A **spatial index** for tiles and cities (the `tileIndex.js` start, a grid of 10 degree
  cells): every "on screen" query visits only the cells in view. Replaces the full scans in
  `landTilesOnScreen`, `landTilesWithin`, CityBanners and the close-view layout.
- **Cache per camera cell, not per frame:** placements (trees, works, town room and gap) are
  computed once per tile and stored; panning only moves them. `townGapUnits` cached like
  `townRoomUnits`.
- **Zoom by transform, rebuild on settle:** during a pinch or wheel zoom, scale the existing SVG
  or canvas; rebuild paths and badges once the zoom stops (150 ms debounce).
- **Render on demand:** no continuous animation loop when nothing moves; draw on camera, state
  or animation change only (saves battery).
- **Level of detail by zoom:** far: nation fills and capitals only; middle: city territories and
  badges; close: hexes, glyphs, 3D. Never all at once.

### 6.4 Move work off the main thread
- Run `resolveTurn` in a Web Worker (the battle already has one): the UI stays responsive and
  shows "the world moves" progress. The engine is pure and seeded, so this is a transport change.
- Load `tiles.json` as a fetched, compressed binary (typed arrays: land, terrain, neighbours)
  instead of an 8.2 MB JSON in the main bundle; decorate in the worker.

### 6.5 Measured gates (per phone and desktop, 844x390 and 1920x1080)
- Pan at middle zoom: 55+ fps desktop, 30+ phone; no frame over 50 ms.
- End turn: UI never blocks more than 50 ms; turn under 150 ms desktop at turn 100.
- First load to playable: under 5 s on a mid phone on 4G after cache.

## 7. Decision: drop the globe

Recommendation: **drop the globe as a play view.** Make the flat map the one map, with
horizontal wrap-around (east and west edges join, as in Civilization). Keep a small decorative
spinning globe only on the title screen if wanted (a static texture, no game data).

Why:
- Every map feature is built twice or only on the flat map (hexes, roads, glyphs, the whole 3D
  close view, banners, settlers are flat-only today). The globe is already the poorer view.
- It is the default view, so new players see the weakest picture first.
- Its 4096x2048 texture is blurry close up and costly to repaint; markers are DOM elements.
- It costs a 1.32 MB chunk and a second render path for every feature to come (fog, lenses).
- Drawing the hex grid and 3D models on a sphere well is a large project with no gameplay gain.

What we lose and how to keep it: the "real Earth" feeling at world zoom. Keep it with the
realistic raster at far zoom on the flat map, a gentle curvature shader at the farthest zoom if
wanted, and the title-screen globe. Polar areas are stretched on a flat map; use the current
projection's limits and keep Antarctica as a strip, as Civilization does.

Steps: make flat the default; remove the toggle; delete `GlobeView`, `politicalTexture` and
`react-globe.gl` after one release with the toggle hidden; add wrap-around panning.

## 8. Other speed points in the plans themselves

- Battle: the RTS plan's budgets are right; the measured kernel says build the new kernel first
  and stop the project if a mid phone cannot hold 300 a side at 30 fps.
- Default battle size: start at 200 to 300 entities a side (what a phone screen can command),
  with 500 and 1,000 as measured presets for desktop.
- Snapshots every 30 s, not full replays; hash chain for integrity.

## 9. Revised order of work

| Phase | What | Why first | Size |
|---|---|---|---|
| A. Map speed and fog | 6.1 to 6.4: explored and last seen, fog rendering, spatial index, cached placements, zoom by transform, render on demand, turn in a worker, binary tiles | The campaign map is what everyone plays every turn; fog is also gameplay | 3 to 4 sessions |
| A2. One map | Section 7: flat default, wrap-around, globe removed | Halves the cost of every later map feature | 1 to 2 sessions |
| B. Destructible city siege (no economy) | Town assembler writes a component manifest; battle loads the real city's houses, walls and landmarks with HP and ruins; damage persists to the map; existing squads and AI; north kept, real approach side | The visible win of both plans, on today's battle system, in weeks | 3 to 4 sessions |
| C. Battle kernel go/no-go | New packed sim with spatial buckets; 300, 500, 1,000 a side on a mid phone and desktop; hash chain checkpoints | Decides whether big armies are possible before any RTS art | 2 to 4 sessions |
| D. Big armies in today's battles | Regiments of 25 to 50 soldiers as real entities, regiment control, distant LOD and impostors | The "huge battles" wish, without base-building | 3 to 4 sessions |
| E. Great siege (optional economy) | Workers, two resources, a few buildings, regular recruits from escrow, only for capitals, wonders and chosen sieges | Optional depth for players who want it | 6 to 10 sessions |
| F. Terrain and world art | The world plan's terrain chunks, mountain chains, rivers, footprints, on the single WebGL map | After A2, on one renderer | ongoing |

Phases A and A2 can run beside the roadmap's W phases (they touch the renderer, not the rules).
B needs the town assembler and the art sessions. C is independent and can start at once.

## 10. Open questions for the user

1. Base-building in battles: every city assault (the plan), or only great sieges (this review)?
2. Default battle size on phones: about 300 a side (recommended) or 500?
3. Fog of war on by default, with an "explored world" option? (recommended yes)
4. Drop the globe now, or hide it behind a setting for one release first? (recommended: hide
   first, delete after)
