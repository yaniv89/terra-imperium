# scripts/blender/build_kingdoms_infantry.py
# Kingdoms infantry (pikeman), quality pass of 2026-10-14, to the standard of the Bronze and Classical
# passes on the shared parts of ti_figure.py; replaces k_infantry of build_units_kingdoms.py:
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_infantry.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the
# rest pose, unchanged). The pike keeps its old names (PikeShaft, PikeHead...: the loader's
# fitPolearm finds "pike" and stretches the shaft to 5 m from the butt on the ground). The look follows
# plans/art/concepts/oct13/units-kingdoms-set.png (design reference only):
#   - a steel kettle hat with a broad sloping brim and a low comb over a mail coif with a short cape
#   - a Team tabard on the chest and the back with panels to mid-thigh in front and behind (all on
#     Spine and Chest, so the battle dyes it), over a quilted linen gambeson whose skirt and long padded
#     sleeves show; a leather belt with a buckle
#   - brown wool hose and leather ankle boots (the Classical men go bare legged in sandals)
#   - a sword at the left hip, the left fist on its pommel
#   - the long pike upright in the right fist, grounded by the right foot: an iron butt, a socket with
#     langets and a narrow head
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/kingdoms-infantry/; copy the GLB to src/assets/units/kingdoms-infantry.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'kingdoms-infantry'
arm = F.start({'Skin': 'C99472', 'Cloth': 'CDBC98', 'Hose': '5C4A38', 'Leather': '553623', 'Metal': ('B4B8BD', .32, .82), 'Mail': ('7E848B', .55, .75),
               'Wood': '7A5636', 'Hair': '2B201A'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose='Hose')
F.arms(long='Cloth', pad=.007, shoulder='Cloth')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head(ears=False)

# ---- gambeson skirt, Team tabard, belt, sword -------------------------------------------------------------
F.skirt('GambesonSkirt', 'Cloth', low=.372, grow=.012, sides=12, ribs=.06, flare=.006)
F.tabard('Tabard', 'Team', low=.405, grow=.010)
F.band('Belt', 'Leather', .536, .562, grow=.024, bone='Spine', bulge=.002)
box('BeltBuckle', (0, -.096, .549), (.030, .012, .030), 'Metal', 'Spine')
F.hip_sword('Sword', 'L')

# ---- the kettle hat over a mail coif ---------------------------------------------------------------------
F.mail_coif()
F.kettle_hat()

# ---- the pike (the right hand's attachment), upright, its butt on the ground --------------------------------
x, y, P = HAND_R.x, HAND_R.y, 'Prop_R'
tube('PikeShaft', [((x, y, .040), .0125, P), ((x, y, 1.990), .0100, P)], 'Wood', 6, caps=(False, False), attachment=True)
tube('PikeButt', [((x, y, .008), .006, P), ((x, y, .024), .013, P), ((x, y, .060), .013, P)], 'Metal', 5, attachment=True)
tube('PikeSocket', [((x, y, 1.950), .0130, P), ((x, y, 2.010), .0105, P)], 'Metal', 6, caps=(False, False), attachment=True)
box('PikeSocketLangets', (x, y, 1.900), (.028, .005, .110), 'Metal', P, True)
# rings are (thickness, width): a narrow leaf
tube('PikeHead', [((x, y, 2.006), (.008, .008), P), ((x, y, 2.045), (.007, .024), P), ((x, y, 2.095), (.006, .018), P),
                  ((x, y, 2.150), (.001, .001), P)], 'Metal', 4, attachment=True)

# ---- the left fist comes to the sword's pommel: posed, then made the rest pose ------------------------------
F.reach('L', (.142, -.096, .672), pole=(1, .4, -.4))
F.bake_rest()

F.finish_rest(UID, 'Pikemen: a steel kettle hat with a broad brim over a mail coif, a Team tabard front and back over a quilted gambeson with padded sleeves, '
              'brown hose and ankle boots, a sword at the hip with the left hand on its pommel, a long pike upright in the right fist',
              notes={'role': 'infantry', 'pike_authored_top_H': 2.15, 'pike_drawn_m': 5},
              clips=FC.clips_hook(UID, FC.Kit('pike')))
