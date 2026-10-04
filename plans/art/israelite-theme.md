# Terra Imperium: the Israelite theme (an add-on to the art list)

This file adds a new art theme, **`israelite`**, for the ancient kingdoms of Israel and Judah and
the land of Israel through the later ages. It is an **addition** to `plans/art-image-spec.md`:
every item here follows that spec's rules (views, scale, team colour, what not to draw) and is
**delivered as Blender** exactly as `plans/art/blender-delivery-spec.md` says (objects, names,
units, materials `Town` / `Team` / `Ground`, budgets, `model.glb` + `model.blend` + `preview.png`).
Units follow `plans/unit-art-brief.md` (v3): rig, bone names, materials, clips, budgets.
Where this file and those disagree on **what** to make, this file wins; on **how** to deliver,
they win.

74 items in all (section 9 has the count and the batches).

---

## 1. What the theme is

- **Style id:** `israelite`. It is a sub-style of `levant`: anything not delivered here falls back
  to the Levant kit, so items can land one batch at a time.
- **Where it shows:** cities on the land of modern Israel (game id `il`), in every age. Palaces
  and units follow the owner nation (a city founded or held by `il`).
- **The ages in this land** (the game's ages, with the period each one draws):

| Game age | Years | What to draw |
|---|---|---|
| bronze | 2000 to 800 BCE | the early Israelite highland villages and the united and northern kingdoms (Iron Age I and IIA: Hazor, Megiddo, Gezer, Samaria) |
| classical | 800 BCE to 500 CE | Judah of Hezekiah and Josiah (Lachish, Jerusalem), then the Hasmonean and Herodian kingdom and the Galilee of the Mishnah |
| kingdoms | 500 to 1500 | the Galilee and Tiberias of the Talmud and the Masoretes, Jerusalem's medieval citadel |
| gunpowder | 1500 to 1900 | Safed, Tiberias and Ottoman Jerusalem, the first neighbourhoods outside the walls |
| modern | 1900 on | Tel Aviv's White City, Jerusalem stone, the kibbutz, today's towers |

### 1.1 Rules for this theme
- **Real archaeology, not fantasy or Bible illustration.** Base every building, house and kit on
  excavated sites and standard reconstructions (the sites are named in each row). When in doubt,
  plain and believable beats grand.
- **Materials of the land:** pale limestone (warm cream to grey), dressed ashlar with **drafted
  margins** for royal and Herodian work, fieldstone for houses, mud brick on stone footings in
  the bronze age, plastered flat roofs on wooden beams, cedar and olive wood, terraced hills.
- **Ornament** only as carved relief from the sites: proto-Aeolic (volute) capitals, vines,
  grapes, pomegranates, palm trees, rosettes, a menorah in relief on a synagogue lintel.
- **No text of any kind** (no Hebrew, no inscriptions), **no flags with emblems**: flags and
  banners are plain `Team` cloth; the game tints them.
- **No religious figures, no people at worship, no Ark of the Covenant.** Buildings only, as
  architecture.
- **No modern military or national insignia** on units or buildings.

---

## 2. Regional kits (30 items)

Folders: `plans/art/kits/israelite/<age>/<item>/`. Each age has the six kit items of
blender-delivery-spec 3.1 to 3.4: `houses` (objects `house-poor`, `house-common`, `house-rich`,
plus props), `street`, `roofscape`, `materials`, `landmark-1`, `landmark-2` (one object
`landmark` each, 12 to 25 m across, never more than 30 m).

**bronze**
- `houses`: the **four-room house**: a stone footing, mud-brick or fieldstone walls, a row of
  stone pillars down the middle, a flat roof of beams, brush and rolled clay with a low parapet.
  Poor: a two-room house with a fenced yard. Common: the classic four-room house, one storey with
  a roof terrace and a ladder. Rich: a two-storey four-room house with a walled courtyard.
- props: `prop-well` (a plastered cistern mouth with a stone lid), `prop-jars` (collared-rim
  storage jars in a row), `prop-shrine` (a small horned altar of stone), `prop-cart`, `prop-tree`
  (an olive tree), a stone roof roller.
- `street`: packed earth lanes, houses back to back in a ring round the edge of the town
  (the "casemate" village layout).
- `materials`: limestone, mud brick, roof clay, olive wood, plaster, team cloth.
- `landmark-1`: a **six-chamber city gate** with two towers (Megiddo, Hazor, Gezer).
- `landmark-2`: a **pillared storehouse** with three aisles and rows of stone pillars
  (Hazor, Megiddo, Beersheba).

**classical**
- `houses`: courtyard houses of fieldstone and lime plaster, flat roofs with a parapet, an
  outside stair. Rich: a Herodian mansion with ashlar walls, a peristyle and a stepped
  ritual bath at the side (the Jerusalem Upper City mansions).
- props: a stepped water pool, an olive press (a crushing basin with a beam and weights),
  amphorae, a dovecote niche wall, a date palm, a stall with a `Team` awning.
- `street`: paved lanes with a drain and stepped streets on the slope (the stepped street of
  Jerusalem).
- `materials`: drafted-margin ashlar, fieldstone, lime plaster, roof plaster, cedar, team cloth.
- `landmark-1`: a **Galilean synagogue**: a basilica hall with two rows of columns and a gabled
  facade with three doors facing the street (Capernaum, Gamla, Kfar Baram).
- `landmark-2`: a **Herodian tower**: a tall square tower of drafted ashlar on a sloping base,
  a crenellated top (the Phasael tower of Jerusalem's citadel).

**kingdoms**
- `houses`: stone houses with cross-vaulted rooms and flat roofs, small arched windows, courtyard
  walls (Galilee and Tiberias).
- props: a well with a stone curb, a vine on a pergola, a loom, a fishing boat pulled up (for
  lakeside towns), jars.
- `street`: cobbled lanes with stone steps and arches over the lane.
- `landmark-1`: a **Byzantine-period synagogue** with an apse, a basalt facade and a tiled roof
  (Bet Alpha, Hammat Tiberias).
- `landmark-2`: the **medieval citadel tower** of Jerusalem: a square keep of big ashlar with a
  smaller round tower beside it.

**gunpowder**
- `houses`: Ottoman-era stone houses with **domed roofs** (Jerusalem's roofscape of small domes),
  arched windows, iron grilles. Rich: a two-storey house with a balcony on stone corbels.
  Common: the 19th-century row house with a tile roof (the first neighbourhoods outside the walls).
- props: a public fountain (sabil), a windmill (a short stone tower with sails), a cart, a
  lemon tree, jars.
- `street`: stone-paved stepped alleys, a covered market lane.
- `landmark-1`: a **great domed synagogue**: a tall square stone hall with a big dome on a drum
  and arched windows (the Hurva of 1864).
- `landmark-2`: an **Ottoman city gate**: a crenellated gate tower with a pointed arch and a bent
  entrance (Damascus Gate, Jaffa Gate).

**modern**
- `houses`: **Bauhaus white blocks** on pilotis with ribbon balconies and rounded corners
  (Tel Aviv's White City); common: a four-storey Jerusalem stone apartment block with solar
  water heaters on the roof; poor: a kibbutz cottage with a red tile roof and a porch.
- props: rooftop solar water heaters (a tank and a panel), a ficus tree, a bus stop, a palm.
- `street`: asphalt with sand-coloured sidewalks and a boulevard of trees in the middle.
- `landmark-1`: a **group of three office towers** on one podium: one round, one triangular, one
  square in plan (generic glass, about 50 m at game scale).
- `landmark-2`: a **kibbutz water tower**: a concrete tank on legs with a lookout platform.

---

## 3. Palaces, walls, camp and fields (15 items)

Folders: `plans/art/towns/<age>/<id>-israelite/`. Sizes and object names as
blender-delivery-spec 3.5.

| Id | Age | Object(s) | What it is |
|---|---|---|---|
| `palace-small-israelite` | bronze | `palace` | a royal residency of ashlar with proto-Aeolic capitals on the door posts (Ramat Rachel, Megiddo palace 6000) |
| `palace-israelite` | bronze | `palace` | the **Samaria acropolis palace**: a terrace wall of fine drafted ashlar, a courtyard, a two-storey hall, volute capitals |
| `palace-small-israelite` | classical | `palace` | a Hasmonean fortified palace: a square block with corner towers (the Jericho winter palaces) |
| `palace-israelite` | classical | `palace` | **Herodium**: the cone-shaped hill fortress with a round wall and four towers, one taller (12 m across here, keep the cone silhouette) |
| `palace-small-israelite` | kingdoms | `palace` | a Galilean stone manor with a vaulted ground floor and a roof terrace |
| `palace-israelite` | kingdoms | `palace` | a stone keep with a walled court on a rock (the medieval citadel form) |
| `walls-medium-israelite` | bronze | `walls`, `tower`, `gate` | a **casemate wall** (two parallel walls with rooms between) with offsets and insets; the gate is a smaller six-chamber gate |
| `walls-medium-israelite` | classical | `walls`, `tower`, `gate` | a Hasmonean and Herodian wall of drafted ashlar with square towers |
| `walls-medium-israelite` | gunpowder | `walls`, `tower`, `gate` | Jerusalem's Ottoman walls: crenellated, square towers, a gate in the style of landmark-2 |
| `colony-camp-israelite` | bronze | `camp` | a highland settlers' camp: black goat-hair tents, a stone sheepfold, a fire, jars, a `Team` pennant |
| `colony-camp-israelite` | modern | `camp` | a **tower and stockade** outpost: a wooden watchtower, a double wooden wall filled with gravel, two huts, a `Team` flag |
| `field-1-israelite` | all early ages | `field` | hill terraces of barley with a stone threshing floor |
| `field-2-israelite` | all early ages | `field` | an olive grove on terraces |
| `field-3-israelite` | all early ages | `field` | a vineyard with a stone watchtower and a wine press cut in the rock |
| `field-4-israelite` | all early ages | `field` | a date palm grove with an irrigation channel (the Jordan valley) |

---

## 4. Buildings (10 items)

Folders: `plans/art/buildings/<id>-israelite/`. One object `landmark`, rules of
blender-delivery-spec 3.3 (10 to 20 m footprint). These replace the base building in an
Israelite town.

| Id | Age | What to draw |
|---|---|---|
| `granary-israelite` | bronze | a big round stone-lined grain silo with two spiral stairs (Megiddo) |
| `barracks-israelite` | bronze | pillared chariot stables with stone troughs and a yard (Megiddo) |
| `shrine-israelite` | bronze | a fortress sanctuary: a walled court with a four-horned altar of fieldstone and a small hall (Arad) |
| `copper_mine-israelite` | bronze | the Timna copper works: a smelting camp, furnaces, slag heaps and a sandstone cliff |
| `irrigation-israelite` | classical | a rock-cut water system: a stepped shaft into the hill, a stone-lined pool (Siloam, Hazor) |
| `market-israelite` | classical | a market square inside a city gate: stone benches, stalls with `Team` awnings |
| `library-israelite` | classical | a scroll hall: a plastered long room with benches and jars for scrolls, a cistern beside it (Qumran) |
| `harbor-israelite` | classical | a Herodian harbour: two concrete breakwaters with towers at the mouth, warehouses (Caesarea) |
| `workshop-israelite` | classical | an olive oil works: a crushing basin, two beam presses with stone weights, jars |
| `scriptorium-israelite` | kingdoms | a study house: a vaulted stone hall with benches round the walls and a courtyard (Tiberias) |

---

## 5. Wonders (2 items, three tiers each)

Folders: `plans/art/wonders/<id>/`. One file, objects `tier1`, `tier2`, `tier3` at the same
origin, up to 120 m across (blender-delivery-spec 3.8). Tier 3 must read at 40 pixels.

| Id | Age | The three tiers |
|---|---|---|
| `solomons_temple` | bronze | the First Temple and royal quarter, after the standard reconstructions (a long-room temple: porch, hall, inner room). 1: the stone platform with the great altar and the bronze basin on its oxen; 2: the temple itself, cedar and ashlar, with the two free-standing bronze pillars at the porch; 3: the temple in its courts, with the royal palace and the pillared **House of the Forest of Lebanon** beside it |
| `masada` | classical | Herod's fortress on the mesa. 1: the casemate wall round the flat summit with towers; 2: storehouses, a bath house and the western palace inside; 3: the three-terrace **northern palace** hanging off the cliff edge, and the Roman siege ramp on the west side |

Show buildings only: no figures, no ritual objects on display other than the altar and the
basin of tier 1.

---

## 6. Tile improvements (6 items)

Folders: `plans/art/improvements/<age>/<id>-israelite/`. One object `improvement` on a 50 by 50 m
patch with its own `Ground` (blender-delivery-spec 3.8).

| Id | Age | What to draw |
|---|---|---|
| `farm-israelite` | ancient | terraced barley and wheat on a hill, a round threshing floor, a fieldstone hut |
| `plantation-israelite` | ancient | olive terraces with a rock-cut olive press and a watchtower of stone |
| `pasture-israelite` | ancient | a stone sheepfold with goats and sheep, a shepherd's shelter, a cistern |
| `fishing_boats-israelite` | ancient | two Sea of Galilee fishing boats (about 8 m, one mast, the Ginosar boat) on a basalt shore, nets on racks |
| `fort-bronze-israelite` | bronze | a square desert fortress with a casemate wall and corner towers (Arad, Kadesh Barnea) |
| `fort-modern-israelite` | modern | a tower and stockade post (the same look as the modern camp, smaller) |

---

## 7. Units (11 items)

Folders and files exactly as `plans/unit-art-brief.md` v3, with the unit id
`<age>-<class>-israelite` (for example `blend/bronze-ranged-israelite.blend`). Same rig, bone
names, materials (`Team`, `Skin`, `Hair` and the descriptive ones), budgets, clips and
archetypes as the base unit of that age and class. Only the kit changes. Team colour on the
tunic, shield face or vehicle stripe, 15 to 20% as the brief says.

| Id | Name | Look (from the reliefs and finds) | Archetype |
|---|---|---|---|
| `bronze-infantry-israelite` | Israelite Spearmen | a knee-length tunic with a belt, a headband or a simple cap, a round shield of hide on wood, a spear, a short sword | as `bronze-infantry` |
| `bronze-ranged-israelite` | Slingers | a short tunic, a headband, a woven **sling** whirled overhead, a pouch of sling stones at the hip, no armour (the Benjaminite slingers) | foot thrown: as the base bronze ranged, the bow draw replaced by an overhead sling whirl and release |
| `bronze-cavalry-israelite` | Chariots of Israel | a light chariot with two horses, a driver, an archer and a shield-bearer (three crew, as the Assyrian records describe Israel's chariotry) | as `bronze-cavalry` |
| `classical-infantry-israelite` | Judahite Spearmen | the Lachish relief: a short tunic, a scale coat for the front rank, a **headdress with long ear flaps** wound round the head, a round shield, a spear | as `classical-infantry` |
| `classical-ranged-israelite` | Judahite Slingers | the Lachish relief slingers: a tunic, the wound headdress, a sling, a stone pouch; the back rank are archers with a composite bow | as the bronze slingers |
| `classical-cavalry-israelite` | Hasmonean Horse | a Hellenistic horseman: a linen cuirass, a bronze helmet, a lance, a round shield, a saddle cloth (`Team`) | as `classical-cavalry` |
| `classical-siege-israelite` | Hasmonean Catapult | a Hellenistic torsion stone-thrower on a timber frame with two crew | as `classical-siege` |
| `modern-infantry-israelite` | Infantry (olive) | olive-green fatigues, a helmet with a cloth cover, a vest with pouches, a compact assault rifle; no badges or insignia | as `modern-infantry` |
| `modern-cavalry-israelite` | Tanks (front engine) | a generic main battle tank with the **engine at the front**, a low wedge-shaped turret, a rear door in the hull, chains hanging under the turret back; no real type and no markings | as `modern-cavalry` |
| `settler-bronze-israelite` | Settler | a family with a donkey carrying packs, a few goats, a staff with a `Team` pennant | as `settler` |
| `settler-modern-israelite` | Settler | an open truck with pioneers, crates, water tanks, a folded watchtower kit, a `Team` flag | as `settler` |

Kingdoms and gunpowder units use the base Levant roster (there was no Israelite army in those
ages); no sheet is needed.

---

## 8. Checks before you hand over

Everything in blender-delivery-spec section 4 and unit-art-brief section 12, plus:
1. No text, letters or emblems anywhere; flags are plain grey `Team`.
2. No people in buildings, wonders or improvements.
3. Every landmark under 30 m across, every palace inside its 8 m or 12 m footprint.
4. A note in each item's folder (`notes.md`, a few lines) naming the site it follows.

---

## 9. Count and batches

| Section | Items |
|---|---|
| 2. Kits (5 ages x 6) | 30 |
| 3. Palaces, walls, camps, fields | 15 |
| 4. Buildings | 10 |
| 5. Wonders | 2 |
| 6. Improvements | 6 |
| 7. Units | 11 |
| **Total** | **74** |

Deliver as zips of about five items, in this order, so each batch goes into the game on its own:
1. Bronze kit (6), then bronze palaces and wall (3), camp and fields (5).
2. Classical kit (6), classical palaces and wall (3).
3. Wonders (2): `solomons_temple`, `masada`.
4. Buildings (10).
5. Kingdoms, gunpowder and modern kits (18), their palaces and walls (3), the modern camp (1).
6. Improvements (6).
7. Units (11) last: they take the longest (rig and clips).

---

## 10. What the game does with it (for the developer, not for GPT)

- `src/data/architecture.js`: add `israelite` for `il` in every age, with
  `STYLE_FALLBACK.israelite = 'levant'`, so a missing item shows the Levant one.
- Kits, palaces, walls, camp and fields: assembled into `src/assets/map/towns/<age>-town-*-israelite.glb`
  and `src/assets/map/shared/shared-<age>-israelite.glb` by the existing kit assembler.
- Buildings and improvements with the `-israelite` suffix: the close view picks the styled
  model first and falls back to the base one (needs a small lookup change).
- Wonders `solomons_temple` and `masada` are new wonder ids: they need game data (cost, effect,
  who can build them) through the add-mechanic process before they appear.
- Units `<age>-<class>-israelite`: the roster needs a per-nation unit variant lookup (the battle
  setup picks `<age>-<class>-<style>` first, then the base unit).
