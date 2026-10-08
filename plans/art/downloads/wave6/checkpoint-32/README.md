# Wave 6 checkpoint 32: the 10 Modern signature units

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (10 new queue items `units/signature/<model>`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): Israel's Merkavas against Marcomannia
(`?battleSandbox&age=modern&people=israel&enemy=marcomannia`), Dacia's mountain troops
(`...&people=dacia&enemy=kindah`), Dorset's Rangers (`...&people=dorset&enemy=d_mt`), all at 844x390, and
the Blender proofs of all 10. Shots: `plans/art/shots/wave6/signature-modern/`. With these every one of the
150 peoples has its signature unit in the game.

## Delivered (`scripts/blender/build_units_modern_signature.py`, packed, 0.79 MB together)
`src/assets/units/signature/<model>.glb` and its `.json`, one per people whose peak is the Modern age
(src/data/signatureUnits.js):
- kingdom-of-israel (1,448 triangles): the Merkava on the tracked rig: a low hull with the engine in front,
  a long wedge turret set far back, a long smoothbore gun, side skirts with the Team stripe, slat armour
  at the turret's back, in sand grey.
- marcomannia (1,332): the LT vz. 38 on the tracked rig: a small riveted hull, four big road wheels with
  return rollers, a small turret with a 37 mm gun, a hull machine gun, a Team stripe along the deck.
- kindah (1,828): Arab Revolt camel riflemen (infantry role): white headcloth with a black cord, a Team robe
  and a light cloak, a bandolier, a rifle held upright, on a dromedary (the camel rig).
- 7 on foot (1,181 to 1,497): illyria (Kachak riflemen: white plis, a Team wool jacket with black braid,
  white braided trousers, bandolier), dacia (vanatori de munte: the big beret with an edelweiss, Team wool
  tunic, puttees, rucksack), nuragi (Brigata Sassari: Adrian helmet, Team tunic with red-and-white collar
  badges in the emblem colour, puttees, bayonet), noricum (Kaiserschuetzen: mountain cap with feather and
  edelweiss, rope coil, ice axe), rygir (ski infantry: round cap, skis and a pole on the back), d-mt (Adwa
  riflemen: white shamma with a Team border, jodhpurs, bare feet, cartridge belt, tall felt hat), dorset
  (Canadian Rangers: Team hooded anorak with a fur ruff, red armband, snow goggles, mukluks).
Looks follow plans/ART-MODELS-PLAN.md 4.5 (Dacia's edelweiss badge, Kindah's Lee-Enfield). Tanks and the
camel carry their height in the JSON (tanks their true height, the camel the camel units' scale).

## Wired
Nothing new needed: `signatureUnitFor` finds the files; the sandbox reports `modern:cavalry~israel`,
`modern:cavalry~marcomannia`, `modern:infantry~dacia`, `modern:infantry~kindah`, `modern:ranged~dorset`,
`modern:infantry~d_mt` as GLB layers. unitExtras.test.js now checks every people's file (all 150; tanks
rigid, no trotting legs). No console errors.
