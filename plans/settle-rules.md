# Settling rules, Civilization style

Goal: one settling rule that every city obeys, start capitals included, so two nations never start
on top of each other (today Jerusalem and Ramallah start one hex apart, with tangled borders and
overlapping town models). Written 2026-10-04 for a separate session. Branch: `game/settle-rules`
(a prototype of steps 1 to 3 is already on it, see "Starting point").

## How Civilization VI does it

- A city centre must be at least 4 hexes from any other city centre (3 empty hexes between),
  whoever owns it: your own, an AI's or a city-state's.
- If the two cities are on different landmasses (water between), the minimum drops to 3 hexes,
  so the first rings of the two cities still never touch.
- You cannot found a city on a tile another civilization owns.
- The settler lens shows every illegal tile in red before you move.
- Start positions obey the same rule. With "true start locations" on an Earth map, a civ whose
  real spot conflicts with another civ's gets a normal start elsewhere. Civ only has room for
  this because a game holds about 8 to 12 civs, not 240.

Sources: [City (Civ6), Civilization wiki](https://civilization.fandom.com/wiki/City_(Civ6)),
[Civ 6 city spacing guide](https://gamewiki.blog/civ-6-city-spacing-guide-1).

## What Terra Imperium does today

- Founding (`src/engine/world/cities.js` `canFoundCity`): land only, not ice, not on another
  nation's tile, no city within `MIN_CITY_SPACING - 1` rings. `MIN_CITY_SPACING_KM = 306` is
  4 rings at frequency 100, so this already matches Civ VI's main rule. There is no water
  exception.
- Starts (`src/data/scenarios.js` `spreadCapitals`): big nations first. A crowded capital moves
  inside its own land; a tiny neighbour can ask a bigger one to shift. If neither works, the
  capital stays where it is and breaks the rule. At frequency 100 that leaves 61 crowded pairs,
  for example il-ps (1 ring), mk-xk (1), be-lu (2), ch-li (2), hk-mo (2), cy-xn (2), gg-je (2),
  at-sk, at-cz, hr-si, the Balkans and about 30 pairs in the Caribbean.
- Extra start cities in later scenarios (`extraCitySites`) check spacing only against their own
  nation's cities, so they can also break the rule against a neighbour.
- `emergence.js` (emergent worlds) already uses `canFoundCity`.

## The rules to implement

### R1. One spacing rule, shared
New module `src/data/geo/citySpacing.js`, used by founding and by the starts:
- `CITY_SPACING_KM = 306`, `citySpacingRings(tiles)` = `ringsForKm(306)` (4 at frequency 100).
- `landmassOf(tiles)`: a landmass id per tile (land joined through land neighbours, -1 for
  water), cached per grid, linear in the cell count.
- `spacingBlocks(tiles, centre, tile, ring)`: true if `ring < rings - 1`, or
  `ring === rings - 1` and both tiles are on the same landmass. That is Civ VI's rule plus its
  water exception.
- `cities.js` `markBlocked` uses `spacingBlocks`, so `canFoundCity`, `bestSites`, the AI and
  emergence all follow it with no other change.

### R2. No ownership exception
Keep "you cannot found on another nation's tile". Keep it simple: no founding on tiles you do not
own unless the tile is unowned (today's rule).

### R3. Start capitals always obey R1
`spreadCapitals` keeps its first two passes (big nations first, move inside own land, big
neighbour shifts) and adds a final pass that guarantees the rule. Go through nations biggest
first; a capital that breaks the rule against a capital already fixed is resolved by the
fallback in R4.

### R4. A nation with no room (the decision)
Pick one. The recommendation is A.

- **A. Absent at start, with player priority (recommended).** If the nearest legal tile is more
  than `START_ABROAD_KM` (300 km) beyond the nation's own border, the nation starts dormant.
  Dormant nations already exist (`scenario.dormantNationIds`, `emergentWorld.applyScenario`);
  in the full world they would simply be absent at the start. The nation the player picks is
  placed first and always keeps its real capital, so whoever crowds it yields instead. Example:
  in a normal game Israel keeps Jerusalem and Palestine is absent; if you play Palestine,
  Ramallah stands and Israel moves inside its own land (or is absent if it has no room).
  Optional later: a dormant nation can emerge when its home land frees up (emergence.js).
  Needs: the nation picker marks such nations "starts with priority"; tests that every nation
  is still pickable and starts legally when picked.
- **B. Move anywhere legal.** Always on the map at the nearest legal land, however far, its own
  landmass first. The prototype does this: 0 rule breaks, 60 capitals moved, but some land far
  from home and in another country (Palestine near Tabuk in Saudi Arabia, Kosovo in Turkey,
  Montenegro in Greece, Puerto Rico in Cuba, the Virgin Islands in Colombia).
- **C. Merge into one start.** The smaller nation of a crowded pair has no city at the start and
  begins as a vassal of the bigger one (Palestine under Israel, Luxembourg under Belgium), able
  to break free later (vassals.js liberty desire). Always present, never moved, but it changes
  diplomacy at the start and the vassal needs at least one city to exist in the engine.

Whatever is chosen, the result must be deterministic (same start every game for the same picked
nation) and keep a moved capital's real name (already done in `buildScenarioStarts`).

### R5. Extra start cities obey R1
`extraCitySites` checks a site against every city placed so far, every nation's, with
`spacedApart` (the shared rule), not only against its own nation's cities.

### R6. Show it to the player
- Settler lens: when a settler is selected, tint illegal tiles red (the blocked index in
  cities.js already knows them) and show the reason ("Too close to Jerusalem", "Belongs to
  Egypt"). Phone landscape first (844x390).
- Nation picker: a note on nations that start moved or absent ("Starts in the Negev: no room
  beside Jerusalem" or "Not on the map unless you play it").

### R7. Invariant
`stateAudit.js`: a check that no two city centres break R1 (all cities, every turn, cheap with
the blocked index). Conquest, flips and free cities do not found cities, so this should never
fire; a hit means a bug.

## Tests
- `citySpacing.test.js`: same landmass blocks to ring 3 at frequency 100, different landmass
  only to ring 2; landmass ids stable and -1 on water.
- `cities.test.js`: `canFoundCity` refuses ring 3 on the same land and accepts ring 3 across a
  strait.
- `scenarios.spread.test.js`: rewrite "unless its own land has no room" into "every pair of
  start cities obeys R1, in every scenario" (all 240 at Dawn, plus the extra cities of later
  starts); il and ps never closer than the rule; the big nations (fr, de, cn, us, ru, eg) keep
  their real capitals; deterministic in any input order.
- `emergentWorld.test.js` line 96 expects `MIN_CITY_SPACING` rings everywhere: update it to the
  shared rule (3 rings across water).
- With option A: every nation, when picked, starts with a city on a legal tile.
- Balance: a balance-sim compare (base = the starting commit, 150 turns, seeds 11 and 12,
  PLAYER=au). The water exception allows a few more coastal cities; report city counts.
- Perf: `spreadCapitals` with the prototype takes about 0.8 s for 240 nations (cached per
  grid). Keep it under 1 s or cache the result in the build.

## Status (phase S, 2026-10-06, branch claude/ancient-world)
Done: R1 (citySpacing.js, used by canFoundCity and so by settlers, the AI, emergence and the
starts), R2 (unchanged rule), R5 (one barred-tile set over every nation's cities), R6 (the Settle
lens, key 8, also shown while a tile with your settler is selected; the tile card names the owner;
the nation picker note), R7 (stateAudit `city_spacing`; testWorld.addCity obeys the rule, `loose`
for two fixtures). R3 and R4 for the legacy full world with **option A**: the picked nation first
on its real capital; others move inside their land, else at most START_ABROAD_KM (300 km) beyond
their border, never onto the land of a nation still to be placed; else absent (dormant and left out
of the nations). Without a priority 17 are absent: ai bl cw je kn lc lu mf mk ms ps si sx va vc vi
xk; 36 capitals move. Not done: a dormant nation emerging when its land frees up (optional).

## Starting point
The prototype on `game/settle-rules` has R1 (citySpacing.js, wired into cities.js markBlocked),
R3 with option B, and R5. Measured at frequency 100: 0 rule breaks, 60 capitals moved (list
below). The tests are not yet updated: 8 fail in src/data and src/engine (scenarios.spread,
scenarios x2, settlers x2, seaConnectivity, tileGeometry Modern start, emergentWorld later
starts), mostly old expectations (moves only inside own land, city counts) and possibly an
extra city or a moved capital landing on a tile those tests do not expect; check each one. If option A or C is chosen, replace the final pass of
`spreadCapitals` and keep the rest.

## Capitals moved by the prototype (option B)
Format: nation, real capital, the country of the new tile, its lat/lon, rings moved.

```
ps Ramallah -> sa 29.8 37.1 rings 5
sy Damascus -> sy 35.3 38.6 rings 4
kr Seoul -> kr 37.0 127.8 rings 1
cr San José -> cr 10.2 -84.8 rings 1
ni Managua -> ni 12.4 -85.6 rings 1
cg Brazzaville -> cg -1.9 14.6 rings 3
by Minsk -> by 53.5 29.0 rings 1
mf Marigot -> tc 21.4 -71.1 rings 13
sx Philipsburg -> ve 7.6 -68.3 rings 16
uy Montevideo -> uy -34.7 -55.7 rings 1
cz Prague -> de 49.7 12.1 rings 2
lv Riga -> lv 56.8 21.9 rings 2
se Stockholm -> se 57.6 18.5 rings 3
fi Helsinki -> fi 61.6 27.6 rings 2
lu Luxembourg -> fr 46.0 4.2 rings 5
be Brussels -> be 51.1 2.9 rings 2
mk Skopje -> gr 39.9 22.7 rings 3
xk Pristina -> tr 41.2 28.3 rings 8
am Yerevan -> am 39.6 45.9 rings 2
hu Budapest -> hu 47.6 21.7 rings 2
sk Bratislava -> pl 49.7 19.1 rings 2
sl Freetown -> sl 9.0 -10.6 rings 3
at Vienna -> at 48.5 15.6 rings 1
it Rome -> it 40.6 9.6 rings 4
nl Amsterdam -> nl 53.4 6.7 rings 2
li Vaduz -> de 49.5 7.4 rings 4
hr Zagreb -> si 45.9 14.5 rings 2
si Ljubljana -> it 45.1 10.7 rings 4
qa Doha -> qa 24.4 51.3 rings 2
bg Sofia -> bg 42.2 25.0 rings 2
sm San Marino -> it 43.3 13.5 rings 2
ht Port-au-Prince -> ht 18.2 -72.8 rings 1
gt Guatemala City -> gt 15.2 -90.9 rings 1
mz Maputo -> mz -25.3 33.2 rings 2
bi Gitega -> bi -4.2 29.7 rings 1
me Podgorica -> gr 36.8 21.8 rings 9
ba Sarajevo -> ba 43.9 17.1 rings 1
hn Tegucigalpa -> hn 14.6 -87.0 rings 1
jo Amman -> jo 31.9 38.0 rings 3
cm Yaoundé -> cm 3.8 12.0 rings 1
tg Lomé -> tg 8.8 0.7 rings 4
gm Banjul -> gm 13.6 -15.0 rings 1
va Vatican City -> it 40.8 14.5 rings 2
xn North Nicosia -> tr 36.8 33.5 rings 1
cw Willemstad -> ve 8.8 -70.6 rings 5
tc Cockburn Town -> cu 21.4 -77.4 rings 9
tt Port of Spain -> ve 6.4 -63.1 rings 5
gd St. George's -> ve 10.3 -63.1 rings 3
vc Kingstown -> ve 5.7 -65.7 rings 12
lc Castries -> ve 8.4 -61.2 rings 9
dm Roseau -> gd 12.3 -62.0 rings 4
ms Plymouth -> ve 8.3 -65.0 rings 13
kn Basseterre -> pr 18.0 -66.4 rings 5
vi Charlotte Amalie -> co 6.3 -71.2 rings 18
bl Gustavia -> dm 14.9 -61.3 rings 4
pr San Juan -> cu 20.4 -75.2 rings 14
ai The Valley -> vg 18.7 -64.5 rings 2
vg Road Town -> co 11.3 -72.8 rings 17
je Saint Helier -> fr 46.2 0.3 rings 5
mo Macao -> cn 22.5 112.0 rings 2
```
