# scripts/blender/build_classical_infantry.py
# The classical swordsman game model (unit art brief v3, unit 6, the pilot), built from the
# approved 2D turnaround with primitives: about 1,200 triangles, flat materials, the brief's rig
# with rigid weights, and every Archetype A clip. Game scale: head top at 1.0 m, facing -Y.
#
#   python -m scripts.blender.build_classical_infantry  <out_dir>
#
# Writes <out_dir>/classical-infantry.blend and <out_dir>/classical-infantry.glb (+ .json).
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402

MATS = ['Team', 'Skin', 'Hair', 'Leather', 'LeatherDark', 'Bronze', 'Iron', 'Wood', 'Linen']


def build_body(pb):
    # torso: mail vest over a linen tunic, belt, baldric
    pb.cyl('Iron', 'chest', 0.100, 0.118, 0.23, at=(0, 0, 0.695), scale=(1, 0.72, 1), segments=10)
    pb.cyl('LeatherDark', 'spine', 0.106, 0.106, 0.03, at=(0, 0, 0.578), scale=(1, 0.74, 1), segments=10)
    pb.box('Leather', 'chest', (0.035, 0.012, 0.30), at=(0.0, -0.078, 0.70), rot=(0, -36, 0))
    pb.box('Leather', 'chest', (0.035, 0.012, 0.30), at=(0.0, 0.078, 0.70), rot=(0, 36, 0))
    # shoulders: mail caps and linen sleeves
    for s in (1, -1):
        pb.cyl('Iron', 'chest', 0.055, 0.045, 0.05, at=(s * 0.115, 0, 0.80), rot=(0, s * -25, 0), segments=8)
        pb.cyl('Linen', 'upper_arm.%s' % ('L' if s > 0 else 'R'), 0.046, 0.05, 0.085, at=(s * 0.132, 0, 0.745), rot=(0, s * -8, 0), segments=8)
    # tunic hem (team cloth) and the leather pteruges over it
    pb.cyl('Team', 'hips', 0.126, 0.105, 0.13, at=(0, 0, 0.505), scale=(1, 0.82, 1), segments=10)
    for i in range(10):
        a = i * 36 + 18
        x = 0.118 * ti.math.sin(ti.math.radians(a))
        y = -0.098 * ti.math.cos(ti.math.radians(a))
        pb.box('Leather', 'hips', (0.032, 0.01, 0.105), at=(x, y, 0.508), rot=(0, 0, a))
    # neck and head
    pb.cyl('Skin', 'neck', 0.032, 0.034, 0.07, at=(0, 0, 0.855), segments=8)
    pb.sphere('Skin', 'head', 0.068, at=(0, 0, 0.925), scale=(0.95, 1.0, 1.05), u=8, v=6)
    pb.box('Hair', 'head', (0.06, 0.035, 0.035), at=(0, -0.045, 0.875))
    # helmet: dome, brow band, cheek guards, neck guard, the team-coloured ridge on top
    pb.sphere('Bronze', 'head', 0.078, at=(0, 0, 0.94), scale=(1.0, 1.04, 1.0), u=10, v=6, cut_below=-0.03)
    pb.box('Bronze', 'head', (0.13, 0.022, 0.026), at=(0, -0.07, 0.948))
    for s in (1, -1):
        pb.box('Bronze', 'head', (0.022, 0.034, 0.062), at=(s * 0.064, -0.036, 0.882), rot=(0, 0, s * 12))
    pb.box('Bronze', 'head', (0.11, 0.03, 0.028), at=(0, 0.068, 0.893), rot=(20, 0, 0))
    pb.custom('head', 'Team',
              verts=[(-0.013, -0.085, 1.005), (0.013, -0.085, 1.005), (0.013, 0.085, 1.0), (-0.013, 0.085, 1.0),
                     (-0.006, -0.07, 1.075), (0.006, -0.07, 1.075), (0.006, 0.075, 1.06), (-0.006, 0.075, 1.06)],
              faces=[(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)])
    # arms: upper arm, forearm (bracer on the sword arm), hands
    for s, side in ((1, 'L'), (-1, 'R')):
        pb.cyl('Skin', 'upper_arm.' + side, 0.034, 0.038, 0.10, at=(s * 0.137, 0, 0.675), rot=(0, s * -5, 0), segments=8)
        if side == 'R':
            pb.cyl('Skin', 'lower_arm.R', 0.03, 0.032, 0.045, at=(s * 0.145, 0, 0.615), segments=8)
            pb.cyl('Bronze', 'lower_arm.R', 0.036, 0.04, 0.10, at=(s * 0.147, 0, 0.545), segments=8)
        else:
            pb.cyl('Skin', 'lower_arm.L', 0.029, 0.033, 0.145, at=(s * 0.145, 0, 0.5675), segments=8)
        pb.box('Skin', 'hand.' + side, (0.045, 0.05, 0.085), at=(s * 0.155, -0.012, 0.455))
    # legs: thighs, greaves with straps, ankles, sandalled feet
    for s, side in ((1, 'L'), (-1, 'R')):
        pb.cyl('Skin', 'upper_leg.' + side, 0.047, 0.06, 0.225, at=(s * 0.068, 0, 0.388), segments=8)
        pb.cyl('Bronze', 'lower_leg.' + side, 0.036, 0.047, 0.20, at=(s * 0.07, -0.004, 0.17), segments=8)
        pb.box('LeatherDark', 'lower_leg.' + side, (0.085, 0.09, 0.012), at=(s * 0.07, 0.0, 0.225))
        pb.box('LeatherDark', 'lower_leg.' + side, (0.08, 0.085, 0.012), at=(s * 0.07, 0.0, 0.11))
        pb.cyl('Skin', 'lower_leg.' + side, 0.028, 0.031, 0.05, at=(s * 0.07, 0, 0.05), segments=8)
        pb.box('Skin', 'foot.' + side, (0.062, 0.135, 0.038), at=(s * 0.07, -0.035, 0.022))
        pb.box('LeatherDark', 'foot.' + side, (0.07, 0.15, 0.012), at=(s * 0.07, -0.038, 0.006))
        pb.box('LeatherDark', 'foot.' + side, (0.072, 0.012, 0.014), at=(s * 0.07, -0.07, 0.044))
        pb.box('LeatherDark', 'foot.' + side, (0.072, 0.012, 0.014), at=(s * 0.07, -0.02, 0.044))


