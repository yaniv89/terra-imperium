# Plan: the peoples pool, world sizes and the new start screen

Date: 2026-10-04. Status: proposal for review, nothing implemented yet.
Builds on `plans/independent-cities.md` (major nations plus independent cities) and
`plans/eras-origins-and-future.md` (the nine ages). This plan is phase **W0**, before W1.

---

## 0. What the user asked for

1. Check every art theme on the `claude/bronze-towns` branch (and the art plans: what exists,
   what is missing, what is coming).
2. A **new pool of nations**: ancient empires and peoples with **new names**, fewer than 240.
   Several may share an art theme. The **Kingdom of Israel must be in it**. **No nations copied
   from Civilization.** Names researched on the web.
3. The **full 240-nation option is commented out** for now.
4. World size becomes **styled, rounded radio buttons** like the difficulty ones but rounder,
   with **3 options**; the counts are mine to decide (not too empty, not too crowded).
5. Plan it (do not build yet).

---

## 1. The art themes (surveyed on `claude/bronze-towns`, 2026-10-04)

**How art follows nations** (`src/data/architecture.js`, art spec 3b):
- **Towns follow the land**: a city is drawn in the theme of the modern country its tile is in,
  whoever owns it. New nation names do not touch town art at all.
- **Palaces follow the owner nation's theme** (art spec 3b.5), and theme units (the Israelite
  theme has its own) follow the owner. So **every nation in the pool needs a theme**.
- Themes fall back: a sub-theme with no model uses its parent, a missing age uses the age's
  base kit. Nothing ever renders empty.

**The themes:**

| Theme | Parent | Lands | Bronze | Classical | Kingdoms | Gunpowder | Modern |
|---|---|---|---|---|---|---|---|
| `nile` | | Nile and Horn | yes | yes | yes | yes | yes |
| `levant` | | Levant, Mesopotamia, Arabia, Persia, Anatolia | **no** (base kit a, Mesopotamian, stands in) | yes | yes | yes | yes |
| `israelite` | levant | Israel | planned | planned | planned | planned | planned |
| `maghreb` | | Maghreb and Sahel | yes | yes | yes | yes | yes |
| `westafrica` | | West and Central Africa | yes | yes | yes | yes | yes |
| `eastafrica` | | East and Southern Africa | yes | yes | yes | yes | yes |
| `europe` | | Europe | yes | yes | yes | yes | **no** |
| `europenorth` | europe | beyond Rome's frontier (Classical only) | | yes | | | |
| `easteurope` | europe | the Orthodox east (from Kingdoms) | | | yes | | |
| `colonies` | europe | lands of European settlement (from Gunpowder) | | | | yes | |
| `andalus` | levant | Iberia in the Kingdoms age | | | (levant) | | |
| `steppe` | | Central Asia and the plateau | yes | yes | yes | yes | **no** |
| `indic` | | South Asia | yes | yes | yes | **no** | **no** |
| `sinic` | | East Asia | yes | yes | yes | yes | yes |
| `japan` | sinic | Japan | | | yes | yes | |
| `korea` | sinic | Korea | | | yes | | |
| `monsoon` | | Southeast Asia | yes | yes | yes | yes | yes |
| `pacific` | monsoon | Pacific islands | yes (medium, small) | | | | |
| `americas` | | Mesoamerica, Andes, Caribbean, Amazonia | yes | yes | yes | yes | yes |

("yes" means at least one size of town exists in that theme and age; several themes still lack
the big town in the Classical age, and the Kingdoms age is the only one with per-theme palaces
and walls, as the art spec plans.)

**Missing today, planned in the art plans:** the `israelite` theme (74 items in
`plans/art/israelite-theme.md`: houses, streets, roofscapes, landmarks, palaces and units for
every age, based on excavated sites); a Bronze `levant` kit; Gunpowder `indic`; Modern `europe`,
`steppe` and `indic`; per-theme Kingdoms palaces and walls for the rest; the big Classical towns.
**Not planned anywhere yet:** themes for the two ancient ages and the three late ages of the
nine-age plan (Neolithic, Age of Cities, Information, Future); per-theme palaces outside the
Kingdoms age; theme units beyond the Israelite ones.

**What this means for the pool:** the 150 peoples below use 15 of these themes (section 4.4).
The Kingdom of Israel uses `israelite` (falling back to `levant` until it lands). No new theme is
needed for the pool.

---

## 2. World sizes: Small 24, Standard 36, Large 42 (measured)

