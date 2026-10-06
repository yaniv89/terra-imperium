# Terra Imperium art production plan

Date: 2026-10-06. Serves `plans/MASTER-PLAN.md` (the order of work and every decision). This file
says **what art each master-plan phase needs, in what order to make it, and to what spec**. It
does not re-plan art that is delivered or already queued: those stay in `plans/art/ITEMS.md`,
`plans/art/IMPLEMENTED.md` and `plans/art/production-queue.json`. Every new item here is also
appended to `production-queue.json` (source `plans/ART-PRODUCTION-PLAN.md`, batches `M01` to
`M29`), so the existing pipeline picks it up.

Rules that hold for every item (from the existing specs, repeated because they are the most
broken): no text or letters, no real national flags, emblems or coats of arms, no modern logos,
team colour authored neutral grey `#BFBFBF` with greyscale folds, 1 Blender unit = 10 m with the
front to -Y, and the phone in landscape (844x390) is the reference screen.

## 1. Summary

### 1.1 Counts

| | Items |
|---|---|
| Delivered and in the game (ITEMS.md Part A, plus checkpoints 01 to 13) | 618 of the old 752 (IMPLEMENTED.md) |
| Already queued, not finished (production-queue.json, old entries) | 90 (25 built awaiting upload, 65 pending) |
| **New in this plan** | **534** |
| of which 2D (icons, emblems, illustrations, sprites, textures, effects) | 293 |
| of which 3D (prefabs, damage states, walls, units, nodes, terrain kits, attachments) | 241 |
| **Batches** | **29** (M01 to M29), 12 to 25 items each |

New items per master-plan phase (P1 = the phase cannot start or looks broken without it; P2 =
needed before the phase is merged; P3 = polish or a later layer):

| Phase | New items | P1 | P2 | P3 |
|---|---|---|---|---|
| S | 0 | 0 | 0 | 0 |
| X | 0 | 0 | 0 | 0 |
| W0 | 179 | 4 | 78 | 97 |
| A | 7 | 6 | 1 | 0 |
| C | 1 | 0 | 1 | 0 |
| B | 38 | 7 | 16 | 15 |
| W1 | 16 | 4 | 4 | 8 |
| A2 | 13 | 5 | 3 | 5 |
| R1 | 63 | 23 | 39 | 1 |
| R2 | 33 | 10 | 17 | 6 |
| W2-4 | 14 | 0 | 14 | 0 |
| R3 | 21 | 2 | 13 | 6 |
| R4 | 125 | 12 | 77 | 36 |
| F | 24 | 7 | 17 | 0 |
| Balance | 0 | 0 | 0 | 0 |
| **Total** | **534** | **80** | **280** | **174** |

### 1.2 What exists (surveyed 2026-10-06 on `claude/bronze-towns`)

| Area | In the repo | Where |
|---|---|---|
| Towns | 390 town GLBs: base kit plus 11 regional kits in every age except europe/modern, levant/bronze, indic/gunpowder, indic/modern; Israelite in all five ages; sub-themes pacific, korea, japan, europenorth, easteurope, colonies | `src/assets/map/towns/` |
| Palaces, walls, camps, fields | shared files per age (base) and per region for Kingdoms (11 regions), Israelite for four ages | `src/assets/map/shared/` |
| Buildings | 35 (25 base of 34, plus the 10 Israelite) | `src/assets/map/buildings/` |
| Wonders | 17 (15 base, 2 Israelite), three tiers each | `src/assets/map/wonders/` |
| Tile improvements | 6 Israelite; the 13 base ones are built, awaiting upload | `src/assets/map/improvements/` |
| Icons | 129: ages 5, buildings 33, cities 15, improvements 11, markers 4, resources 35, ships 4, units 7, wonders 15 | `src/assets/icons/` |
| Battle units | none final: 21 disabled CC0 recipes plus the procedural soldiers (`soldierFactory.js`); the classical-infantry pilot script | `src/assets/units/`, `scripts/blender/build_classical_infantry.py` |
| Map raster | world-2048 and 4096 WebP, tile pyramid | `public/map/` |

### 1.3 What is missing (the gaps this plan fills)

| Gap | Phase | Items |
|---|---|---|
| People emblems, banner and pennant frames, theme and region icons, start screen art | W0 | 179 |
| Fog of war look | A | 7 |
| Destructible city: ruins, wall kits, damaged and ruined houses per age and theme | B, R4 | 38 + 52 |
| WebGL map plates, army markers, AI battle markers, route sprites | A2 | 13 |
| Battle economy: workers, HQ and camp, depots, farms, mines, production buildings, nodes, herds, vegetation, battle icons | R1, R4 | 63 + 60 |
| Battle kinds, Command or Auto, outcomes, captives, war score, generals, named-battle headers | R2 | 33 |
| Independents: personality shields and town dressing, tribal camps, raid and tribute icons, raiders, mercenaries | W1, W2-4, R3 | 16 + 14 + 10 |
| Forts and landings in battle; rivers, fords, bridges | R3, R4 | 11 + 5 |
| Map terrain: ground materials, mountains, rivers, coasts, town ground patches | F | 24 |

### 1.4 Already queued items the master plan needs (not re-planned, just ordered)

| Queued items (production-queue.json) | Needed by | Note |
|---|---|---|
| 26 battlefield units `units/<age>-<class>` (unit-art-brief v3) | R1 (the Bronze five), R4 (the rest) | **Change of order proposed**: the brief makes Classical first, then Kingdoms, Gunpowder, Bronze, Modern. Every new game starts in the Bronze age (master plan, Dawn start), so do Bronze right after the approved Classical pilot. |
| 5 forts `improvements/<age>/fort-<age>` | R3 (map fort and the battle fort are one source) | battle forts here (`battle-city/<age>/fort`) are cut from them |
| 5 settlers, 14 ships | map units now; naval battles later | not on the critical path |
| 11 Israelite units | R4 culture layer | the first theme skin of the units |
| 13 base tile improvements, 8 buildings, classical town-big (built, awaiting upload) | the map now; farm, fishing boats and mine also feed R1 | upload them first, they unblock `farm-plot`, `fishing-boat-*`, `mine` |
| 4 kit items (steppe/modern houses, street, roofscape; indic/modern materials) | B, R4 (their houses get damage states) | |

### 1.5 The order

1. **M01 to M02** (2D, fast with AI image tools): start screen, frames, fog, theme icons. Unblocks W0 and A.
2. **M03**: the Bronze destructible city (ruin libraries and wall kits for all ages, Bronze houses for every theme). Unblocks B.
3. **M04 to M06**: the Bronze battle economy, nodes and battle icons. Unblocks R1 (with the five Bronze units from the old queue).
4. **M07, M12, M18, M22, M26, M29**: emblems in six batches of 25, interleaved; the game draws a coded placeholder emblem until each lands.
5. **M08 to M13**: map markers (A2), independents (W1 to W4), battle UI and generals (R2), raiders, mercenaries and forts (R3).
6. **M14 to M24**: rivers and first terrain, then the four later ages' battle sets and houses (R4), one age at a time.
7. **M25 to M28**: the rest of the independents dressing, map terrain (F) and the wonder ruins.

Bronze comes first everywhere: the default start is 2000 BCE, so the first battles, towns and
independents every player meets are Bronze. A batch can start before the code phase it serves;
art never waits for code, only the in-game check does.

## 2. Art needed per master-plan phase

Phase order of MASTER-PLAN section 7. Item ids are listed in full in section 5.

### S: settle rules
No art. The settle rules change where cities go, not how they look.

### X: remove succession and the noble estates
No new art. The estate and succession UI goes away; no icon is needed in its place.

### W0: peoples, names, start screen
| Items | Why | Placeholder |
|---|---|---|
| 150 people emblems `peoples/emblems/<slug>` | The picker shows a colour dot and the theme icon per people; diplomacy lists, the nation sheet, map banners and the flag all need one mark per people | yes: code draws a seeded emblem (a simple charge on the shield) until the SVG lands |
| Frames: `peoples/frames/shield`, `banner`, `pennant` | The **flag is not drawn per people**: code prints the emblem mask on the grey banner cloth tinted with the nation colour. One frame set serves all 150 | yes (flat colour rectangle) |
| 15 theme icons `icons/themes/<theme>` | The picker row "name, colour dot, theme icon" (peoples 3.3) | yes (the age icon) |
| 6 region filter icons `icons/regions/*` | The picker's region filter | yes (text chips) |
| Start screen: 2 backgrounds, 3 world size cards | The new start screen (peoples 3.1, 3.2) on desktop and on a phone in landscape | yes (the current dark background) |

### A: fog of war and map speed
| Items | Why | Placeholder |
|---|---|---|
| `fog/style-frame` | One approved picture of the three states before anything else is made | no |
| `fog/unexplored-mask`, `fog/unexplored-edge` | Unexplored land is one dark mask with a soft edge (master 5.2) | yes (flat dark fill) |
| `fog/last-seen-lut` | Explored but not visible: last-seen territories and **greyed, static towns** | yes (a plain desaturate in the shader) |
| `icons/markers/last-seen`, `icons/markers/unknown-people`, `peoples/emblems/unknown` | "Unknown people" until contact; last-seen stamps on greyed town badges | yes |

### C: battle kernel go/no-go
| Items | Why | Placeholder |
|---|---|---|
| `units/impostors/classical-infantry-lod3` | C measures 300, 500 and 1,000 a side on a mid phone; the measurement is only honest with a real LOD chain down to impostors | yes: the procedural soldiers are enough to start; the impostor set makes the numbers final |

### B: city manifest, destructible city
| Items | Why | Placeholder |
|---|---|---|
| 5 ruin libraries `battle-city/<age>/ruin-library` | Every building without its own ruin (landmarks, buildings, palaces) uses the age's rubble sized to its footprint; scorch and fire sockets for the damaged stage | yes (grey rubble mound) |
| 5 wall kits `battle-city/<age>/wall-kit` | The map's wall rings become targetable segments, towers and gates (world plan 7, RTS 6.2) | yes (the ring split by code, no damage states) |
| 13 Bronze `houses-damage` (base kit plus 12 kit themes) | Houses lost in battle are the houses lost on the map (master 6.3, 6.8); they need damaged and ruined states | yes (the intact house tinted dark, then the ruin library) |
| 15 wonder ruins | A wonder in a besieged city is an objective; its ruin must stay recognisable | yes (ruin library), P3 |

