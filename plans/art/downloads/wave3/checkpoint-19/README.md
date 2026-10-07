# Wave 3 checkpoint 19: siege units in the battle sandbox

2026-10-08, branch `claude/bronze-towns` (Claude). No new art files (0 MB). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): the Bosporan stone-throwers live in the
sandbox at 844x390 (`?battleSandbox&age=classical&siege&people=bosporan_kingdom&enemy=zhou&autostart`)
and the wide opening view.

## What changed
`src/components/battle/BattleSandbox.jsx`: a new army preset `siege` (three siege units with an
infantry and a ranged escort), in the Your army / Enemy army menus and by URL (`&attacker=siege`,
`&defender=siege`, or the shorthand `&siege` for your army). With `&people=<id>` a people's siege
signature unit shows, e.g. `&people=bosporan_kingdom&age=classical` for the stone-throwers; without
it the age's base engine (the Classical ballista). The battle's unit layer reports
`classical:siege~bosporan_kingdom` at 2,467 / 260 / 14 triangles (the GLB, not the procedural body).
Console: only the dev server's font 403s.
