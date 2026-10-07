# Wave 5 checkpoint 27: the 32 Gunpowder signature units

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (32 new queue items `units/signature/<model>`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): the Sarmatians' winged hussars and Tondo's
lantaka crews in the battle sandbox at 844x390
(`?battleSandbox&age=gunpowder&people=sarmatians&enemy=fortriu`, `...&people=tondo&enemy=avaria&siege`)
and the Blender proofs of all 32. Shots: `plans/art/shots/wave5/signature-gunpowder/`.

## Delivered (`scripts/blender/build_units_gunpowder_signature.py`, packed, 2.30 MB together)
`src/assets/units/signature/<model>.glb` and its `.json`, one per people whose peak is the Gunpowder
age (src/data/signatureUnits.js):
- 26 on foot (1,052 to 1,384 triangles): odrysia (Haiduk musketeers), celtiberia (guerrilleros),
  lusitania (cacadores), ulaid (1798 pikemen), fortriu (Highland broadswords and targe), geats
  (Carolean pike), gandhara (jezail riflemen), medang (kris infantry), kutai (sumpitan blowguns), bono
  (Akan musketeers), kilwa (archers), luba, lunda, ndongo, mutapa, merina, diaguita, muisca, tupinamba,
  jaragua, kalinago, calusa, haida (plank armour and carved helmet), gunditjmara (boomerang and spear
  thrower), latte-chiefs (slingers), bau (Fijian war club).
- 4 horsemen (1,614 to 1,942): avaria (hussars with a pelisse and kalpak), sarmatians (winged hussars:
  breastplate, wings on the back, lance, leopard skin), kanem (mailed, a quilted horse cloth), ajuran
  (matchlock and lance).
- khoekhoe (1,504): a rider in a kaross on a war ox with a hide saddle (the ox rig).
- tondo (2,045): a bronze lantaka swivel gun on a post in the siege frame's wooden rest, three crew in
  sarongs with powder gourds (the frame rig, no wheels).
Looks follow plans/ART-MODELS-PLAN.md 4.5. Shields are the squad's Emblem; coats and wrappers Team.

## Wired
Nothing new needed: `signatureUnitFor` finds the files; the sandbox reports
`gunpowder:cavalry~sarmatians`, `gunpowder:infantry~fortriu`, `gunpowder:siege~tondo` and
`gunpowder:cavalry~avaria` as GLB layers. No console errors besides the dev server's font 403s.
