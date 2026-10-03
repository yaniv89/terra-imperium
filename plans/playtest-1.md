# Playtest 1: the plan (v2)

What you hit in the first real play as Israel, what the code does today, and a detailed plan
for all of it. v2 takes your three answers: detail only at the super zoom with icons when
zoomed out and nothing drawn off screen; the globe is my call; and the speed table is
explained in plain words (section 3) with the numbers I propose.

The plan is six workstreams (P1 to P6), each with its design, the files it touches, its tests
and its size, then the order of work.

---

## Decisions taken

- **The globe stays as the world view only.** Zoomed all the way out you see the sphere with
  nation fills, capitals and the lenses; zooming in hands over to the flat map at the region
  level, as the hand-over already does. The flat map is where the game is played and is the
  default view after the start screen. The Globe button remains a toggle. Reason: the globe is
  the one view that shows 240 nations at once, it costs nothing to keep, and removing it buys
  nothing the flat map needs. If after P1 you still want it gone it is a one-day removal.
- **Detail follows the zoom, not a global budget.** Your point is right: at the super zoom a
  screen holds a handful of towns and a few stacks, and off-screen things are not drawn. So
  the model budgets are set per zoom band by what that band shows (P1.4), and the battle keeps
  its own LOD chain because a battle does put 200 soldiers on one screen.

---

## P1. The map: zoom bands, crisp super zoom, what is drawn where

### P1.1 Zoom bands

One table decides everything the map draws. Zoom is the flat map's scale k (1 is the whole
world across the screen; phones reach 80 today, desktops 40; both go to 200).

| Band | k | What you see | How it is drawn |
|---|---|---|---|
| World | the globe | nation fills, borders, capitals as stars, lens tints | the globe as today |
| Region | 1 to 3 | nation fills, borders, city badges with size and name, army and fleet banners, settler tents, battle and wonder marks | SVG over the raster pyramid |
| Local | 3 to 10 | the hexes, improvement and district glyphs, resources, roads, routes, every badge and banner | SVG over the raster pyramid, the hex mesh for the window on screen |
| Close | 10 to 40 | rendered land: real relief, terrain textures, rivers, roads as paths, fields on improved tiles, town models, districts and wonders as models, armies as a few soldiers, fleets as ships | the three.js close view, culled to the screen |
| Super | 40 to 200 | the same scene up close: a town fills the screen, you see the market, the walls, the soldiers walking, the ships' sails | the close view with the full-detail models |

Badges and banners stay the same size on screen in every band (they scale by 1/sqrt(k) as
now), models scale with the land. Nothing outside the screen plus a one-tile margin is built
or drawn in any band: the close view already culls by the viewport, the SVG layers use the
hex window, and P1.3 adds the same to the raster.

### P1.2 Crisp mid zoom: a raster pyramid

The flat map is one 4,096-pixel picture of the Earth: 11 picture pixels per hex, stretched
30 times at k 40. Replace it with a tile pyramid, the way every web map works:
- `scripts/geo/build-raster-pyramid.mjs` renders the same realistic Earth (the shaded relief,
  the climate colours, the rivers, the coast) at zoom levels 0 to 7 into 256-pixel WebP tiles
  (`public/map/tiles/{z}/{x}/{y}.webp`; z 7 is 32,768 pixels across the world, 90 picture
  pixels per hex). The source is the terrarium elevation at zoom 7 and Natural Earth 2 HR
  (21,600 wide) for colour, both already in the fetch script. About 25 MB in all, fetched on
  demand, cached by the service worker.
- `Map2DView.jsx` draws the tiles for the window on screen (the hex-window logic, in tile
  coordinates) in an `<image>` layer under the provinces, picking z from k so a picture
  pixel is never stretched more than 2x up to k 10.
- The globe keeps `world-4096.webp`: it never zooms past the region band.

Size: two days. Test: a Playwright shot at k 1, 3, 8 of the Levant compared for sharpness
(the edge count of a Laplacian over the screenshot, a number in the test), and the tile cache
size under 30 MB.

### P1.3 The rendered close view (k 10 and up)

The land is drawn, not photographed, so it is sharp at any magnification. The battle renderer
already does exactly this for a battlefield (terrainSurface.js: a mesh from a height grid with
grass, sand, rock, forest, water painted per pixel by a ground shader). The close view gets
the same over the hexes on screen:

- **Relief.** Height per hex corner from the terrarium tiles at zoom 9 (about 300 m
  samples), a mesh of the hexes in the window plus one ring, 12 vertices per hex, rebuilt
  when the window moves by a hex. Mountains rise, hills roll, the coast drops to the sea.
