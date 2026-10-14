# Foot soldiers' clips

Authored 2026-10-14 by scripts/blender/ti_foot_clips.py (over ti_clips.py, the workers' poser and author)
through each unit's builder (`blender -b --factory-startup -P scripts/blender/build_<age>_<class>.py`;
`TI_SHEETS=1` renders the sheets below, `TI_SHEETS=side` a side view too). Contract:
plans/art/clip-animation-pipeline.md section 7 and 7.2. 20 fps, in place, loops closed (the last frame
repeats the first), events 1-based, contact frames held two frames. Frame f is at f / 20 s in the GLB.

Sheets (the battle camera, high three-quarter; a red bar marks an event frame): <uid>-moving.png (Idle,
IdleAlt, the gaits, Cheer or Hit) and <uid>-combat.png (the attacks or the shot, Block, Hit and the falls;
support units: <uid>-work.png), eight frames a row, the event frames among them.

Rest look: the baked rest pose (Idle frame 1) of every unit was checked against its previous GLB through
the game's loader (extractUnitGeometry with the unit's options, and with the infantry polearm lengths):
the same triangles, colours, limbs, team and skin parts, positions within 0.3 mm (the floor pass lifts the
rig at most 1 mm; the loader puts the feet back on the ground). Triangle counts are unchanged: no meshes
were added (no ramrod; the arrow and the string were already there).

## bronze-infantry

Spear and round shield. Attack: an underarm thrust from the guard (the spear forward and up at the hip). Attack2: the spear lifted over the shoulder and stabbed down. Block: crouched behind the shield. Cheer: the spear pumped overhead. Retreat-run: a plain run, upright, no panic. Triangles 2000 (unchanged); GLB 199 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## bronze-ranged

Self bow (Prop_L) with its string bone (Prop_String follows the drawing fist from the nock to the release); the nocked arrow on Tool_Arrow (hidden from the release until a new arrow comes out of the back quiver, frame 29). Melee-fallback: the arrow stabbed down in the right fist. Triangles 1976 (unchanged); GLB 187 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Draw-aim-release | 33 | 1.65 | no | release 22 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## bronze-mercenary

Long bronze sword and round shield. Attack: a cut from over the right shoulder down and across. Attack2: a thrust. Block, Cheer and Retreat-run as the spearman. Triangles 1998 (unchanged); GLB 206 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## classical-infantry

Short sword and big oval shield: the sword set of the Bronze mercenary (a cut from over the shoulder, a thrust, crouched behind the shield). Triangles 1904 (unchanged); GLB 196 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## classical-ranged

Composite bow (Prop_L); its string is one segment on Prop_L and stays straight while the fist draws (no string bone on this bow). The nocked arrow on Tool_Arrow, hidden from the release until a new arrow comes out of the back quiver. Melee-fallback: the arrow stabbed down. Triangles 1980 (unchanged); GLB 182 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Draw-aim-release | 33 | 1.65 | no | release 22 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## classical-mercenary

Curved sword and long oval shield: the sword set (cut, thrust, Block behind the shield). Triangles 1982 (unchanged); GLB 202 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## classical-support