The town assembler writing components (house ids, positions) is code, not art. Where a town's
houses come from a build script (`scripts/blender/ti_*.py`), an agent can produce the damaged and
ruined houses by script with no new concept art.

### W1: passive independents
| Items | Why | Placeholder |
|---|---|---|
| 4 personality shields `icons/independents/<personality>` | Map badges of independents (independents 7: horse, coin, tower, totem) | yes (letters are not allowed; a plain dot by personality colour) |
| 12 town dressings `independents/<band>/<personality>-dressing` | An independent's town is the land theme's town; a few props round it say "raiders" or "fortress" at a glance | yes (no dressing) |

### A2: one WebGL map, globe hidden
| Items | Why | Placeholder |
|---|---|---|
| `map-markers/badge-plate`, `army-base`, `route-dots` | Badges, banners and army markers become instanced sprites (review 6.5) | yes (flat shapes) |
| `map-markers/ai-battle-clash`, `ai-battle-smoke`, `battle-result` | AI vs AI battles are always Auto, shown in sight as markers (master 6.1) | yes (the existing `battle` marker icon) |
| `icons/markers/siege`, `sea-battle` | Siege and sea battle on the map | yes |
| 5 army standards per age | Army markers read their age | yes (the pennant), P3 |

### R1: RTS economy
| Items | Why | Placeholder |
|---|---|---|
| Bronze set (15): worker, town hall, expedition camp, construction set, food depot, materials yard, trade post, farm plot, mine, barracks, range, stable, siege workshop, aid post, tower | Workers, three resources, village houses and the housing cap, construction, training (master 6.3, 6.4). Village houses reuse the kit houses (they exist); only their construction stages are new | yes for all but the worker and the town hall (greyboxes with the right footprint and sockets) |
| 3 resource icons `icons/battle/resource-food`, `-materials`, `-gold`; population; worker class icon | The battle resource bar and housing cap (decision 35) | no for the three resources (they are the whole economy UI) |
| Nodes: stone, ore, gold, fish shoal; herds (sheep and goats, cattle); 6 vegetation kits; 2 fishing boats | Wood, stone, ore, gold, food from farms, fishing and herds | yes (primitive shapes) |
| 16 build icons, 13 command icons | Build menu and command bar on 844x390 | yes (lucide glyphs) |

R1 builds the economy in one age. Bronze is the pilot age (every game starts there); the other
four ages' sets are R4.

