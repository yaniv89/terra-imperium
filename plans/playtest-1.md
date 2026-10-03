# Playtest 1: what you hit, what the code says, and the plan

Your first real play as Israel on the live site. Eleven points, each with what I found in the
code, the fix and its size, then an order of work and the two decisions that are yours.

## 1. Too many civil wars

**Found.** A civil war starts in two places: a succession crisis (`civilWar.js`,
CIVIL_WAR_SUCCESSION_CRISIS_CHANCE on every succession that lands badly) and low stability.
Nothing limits how often one nation can fall into one, and the balance harness does not count
civil wars at all, so they were never measured. On the new map a ruler dies every 15 to 30
turns and every succession rolls the crisis, so a mid-size nation sees one every few decades.

**Fix.** Count civil wars and rebellions in the balance harness (`worldStats.sim.js`), then
tune: a cooldown of 40 turns per nation after a civil war, the crisis only when legitimacy is
under 40 or stability under -1, the chance halved, and the player gets a warning event two
turns before ("the succession is contested: pay 200 gold or raise legitimacy") instead of a
surprise. Target from Part H: at most one civil war per nation per age. Size: a day, with the
sim runs.

## 2. Could not find how to declare war

**Found.** Declare War lives only on the nation card (Empire tab, Relations, or the nation
sheet from a border). An enemy city card and an army beside an enemy say "not at war" and stop.

**Fix.** Put the action where the intent is: a "Declare war on X" button on a foreign city
card and on the tile sheet of an enemy army, the army sheet's greyed Attack button opens the
war declaration with its cost, and the nation sheet gets the button in its header. The guided
start's "battle" step points at it. Size: half a day.

## 3. How to supply an army

**Found.** Supply is a meter on each unit: it fills in your land, holds in held enemy land,
drains in the wild and in enemy land, less when a supply line reaches (your land within 8
tiles over land, more with Road Posts and techs). The army sheet prints one line about the
zone and nothing says where the line ends or how to extend it.

**Fix.** The army sheet shows the meter with its change per turn and a sentence that names
the lever: "Supply 42/100, -8 a turn. Your border is 11 tiles away; a supply line reaches 8.
A Road Post in Haifa would reach 9, a march back to your land refills it." The Supply lens
draws the line's reach as a tint from your border. A unit that stops in your land refills to
full in two turns (today it climbs slowly). Size: one day.

## 4. Why 1,500 triangles? How do mobile games look so good?

**Found.** The briefs set 800 to 1,500 triangles for a soldier and 3,000 to 12,000 for a town
because of counts, not phones: a battle draws 12 soldiers per squad for 20 to 30 squads, and
the close map draws 250 towns at once. A phone GPU draws 30 to 60 million triangles a second
comfortably; 300 soldiers at 1,500 is 450,000 per frame, fine, but 300 at 20,000 is 6 million
per frame at 60 fps, which is where phones throttle.

**How the good-looking mobile games do it.** Not with more triangles. Four things: textures
with baked lighting and normal maps (a 2,000-triangle soldier with a 1K texture looks like
20,000), levels of detail (the full model only for the 20 nearest, a 300-triangle version for
the rest), instancing (one draw call for every copy of a model), and few unique things on
screen. Our models today are flat colour per triangle with no textures, which is the real
reason they look simple, and the unit pipeline rejects anything over 3,000.

**Fix.** Raise the budgets and add textures, keeping the counts in mind: soldiers LOD0 4,000
triangles with a 1K atlas (baked ambient occlusion, a normal map), LOD1 1,200, LOD2 300;
towns LOD0 40,000 with a 2K atlas (only 4 are on screen at full zoom), LOD1 8,000, LOD2
1,000; ships 6,000 with a 1K atlas. The game loads textured GLBs already (gltfUnitLoader), the
import script just needs the cap lifted and the atlas kept. The two briefs and the art spec
get the new table. Size: one day of code, and it changes what you commission.

## 5. Drop the globe, keep 2D, and super zoom without blur

**Found.** The flat map is one 4,096 by 2,048 picture of the whole Earth. That is 11 pixels
per degree, so a 106 km hex is about 11 picture pixels wide; at full zoom it is 350 screen
pixels wide, stretched 30 times. No single picture fixes that: NASA's largest free Earth
(21,600 wide) is still stretched 6 times at full zoom, and it weighs 100 MB.

**Fix, in two layers.**
1. **A tile pyramid for the mid zooms** (1x to 10x): the raster build cuts the Earth into
   256-pixel tiles at zoom levels 0 to 6 from the 21,600-wide Natural Earth and Blue Marble
   sources (about 20 MB in all, loaded on demand like a slippy map, cached by the service
   worker). Crisp to 10x on a phone.