- **Ground.** The ground shader's palette by the tile's climate and feature: grass and
  savanna, desert sand, tundra, snow and ice, forest and jungle floors, marsh, with a noise
  break so no two hexes look alike. Rivers from the tile data as water channels cut into the
  mesh, lakes and sea as the water plane. Roads as packed-earth paths (asphalt from the
  Modern Age), between the centres of road tiles.
- **Things on the land.** Fields and orchards on farm and plantation tiles, pens on
  pastures, a pit and a headframe on a mine, a quarry face, a logging clearing, boats on a
  fishing tile, a derrick on an oil well, a fort as a small keep: the art spec's improvement
  models, placeholders until they land. Districts as their landmark models beside the town.
  Wonders as their models. Towns as the layout-by-kit models of the art spec, placeholder
  boxes until then. Armies as 1 to 3 soldiers per stack (the battle soldiers), fleets as
  ships. The faint hex outline stays as a toggle.
- **Zoom.** The same scene from k 10 to 200; the camera tilt grows with k so at super zoom
  you look at the town from a low angle, which is where the kits' south faces matter.
- **Performance.** Only the hexes on screen plus one ring: at k 10 on a phone that is about
  120 hexes, at k 40 about 10, at k 200 one or two. Models come in three levels of detail
  chosen by k, not by distance (every hex on screen is at the same scale). Everything is
  instanced per model. Budget: 60 fps on a 2021 phone at every k.

Size: two weeks. This is the item that changes the game's look the most, and it is what the
art spec's models are for. Tests: the terrain mesh of a known hex (a mountain tile rises, a
sea tile is flat at 0), the window culling (hexes drawn equal hexes on screen plus the ring),
a screenshot at k 15, 50 and 150 with no console errors, frame time in the sandbox.

### P1.4 Model budgets by band

With the bands fixed, the budgets follow what each band shows at once:

| Band | On screen | Towns (triangles) | Soldiers, ships | Textures |
|---|---|---|---|---|
| Close, k 10 | about 120 hexes, 30 to 60 towns | LOD2 1,500 | imposters | the age atlas |
| Close, k 20 to 40 | 5 to 15 towns | LOD1 10,000 | LOD1 2,000 | 2K atlas with baked lighting and a normal map |
| Super, k 40 to 200 | 1 to 4 towns, a few stacks | LOD0 60,000 | LOD0 8,000, ships 12,000 | 4K atlas for towns, 2K for soldiers and ships |
| Battle | 200 to 300 soldiers | the battlefield's own buildings 20,000 | LOD0 6,000 for the 30 nearest squads, LOD1 1,500, imposters beyond | 2K atlases |

So the briefs change from "1,500 flat-colour triangles" to textured models at 8,000 to 60,000
at the top level, with real levels of detail, which is how the games you have in mind look.
The import script lifts its 3,000 cap, keeps the textures, and builds the imposters itself.
The unit brief, the town brief and the art spec get this table. Size: one day of code plus the
brief edits. This changes what you commission, so the briefs are updated before the first
batch of art is made.

### P1.5 The lens strip and the mini map

The strip in your screenshot is the lens strip (Political, Yields, Loyalty, Threat, Supply,
Trade, Air cover) as bare icons. It becomes one pill that names the current lens
("Political") and, tapped, opens the strip with a label and a one-line hint per lens, closing
after a pick. Keyboard 1 to 7 as now. The mini map folds the same way: a small globe button
that opens it. Both sit bottom-left as now but cover a tenth of what they cover today. Size:
half a day. Test: the landscape e2e checks the map keeps 85% of its width with both closed.

### P1.6 Route marks

The march line today is a green line with a numbered disc at the end of every turn's march
and a red ring at the halt, which clutters a short march and fights the badges. New look:
- a soft path with a round cap and a small arrowhead at the destination;
- one label only, at the destination: "3 turns" (or "halts: enemy fleet" in red);
- the per-turn dots only while you are planning the march (the preview), as small ticks
  without numbers, so you see the pace;
- the lines of other stacks hidden unless the stack is selected; your own marches shown faint
  until selected.
Size: half a day. Test: the mapBanners and Map2DView tests for the elements drawn per state.

---

## P2. War at hand: declaring war, supply, the army sheet

### P2.1 Declare war where the intent is

Declare War lives only on the nation card (Relations, or the nation sheet from a border).
Add it:
- on a foreign city's card: "Declare war on Egypt (5 DIP)", with the justified or unjustified
  cost and the opinion hit, confirm in a two-button sheet;
- on the tile sheet of an enemy army and on the army sheet's greyed Attack button: the reason
  "not at war" becomes a button that opens the same sheet;