def build_sword(pb):
    # 0.40 m: the guard sits at the bottom of the fist, the grip passes through the hand, the
    # blade points down and a little forward in the rest pose
    at = Vector((-0.157, -0.02, 0.41))
    rot = (-22, 0, 0)
    R = ti.Matrix.Rotation(ti.math.radians(rot[0]), 3, 'X')

    def w(local):
        return tuple(at + R @ Vector(local))
    pb.custom('weapon', 'Iron',
              verts=[(-0.013, -0.003, -0.008), (0.013, -0.003, -0.008), (0.013, 0.003, -0.008), (-0.013, 0.003, -0.008),
                     (-0.011, -0.002, -0.27), (0.011, -0.002, -0.27), (0.011, 0.002, -0.27), (-0.011, 0.002, -0.27),
                     (0, 0, -0.315)],
              faces=[(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
                     (4, 5, 8), (5, 6, 8), (6, 7, 8), (7, 4, 8)],
              at=tuple(at), rot=rot)
    pb.box('Bronze', 'weapon', (0.064, 0.016, 0.014), at=tuple(at), rot=rot)
    pb.cyl('Leather', 'weapon', 0.011, 0.011, 0.07, at=w((0, 0, 0.042)), rot=rot, segments=6)
    pb.sphere('Bronze', 'weapon', 0.015, at=w((0, 0, 0.085)), u=6, v=4)


def build_shield(pb):
    # curved rectangle 0.30 x 0.44, curved round a vertical axis; face and rim are team paint,
    # the back is wood, the boss iron. Built facing -Y, then turned toward the left-front.
    R, t, h, half = 0.19, 0.012, 0.36, ti.math.radians(33)
    segs = 6
    verts = []
    for ring_r in (R, R - t):
        for zz in (h / 2, -h / 2):
            for i in range(segs + 1):
                a = -half + (2 * half) * i / segs
                verts.append((ring_r * ti.math.sin(a), -(ring_r * ti.math.cos(a) - R), zz))
    n = segs + 1

    def idx(ring, row, i):
        return ring * 2 * n + row * n + i
    faces = []
    tags = {}
    for i in range(segs):
        f = (idx(0, 1, i), idx(0, 1, i + 1), idx(0, 0, i + 1), idx(0, 0, i))  # outer face
        faces.append(f); tags[len(faces) - 1] = 'Team'
        f = (idx(1, 0, i), idx(1, 0, i + 1), idx(1, 1, i + 1), idx(1, 1, i))  # inner (back)
        faces.append(f); tags[len(faces) - 1] = 'Wood'
        f = (idx(0, 0, i), idx(0, 0, i + 1), idx(1, 0, i + 1), idx(1, 0, i))  # top rim
        faces.append(f); tags[len(faces) - 1] = 'Iron'
        f = (idx(1, 1, i), idx(1, 1, i + 1), idx(0, 1, i + 1), idx(0, 1, i))  # bottom rim
        faces.append(f); tags[len(faces) - 1] = 'Iron'
    for i, order in ((0, (idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0))),
                     (segs, (idx(0, 1, segs), idx(1, 1, segs), idx(1, 0, segs), idx(0, 0, segs)))):
        faces.append(order); tags[len(faces) - 1] = 'Iron'
    face_mats = list(tags[i] for i in range(len(faces)))

    counter = {'i': 0}

    def mat_fn(face):
        m = face_mats[counter['i']]
        counter['i'] += 1
        return m
    at = (0.185, -0.07, 0.49)
    rot = (0, 0, 4)
    pb.custom('shield', mat_fn, verts, faces, at=at, rot=rot)
    # boss on the face, a thumb's width proud of it
    off = Vector((0, -0.006, 0))
    off.rotate(ti.Matrix.Rotation(ti.math.radians(rot[2]), 3, 'Z'))
    pb.sphere('Iron', 'shield', 0.03, at=(at[0] + off.x, at[1] + off.y, at[2]), u=8, v=5)


