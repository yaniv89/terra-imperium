# UI icons, art update of 13 October

Rows covered: UI14, UI15, UI16 (priority A), UI06 art part, UI17, UI07, UI08, UI11. UI18 is on hold and
was not made. Branch `claude/art-ui-icons-oct13`.

## How they are made

All 24 icons are hand-drawn SVG, original work, in the style of the delivered icons (`resources/wheat.svg`,
`resources/gold.svg`, `markers/*.svg`, `units/*.svg`): the dark `#292C29` outline at width 7 with round
joins, flat fills, no plate behind, a 256 box with the same 0.94 inset. No text, no letters, no flags or
emblems of real countries.

The drawings live in one source file, `scripts/icons/oct13-ui-icons.mjs`. Edit a drawing there, then:

- `node scripts/icons/oct13-ui-icons.mjs` writes the SVG files.
- `node scripts/icons/oct13-ui-icons.mjs --sheets` also redraws the sheets in this folder.

## Evidence in this folder

- `sheet-96.png`: every icon at 96 px on the dark panel (`#1A212B`, `--fa-panel`) and on a light map
  colour (`#C8CFA4`), with the existing wheat, gold, timber and stone icons for comparison, and the four
  capture choices in their disabled look.
- `sheet-true-sizes-4x.png`: every icon at 11, 14, 18 and 24 px, drawn at true size and then enlarged
  4 times with nearest neighbour, on both backgrounds. `sheet-true-sizes-order.txt` lists the order.
  The first four cells are the existing icons.
- `sheet-wide.png`: the capture header at 48 px high and the field edge tiled at 12 px high.

## Files and intended use

Group `battle` (`src/assets/icons/battle/`), found with `iconUrl('battle', id)`:

| File | Row | Use |
| --- | --- | --- |
| `stock-food.svg` | UI14 | Food stock and food costs. A tied wheat sheaf. |
| `stock-wood.svg` | UI14 | Wood. Three stacked logs seen from the end, rings showing. Brown and round. |
| `stock-stone.svg` | UI14 | Stone. Three cut grey blocks in a step. Grey and square. |
| `stock-gold.svg` | UI14 | Gold. Three bright yellow ingots. |
| `stock-supply.svg` | UI14 | Battle supply. A crate with a tied sack. No coins. |
| `stock-population.svg` | UI14 | Population and housing. A house with a person in it. |
| `base-marker.svg` | UI16 | The badge over a base building: a keep in a ring. Tints with the side's colour. |
| `base-status.svg` | UI16 | The same keep without the ring, for a HUD counter such as "3/5". Tints too. |
| `select-all.svg` | UI08 | Select all: four frame corners around a block of squads. |
| `find-army.svg` | UI08 | Find army: a looking glass over a pennant. |
| `close.svg` | UI11 | Close the build sheet: a plain cross. |
| `stop-working.svg` | UI11 | Stop working: a hammer under a "no" ring. Round and red, never a cross. |
| `placement-legal.svg` | UI06 | Placement label, legal: a tick in a circle. |
| `placement-blocked.svg` | UI06 | Blocked: a bar in a diamond. |
| `placement-overlap.svg` | UI06 | Overlaps a building: two squares, the shared corner marked. |
| `placement-fog.svg` | UI06 | Unexplored ground: a cloud over broken ground. |
| `field-edge.svg` | UI06 | Tiling stripe, 96x24: a pale dash and a small diamond. Repeat it along x. |

Group `ui` (`src/assets/icons/ui/`, new group), found with `uiIconUrl(id)`:

| File | Row | Use |
| --- | --- | --- |
| `capture-conquer.svg` | UI15 | Conquer: a banner planted on a wall. |
| `capture-raze.svg` | UI15 | Raze: a broken wall on fire. |
| `capture-tributary.svg` | UI15 | Make tributary: one big coin dropping into an open hand. |
| `capture-free.svg` | UI15 | Free: a gate standing open. |
| `capture-header.svg` | UI15 | Card header plate, 512x96, the middle left empty for the title. |
| `no-mans-land.svg` | UI17 | Pre-battle card badge: bare ground between two sides' pennants. |
| `hold-map.svg` | UI07 | Campaign Hold marker: a spear planted between two stakes on a thick ground line. |

Not made, on purpose: Materials (retired), a house marker (houses, landmarks and walls have no marker),
UI18.

## The disabled look

