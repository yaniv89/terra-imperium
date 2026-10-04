# Israelite national wonders

Branch `game/israelite-wonders`. Two wonders that only cities on Israel's land can build, their
models on the close view, and their place in the city build list.

## 1. The rule: Israel's land, not Israel's ownership

A national wonder carries `homeland: 'il'` (src/data/greatProjects.js). It needs:
- a city whose centre stands on a tile of country `il` (new site rule `homeland`), and
- a wonder tile in that city's border that is also `il` land and fits the tile rule
  (Solomon's Temple on hills, Masada on desert; src/engine/wonders.js `wonderSites`).

Why the land and not the owner: every site rule in greatProjects.js is a property of the place
(a capital, a coast, a building), and a wonder's owner is always derived from whoever holds its
city (`getGreatProjectOwner`). Keeping the rule on the land fits both: a conqueror of Jerusalem
may build there and holds what stands there, as with every wonder; an owner rule would let
Israel raise Masada in a conquered Rome. The grid has 6 `il` tiles; Jerusalem (c82398) starts on
one with three more in its border (one plains hills, two desert hills), so both wonders fit it.
Like every wonder each is unique in the world (`state.greatProjects[id]`), and the AI builds them
as the owner of the city (aiProduction.js, unchanged).

## 2. The wonders

| Id | Age | Tile | Tier 1 / 2 / 3 (its city only) | Prestige |
|---|---|---|---|---|
| `solomons_temple` | Bronze | hills of Israel's land | culture +2 / +3 / +4 a turn, loyalty +5 / +10 / +15 | 10 / 20 / 30 |
| `masada` | Classical | desert of Israel's land | fort level +2 / +4 / +6, wall siege HP +50% / +100% / +150% | 10 / 20 / 30 |

Cost and turns are the shared wonder ladder (wonderCost: 4 / 6 / 8 turns x 25 production), the
prestige is the same as every Bronze and Classical wonder. Sizing: a Culture building tier is +2
culture; a garrison unit is +10 loyalty; a Defense building tier gives fort level 1 / 2 / 4 / 6
(5% less damage taken in an assault per level). So the temple is one to two Culture buildings
and a governor's worth of loyalty in one city; Masada doubles to triples the walls' siege HP and
takes 10 to 30% off assault damage there. Neither touches any other city or the nation's sheet.

## 3. How the city effects are wired

A tier may carry `cityEffects` (registry keys `local.culture`, `local.loyalty`, `local.fortLevel`,
`local.wallHp`). `cityWonderLines(greatProjects, cityId)` (greatProjects.js) is the one reader,
cached per `state.greatProjects` object, so a lookup per city per turn is a Map get.
- culture: resolveTurn's city context adds it to `cultureBonus` (the city's culture yield, so
  its border growth); the city panel's live yields show it.
- loyalty: `loyaltyTarget` adds a `wonder` part (shown in the city politics card and the
  province card).
- fort level: `getRegionModifier` / `getRegionModifierTotals` add the wonder lines, so the
  assaults that already read `local.fortLevel` (invasion.js, defense.js, the reducer's
  invasion, the tactical keep through defense.js) take it with no other change.
- wall HP: `siegeMaxHp(city, greatProjects)` (sieges.js); every caller passes
  `state.greatProjects` (the siege phase, the AI's assault check, the army sheet, the battle
  tile context).

## 4. Models on the close view

The close view did not draw wonders. Now (src/components/map/closeView/wonderAssets.js and
CloseViewLayer.jsx): a built wonder whose tile still carries it, on a land tile, with a file
`src/assets/map/wonders/<id>.glb` (objects `tier1`, `tier2`, `tier3`, each with LOD0..LOD2), is
drawn on its own tile showing the built tier (or the highest tier the file has below it), LOD by
zoom, Team tinted in the owner's colour, ground tinted into the land. Scale follows the towns:
`townUnitPx` with the model's measured radius (up to 120 m), capped by the coast and by half the
gap to the next town; a wonder tile with a model counts as a town for that gap, so a city and
its wonder never grow into each other. With no files nothing changes (the banner and the flat
map's star stay). The model files themselves come from the art branch (art/maghreb-westafrica)
and are not part of this branch.

## 5. UI

Every wonder now has an icon (src/components/city/wonderIcons.js, lucide; Solomon's Temple a
temple front, Masada a castle), shown in the city build list (with the wonder's description),
the province card's Great projects section and the Great Projects list. A city that cannot build
them never sees them in its list; the reason text says "Only a city on Israel's land can build it."

## 6. Checks

- src/engine/israeliteWonders.test.js: sizes match the age, who may build (Jerusalem yes,
  Cairo no, a conqueror of Jerusalem yes, the player never for an AI city), the build through
  the turn (tile mark, prestige, the next tier), and each effect on its own city only.
- src/components/map/closeView/wonderAssets.test.js, src/components/city/wonderIcons.test.js.
- Balance (`PLAYER=au compare.sh a1b70b6 150 11-14`): no metric significant; nonFinite and
  auditViolations 0 on every seed. The runs are not bit-identical: AI Israel builds Solomon's
  Temple (AI parity, aiProduction.js), which changes Jerusalem's queue, and the world drifts
  from there by chaos (wars 7.5 to 5.75, CI [-9.4, 5.9]; plague cities up, CI crossing 0). A
  control run with the AI barred from national wonders (temporary patch, seeds 11-12) was
  identical to base on all 55 metrics, so the wonders themselves move nothing outside Israel.
- Browser: first block-out stand-ins, then the delivered models from art/maghreb-westafrica
  (copied in for the check only, not committed), on tiles 82473 and 82474 beside Jerusalem at
  zoom 40, 60 and 100, tier 1 and tier 3: the built tier shows, LODs switch, the scale stays
  inside the hex, no page errors.
- Art note for the model branch: both files stand on a large round ground disc in the `Town`
  material, which reads near black on the desert. Naming that disc's material `Ground` (as the
  towns do) lets the close view tint it into the land (groundBlend.js), or the disc can go.