- in the nation sheet header, beside the opinion;
- the guided start's battle step names it.
The reducer path is the existing DECLARE_WAR. Size: half a day. Test: the nextPrompt and
nationSheetModel tests, an e2e step in the guided start.

### P2.2 Supply you can read

The meter fills in your land, holds in held enemy land, drains in the wild and in enemy land,
less when a supply line reaches (your land within 8 tiles over land, more with Road Posts and
techs). The sheet prints one line about the zone and nothing about the lever. New:
- the army sheet shows the meter with its change per turn and names the lever: "Supply
  42/100, -8 a turn here. Your border is 11 tiles away; a supply line reaches 8. A Road Post
  in Haifa would reach 9. Marching back to your land refills it.";
- the Supply lens tints the reach of your supply lines from your border, so you see where a
  march stops being fed;
- a stack that halts in your land refills to full in two turns (SUPPLY_HOME_GAIN raised),
  and a supply line through a road reaches one tile further per road tile up to 3;
- the next prompt gains "an army running out of supply" (under 30 and falling).
Size: one day. Tests: supplyMeter.test.js for the new gains, armySheetModel for the text.

### P2.3 The army sheet's missing orders

Merge (two of your stacks on touching tiles: "Merge into this stack") and Split are the
checkboxes already; add Fortify as a real rule this time: a stack that holds a tile for a
full turn without moving gets +15% defence and a small camp drawn in the close view, lost on
moving (D1's entrench). Size: one day. Tests: fieldBattle for the multiplier, aiOperations
unchanged.

---

## P3. Pace: the speed table and the calendar

**What a speed table is.** The game advances the calendar by a fixed number of years every
turn, and that number depends on the age (history speeds up) and on the speed you chose at
the start. That list of numbers is the speed table. Today it is 40 years a turn in the Bronze
Age, then 20, 10, 4 and 2 at Normal; Marathon halves them, so the Bronze Age still jumps 20
years a turn, which is why it felt fast. Nothing else changes with the speed: research,
growth and production cost the same, so Marathon is the same game with a faster-looking
calendar.

**The proposed table** (years a turn in each age, and the turns a full game takes):

| Speed | Bronze | Classical | Kingdoms | Gunpowder | Modern | Turns 2000 BCE to 2300 CE |
|---|---|---|---|---|---|---|
| Fast | 50 | 25 | 12 | 5 | 2 | about 400 |
| Normal | 25 | 12 | 6 | 2 | 1 | about 900 |
| Marathon | 10 | 5 | 3 | 1 | 1 | about 1,900 |

and the pace of play scales with it: research, growth and production costs are multiplied by
1 at Fast, 1.5 at Normal, 2.5 at Marathon, so a Bronze tech still takes about 8 turns at
Fast and about 20 at Marathon, and the ages fall at the right centuries at every speed. The
era goals, the AI's periods (research, accords, wonders) and the Part H targets are stated
per speed. Saves keep their speed. Size: one day with sim runs at each speed. Tests:
ages.test.js for the table, longRun at Marathon 150 turns, the age reached by turn per speed.

If you want a different length, say the turns a Marathon game should take and I set the
table from that.

---

## P4. Civil wars and the quiet world

### P4.1 Measure first

The balance harness never counted civil wars. Add to `worldStats.sim.js`: civil wars started,
turns in civil war per nation, pretender captures, rebellions started, and the same for the
player's nation. Run 150 turns over seeds 3, 11, 12 and print the per-age rate.

### P4.2 Tune

A civil war starts on a succession crisis (every succession rolls it) or on low stability.
The rule becomes:
- the crisis roll only when legitimacy is under 40 or stability under -1; half the chance;
- a cooldown of 40 turns per nation after one ends;
- at most one civil war per nation per age as the Part H target;
- the player gets the warning event two turns ahead ("the succession is contested") with two
  real outs: pay 200 gold to buy the pretender's faction, or appoint the heir regent (needs an
  adult heir), each with an opinion and estate cost; the AI takes the gold out when it can.
Size: one day with the sim. Tests: civilWar.test.js for the gates and the cooldown, the sim
numbers in the log entry.

---

## P5. Names, labels and what the sheets say

- **P5.1 City names.** Settler-founded cities take the tile's name, and most tiles have none,
  so they fall back to "City 45912". A name pool from Natural Earth's populated places
  (7,000 towns with coordinates and countries, in the raw fetch already) assigned to the
  nearest free place within 150 km of the tile, else a generated name from the founder's
  culture group (names.js has syllable pools per group). Capitals keep theirs. Size: half a
  day. Test: 500 founded cities, no "City N", no duplicate within a nation.
