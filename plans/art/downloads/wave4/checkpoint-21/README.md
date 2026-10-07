# Wave 4 checkpoint 21: the 36 Kingdoms signature units

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (36 new queue items `units/signature/<model>`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): Kamarupa's war elephants in the battle
sandbox at 844x390 (`?battleSandbox&age=kingdoms&people=kamarupa&enemy=khazaria`) and the Blender
proofs of all 36. Shots: `plans/art/shots/wave4/signature-kingdoms/`.

## Delivered (`scripts/blender/build_units_kingdoms_signature.py`, packed, 2.76 MB together)
`src/assets/units/signature/<model>.glb` and its `.json`, one per people whose peak is the Kingdoms age
(src/data/signatureUnits.js):
- 24 on foot (958 to 1,266 triangles): khotan, zhangzhung, pandya, rajarata, vanga, funan, pyu,
  dvaravati, srivijaya, tarumanagara, butuan, djenne-djeno, ife, engaruka, mapungubwe, san, moche,
  wari, tiwanaku, marajoara, mutal, hohokam, chaco, saudeleur.
- 9 horsemen (1,622 to 1,934): alodia, khazaria, sogdia, khwarazm, gokturk, yarlung, baekje, emishi,
  wagadu.
- 2 war elephants (2,916 and 2,976; drawn at their own height like the Classical ones): kamarupa
  (wicker howdah, mahout and two archers), champa (armoured, spearmen, a tower banner).
- kitara (1,510): a cattle guard with a long-horned Ankole ox beside him, on the ox rig.
Looks follow plans/ART-MODELS-PLAN.md 4.5 (lamellar and plumed caps for the steppe riders, the Maya
backrack, the Moche crescent headdress, the stepped Tiwanaku headdress, Ife's beaded crown...).
Saudeleur carries a board shield instead of the club (the spear hand is taken).

## Wired
Nothing new needed: `signatureUnitFor` finds the files; the sandbox reports
`kingdoms:cavalry~kamarupa` (2,970 triangles) and `kingdoms:cavalry~khazaria` (1,854) as GLB layers.
No console errors besides the dev server's font 403s. 99 related test files pass.