Pick-axe in the right fist (the fist slides down to the haft's end to swing it, one-handed: the wicker mantlet stays on the left arm in every work clip and does not swing in the gaits). Mine: lifted over the shoulder and driven into the ground in front. Build: the same swing, shallower. Repair: crouched, quicker. No Chop, Harvest, Carry or Deposit: he carries no axe, sickle or load. Triangles 1866 (unchanged); GLB 177 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Mine | 29 | 1.45 | yes | contact 15 |
| Build | 25 | 1.25 | yes | contact 15 |
| Repair | 21 | 1.05 | yes | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |

## kingdoms-infantry

Pike (5 m in the game: the loader stretches it from the butt) in both hands, the fists slid down to stations 0.26 and 0.45 from the butt. Attack: levelled at the chest and thrust. Attack2: thrust low at the belly. Block: angled up across the body. Cheer: raised upright and pumped. The left fist leaves the sword's pommel for the shaft in the attacks and goes back to it. Triangles 1676 (unchanged); GLB 173 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## kingdoms-ranged

Longbow (Prop_L), its one-segment string straight; the nocked arrow on Tool_Arrow, a new one taken from the arrow bag at the right hip. Melee-fallback: the arrow stabbed down. Triangles 1934 (unchanged); GLB 180 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Draw-aim-release | 33 | 1.65 | no | release 22 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## kingdoms-mercenary

Falchion and round buckler: the sword set (cut, thrust, Block behind the buckler). Triangles 1916 (unchanged); GLB 192 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| IdleAlt | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Retreat-run | 15 | 0.75 | yes | - |
| Attack | 21 | 1.05 | no | contact 11 |
| Attack2 | 25 | 1.25 | no | contact 13 |
| Block | 20 | 1.00 | no | - |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |
| Cheer | 33 | 1.65 | yes | - |

## kingdoms-support

Wooden maul in the right fist, swung one-handed from the haft's end (Build: driving a stake in front; Repair: crouched, quicker); the wheeled mantlet stays still on the left arm. No Mine (no pick). Triangles 1794 (unchanged); GLB 160 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Build | 25 | 1.25 | yes | contact 15 |
| Repair | 21 | 1.05 | yes | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |

## gunpowder-infantry

Musket with a socket bayonet (a shooter in the sim, so the gun set). Aim-fire-reload: presented side on (the butt in the shoulder, the barrel on top, the fists at the stock's wrist and the fore-stock), fire 10, the kick, then the musket upright in the left fist while the right fetches a cartridge from the hip, pours and rams twice (no ramrod drawn: none was modelled, so the hand rams empty), reloaded 40, back to the order. Melee-fallback: a bayonet thrust from the hip. Triangles 1918 (unchanged); GLB 180 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Aim-fire-reload | 50 | 2.50 | no | fire 10, reloaded 40 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## gunpowder-ranged

Rifle held in the LEFT fist at rest (Prop_L carries it): the right takes the stock's wrist to present, the left the fore-stock; loading and the butt stroke as the mercenary. Triangles 1678 (unchanged); GLB 160 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Aim-fire-reload | 50 | 2.50 | no | fire 10, reloaded 40 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## gunpowder-mercenary

Musket without a bayonet. Aim-fire-reload as the line infantryman. Melee-fallback: a butt stroke (swung back on the right, the butt driven forward at the belly). The left fist leaves the sabre's hilt for the stock. Triangles 1732 (unchanged); GLB 167 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Aim-fire-reload | 50 | 2.50 | no | fire 10, reloaded 40 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## gunpowder-support

Spade in both fists (the right under the handle, the left half way down), bent over the work. Build: the blade driven into the ground in front (contact 13), levered back, the earth thrown to the left; Repair: crouched, quicker (contact 10). The gabion stays on his back. No Mine (no pick). Triangles 1922 (unchanged); GLB 171 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Build | 25 | 1.25 | yes | contact 13 |
| Repair | 21 | 1.05 | yes | contact 10 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |

## modern-infantry

Assault rifle in both fists (the right on the pistol grip, the left on the handguard, as at rest). Aim-fire-reload: shouldered side on, fire 8 (one shot and the kick), lowered, the left hand to a pouch and back to the magazine well (reloaded 32: the magazine is part of the rifle, so the swap is the hand's motion only), back to rest. Melee-fallback: a butt stroke. Triangles 1870 (unchanged); GLB 174 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Aim-fire-reload | 40 | 2.00 | no | fire 8, reloaded 32 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

## modern-mercenary

Carbine low in the right fist, the left thumb in the rig at rest: the left takes the handguard to shoulder it. Aim-fire-reload and Melee-fallback as the rifleman. Triangles 1842 (unchanged); GLB 175 KB packed.

| Clip | Frames | Seconds | Loop | Events |
|---|---|---|---|---|
| Idle | 41 | 2.05 | yes | - |
| Walk | 21 | 1.05 | yes | - |
| Run | 15 | 0.75 | yes | - |
| Aim-fire-reload | 40 | 2.00 | no | fire 8, reloaded 32 |
| Melee-fallback | 20 | 1.00 | no | contact 11 |
| Hit | 8 | 0.40 | no | - |
| Death | 30 | 1.50 | no | settle 30 |
| DeathAlt | 30 | 1.50 | no | settle 30 |

