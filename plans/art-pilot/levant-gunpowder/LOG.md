# Gunpowder Age Levant kit: the six towns for the Levant, Mesopotamia, Arabia and Persia

Date: 2026-10-04. Sources: the kit sheets in `plans/art/kits/levant/gunpowder/` (`houses.png`,
`street.png`, `roofscape.png`, `materials.png`, `landmark-1` the tiled mosque with twin minarets,
`landmark-2` the covered souk). Art spec section 3b: a town is layout x kit, so every town stands
on the base Gunpowder layout of the same size and variant (`build_town_gunpowder_<size>_<v>.py`:
the same house spots, sizes, free centre and cobbled ground) with this kit's buildings on its
spots. Code: `scripts/blender/ti_levant_gunpowder.py` (imports `ti_gunpowder.py`, edits no shared
module; materials prefixed `lvg_`), builders `build_town_gunpowder_levant_<size>_<v>.py <out> [atlas]`.
One 2048 WebP atlas set per file.

| File | Landmarks | LOD0 / LOD1 / LOD2 | Footprint | Height | Size |
|---|---|---|---|---|---|
| gunpowder-town-small-a-levant.glb | covered souk, mosque (12 m) | 12,928 / 3,484 / 762 | 40 m | 12 m | 3.0 MB |
| gunpowder-town-small-b-levant.glb | mosque (12 m), hammam | 11,822 / 3,204 / 658 | 40 m | 12 m | 2.8 MB |
| gunpowder-town-medium-a-levant.glb | mosque (20 m), covered souk | 24,434 / 5,972 / 1,038 | 60 m | 20 m | 3.9 MB |
| gunpowder-town-medium-b-levant.glb | covered souk, mosque (20 m), hammam | 24,592 / 6,028 / 1,110 | 60 m | 20 m | 4.0 MB |
| gunpowder-town-big-a-levant.glb | mosque (28 m), covered souk, hammam, bastion | 39,933 / 9,567 / 1,030 | 80 m | 28 m | 5.4 MB |
| gunpowder-town-big-b-levant.glb | mosque (28 m, turned to the square), covered souk, hammam, bastion | 37,912 / 8,718 / 958 | 80 m | 28 m | 5.1 MB |

Every file passes `validate_model.py` (`*.validation.json` in `/tmp/claude-0/out/levant/`).
Previews: `*-kit-vs-model.png` (the street sheet beside the model), `*-beauty-test.png`.

## Decisions
- Houses, picked per spot by its plan area and the town's seed (poor under 30 m2 of plan, rich
  from 45 m2, some mixing):
  - poor: one storey of lime plaster on a rubble plinth, flat roof with a parapet, a plank porch
    over the door (a team-grey awning where the layout had one), a lattice window, a ladder, and
    a roof room or a reed pergola with jars on the roof;
  - common: a two-storey courtyard house (four wings round an open paved court with a tree), an
    ashlar plinth, an arched door, a timber kiosk with lattice screens over the door, lattice
    windows, a terracotta hip roof round the court (30% flat-roofed with a grey lead dome, as
    the street sheet's top row);
  - rich: two or three storeys, an ashlar ground floor, a blue-tiled pointed portal (pishtaq)
    with steps in the middle of the front between two timber kiosks, a court with a tree and a
    tiled fountain, then either a terracotta hip roof round the court with a turquoise dome on
    the back wing (houses.png) or a flat roof with parapets and grey lead domes (street.png).
  The courts are real openings at LOD0 and LOD1 (wings round them, a ring-shaped hip roof); LOD2
  keeps one block and a plain hip so the big towns stay near 1,000 triangles.
- Landmark 1, the tiled mosque, replaces the domed and twin-tower churches: ashlar ranges with
  pointed arcades and tile bands round a paved court with an octagonal fountain, a tiled iwan
  portal in the middle of the front between two turquoise minarets (two balconies, a small dome
  and a gilt finial), a tiled iwan on the court, a prayer hall with a tall chamber, a tiled drum
  with windows and a bulbous turquoise dome, two small domes. Sized to the church's plot (about
  10 by 10 m in medium towns, 12.5 by 13 m in the big ones); the minarets stand at the old
  church heights (20 m, 28 m) and the dome a little lower. The small towns, which had no church,
  get a 12 m mosque on a north house spot (small-a north-east, small-b north); medium-b on its
  two north-west house spots (as the Europe kit did with its church).
- Landmark 2, the covered souk, replaces every town hall: two crossing buff-brick arms under
  grey tile barrel vaults, cut-stone arched gates at the four ends, small arched windows, an
  octagonal lantern with a tile pyramid over the crossing, shops with lattice fronts and canvas
  awnings in the four corners, crates and jars outside, two small team banners at the front gate.
  Its plan follows the hall's spot (deeper than the hall, capped at about 0.85 of its width).
- The windmills become a hammam (a plaster bathhouse under a lead dome studded with glass oculi
  and two small domes, a tiled panel over the door, a square windcatcher with slotted vents);
  the roofed wells become octagonal fountains with a tiled band; the iron lamps lanterns on
  timber posts; barrels jars; small-b's rail fences low rubble walls with a plaster cap; about
  two in five trees cypresses. Stalls (team-grey canopies), gardens, the big towns' bastions and
  the cobbled ground come unchanged from the base layouts; the street sheet shows the same grey
  awnings and stone paving.

## What does not match the sheets
- The sheets' houses are deeper and busier (galleries round the courts, vines, stairs, carved
  brackets, rich pottery); at map scale these are reduced to the court, one kiosk or two, lattice
  windows and a few jars.
- The mosque is much smaller than the sheet's 24 by 24 m (it must fit the church plots), so its
  ranges have fewer arches; the muqarnas in the portal niche is a plain cream niche.
- The rich houses' turquoise dome sits on a short tiled drum that reads a little like a can at
  close range.
- The souk's vault tile is grey as drawn on the sheet, although the sheet's label says terracotta.
- The sheets have no windmill or civic-tower equivalent; the hammam with its windcatcher is my
  choice for those spots.
- In the big towns (28 m minarets on a 12.5 m plot) the prayer-hall chamber under the dome stands
  about 11 m above the ranges and reads as a square tower; the sheet's chamber is lower and its
  dome wider. A lower cap on the chamber (about 0.3 of the height) would fix it; not rebuilt
  because the shared machine was running out of memory (two big builds were killed).
