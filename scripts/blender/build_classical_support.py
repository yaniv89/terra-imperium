# scripts/blender/build_classical_support.py
# Classical support (engineer), quality pass of 2026-10-14, to the standard of the Bronze quality pass
# (build_bronze_infantry.py, build_bronze_worker.py) on the shared parts of ti_figure.py; replaces
# b_support of build_units_classical.py:
#   blender -b --factory-startup -P scripts/blender/build_classical_support.py
# Same contract as that builder: the canonical rig under a root empty named after the unit, flat
# material colours, the Team and Skin tags, the old object names (Mantlet, MantletBand*, LadderRail*,
# LadderRung*, PickHaft, PickHead), and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). The look follows
# plans/art/concepts/oct13/units-classical-set.png (design reference only):
#   - a Team over-tunic on the chest and the back (weighted to Spine and Chest, so the whole trunk is
#     the side's colour) over a white tunic with short sleeves, a leather belt and a cross strap
#   - dark hair and a short beard under a Team headband; sandals laced up the calf
#   - a short siege ladder on the back, its two rails standing well above the head (upright and thin,
#     so the far detail level keeps them): the engineer's own silhouette
#   - a tall wicker mantlet on the left arm, beside him, a little turned out, so the man stays in view: a
#     plaited screen in a wooden frame with leather bands (not an emblem shield)
#   - a pick-axe upright in the right fist: an axe blade to the front, a spike behind
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/classical-support/; copy the GLB to src/assets/units/classical-support.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'classical-support'
arm = F.start({'Skin': 'C99472', 'Cloth': 'EEE5CF', 'Leather': '5A3624', 'Wood': '8A6036', 'Wicker': 'C09A56', 'Metal': ('7A7D83', .5, .7),
               'Hair': '2B201A'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=True)
F.arms(sleeve='Cloth')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head()
F.beard()
F.hair()
F.headband('Team', z=.957, height=.028)

# ---- white tunic, Team over-tunic, belt, cross strap ---------------------------------------------------
F.skirt('Tunic', 'Cloth', low=.318)
F.torso('TeamTunic', 'Team', grow=.006, chest=.006)
tube('TeamTunicHem', vertical([.470, .548], 0, [tuple(r + .012 for r in F.radius_at(.470, F.SKIRT)), tuple(r + .010 for r in F.radius_at(.548, F.SKIRT))], 'Spine'),
     'Team', 10, caps=(False, False))
tube('TunicCollar', vertical([.784, .806, .822], 0, [(.062, .052), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 6, caps=(False, False))
F.band('Belt', 'Leather', .528, .560, grow=.014, bone='Spine', bulge=.002)
box('BeltBuckle', (0, -.082, .544), (.030, .012, .028), 'Metal', 'Spine')
strap = [((.086, .070, .790), 'Chest'), ((.090, .000, .808), 'Chest'), ((.066, -.086, .756), 'Chest'), ((.000, -.104, .688), 'Chest'),
         ((-.058, -.086, .612), 'Spine'), ((-.106, -.014, .566), 'Spine'), ((-.066, .080, .580), 'Spine')]
tube('CrossStrap', [(p, (.014, .006), w) for p, w in strap], 'Leather', 4)
tube('ToolPouch', [((-.118, -.030, .540), (.026, .020), 'Hips'), ((-.124, -.032, .490), (.034, .026), 'Hips'), ((-.120, -.030, .450), (.024, .018), 'Hips')], 'Leather', 6)

# ---- the ladder on the back (Prop_Back): two rails above the head, five rungs ---------------------------------
P = 'Prop_Back'
for sx in (-1, 1):
    box(f'LadderRail{sx}', (sx * .086, .122, .790), (.024, .024, .860), 'Wood', P, True)
for k in range(5):
    box(f'LadderRung{k}', (0, .122, .450 + k * .165), (.150, .018, .020), 'Wood', P, True)

# ---- the mantlet (Prop_L): a tall wicker screen in a frame, turned out to the side ----------------------------
P = 'Prop_L'
TURN = math.radians(12)
PIVOT = Vector((HAND_L.x, HAND_L.y, 0))
W, Z0, Z1 = .150, .090, .800


def place(lx, ly, z):
    """From the mantlet's own frame (lx across, ly out of its face, towards the front) to the body's."""
    c, s = math.cos(TURN), math.sin(TURN)
    return (PIVOT.x + .085 + lx * c + ly * s, PIVOT.y - .010 + lx * s - ly * c, z)


cols, rows = [(-W, 0), (0, .026), (W, 0)], [Z0, (Z0 + Z1) / 2, Z1]
verts = [place(lx, bow, z) for z in rows for lx, bow in cols] + [place(lx, bow - .014, z) for z in rows for lx, bow in cols]
faces = []
for r in range(2):
    for c in range(2):
        a, b, d, e = r * 3 + c, r * 3 + c + 1, (r + 1) * 3 + c + 1, (r + 1) * 3 + c
        faces += [(a, b, d), (a, d, e), (9 + b, 9 + a, 9 + e), (9 + b, 9 + e, 9 + d)]
ring = [0, 1, 2, 5, 8, 7, 6, 3]
for i in range(8):
    a, b = ring[i], ring[(i + 1) % 8]
    faces += [(a, 9 + a, 9 + b), (a, 9 + b, b)]
raw('Mantlet', verts, faces, 'Wicker', P, True)
for k, z in enumerate((Z0 + .100, (Z0 + Z1) / 2, Z1 - .100)):
    bv = [place(lx, bow + .006, z + dz) for dz in (-.016, .016) for lx, bow in cols] + [place(lx, bow - .004, z + dz) for dz in (-.016, .016) for lx, bow in cols]
    bf = []
    for c in range(2):
        a, b, d, e = c, c + 1, 3 + c + 1, 3 + c
        bf += [(a, b, d), (a, d, e), (6 + a, 6 + b, b), (6 + a, b, a), (6 + e, 6 + d, d), (6 + e, d, e)]
    bf += [(0, 3, 9), (0, 9, 6), (2, 8, 11), (2, 11, 5)]
    F.facing[f'MantletBand{k}'] = tuple(Vector(place(0, 1, 0)) - Vector(place(0, 0, 0)))
    raw(f'MantletBand{k}', bv, bf, 'Leather', P, True)
for sx in (-1, 1):
    p = place(sx * W, -.004, 0)
    box(f'MantletPost{sx}', (p[0], p[1], (Z0 + Z1) / 2 - .020), (.026, .026, Z1 - Z0 + .060), 'Wood', P, True)
tube('MantletGrip', [(place(-.060, -.012, HAND_L.z), .010, P), (tuple(HAND_L), .011, P), (place(.060, -.012, HAND_L.z), .010, P)], 'Leather', 4, attachment=True)

# ---- the pick-axe (Prop_R): upright, an axe blade to the front and a spike behind -----------------------------
P = 'Prop_R'
x, y, top = HAND_R.x, HAND_R.y, .985
tube('PickHaft', [((x, y, .030), .0125, P), ((x, y, top + .034), .0115, P)], 'Wood', 6, attachment=True)
# rings are (thickness, height) here: the head runs front to back
tube('PickHead', [((x, y - .135, top - .004), (.004, .050), P), ((x, y - .070, top), (.010, .030), P), ((x, y - .025, top), (.019, .022), P),
                  ((x, y + .030, top), (.019, .021), P), ((x, y + .110, top - .010), (.011, .013), P), ((x, y + .190, top - .044), (.004, .004), P)],
     'Metal', 4, attachment=True)

F.finish_rest(UID, 'Engineers: a Team over-tunic on a white tunic, belt and cross strap, dark hair and beard under a Team headband, a short ladder on the back '
              'with its rails above the head, a tall wicker mantlet in a wooden frame on the left arm, a pick-axe held upright',
              notes={'role': 'support'},
              clips=FC.clips_hook(UID, FC.Kit('tool', tool='pick', still=True)))
