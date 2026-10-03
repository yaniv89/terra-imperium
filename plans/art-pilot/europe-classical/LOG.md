# Classical Age towns in the Europe kit (art spec 3b), built in Blender

Date: 2026-10-03. Sources: `plans/art/kits/europe/classical/` (houses, street, roofscape,
materials, landmark-1 Roman temple, landmark-2 aqueduct arch, landmark-north Celtic hillfort hall;
READMEs beside them). Kit: `scripts/blender/ti_europe_classical.py` (materials `euc_*`; it reuses
ti_classical.py's gable_roof, temple, cypress, shrub and court_wall unchanged). Towns:
`scripts/blender/build_town_classical_europe_<size>_<v>.py` on the layouts of
`build_town_classical_<size>_<v>.py` (the same house spots, sizes, yaws, free centre, ground).
Northern pair: `ti_europe_classical_north.py` (the hall, built from the Bronze Europe kit's
thatch, daub, oak and wattle) and `build_town_classical_europenorth_small_<v>.py`.
Files: `classical-town-<size>-<v>-europe.glb` (and `-europenorth` for the northern pair); the
object inside keeps the base name `town-<size>-<v>`.

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| classical-town-small-a-europe | 9,674 / 2,408 / 572 | 41 m | 7.6 m | 2.3 MB | passed |
| classical-town-small-b-europe | 9,100 / 2,604 / 704 | 41 m | 7.5 m | 2.4 MB | passed |
| classical-town-medium-a-europe | 23,396 / 5,202 / 1,094 | 61 m | 12.6 m | 3.6 MB | passed |
| classical-town-medium-b-europe | 21,690 / 5,016 / 1,144 | 61 m | 12.6 m | 3.5 MB | passed |

Budgets: a whole town 60,000 / 10,000 / 1,500; one 2048 WebP atlas set per file. Previews:
`<size>-<v>-europe-concept-vs-model.png` (the street sheet beside the model) and `-top.png`.

## What stands where
- small-a: the Roman temple (5 x 7 m on its podium, 7.5 m) in the base temple's spot; an atrium
  domus at the north-east, town houses and ochre cottages down the west, a street shrine and a
  well at the south-east.
- small-b: a small temple in the base's landmark corner (north-east); a domus and a town house
  along the north, town houses and cottages behind the garden walls each side.
- medium-a: the temple (9 x 13 m, 12 m) at the north-west; the aqueduct's three arches (19 m long,
  12 m high) along the east edge in place of the stoa, the market stalls before it; three domus
  houses (one on the north row, two on the forum ring).
- medium-b: a temple at the north-east corner; the aqueduct (20 m) along the east garden-wall
  line between the inner ring and the east row; three domus houses, the market at the south-west.

## Decisions
- House types follow the sheet: poor = the ochre-plastered cottage (Roman brick showing through)
  with its gable to the street, a tiled lean-to, a timber pergola and a rubble garden wall with a
  gate; common = the cream town house with a red-ochre dado, shuttered windows in two rows, a
  stone door frame and step, a tiled hip roof round a small open court with a shrub, a team-cloth
  awning on brackets; rich = the atrium domus: a four-column porch under its own hip, the atrium
  roof round an impluvium pool, and (where the plot is deep) a peristyle garden behind with a
  colonnade, lean-to roofs and two cypresses. The type follows the base house's size and place.
- The compluviate roof is one closed ring solid (outer eaves, a ridge ring, inner eaves sloping
  into the court); LOD2 swaps it for a plain hip so the medium towns stay near 1,100 at LOD2.
- Ground: grey-beige stone slabs (`euc_paving`), the square and the streets lighter beige. Finer
  slabs striped at the game zoom (the bake cannot hold them), so the slabs are 5 x 3.6 m.
- The temple is ti_classical's temple with the sheet's pilasters down the cella and cheek walls
  beside the stair; the aqueduct is new: piers with imposts, true semicircular openings (a
  spandrel wall per bay with its soffit), voussoir rings, pilasters, a cornice and the open water
  channel between parapets.

## The northern variant (Celtic hillfort hall)
`classical-town-small-a-europenorth.glb` and `classical-town-small-b-europenorth.glb`: the two
small Europe towns with the hall (8 x 12 m, 6 m) on a banked, grassed enclosure with a short
palisade in place of the temple. See the table added below when built.

## Not matched
- Window glass, door ironwork and roof tile relief are procedural; the sheets' plants (vines,
  potted olives) are reduced to potted shrubs and cypresses.
- Plot curbs of the street sheet are not drawn (the base layouts pack plots too tightly).