**Measured on the real grid (2026-10-04):** the 150 capitals were snapped to the hex grid and
the major picker (4.3) was run over 20 seeds per size. For each major: the land it would get
(usable land split by nearest capital, minus the independents' two rings), its nearest major
rival, and how many independents sit within 8 hexes.

| Majors | Land per major (median) | Nearest rival (median) | Nobody within 20 hexes | Squeezed (under 80 hexes) |
|---|---|---|---|---|
| 24 | 364 hexes | 10.4 hexes | 11% | 3% |
| 30 | 285 | 9.5 | 8% | 7% |
| **36** | **227** | **8.8** | **7%** | **10%** |
| 40 | 208 | 8.2 | 6% | 13% |
| 42 | 197 | 8.3 | 4% | 15% |
| 48 | 165 | 8.2 | 4% | 20% |

**The counts:**

| Size | Major nations | Independents at start | The game it makes |
|---|---|---|---|
| **Small** | **24** | 96 | Big empires and room to settle; a few lonely corners (11%) |
| **Standard** (default) | **36** | all the rest, about 107 (+7 later) | The balance point: few isolated (7%), few squeezed (10%) |
| **Large** | **42** | all the rest, about 101 (+7 later) | Crowded and historical; 15% start squeezed, which is the point of Large |

- **48 was too many**: one major in five would start squeezed under 80 hexes (mostly in Europe
  and the Near East). 42 keeps Large crowded without that.
- **The picker mattered more than the counts.** Spreading majors as far apart as possible (the
  first idea) left a typical nation's nearest rival 15 hexes away and a quarter of them with
  nobody within 20 hexes: the empty, boring world. A history-weighted pick with a minimum gap of
  6 hexes (4.3) halves that distance and cuts the lonely nations to 7%.
- All 150 capitals sit at least 3 hexes apart on the real grid (0 clashes). Haida's islands are
  too small for the grid (it snapped 222 km away): its capital moves to the mainland coast.
- Everything is one table (`WORLD_SIZES`), rechecked by the W1 balance-sim with independents
  and their AI running.

---

## 3. The start screen

### 3.1 World size: rounded radio cards
Replaces today's "World scenario" dropdown and the "Active nations" dropdown in
`src/components/ui/StartScreen.jsx`.

```
 World size
 ( ) Small        (•) Standard          ( ) Large
     24 nations       36 nations            42 nations
     Big empires,     Recommended           Crowded, more
     room to settle                         diplomacy
```
- Same look as the difficulty cards (dark slate, amber when selected: `bg-amber-500/20
  border-amber-500/50`), but **rounder**: `rounded-2xl` cards with a round `rounded-full` radio
  dot on the left that fills amber when selected.
- A real radio group: `role="radiogroup"`, each card `role="radio"` with `aria-checked`, arrow
  keys move the choice, at least 48 px tall (touch target).
- Phone landscape (844x390): the three cards sit in **one row**; portrait and narrow desktop
  stack them. Standard is preselected.
- **The world seed is random and hidden** (the user, 2026-10-04): the "World seed" field is
  removed from the screen. Today it defaults to 1, so every emergent world is the same map unless
  the player types a number. Instead, pressing Start draws a fresh seed in the UI
  (`crypto.getRandomValues`, outside the engine, so the engine stays pure and deterministic) and
  passes it in `scenario.seed`. The seed is saved in the game state, so a save, a cloud sync or
  a replay rebuilds the same world. Every new game gets a different spread of majors and
  independents. Tests and the balance-sim keep passing fixed seeds.
- The guided start draws its seed the same way.

### 3.2 The full world, commented out
- The "Full world" option is **commented out in the JSX** (not deleted), with a comment pointing
  here, so it can come back with one edit. New games are always emergent with independents.
- The engine keeps mode `full` so old full-world saves load and play.
- The **guided start** (today "Play as Egypt" with mode `full`) starts a Standard world as Kemet.

### 3.3 The nation picker
- Lists the **150 peoples** instead of 240 countries: the name, a colour dot, the theme icon,
  and the modern land underneath in small text ("Akkad, in modern Iraq").
- Search matches the name, the capital and the modern land ("iraq" finds Akkad).
- A filter row by region (Near East, Europe, Africa, Asia, Americas, Oceania).
- The **picked people is always a major**; the other majors are drawn by section 4.3.

---

## 4. The peoples pool: 150 peoples

### 4.1 The rules it follows
- **150 peoples**, down from 240: enough for Large (42 majors plus about 101 independents plus 7
  late arrivals) and every corner of the inhabited world, few enough to be curated by hand.
- **No Civilization nations.** Every name was checked against the civilizations of
  Civilization I to VII (and their obvious synonyms: no Egypt, Sumer, Babylon, Assyria, Persia,
  Hittites, Greece, Macedon, Rome, Carthage, Phoenicia, Nubia, Ethiopia, Aksum, Mali, Songhai,
  China, Han, Maurya, Chola, Khmer, Majapahit, Silla, Japan, Korea, Mongols, Scythia, Huns,
  Celts, Gaul, Maya, Inca, Aztec, Mississippian, Polynesia, Maori, Hawai'i, Tonga...) and,
  where we knew them, Civ's city-state names (so no Nazca, Cahokia, Rapa Nui, Hattusa, Byblos,
  Tyre, Ur, Mohenjo-daro, Kandy, Ngazargamu as nation names). Close synonyms were dropped too:
  Kush and Ta-Seti (Civ VI's Nubia), Xiongnu (Huns), Qin (China), Yamato and Wa (Japan), Hatti
  (Hittites), Iberians (Spain), Olmec (La Venta is a Civ city-state).
- **Real and researched.** Every people was found by web search (sources kept in the research
  notes; Wikipedia, Britannica, UNESCO, Iranica, the Met). Before shipping, the list is checked
  once more against Civ VII's newest add-ons, which keep adding civilizations.
- **The Kingdom of Israel is always in the world**, in every size: drawn as a major like everyone
  else (it has weight A, so usually), otherwise it is an independent. It gets no other advantage.
- **Every nation starts equal** (decision, 2026-10-04): one city of the same size, the same army
  and treasury, no extra settlers. Today's Dawn size table (Egypt, China and Iraq at size 5) and
  the river peoples' extra settler are removed for these modes; independents start the same way.
- **Spacing**: no two capitals closer than 3 hexes (about 320 km), the city spacing rule. The
  coordinates below were picked to respect it (that is why Uruk, Lagash, Philistia, Moab, Lycia,
  Ba, Chavín, Chimor and others did not make it: they sit too close to a stronger neighbour). The
  build script (6.1) checks it again on the real grid and nudges a capital by one hex if needed.
- **One name for all ages**, with a title that follows the government and size (4.5), so Akkad
  is never renamed into something it was not; the modern land always shows underneath.
- **Era of the name**: many peoples are named for their most famous period even if that came
  later (Kilwa, Mutapa, the Gokturks); at 2000 BCE they are the ancestors of that people on that
  land. This is a game, and the names were chosen to be memorable and distinct.

### 4.2 Weights and late arrivals
- **Weight A** (3x) are the cradles and great ancient powers: the likely majors (53 peoples).
- **Weight B** (1.5x) and **C** (1x) are the rest; C are mostly peoples without a famous state.
- **Late arrivals** (7): lands settled after 2000 BCE appear as independents in their year if
  the land is still free: Lapita (1600 BCE), Bau (1000 BCE), Dorset (500 BCE), Merina (500 CE),
  Latte (800 CE), Saudeleur (1100 CE), Kalinago (1200 CE).

### 4.3 Who becomes a major
The player's people first. Then, repeatedly, among the peoples at least **6 hexes** from every
major already chosen, the one with the best `weight x a seeded roll between 0.5 and 1.5`. So the
great powers are likely but not certain, majors are never packed together, they are not pushed
to the far corners either (measured in section 2), and every game differs.

### 4.4 The pool (capital coordinates approximate; the build script snaps them to tiles)

**Near East (19)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 1 | **Kingdom of Israel** | Jerusalem | 31.78, 35.23 | il | israelite | A (always present) |
| 2 | Ugarit | Ugarit | 35.60, 35.78 | sy | levant | B |
| 3 | Mari | Mari | 34.55, 40.89 | sy | levant | B |
| 4 | Akkad | Kish | 32.54, 44.60 | iq | levant | A |
| 5 | Elam | Anshan | 29.98, 52.40 | ir | levant | A |
| 6 | Media | Hagmatana | 34.80, 48.52 | ir | levant | A |
| 7 | Kanesh | Kanesh | 38.85, 35.63 | tr | levant | A |
| 8 | Lydia | Sardis | 38.49, 28.04 | tr | levant | A |
| 9 | Phrygia | Gordion | 39.65, 31.98 | tr | levant | B |
| 10 | Pontus | Sinope | 42.02, 35.15 | tr | levant | B |
| 11 | Urartu | Tushpa | 38.50, 43.34 | tr | levant | A |
| 12 | Colchis | Phasis | 42.15, 41.67 | ge | levant | B |
| 13 | Aghvank | Kabalak | 40.98, 47.85 | az | levant | C |
| 14 | Saba | Maryab | 15.42, 45.33 | ye | levant | A |
| 15 | Kindah | Qaryat al-Faw | 19.78, 45.15 | sa | levant | C |
| 16 | Magan | Bat | 23.27, 56.75 | om | levant | B |
| 17 | Dilmun | Qal'at al-Bahrain | 26.23, 50.52 | bh | levant | B |
| 18 | Qedar | Adumattu | 29.81, 39.87 | sa | levant | C |
| 19 | Nabataea | Hegra | 26.79, 37.95 | sa | levant | B |

**Nile and North Africa (8)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 20 | Kemet | Men-nefer | 29.85, 31.25 | eg | nile | A |
| 21 | Kerma | Kerma | 19.60, 30.41 | sd | nile | A |
| 22 | Alodia | Soba | 15.52, 32.68 | sd | nile | C |
| 23 | The Libu | Siwa | 29.20, 25.52 | eg | nile | C |
| 24 | Cyrene | Cyrene | 32.82, 21.86 | ly | maghreb | B |
| 25 | Garamantes | Garama | 26.55, 13.07 | ly | maghreb | B |
| 26 | Numidia | Cirta | 36.37, 6.61 | dz | maghreb | A |
| 27 | Mauretania | Volubilis | 34.07, -5.55 | ma | maghreb | B |

**Europe (26)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 28 | Keftiu | Knossos | 35.30, 25.16 | gr | europe | A |
| 29 | Ahhiyawa | Mycenae | 37.73, 22.76 | gr | europe | A |
| 30 | Odrysia | Seuthopolis | 42.62, 25.40 | bg | europe | A |
| 31 | Illyria | Scodra | 42.07, 19.51 | al | europe | B |
| 32 | Dacia | Sarmizegetusa | 45.62, 23.31 | ro | europe | A |
| 33 | Rasenna | Velzna | 42.72, 12.11 | it | europe | A |
| 34 | The Nuragi | Barumini | 39.70, 8.99 | it | europe | C |
| 35 | Tartessos | Tartessos | 37.26, -6.95 | es | europe | A |
| 36 | Celtiberia | Numantia | 41.81, -2.44 | es | europe | B |
| 37 | Lusitania | Conimbriga | 40.10, -8.49 | pt | europe | B |
| 38 | Arverni | Gergovia | 45.71, 3.12 | fr | europe | B |
| 39 | Belgae | Durocortorum | 49.25, 4.03 | fr | europe | B |
| 40 | Noricum | Noreia | 47.00, 14.40 | at | europe | B |
| 41 | Marcomannia | Marobudum | 50.00, 14.40 | cz | europe | B |
| 42 | Cherusci | Tulifurdum | 52.00, 9.00 | de | europe | C |
| 43 | Durotriges | Maiden Castle | 50.70, -2.47 | gb | europe | C |
| 44 | Brigantes | Stanwick | 54.50, -1.73 | gb | europe | A |
| 45 | Ulaid | Emain Macha | 54.35, -6.70 | gb | europe | B |
| 46 | Fortriu | Burghead | 57.70, -3.49 | gb | europe | C |
| 47 | Geats | Skara | 58.39, 13.44 | se | europe | B |
| 48 | Rygir | Avaldsnes | 59.35, 5.27 | no | europe | C |
| 49 | Bosporan Kingdom | Panticapaeum | 45.35, 36.47 | ua | europe | B |
| 50 | Cucuteni | Talianki | 48.80, 30.47 | ua | europe | C |
| 51 | Avaria | Hring | 47.00, 19.50 | hu | europe | C |
| 52 | Khazaria | Atil | 46.40, 47.90 | ru | steppe | B |
| 53 | The Sarmatians | Uspe | 50.00, 44.00 | ru | steppe | C |

**Central Asia and the steppe (14)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 54 | Oxus | Gonur | 37.55, 62.18 | tm | steppe | A |
| 55 | Parthava | Nisa | 37.95, 58.21 | tm | steppe | B |
| 56 | Bactria | Bactra | 36.76, 66.90 | af | steppe | A |
| 57 | Sogdia | Marakanda | 39.65, 66.98 | uz | steppe | A |
| 58 | Khwarazm | Kath | 41.38, 60.99 | uz | steppe | B |
| 59 | Wusun | Chigu | 42.40, 77.50 | kg | steppe | B |
| 60 | The Andronovo | Arkaim | 52.65, 59.57 | ru | steppe | C |
| 61 | Botai | Botai | 53.27, 67.85 | kz | steppe | C |
| 62 | Gokturk | Ötüken | 47.50, 101.50 | mn | steppe | A |
| 63 | Xianbei | Xilin Gol | 44.00, 116.00 | cn | steppe | C |
| 64 | Kroraina | Loulan | 40.52, 89.92 | cn | steppe | C |
| 65 | Khotan | Yotkan | 37.07, 79.87 | cn | steppe | C |
| 66 | Zhangzhung | Khyunglung | 31.10, 81.20 | cn | steppe | B |
| 67 | Yarlung | Yumbulagang | 29.03, 91.77 | cn | steppe | B |

**South Asia (13)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 68 | Meluhha | Harappa | 30.63, 72.87 | pk | indic | A |
| 69 | Gandhara | Takshashila | 33.75, 72.82 | pk | indic | A |
| 70 | Saurashtra | Lothal | 22.52, 72.25 | in | indic | C |
| 71 | Kuru | Hastinapura | 29.16, 78.01 | in | indic | A |
| 72 | Kosala | Shravasti | 27.51, 82.05 | in | indic | B |
| 73 | Magadha | Rajagriha | 25.03, 85.42 | in | indic | A |
| 74 | Avanti | Ujjayini | 23.18, 75.78 | in | indic | B |
| 75 | Kalinga | Tosali | 20.20, 85.82 | in | indic | A |
| 76 | Satavahana | Pratishthana | 19.48, 75.38 | in | indic | B |
| 77 | Pandya | Madurai | 9.93, 78.12 | in | indic | A |
| 78 | Rajarata | Anuradhapura | 8.31, 80.40 | lk | indic | B |
| 79 | Kamarupa | Pragjyotishpura | 26.15, 91.74 | in | indic | B |
| 80 | Vanga | Chandraketugarh | 22.70, 88.69 | in | indic | B |

**East Asia (13)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 81 | Shang | Yin | 36.12, 114.31 | cn | sinic | A |
| 82 | Zhou | Haojing | 34.23, 108.77 | cn | sinic | A |
| 83 | Chu | Ying | 30.35, 112.19 | cn | sinic | A |
| 84 | Shu | Sanxingdui | 30.99, 104.20 | cn | sinic | A |
| 85 | Qi | Linzi | 36.85, 118.33 | cn | sinic | A |
| 86 | Yue | Kuaiji | 30.00, 120.58 | cn | sinic | B |
| 87 | Dian | Jinning | 24.67, 102.60 | cn | sinic | B |
| 88 | Nanyue | Panyu | 23.13, 113.26 | cn | sinic | B |
| 89 | Buyeo | Buyeo | 43.83, 126.55 | cn | korea | B |
| 90 | Gojoseon | Wanggeom-seong | 39.02, 125.75 | kp | korea | A |
| 91 | Baekje | Ungjin | 36.46, 127.12 | kr | korea | A |
| 92 | Yamatai | Makimuku | 34.55, 135.85 | jp | japan | A |
| 93 | Emishi | Isawa | 39.14, 141.14 | jp | japan | C |

**Southeast Asia (11)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 94 | Van Lang | Phong Chau | 21.32, 105.40 | vn | monsoon | A |
| 95 | Champa | Simhapura | 15.85, 108.25 | vn | monsoon | B |
| 96 | Funan | Vyadhapura | 11.10, 105.00 | kh | monsoon | A |
| 97 | Pyu | Sri Ksetra | 18.80, 95.29 | mm | monsoon | B |
| 98 | Dvaravati | Nakhon Pathom | 13.82, 100.06 | th | monsoon | B |
| 99 | Srivijaya | Palembang | -2.99, 104.76 | id | monsoon | A |
| 100 | Tarumanagara | Sundapura | -6.20, 106.85 | id | monsoon | B |
| 101 | Medang | Mataram | -7.60, 110.20 | id | monsoon | B |
| 102 | Kutai | Muara Kaman | -0.20, 116.90 | id | monsoon | C |
| 103 | Butuan | Butuan | 8.95, 125.54 | ph | monsoon | B |
| 104 | Tondo | Tondo | 14.61, 120.97 | ph | monsoon | C |

**Africa south of the Sahara (21)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 105 | Tichitt | Dhar Tichitt | 18.44, -9.50 | mr | maghreb | B |
| 106 | Wagadu | Koumbi Saleh | 15.67, -7.99 | mr | maghreb | A |
| 107 | Djenné-Djeno | Djenné-Djeno | 13.89, -4.56 | ml | maghreb | B |
| 108 | Kanem | Njimi | 14.50, 14.50 | td | maghreb | A |
| 109 | Nok | Nok | 9.50, 8.00 | ng | westafrica | A |
| 110 | Ife | Ile-Ife | 7.48, 4.56 | ng | westafrica | B |
| 111 | Bono | Bono Manso | 7.90, -1.98 | gh | westafrica | B |
| 112 | D'mt | Yeha | 14.29, 39.02 | et | nile | A |
| 113 | Punt | Opone | 10.42, 51.27 | so | nile | B |
| 114 | Ajuran | Merca | 1.71, 44.77 | so | eastafrica | B |
| 115 | Kilwa | Kilwa Kisiwani | -8.96, 39.51 | tz | eastafrica | B |
| 116 | Kitara | Bigo | 0.40, 31.40 | ug | eastafrica | B |
| 117 | Engaruka | Engaruka | -3.00, 35.97 | tz | eastafrica | C |
| 118 | Luba | Kabongo | -7.33, 25.58 | cd | westafrica | B |
| 119 | Lunda | Musumba | -8.55, 22.85 | cd | westafrica | B |
| 120 | Ndongo | Kabasa | -9.30, 14.90 | ao | westafrica | B |
| 121 | Mapungubwe | Mapungubwe Hill | -22.19, 29.38 | za | eastafrica | A |
| 122 | Mutapa | Zvongombe | -16.40, 31.30 | zw | eastafrica | B |
| 123 | Merina | Ambohimanga | -18.76, 47.56 | mg | eastafrica | B (late, 500 CE) |
| 124 | The Khoekhoe | Camissa | -33.90, 18.60 | za | eastafrica | C |
| 125 | The San | Tsodilo | -18.75, 21.73 | bw | eastafrica | C |

**The Americas (19)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 126 | Caral | Caral | -10.89, -77.52 | pe | americas | A |
| 127 | Moche | Huaca del Sol | -8.13, -78.99 | pe | americas | A |
| 128 | Wari | Huari | -13.06, -74.17 | pe | americas | A |
| 129 | Tiwanaku | Tiwanaku | -16.55, -68.67 | bo | americas | A |
| 130 | Diaguita | Calchaquí | -25.50, -66.00 | ar | americas | B |
| 131 | Muisca | Bacatá | 4.71, -74.07 | co | americas | A |
| 132 | Marajoara | Marajó | -0.90, -49.60 | br | americas | B |
| 133 | Tupinambá | Guanabara | -22.90, -43.20 | br | americas | B |
| 134 | Jaragua | Jaragua | 18.50, -72.80 | ht | americas | B |
| 135 | Kalinago | Waitukubuli | 15.41, -61.37 | dm | americas | C (late, 1200 CE) |
| 136 | Teotihuacan | Teotihuacan | 19.69, -98.84 | mx | americas | A |
| 137 | Zapotec | Monte Albán | 17.04, -96.77 | mx | americas | A |
| 138 | Mutal | Mutal | 17.22, -89.62 | gt | americas | A |
| 139 | Hopewell | Chillicothe | 39.33, -82.98 | us | americas | A |
| 140 | Hohokam | Snaketown | 33.18, -111.92 | us | americas | B |
| 141 | Chaco | Pueblo Bonito | 36.06, -107.96 | us | americas | B |
| 142 | Calusa | Calos | 26.42, -81.86 | us | americas | C |
| 143 | Haida | Kiusta | 54.20, -130.10 | ca | americas | C |
| 144 | Dorset | Igloolik | 69.37, -81.80 | ca | americas | C (late, 500 BCE) |

**Oceania (6)**

| # | People | Capital | Lat, lon | Land | Theme | W |
|---|---|---|---|---|---|---|
| 145 | Lapita | Talepakemalai | -1.60, 149.70 | pg | pacific | B (late, 1600 BCE) |
| 146 | The Wahgi | Kuk | -5.78, 144.33 | pg | pacific | C |
| 147 | Gunditjmara | Budj Bim | -38.07, 141.92 | au | monsoon | C |
| 148 | Saudeleur | Pohnpei | 6.84, 158.33 | fm | pacific | C (late, 1100 CE) |
| 149 | The Latte chiefs | Guåhan | 13.44, 144.79 | gu | pacific | C (late, 800 CE) |
| 150 | Bau | Bau | -17.99, 178.62 | fj | pacific | C (late, 1000 BCE) |

**Themes in the pool:** europe 24, americas 19, levant 18, steppe 16, indic 13, monsoon 12,
eastafrica 9, maghreb 8, sinic 8, nile 6, westafrica 6, pacific 5, korea 3, japan 2,
israelite 1. Several peoples share each theme, as asked.

### 4.5 How a name reads in the game
- **Title by government and size**: "Kingdom of Israel" (the pinned people keeps its full name),
  others take a title from their government and size: a tribal council "the Akkad tribes", a
  monarchy "Kingdom of Akkad", 15 cities or more "the Akkadian Empire", a republic "Republic of
  Akkad", a theocracy "Holy Akkad". Independents use the forms of `independent-cities.md` 14.2.
- The **adjective** (Akkadian, Elamite, Kanesh-ite is wrong: "Kaneshite" is fine, but each entry
  gets a hand-written adjective to avoid that) is in the data, used by logs and titles.
- The **modern land** always shows under the name ("in modern Iraq").
- Cities: see 4.6.
- Colours: a new palette of 150 colours, neighbours never similar (the build script checks the
  contrast of every pair of capitals within 10 hexes).

### 4.6 City names
**Today** (`src/engine/cityNames.js`): a new city takes the map's place name on its tile (a
modern name, so an Akkadian city in 1800 BCE could be "Basra"), else a nearby one, else a
made-up mash of two personal names from the modern country's culture group.

**New:** every people has its **own list of 20 real historical city names**, capital first, then
its great cities, then real ancient place names of its homeland (draft lists, researched on the
web, in `plans/data/cities/*.json`, 3,000 names, reviewed before they ship).
**Status of the drafts (2026-10-04):** all 150 lists exist, 20 unique names each, no name used
by two peoples, every capital a real place name. They were written from the researchers' own
knowledge, **not yet checked name by name on the web**: a checking pass (a script that looks each
name up in the Pleiades gazetteer and Wikipedia and lists the misses) runs before W0 ships. Thin
peoples (Botai, the Andronovo, Tichitt, Nok, Engaruka, the Khoekhoe, the San, Dorset, the Wahgi,
Gunditjmara, Kalinago, Marajoara, Cucuteni) are filled after their known sites with real
place names of their homeland in their own language, never invented names.
A city founded by a people takes, in order:
1. **The next unused name from the founder's own list.** Akkad founds Sippar, then Nippur;
   the Kingdom of Israel founds Samaria, Megiddo, Hazor, Shechem...
2. When the list is used up (a big empire past 20 cities): **an ancient name of the place
   itself**, from a gazetteer of ancient sites placed on tiles (the Pleiades gazetteer, CC BY,
   covers the Mediterranean and the Near East with tens of thousands of placed names; other
   regions use the peoples' lists of their neighbours whose capital is nearest that tile).
3. Last: a name **generated from the founder's own list** (syllables of its real names, not of a
   modern culture group), so a Sumerian-sounding name for Akkad, never a Slavic one.
- **Conquest keeps the name**: Hazor stays Hazor under Akkad (the conqueror can rename a city it
  holds, an action with a small loyalty cost).
- **Independents** keep their capital's name; a free city keeps the name it had.
- **Famous renamings** follow history only for the few cities that have them, by age, in the
  same data (for example Marakanda to Samarkand, Pataliputra to Patna, Velzna to Volsinii).
- A test checks every people has 20 names, no name repeats inside a list, and no two peoples'
  capitals share a name.

---

## 5. Names left out and why (for the review)
- **Too close to a Civ nation:** Kush and Ta-Seti (Nubia), Meroë, Zagwe (Ethiopia), Xiongnu
  (Huns), Qin (China), Yamato and Wa (Japan), Hatti (Hittites), Iberians and Kartli's other name
  Iberia (Spain), Olmec (La Venta), Edo (Civ VII's Edo Japan; Benin's Edo kingdom not used),
  Saka (Scythians), Chenla (Khmer), Licchavi (Nepal), Svear (Sweden).
- **Civ city-state names:** Nazca, Cahokia, Rapa Nui, Nan Madol (Saudeleur is used instead),
  Byblos, Tyre, Sidon, Ur, Hattusa, Mohenjo-daro, Kandy, Mogadishu, Zanzibar, Antananarivo,
  Ngazargamu, Kumasi, Mitla, Caguana.
- **Spacing (a stronger neighbour within 320 km):** Uruk, Lagash, Ebla, Yamhad, Aram-Damascus,
  Philistia, Moab, Judah, Subartu, Hadramawt, Himyar, Lihyan, Lycia, Arzawa, Kizzuwatna,
  Commagene, Kartli, Alashiya, Makuria, Epirus, Paeonia, Samnium, Dál Riata, Ba, Chera, Izumo,
  Gaya, Langkasuka, Jolof, Oyo, Edo (Benin), Dahomey, Adal, Chavín, Paracas, Chimor, Chachapoya,
  Toltec, Purépecha, Mixtec, Kaan (Calakmul).
- **Cut to reach 150:** Kucha, Dayuan, Okunev, Glazkovo, Sushen, Na, Kadamba, Tambralinga,
  Luwu, Plain of Jars, Takrur, Wagadugu, Kuba, Menabe, Nyiginya, Herero, Mbuti, Kel Tamasheq,
  Helvetii, Armorica, Oenotria, Aesti, Lugii, Kvenland, Merya, Tehuelche, Charrúa, Tairona,
  Timoto-Cuica, Tapajó, Poverty Point, Powhatan, Izapa, Yolngu. Any of them can swap in.

---

## 6. What changes in the code (phase W0)

### 6.1 Data
- `src/data/peoples.js` (new): the 150 entries: `id` (a slug: `israel`, `akkad`...), `name`,
  `adjective`, `capital: { name, lat, lon }`, `land` (modern ISO code, for the "in modern X" line
  and land lookups), `theme`, `weight`, `region`, `arrives` (year, late arrivals only),
  `pinned` (Israel), `color`, `cultureGroup` (for city names and doctrines).
- `scripts/peoples/build-peoples.mjs` (new): snaps every capital to the nearest land tile of
  the grid, checks the 3-hex spacing (nudges by one hex or fails with the pair), checks colour
  contrast between neighbours, writes `src/data/geo/peopleCapitals.json`.
- `WORLD_SIZES` (new, `src/data/worldSizes.js`): `{ small: { majors: 24, independents: 96 },
  standard: { majors: 36, independents: 'all' }, large: { majors: 42, independents: 'all' } }`,
  `MAJOR_MIN_GAP_HEXES = 6`.

### 6.2 Engine
- The nation records come from `peoples.js` instead of `countries-meta.json`'s 240 countries
  (`src/data/worldNations.js`). Nation ids become the people slugs.
- `emergentWorld.js`: `generateStarts` takes the world size, pins the player and Israel, picks
  majors by section 4.3, then independents (W1).
- **Old country-id tables** (keyed `eg`, `cn`, `iq`...) are re-keyed to people ids:
  `DAWN_CAPITAL_SIZE`, `DAWN_SETTLER_NATIONS`, `UNPEOPLED_AT_DAWN` (replaced by `arrives`),
  historical events that name a country, the tutorial (Egypt becomes Kemet), AI personas and
  doctrines by culture group. A one-time table `LEGACY_NATION_IDS` (old id -> people id, by
  land) does the mechanical part; the rest is reviewed by hand.
- **Palaces and theme units** read `nation.theme` instead of `styleOfNation(ownerId)`
  (architecture.js); town art keeps following the land, unchanged.
- **Tests**: hundreds of tests use country ids (`cap('fr')`, `playerNationId: 'fr'`). The test
  helpers map an old id through `LEGACY_NATION_IDS` during the switch, so tests change in waves,
  not all at once; every `rngSeed` test is rechecked.
- Old saves (full world, 240 countries) keep loading through mode `full`, which keeps reading the
  old country records. New games use the pool. Save version 9 (shared with the other plans).

### 6.3 UI
- StartScreen: the radio cards (3.1), the commented-out full world (3.2), the 150-people picker
  with region filter and search (3.3), the guided start as Kemet.
- Everywhere a nation name shows: the titled name (4.5) and the "in modern X" line where there
  is room (nation sheet, diplomacy list, picker).

### 6.4 Tests and checks
- Every people has a valid tile, a theme that exists (or falls back), a unique id and name.
- No two capitals within 3 hexes; Israel is in every generated world; every world size gives
  its major count; the player is always a major.
- A name check: no pool name equals a Civ civilization name from a stored list (the list in
  section 5, kept in the test so a later addition is caught).
- e2e: start each world size on the phone layout, pick a people from the search, play a turn.

---

## 6b. Map resolution and quality (added at the user's request, 2026-10-04)

### 6b.1 What the map is today (surveyed on `claude/bronze-towns`)
- **Flat map**: a base picture (`public/map/world-2048.webp` and `world-4096.webp`), then a tile
  pyramid (`build-raster-pyramid.mjs`) up to **level 5: 16,384 x 8,192 pixels, about 2.4 km a
  pixel, 44 pixels a hex** (2,048 tiles, 4.1 MB). Drawn only for the tiles on screen.
- **Close view** (zoom k 20 and up) and the **super zoom** (k 40 to 200): `CloseTerrainLayer`
  draws **level 5 tiles through a shader** (`terrainShader.js`) that keeps coasts, lakes and
  rivers as sharp lines and adds procedural noise detail (mottling, crags, ripples, a small noise
  hillshade). Textures use linear filtering with **no mipmaps**; the canvas renders at up to 2x
  device pixels.
- **Sources**: elevation from terrarium tiles at **zoom 5** (about 4.9 km a pixel at the
  equator, so level 5 is already upscaled twice), colours from Köppen climate and hypsometric
  tints, **Natural Earth 1:10M** glaciers and rivers, the land from the hex coast.
- **So the weak spots are**: (1) in the close and super zoom, one raster pixel (2.4 km) covers
  a big part of a town, so the ground under the towns is a magnified blur dressed with noise;
  (2) the hillshade comes from 5 km elevation, so mountains look soft; (3) the noise does not know
  what is really on the ground (forest, farmland, desert, wetland); (4) Natural Earth 1:10M has
  few rivers; (5) the single 4,096 globe and base picture is about 10 km a pixel; (6) no
  mipmaps, so mid zooms shimmer a little when panning.

### 6b.2 The plan, in order of value for the cost

**Q1. Measure first** (half a session). Fixed Playwright screenshots of five places (Nile delta,
Alps, Ganges, Andes, Java) at five zooms (globe, mid, close k 20, super k 60 and k 200), phone
844x390 and desktop, plus bytes downloaded per session and frame time. Every later step is
judged against these pictures, side by side, and the user picks.

**Q2. Two more pyramid levels, land only** (1 to 2 sessions).
- **Level 6** (32,768 wide, about 1.2 km a pixel) and **level 7** (65,536 wide, about 0.6 km a
  pixel, 175 pixels a hex). Ocean tiles are not stored (the shader draws open sea from the
  level below plus its wave detail), which cuts about 70%: level 6 about 2,500 tiles (about
  6 MB), level 7 about 10,000 tiles (about 20 MB). Only tiles on screen download, so a phone
  session fetches a few MB at most. GitHub Pages handles the total.
- The close view reads the best level loaded for each tile and falls back to the level below
  while it loads (no blank tiles).
- **Finer sources** (all free to use with attribution, none non-commercial):
  - Elevation: terrarium tiles at **zoom 8** (about 0.6 km) for the hillshade and the snow line,
    so ridges and valleys are real, not noise.
  - Ground colour: **NASA Blue Marble Next Generation** (500 m a pixel, public domain) blended
    with today's climate palette, so the look stays the decided "real Earth" but deserts, forests
    and river valleys follow the real ground. The blend weight is one constant to tune by eye.
  - Land cover: **ESA WorldCover** (10 m, CC BY 4.0), downsampled to classes per pixel (forest,
    cropland, grassland, shrub, bare, wetland, snow, built-up hidden) and stored in a channel the
    shader reads, so the detail noise draws trees on forest, field strips on cropland, dunes on
    bare sand and reeds on wetland.
- Build time and memory: rendered in bands as today; a few hours on one machine is fine, it runs
  once and the tiles are committed.

**Q3. Smarter close-zoom shader** (1 session).
- Real hillshade from the elevation channel (a normal map per tile) instead of noise hillshade.
- Land-cover-aware detail (the WorldCover class picks the detail pattern and its colours).
- **Mipmaps** on the tiles and a little anisotropic filtering, so mid zooms stop shimmering.
- Detail never shows under a town's footprint (the town model already carries its own ground).

**Q4. Rivers, lakes and coasts** (1 session).
- **HydroRIVERS** (HydroSHEDS, CC BY 4.0): rivers by flow, so the close zoom shows the real
  tributaries, thinning with flow; Natural Earth stays for the far zooms.
- Lakes from HydroLAKES above a size threshold.
- The coast stays the hex coast (the game's land must match the hexes), but its outline is
  smoothed at high zoom so it never looks stepped; checked against the screenshots.

**Q5. The globe and the far zoom** (half a session).
- The globe gets an **8,192 texture on desktop** and keeps 4,096 on phones (some phones cap
  textures at 4,096), with mipmaps and anisotropy; or, if the screenshots show it is worth it, a
  cube map of six 2,048 faces, which is sharper at the poles and safe on every phone.
- The base picture stays 2,048 or 4,096 (it is only the first frame).

**Q6. Size and speed** (half a session).
- Tiles in **WebP**, with **AVIF** where the browser supports it (about 30% smaller; build both,
  the loader picks).
- A tile cache sized by device memory, prefetch of the ring of tiles around the screen, and a
  hard budget checked in CI: no zoom session on the phone downloads more than 8 MB, no frame of
  the close view over 16 ms on the reference phone profile.

### 6b.3 What it does not change
- The look is decided: real Earth, hexes only as a faint overlay. This work makes it sharper,
  it does not restyle it.
- Gameplay data (tiles.json, the hex coast, terrain classes) is untouched; only pictures change.

### 6b.4 Phase
**M (map quality)**: Q1 to Q6, about 4 to 6 sessions. It touches only the map renderer and the
build scripts, so it can run **in parallel** with W0 to W4 on its own branch.

---

## 7. Phases
| Phase | What | Size |
|---|---|---|
| **W0. Peoples and start screen** | peoples.js and its build script, world sizes, the radio cards, the full world commented out, a random hidden world seed, the picker, the id switch with the legacy map, palaces by theme, tests | 2 to 3 sessions |
| W1 to W4 | as `plans/independent-cities.md` (independents, their AI, interactions, UI) | |
| **M. Map quality** | section 6b: measure, levels 6 and 7 from finer sources, a smarter close-zoom shader, rivers and lakes, the globe, size and speed; runs in parallel | 4 to 6 sessions |

---

## 7b. W0 status (2026-10-06, branch claude/phase-w0-peoples)
Done: `src/data/peoples.js` (150 peoples, adjectives, regions, themes, weights, late arrivals,
Israel pinned) and `src/data/peopleCities.json` (the 3,000 names); `npm run build:peoples` writes
`src/data/geo/peopleCapitals.json` (capital tiles, colours, `LEGACY_NATION_IDS`); titles by
government and size incl. Dictatorship, Technocracy, Corporate State (`src/data/nationTitles.js`);
scenario mode `peoples` with world sizes 24/36/42, the weighted pick with a 612 km gap, equal
starts, the world seed from the start screen (`src/engine/worldgen/peoplesWorld.js`); city names
from the founder's list, then the nearest absent peoples' lists, then its own syllables; regiment
names; battle names; palaces by `nation.theme`; the new start screen with art placeholders; the
guided start as Kemet. Decisions taken in the build: late arrivals are never drawn as AI majors
but the player may pick one; Crete is all water on the grid, so Keftiu stands on the mainland
(Thessaly).
**Changed 2026-10-06 (the user):** Israel (the pinned people) follows the same gap rule as
everyone: it is tried first after the player and is a major only when its capital is at least
612 km from the player's; it then holds its neighbours off like any major (the old exception,
"pinned but holds nobody off", is gone). The gap is never relaxed (`GAP_RELAX` removed): a
people too close to a chosen major is skipped and becomes an independent; a pool that cannot fill
the size would give fewer majors. Measured (25 seeds x 6 players: Akkad, Kemet, Israel, Ahhiyawa,
Celtiberia, Shang; 150 worlds a size): Small 24 / 24 / 24 (min / median / max majors placed),
Standard 36 / 36 / 36, Large 42 / 42 / 42: the pool always fills every size. Consequence: Kemet
(about 430 km from Jerusalem) is a major only when the player picks it, and then Israel is not; with
any other player Israel is in and Kemet is an independent (0 of 125 worlds per size).
Left for later: the web check of the city names; the Pleiades gazetteer; independents (W1);
unmet peoples (phase A); renaming a city; famous renamings by age; region and theme art.

## 8. Decisions (from the user, 2026-10-04)
1. **Every nation starts equal with one city** (section 4.1): same size, army and treasury, no
   head starts. The Kingdom of Israel is always in the world (since 2026-10-06: when it keeps the 612 km gap from the player) but gets no other advantage.
2. **World sizes: decided by measurement** (section 2): Small 24, Standard 36, Large 42.
3. The peoples list stands as written unless the user asks for a change.