2. **A rendered close view for 10x and up**, the way Civ and Humankind do it: the land is
   drawn, not photographed. The battle renderer's terrain shader already builds a textured
   mesh from height and terrain classes (terrainSurface.js); the close view gets the same
   over the hexes on screen: real height from the terrarium tiles (zoom 8 to 10), grass,
   sand, rock, forest and snow splats by the tile's climate, rivers as water, roads as
   paths, fields on improved tiles, the town models, soldiers and ships on top. At that zoom
   the picture is sharp at any magnification because it is geometry and tiling textures.
   This is also what the art spec's models stand on.

**The globe.** Keep it, as the world view only (zoomed out it is the best way to show 240
nations on a sphere, it costs nothing to keep, and the lenses already run on it), and make the
flat map the default where you play: start in 2D, the Globe button a toggle. Dropping the
globe outright saves little and loses the one view that shows the whole world at once. Your
call, see Decisions. Size: pyramid two days, rendered close view one to two weeks (it is the
biggest item here and the one that changes the game's look the most).

## 6. The panel in your screenshot

**Found.** That is the lens strip (LensStrip.jsx): Political, Yields, Loyalty, Threat, Supply,
Trade and Air cover, as icons with no labels, pinned over the map beside the mini map. On a
phone it eats a quarter of the map and says nothing.

**Fix.** One small pill showing the current lens by name ("Political"); tapping it opens the
strip with labels and a one-line hint per lens, closing after a pick. The mini map folds the
same way. Size: half a day.

## 7. Marathon still feels fast

**Found.** Years per turn are 40, 20, 10, 4, 2 by age at Normal speed; Marathon halves them, so
the Bronze Age still moves 20 years a turn and 2000 BCE to 800 BCE is 60 turns. Nothing ties
speed to research or growth, so Marathon is the same game with the calendar slowed.

**Fix.** A real speed table: Normal 25, 12, 6, 2, 1 years a turn (the full game 520 turns),
Marathon 10, 5, 3, 1, 1 (about 1,100 turns) with research, growth and production costs scaled
by 1.6 so the pace of play matches the calendar, Fast as today. Ages advance by the year as
now. The era goals and the Part H targets are restated per speed. Size: one day with sim runs.
A decision below.

## 8. Cities named "City 45912"

**Found.** A settler founds a city with the tile's name, and most tiles have none, so the
fallback is the tile number (cities.js `City ${tile}`).

**Fix.** A city name pool: Natural Earth's populated places (7,000 towns with coordinates and
countries) assigned to the nearest free place within 150 km of the tile, else a name made from
the founder's culture group (names.js already has syllable pools per group). Capitals keep
their names. Size: half a day.

## 9. The Space tab before the Modern Age

**Fix.** Hide the Space tab until the nation has researched its first Modern tech (and show a
one-line log entry when it appears). Same rule for the space lines of the Empire sheet. Size:
an hour.

## 10. A building you cannot build should say why

**Found.** The city sheet already knows the reason ("a technology", "a coast") and shows a
greyed button.

**Fix.** Print the tech by name with a "Research" link that queues it, "needs a coast", or
"needs tier N first". The same on improvements ("Mine: needs Bronze Casting") and units. Size:
half a day.

## 11. "Infantry" in the Bronze Age

**Found.** The roster names exist (Spearmen, Chariots, Archers, Battering Ram, War Galley) and
the army sheet uses them, but the pre-battle modal, the battle report, the city rail and the
production queue print the class name.

**Fix.** One `unitDisplayName(ageId, classId, navalLine)` helper used by every label; the
class name only in tooltips ("Spearmen, infantry"). Size: two hours.

## Order of work

1. The quick ones in one wave: 11 unit names, 9 Space tab, 10 build reasons, 6 lens pill,
   8 city names, 2 declare war everywhere. One to two days.
2. Civil wars measured and tuned (1), supply explained (3). Two days.
3. Speed table (7) once you decide.
4. Triangle budgets and textures (4), briefs and spec updated.
5. The raster pyramid (5.1), then the rendered close view (5.2), the big one.

## Decisions

1. **The globe.** Keep it as the world view with 2D as the default (my recommendation), or
   remove it.
2. **Speed.** The table in 7, or your own numbers. Say how long you want a full game to be on
   Marathon in turns, and I set the table from that.
3. **Models.** Textured models at the higher budgets (4) change what you commission; say yes
   before the first batch of art is made.
