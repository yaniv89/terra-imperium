# Wave 3 checkpoint 12: the 38 Classical signature units

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (38 new queue items `units/signature/<model>`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [in-game contact sheet](contact.png) (844x390 battle sandbox: Saba's
camel archers, Magadha's war elephants, Rasenna's hoplites, Magadha's elephants against Saba),
[Blender proofs of all 38](../../../shots/wave3/signature-classical-proofs.png).

## Delivered
`src/assets/units/signature/<model>.glb` + `<model>.json` for every Classical people of the roster
(plans/ART-MODELS-PLAN.md 4.5), built by `scripts/blender/build_units_classical_signature.py`:
- on foot (person rig): aghvank, nabataea, mauretania, rasenna, belgae, cherusci, durotriges,
  kroraina, kosala, chu, qi, yue, nanyue, yamatai, nok, teotihuacan, zapotec, hopewell;
- horsemen (horse rig, the seated-rider helper of build_units_classical.py and horse dressings:
  saddle cloths, spotted and embroidered cloths, caparison and hide barding, chest and cheek plates,
  a rope bridle, a bell harness): media, lydia, cyrene, numidia, arverni, parthava, bactria, wusun,
  xianbei, avanti, satavahana, dian, buyeo;
- light chariots: pontus (four horses, scythe blades on the hubs), brigantes (two ponies, plaid);
- camels: saba (ranged: archers on a pack saddle), qedar (cavalry);
- elephants: magadha (bronze armour and brow plate, howdah with two archers, a mahout),
  kalinga (hide armour, painted forehead, two spearmen, a mahout);
- frame: bosporan-kingdom (a stone-throwing torsion engine, three crew in linen, a stone pile).

| Model | Triangles | Packed |
|---|---:|---:|
| `aghvank` | 1188 | 64 KB |
| `nabataea` | 1041 | 52 KB |
| `mauretania` | 1118 | 58 KB |
| `rasenna` | 1398 | 75 KB |
| `belgae` | 1256 | 65 KB |
| `cherusci` | 1106 | 58 KB |
| `durotriges` | 1050 | 55 KB |
| `kroraina` | 1144 | 58 KB |
| `kosala` | 1196 | 61 KB |
| `chu` | 1192 | 65 KB |
| `qi` | 1108 | 58 KB |
| `yue` | 1148 | 59 KB |
| `nanyue` | 1048 | 55 KB |
| `yamatai` | 1120 | 56 KB |
| `nok` | 1230 | 63 KB |
| `teotihuacan` | 1150 | 61 KB |
| `zapotec` | 1102 | 59 KB |
| `hopewell` | 1046 | 55 KB |
| `media` | 1712 | 94 KB |
| `lydia` | 1614 | 89 KB |
| `cyrene` | 1606 | 90 KB |
| `numidia` | 1514 | 86 KB |
| `arverni` | 1656 | 93 KB |
| `parthava` | 1648 | 92 KB |
| `bactria` | 1666 | 94 KB |
| `wusun` | 1768 | 98 KB |
| `xianbei` | 1570 | 87 KB |
| `avanti` | 1670 | 93 KB |
| `satavahana` | 1608 | 91 KB |
| `dian` | 1596 | 91 KB |
| `buyeo` | 1738 | 96 KB |
| `pontus` | 2887 | 190 KB |
| `brigantes` | 2346 | 151 KB |
| `saba` | 1780 | 98 KB |
| `qedar` | 1768 | 98 KB |
| `magadha` | 2976 | 166 KB |
| `kalinga` | 2892 | 163 KB |
| `bosporan-kingdom` | 2467 | 145 KB |

Together 3.38 MB packed (meshopt, unquantized). Original procedural geometry; flat unit materials.
New parts: wide hats, the Negau helmet, turbans, a skin helmet with its pelt, a Zapotec animal-head
helmet, a tall hat, fur caps, a torc, breastplates, Nok hair buns, the Suebian knot, a bow case, the
atlatl and dart, the ge-ji, a repeating crossbow, a sabre, a long asymmetric bow, a stone pile.

## Wired
Already in the game: `unitModels.js findSignatureModel` draws a people's file for its age and role.
Camel and elephant JSONs carry `"height"` (the loader's target height: measured figure x the base
cavalry's world-per-unit scale, 1.284; elephants x 0.8 so eight a squad stand apart), so they stand
taller than horsemen and Saba's ranged camels are not squeezed to a foot archer's height.
New test (`src/battle/render/unitExtras.test.js`): every Bronze and Classical roster entry resolves to
its GLB with the right quadruped flag; camels and elephants have their own height.
Verified in `?battleSandbox&age=classical` with `people=magadha&enemy=pontus&attacker=cavalry`
(layers `cavalry~magadha`, `cavalry~pontus`), `people=saba&enemy=magadha&attacker=archers`
(`ranged~saba`, `cavalry~magadha`), `people=pontus&enemy=qedar` (`cavalry~qedar`) and
`city=medium&people=bosporan_kingdom&enemy=rasenna` (`infantry~rasenna`). The sandbox field
battle keeps siege squads off the field, so the Bosporan stone-thrower is checked by the test.

## Checks
`validate_model.py` (unit, unit-mounted, unit-machine) passes all 38 (yamatai's bow was lowered
below the ground at first: now an asymmetric bow gripped below its middle); lint clean; 18 render
and art test files pass.

## Open
- An elephant squad draws 8 figures like any cavalry squad; 4 would read better (a rules choice
  for the signature-unit phase SU, battleStats soldiers).