# ---- clips (brief 6.3, Archetype A) -------------------------------------------------------------

def P(**bones):
    """Pose shorthand: P(upper_arm_R=[('X', -30)]) -> {'upper_arm.R': [...]}; the dotted side
    comes from a trailing _L / _R."""
    out = {}
    for k, v in bones.items():
        if k == 'hips_loc':
            out[k] = v
            continue
        name = k[:-2] + '.' + k[-1] if k.endswith(('_L', '_R')) else k
        out[name] = v
    return out


REST = P()
# arms hang; the shield arm is a little forward so the shield covers the thigh
IDLE = P(upper_arm_L=[('X', -10), ('Y', 4)], upper_arm_R=[('X', -12), ('Y', 16)], lower_arm_R=[('X', -8)], weapon=[('X', -8)], chest=[('X', 1)])


def breathe(amount):
    return P(upper_arm_L=[('X', -10), ('Y', 4 + amount)], upper_arm_R=[('X', -12), ('Y', 16 + amount)], lower_arm_R=[('X', -8)], weapon=[('X', -8)],
             chest=[('X', 1 - amount * 0.7)], head=[('X', amount * 0.5)])


def leg_profile(phase, swing, knee):
    """One leg over a cycle: stance (phase 0 to 0.5) moves the thigh back at constant speed so
    the planted foot does not skate; the swing (0.5 to 1) brings it forward with the knee lifted."""
    phase %= 1.0
    if phase < 0.5:
        thigh = swing - 4 * swing * phase
        bend = 5
    else:
        t = (phase - 0.5) * 2
        thigh = -swing + 2 * swing * (0.5 - 0.5 * ti.math.cos(ti.math.pi * t))
        bend = 5 + knee * ti.math.sin(ti.math.pi * t)
    return thigh, bend


def stride(phase, swing=34, knee=45, lean=0, arm=15):
    """phase 0: left foot forward at contact; 0.5: right foot forward."""
    tl, kl = leg_profile(phase, swing, knee)
    tr, kr = leg_profile(phase + 0.5, swing, knee)
    c = ti.math.cos(phase * 2 * ti.math.pi)
    s = ti.math.sin(phase * 2 * ti.math.pi)
    return P(
        upper_leg_L=[('X', -tl)], lower_leg_L=[('X', kl)],
        upper_leg_R=[('X', -tr)], lower_leg_R=[('X', kr)],
        upper_arm_R=[('X', -arm * c * 0.8 - 6), ('Y', 14)], lower_arm_R=[('X', -8)], weapon=[('X', -8)],
        upper_arm_L=[('X', -10 + arm * c * 0.4), ('Y', 4)],
        spine=[('X', -lean)], chest=[('X', -lean * 0.4), ('Z', -6 * c)],
        hips=[('Z', 5 * c)], head=[('Z', 4 * c)],
        hips_loc=(0, 0, -0.012 * abs(s)),
    )