### R2: campaign bridge
| Items | Why | Placeholder |
|---|---|---|
| `icons/battle/mode-command`, `mode-auto` | Command or Auto for every battle (decision 24) | no |
| 7 battle kind icons (siege, field, raid, sack, sally, landing, sea) | Named battles ("Siege of X") in the pre-battle screen, HUD, result and reports (master 4) | yes for the rarer kinds |
| 4 outcome icons, war score, intel, reinforcements, regular and auxiliary badges | The one outcome service (master 6.7 rows 1, 14, 16, 22; RTS 6.5 badges) | yes |
| 3 captives icons (captives, ransom, release) | Prisoners: ransom or release only (decision 37) | yes |
| 5 generals `units/<age>-general` | A general is a unit on the field with an aura that can die (master 6.7 row 5) | yes (the age's mounted unit with a banner) |
| 5 named-battle header plates, 2 result backdrops | The header behind "Siege of X" and the result screen | yes, P3 |

### W2, W3, W4: independent AI, interactions, UI
| Items | Why | Placeholder |
|---|---|---|
| 5 tribal camps by biome `independents/tribal-camp-*` | Shared exploration: maps from tribal camps (master 5.1) | yes (colony-camp) |
| 8 icons: raid torch, raze, tribute, grudge, submit, trade pact, hire mercenaries, mercenary contract | The independent sheet's actions as 44 px buttons, raid warnings (independents 7) | yes |
| `fx/map/burning-town` | Razing burns a city one size a turn; sacks | yes |

### R3: every battle kind, independents in battle
| Items | Why | Placeholder |
|---|---|---|
| 5 raiders `units/<age>-raider` | Raids and sacks: raiders loot and leave by an exit (master 6.5) | yes (the age's mounted unit) |
| 5 mercenaries `units/<age>-mercenary` | Hired units in battle (master 6.7, decision 38) | yes (the age's infantry with a badge) |
| `props/loot-sack`, `props/exit-marker`, `props/burnt-field-overlay` | Raid loot, exits, pillaged fields | yes |
| 3 landing sets `props/landing-*` | Landings as city assaults from the shore | yes |
| 5 battle forts `battle-city/<age>/fort` | Forts start battles and stand on the battle map (decision 34, master 6.9) | yes (wall kit pieces in a square) |

### R4: the five ages in battle
| Items | Why | Placeholder |
|---|---|---|
| 4 ages x 15 battle sets (Classical, Kingdoms, Gunpowder, Modern) | One functional set per age (RTS 7.1, 14.3) | yes (the Bronze set) |
| Modern generator, airfield, radar and AA | Modern additions (RTS 6.3) | yes |
| 4 ages x 13 `houses-damage` | Every age's houses destructible | yes (ruin library) |
| 5 projectile and hit sets `fx/projectiles-<age>` | The age's weapons read in battle | yes (current effects) |
| River kit, ford, 3 bridges | Rivers with fords and bridges on the battle map (master 6.9) | no for the ford (it is the chokepoint) |
| The 21 non-Bronze units of the old queue | The rosters | procedural soldiers |

### F: terrain, mountains, rivers, footprints on the WebGL map
| Items | Why | Placeholder |
|---|---|---|
| 8 ground materials | Blended terrain on the close map and the battle (world plan 6, 12) | yes (the raster) |
| 8 geographic mesh kits (hills, ridges, cliffs, dunes, coasts, rivers, lakes, wetlands) | Mountain chains, rivers, coasts (world plan 5) | yes (the raster) |
| 3 infrastructure kits (roads, field edges, shore and harbour) | Shared connectivity map and battle | yes |
| 5 town ground patches | Terrain-conforming ground under towns, replacing flat bases (world plan 6) | yes (today's base) |
| The 6 vegetation kits (made in R1) | Forests by biome, canopy impostors at distance | from R1 |

Footprint fitting (world plan 4) is code: the models already fit the round tile footprints of
`blender-delivery-spec.md` 1.7.

### Independents, all phases together
| Phase | Items |
|---|---|
| W1 | 4 personality shields, 4 early-age town dressings (8 middle and modern dressings in M25) |
| W2-4 | 5 tribal camps, 8 icons, the burning town effect |
| R3 | 5 raiders, 5 mercenaries, loot sack, exit marker, burnt fields |
| Late peoples (Lapita, Bau, Merina...) arrive as independents: they use their land's theme, no extra art | |

### Balance
No new art. Playtests will produce fix lists; those go into the queue as revisions of existing
ids, not new items.

### Later (not in this plan)
Nine ages (decision 32: after their art exists), naval battles (dock sets and the 14 queued
ships), garrisonable houses, culture skins of the battle sets (section 3), theme units beyond
the Israelite set.

## 3. Production matrix: age x theme

**Shared across every theme (one functional set per age, RTS 14.3):** units and workers,
generals, raiders, mercenaries, battle buildings (town hall, camp, depots, production, tower),
construction sets, ruin libraries, wall kits, forts, nodes, herds, vegetation, effects, icons,
emblem frames. So a barracks reads as a barracks in every culture.

**Per theme:** town kits (exist), palaces (Kingdoms per region; Israelite in four ages), the
damaged and ruined houses (one item per kit theme and age, here), emblems (per people).

**Later layer, per theme:** culture skins of the battle sets (roofs, doors, walls and banners
swapped from the theme's kit materials), theme units. Not counted here; when it comes, follow
the theme priority below, and only for the shared buildings players see most (town hall,
houses are already themed, barracks, tower).

Cells: `kit` = the theme's town kit exists in that age; `no kit` = missing (it falls back to the
base kit until it lands, and its damaged houses wait for it); `parent` = the sub-theme uses its
parent's houses. `Mxx` = the batch with that cell's damaged and ruined houses.

| Theme (pool count) | Bronze | Classical | Kingdoms | Gunpowder | Modern |
|---|---|---|---|---|---|
| shared functional set | M03 to M06 | M14 to M16 | M17, M19 | M20, M21 | M23, M24 |
| base kit (fallback for all) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| europe (24) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | no kit, M24 |
| americas (19) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| levant (18) | no kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| steppe (16) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| indic (13) | kit, M03 | kit, M16 | kit, M19 | no kit, M21 | no kit, M24 |
| monsoon (12) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| eastafrica (9) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| maghreb (8) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| sinic (8) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| nile (6) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| westafrica (6) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |
| pacific (5) | parent (monsoon) | parent | parent | parent | parent |
| korea (3) | parent (sinic) | parent | parent | parent | parent |
| japan (2) | parent (sinic) | parent | parent | parent | parent |
| israelite (1) | kit, M03 | kit, M16 | kit, M19 | kit, M21 | kit, M24 |

Counts that keep this sane: 5 shared sets of about 22 items (not 5 x 15 themes); 13 house kits
per age (not 15, the sub-themes share); one emblem per people; flags drawn by code from the
emblem and the colour.

## 4. Specs per asset class

The existing specs stand; this section writes only the deltas. Base documents:
`plans/art/blender-delivery-spec.md` (3D delivery, the quality bar), `plans/art-image-spec.md`
(2D sheets, icons section 8), `plans/unit-art-brief.md` (units v3), `plans/model-brief-for-claude.md`
(LOD bands), `plans/art/AGENT_BRIEF.md` (agents building in Blender by script).

### 4.1 Budgets for 300 a side on a mid phone

The scene at the default battle zoom: up to 600 soldiers, about 100 workers, up to 500 city
structures. Budgets per item are set so the whole scene stays inside these totals (C measures
them; if C fails, these numbers change before R1, never silently).

| Scene total (mid phone, 844x390) | Budget |
|---|---|
| Unit triangles drawn | 350,000 |
| Building and wall triangles drawn | 400,000 |
| Draw calls, whole battle | 150 (one instanced draw per unit type per LOD; one per building file per LOD) |
| Textures resident | 64 MB |

| Item | LOD0 | LOD1 | LOD2 | LOD3 | Texture |
|---|---|---|---|---|---|
| Person (unit, worker, general) | 1,500 | 500 | 150 | impostor, 2 triangles | none: flat colour per material (unit brief 4.1) |
| Mounted, chariot | 2,500 | 800 | 250 | impostor | none |
| Machine, vehicle | 3,000 | 1,000 | 300 | impostor | none |
| Battle building (S5) | 8,000 (town hall and camp 15,000) | 2,000 | 400 | | one 2048 atlas per age file |
| Kit house, damaged | 2,500 | 600 | 120 | | the kit's atlas |
| Kit house, ruined | 1,200 | 300 | 80 | | the kit's atlas |
| Wall segment, tower, gate | 1,500 each | 400 | 80 | | the age's wall atlas |
| Resource node | 1,500 | 300 | 80 | | one 1024 atlas for all nodes |
| Tree | 600 | 150 | impostor | | one 1024 atlas per vegetation kit |

LOD1 and LOD2 of buildings come from the importer (blender-delivery-spec 1.6); units deliver all
four (unit brief, plus the LOD3 impostor rendered by `scripts/blender/render_sprites.py` with 8
directions at 64 px). Instancing needs identical meshes: no per-copy edits, variety through the
two kit variants and the skin mask only.

### 4.2 Folders, naming, game paths

Delivery folders follow `plans/art/<id>/` (the ids of section 5), as the blender spec does.

| Class | Delivery files in `plans/art/<id>/` | Game path (new folders are wired by the phase's code session) |
|---|---|---|
| S1 icons | `source.svg`, `<id>.png` 256, `<id>-mask.png` | `src/assets/icons/<group>/<name>.svg` via `scripts/icons/import-ui-icons.mjs` |
| S2 emblems | `source.svg` (one path, white), `preview.png` on three nation colours | `src/assets/peoples/emblems/<slug>.svg` (new) |
| S3 illustrations | `<id>.webp`, the layered source | `public/ui/<id>.webp` (new, not bundled) |
| S4 map sprites | frames as PNG plus `sheet.json` (frame size, count, fps) | `src/assets/map/sprites/` (new; code packs the atlas) |
| S5 battle buildings | `model.glb`, `model.blend`, `preview.png`, `build.py` if scripted | one file per age: `src/assets/battle/rts/rts-<age>.glb`, an object per role (new) |
| S6 damage states | the same, objects `<name>`, `<name>-damaged`, `<name>-ruined` | `src/assets/battle/city/<age>-<theme>-houses-damage.glb`, `ruins-<age>.glb` (new) |
| S7 walls, forts | the same, objects `wall-straight`, `wall-corner`, `tower`, `gate-open`, `gate-closed`, each with `-damaged` and `-breached` | `src/assets/battle/city/walls-<age>.glb`, `fort-<age>.glb` (new) |
| S8 units | unit brief section 11 layout | `src/assets/units/<age>-<class>.glb` (exists) |
| S9 nodes, vegetation | `model.glb` with state objects (`full`, `half`, `depleted`; trees `tree-s`, `tree-m`, `tree-l`, `stump`, `felled`) | `src/assets/battle/nature/<id>.glb` (new; the map reads the same files) |
| S10 textures | `color.webp` (AO baked), `normal.png`, `orm.png`, 1024 tileable | `public/terrain/<id>/`, fog in `public/map/fog/` (new) |
| S11 terrain kits | `model.glb` with connector objects | `src/assets/map/terrain/<id>.glb` (new) |
| S12 effects | frames as PNG plus `sheet.json` | `src/assets/fx/<id>/` (new) |
| S13 map attachments | as blender spec 3.8 improvements | `src/assets/map/independents/<id>.glb` (new) |

Material names: buildings, walls, nodes, terrain kits use only `Town`, `Team`, `Ground`
(blender spec 1.4); units use the unit brief names (`Team`, `Skin`, ...). Sockets are glTF empties
named `socket-<kind>-<n>`: `socket-door` (where trained units come out, on the -Y side),
`socket-work-<n>` (where workers stand), `socket-banner`, `socket-fire-<n>`, `socket-smoke-<n>`.
Empties are allowed; cameras, lights and hidden meshes are not.

### S1. UI and map icons (SVG)
Base: `plans/art-image-spec.md` section 8 (256 px, thick outline, two or three flat colours, a
white mask). Deltas: deliver `source.svg` too (the importer ships it minified); check at 24 and
32 px on the dark panel and at 44 px as a phone button; battle icons are the same in every age
(the age shows in the art, not the icons).

### S2. People emblems (SVG)
- One motif per people from **that people's own material culture**: an animal, plant, tool,
  weapon or ornament seen in their archaeology or art (a winged disc, an ibex, a lotus, a double
  axe). Never a modern state flag, coat of arms or national symbol, never a religious symbol
  used today as a national emblem, never letters or numerals.
- One closed white silhouette on transparent, no holes thinner than 1/24 of the width, readable
  at 16 px inside the shield frame. Keep a log line per people: motif and source (museum or
  site).
- Neighbours must differ in silhouette, not only in colour (the colour comes from the nation).
- Made with AI image tools: generate on white, trace to one path (Inkscape trace or potrace),
  clean by hand; a 2D agent can do the tracing and the 16 px check.

### S3. Illustrations and UI plates (WebP)
No text. Phone versions are recomposed for 844x390 at 2x, not cropped. Keep the dark lower third
or the centre free where the UI sits (write which on the delivery). WebP quality 85, under 400 kB.

### S4. WebGL map sprites
Grey `#BFBFBF` where the nation colour goes. Frames 64 to 128 px, power of two sheets, 8 to 12
frames for loops at 12 fps. Readable on the fog mask and on the raster at middle zoom.

### S5. Battle building prefabs (GLB)
Base: blender-delivery-spec (scale, -Y front, materials, AO baked, quality bar 3b). Deltas:
- **Footprints**: small 8 to 10 m (tower, depot), medium 12 to 16 m (barracks, range, trade
  post, aid post, mine), large 18 to 24 m (town hall, camp, stable, siege workshop). No ground
  plate. The entrance faces -Y and stays clear: a unit must visibly walk out of `socket-door`.
- **One file per age**, an object per role (as the shared files do), one 2048 atlas.
- **States**: `<role>` (complete), `<role>-damaged`; construction uses the age's
  `construction-set` (foundation outlines for the three footprint sizes, scaffold stages 1 to 3);
  destruction uses the ruin library. Origin and footprint identical in every state.
- **Silhouette by role, the same in every age**: barracks = long hall with weapon racks; range =
  open yard with targets; stable = long low shed with a paddock; siege workshop = a tall open
  frame with a crane; depots show their goods (sacks, logs and stone, chests).

### S6. Damage and ruin states (GLB)
- **Damaged** (30 to 70% HP, and with fire sockets below 30%): the same silhouette with 10 to 30%
  broken (roof holes, a fallen corner, burnt beams, scorch), plus `socket-fire-*` and
  `socket-smoke-*`. Budget at most the intact one.
- **Ruined** (0 HP): walls down to 0.3 to 1 storey, rubble inside the intact footprint, no roof.
  Ruin footprint inside the intact one (the RTS plan's rule: never trap a unit).
- Kit houses: the damaged and ruined houses of a kit are made **by script** from the kit's
  builder in `scripts/blender/ti_*.py` (AGENT_BRIEF setup); new module `ti_damage.py` with a
  wrapper per kit, never edits to the shared modules. Kits without a script (delivered as GLBs
  only) are done in Blender by hand or by an agent from the GLB.
- Ruin library per age: `rubble-s`, `rubble-m`, `rubble-l` (8, 14, 24 m), `beams`, `scorch`
  (a decal plane), in the age's materials.

### S7. Wall kits and forts (GLB)
Cut from the age's existing wall rings (`src/assets/map/shared/shared-<age>.glb` and the
regional Kingdoms walls) so the battle walls match the map exactly. Segment length 10 m (1 unit),
towers and gates as their own objects (blender spec 3.5 already asks for it). States intact,
damaged, breached (a gap a regiment can pass). Forts: the map fort of the same age plus wall kit
pieces, a garrison house and a gate; the fort footprint fits a 50 m circle like an improvement.

### S8. Battle units (GLB and sprites)
Base: `plans/unit-art-brief.md` v3, all of it. Deltas:
- **Workers** (one per age): Archetype H body, clips `Idle`, `Walk`, `Run`, `Carry`, `Chop`,
  `Mine`, `Harvest`, `Build`, `Repair`, `Deposit`, `Hit`, `Death` (RTS 14.4). Carried goods as
  a `prop` bone child swapped by code (basket, log, stone, ore, sack).
- **Generals**: the age's mounted body with a cloak and a standard bearer as a second figure;
  Modern a command car. The aura ring is code.
- **Raiders and mercenaries**: kit variants of the age's mounted unit and infantry (brief 3.5),
  the same rig and clips; mercenaries wear foreign gear and a coin badge in `Team`.
- **LOD3 impostor** for every unit: 8 directions, 64 px, from `render_sprites.py`.
- The brief's crowd numbers (12 per infantry squad) become regiments of up to 50 at 300 a side
  (master 6.2): no change to the model, only to how many the game draws.

### S9. Resource nodes, herds and vegetation (GLB)
Footprints: node 4 to 8 m, tree 3 to 8 m, herd animals at real size. States as separate objects
(`full`, `half`, `depleted`); a depleted node leaves a low stump or pit that does not block.
Herds: rigid animals with `Idle`, `Walk`, `Graze`, `Death` (as the unit brief's horse rig, fewer
bones). Vegetation kits serve both the map close view (with a canopy impostor object) and the
battle. One 1024 atlas for all nodes; one per vegetation kit.

### S10. Textures: terrain, fog, ground (WebP)
Tileable 1024, colour with baked AO (sRGB WebP), normal (PNG), ORM (occlusion, roughness,
metalness). Checked tiled 4x4 for repeats. Fog textures are greyscale where code tints them.
Town ground patches are round with a soft masked edge (blender spec 1.7), never a square.

### S11. Terrain and river mesh kits (GLB)
World plan sections 5 and 6: chains not single mountains, shared edge connectors, shores and
river banks that meet the next tile's at the same crossing points. Battle rivers: banks, shallow
(ford) and deep water as separate objects; bridges with `-damaged` and `-destroyed` states and
their two ends marked by `socket-end-a`, `socket-end-b`.

### S12. Effects (sprite sheets)
Frames 64 to 256 px, 8 to 16 frames, additive or alpha stated in `sheet.json`. Smoke and fire
are visual only (world plan 10). No gore (unit brief 1).

### S13. Map attachments (GLB)
As tile improvements (blender spec 3.8): fits a 50 m circle, round soft ground edge, 8,000
triangles. Independent dressing is props only (placed round the land-theme town by code), no
town of its own.

### 4.3 Delivery checklist (every item)
1. Id folder and file names as section 4.2; only the allowed material names; team parts grey.
2. Within the budgets of 4.1; front to -Y, origin at the footprint centre at Z = 0 (3D).
3. No text, real flags, emblems on 3D, logos; no gore.
4. `preview.png` at the game camera (blender spec 3b point 13); icons and emblems at 24 px and
   on three nation colours.
5. Validation: `python3 scripts/blender/validate_model.py <glb> <out> '<json spec>'` for 3D
   (use kind `landmark` for prefabs and nodes until the R1 code session adds `prefab`, `ruin`
   and `node` kinds); `validate_unit.py` and the unit brief's section 8 for units.
6. A `LOG.md` row: triangles per LOD, footprint, size, the AI tools used and the prompt (for
   provenance), anything not matched.
7. Set the item's `delivery_status` in `plans/art/production-queue.json`.

### 4.4 How to check it in the game
| Class | Check |
|---|---|
| Icons, emblems | Import, `npx vite`, look on the phone layout (844x390) and desktop; `GameIcon` shows its fallback where art is missing |
| Map models, attachments, terrain | `import_model.py`, then `npm run pack:models` (meshopt), then `/?tileViewer` close view; `node scripts/art/town-tone.mjs` for anything placed in towns |
| Damage states, walls, battle buildings | `/?battleSandbox`; the `battle-lab` skill takes a browser screenshot of a live battle and lists console errors |
| Units | `npm run import:models`, `/?battleSandbox`, a squad at default zoom on a phone |
| Fog, WebGL map sprites | the phase's own preview page once A and A2 land; until then the style frame is the check |

### 4.5 Who makes what (automate first)
| Class | Best made by |
|---|---|
| S1, S2, S3, S4, S12 | AI image tools, then a 2D agent traces, sizes and checks |
| S5, S7, S13 | concept sheet (art-image-spec 2.1 views) by AI image, then a Blender agent (AGENT_BRIEF workflow) |
| S6 kit houses, ruin libraries, construction sets, wall kits | a Blender agent by script from the existing kit builders: no concept art needed |
| S8 | the unit brief pipeline (2D, then Blender, rig, clips, sprites) |
| S9, S10, S11 | AI tileable textures and AI image to 3D for rocks and trees, cleaned to budget in Blender by an agent |

## 5. Batches

Each batch is sized like the existing checkpoints (about 20 items). In the queue the batch is
`M<nn>`. Priorities and placeholders as in section 2.

| Batch | Title | Items |
|---|---|---|
| 01 | Start screen frames and fog of war (W0, A) | 21 |
| 02 | Theme icons and the first emblems (W0) | 20 |
| 03 | Bronze destructible city: ruins, wall kits, Bronze houses (B) | 23 |
| 04 | Bronze battle economy and resource icons (R1) | 20 |
| 05 | Resource nodes, herds, vegetation (R1) | 18 |
| 06 | Battle build and command icons (R1) | 25 |
| 07 | Emblems 1 (W0) | 25 |
| 08 | WebGL map markers and independent shields (A2, C, W1) | 18 |
| 09 | Independent towns and tribal camps (W1, W2-4) | 12 |
| 10 | Battle kinds, Command or Auto, outcomes, captives (R2) | 21 |
| 11 | Generals, battle headers, remaining independent icons (R2, W2-4) | 18 |
| 12 | Emblems 2 (W0) | 25 |
| 13 | Raiders, mercenaries, forts, landings (R3) | 21 |
| 14 | Rivers, fords, bridges and the first map terrain (R4, F) | 14 |
| 15 | Classical battle economy and buildings (R4) | 15 |
| 16 | Classical houses, damaged and ruined (R4) | 13 |
| 17 | Kingdoms battle economy and buildings (R4) | 16 |
| 18 | Emblems 3 (W0) | 25 |
| 19 | Kingdoms houses, damaged and ruined (R4) | 13 |
| 20 | Gunpowder battle economy and buildings (R4) | 16 |
| 21 | Gunpowder houses, damaged and ruined (R4) | 13 |
| 22 | Emblems 4 (W0) | 25 |
| 23 | Modern battle economy and buildings (R4) | 19 |
| 24 | Modern houses, damaged and ruined (R4) | 13 |
| 25 | Independent towns, middle and modern ages (W1) | 8 |
| 26 | Emblems 5 (W0) | 25 |
| 27 | Map terrain, the rest (F) | 17 |
| 28 | Wonder ruins (B, polish) | 15 |
| 29 | Emblems 6 (W0) | 20 |

### Batch 01: Start screen frames and fog of war (W0, A)

21 items. Phases: W0, A.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `ui/start/background-wide` | Start screen background, desktop | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P1 | yes |
| `ui/start/background-phone` | Start screen background, phone landscape | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P1 | yes |
| `ui/start/worldsize-small` | World size card art: small | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P2 | yes |
| `ui/start/worldsize-standard` | World size card art: standard | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P2 | yes |
| `ui/start/worldsize-large` | World size card art: large | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P2 | yes |
| `icons/regions/neareast` | Region filter icon: Near East | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/regions/europe` | Region filter icon: Europe | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/regions/africa` | Region filter icon: Africa | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/regions/asia` | Region filter icon: Asia | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/regions/americas` | Region filter icon: Americas | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/regions/oceania` | Region filter icon: Oceania | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `peoples/frames/shield` | Emblem shield frame | W0 | [S2](#s2-people-emblems-svg) | P1 | yes |
| `peoples/frames/banner` | Nation banner cloth | W0 | [S3](#s3-illustrations-and-ui-plates-webp) | P1 | yes |
| `peoples/frames/pennant` | Map pennant | W0 | [S4](#s4-webgl-map-sprites) | P2 | yes |
| `fog/style-frame` | Fog of war style frame | A | [S3](#s3-illustrations-and-ui-plates-webp) | P1 | no |
| `fog/unexplored-mask` | Unexplored mask texture | A | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | yes |
| `fog/unexplored-edge` | Unexplored edge strip | A | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | yes |
| `fog/last-seen-lut` | Last-seen colour grade | A | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | yes |
| `icons/markers/last-seen` | Last-seen marker | A | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/markers/unknown-people` | Unknown people marker | A | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `peoples/emblems/unknown` | Emblem: unknown people | A | [S2](#s2-people-emblems-svg) | P1 | yes |

### Batch 02: Theme icons and the first emblems (W0)

20 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `icons/themes/europe` | Art theme icon: europe | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/americas` | Art theme icon: americas | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/levant` | Art theme icon: levant | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/steppe` | Art theme icon: steppe | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/indic` | Art theme icon: indic | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/monsoon` | Art theme icon: monsoon | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/eastafrica` | Art theme icon: eastafrica | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/maghreb` | Art theme icon: maghreb | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/sinic` | Art theme icon: sinic | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/nile` | Art theme icon: nile | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/westafrica` | Art theme icon: westafrica | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/pacific` | Art theme icon: pacific | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/korea` | Art theme icon: korea | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/japan` | Art theme icon: japan | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/themes/israelite` | Art theme icon: israelite | W0 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `peoples/emblems/israel` | Emblem: Kingdom of Israel | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/keftiu` | Emblem: Keftiu | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/ahhiyawa` | Emblem: Ahhiyawa | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/odrysia` | Emblem: Odrysia | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/dacia` | Emblem: Dacia | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |

### Batch 03: Bronze destructible city: ruins, wall kits, Bronze houses (B)

23 items. Phases: B.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/bronze/ruin-library` | Bronze ruin library | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |
| `battle-city/classical/ruin-library` | Classical ruin library | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/kingdoms/ruin-library` | Kingdoms ruin library | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/gunpowder/ruin-library` | Gunpowder ruin library | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/modern/ruin-library` | Modern ruin library | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/wall-kit` | Bronze wall kit | B | [S7](#s7-wall-kits-and-forts-glb) | P1 | yes |
| `battle-city/classical/wall-kit` | Classical wall kit | B | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/kingdoms/wall-kit` | Kingdoms wall kit | B | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/gunpowder/wall-kit` | Gunpowder wall kit | B | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/modern/wall-kit` | Modern wall kit | B | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/bronze/base/houses-damage` | Bronze base houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |
| `battle-city/bronze/europe/houses-damage` | Bronze europe houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |
| `battle-city/bronze/americas/houses-damage` | Bronze americas houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |
| `battle-city/bronze/levant/houses-damage` | Bronze levant houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |
| `battle-city/bronze/steppe/houses-damage` | Bronze steppe houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/indic/houses-damage` | Bronze indic houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/monsoon/houses-damage` | Bronze monsoon houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/eastafrica/houses-damage` | Bronze eastafrica houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/maghreb/houses-damage` | Bronze maghreb houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/sinic/houses-damage` | Bronze sinic houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/nile/houses-damage` | Bronze nile houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/westafrica/houses-damage` | Bronze westafrica houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/bronze/israelite/houses-damage` | Bronze israelite houses, damaged and ruined | B | [S6](#s6-damage-and-ruin-states-glb) | P1 | yes |

### Batch 04: Bronze battle economy and resource icons (R1)

20 items. Phases: R1.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/bronze-worker` | Bronze worker | R1 | [S8](#s8-battle-units-glb-and-sprites) | P1 | yes |
| `rts/bronze/town-hall` | Bronze town hall (defender hq) | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/expedition-camp` | Bronze expedition camp (attacker hq) | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/construction-set` | Bronze construction set | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/food-depot` | Bronze food depot | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/materials-yard` | Bronze materials yard | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/trade-post` | Bronze trade post | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/farm-plot` | Bronze farm plot states | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/mine` | Bronze mine | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/bronze/barracks` | Bronze barracks | R1 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/bronze/range` | Bronze range | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/bronze/stable` | Bronze stable or vehicle works | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/bronze/siege-workshop` | Bronze siege workshop | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/bronze/aid-post` | Bronze aid post | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/bronze/tower` | Bronze tower | R1 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `icons/battle/resource-food` | Battle resource: food | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/resource-materials` | Battle resource: materials | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/resource-gold` | Battle resource: gold | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/population` | Population and housing | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/units/worker` | Worker class icon | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |

### Batch 05: Resource nodes, herds, vegetation (R1)

18 items. Phases: R1.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `nature/fish-shoal` | Fish shoal node | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/herd-sheep-goat` | Herd: sheep and goats | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/herd-cattle` | Herd: cattle | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/vegetation-temperate` | Vegetation kit: temperate | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P1 | yes |
| `nature/vegetation-conifer` | Vegetation kit: conifer | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/vegetation-mediterranean` | Vegetation kit: mediterranean | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P1 | yes |
| `nature/vegetation-tropical` | Vegetation kit: tropical | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/vegetation-scrub` | Vegetation kit: scrub | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/vegetation-cold` | Vegetation kit: cold | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P2 | yes |
| `nature/stone-outcrop` | stone outcrop | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P1 | yes |
| `nature/ore-outcrop` | ore outcrop | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P1 | yes |
| `nature/gold-vein` | gold vein | R1 | [S9](#s9-resource-nodes-herds-and-vegetation-glb) | P1 | yes |
| `units/fishing-boat-ancient` | Fishing boat, ancient | R1 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/fishing-boat-modern` | Fishing boat, modern | R1 | [S8](#s8-battle-units-glb-and-sprites) | P3 | yes |
| `icons/battle/cmd-gather` | Command icon: gather | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/cmd-build` | Command icon: build | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/cmd-repair` | Command icon: repair | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-stop` | Command icon: stop | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |

### Batch 06: Battle build and command icons (R1)

25 items. Phases: R1.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `icons/battle/build-town-hall` | Build icon: town hall (defender hq) | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-expedition-camp` | Build icon: expedition camp (attacker hq) | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-food-depot` | Build icon: food depot | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-materials-yard` | Build icon: materials yard | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-trade-post` | Build icon: trade post | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-farm-plot` | Build icon: farm plot states | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-mine` | Build icon: mine | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-barracks` | Build icon: barracks | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-range` | Build icon: range | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-stable` | Build icon: stable or vehicle works | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-siege-workshop` | Build icon: siege workshop | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-aid-post` | Build icon: aid post | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-tower` | Build icon: tower | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-house` | Build icon: village house | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-wall` | Build icon: wall segment | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/build-gate` | Build icon: gate | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-attack-move` | Command icon: attack-move | R1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/cmd-hold` | Command icon: hold | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-patrol` | Command icon: patrol | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-rally` | Command icon: rally | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-return-goods` | Command icon: return-goods | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-formation-line` | Command icon: formation-line | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-formation-column` | Command icon: formation-column | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-formation-wedge` | Command icon: formation-wedge | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/cmd-retreat` | Command icon: retreat | R1 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |

### Batch 07: Emblems 1 (W0)

25 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/rasenna` | Emblem: Rasenna | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/tartessos` | Emblem: Tartessos | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/brigantes` | Emblem: Brigantes | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/caral` | Emblem: Caral | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/moche` | Emblem: Moche | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/wari` | Emblem: Wari | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/tiwanaku` | Emblem: Tiwanaku | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/muisca` | Emblem: Muisca | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/teotihuacan` | Emblem: Teotihuacan | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/zapotec` | Emblem: Zapotec | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/mutal` | Emblem: Mutal | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/hopewell` | Emblem: Hopewell | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/akkad` | Emblem: Akkad | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/elam` | Emblem: Elam | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/media` | Emblem: Media | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/kanesh` | Emblem: Kanesh | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/lydia` | Emblem: Lydia | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/urartu` | Emblem: Urartu | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/saba` | Emblem: Saba | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/oxus` | Emblem: Oxus | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/bactria` | Emblem: Bactria | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/sogdia` | Emblem: Sogdia | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/gokturk` | Emblem: Gokturk | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/meluhha` | Emblem: Meluhha | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/gandhara` | Emblem: Gandhara | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |

### Batch 08: WebGL map markers and independent shields (A2, C, W1)

18 items. Phases: C, W1, A2.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/impostors/classical-infantry-lod3` | LOD3 impostor test set | C | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `icons/independents/raiders` | Personality shield: raiders | W1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/independents/mercantile` | Personality shield: mercantile | W1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/independents/fortress` | Personality shield: fortress | W1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/independents/tribal` | Personality shield: tribal | W1 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `map-markers/badge-plate` | City badge plate | A2 | [S4](#s4-webgl-map-sprites) | P1 | yes |
| `map-markers/army-base` | Army marker base | A2 | [S4](#s4-webgl-map-sprites) | P1 | yes |
| `map-markers/standard-bronze` | Army standard: bronze | A2 | [S4](#s4-webgl-map-sprites) | P3 | yes |
| `map-markers/standard-classical` | Army standard: classical | A2 | [S4](#s4-webgl-map-sprites) | P3 | yes |
| `map-markers/standard-kingdoms` | Army standard: kingdoms | A2 | [S4](#s4-webgl-map-sprites) | P3 | yes |
| `map-markers/standard-gunpowder` | Army standard: gunpowder | A2 | [S4](#s4-webgl-map-sprites) | P3 | yes |
| `map-markers/standard-modern` | Army standard: modern | A2 | [S4](#s4-webgl-map-sprites) | P3 | yes |
| `map-markers/ai-battle-clash` | AI battle clash | A2 | [S4](#s4-webgl-map-sprites) | P1 | yes |
| `map-markers/ai-battle-smoke` | AI battle smoke | A2 | [S4](#s4-webgl-map-sprites) | P2 | yes |
| `map-markers/battle-result` | Battle result flash | A2 | [S4](#s4-webgl-map-sprites) | P2 | yes |
| `icons/markers/siege` | Siege marker | A2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/markers/sea-battle` | Sea battle marker | A2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `map-markers/route-dots` | Route dots and arrowhead | A2 | [S4](#s4-webgl-map-sprites) | P1 | yes |

### Batch 09: Independent towns and tribal camps (W1, W2-4)

12 items. Phases: W1, W2-4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `independents/early/raiders-dressing` | Independent town dressing: raiders, early | W1 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/early/mercantile-dressing` | Independent town dressing: mercantile, early | W1 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/early/fortress-dressing` | Independent town dressing: fortress, early | W1 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/early/tribal-dressing` | Independent town dressing: tribal, early | W1 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/tribal-camp-steppe` | Tribal camp: steppe | W2-4 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/tribal-camp-forest` | Tribal camp: forest | W2-4 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/tribal-camp-desert` | Tribal camp: desert | W2-4 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/tribal-camp-tropical` | Tribal camp: tropical | W2-4 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `independents/tribal-camp-cold` | Tribal camp: cold | W2-4 | [S13](#s13-map-attachments-glb) | P2 | yes |
| `icons/independents/raid-torch` | Raid party marker | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/raze` | Razing marker | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/tribute` | Tribute | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |

### Batch 10: Battle kinds, Command or Auto, outcomes, captives (R2)

21 items. Phases: R2.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `icons/battle/mode-command` | Command (play the battle) | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/mode-auto` | Auto (resolve) | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/kind-siege` | Battle kind: siege | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/kind-field` | Battle kind: field | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/kind-raid` | Battle kind: raid | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/kind-sack` | Battle kind: sack | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/kind-sally` | Battle kind: sally | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/kind-landing` | Battle kind: landing | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/kind-sea` | Battle kind: sea | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/outcome-victory` | Outcome: victory | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/outcome-defeat` | Outcome: defeat | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/outcome-withdrawal` | Outcome: withdrawal | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/outcome-city-taken` | Outcome: city-taken | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/war-score` | War score | R2 | [S1](#s1-ui-and-map-icons-svg) | P1 | yes |
| `icons/battle/captives` | Captives: captives | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/ransom` | Captives: ransom | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/release` | Captives: release | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/intel` | Intel and odds | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/reinforcements` | Reinforcements | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/recruit-regular` | Regular recruit badge | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/battle/recruit-auxiliary` | Auxiliary badge | R2 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |

### Batch 11: Generals, battle headers, remaining independent icons (R2, W2-4)

18 items. Phases: R2, W2-4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/bronze-general` | Bronze general | R2 | [S8](#s8-battle-units-glb-and-sprites) | P1 | yes |
| `units/classical-general` | Classical general | R2 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/kingdoms-general` | Kingdoms general | R2 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/gunpowder-general` | Gunpowder general | R2 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/modern-general` | Modern general | R2 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `ui/battle/header-bronze` | Bronze battle header | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P2 | yes |
| `ui/battle/header-classical` | Classical battle header | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `ui/battle/header-kingdoms` | Kingdoms battle header | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `ui/battle/header-gunpowder` | Gunpowder battle header | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `ui/battle/header-modern` | Modern battle header | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `ui/battle/result-victory` | Victory backdrop | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `ui/battle/result-defeat` | Defeat backdrop | R2 | [S3](#s3-illustrations-and-ui-plates-webp) | P3 | yes |
| `icons/independents/grudge` | Grudge | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/submit` | Peaceful submission | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/trade-pact` | Trade pact | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/hire-mercenaries` | Hire mercenaries | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `icons/independents/mercenary-contract` | Mercenary contract badge | W2-4 | [S1](#s1-ui-and-map-icons-svg) | P2 | yes |
| `fx/map/burning-town` | Burning town effect | W2-4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |

### Batch 12: Emblems 2 (W0)

25 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/kuru` | Emblem: Kuru | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/magadha` | Emblem: Magadha | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/kalinga` | Emblem: Kalinga | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/pandya` | Emblem: Pandya | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/van-lang` | Emblem: Van Lang | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/funan` | Emblem: Funan | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/srivijaya` | Emblem: Srivijaya | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/mapungubwe` | Emblem: Mapungubwe | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/numidia` | Emblem: Numidia | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/wagadu` | Emblem: Wagadu | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/kanem` | Emblem: Kanem | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/shang` | Emblem: Shang | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/zhou` | Emblem: Zhou | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/chu` | Emblem: Chu | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/shu` | Emblem: Shu | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/qi` | Emblem: Qi | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/kemet` | Emblem: Kemet | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/kerma` | Emblem: Kerma | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/dmt` | Emblem: D'mt | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/nok` | Emblem: Nok | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/gojoseon` | Emblem: Gojoseon | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/baekje` | Emblem: Baekje | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/yamatai` | Emblem: Yamatai | W0 | [S2](#s2-people-emblems-svg) | P2 | yes |
| `peoples/emblems/illyria` | Emblem: Illyria | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/celtiberia` | Emblem: Celtiberia | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |

### Batch 13: Raiders, mercenaries, forts, landings (R3)

21 items. Phases: R3.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/bronze-raider` | Bronze raider | R3 | [S8](#s8-battle-units-glb-and-sprites) | P1 | yes |
| `units/classical-raider` | Classical raider | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/kingdoms-raider` | Kingdoms raider | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/gunpowder-raider` | Gunpowder raider | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/modern-raider` | Modern raider | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/bronze-mercenary` | Bronze mercenary | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `units/classical-mercenary` | Classical mercenary | R3 | [S8](#s8-battle-units-glb-and-sprites) | P3 | yes |
| `units/kingdoms-mercenary` | Kingdoms mercenary | R3 | [S8](#s8-battle-units-glb-and-sprites) | P3 | yes |
| `units/gunpowder-mercenary` | Gunpowder mercenary | R3 | [S8](#s8-battle-units-glb-and-sprites) | P3 | yes |
| `units/modern-mercenary` | Modern mercenary | R3 | [S8](#s8-battle-units-glb-and-sprites) | P3 | yes |
| `props/loot-sack` | Loot carry prop | R3 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `props/exit-marker` | Map exit marker | R3 | [S4](#s4-webgl-map-sprites) | P2 | yes |
| `props/burnt-field-overlay` | Burnt field overlay | R3 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `props/landing-ancient` | Landing boats: ancient | R3 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `props/landing-middle` | Landing boats: middle | R3 | [S5](#s5-battle-building-prefabs-glb) | P3 | yes |
| `props/landing-modern` | Landing boats: modern | R3 | [S5](#s5-battle-building-prefabs-glb) | P3 | yes |
| `battle-city/bronze/fort` | Bronze fort (battle) | R3 | [S7](#s7-wall-kits-and-forts-glb) | P1 | yes |
| `battle-city/classical/fort` | Classical fort (battle) | R3 | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/kingdoms/fort` | Kingdoms fort (battle) | R3 | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/gunpowder/fort` | Gunpowder fort (battle) | R3 | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |
| `battle-city/modern/fort` | Modern fort (battle) | R3 | [S7](#s7-wall-kits-and-forts-glb) | P2 | yes |

### Batch 14: Rivers, fords, bridges and the first map terrain (R4, F)

14 items. Phases: R4, F.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-terrain/river-kit` | Battle river kit | R4 | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | yes |
| `battle-terrain/ford` | Ford | R4 | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | yes |
| `battle-terrain/bridge-wood` | Bridge: wood | R4 | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | yes |
| `battle-terrain/bridge-stone` | Bridge: stone | R4 | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | yes |
| `battle-terrain/bridge-steel` | Bridge: steel | R4 | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | yes |
| `map-terrain/ground-grass` | Ground material: grass | F | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | no |
| `map-terrain/ground-desert-sand` | Ground material: desert-sand | F | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | no |
| `map-terrain/ground-rock` | Ground material: rock | F | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | no |
| `map-terrain/mountain-ridges` | Geographic mesh kit: mountain-ridges | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | no |
| `map-terrain/coasts` | Geographic mesh kit: coasts | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | no |
| `map-terrain/rivers` | Geographic mesh kit: rivers | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P1 | no |
| `map-terrain/town-ground-bronze` | Bronze town ground patch | F | [S10](#s10-textures-terrain-fog-ground-webp) | P1 | yes |
| `fx/projectiles-bronze` | Bronze projectiles and hits | R4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |
| `fx/projectiles-classical` | Classical projectiles and hits | R4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |

### Batch 15: Classical battle economy and buildings (R4)

15 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/classical-worker` | Classical worker | R4 | [S8](#s8-battle-units-glb-and-sprites) | P1 | yes |
| `rts/classical/town-hall` | Classical town hall (defender hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/expedition-camp` | Classical expedition camp (attacker hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/construction-set` | Classical construction set | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/food-depot` | Classical food depot | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/materials-yard` | Classical materials yard | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/trade-post` | Classical trade post | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/farm-plot` | Classical farm plot states | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/mine` | Classical mine | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/classical/barracks` | Classical barracks | R4 | [S5](#s5-battle-building-prefabs-glb) | P1 | yes |
| `rts/classical/range` | Classical range | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/classical/stable` | Classical stable or vehicle works | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/classical/siege-workshop` | Classical siege workshop | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/classical/aid-post` | Classical aid post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/classical/tower` | Classical tower | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |

### Batch 16: Classical houses, damaged and ruined (R4)

13 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/classical/base/houses-damage` | Classical base houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/classical/europe/houses-damage` | Classical europe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/classical/americas/houses-damage` | Classical americas houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/classical/levant/houses-damage` | Classical levant houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/classical/steppe/houses-damage` | Classical steppe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/indic/houses-damage` | Classical indic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/monsoon/houses-damage` | Classical monsoon houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/eastafrica/houses-damage` | Classical eastafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/maghreb/houses-damage` | Classical maghreb houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/sinic/houses-damage` | Classical sinic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/nile/houses-damage` | Classical nile houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/westafrica/houses-damage` | Classical westafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/classical/israelite/houses-damage` | Classical israelite houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |

### Batch 17: Kingdoms battle economy and buildings (R4)

16 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/kingdoms-worker` | Kingdoms worker | R4 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `rts/kingdoms/town-hall` | Kingdoms town hall (defender hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/expedition-camp` | Kingdoms expedition camp (attacker hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/construction-set` | Kingdoms construction set | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/food-depot` | Kingdoms food depot | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/materials-yard` | Kingdoms materials yard | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/trade-post` | Kingdoms trade post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/farm-plot` | Kingdoms farm plot states | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/mine` | Kingdoms mine | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/barracks` | Kingdoms barracks | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/range` | Kingdoms range | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/stable` | Kingdoms stable or vehicle works | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/siege-workshop` | Kingdoms siege workshop | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/aid-post` | Kingdoms aid post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/kingdoms/tower` | Kingdoms tower | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `fx/projectiles-kingdoms` | Kingdoms projectiles and hits | R4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |

### Batch 18: Emblems 3 (W0)

25 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/lusitania` | Emblem: Lusitania | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/arverni` | Emblem: Arverni | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/belgae` | Emblem: Belgae | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/noricum` | Emblem: Noricum | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/marcomannia` | Emblem: Marcomannia | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/ulaid` | Emblem: Ulaid | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/geats` | Emblem: Geats | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/bosporan` | Emblem: Bosporan Kingdom | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/diaguita` | Emblem: Diaguita | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/marajoara` | Emblem: Marajoara | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/tupinamba` | Emblem: Tupinambá | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/jaragua` | Emblem: Jaragua | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/hohokam` | Emblem: Hohokam | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/chaco` | Emblem: Chaco | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/ugarit` | Emblem: Ugarit | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/mari` | Emblem: Mari | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/phrygia` | Emblem: Phrygia | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/pontus` | Emblem: Pontus | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/colchis` | Emblem: Colchis | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/magan` | Emblem: Magan | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/dilmun` | Emblem: Dilmun | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/nabataea` | Emblem: Nabataea | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/khazaria` | Emblem: Khazaria | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/parthava` | Emblem: Parthava | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/khwarazm` | Emblem: Khwarazm | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |

### Batch 19: Kingdoms houses, damaged and ruined (R4)

13 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/kingdoms/base/houses-damage` | Kingdoms base houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/kingdoms/europe/houses-damage` | Kingdoms europe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/kingdoms/americas/houses-damage` | Kingdoms americas houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/kingdoms/levant/houses-damage` | Kingdoms levant houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/kingdoms/steppe/houses-damage` | Kingdoms steppe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/indic/houses-damage` | Kingdoms indic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/monsoon/houses-damage` | Kingdoms monsoon houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/eastafrica/houses-damage` | Kingdoms eastafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/maghreb/houses-damage` | Kingdoms maghreb houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/sinic/houses-damage` | Kingdoms sinic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/nile/houses-damage` | Kingdoms nile houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/westafrica/houses-damage` | Kingdoms westafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/kingdoms/israelite/houses-damage` | Kingdoms israelite houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |

### Batch 20: Gunpowder battle economy and buildings (R4)

16 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/gunpowder-worker` | Gunpowder worker | R4 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `rts/gunpowder/town-hall` | Gunpowder town hall (defender hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/expedition-camp` | Gunpowder expedition camp (attacker hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/construction-set` | Gunpowder construction set | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/food-depot` | Gunpowder food depot | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/materials-yard` | Gunpowder materials yard | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/trade-post` | Gunpowder trade post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/farm-plot` | Gunpowder farm plot states | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/mine` | Gunpowder mine | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/barracks` | Gunpowder barracks | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/range` | Gunpowder range | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/stable` | Gunpowder stable or vehicle works | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/siege-workshop` | Gunpowder siege workshop | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/aid-post` | Gunpowder aid post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/gunpowder/tower` | Gunpowder tower | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `fx/projectiles-gunpowder` | Gunpowder projectiles and hits | R4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |

### Batch 21: Gunpowder houses, damaged and ruined (R4)

13 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/gunpowder/base/houses-damage` | Gunpowder base houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/gunpowder/europe/houses-damage` | Gunpowder europe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/gunpowder/americas/houses-damage` | Gunpowder americas houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/gunpowder/levant/houses-damage` | Gunpowder levant houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/gunpowder/steppe/houses-damage` | Gunpowder steppe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/indic/houses-damage` | Gunpowder indic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/monsoon/houses-damage` | Gunpowder monsoon houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/eastafrica/houses-damage` | Gunpowder eastafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/maghreb/houses-damage` | Gunpowder maghreb houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/sinic/houses-damage` | Gunpowder sinic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/nile/houses-damage` | Gunpowder nile houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/westafrica/houses-damage` | Gunpowder westafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/gunpowder/israelite/houses-damage` | Gunpowder israelite houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |

### Batch 22: Emblems 4 (W0)

25 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/wusun` | Emblem: Wusun | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/zhangzhung` | Emblem: Zhangzhung | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/yarlung` | Emblem: Yarlung | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kosala` | Emblem: Kosala | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/avanti` | Emblem: Avanti | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/satavahana` | Emblem: Satavahana | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/rajarata` | Emblem: Rajarata | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kamarupa` | Emblem: Kamarupa | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/vanga` | Emblem: Vanga | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/champa` | Emblem: Champa | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/pyu` | Emblem: Pyu | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/dvaravati` | Emblem: Dvaravati | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/tarumanagara` | Emblem: Tarumanagara | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/medang` | Emblem: Medang | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/butuan` | Emblem: Butuan | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/ajuran` | Emblem: Ajuran | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kilwa` | Emblem: Kilwa | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kitara` | Emblem: Kitara | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/mutapa` | Emblem: Mutapa | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/merina` | Emblem: Merina | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/cyrene` | Emblem: Cyrene | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/garamantes` | Emblem: Garamantes | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/mauretania` | Emblem: Mauretania | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/tichitt` | Emblem: Tichitt | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/djenne-djeno` | Emblem: Djenné-Djeno | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |

### Batch 23: Modern battle economy and buildings (R4)

19 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `units/modern-worker` | Modern worker | R4 | [S8](#s8-battle-units-glb-and-sprites) | P2 | yes |
| `rts/modern/town-hall` | Modern town hall (defender hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/expedition-camp` | Modern expedition camp (attacker hq) | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/construction-set` | Modern construction set | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/food-depot` | Modern food depot | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/materials-yard` | Modern materials yard | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/trade-post` | Modern trade post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/farm-plot` | Modern farm plot states | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/mine` | Modern mine | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/barracks` | Modern barracks | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/range` | Modern range | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/stable` | Modern stable or vehicle works | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/siege-workshop` | Modern siege workshop | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/aid-post` | Modern aid post | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/tower` | Modern tower | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/generator` | Modern generator | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/airfield` | Modern airfield | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `rts/modern/radar-aa` | Modern radar-aa | R4 | [S5](#s5-battle-building-prefabs-glb) | P2 | yes |
| `fx/projectiles-modern` | Modern projectiles and hits | R4 | [S12](#s12-effects-sprite-sheets) | P2 | yes |

### Batch 24: Modern houses, damaged and ruined (R4)

13 items. Phases: R4.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/modern/base/houses-damage` | Modern base houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/modern/europe/houses-damage` | Modern europe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/modern/americas/houses-damage` | Modern americas houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/modern/levant/houses-damage` | Modern levant houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P2 | yes |
| `battle-city/modern/steppe/houses-damage` | Modern steppe houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/indic/houses-damage` | Modern indic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/monsoon/houses-damage` | Modern monsoon houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/eastafrica/houses-damage` | Modern eastafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/maghreb/houses-damage` | Modern maghreb houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/sinic/houses-damage` | Modern sinic houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/nile/houses-damage` | Modern nile houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/westafrica/houses-damage` | Modern westafrica houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/modern/israelite/houses-damage` | Modern israelite houses, damaged and ruined | R4 | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |

### Batch 25: Independent towns, middle and modern ages (W1)

8 items. Phases: W1.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `independents/middle/raiders-dressing` | Independent town dressing: raiders, middle | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/middle/mercantile-dressing` | Independent town dressing: mercantile, middle | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/middle/fortress-dressing` | Independent town dressing: fortress, middle | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/middle/tribal-dressing` | Independent town dressing: tribal, middle | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/modern/raiders-dressing` | Independent town dressing: raiders, modern | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/modern/mercantile-dressing` | Independent town dressing: mercantile, modern | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/modern/fortress-dressing` | Independent town dressing: fortress, modern | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |
| `independents/modern/tribal-dressing` | Independent town dressing: tribal, modern | W1 | [S13](#s13-map-attachments-glb) | P3 | yes |

### Batch 26: Emblems 5 (W0)

25 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/yue` | Emblem: Yue | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/dian` | Emblem: Dian | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/nanyue` | Emblem: Nanyue | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/punt` | Emblem: Punt | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/ife` | Emblem: Ife | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/bono` | Emblem: Bono | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/luba` | Emblem: Luba | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/lunda` | Emblem: Lunda | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/ndongo` | Emblem: Ndongo | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/lapita` | Emblem: Lapita | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/buyeo` | Emblem: Buyeo | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/nuragi` | Emblem: The Nuragi | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/cherusci` | Emblem: Cherusci | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/durotriges` | Emblem: Durotriges | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/fortriu` | Emblem: Fortriu | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/rygir` | Emblem: Rygir | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/cucuteni` | Emblem: Cucuteni | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/avaria` | Emblem: Avaria | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kalinago` | Emblem: Kalinago | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/calusa` | Emblem: Calusa | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/haida` | Emblem: Haida | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/dorset` | Emblem: Dorset | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/aghvank` | Emblem: Aghvank | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kindah` | Emblem: Kindah | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/qedar` | Emblem: Qedar | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |

### Batch 27: Map terrain, the rest (F)

17 items. Phases: F.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `map-terrain/ground-dry-steppe` | Ground material: dry-steppe | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | no |
| `map-terrain/ground-snow-ice` | Ground material: snow-ice | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | no |
| `map-terrain/ground-tundra` | Ground material: tundra | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | no |
| `map-terrain/ground-wet-soil` | Ground material: wet-soil | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | no |
| `map-terrain/ground-paving` | Ground material: paving | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | no |
| `map-terrain/hills` | Geographic mesh kit: hills | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/cliffs` | Geographic mesh kit: cliffs | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/dunes` | Geographic mesh kit: dunes | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/lakes` | Geographic mesh kit: lakes | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/wetlands` | Geographic mesh kit: wetlands | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/roads` | Infrastructure kit: roads | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/field-edges` | Infrastructure kit: field-edges | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/shore-harbour` | Infrastructure kit: shore-harbour | F | [S11](#s11-terrain-and-river-mesh-kits-glb) | P2 | no |
| `map-terrain/town-ground-classical` | Classical town ground patch | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | yes |
| `map-terrain/town-ground-kingdoms` | Kingdoms town ground patch | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | yes |
| `map-terrain/town-ground-gunpowder` | Gunpowder town ground patch | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | yes |
| `map-terrain/town-ground-modern` | Modern town ground patch | F | [S10](#s10-textures-terrain-fog-ground-webp) | P2 | yes |

### Batch 28: Wonder ruins (B, polish)

15 items. Phases: B.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `battle-city/wonders/great_pyramids-ruined` | Wonder ruin: great_pyramids | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/hanging_gardens-ruined` | Wonder ruin: hanging_gardens | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/great_wall-ruined` | Wonder ruin: great_wall | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/great_library-ruined` | Wonder ruin: great_library | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/colosseum-ruined` | Wonder ruin: colosseum | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/lighthouse-ruined` | Wonder ruin: lighthouse | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/grand_bazaar-ruined` | Wonder ruin: grand_bazaar | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/great_cathedral-ruined` | Wonder ruin: great_cathedral | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/forbidden_city-ruined` | Wonder ruin: forbidden_city | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/royal_observatory-ruined` | Wonder ruin: royal_observatory | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/arsenal-ruined` | Wonder ruin: arsenal | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/palace_of_versailles-ruined` | Wonder ruin: palace_of_versailles | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/space_program-ruined` | Wonder ruin: space_program | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/international_exchange-ruined` | Wonder ruin: international_exchange | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |
| `battle-city/wonders/atomic_research_center-ruined` | Wonder ruin: atomic_research_center | B | [S6](#s6-damage-and-ruin-states-glb) | P3 | yes |

### Batch 29: Emblems 6 (W0)

20 items. Phases: W0.

| Id | Name | Phase | Spec | Priority | Placeholder ok |
|---|---|---|---|---|---|
| `peoples/emblems/sarmatians` | Emblem: The Sarmatians | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/andronovo` | Emblem: The Andronovo | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/botai` | Emblem: Botai | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/xianbei` | Emblem: Xianbei | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kroraina` | Emblem: Kroraina | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/khotan` | Emblem: Khotan | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/saurashtra` | Emblem: Saurashtra | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/kutai` | Emblem: Kutai | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/tondo` | Emblem: Tondo | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/gunditjmara` | Emblem: Gunditjmara | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/engaruka` | Emblem: Engaruka | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/khoekhoe` | Emblem: The Khoekhoe | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/san` | Emblem: The San | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/alodia` | Emblem: Alodia | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/libu` | Emblem: The Libu | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/wahgi` | Emblem: The Wahgi | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/saudeleur` | Emblem: Saudeleur | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/latte` | Emblem: The Latte chiefs | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/bau` | Emblem: Bau | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |
| `peoples/emblems/emishi` | Emblem: Emishi | W0 | [S2](#s2-people-emblems-svg) | P3 | yes |

### Emblems by people (all 150)

Order: the Kingdom of Israel (always in the world), then weight A (the likely majors), B, C, each
by theme priority. Ids are the people slugs planned for `src/data/peoples.js` (W0); if W0 picks
another slug, the id follows it.

| Batch | Id | People | Theme | Weight |
|---|---|---|---|---|
| 02 | `peoples/emblems/israel` | Kingdom of Israel | israelite | A |
| 02 | `peoples/emblems/keftiu` | Keftiu | europe | A |
| 02 | `peoples/emblems/ahhiyawa` | Ahhiyawa | europe | A |
| 02 | `peoples/emblems/odrysia` | Odrysia | europe | A |
| 02 | `peoples/emblems/dacia` | Dacia | europe | A |
| 07 | `peoples/emblems/rasenna` | Rasenna | europe | A |
| 07 | `peoples/emblems/tartessos` | Tartessos | europe | A |
| 07 | `peoples/emblems/brigantes` | Brigantes | europe | A |
| 07 | `peoples/emblems/caral` | Caral | americas | A |
| 07 | `peoples/emblems/moche` | Moche | americas | A |
| 07 | `peoples/emblems/wari` | Wari | americas | A |
| 07 | `peoples/emblems/tiwanaku` | Tiwanaku | americas | A |
| 07 | `peoples/emblems/muisca` | Muisca | americas | A |
| 07 | `peoples/emblems/teotihuacan` | Teotihuacan | americas | A |
| 07 | `peoples/emblems/zapotec` | Zapotec | americas | A |
| 07 | `peoples/emblems/mutal` | Mutal | americas | A |
| 07 | `peoples/emblems/hopewell` | Hopewell | americas | A |
| 07 | `peoples/emblems/akkad` | Akkad | levant | A |
| 07 | `peoples/emblems/elam` | Elam | levant | A |
| 07 | `peoples/emblems/media` | Media | levant | A |
| 07 | `peoples/emblems/kanesh` | Kanesh | levant | A |
| 07 | `peoples/emblems/lydia` | Lydia | levant | A |
| 07 | `peoples/emblems/urartu` | Urartu | levant | A |
| 07 | `peoples/emblems/saba` | Saba | levant | A |
| 07 | `peoples/emblems/oxus` | Oxus | steppe | A |
| 07 | `peoples/emblems/bactria` | Bactria | steppe | A |
| 07 | `peoples/emblems/sogdia` | Sogdia | steppe | A |
| 07 | `peoples/emblems/gokturk` | Gokturk | steppe | A |
| 07 | `peoples/emblems/meluhha` | Meluhha | indic | A |
| 07 | `peoples/emblems/gandhara` | Gandhara | indic | A |
| 12 | `peoples/emblems/kuru` | Kuru | indic | A |
| 12 | `peoples/emblems/magadha` | Magadha | indic | A |
| 12 | `peoples/emblems/kalinga` | Kalinga | indic | A |
| 12 | `peoples/emblems/pandya` | Pandya | indic | A |
| 12 | `peoples/emblems/van-lang` | Van Lang | monsoon | A |
| 12 | `peoples/emblems/funan` | Funan | monsoon | A |
| 12 | `peoples/emblems/srivijaya` | Srivijaya | monsoon | A |
| 12 | `peoples/emblems/mapungubwe` | Mapungubwe | eastafrica | A |
| 12 | `peoples/emblems/numidia` | Numidia | maghreb | A |
| 12 | `peoples/emblems/wagadu` | Wagadu | maghreb | A |
| 12 | `peoples/emblems/kanem` | Kanem | maghreb | A |
| 12 | `peoples/emblems/shang` | Shang | sinic | A |
| 12 | `peoples/emblems/zhou` | Zhou | sinic | A |
| 12 | `peoples/emblems/chu` | Chu | sinic | A |
| 12 | `peoples/emblems/shu` | Shu | sinic | A |
| 12 | `peoples/emblems/qi` | Qi | sinic | A |
| 12 | `peoples/emblems/kemet` | Kemet | nile | A |
| 12 | `peoples/emblems/kerma` | Kerma | nile | A |
| 12 | `peoples/emblems/dmt` | D'mt | nile | A |
| 12 | `peoples/emblems/nok` | Nok | westafrica | A |
| 12 | `peoples/emblems/gojoseon` | Gojoseon | korea | A |
| 12 | `peoples/emblems/baekje` | Baekje | korea | A |
| 12 | `peoples/emblems/yamatai` | Yamatai | japan | A |
| 12 | `peoples/emblems/illyria` | Illyria | europe | B |
| 12 | `peoples/emblems/celtiberia` | Celtiberia | europe | B |
| 18 | `peoples/emblems/lusitania` | Lusitania | europe | B |
| 18 | `peoples/emblems/arverni` | Arverni | europe | B |
| 18 | `peoples/emblems/belgae` | Belgae | europe | B |
| 18 | `peoples/emblems/noricum` | Noricum | europe | B |
| 18 | `peoples/emblems/marcomannia` | Marcomannia | europe | B |
| 18 | `peoples/emblems/ulaid` | Ulaid | europe | B |
| 18 | `peoples/emblems/geats` | Geats | europe | B |
| 18 | `peoples/emblems/bosporan` | Bosporan Kingdom | europe | B |
| 18 | `peoples/emblems/diaguita` | Diaguita | americas | B |
| 18 | `peoples/emblems/marajoara` | Marajoara | americas | B |
| 18 | `peoples/emblems/tupinamba` | Tupinambá | americas | B |
| 18 | `peoples/emblems/jaragua` | Jaragua | americas | B |
| 18 | `peoples/emblems/hohokam` | Hohokam | americas | B |
| 18 | `peoples/emblems/chaco` | Chaco | americas | B |
| 18 | `peoples/emblems/ugarit` | Ugarit | levant | B |
| 18 | `peoples/emblems/mari` | Mari | levant | B |
| 18 | `peoples/emblems/phrygia` | Phrygia | levant | B |
| 18 | `peoples/emblems/pontus` | Pontus | levant | B |
| 18 | `peoples/emblems/colchis` | Colchis | levant | B |
| 18 | `peoples/emblems/magan` | Magan | levant | B |
| 18 | `peoples/emblems/dilmun` | Dilmun | levant | B |
| 18 | `peoples/emblems/nabataea` | Nabataea | levant | B |
| 18 | `peoples/emblems/khazaria` | Khazaria | steppe | B |
| 18 | `peoples/emblems/parthava` | Parthava | steppe | B |
| 18 | `peoples/emblems/khwarazm` | Khwarazm | steppe | B |
| 22 | `peoples/emblems/wusun` | Wusun | steppe | B |
| 22 | `peoples/emblems/zhangzhung` | Zhangzhung | steppe | B |
| 22 | `peoples/emblems/yarlung` | Yarlung | steppe | B |
| 22 | `peoples/emblems/kosala` | Kosala | indic | B |
| 22 | `peoples/emblems/avanti` | Avanti | indic | B |
| 22 | `peoples/emblems/satavahana` | Satavahana | indic | B |
| 22 | `peoples/emblems/rajarata` | Rajarata | indic | B |
| 22 | `peoples/emblems/kamarupa` | Kamarupa | indic | B |
| 22 | `peoples/emblems/vanga` | Vanga | indic | B |
| 22 | `peoples/emblems/champa` | Champa | monsoon | B |
| 22 | `peoples/emblems/pyu` | Pyu | monsoon | B |
| 22 | `peoples/emblems/dvaravati` | Dvaravati | monsoon | B |
| 22 | `peoples/emblems/tarumanagara` | Tarumanagara | monsoon | B |
| 22 | `peoples/emblems/medang` | Medang | monsoon | B |
| 22 | `peoples/emblems/butuan` | Butuan | monsoon | B |
| 22 | `peoples/emblems/ajuran` | Ajuran | eastafrica | B |
| 22 | `peoples/emblems/kilwa` | Kilwa | eastafrica | B |
| 22 | `peoples/emblems/kitara` | Kitara | eastafrica | B |
| 22 | `peoples/emblems/mutapa` | Mutapa | eastafrica | B |
| 22 | `peoples/emblems/merina` | Merina | eastafrica | B |
| 22 | `peoples/emblems/cyrene` | Cyrene | maghreb | B |
| 22 | `peoples/emblems/garamantes` | Garamantes | maghreb | B |
| 22 | `peoples/emblems/mauretania` | Mauretania | maghreb | B |
| 22 | `peoples/emblems/tichitt` | Tichitt | maghreb | B |
| 22 | `peoples/emblems/djenne-djeno` | Djenné-Djeno | maghreb | B |
| 26 | `peoples/emblems/yue` | Yue | sinic | B |
| 26 | `peoples/emblems/dian` | Dian | sinic | B |
| 26 | `peoples/emblems/nanyue` | Nanyue | sinic | B |
| 26 | `peoples/emblems/punt` | Punt | nile | B |
| 26 | `peoples/emblems/ife` | Ife | westafrica | B |
| 26 | `peoples/emblems/bono` | Bono | westafrica | B |
| 26 | `peoples/emblems/luba` | Luba | westafrica | B |
| 26 | `peoples/emblems/lunda` | Lunda | westafrica | B |
| 26 | `peoples/emblems/ndongo` | Ndongo | westafrica | B |
| 26 | `peoples/emblems/lapita` | Lapita | pacific | B |
| 26 | `peoples/emblems/buyeo` | Buyeo | korea | B |
| 26 | `peoples/emblems/nuragi` | The Nuragi | europe | C |
| 26 | `peoples/emblems/cherusci` | Cherusci | europe | C |
| 26 | `peoples/emblems/durotriges` | Durotriges | europe | C |
| 26 | `peoples/emblems/fortriu` | Fortriu | europe | C |
| 26 | `peoples/emblems/rygir` | Rygir | europe | C |
| 26 | `peoples/emblems/cucuteni` | Cucuteni | europe | C |
| 26 | `peoples/emblems/avaria` | Avaria | europe | C |
| 26 | `peoples/emblems/kalinago` | Kalinago | americas | C |
| 26 | `peoples/emblems/calusa` | Calusa | americas | C |
| 26 | `peoples/emblems/haida` | Haida | americas | C |
| 26 | `peoples/emblems/dorset` | Dorset | americas | C |
| 26 | `peoples/emblems/aghvank` | Aghvank | levant | C |
| 26 | `peoples/emblems/kindah` | Kindah | levant | C |
| 26 | `peoples/emblems/qedar` | Qedar | levant | C |
| 29 | `peoples/emblems/sarmatians` | The Sarmatians | steppe | C |
| 29 | `peoples/emblems/andronovo` | The Andronovo | steppe | C |
| 29 | `peoples/emblems/botai` | Botai | steppe | C |
| 29 | `peoples/emblems/xianbei` | Xianbei | steppe | C |
| 29 | `peoples/emblems/kroraina` | Kroraina | steppe | C |
| 29 | `peoples/emblems/khotan` | Khotan | steppe | C |
| 29 | `peoples/emblems/saurashtra` | Saurashtra | indic | C |
| 29 | `peoples/emblems/kutai` | Kutai | monsoon | C |
| 29 | `peoples/emblems/tondo` | Tondo | monsoon | C |
| 29 | `peoples/emblems/gunditjmara` | Gunditjmara | monsoon | C |
| 29 | `peoples/emblems/engaruka` | Engaruka | eastafrica | C |
| 29 | `peoples/emblems/khoekhoe` | The Khoekhoe | eastafrica | C |
| 29 | `peoples/emblems/san` | The San | eastafrica | C |
| 29 | `peoples/emblems/alodia` | Alodia | nile | C |
| 29 | `peoples/emblems/libu` | The Libu | nile | C |
| 29 | `peoples/emblems/wahgi` | The Wahgi | pacific | C |
| 29 | `peoples/emblems/saudeleur` | Saudeleur | pacific | C |
| 29 | `peoples/emblems/latte` | The Latte chiefs | pacific | C |
| 29 | `peoples/emblems/bau` | Bau | pacific | C |
| 29 | `peoples/emblems/emishi` | Emishi | japan | C |

## 6. The production queue

All 534 items are appended to `plans/art/production-queue.json` in its format (`path`,
`section`, `description`, `source`, `delivery_status: "pending"`), with extra fields `id`,
`phase`, `batch` (`M01` to `M29`), `priority`, `placeholder_ok` and `spec`. The existing 350
entries and the counters at the top are unchanged (they still describe ITEMS.md Part B and C);
two new top-level keys, `master_plan_items` and `master_plan_note`, say so. The new paths do not
collide with any existing path.
