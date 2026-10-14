# UI18: city-state type badges and the patron mark

Branch `claude/art-ui18-citystates`, from `origin/claude/integration` at 81827a10.

## Files

All in `src/assets/icons/independents/`, hand drawn, original, in the house style (`#292C29` outline at
width 7, flat fills, 256 box, the 0.94 inset). No text, no letters, no real emblems. Source:
`scripts/icons/ui18-citystate-icons.mjs` (`--sheets` redraws the sheets here).

| File | Use |
| --- | --- |
| `citystate-trade.svg` | Trade city-state: a cream amphora on a `#CA8A04` disc. |
| `citystate-military.svg` | Military: a crested helmet, front view, on a `#57534E` disc. |
| `citystate-science.svg` | Science: an open book on a `#2563EB` disc. |
| `citystate-culture.svg` | Culture: a temple front on a `#9333EA` disc. |
| `citystate-raiders.svg` | Raiders: two crossed axes on a `#C2410C` disc. |
| `citystate-patron.svg` | Patron mark, "they favour you": a gold favour rosette with two ribbon tails in the player's blue `#5B9BF0`. |

The disc colours are the data's own (`CITY_STATE_TYPES[*].badge` in `src/data/cityStates.js`); a test
checks each file carries its type's colour.

## Why medallions, not shields

An independent's personality is already a heater shield in its colour (`raiders`, `mercantile`,
`fortress`, `tribal`). The data gives three city-state types the same colours as three personalities
(trade and mercantile `#CA8A04`, military and fortress `#57534E`, raiders and raiders `#C2410C`), so
colour alone cannot keep them apart. The type badges are therefore a separate family: all round
medallions, so the outline shape says "type", the shield says "personality". Inside the family the five
differ by glyph shape (jar, helmet, book, temple, axes) and by disc colour.

## Where they show and at what size

The code has no map sprite for city-states, so only two places use them:

- The independent sheet's type line (`CityStateBadge.jsx`): the badge at 20 px, the patron mark at 14 px
  after the type name when the player is the patron.
- The independents list row (`IndependentsList.jsx`): the badge at 14 px before the type text, and the
  patron mark at 14 px when the city-state favours the player ("(yours)" stays as text).

## Evidence

- `sheet-96.png`: the six icons at 96 px next to the four personality shields, on the panel colour and a
  light map colour.
- `sheet-true-sizes-4x.png`: every icon at 11, 14, 18 and 24 px on the list row colour, the panel and the
  light map colour, enlarged 4 times with nearest neighbour (order in `sheet-true-sizes-order.txt`).

Iterations: the first raiders badge drew both axe blades on top of each other (one blade showed), so the
blades now face outward; the helmet crest and the rosette tails were enlarged to read at 14 px.

## What is wired

- `src/data/icons.js`: `CITY_STATE_ICON_IDS`, `CITY_STATE_PATRON_ICON_ID`, `cityStateIconUrl(type)`,
  `cityStatePatronIconUrl()` (group `independents`).
- `cityStateView.js`: the view now has `iconUrl` and `patronUrl` (`patronUrl` only when the patron is you).
- `CityStateBadge.jsx`: draws the badge through `GameIcon`, with the old lucide disc as the fallback, and
  the new `PatronMark`.
- `IndependentsList.jsx`: badge and patron mark in the row.
- `src/data/icons.test.js`: every type has a distinct badge, the patron mark resolves, no text or
  embedded images, the 256 box, each badge in its type colour.

## Open points

- `CITY_STATE_TYPES[*].icon` (the lucide names) is now only the placeholder's glyph.
- If city-states later get a map sprite, the medallions read down to 11 px on the panel; on the light map
  colour the military disc is the weakest (dark grey), but its cream helmet still carries it.
