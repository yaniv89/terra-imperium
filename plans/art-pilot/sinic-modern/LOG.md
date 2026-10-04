# Modern Age Sinic kit: the six towns (China, Taiwan, Hong Kong, Macau, the Koreas, Japan)

Date: 2026-10-04. Sources: the kit sheets in `plans/art/kits/sinic/modern/` (`houses.png`,
`street.png`, `roofscape.png`, `materials.png`, `landmark-1` the TV tower in the manner of
Shanghai's Pearl tower, `landmark-2` the railway station). Art spec section 3b: a town is layout
x kit, so every town stands on the base Modern layout of the same size and variant
(`build_town_modern_<size>_<v>.py`, see `plans/art-pilot/modern/LOG.md`) with the kit's
buildings on its spots. Code: `scripts/blender/ti_sinic_modern.py` (imports `ti_modern.py`,
patched the way `ti_levant_modern.py` does it), builders
`build_town_modern_sinic_<size>_<v>.py <out> [atlas]`. One 2048 WebP atlas set per file. Built in
Blender 4.2 (`bpy` module).

| Object | File | Landmarks | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|---|
| town-small-a | modern-town-small-a-sinic.glb | TV tower 20 m (on the water tower's spot) | 8,280 / 3,298 / 548 | 40 m | 20.3 m | 2.4 MB |
| town-small-b | modern-town-small-b-sinic.glb | small station (on the canopy's spot), TV tower 18 m (on the clock tower's spot) | 9,716 / 4,278 / 678 | 40 m | 18.3 m | 2.7 MB |
| town-medium-a | modern-town-medium-a-sinic.glb | TV tower 32 m (glass tower), station (station) | 18,220 / 7,070 / 956 | 60 m | 32.3 m | 3.6 MB |
| town-medium-b | modern-town-medium-b-sinic.glb | TV tower 32 m (water tower, in its green) | 14,174 / 5,078 / 838 | 60 m | 32.3 m | 3.1 MB |
| town-big-a | modern-town-big-a-sinic.glb | TV tower 50 m (glass tower), station on its diagonal (station) | 25,302 / 9,200 / 1,382 | 80 m | 50.3 m | 4.2 MB |
| town-big-b | modern-town-big-b-sinic.glb | TV tower 50 m (stepped skyscraper), station (works and chimney) | 25,202 / 9,208 / 1,406 | 80 m | 50.3 m | 4.2 MB |

Every file passes `validate_model.py` (`*.validation.json` here): budgets, Town / Ground
(alpha-cut) / Team materials, one atlas set, nothing below ground, footprint and height within 5%.
Previews: `town-*-concept-vs-model.png` (the street or roofscape sheet beside the town), and
`tower-`, `station-`, `houses-concept-vs-model.png` (each sheet's beauty panel beside the part
built alone).

## Decisions
- The kit swaps the base layout's builders, not its spots (`apply()` patches `md.block`,
  `md.house`, `md.flat`, `md.tree`, `md.bench` and the named landmarks). Every house spot gets
  one of the sheet's three houses:
  - poor, the hutong lane house: one or two grey brick bodies under grey-tiled gables (about one
    in six in red tile, as on the roofscape), a walled front yard behind an arched stone gate with
    a red-brown door, a corrugated lean-to, washing on a line, grey awnings;
  - common, the walk-up: beige concrete (or dark brick, from the materials sheet) with the stair
    core up the middle of the front lit by a glass slit and rising past the roof, balconies, grey
    awnings, AC boxes, water tanks, an iron fence on stone posts in front;
  - rich, the residential tower: blue-grey glass in a beige stone frame (corner piers, a front
    fin, a slab at every floor), a stepped stone crown, a glazed lobby under a stone canopy, a
    gated compound with a pool.
  Gabled and hipped blocks and one-storey houses become hutong houses (a third of the houses two
  storeys); flat blocks become walk-ups, towers (30% of brick spots, 15% of rendered) or hutong
  houses (15%, 30% in the small towns). Walk-ups get one storey over the base block and towers
  two (small towns: none and one), so the city reads denser and taller as on the street sheet.
- Landmark 1, the TV tower, keeps the sheet's proportions (sphere centres at 18%, 58% and 74% of
  the height, sphere sizes, three columns, three raking legs with steel joints, five pods, the
  banded mast) but not its 468 m: it stands 50 m in the big towns, 32 m in the medium, 20 and
  18 m in the small, the tallest thing in each town as the sheet's tower is in Shanghai. Its legs
  land 2 to 5 m out from the axis to fit the base landmark's spot (the sheet's 160 m base is
  narrower here relative to the height).
- Landmark 2, the station: the sheet's long glass hall under a wave roof (one closed shell that
  sweeps up to the middle, turns up at its tips and pinches in at the sides as in the top view), a
  glazed skylight down the crown, branching steel columns across the front, a stone plinth with
  steps and planters, platform canopies and tracks running out both ends. It replaces the base
  station (medium-a, big-a on its diagonal), small-b's glazed canopy (with one track behind) and
  big-b's works (facing the plaza, tracks east to west). The 220 m hall becomes 6 to 10 m long and
  4 to 6 m high: at the sheet's size it would cover a whole town.
- The hall glass paints mullions on both x + y and x - y so its walls still show them on the big-a
  diagonal.
- Kept from the base kit: trees (the sheets show the same round crowns), stadium, the other water
  towers (big-a, big-b) and medium-b's works, market tents and covered market, lamps, lawns,
  asphalt and markings. The paved ground becomes a grey granite (`snm_pave` triplet). Trees and
  benches on a station's ground are dropped (`KIT['clear']`).
- New materials all carry `snm_`. No shared module was changed; no shared file (the sheets have no
  palace or walls).

## Not matched
- The towers are 4 to 5 raised storeys, not the sheet's 20-plus: taller ones would outgrow the TV
  tower and the budget's sense of scale. Balconies and greenery on the towers are not modelled.
- The sheet's mid-rise perimeter blocks round a courtyard are not built as such: the base layouts'
  separate blocks stand on their spots.
- The TV tower's lower sphere bands are simplified (pink dome, dark glass belt, one pink band);
  the podium's ring of glass halls is a single glass drum.
- The station has two tracks (one in small-b), not the sheet's dozen; its roof grid follows the
  world axes on big-a's diagonal.

## For the lead
- Wire the six files as the Sinic sub-style of the Modern towns (`-sinic` suffix). No Japan or
  Korea variants were made from these sheets; they can share these towns.