def cycle(frames, step, **kw):
    return [(1 + i * step, stride(i * step / frames, **kw)) for i in range(frames // step)]


THIGH, SHIN, ANKLE = 0.22, 0.23, 0.05


def _deg(pose, bone, axis):
    return sum(d for a, d in pose.get(bone, []) if a == axis)


def settle(pose):
    """Standing poses: the foot stays level with the ground and the hips sit exactly as high as
    the longest leg reaches, so no key frame has a foot in the floor or floating."""
    hips_x = _deg(pose, 'hips', 'X')
    if abs(hips_x) >= 80:
        return pose
    out = dict(pose)
    reach = 0.0
    for side in ('L', 'R'):
        thigh_fwd = -_deg(pose, 'upper_leg.' + side, 'X') - hips_x
        bend = _deg(pose, 'lower_leg.' + side, 'X')
        shin_fwd = thigh_fwd - bend
        reach = max(reach, THIGH * ti.math.cos(ti.math.radians(thigh_fwd)) + SHIN * ti.math.cos(ti.math.radians(shin_fwd)))
        tilt = max(-30.0, min(25.0, thigh_fwd - bend))
        out['foot.' + side] = [('X', tilt)] + [(a, d) for a, d in pose.get('foot.' + side, []) if a != 'X']
    loc = pose.get('hips_loc', (0, 0, 0))
    out['hips_loc'] = (loc[0], loc[1], (ANKLE + reach) - 0.50)
    return out


def clips():
    out = []
    out.append(('Idle', 48, True, [(1, breathe(0)), (25, breathe(1.5))]))
    out.append(('IdleAlt', 48, True, [
        (1, breathe(0)),
        (14, P(upper_arm_L=[('X', -10), ('Y', 4)], upper_arm_R=[('X', -12), ('Y', 16)], weapon=[('X', -8)], hips=[('Z', 6)], spine=[('Y', 3)], head=[('Z', 20)], hips_loc=(0.01, 0, -0.005))),
        (30, P(upper_arm_L=[('X', -10), ('Y', 4)], upper_arm_R=[('X', -4), ('Y', 14)], lower_arm_R=[('X', -16)], weapon=[('X', -30)], hips=[('Z', -5)], head=[('Z', -16)], hips_loc=(-0.01, 0, -0.004))),
        (42, breathe(0.6)),
    ]))
    out.append(('Walk', 24, True, cycle(24, 2)))
    out.append(('Run', 16, True, cycle(16, 2, swing=40, knee=60, lean=10, arm=25)))
    charge = []
    for i in range(8):
        p = stride(i / 8, swing=40, knee=60, lean=12, arm=0)
        p.update(P(upper_arm_R=[('X', -65), ('Y', -12)], lower_arm_R=[('X', -35)], weapon=[('X', -80)],
                   upper_arm_L=[('X', -45), ('Y', 10)], lower_arm_L=[('X', -40)]))
        charge.append((1 + i * 2, p))
    out.append(('Charge', 16, True, charge))
    # Attack: shield punch, then a short thrust from behind the shield; contact 10-11
    out.append(('Attack', 24, True, [
        (1, IDLE),
        (6, P(upper_arm_L=[('X', -55), ('Y', 8)], lower_arm_L=[('X', -30)], upper_arm_R=[('X', 40), ('Y', -10)], lower_arm_R=[('X', -70)],
              weapon=[('X', -70)], spine=[('Z', 12)], chest=[('Z', 10)], upper_leg_L=[('X', -15)], upper_leg_R=[('X', 10)], lower_leg_R=[('X', 15)])),
        (10, P(upper_arm_L=[('X', -40), ('Y', 10)], lower_arm_L=[('X', -25)], upper_arm_R=[('X', -75), ('Y', -6)], lower_arm_R=[('X', -5)],
               weapon=[('X', -92)], spine=[('Z', -18), ('X', -8)], chest=[('Z', -12)], upper_leg_L=[('X', -28)], lower_leg_L=[('X', 20)], upper_leg_R=[('X', 18)], hips_loc=(0, -0.03, -0.02))),
        (11, P(upper_arm_L=[('X', -40), ('Y', 10)], lower_arm_L=[('X', -25)], upper_arm_R=[('X', -78), ('Y', -6)], lower_arm_R=[('X', -3)],
               weapon=[('X', -92)], spine=[('Z', -18), ('X', -8)], chest=[('Z', -12)], upper_leg_L=[('X', -28)], lower_leg_L=[('X', 20)], upper_leg_R=[('X', 18)], hips_loc=(0, -0.03, -0.02))),
        (18, P(upper_arm_L=[('X', -20), ('Y', 8)], lower_arm_L=[('X', -10)], upper_arm_R=[('X', -20), ('Y', -6)], lower_arm_R=[('X', -20)],
               weapon=[('X', -40)], spine=[('Z', -4)], upper_leg_L=[('X', -10)], upper_leg_R=[('X', 6)], hips_loc=(0, -0.01, -0.008))),
    ]))
    # Attack2: rising diagonal cut; anticipation blade low to the right, contact 13-14
    out.append(('Attack2', 30, True, [
        (1, IDLE),
        (8, P(upper_arm_R=[('X', 25), ('Y', -35)], lower_arm_R=[('X', -20)], weapon=[('X', -30), ('Y', 30)], spine=[('Z', 15)], chest=[('Z', 12), ('X', 6)],
              upper_arm_L=[('X', -25), ('Y', 10)], lower_arm_L=[('X', -20)], upper_leg_R=[('X', 10)], lower_leg_R=[('X', 20)], hips_loc=(0, 0.01, -0.015))),
        (13, P(upper_arm_R=[('X', -95), ('Y', 25)], lower_arm_R=[('X', -10)], weapon=[('X', -60), ('Y', -40)], spine=[('Z', -22), ('X', -6)], chest=[('Z', -14)],
               upper_arm_L=[('X', -20), ('Y', 14)], lower_arm_L=[('X', -20)], upper_leg_L=[('X', -22)], lower_leg_L=[('X', 18)], upper_leg_R=[('X', 14)], hips_loc=(0, -0.02, -0.02))),
        (14, P(upper_arm_R=[('X', -100), ('Y', 28)], lower_arm_R=[('X', -8)], weapon=[('X', -60), ('Y', -42)], spine=[('Z', -22), ('X', -6)], chest=[('Z', -14)],
               upper_arm_L=[('X', -20), ('Y', 14)], lower_arm_L=[('X', -20)], upper_leg_L=[('X', -22)], lower_leg_L=[('X', 18)], upper_leg_R=[('X', 14)], hips_loc=(0, -0.02, -0.02))),
        (22, P(upper_arm_R=[('X', -30), ('Y', 0)], lower_arm_R=[('X', -25)], weapon=[('X', -30)], spine=[('Z', -6)],
               upper_arm_L=[('X', -12), ('Y', 8)], upper_leg_L=[('X', -8)], upper_leg_R=[('X', 5)])),
    ]))
    # Block: shield up, crouch, absorb, lower (no loop)
    out.append(('Block', 24, False, [
        (1, IDLE),
        (4, P(upper_arm_L=[('X', -70), ('Y', 25)], lower_arm_L=[('X', -60)], shield=[('X', -20)], upper_arm_R=[('X', 30), ('Y', -8)], lower_arm_R=[('X', -40)],
              spine=[('X', -6)], upper_leg_L=[('X', -15)], lower_leg_L=[('X', 20)], upper_leg_R=[('X', -10)], lower_leg_R=[('X', 25)], hips_loc=(0, 0, -0.03))),
        (8, P(upper_arm_L=[('X', -60), ('Y', 30)], lower_arm_L=[('X', -70)], shield=[('X', -25)], upper_arm_R=[('X', 35), ('Y', -8)], lower_arm_R=[('X', -45)],
              spine=[('X', 8)], chest=[('X', 6)], head=[('X', 10)], upper_leg_L=[('X', -30)], lower_leg_L=[('X', 45)], upper_leg_R=[('X', -25)], lower_leg_R=[('X', 50)], hips_loc=(0, 0.04, -0.08))),
        (16, P(upper_arm_L=[('X', -40), ('Y', 15)], lower_arm_L=[('X', -35)], upper_arm_R=[('X', 15), ('Y', -6)], lower_arm_R=[('X', -20)],
               upper_leg_L=[('X', -10)], lower_leg_L=[('X', 15)], upper_leg_R=[('X', -8)], lower_leg_R=[('X', 16)], hips_loc=(0, 0.01, -0.025))),
        (24, IDLE),
    ]))
    out.append(('Hit', 10, False, [
        (1, IDLE),
        (3, P(spine=[('X', 14)], chest=[('X', 8)], head=[('X', 12)], upper_arm_L=[('X', -20), ('Y', 14)], upper_arm_R=[('X', 20), ('Y', -14)], upper_leg_L=[('X', -8)], hips_loc=(0, 0.03, -0.01))),
        (10, IDLE),
    ]))
    # Death: knees buckle, sit back, fall onto the back (hips tip back = negative X), hold
    lying_back = P(hips=[('X', -88)], upper_leg_L=[('Y', 6)], lower_leg_L=[('X', 6)], upper_leg_R=[('Y', -6)], lower_leg_R=[('X', 4)],
                   spine=[('X', 2)], head=[('X', 6), ('Z', 25)], neck=[('X', 4)],
                   upper_arm_L=[('X', -12), ('Y', -60)], lower_arm_L=[('X', -20)], shield=[('Y', -30)],
                   upper_arm_R=[('X', -16), ('Y', 70)], lower_arm_R=[('X', -8)], weapon=[('X', 20), ('Z', 30)],
                   hips_loc=(0, 0.12, -0.405))
    out.append(('Death', 36, False, [
        (1, IDLE),
        (10, P(upper_leg_L=[('X', -35)], lower_leg_L=[('X', 60)], upper_leg_R=[('X', -30)], lower_leg_R=[('X', 55)], spine=[('X', 6)], head=[('X', 15)],
               upper_arm_L=[('X', -20), ('Y', -10)], upper_arm_R=[('X', -10), ('Y', 25)], weapon=[('X', -10)], hips_loc=(0, 0.0, -0.06))),
        (20, P(hips=[('X', -40)], upper_leg_L=[('X', -30)], lower_leg_L=[('X', 60)], upper_leg_R=[('X', -26)], lower_leg_R=[('X', 55)],
               spine=[('X', 10)], chest=[('X', 6)], head=[('X', 20)],
               upper_arm_L=[('X', -20), ('Y', -35)], upper_arm_R=[('X', -20), ('Y', 45)], weapon=[('X', 0)], hips_loc=(0, 0.08, -0.15))),
        (24, P(hips=[('X', -66)], upper_leg_L=[('X', -14), ('Y', 4)], lower_leg_L=[('X', 30)], upper_leg_R=[('X', -12), ('Y', -4)], lower_leg_R=[('X', 26)],
               spine=[('X', 6)], head=[('X', 12), ('Z', 12)], upper_arm_L=[('X', -16), ('Y', -48)], upper_arm_R=[('X', -18), ('Y', 58)], weapon=[('X', 10)],
               hips_loc=(0, 0.11, -0.33))),
        (28, lying_back), (36, lying_back),
    ]))
    # DeathAlt: twist and fall forward onto the shield (hips tip forward = positive X), hold
    lying_front = P(hips=[('X', 90), ('Z', 15)], upper_leg_L=[('X', -4), ('Y', 5)], lower_leg_L=[('X', 12)], upper_leg_R=[('X', 2), ('Y', -5)], lower_leg_R=[('X', 6)],
                    spine=[('X', 4)], chest=[('Z', 8)], head=[('X', -14), ('Z', -45)],
                    upper_arm_L=[('Y', -70)], lower_arm_L=[('X', -4)], shield=[('X', 10)],
                    upper_arm_R=[('Y', 75), ('X', 30)], lower_arm_R=[('X', -4)], weapon=[('X', 22)],
                    hips_loc=(0, -0.10, -0.39))
    out.append(('DeathAlt', 36, False, [
        (1, IDLE),
        (10, P(spine=[('Z', 20), ('X', -10)], chest=[('Z', 10)], head=[('X', 10)], upper_leg_L=[('X', -20)], lower_leg_L=[('X', 45)], upper_leg_R=[('X', -15)], lower_leg_R=[('X', 40)],
               upper_arm_L=[('X', -30), ('Y', 0)], upper_arm_R=[('X', -10), ('Y', 25)], weapon=[('X', -20)], hips_loc=(0, 0.0, -0.06))),
        (20, P(hips=[('X', 45), ('Z', 12)], spine=[('X', -6)], upper_leg_L=[('X', -40)], lower_leg_L=[('X', 60)], upper_leg_R=[('X', -36)], lower_leg_R=[('X', 55)],
               upper_arm_L=[('X', -40), ('Y', -30)], lower_arm_L=[('X', -30)], upper_arm_R=[('X', -20), ('Y', 50)], weapon=[('X', 10)], hips_loc=(0, -0.05, -0.18))),
        (25, P(hips=[('X', 70), ('Z', 14)], spine=[('X', -2)], upper_leg_L=[('X', -20)], lower_leg_L=[('X', 40)], upper_leg_R=[('X', -16)], lower_leg_R=[('X', 30)],
               upper_arm_L=[('X', -20), ('Y', -55)], lower_arm_L=[('X', -10)], upper_arm_R=[('Y', 65), ('X', 25)], weapon=[('X', 18)], hips_loc=(0, -0.08, -0.33))),
        (30, lying_front), (36, lying_front),
    ]))
    out.append(('Victory', 40, True, [
        (1, P(upper_arm_R=[('X', -160), ('Y', -20)], lower_arm_R=[('X', -15)], weapon=[('X', -170)], upper_arm_L=[('X', -15), ('Y', 25)], chest=[('X', -4)], head=[('X', -8)])),
        (20, P(upper_arm_R=[('X', -150), ('Y', -30)], lower_arm_R=[('X', -30)], weapon=[('X', -165), ('Y', 15)], upper_arm_L=[('X', -20), ('Y', 35)], chest=[('X', -6)], head=[('X', -12), ('Z', 10)],
               upper_leg_L=[('X', -6)], upper_leg_R=[('X', 4)], hips_loc=(0, 0, -0.015))),
    ]))
    rout = []
    for i in range(8):
        p = stride(i / 8, swing=38, knee=58, lean=14, arm=22)
        p.update(P(upper_arm_L=[('X', 35), ('Y', 20)], lower_arm_L=[('X', -30)], shield=[('X', 30), ('Z', 150)], upper_arm_R=[('X', 10 + 20 * ti.math.cos(i / 8 * 2 * ti.math.pi)), ('Y', 10)],
                   weapon=[('X', 15)], head=[('Z', 55), ('X', -6)], neck=[('Z', 25)], chest=[('Z', 18)]))
        rout.append((1 + i * 2, p))
    out.append(('Rout', 16, True, rout))
    return [(name, frames, loop, [(f, settle(p)) for f, p in keys]) for name, frames, loop, keys in out]


def build(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    scene = ti.clear_scene()
    scene.render.fps = 30
    scene.frame_start = 1
    arm = ti.build_armature('rig')
    pb = ti.PartBuilder(MATS)
    build_body(pb)
    build_sword(pb)
    build_shield(pb)
    mesh_obj = pb.finish('classical-infantry', arm)
    # every vertex group must name a bone
    for vg in mesh_obj.vertex_groups:
        assert vg.name in arm.data.bones, vg.name
    for name, frames, loop, keys in clips():
        action = ti.make_action(arm, name, frames, keys, loop)
        ti.ground_pass(arm, mesh_obj, action, frames + (1 if loop else 0))
    scene.frame_end = 48
    bpy.context.view_layer.objects.active = arm
    tris = sum(len(p.vertices) - 2 for p in mesh_obj.data.polygons)
    print('triangles', tris, 'vertices', len(mesh_obj.data.vertices))
    blend = os.path.join(out_dir, 'classical-infantry.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    glb = os.path.join(out_dir, 'classical-infantry.glb')
    ti.export_glb(glb, [arm, mesh_obj])
    with open(os.path.join(out_dir, 'classical-infantry.json'), 'w') as f:
        json.dump({'restClip': 'Idle', 'quadruped': False}, f)
        f.write('\n')
    print('wrote', blend, glb)
    return tris


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    build(argv[0] if argv else 'build/units')