- **P5.2 Unit names.** The roster names exist (Spearmen, Chariots, Archers, Battering Ram,
  War Galley) and the army sheet uses them, but the pre-battle modal, the battle report, the
  city rail and the production queue print the class. One `unitDisplayName(ageId, classId,
  navalLine)` helper for every label; the class only in a tooltip. Size: two hours.
- **P5.3 The Space tab.** Hidden until the nation has researched its first Modern tech, with
  a log line when it appears; the Empire sheet's space lines the same. Size: an hour.
- **P5.4 Why a building cannot be built.** The sheet knows the reason; print the tech by name
  with a "Research" link that queues it, "needs a coast", or "needs tier N first", on
  buildings, improvements and units alike. Size: half a day.
- **P5.5 The city badge.** The number inside the badge is the city's size; add the name
  under it from the region band on phones too (today from k 2.5), and a tap shows the badge's
  tooltip ("Suez, size 3, growing in 4 turns").

---

## P6. Order of work and sizes

| Wave | Content | Size |
|---|---|---|
| 1 | P5 (names, labels, Space tab, build reasons), P1.5 lens pill and mini map, P1.6 route marks, P2.1 declare war | 2 days |
| 2 | P2.2 supply, P2.3 fortify and merge, P4 civil wars measured and tuned | 3 days |
| 3 | P3 the speed table | 1 day |
| 4 | P1.2 the raster pyramid, P1.4 budgets and the brief edits | 3 days |
| 5 | P1.3 the rendered close view and super zoom | 2 weeks |

Every wave ships on the branch with lint, the unit suite, the e2e suite and, for P3 and P4,
the balance sim; merge to main when you say. The art spec's models land into P1.3 as they
arrive, placeholders first.

---

## Progress