One CSS treatment, no second file: `filter: grayscale(1); opacity: 0.45`. It is the class
`.game-icon-disabled` in `src/index.css`, switched on with `<GameIcon disabled />`. The codebase already
shows disabled buttons by fading them (`opacity-50` in ActionButton), so this follows the same idea and
adds the grey so a faded Raze does not still look hot. The sheet shows the result on both backgrounds.

## Tinting the base icons

`base-marker.svg` and `base-status.svg` paint their tinted parts with `currentColor`. The root has a
default `color` (white for the marker, cream for the counter), so as a plain `<img>` they are neutral.

- In the DOM: inline the SVG (import with `?raw`) and set CSS `color` on the `<svg>` element itself.
- On a canvas atlas or a three.js sprite: draw the file as it is (white ring and keep, dark field and
  outline) and multiply by the side's colour. White becomes the side colour, dark stays dark.
- Suggested side colours are the game's own: `#5B9BF0` (you), `#EE8A3A` (enemy), `#9C8FD0` (independent).

## Suggested overlay colours for placement (UI06)

The tint is code. These are chosen from the Okabe-Ito colour-blind safe set, and every state also has
its own pattern, so no pair depends on red against green.

| State | Fill | Pattern | Outline |
| --- | --- | --- | --- |
| Legal ground | `#2FBF9B` at 28% | plain, no pattern | `#2FBF9B` solid, 2 px |
| Blocked | `#D55E00` at 38% | diagonal hatch, 45 degrees, 6 px apart | `#D55E00` solid |
| Building overlap | `#D55E00` at 38% | cross hatch (both diagonals) | `#F0E6CC` dashed |
| Resource footprint | `#F0E442` at 30% | dots, 8 px grid | `#F0E442` dotted |
| Out of play | `#10141A` at 55%, ground desaturated | plain | `field-edge.svg` tiled along the real field edge |

The four label glyphs carry the same colours and differ by shape (circle, diamond, squares, cloud).

## What is wired

- `src/data/icons.js`: the new group `ui`; `BATTLE_STOCK_ICON_IDS` and `battleStockIconUrl(res)`;
  `BATTLE_GLYPH_IDS`; `CAPTURE_CHOICE_ICON_IDS`, `UI_ICON_IDS`, `uiIconUrl(id)`.
- `EconomyHud.jsx` `ResIcon`: food, materials and gold now draw the battle stock icons, in the top bar
  (18 px) and in every cost row (10 to 14 px). It also knows `supply` and `population`.
- `BattleHud.jsx` top bar: population and battle supply draw the new icons instead of the lucide glyphs.
- `GameIcon.jsx`: the `disabled` prop.
- The sim still has one `materials` stock. It draws the Wood icon for now, and its label still reads
  "Materials". `stock-stone` is ready and unused. Nothing in the sim or the economy data changed.

## For the code session

1. Split `materials` into wood and stone in the sim, then add both to `RESOURCES`: `ResIcon` already
   resolves `wood` and `stone`. Rename the top bar label.
2. Build the capture card with `CAPTURE_CHOICE_ICON_IDS`, `capture-header` as the title's background
   (`background-size: 100% 100%`), and `<GameIcon disabled />` for a choice that is not on offer.
3. Draw `base-marker` over HQ, camp or keep and the economy and military buildings (not houses,
   landmarks or walls), tinted by side; show `base-status` beside the "standing" counter.
4. Give the build sheet's Stop working button `stop-working` (its close button keeps the lucide
   glyph), and the command bar's All and find buttons `select-all` and `find-army`.
5. Put `hold-map` on campaign units that hold, and `no-mans-land` on the pre-battle card.
6. Placement: the label glyphs, the tints above, `field-edge` as a repeating texture on the edge band.

## Second pass (review at small sizes)

- `capture-tributary` was a chest, a coin and a pennant, and turned into a blob at 16 px. It is now one
  idea: a big coin over an open hand. Checked at 14 px on the true-size sheet.
- `hold-map` was a shield, which did not say "stay here". It is now a spear planted between two stakes
  on a ground line. It has no ring (base marker), no pennant (find army) and no wall (conquer).

## Settled by the user

- The battle keeps the new `stock-food` and `stock-gold`. The campaign's `wheat` and `gold` are untouched.
- "Free" stays the open gate.
- The HUD close button keeps its one-colour lucide glyph. `close.svg` stays in the folder, unused.

## Open points

- `select-all` and `find-army` are coloured art, while the HUD buttons today use one-colour lucide glyphs.
- `resources/timber.webp` and `resources/stone.webp` stay: the campaign map still uses them.