**Wave 1 shipped (2026-10-03).** P5.2 `unitDisplayName` (data/unitNames.js) names every unit by
its roster entry in the city rail, the city panel's queue and templates, the pre-battle modal,
the defence sheet and the battle report (reports now keep a ship's line). P5.3 the Space tab
appears only once a Modern tech is researched (`visibleTabs`, both tab bars). P5.4 a building or
item you cannot build names the tech with a "Research it" link that queues it (city sheet
Buildings and the build list). P5.1 `pickCityName` (engine/cityNames.js): a settler's city takes
the tile's real name, else the nearest free named tile within 3 rings, else a name made in the
founder's culture; 500 founded cities in the test, no "City N", no duplicate. P5.5 your cities
and every capital carry their name from zoom 1.5. P1.5 the lens strip is a pill naming the
current lens that opens a labelled list; the mini map folds behind a "World" button, closed by
default on phones and remembered. P1.6 a march is a soft path with an arrowhead and one label at
the end ("3 turns", "halted"); the preview keeps small ticks; other stacks' marches stay faint
when one is selected. P2.1 `declareWarModel` (panels/warActions.js): Declare War on every
foreign city card at peace, on the tile sheet of a foreign army at peace, and in place of the
army sheet's greyed Assault button, all with the cost and the casus belli note.

**Wave 2 shipped (2026-10-03).** P2.2 `supplyReport` (supplyMeter.js) on the army sheet: the
meter, this turn's change, the turns left, the distance to your border, the line's reach and the
lever ("a Road Post at the border or a road under the army reaches 10; taking the city here
would hold the meter"); a stack on an unburnt road is reached by a line ROAD_LINE_BONUS (2)
tiles further; home land refills a stack in two turns (SUPPLY_HOME_GAIN 20 to 50); the Supply
lens tints the land your lines reach from your border (`supplyReach`, both maps); the next
prompt warns of an army under SUPPLY_LOW (30) and falling. P2.3 fortify: a stack that stood on
its tile through a whole turn without fighting (`heldSince`, set in the movement phase) takes
FORTIFY_REDUCTION (15%) less damage in a field battle until it moves, and the sheet says so;
merge: the sheet offers to march your stacks from the touching tiles in. P4 the harness counts
civil wars started, nations in civil war and rebel stacks: the base world had 99 to 170 civil
wars in 150 turns over 240 nations, which is what you saw. Now a succession crisis erupts only
with a weak court (legitimacy under 40 or stability at -1 or below), one time in five (was two
in five), the stability trigger needs five turns at the floor (was three), and no nation falls
into a second civil war for 40 turns after one ends: 21 to 28 civil wars per game over the same
seeds. The nations freed of them fight more (wars 15 to 30, conquests 3 to 7 over three seeds),
cities and turn time unchanged. The player sees it coming: the next prompt names a contested
succession three turns before the reign ends (no heir, or a claim under 20), opening the Court,
where "Secure the succession" (200 gold, 2 DIP) raises the heir's claim by 30.

**Wave 3 shipped (2026-10-03).** P3 the speed table (data/ages.js `GAME_SPEEDS`): years a turn
by age, Fast 50/25/12/5/2 (about 440 turns), Normal 25/12/6/2/1 (about 920), Marathon
10/5/3/1/1 (about 1,500). The pace follows the calendar, not the turn: research, production and
growth cost REFERENCE_YEARS[age] / years[age] times their base (`speedCostMult`, by the tech's
age for research and the nation's age for cities), so a tech, a granary or a size of growth
takes the same span of history at every speed. The start screen names each speed's length.
Checked at the same calendar year (424 CE): player techs 10 to 12 (old build 10 to 11), AI
median 5 (5), cities 867 (817), turn time unchanged. Cities run about 6% ahead because settlers
and outposts still move per turn; a per-year outpost pace is a follow-up if it shows in play.

**Wave 4 shipped (2026-10-03).** P1.2 the raster pyramid: `scripts/geo/build-raster-pyramid.mjs`
(`npm run build:pyramid`, sources with `node scripts/geo/fetch-tiles-raw.mjs --pyramid`) renders
the same realistic Earth at 16,384 x 8,192 (about 2.4 km a pixel, 44 pixels a hex) from the
zoom-5 elevation and the 1:10M coastline, one band at a time, then halves it down: 2,730 WebP
tiles in public/map/tiles, 14 MB, built in under 4 minutes. `rasterTiles.js` picks the level
whose pixels match the screen and lists only the tiles on screen; the flat map draws them over
its base picture (77 tiles at zoom 8 on a phone, 20 at zoom 30, all fetched, no errors). The
Levant at zoom 8 shows the coast, Cyprus, the Sea of Galilee, the Dead Sea and the Nile delta
sharp where the old picture was blocks. Past zoom 20 the 2.4 km tiles stretch again; the
rendered close view (wave 5) takes over there. Resource glyphs now show only on claimed land
and the ring around it (everywhere under the Yields lens): the Sahara was a carpet of them.
P1.4 the soldier triangle budget is 8,000 (a warning, never a rejection). The loader still
flattens a model's texture into one colour per triangle for the instanced soldier shader; a
textured soldier material (the atlas sampled in the shader, LOD1 and imposters) is built with
the first real model, the Swordsmen pilot of plans/model-brief-for-claude.md.


**Wave 5 shipped (2026-10-03).** P1.3 the rendered close view and P1.1 the super zoom.
- The ground: from zoom 10 the flat map's SVG stops drawing its pictures and turns transparent
  over a new canvas, `CloseTerrainLayer.jsx`, which draws the level-5 tiles on screen through
  `terrainShader.js` (over the whole-world picture while a tile loads). Each pixel is classed
  water or land by its colour, and snow or bare ground on land; the class is blended between the
  four nearest pixels and cut at one half with a one-pixel soft edge, so coasts, lakes, rivers
  and glaciers stay clean lines at any zoom and each side keeps its own true colour. Ground
  detail is noise in world kilometres at 24, 6 and 1.5 km (mottled grass, sand ripples, rock
  crags, sea swells, a light rim on the shore, a small hillshade), each scale fading in once it
  spans 4 device pixels. It draws only when the view changes. Territories, borders, lenses,
  routes and badges still draw over it; without WebGL the old pictures stay.
- On the land (`landscape.js`, `landscapeModels.js`): trees in forest and jungle hexes from zoom
  14 (pines north of 48 degrees, broadleaf elsewhere, palms in the jungle; 22 a hex, up to 3
  times denser in the super zoom; none on a city, district, wonder or work tile; at most 4,000),
  and a small work on every improved tile: farm fields, pasture, camp, mine, quarry, plantation,
  lumber camp, oil well, fort and fishing boats, darker when pillaged. Placeholders until the
  models of plans/model-brief-for-claude.md.
- The super zoom: the zoom limit is 200 on desktop and touch (was 40 and 80). Past zoom 40 the
  models grow with zoom to the power 0.7 so a town stays inside its hex, and they lean lower
  (tilt 0.95 to 1.2 radians by zoom 200).
- Checked in the browser at a phone screen (844 x 390, 2x): Paris at zoom 15 and 200, the
  Normandy coast at 60, Brittany at 120 and 150, the Alps at 40 and 80. No console errors; a
  redraw after a view change takes about 25 to 50 ms under software rendering.
