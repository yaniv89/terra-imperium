# scripts/blender/ti_mounted_clips.py
# Authored battle clips for the mounted units and the generals of the five ages (and the units of several
# rigs that share their machinery: the Bronze chariot, the Modern ATGM team), to the contract of
# plans/art/clip-animation-pipeline.md section 7 (7.3: what the code session must know), over the shared
# tooling of ti_clips.py and the foot soldiers' poser and key library (ti_foot_clips.py):
#   - several rigs in one file (MountRig and RiderRig; MountRig, CommanderRig and BearerRig; the chariot's
#     two horses, its car and its crew; the ATGM launcher and its two men): every clip keys every rig for the
#     same frame range, one action per rig on an NLA track named after the clip, exported with
#     export_animation_mode='NLA_TRACKS' (one glTF animation per clip over all the rigs)
#   - the horse (Horse): a gait is a phase per leg, a duty factor (the share of the cycle a hoof is down)
#     and a stride; a planted hoof slides back along the ground at the gait's speed, a lifted one swings
#     forward over an arc; two-bone reach puts each hoof on its target (front knees bend forward, hocks
#     back); the body rises and falls so the planted legs reach (and floats over the suspension), pitches
#     and rolls about the middle of the barrel; the neck and head bob with the gait, the tail follows
#       Walk  four-beat (left hind, left fore, right hind, right fore), duty .62
#       Trot  two-beat, diagonal pairs (left fore with right hind), duty .42
#       Gallop three-beat (right hind; left hind with right fore; left fore; then the suspension), duty .30
#       Charge the same gallop, faster, the neck stretched
#   - riders (and the chariot's crew) are posed on their own rig with the foot soldiers' library (hand
#     targets, weapons placed in the world, two-bone arms), then carried: their Root follows the carrier
#     (the horse's back, the car's floor); a rider rises in the trot and sits the gallop; his feet stay in
#     the stirrups (two-bone legs) where the horse has them
#   - the reins' hand end hangs from its own bone Mount_Rein (a child of Mount_Neck) that follows the
#     rider's rein fist
#   - in place: Mount_Root and Root move only up and down (and the riders' Roots when they are thrown in
#     the falls); loops closed; Idle frame 1 is the rest pose of every rig, exactly
#   - events (1-based): contact (Charge, Attack; held two frames), release (Archer-shoot), fire and reloaded
#     (Aim-fire-reload), settle (Death, DeathAlt, Wreck: the last frame)
# Blender Z up, the front faces -Y, a standing person is 1 tall.
import bpy, math, os, json
from mathutils import Vector, Matrix, Quaternion, Euler
import ti_units as u
import ti_figure as F
import ti_clips as C
import ti_foot_clips as FC
from ti_clips import Clip, nrm, upd, FPS, spec_at

V = Vector
SETS = {
    'mounted': ('Idle', 'Walk', 'Trot', 'Gallop', 'Charge', 'Attack', 'Hit', 'Death', 'DeathAlt', 'Cheer'),
    'general': ('Idle', 'Walk', 'Trot', 'Gallop', 'Charge', 'Attack', 'Hit', 'Death', 'DeathAlt', 'Cheer'),
    'chariot': ('Idle', 'Move', 'Charge', 'Archer-shoot', 'Hit', 'Wreck'),
    'atgm': ('Idle', 'Walk', 'Aim-fire-reload', 'Hit', 'Death', 'DeathAlt'),
}
# name: (frames, loop, events)
ACTS = {
    'Idle': (41, True, {}), 'Walk': (21, True, {}), 'Trot': (15, True, {}), 'Gallop': (13, True, {}), 'Move': (13, True, {}),
    'Charge': (41, False, {'contact': 23}), 'Attack': (21, False, {'contact': 11}), 'Hit': (10, False, {}),
    'Death': (40, False, {'settle': 40}), 'DeathAlt': (40, False, {'settle': 40}), 'Wreck': (40, False, {'settle': 40}),
    'Cheer': (33, True, {}), 'Archer-shoot': (33, False, {'release': 22}), 'Aim-fire-reload': (50, False, {'fire': 12, 'reloaded': 38}),
}
SHEETS = {
    'mounted': {'moving': ['Idle', 'Walk', 'Trot', 'Gallop', 'Cheer'], 'combat': ['Charge', 'Attack', 'Hit', 'Death', 'DeathAlt']},
    'general': {'moving': ['Idle', 'Walk', 'Trot', 'Gallop', 'Cheer'], 'combat': ['Charge', 'Attack', 'Hit', 'Death', 'DeathAlt']},
    'chariot': {'moving': ['Idle', 'Move', 'Charge'], 'combat': ['Archer-shoot', 'Hit', 'Wreck']},
    'atgm': {'combat': ['Idle', 'Aim-fire-reload', 'Hit', 'Death', 'DeathAlt']},
}
# The gaits: T frames a cycle, d the duty factor, amp half the stance's sweep (H), lift (front, hind), each
# leg's touch-down phase. Natural ground speed = 2 amp / (d T / 20) H a second (plans 7.3).
GAITS = {
    'walk': dict(T=20, d=.62, amp=.17, lift=(.075, .06), ph={'HL': 0, 'FL': .25, 'HR': .5, 'FR': .75}, hop=0),
    'trot': dict(T=14, d=.42, amp=.20, lift=(.13, .10), ph={'FL': 0, 'HR': 0, 'FR': .5, 'HL': .5}, hop=.010),
    'gallop': dict(T=12, d=.30, amp=.26, lift=(.17, .13), ph={'HR': 0, 'HL': .2, 'FR': .2, 'FL': .4}, hop=.022),
    'charge': dict(T=10, d=.30, amp=.26, lift=(.18, .14), ph={'HR': 0, 'HL': .2, 'FR': .2, 'FL': .4}, hop=.026),
}
LEGS = {'FL': ('Front', 'L'), 'FR': ('Front', 'R'), 'HL': ('Hind', 'L'), 'HR': ('Hind', 'R')}
TAU = 2 * math.pi


def cosd(x):
    return math.cos(TAU * x)


def sind(x):
    return math.sin(TAU * x)


def aim(arm, name, direction):
    pb = arm.pose.bones[name]
    M = pb.matrix.copy()
    y = M.to_3x3().col[1].normalized()
    q = y.rotation_difference(nrm(direction))
    pb.matrix = Matrix.Translation(M.translation) @ (q.to_matrix() @ M.to_3x3()).to_4x4()
    upd()


def two_bone(arm, upper, lower, lengths, target, pole):
    """ti_clips.Poser.two_bone for any armature: the lower bone's tail at `target`, the joint towards `pole`."""
    upd()
    S = arm.pose.bones[upper].head.copy()
    l1, l2 = lengths
    d = V(target) - S
    L = max(abs(l1 - l2) * 1.01 + 1e-4, min(d.length, (l1 + l2) * .999))
    dn = nrm(d)
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    h = math.sqrt(max(0, l1 * l1 - a * a))
    p = nrm(V(pole) - dn * V(pole).dot(dn))
    E = S + dn * a + p * h
    aim(arm, upper, E - S)
    aim(arm, lower, S + dn * L - E)


def blend(M, w):
    """The transform M taken `w` of the way from the identity."""
    if w >= .9999:
        return M.copy()
    if w <= 1e-4:
        return Matrix.Identity(4)
    loc, rot, _ = M.decompose()
    return Matrix.Translation(loc * w) @ Quaternion((1, 0, 0, 0)).slerp(rot, w).to_matrix().to_4x4()


def reset(arm):
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def snapshot(arm):
    return {pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in arm.pose.bones}


# ---- the horse ----------------------------------------------------------------------------------------------

class Horse:
    """A fine horse's rig (ti_units.quadruped bones) posed from a spec: bob (Mount_Root up and down), pitch,
    roll, yaw (degrees, the body about the middle of the barrel: + pitch puts the nose down, + roll lifts the
    left side), neck, neck_y, head, tail, tail_y (degrees: + neck lowers the head, + tail lifts it),
    hooves {leg: (dy, dz)} (from the rest hoof, on the ground's frame), lw (0 to 1: the legs' targets move
    from the ground to the body's frame, for a horse lying down) with lb {leg: (x, y, z)} offsets in the body's
    frame, ground (1: the lowest point put on the floor)."""

    def __init__(self, arm, meshes):
        self.arm = arm
        B = arm.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in B}
        self.legs = {}
        for key, (end, s) in LEGS.items():
            up, lo = f'Mount_Leg{end}_{s}', f'Mount_Shin{end}_{s}'
            top, hock, hoof = B[up].head_local.copy(), B[lo].head_local.copy(), B[lo].tail_local.copy()
            self.legs[key] = dict(up=up, lo=lo, top=top, hoof=hoof, l=((hock - top).length, (hoof - hock).length),
                                  pole=V((0, -1, -.05)) if end == 'Front' else V((0, 1, -.05)))
        self.pivot = V((0, 0, B['Mount_Spine'].head_local.z))
        self.body = C.ground_set([m for m in meshes if not m.get('attachment')], None)
        self.D = Matrix.Identity(4)
        self.rein = 'Mount_Rein' if 'Mount_Rein' in B else None

    def pb(self, name):
        return self.arm.pose.bones[name]

    def pose(self, s):
        A = self.arm
        reset(A)
        if s is None:  # the rest pose, exactly
            upd()
            self.D = Matrix.Identity(4)
            return
        rr = self.rest['Mount_Root']
        self.pb('Mount_Root').location = rr.to_3x3().inverted() @ V((0, 0, s.get('bob', 0)))
        upd()
        Rd = self.pb('Mount_Root').matrix @ rr.inverted()
        R = Euler((math.radians(s.get('pitch', 0)), math.radians(s.get('roll', 0)), math.radians(s.get('yaw', 0))), 'XYZ').to_matrix().to_4x4()
        Dsp = Rd @ Matrix.Translation(self.pivot) @ R @ Matrix.Translation(-self.pivot)
        self.pb('Mount_Spine').matrix = Dsp @ self.rest['Mount_Spine']
        upd()
        u.rotate_world(A, 'Mount_Neck', (s.get('neck', 0), 0, s.get('neck_y', 0)))
        u.rotate_world(A, 'Mount_Head', (s.get('head', 0), 0, 0))
        u.rotate_world(A, 'Mount_Tail', (s.get('tail', 0), 0, s.get('tail_y', 0)))
        upd()
        lw = float(s.get('lw', 0))
        hooves, lb = s.get('hooves', {}), s.get('lb', {})
        for key, leg in self.legs.items():
            dy, dz = hooves.get(key, (0, 0))
            g = leg['hoof'] + V((0, dy, dz))
            b = Dsp @ (leg['hoof'] + V(lb.get(key, (0, 0, 0))))
            t = g.lerp(b, lw)
            pole = (Dsp.to_3x3() @ leg['pole']) if lw > .5 else leg['pole']
            two_bone(A, leg['up'], leg['lo'], leg['l'], t, pole)
        if float(s.get('ground', 0)) > .5:
            low = C.lowest(self.body)
            rp = self.pb('Mount_Root')
            rp.location = rp.location + rr.to_3x3().inverted() @ V((0, 0, C.FLOOR - low))
            upd()
        self.D = self.pb('Mount_Spine').matrix @ self.rest['Mount_Spine'].inverted()

    def neck_delta(self):
        return self.pb('Mount_Neck').matrix @ self.rest['Mount_Neck'].inverted()

    def follow_rein(self, fist_world, w):
        """Mount_Rein's head at the rider's rein fist (`w` 1), or riding on the neck as at rest (`w` 0)."""
        if not self.rein:
            return
        rest = self.rest[self.rein]
        on_neck = self.neck_delta() @ rest.translation
        target = self.arm.matrix_world.inverted() @ fist_world if fist_world is not None else on_neck
        t = on_neck.lerp(target, w)
        self.pb(self.rein).matrix = Matrix.Translation(t) @ (self.neck_delta().to_3x3() @ rest.to_3x3()).to_4x4()
        upd()


def hoof_at(g, key, phase):
    """A hoof's (dy, dz) at the gait's phase: down and sliding back (stance), then lifted and swung forward."""
    p = (phase - g['ph'][key]) % 1
    d, amp = g['d'], g['amp']
    if p < d:
        return (-amp + 2 * amp * p / d, 0.)
    s = (p - d) / (1 - d)
    lift = g['lift'][0 if key[0] == 'F' else 1]
    e = s * s * (3 - 2 * s)
    return (amp - 2 * amp * e, lift * math.sin(math.pi * min(1, s * 1.08)) ** .9)


def gait_shape(kind, phase):
    """Pitch, roll, neck, head, tail and the authored compression of a gait at `phase`."""
    p = phase
    if kind == 'walk':
        return dict(pitch=0, roll=1.2 * sind(p), neck=3 * cosd(2 * (p - .30)), head=-1.5 * cosd(2 * (p - .30)), tail=3, tail_y=6 * sind(p - .15), comp=0)
    if kind == 'trot':
        return dict(pitch=.8 * cosd(2 * (p - .10)), roll=0, neck=2 + 2 * cosd(2 * (p - .15)), head=-1, tail=8 + 3 * cosd(2 * (p - .30)),
                    tail_y=3 * sind(p), comp=-.012 * (.5 + .5 * cosd(2 * (p - .21))))
    if kind == 'gallop':
        return dict(pitch=-3.5 * cosd(p - .10), roll=0, neck=4 + 6 * cosd(p - .55), head=-2 - 3 * cosd(p - .55), tail=16 + 7 * cosd(p - .75),
                    tail_y=4 * sind(p), comp=0)
    return dict(pitch=-4 * cosd(p - .10), roll=0, neck=10 + 6 * cosd(p - .55), head=-5 - 3 * cosd(p - .55), tail=24 + 7 * cosd(p - .75),
                tail_y=4 * sind(p), comp=-.006)


def gait_bob(horse, kind):
    """The body's height over one cycle at T * 24 samples: as high as the planted legs reach (the pendulum),
    a ballistic arc over the suspension, plus the gait's compression."""
    g = GAITS[kind]
    N = g['T'] * 24
    need = []
    for i in range(N):
        ph = i / N
        sh = gait_shape(kind, ph)
        Rx = Matrix.Rotation(math.radians(sh['pitch']), 3, 'X')
        best = None
        for key, leg in horse.legs.items():
            p = (ph - g['ph'][key]) % 1
            if p >= g['d']:
                continue
            dy, _ = hoof_at(g, key, ph)
            top = horse.pivot + Rx @ (leg['top'] - horse.pivot)
            tgt = leg['hoof'] + V((0, dy, 0))
            hor = (tgt - top).to_2d().length
            R = .994 * sum(leg['l'])
            z = tgt.z + math.sqrt(max(0, R * R - hor * hor)) - top.z
            best = z if best is None else min(best, z)
        need.append(best)
    if all(n is None for n in need):
        return [0.] * N
    out = list(need)
    i = 0
    while i < N:
        if need[i] is not None:
            i += 1
            continue
        j = i
        while need[j % N] is None:
            j += 1
        a, b = need[(i - 1) % N], need[j % N]
        n = j - i + 1
        for k in range(i, j):
            t = (k - i + 1) / n
            out[k % N] = a + (b - a) * t + g['hop'] * 4 * t * (1 - t)
        i = j
    return [out[k] + gait_shape(kind, k / N)['comp'] for k in range(N)]


def horse_gait(horse, kind, frames, extra=None):
    """A horse spec function for a gait clip of `frames` frames (whole cycles: the last frame repeats the first)."""
    g = GAITS[kind]
    bob = gait_bob(horse, kind)
    N = len(bob)

    def fn(f):
        ph = ((f - 1) % g['T']) / g['T']
        s = gait_shape(kind, ph)
        s['bob'] = bob[round(ph * N) % N]
        s['hooves'] = {k: hoof_at(g, k, ph) for k in LEGS}
        s['phase'] = ph
        if extra:
            s.update(extra(f, ph))
        return s
    return fn


def horse_keys(kind, sign=-1):
    """Keyed horse clips: Idle, Attack (standing, shifting), Hit, Cheer, Death (sign -1: onto its right side)."""
    S0 = {}
    if kind == 'Idle':
        mid = {'neck': 6, 'head': 2, 'tail_y': -6, 'roll': .6, 'bob': -.002}
        return [(1, S0), (12, {'neck': 3, 'tail_y': 8, 'bob': -.001}), (21, mid), (32, {'neck': 2, 'head': -1, 'tail_y': 4}), (41, S0)]
    if kind == 'Attack':
        a = {'neck': -6, 'head': 3, 'pitch': -1.2, 'yaw': 2, 'tail': 6, 'hooves': {'FR': (-.03, .02)}}
        b = {'neck': -2, 'head': 1, 'pitch': .6, 'yaw': -1, 'tail': 3, 'bob': -.006, 'ease': 'in'}
        return [(1, S0), (7, a), (11, b), (12, b), (16, {'neck': -3, 'tail': 4, 'yaw': 1}), (21, S0)]
    if kind == 'Hit':
        a = {'neck': -16, 'head': 8, 'pitch': -3, 'tail': 14, 'tail_y': 8, 'bob': -.004, 'hooves': {'FL': (-.02, .07)}, 'ease': 'out'}
        return [(1, S0), (4, a), (6, dict(a, neck=-12, hooves={'FL': (-.03, .05)})), (10, S0)]
    if kind == 'Cheer':
        a = {'neck': -8, 'head': 4, 'tail': 6, 'pitch': -.8}
        b = {'neck': 3, 'head': -1, 'tail': 2}
        return [(1, b), (9, a), (17, b), (25, a), (33, b)]
    s = sign
    if kind == 'Collapse':  # a chariot horse in the Wreck: it goes down on its chest, the legs folded under it
        return [(1, S0),
                (5, {'neck': -16, 'head': 8, 'pitch': -4, 'tail': 12, 'ease': 'out'}),
                (12, {'neck': 6, 'head': 4, 'pitch': 12, 'bob': -.16, 'tail': 4, 'roll': 3 * s}),
                (20, {'neck': 18, 'head': 10, 'pitch': 5, 'bob': -.34, 'roll': 8 * s, 'tail': -6, 'ease': 'in'}),
                (26, {'neck': 34, 'head': 20, 'pitch': 1, 'bob': -.40, 'roll': 13 * s, 'tail': -12, 'ease': 'in'}),
                (30, {'neck': 30, 'head': 18, 'pitch': 2, 'bob': -.39, 'roll': 11 * s, 'tail': -10, 'ease': 'out'}),
                (40, {'neck': 36, 'head': 22, 'pitch': 1, 'bob': -.40, 'roll': 12 * s, 'tail': -14})]
    if kind == 'Death':
        k = [(1, S0),
             (5, {'neck': -14, 'head': 6, 'pitch': -3, 'tail': 10, 'ease': 'out'}),
             (12, {'neck': 8, 'head': 4, 'pitch': 10, 'bob': -.13, 'tail': 4, 'roll': 4 * s}),
             (20, {'neck': 16, 'head': 6, 'pitch': 6, 'bob': -.27, 'roll': 34 * s, 'lw': .35, 'tail': -4, 'ease': 'in'}),
             (28, {'neck': 30, 'head': 16, 'pitch': 0, 'bob': -.48, 'roll': 88 * s, 'lw': 1, 'tail': -12, 'ground': 1, 'ease': 'in'}),
             (32, {'neck': 26, 'head': 14, 'pitch': 0, 'bob': -.46, 'roll': 84 * s, 'lw': 1, 'tail': -10, 'ground': 1, 'ease': 'out'}),
             (37, {'neck': 32, 'head': 18, 'pitch': 0, 'bob': -.48, 'roll': 87 * s, 'lw': 1, 'tail': -14, 'ground': 1}),
             (40, {'neck': 32, 'head': 18, 'pitch': 0, 'bob': -.48, 'roll': 87 * s, 'lw': 1, 'tail': -14, 'ground': 1})]
    else:  # DeathAlt: the hindquarters give first, it sits back and rolls
        k = [(1, S0),
             (5, {'neck': -20, 'head': 8, 'pitch': -6, 'tail': 14, 'ease': 'out'}),
             (12, {'neck': -8, 'head': 6, 'pitch': -13, 'bob': -.12, 'tail': 2, 'roll': 3 * s}),
             (20, {'neck': 6, 'head': 6, 'pitch': -6, 'bob': -.27, 'roll': 30 * s, 'lw': .35, 'tail': -6, 'ease': 'in'}),
             (28, {'neck': 28, 'head': 14, 'pitch': 0, 'bob': -.48, 'roll': 88 * s, 'lw': 1, 'tail': -12, 'ground': 1, 'ease': 'in'}),
             (32, {'neck': 24, 'head': 12, 'pitch': 0, 'bob': -.46, 'roll': 84 * s, 'lw': 1, 'tail': -10, 'ground': 1, 'ease': 'out'}),
             (37, {'neck': 30, 'head': 16, 'pitch': 0, 'bob': -.48, 'roll': 87 * s, 'lw': 1, 'tail': -14, 'ground': 1}),
             (40, {'neck': 30, 'head': 16, 'pitch': 0, 'bob': -.48, 'roll': 87 * s, 'lw': 1, 'tail': -14, 'ground': 1})]
    # the legs of a horse lying on its side: the top pair a little forward and bent, the lower pair back
    lb = {'FL': (0, -.06, .10), 'FR': (0, -.10, .05), 'HL': (0, .08, .10), 'HR': (0, .12, .05)}
    return [(f, dict(sp, lb=lb)) for f, sp in k]


# ---- people on the rigs ----------------------------------------------------------------------------------

def temp_fingers(arm, prefix, axes):
    """For a fist without its Fingers tube (a LITE figure, a pointing hand): a temporary two-point object
    where ti_clips.rest_grip reads the grip and the knuckle axis (armature space: call with the rig at the
    origin). Returns {side: object name} and the objects to remove."""
    names, made = {}, []
    for s in 'LR':
        name = prefix + 'Fingers_' + s
        if name in bpy.data.objects:
            names[s] = name
            continue
        hand = bpy.data.objects.get(prefix + 'BodyHand_' + s)
        B = arm.data.bones
        if hand is not None:
            vs = [hand.matrix_world @ v.co for v in hand.data.vertices]
            sides = (len(vs) - 2) // 3
            g = sum(vs[sides:2 * sides], V()) / sides
        else:
            g = B['Hand_' + s].head_local.copy()
        if hand is not None and len(vs) - 2 != 3 * ((len(vs) - 2) // 3):
            g = B['Hand_' + s].head_local.copy()
        el, wr = B['Forearm_' + s].head_local, B['Hand_' + s].head_local
        if (axes or {}).get(s) == 'point':  # a pointing hand: the grip a little past the wrist, the axis along the finger
            g = wr + (wr - el).normalized() * .034
            ax = (wr - el).normalized()
        else:
            ax = V((axes or {}).get(s, (0, 0, 1) if s == 'R' else (0, 1, 0))).normalized()
        c = g - V((0, .004, 0))
        me = bpy.data.meshes.new('_grip' + s)
        me.from_pydata([tuple(c - ax * .02), tuple(c + ax * .02)], [], [])
        ob = bpy.data.objects.new('_grip_' + prefix + s, me)
        bpy.context.scene.collection.objects.link(ob)
        names[s] = ob.name
        made.append(ob)
    upd()
    return names, made


class Person:
    """One person's rig posed with the foot soldiers' poser and author (FC.FootPoser, FC.FootAuthor),
    optionally carried by a carrier (a horse's back, a car's floor): after the pose its Root is moved by the
    carrier's motion, `follow` of the way (1 in the saddle; less while thrown off in the falls)."""

    def __init__(self, arm, kit, axes=None, stirrups=False, weapon=True):
        self.arm, self.kit, self.stirrups = arm, kit, stirrups
        self.prefix = arm.name[:-3] if arm.name.endswith('Rig') else arm.name
        # (every mesh on the rig: the ti_figure parts, or the older builders' ti_units meshes)
        self.meshes = [m for m in F.meshes if m.parent == arm] or [m for m in bpy.data.objects if m.type == 'MESH' and m.parent == arm]
        loc, rot = arm.location.copy(), arm.rotation_euler.copy()
        arm.location, arm.rotation_euler = (0, 0, 0), (0, 0, 0)
        upd()
        fingers, made = temp_fingers(arm, self.prefix, axes)
        kit.fingers = fingers
        try:
            if kit.arrow:
                FC.add_arrow_bone(arm, kit, self.meshes)
            if weapon:
                self.P = FC.FootPoser(arm, kit, self.meshes)
            else:
                self.P = bare_poser(arm, kit, self.meshes)
        finally:
            for ob in made:
                bpy.data.objects.remove(ob, do_unlink=True)
            arm.location, arm.rotation_euler = loc, rot
            upd()
        self.A = FC.FootAuthor(arm, self.P, self.meshes, kit)
        self.weapon = weapon
        B = arm.data.bones
        self.legrest = {}
        for s in 'LR':  # the knee's side of the hip-ankle line at rest: the legs' pole in the stirrups
            S, E, W = B['Leg_' + s].head_local, B['Shin_' + s].head_local, B['Foot_' + s].head_local
            dn = nrm(W - S)
            self.legrest[s] = (W.copy(), nrm((E - S) - dn * (E - S).dot(dn)))

    def begin(self, clip):
        self.A.first_sign(clip)

    def pose(self, clip, spec, frame, carrier=None):
        """Pose the person (in their own rig's space), then carry it: `carrier` is the carrier's motion in this
        rig's armature space (or None)."""
        g = clip.ground
        clip.ground = None
        self.A.pose(clip, spec, frame)
        clip.ground = g
        follow = float(spec.get('follow', 1))
        rest = clip.name == 'Idle' and frame in (1, clip.frames)
        if carrier is not None and not rest:
            Dw = blend(carrier, follow)
            rp = self.arm.pose.bones['Root']
            rp.matrix = Dw @ rp.matrix
            upd()
            if self.stirrups and follow > .99 and not spec.get('free_legs'):
                for s in 'LR':
                    W, pole = self.legrest[s]
                    self.P.two_bone('Leg_' + s, 'Shin_' + s, self.P.len['leg' + s], carrier @ W, carrier.to_3x3() @ pole)
                    self.P.orient('Foot_' + s, carrier.to_3x3() @ self.P.rest['Foot_' + s].to_3x3())
        if g and float(spec.get('ground', 0)) > .5:
            self.A.to_ground(g)

    def grip_world(self, side):
        return self.arm.matrix_world @ self.P.grip_now(side)


def bare_poser(arm, kit, meshes):
    """A FootPoser for a person holding nothing in the right hand (a general pointing): the stations are the
    fist's own."""
    P = C.Poser(arm, {}, C.tool_frame(C.rest_grip(kit.side, kit.fingers[kit.side])[1]), kit.fingers)
    P.__class__ = FC.FootPoser
    P.kit = kit
    B = arm.data.bones
    P.hf = {s: C.tool_frame(P.grip[s][1]) for s in 'LR'}
    P.rpole = {}
    for s in 'LR':
        S, E, W = B['Arm_' + s].head_local, B['Forearm_' + s].head_local, B['Hand_' + s].head_local
        dn = nrm(W - S)
        P.rpole[s] = tuple(nrm((E - S) - dn * (E - S).dot(dn)))
    P.G0 = P.grip[kit.side][0].copy()
    P.a0, P.f0 = P.hf[kit.side]
    P.h0, P.length = 0., .1
    P.s_other = (P.grip[kit.other][0] - P.G0).dot(P.a0)
    P.sign = {s: (1 if P.grip[s][1].dot(P.a0) >= 0 else -1) for s in 'LR'}
    return P


class RiderLib(FC.Lib):
    """Key specs for a rider (no planted feet; the weapon in the right fist: kind 'lance', 'sword', 'mace',
    'torch' or 'hand' for an empty pointing hand)."""

    def __init__(self, P, kit, kind):
        super().__init__(P, kit)
        self.kind = kind

    def rest(self, **extra):
        spec = super().rest(**extra)
        spec['plant'] = 0
        if self.kind == 'hand':  # an empty hand: its targets ride on the chest (the arm keeps its reach as he leans)
            spec.pop('W', None)
            spec[self.side] = self.free(self.side)
            spec['space'] = 'chest'
        return spec

    def arm_to(self, direction, reach=.255):
        """A point the right hand reaches: out from the shoulder along `direction` (an arm of the figure's length)."""
        return tuple(V(self.P.rest['Arm_R'].translation) + nrm(direction) * reach)

    def hand_at(self, p, d, f=(0, -1, 0)):
        """The right fist (or the pointing hand) at p, its knuckle axis (the weapon's axis) along d."""
        if self.kind == 'hand':
            return {}, {'R': self.free('R', p=p, d=d, f=f, pole=(-1, .2, -.6))}
        dd, ff = d if isinstance(d, tuple) and len(d) == 2 and isinstance(d[0], tuple) else (d, f)
        return {'W': self.W(p, dd, ff)}, {'R': self.on('R', pole=(-1, .2, -.6))}

    def key(self, r=None, root=(0, 0, 0), at=None, hands=None, ease=None, **extra):
        spec = self.rest()
        spec['r'] = dict(r or {})
        spec['root'] = tuple(root)
        if at:
            w, h = self.hand_at(*at)
            spec.update(w)
            spec.update(h)
        for s, H in (hands or {}).items():
            spec[s] = H
        if ease:
            spec['ease'] = ease
        spec.update(extra)
        return spec


def seat_torso(kind, ph, horse_shape):
    """The rider sitting the gait: torso rotations and the seat's rise (rising in the trot, sitting the gallop)."""
    pitch = horse_shape.get('pitch', 0)
    if kind == 'walk':
        return {'Hips': (1.5 * cosd(2 * ph), 0, 1.2 * sind(ph)), 'Spine': (2, 0, -.8 * sind(ph)), 'Head': (-1, 0, 0)}, 0.
    if kind == 'trot':
        t = ((ph - .02) % 1) / .48
        rise = .032 * math.sin(math.pi * t) ** 1.2 if t < 1 else 0.
        return {'Hips': (3 + 30 * rise, 0, 0), 'Spine': (4, 0, 0), 'Chest': (1, 0, 0), 'Head': (-4 - 30 * rise, 0, 0)}, rise
    lean = 8 if kind == 'gallop' else 15
    return {'Hips': (lean * .4 - .5 * pitch, 0, 0), 'Spine': (lean * .6 - .3 * pitch, 0, 0), 'Chest': (lean * .3, 0, 0), 'Head': (-lean * .9 + .6 * pitch, 0, 0)}, 0.


def rider_clips(L, acts, horse_specs, sides=(-1, 1)):
    """The rider's clips for the unit's acts (each a ti_clips.Clip of the act's frames). `sides`: the side the
    horse rolls to in Death and DeathAlt (-1 its right, -X; 1 its left)."""
    k = L.kind
    r0 = L.rest()
    out = {}
    for act in acts:
        frames, loop, events = ACTS[act]
        if act == 'Idle':
            keys = [(1, r0), (21, L.key({'Chest': (0, 0, -2), 'Head': (-2, 0, 6), 'Spine': (.6, 0, 0)})), (41, r0)]
            out[act] = Clip(act, frames, loop, None, keys=keys)
        elif act in ('Walk', 'Trot', 'Gallop'):
            kind = GAITS_OF[act]
            out[act] = Clip(act, frames, loop, None, fn=rider_gait(L, kind, horse_specs[act]))
        elif act == 'Charge':
            out[act] = Clip(act, frames, loop, None, fn=rider_charge(L, horse_specs[act]), events=events)
        elif act == 'Attack':
            out[act] = Clip(act, frames, loop, None, keys=rider_attack(L), events=events)
        elif act == 'Hit':
            a = L.key({'Spine': (-6, 0, -4), 'Chest': (-13, 0, -8), 'Head': (-12, 0, 6), 'Hips': (-2, 0, 0)}, (0, 0, .012), ease='out')
            out[act] = Clip(act, frames, loop, None, keys=[(1, r0), (4, a), (6, dict(a, root=(0, 0, .006))), (10, r0)])
        elif act == 'Cheer':
            out[act] = Clip(act, frames, loop, None, keys=rider_cheer(L))
        elif act in ('Death', 'DeathAlt'):
            out[act] = Clip(act, frames, loop, None, keys=rider_death(L, act, sides[act == 'DeathAlt']), ground='all', events=events)
    return out


GAITS_OF = {'Walk': 'walk', 'Trot': 'trot', 'Gallop': 'gallop', 'Charge': 'charge', 'Move': 'gallop'}


def rider_gait(L, kind, hspec):
    def fn(f):
        hs = hspec(f)
        r, rise = seat_torso(kind, hs['phase'], hs)
        return L.key(r, (0, 0, rise))
    return fn


def weapon_keys(L, act):
    """(frame, (hand placement), torso) keys of the weapon in Charge and Attack, by the weapon's kind."""
    k = L.kind
    P = L.P
    lean = {'Spine': (12, 0, 4), 'Chest': (5, 0, 4), 'Head': (-14, 0, -4)}
    if act == 'Charge':
        if k == 'lance':
            low = (-.20, -.15, .72), FC.pitch(45)
            couch = (-.15, -.12, .65), FC.pitch(93)
            push = (-.14, -.30, .65), FC.pitch(95)
            rise = (-.20, -.17, .72), FC.pitch(55)
            return [(8, low, lean), (15, couch, dict(lean, Spine=(14, 0, 8))), (21, couch, dict(lean, Spine=(16, 0, 8))), (23, push, dict(lean, Spine=(20, 0, 12), Chest=(8, 0, 6))),
                    (24, push, dict(lean, Spine=(20, 0, 12), Chest=(8, 0, 6))), (31, rise, lean)]
        if k in ('sword', 'mace'):
            point = (-.22, -.30, .86), FC.pitch(70)
            thrust = (-.22, -.44, .83), FC.pitch(80)
            if k == 'mace':
                point = (-.20, .02, 1.02), FC.pitch(-40)
                thrust = (-.30, -.30, .66), FC.pitch(140, 20)
            return [(10, point, lean), (21, point, dict(lean, Spine=(16, 0, 8))), (23, thrust, dict(lean, Spine=(20, 0, 14), Chest=(8, 0, 8))),
                    (24, thrust, dict(lean, Spine=(20, 0, 14), Chest=(8, 0, 8))), (31, point, lean)]
        if k == 'torch':
            up = (-.24, -.10, 1.02), FC.pitch(-6)
            down = (-.34, -.24, .54), FC.pitch(150)
            return [(10, up, lean), (19, up, lean), (23, down, dict(lean, Spine=(18, 0, 16), Chest=(8, 0, 10))), (24, down, dict(lean, Spine=(18, 0, 16), Chest=(8, 0, 10))),
                    (31, up, lean)]
        up = L.arm_to((-.25, -.55, .8)), (-.25, -.55, .8)
        fwd = L.arm_to((-.15, -1, .1)), (-.15, -1, .1)
        return [(10, up, lean), (21, up, lean), (23, fwd, dict(lean, Spine=(18, 0, 8))), (24, fwd, dict(lean, Spine=(18, 0, 8))), (31, up, lean)]
    # Attack: from the rest pose, struck down at the right front, back to rest
    tw = {'Spine': (-2, 0, -8), 'Chest': (-4, 0, -12), 'Head': (2, 0, 10)}
    st = {'Hips': (2, 0, 6), 'Spine': (12, 0, 12), 'Chest': (8, 0, 14), 'Head': (-10, 0, -12)}
    if k == 'lance':
        wind = (-.20, .06, .98), FC.pitch(112)
        stab = (-.27, -.30, .80), FC.pitch(124)
        return [(6, wind, tw), (11, stab, st), (12, stab, st), (16, wind, tw)]
    if k in ('sword', 'mace'):
        wind = (-.20, .04, 1.00), FC.pitch(-50, -10)
        cut = (-.30, -.28, .66), FC.pitch(130, 25)
        follow = (-.24, -.18, .56), FC.pitch(152, 35)
        return [(7, wind, tw), (11, cut, st), (12, cut, st), (15, follow, st)]
    if k == 'torch':
        wind = (-.22, -.02, 1.05), FC.pitch(-10)
        down = (-.34, -.22, .52), FC.pitch(158)
        return [(7, wind, tw), (11, down, dict(st, Spine=(16, 0, 14))), (12, down, dict(st, Spine=(16, 0, 14))), (16, wind, tw)]
    up = L.arm_to((-.2, .05, 1)), (-.2, .05, 1)
    fwd = L.arm_to((-.35, -1, -.35)), (-.35, -1, -.35)
    return [(7, up, tw), (11, fwd, st), (12, fwd, st), (16, up, tw)]


def rider_attack(L):
    r0 = L.rest()
    keys = [(1, r0)]
    for f, at, r in weapon_keys(L, 'Attack'):
        keys.append((f, L.key(r, at=at, ease='in' if f == 11 else None)))
    keys.append((21, dict(r0, ease='io')))
    return keys


def rider_charge(L, hspec):
    r0 = L.rest()
    wk = [(1, r0)] + [(f, L.key(r, at=at)) for f, at, r in weapon_keys(L, 'Charge')] + [(38, r0), (41, r0)]

    contact = ACTS['Charge'][2]['contact']

    def fn(f):
        hs = hspec(contact if f == contact + 1 else f)  # the body held through the strike (the horse gallops on)
        r, _ = seat_torso('charge', hs['phase'], hs)
        w = spec_at(wk, f)
        lean = w.get('r') or {}
        # the gait's torso under the weapon's: the strike's own lean wins where it has one
        merged = dict(r)
        for b, ang in lean.items():
            merged[b] = ang
        w = dict(w)
        w['r'] = merged
        w['root'] = (0, 0, 0)
        return w
    return fn


def rider_cheer(L):
    r0 = L.rest()
    if L.kind == 'hand':
        hi = L.key({'Spine': (-3, 0, 0), 'Chest': (-5, 0, 0), 'Head': (-10, 0, 0)}, at=(L.arm_to((-.15, -.2, 1)), (-.15, -.2, 1)))
        lo = L.key({'Spine': (-1, 0, 0), 'Chest': (-1, 0, 0), 'Head': (-4, 0, 0)}, at=(L.arm_to((-.3, -.7, .6)), (-.3, -.7, .6)))
    else:
        hi = L.key({'Spine': (-3, 0, 0), 'Chest': (-5, 0, 0), 'Head': (-10, 0, 0)}, at=((-.20, -.06, 1.10), FC.pitch(-8)))
        lo = L.key({'Spine': (-1, 0, 0), 'Chest': (-1, 0, 0), 'Head': (-4, 0, 0)}, at=((-.22, -.10, .96), FC.pitch(4)))
    return [(1, lo), (9, hi), (17, lo), (25, hi), (33, lo)]


THROWN = 12  # the falls: the frame the rider leaves the saddle (the horse has dropped on its knees or haunches)


def rider_death(L, act, s):
    """Struck, the rider rides the stumble to THROWN, then goes over the side the horse's back rolls to (`s`:
    -1 its right, 1 its left) and lands clear of the legs, lying along the horse: on his back (Death) or face
    down (DeathAlt); still from the settle frame on. Keys from THROWN on are relative to the saddle at that
    frame."""
    r0 = L.rest()
    gl = V(L.P.grip['L'][0])
    struck = L.key({'Spine': (-8, 0, 4), 'Chest': (-15, 0, 8), 'Head': (-14, 0, 0), 'Arm_L': (-10, 0, -8)}, (0, 0, .01), ease='out')
    struck['L'] = L.free('L', p=gl + V((.06, .04, .10)))
    legs = {'Leg_L': (50, 22, 0), 'Leg_R': (46, -18, 0), 'Shin_L': (-55, 0, 0), 'Shin_R': (-48, 0, 0)}
    # on his back (Death) or face down (DeathAlt), lying along the horse, the head to the front
    lying = (-90, -180, 0) if act == 'Death' else (90, 0, 0)
    tilt = (40, 72) if act == 'Death' else (26, 34)
    hold = L.key({'Spine': (8, 0, 0), 'Chest': (6, 0, 4), 'Head': (-10, 0, 0)}, (0, 0, -.01))
    hold['L'] = L.free('L', p=gl + V((.02, -.04, .04)))
    off = L.key({'Root': (0, tilt[0] * s, 0), 'Spine': (-10, 0, 0), 'Chest': (-8, 0, 0), 'Head': (-8, 0, 0)}, (.14 * s, .06, -.08), rein=.4, free_legs=1)
    off['L'] = L.free('L', p=gl + V((.10, .06, .18)))
    fall = L.key(dict({'Root': (lying[0] * .5, tilt[1] * s if act == 'Death' else tilt[1] * s * .6, 0), 'Spine': (-6, 0, 0)}, **{b: (a[0] * .6, a[1] * .6, 0) for b, a in legs.items()}), (.32 * s, .22, -.20),
                 rein=0, free_legs=1, ease='in')
    fall['L'] = L.free('L', p=gl + V((.14, .10, .22)))
    down = L.key(dict({'Root': lying, 'Spine': (4, 0, 0), 'Head': (-10 if act == 'Death' else 6, 0, 0)}, **legs), (.40 * s, .42, -.30), rein=0, free_legs=1,
                 ground=1, ease='in', flat=1)
    down['L'] = L.free('L', p=gl + V((.18, .14, .30)))
    bounce = dict(down, r=dict(down['r'], Root=(lying[0] * .94, lying[1] * .94, 0)), ease='out')
    still = dict(down, r=dict(down['r'], Head=(-14 if act == 'Death' else 10, 0, 12)))
    keys = [(1, r0), (6, struck), (THROWN, hold), (17, off), (23, fall), (29, down), (33, bounce), (37, still), (40, still)]
    # the hands' and the weapon's targets ride on the chest (the body leaves the saddle)
    return [(f, dict(s, space='chest')) for f, s in keys]


# ---- the bearer on foot (a general's standard) ------------------------------------------------------------

class BearerLib(FC.Lib):
    def arms_swing(self):
        return (0, 0) if self.kit.two_hands else (0, 5)


def bearer_clips(L, acts):
    """The standard bearer's clips for the general's acts: he stands in Idle and Attack, walks in Walk, runs
    in Trot, Gallop and Charge (cadence matched to the horse: 14, 12 and 10 frames a stride), waves the
    banner in Cheer, flinches in Hit and falls in Death and DeathAlt."""
    out = {}
    for act in acts:
        frames, loop, events = ACTS[act]
        if act == 'Idle':
            out[act] = L.idle()
        elif act == 'Walk':
            out[act] = L.gait('Walk', 20, 19, 42, 2)
        elif act in ('Trot', 'Gallop', 'Charge'):
            period = {'Trot': 14, 'Gallop': 12, 'Charge': 10}[act]
            c = L.gait(act, period, 28 if period > 10 else 26, 70, 7, arms=1.6, run=True)
            out[act] = Clip(act, frames, loop, c.tool, fn=c.fn, ground=c.ground, events=events)
        elif act == 'Attack':
            out[act] = retime(L.idle(), frames, 'Attack', loop=False, events={})
            out[act].keys = [(1, {}), (8, {'r': {'Chest': (0, 0, -3), 'Head': (-3, 0, 8)}}), (15, {'r': {'Chest': (0, 0, -2), 'Head': (-2, 0, 6)}}), (21, {})]
        elif act == 'Hit':
            out[act] = retime(L.hit(), frames, 'Hit')
        elif act in ('Death', 'DeathAlt'):
            # he staggers a step out to his left (+X, away from the horse falling to the other side) and falls
            c = retime(L.death(act, 1 if act == 'Death' else -1), frames, act, events=events)
            keys = []
            for f, s in c.keys:
                z = V(s.get('root', (0, 0, 0))).z
                keys.append((f, dict(s, root=(.24 * min(1, max(0, (f - 3) / 14)) ** .8, 0, z))))
            c.keys = keys
            out[act] = c
        elif act == 'Cheer':
            out[act] = bearer_wave(L)
    return out


def retime(clip, frames, name=None, loop=None, events=None):
    keys = None
    if clip.keys:
        n = clip.frames
        keys = []
        for f, s in clip.keys:
            g = 1 + round((f - 1) * (frames - 1) / (n - 1))
            if keys and g <= keys[-1][0]:
                g = keys[-1][0] + 1
            keys.append((min(g, frames), s))
    return Clip(name or clip.name, frames, clip.loop if loop is None else loop, clip.tool, keys=keys, fn=clip.fn, ground=clip.ground,
                events=clip.events if events is None else events)


def bearer_wave(L):
    """Cheer: the banner raised a hand higher and waved out to his left (+X, away from the horse) and back
    upright, twice (a loop); the free left fist punches up (both fists on the pole when he carries it so)."""
    P = L.P
    G = V(P.G0)
    gl = V(P.grip['L'][0])

    def tilt(deg, up, fist):
        a = math.radians(deg)
        d = (math.sin(a), -.08, math.cos(a))
        if L.kit.two_hands:
            left = L.on('L', P.s_other, pole=(1, .3, -.6))
        else:
            left = L.free('L', p=gl + V((-.02, -.06, .10 + .14 * fist)), d=(0, 0, 1), f=(0, -1, 0), pole=(1, .3, -.6))
        hands = {'R': L.on('R', P.h0, pole=(-1, .3, -.6)), 'L': left}
        return L.key({'Spine': (-2, 0, -deg * .12), 'Chest': (-3, 0, -deg * .15), 'Head': (-8, 0, 0)}, (0, 0, .004), W=L.W(G + V((0, -.02, up)), d, (0, -1, 0)),
                     hands=hands)
    keys = [(1, tilt(2, .10, 0)), (6, tilt(24, .12, 1)), (13, tilt(-3, .11, .4)), (17, tilt(2, .10, 0)), (22, tilt(24, .12, 1)), (29, tilt(-3, .11, .4)),
            (33, tilt(2, .10, 0))]
    return Clip('Cheer', 33, True, None, keys=keys)


# ---- the unit author: every rig, every act, every frame ---------------------------------------------------

class Unit:
    """The rigs of one unit file and how each is posed per act: horses (Horse), cars (posed by a function),
    people (Person, carried by a horse or a car or standing on the ground). `acts`: the clip names in order."""

    def __init__(self, archetype, acts=None, table=None):
        self.archetype = archetype
        self.acts = list(acts or SETS[archetype])
        self.ACTS = table or ACTS  # name: (frames, loop, events)
        self.rigs = []    # (armature, poser function (act, frame) -> None), in posing order
        self.skips = {}   # armature name: ({bones never keyed}, {bones keyed in location only})
        self.events = {}
        self.loops = {}

    def add(self, arm, fn, begin=None, skip=(), loc_only=()):
        self.rigs.append((arm, fn, begin))
        self.skips[arm.name] = (set(skip), set(loc_only))

    def run(self):
        ACTS = self.ACTS
        store = {a.name: {} for a, _, _ in self.rigs}
        for act in self.acts:
            frames, loop, events = ACTS[act]
            for arm, _, begin in self.rigs:
                if begin:
                    begin(act)
            for f in range(1, frames + 1):
                for arm, fn, _ in self.rigs:
                    fn(act, f)
                for arm, _, _ in self.rigs:
                    store[arm.name].setdefault(act, []).append(snapshot(arm))
        for arm, _, _ in self.rigs:
            reset(arm)
        upd()
        first = self.rigs[0][0]
        for arm, _, _ in self.rigs:
            for act in self.acts:
                write(arm, act, store[arm.name][act], ACTS[act][1], primary=(arm == first), skip=self.skips[arm.name][0],
                      loc_only=self.skips[arm.name][1])
        table = {}
        for act in self.acts:
            frames, loop, events = ACTS[act]
            e = {'frames': frames, 'fps': FPS, 'loop': loop}
            if events:
                e['events'] = dict(events)
            table[act] = e
        return table


def write(arm, act, frames, loop, primary=False, skip=(), loc_only=()):
    """One action of `arm` for the clip `act` (every bone's rotation and location keyed on every frame, the
    Tool_* bones' scale too) on a muted NLA track named `act`. `skip`: bones left unkeyed (a turret the game
    aims); `loc_only`: bones keyed in location only (a barrel's recoil, its aim left to the game)."""
    arm.animation_data_create()
    action = bpy.data.actions.new(act if primary else f'{act}.{arm.name}')
    arm.animation_data.action = action
    last = {}
    scaled = {b.name for b in arm.data.bones if b.name.startswith('Tool_')}
    for f, pose in enumerate(frames, 1):
        for name, (q, loc, sc) in pose.items():
            if name in skip:
                continue
            pb = arm.pose.bones[name]
            if name in last and last[name].dot(q) < 0:
                q = -q
            last[name] = q
            pb.location = loc
            if name not in loc_only:
                pb.rotation_quaternion = q
                pb.keyframe_insert('rotation_quaternion', frame=f)
            pb.keyframe_insert('location', frame=f)
            if name in scaled:
                pb.scale = sc
                pb.keyframe_insert('scale', frame=f)
    action.use_frame_range = True
    action.frame_start = 1
    action.frame_end = len(frames)
    action['loop'] = loop
    track = arm.animation_data.nla_tracks.new()
    track.name = act
    track.strips.new(action.name, 1, action)
    track.mute = True
    arm.animation_data.action = None
    reset(arm)


def set_clip(act, frame=None):
    """Every rig of the scene on its action for `act` (sheets, checks)."""
    for ob in bpy.context.scene.objects:
        if ob.type == 'ARMATURE' and ob.animation_data:
            tr = ob.animation_data.nla_tracks.get(act)
            ob.animation_data.action = tr.strips[0].action if tr else None
    if frame is not None:
        bpy.context.scene.frame_set(frame)


# ---- the reins' bone ---------------------------------------------------------------------------------------

def add_rein_bone(horse, names=('Rein-1', 'Rein1')):
    """Mount_Rein, a child of Mount_Neck at the reins' hand end; the hand end's vertices move to it from
    Mount_Neck (the same place and the same limb in the battle's bake). Returns the rest hand point."""
    obs = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
    if not obs:
        return None
    pts = []
    for ob in obs:
        g = ob.vertex_groups.get('Mount_Neck')
        if not g:
            continue
        ws = [(v.index, ob.matrix_world @ v.co) for v in ob.data.vertices if any(x.group == g.index and x.weight > .5 for x in v.groups)]
        far = max(p.y for _, p in ws)
        pts += [(ob, i, p) for i, p in ws if p.y > far - .02]
    hand = sum((p for _, _, p in pts), V()) / len(pts)
    local = horse.matrix_world.inverted() @ hand
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = horse
    horse.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    b = horse.data.edit_bones.new('Mount_Rein')
    b.head, b.tail, b.roll = local, local + V((0, 0, .05)), 0
    b.parent = horse.data.edit_bones['Mount_Neck']
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in horse.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    bpy.ops.object.select_all(action='DESELECT')
    for ob, i, _ in pts:
        ob.vertex_groups['Mount_Neck'].remove([i])
        g = ob.vertex_groups.get('Mount_Rein') or ob.vertex_groups.new(name='Mount_Rein')
        g.add([i], 1.0, 'REPLACE')
    return hand


# ---- a mounted unit: horse and rider (and a standard bearer for a general) ----------------------------------

def mounted(horse_arm, rider_arm, kind, archetype='mounted', stirrups=False, bearer=None, bearer_kit=None, bearer_axes=None, sides=None):
    """Author a horse and its rider (`kind`: the rider's weapon) and, for a general, the standard bearer on foot
    (`bearer`: his rig; `bearer_kit`: FC.Kit of his standard). `sides`: where the horse rolls in Death and
    DeathAlt (-1 its right, 1 its left; a general's horse falls away from the bearer at its left both times).
    Returns the clip table."""
    sides = sides or ((-1, -1) if bearer is not None else (-1, 1))
    rein = add_rein_bone(horse_arm)
    horse = Horse(horse_arm, [m for m in F.meshes if m.parent == horse_arm])
    kit = FC.Kit('spear' if kind == 'lance' else 'sword', side='R')
    rider = Person(rider_arm, kit, axes={'R': 'point'} if kind == 'hand' else None, stirrups=stirrups, weapon=kind != 'hand')
    L = RiderLib(rider.P, kit, kind)
    unit = Unit(archetype)
    acts = unit.acts
    hspec = {}
    for act in acts:
        if act in GAITS_OF:
            hspec[act] = horse_gait(horse, GAITS_OF[act], ACTS[act][0])
        elif act in ('Death', 'DeathAlt'):
            keys = horse_keys(act, sides[act == 'DeathAlt'])
            hspec[act] = (lambda keys: (lambda f: spec_at(keys, f)))(keys)
        else:
            keys = horse_keys(act)
            hspec[act] = (lambda keys: (lambda f: spec_at(keys, f)))(keys)
    rclips = rider_clips(L, acts, hspec, sides)
    seat = rider_arm.matrix_world.copy()
    state = {}

    def pose_horse(act, f):
        if act == 'Idle' and f in (1, ACTS[act][0]):
            horse.pose(None)
        else:
            horse.pose(hspec[act](f))
        D = seat.inverted() @ horse_arm.matrix_world @ horse.D @ horse_arm.matrix_world.inverted() @ seat
        # in the falls the rider rides the stumble up to THROWN, then leaves the saddle: his keys from there on
        # are relative to where the saddle was at that frame
        if act in ('Death', 'DeathAlt') and f >= THROWN:
            if f == THROWN:
                state['Dk'] = D
            D = state['Dk']
        state['D'] = D

    def pose_rider(act, f):
        clip = rclips[act]
        spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
        rider.pose(clip, spec, f, state['D'])
        if rein:
            horse.follow_rein(rider.grip_world('L'), float(spec.get('rein', 1)))
    unit.add(horse_arm, pose_horse)
    unit.add(rider_arm, pose_rider, lambda act: rider.begin(rclips[act]))
    if bearer is not None:
        bper = Person(bearer, bearer_kit, axes=bearer_axes)
        BL = BearerLib(bper.P, bearer_kit)
        bclips = bearer_clips(BL, acts)

        def pose_bearer(act, f):
            clip = bclips[act]
            spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
            bper.A.pose(clip, spec, f)
        unit.add(bearer, pose_bearer, lambda act: bper.begin(bclips[act]))
        state['bearer'] = bper
    bpy.context.scene.render.fps = FPS
    table = unit.run()
    state['rider'] = rider
    print('REACH rider', json.dumps(sorted(((round(e, 4), c, s) for (c, s), e in rider.A.reach.items()), reverse=True)[:6]), flush=True)
    if bearer is not None:
        print('REACH bearer', json.dumps(sorted(((round(e, 4), c, s) for (c, s), e in state['bearer'].A.reach.items()), reverse=True)[:6]), flush=True)
    set_clip('Idle', 1)
    return table, unit.acts


# ---- the Bronze chariot: two horses, the car, the driver and the archer -------------------------------------

class CrewLib(RiderLib):
    """A person standing in a car (feet planted on its floor), the hands at their rest grips unless keyed."""

    def rest(self, **extra):
        spec = super().rest(**extra)
        spec['plant'] = 1
        spec['space'] = 'world'  # the driver's fists stay on the reins, which hang from the car
        return spec


WRECK_THROWN = 10  # the Wreck: the frame the crew leave the car (it starts to tip)


def crew_clips(L, acts, lean=1., bow=None):
    """A chariot crewman's clips: standing in the car (Idle), riding it with bent knees (Move, Charge: braced at
    the contact), the bow drawn and loosed (`bow`: the Archer-shoot clip; the driver watches), recoiling
    (Hit), thrown out backwards over the car's open back as it tips (Wreck)."""
    r0 = L.rest()
    out = {}
    for act in acts:
        frames, loop, events = ACTS[act]
        if act == 'Idle':
            out[act] = Clip(act, frames, loop, None, keys=[(1, r0), (21, L.key({'Chest': (0, 0, -2), 'Head': (-2, 0, 6), 'Spine': (.6, 0, 0)})), (41, r0)])
        elif act in ('Move', 'Charge'):
            T = 12 if act == 'Move' else 10
            lean_a = (5 if act == 'Move' else 9) * lean
            brace = {'Spine': (-4, 0, 0), 'Chest': (-6, 0, 0), 'Head': (4, 0, 0)}

            def fn(f, T=T, lean_a=lean_a, act=act, brace=brace):
                ph = ((f - 1) % T) / T
                r = {'Spine': (lean_a, 0, 0), 'Chest': (lean_a * .4, 0, 0), 'Head': (-lean_a, 0, 0)}
                z = -.03 + .008 * cosd(ph)
                if act == 'Charge':  # braced against the impact: held on the contact frame and the next
                    w = 1. if 23 <= f <= 24 else max(0., 1 - (23 - f) / 4) if f < 23 else max(0., 1 - (f - 24) / 4)
                    if 23 <= f <= 24:
                        z = -.03 + .008 * cosd((22 % T) / T)
                    r = {b: tuple(a + brace.get(b, (0, 0, 0))[i] * w for i, a in enumerate(v)) for b, v in r.items()}
                return L.key(r, (0, 0, z))
            out[act] = Clip(act, frames, loop, 'Arrow' if L.kit.arrow else None, fn=fn, events=events)
        elif act == 'Archer-shoot':
            if bow is not None:
                c = bow
                out[act] = Clip(act, frames, loop, c.tool, keys=c.keys, events=events)
            else:
                keys = [(1, r0), (12, L.key({'Chest': (0, 0, 4), 'Head': (-2, 0, 14)})), (24, L.key({'Chest': (0, 0, 3), 'Head': (-4, 0, 10)})), (33, r0)]
                out[act] = Clip(act, frames, loop, None, keys=keys)
        elif act == 'Hit':
            a = L.key({'Spine': (-6, 0, -4), 'Chest': (-13, 0, -8), 'Head': (-12, 0, 6), 'Hips': (-2, 0, 0)}, (0, 0, -.015), ease='out')
            out[act] = Clip(act, frames, loop, None, keys=[(1, r0), (4, a), (6, dict(a, root=(0, 0, -.02))), (10, r0)])
        elif act == 'Wreck':
            c = retime(L.death('Wreck', -1), frames, 'Wreck', events=events)
            keys = []
            for f, s in c.keys:
                z = V(s.get('root', (0, 0, 0))).z
                t = min(1, max(0, (f - WRECK_THROWN) / 16))
                keys.append((f, dict(s, root=(L.side_x * t, .30 * t, z), ground=1 if f >= 26 else 0)))
            c.keys = keys
            out[act] = c
    return out


def crew_polearm(L, out, chop=False):
    """A chariot crewman with a spear, a javelin or a halberd in the right fist (no bow), over crew_clips'
    clips: the Charge levels the point over the car's side and thrusts at the contact (held two frames),
    Archer-shoot is a thrust (chop: a halberd's overhead blow) while the archer looses."""
    r0 = L.rest()
    up = (L.arm_to((-.35, -.30, .75), .235), FC.pitch(55, -10))
    level = (L.arm_to((-.45, -.75, -.15), .235), FC.pitch(98, -18))
    stab = (L.arm_to((-.40, -.95, -.25), .245), FC.pitch(106, -20))
    lean = {'Spine': (6, 0, 6), 'Chest': (4, 0, 8), 'Head': (-6, 0, -8)}
    wk = [(1, r0), (10, L.key(at=up)), (19, L.key(at=level)), (23, L.key(lean, at=stab, ease='in')), (24, L.key(lean, at=stab)),
          (31, L.key(at=up)), (38, dict(r0, ease='io')), (41, r0)]
    ride = out['Charge'].fn

    def charge(f):
        s = ride(f)
        w = dict(spec_at(wk, f))
        r = dict(s.get('r') or {})
        for b, a in (w.get('r') or {}).items():
            r[b] = tuple(x + y for x, y in zip(r.get(b, (0, 0, 0)), a))
        w['r'] = r
        w['root'] = s.get('root', (0, 0, 0))
        return w
    c = out['Charge']
    out['Charge'] = Clip('Charge', c.frames, c.loop, c.tool, fn=charge, events=c.events)
    tw = {'Spine': (-2, 0, -8), 'Chest': (-4, 0, -12), 'Head': (2, 0, 10)}
    st = {'Hips': (2, 0, 6), 'Spine': (10, 0, 10), 'Chest': (6, 0, 12), 'Head': (-8, 0, -10)}
    if chop:  # the blade raised behind the head, brought down over the side
        wind = (L.arm_to((-.30, .10, .95), .23), FC.pitch(-25, -10))
        hit = (L.arm_to((-.40, -.85, -.20), .24), FC.pitch(118, -15))
    else:
        wind = (L.arm_to((-.35, .25, .90), .23), FC.pitch(100, -12))
        hit = stab
    keys = [(1, r0), (10, L.key(tw, at=wind)), (18, L.key(tw, at=wind)), (22, L.key(st, at=hit, ease='in')), (23, L.key(st, at=hit)),
            (27, L.key(tw, at=wind, ease='out')), (33, dict(r0, ease='io'))]
    out['Archer-shoot'] = Clip('Archer-shoot', ACTS['Archer-shoot'][0], False, None, keys=keys, events=ACTS['Archer-shoot'][2])
    return out


def chariot(near, off, car, driver, archer, arrow=('ArcherNockedArrow', 'ArcherNockedArrowHead'), extra_horses=(), crew=(), sides=(-.12, .15)):
    """Author the Bronze chariot: the two horses (in step), the car (it pitches about its axle with the horses'
    withers under the yoke, the wheels roll a turn a stride), the driver (the reins in both fists: they hang
    from the car) and the archer (the bow drawn and loosed in Archer-shoot). Returns (table, order).
    The signature chariots (2026-10-20; the base call above is unchanged): `extra_horses` [(rig, like)] the
    outer pair of a four-horse team, each posed as the near (like 0) or the off (1) horse, every rig keyed in
    every clip (the yoke pair alone lifts the car); `archer` None for a car with no bowman; `crew` more men
    [(rig, role, side_x)], role 'spear' (a spear or a javelin), 'halberd' (crew_polearm) or 'hand' (the
    driver's watch), side_x where the Wreck throws him; `sides`: the driver's and the archer's."""
    pairs = [(near, 0), (off, 1)] + [(h, like) for h, like in extra_horses]
    horses = [Horse(h, [m for m in F.meshes if m.parent == h]) for h, _ in pairs]
    unit = Unit('chariot')
    acts = unit.acts
    specs = []
    for h, (_, i) in zip(horses, pairs):
        hs = {}
        for act in acts:
            if act == 'Move':
                hs[act] = horse_gait(h, 'gallop', ACTS[act][0])
            elif act == 'Charge':
                hs[act] = horse_gait(h, 'charge', ACTS[act][0])
            else:
                if act == 'Wreck':
                    keys = horse_keys('Collapse', 1 if i == 0 else -1)
                elif act == 'Archer-shoot':
                    keys = [(1, {}), (12, {'neck': 4, 'tail_y': 6 * (1 - 2 * i)}), (23, {'neck': -6, 'head': 3, 'tail': 6, 'ease': 'out'}),
                            (28, {'neck': 2, 'tail_y': -3 * (1 - 2 * i)}), (33, {})]
                elif act == 'Idle' and i == 1:  # the off horse a beat apart from the near one
                    keys = [(1, {}), (10, {'neck': 2, 'tail_y': -6}), (20, {'neck': 7, 'head': 2, 'tail_y': 5, 'roll': -.5, 'bob': -.002}),
                            (31, {'neck': 3, 'tail_y': -3}), (41, {})]
                else:
                    keys = horse_keys(act)
                hs[act] = (lambda keys: (lambda f: spec_at(keys, f)))(keys)
        specs.append(hs)
    CB = car.data.bones
    car_rest = CB['Hull'].matrix_local.copy()
    axle = V((0, CB['Wheel_L'].head_local.y, CB['Wheel_L'].head_local.z))
    yoke_y = -.88 - axle.y
    withers = [h.arm.matrix_world.inverted() @ V((h.arm.matrix_world.translation.x, -.88, .80)) for h in horses[:2]]
    car_body = C.ground_set([m for m in F.meshes if m.parent == car], None)
    state = {}

    def pose_horses(act, f):
        for h, hs in zip(horses, specs):
            if act == 'Idle' and f in (1, ACTS[act][0]):
                h.pose(None)
            else:
                h.pose(hs[act](f))

    def pose_car(act, f):
        reset(car)
        frames = ACTS[act][0]
        if act == 'Idle' and f in (1, frames):
            upd()
            state['D'] = Matrix.Identity(4)
            return
        dz = sum((h.D @ w - w).z for h, w in zip(horses[:2], withers)) / 2
        # the yoke rides on the withers: the car turns about its axle (the yoke is yoke_y in front of it)
        pitch, roll, spin_l, spin_r = math.atan2(-dz, -yoke_y), 0., 0., 0.
        if act == 'Move':
            spin_l = spin_r = 360 * (f - 1) / 12
        elif act == 'Charge':
            spin_l = spin_r = 360 * (f - 1) / 10
            if 23 <= f <= 26:  # the impact: a jolt through the car
                pitch += math.radians(-2.5 * (1 - abs(f - 24) / 3))
        elif act == 'Hit':
            pitch += math.radians(spec_at([(1, {'a': 0.}), (3, {'a': -2.}), (6, {'a': 1.}), (10, {'a': 0.})], f)['a'])
        elif act == 'Wreck':
            k = spec_at([(1, {'p': 0., 'r': 0.}), (6, {'p': -3., 'r': 0.}), (WRECK_THROWN, {'p': -2., 'r': -8.}), (18, {'p': 2., 'r': -40., 'ease': 'in'}),
                         (24, {'p': 4., 'r': -78., 'ease': 'in'}), (28, {'p': 3., 'r': -70., 'ease': 'out'}), (32, {'p': 4., 'r': -76.}), (40, {'p': 4., 'r': -76.})], f)
            pitch, roll = math.radians(k['p']), math.radians(k['r'])
            spin_l = 220 * C.ease(min(1, (f - 1) / 39), 'out')
        R = Matrix.Rotation(roll, 4, 'Y') @ Matrix.Rotation(pitch, 4, 'X')
        car.pose.bones['Hull'].matrix = Matrix.Translation(axle) @ R @ Matrix.Translation(-axle) @ car_rest
        upd()
        u.rotate_world(car, 'Wheel_L', (spin_l, 0, 0))
        u.rotate_world(car, 'Wheel_R', (spin_r, 0, 0))
        upd()
        if act == 'Wreck' and f > 6:  # kept out of the ground while it tips, lying on it from frame 20
            low = C.lowest(car_body)
            lift = C.FLOOR - low if f >= 20 else max(0., C.FLOOR - low)
            hb = car.pose.bones['Hull']
            hb.matrix = Matrix.Translation((0, 0, lift)) @ hb.matrix
            upd()
        state['D'] = car.matrix_world @ car.pose.bones['Hull'].matrix @ car_rest.inverted() @ car.matrix_world.inverted()

    unit.add(near, pose_horses)
    unit.add(off, lambda act, f: None)
    for h, _ in extra_horses:
        unit.add(h, lambda act, f: None)
    unit.add(car, pose_car)
    people = []
    men = [(driver, FC.Kit('sword'), sides[0], 'hand')]
    if archer is not None:
        men.append((archer, FC.Kit('bow', side='L', arrow=arrow, quiver='hip'), sides[1], 'bow'))
    men += [(arm, FC.Kit('sword' if role == 'hand' else 'spear'), side_x, role) for arm, role, side_x in crew]
    for arm, kit, side_x, role in men:
        per = Person(arm, kit, weapon=kit.kind != 'sword')
        L = CrewLib(per.P, kit, 'hand' if kit.kind == 'sword' else 'bow' if kit.kind == 'bow' else 'lance')
        L.side_x = side_x
        bow = None
        if kit.kind == 'bow':
            L.kind = 'bow'
            bow = FC.bow_draw(L)
        clips = crew_clips(L, acts, lean=1. if arm == driver else .7 if role == 'bow' else .8, bow=bow)
        if role in ('spear', 'halberd'):
            clips = crew_polearm(L, clips, chop=role == 'halberd')
        M = arm.matrix_world.copy()

        def pose(act, f, per=per, clips=clips, M=M):
            clip = clips[act]
            spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
            D = state['D']
            if act == 'Wreck' and f >= WRECK_THROWN:
                if f == WRECK_THROWN:
                    state[('Dk', per.arm.name)] = D
                D = state[('Dk', per.arm.name)]
            per.pose(clip, spec, f, M.inverted() @ D @ M)
        unit.add(arm, pose, lambda act, per=per, clips=clips: per.begin(clips[act]))
        people.append(per)
    bpy.context.scene.render.fps = FPS
    table = unit.run()
    for per in people:
        print('REACH', per.arm.name, json.dumps(sorted(((round(e, 4), c, s) for (c, s), e in per.A.reach.items()), reverse=True)[:6]), flush=True)
    set_clip('Idle', 1)
    return table, unit.acts


# ---- the Modern ATGM team: the launcher, the kneeling gunner, the loader with the spare tube ---------------

class TeamLib(RiderLib):
    """A man of a weapon team: `plant` his feet (the standing loader) or not (the kneeling gunner, whose legs
    keep their rest pose); his hands' targets in the rig's space; `show` the tool bones' scales."""

    def __init__(self, P, kit, kind, plant, show=None):
        super().__init__(P, kit, kind)
        self.plant_feet, self.show = plant, dict(show or {})

    def rest(self, **extra):
        spec = super().rest(**extra)
        spec['plant'] = 1 if self.plant_feet else 0
        spec['space'] = 'world'
        if self.show:
            spec['show'] = dict(self.show)
        return spec


def add_tool_bone(arm, name, objects, side='R'):
    """A Tool_<name> bone (a child of Prop_<side> at the fist's grip, as Tool_Arrow) carrying `objects`, which
    move to it from Prop_<side> (the same place and limb at rest), so they can be hidden by scale. Call with the
    rig at the origin."""
    G, ax = C.rest_grip(side, bpy.data.objects.get(arm.name[:-3] + 'Fingers_' + side) and arm.name[:-3] + 'Fingers_' + side)
    a, _ = C.tool_frame(ax)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    b = arm.data.edit_bones.new('Tool_' + name)
    b.head, b.tail, b.roll = G, G + a * .08, 0
    b.parent = arm.data.edit_bones['Prop_' + side]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    bpy.ops.object.select_all(action='DESELECT')
    for n in objects:
        g = bpy.data.objects[n].vertex_groups.get('Prop_' + side)
        assert g, n
        g.name = 'Tool_' + name


def atgm(launcher, gunner, loader, spare=('SpareTube', 'SpareCap', 'SpareCapLow'), tube='AtgmTube'):
    """Author the ATGM team: the launcher (it kicks at the shot), the gunner kneeling at its sight (he leans
    in, fires, rides the kick and lays it again), the loader (he brings the spare tube to the launcher's back,
    reloaded, the tube gone; a new one in his fist as he straightens). Returns (table, order)."""
    unit = Unit('atgm')
    acts = unit.acts
    gp = Person(gunner, FC.Kit('sword'), weapon=False)
    G = TeamLib(gp.P, gp.kit, 'hand', plant=False)
    lp = Person(loader, FC.Kit('spear'))
    loc, rot = loader.location.copy(), loader.rotation_euler.copy()
    loader.location, loader.rotation_euler = (0, 0, 0), (0, 0, 0)
    upd()
    add_tool_bone(loader, 'Spare', spare)
    loader.location, loader.rotation_euler = loc, rot
    upd()
    lp.P.tools.append('Tool_Spare')
    L = TeamLib(lp.P, lp.kit, 'lance', plant=True, show={'Spare': 1})
    # the launcher's tube in the loader's space: its back end and its axis
    tb = bpy.data.objects[tube]
    vs = [tb.matrix_world @ v.co for v in tb.data.vertices]
    back = max(vs, key=lambda p: p.y)
    back = V((sum(p.x for p in vs) / len(vs), back.y, sum(p.z for p in vs) / len(vs)))
    Mi = loader.matrix_world.inverted()
    # the spare comes in from behind on the gunner's right, a little nose down, its front end at the launcher's back
    dw = nrm(V((-.30, -.26, -.10)))
    d_tube = nrm(Mi.to_3x3() @ dw)
    face = nrm(Mi.to_3x3() @ V((0, 0, 1)))
    front = back + V((.03, .02, .03))
    grip_at = front - dw * (lp.P.length - lp.P.h0)
    r0g, r0l = G.rest(), L.rest()

    def gk(r, root=(0, 0, 0), **x):
        return G.key(r, root, **x)

    def lk(r, root=(0, 0, 0), at=None, spare_on=1, **x):
        s = L.key(r, root, **x)
        if at is not None:
            s['W'] = L.W(at, d_tube, face)
            s['R'] = L.on('R', pole=(-1, .4, -.4))
        s['show'] = {'Spare': spare_on}
        return s
    gclips, lclips = {}, {}
    for act in acts:
        frames, loop, events = ACTS[act]
        if act == 'Idle':
            gclips[act] = Clip(act, frames, loop, None, keys=[(1, r0g), (21, gk({'Spine': (.8, 0, 0), 'Head': (-2, 0, 4)})), (41, r0g)])
            lclips[act] = Clip(act, frames, loop, None, keys=[(1, r0l), (21, lk({'Chest': (0, 0, -2), 'Head': (-2, 0, 8), 'Spine': (.6, 0, 0)})), (41, r0l)])
        elif act == 'Walk':
            # moving (2026-10-20; before it the team glided in Idle): the loader walks with the spare tube,
            # the kneeling gunner shuffles forward on his knee with the launcher (a bob and a lean on each
            # push); the run falls back to this clip (clipPlayer.js)
            lw = L.gait('Walk', 20, 19, 42, 2)
            lclips[act] = Clip(act, frames, loop, None, fn=lambda f, c=lw: dict(c.fn(f), show={'Spare': 1}))  # (no foot planting: in place)
            push = gk({'Spine': (10, 0, 0), 'Chest': (4, 0, 0), 'Head': (-8, 0, 0)}, (0, 0, .025))
            settle = gk({'Spine': (4, 0, 0), 'Chest': (2, 0, 0), 'Head': (-4, 0, 0)}, (0, 0, -.004))
            gclips[act] = Clip(act, frames, loop, None, keys=[(1, r0g), (6, push), (11, settle), (16, push), (21, r0g)])
        elif act == 'Aim-fire-reload':
            lay = gk({'Spine': (6, 0, 0), 'Chest': (3, 0, 0), 'Head': (-6, 0, 0)}, (0, 0, -.005))
            kick = gk({'Spine': (2, 0, 0), 'Chest': (-2, 0, 0), 'Head': (-2, 0, 0)}, (0, 0, .004), ease='out')
            aside = gk({'Spine': (4, -10, 6), 'Chest': (2, -6, 4), 'Head': (-4, 0, 14)}, (0, 0, -.005))  # he leans out of the loader's way
            gclips[act] = Clip(act, frames, loop, None, keys=[(1, r0g), (7, lay), (11, lay), (12, kick), (14, kick), (20, lay), (26, aside), (38, aside),
                                                              (44, lay), (50, r0g)], events=events)
            # the loader: watches the shot, turns and crouches with the spare tube, lays it behind the
            # launcher and pushes it home (reloaded: it is gone), straightens with a new one
            P0 = Mi @ grip_at
            ready = lk({'Spine': (14, -10, -14), 'Chest': (6, -6, -10), 'Head': (-12, 0, 10)}, (0, 0, -.10), at=Mi @ (grip_at - dw * .12 + V((0, 0, .08))))
            lay_on = lk({'Spine': (20, -16, -18), 'Chest': (8, -8, -12), 'Head': (-16, 0, 12)}, (0, 0, -.14), at=P0)
            home = lk({'Spine': (22, -16, -18), 'Chest': (9, -8, -12), 'Head': (-16, 0, 12)}, (0, 0, -.15), at=P0 + d_tube * .07, ease='in')
            empty = lk({'Spine': (20, -14, -16), 'Chest': (8, -6, -10), 'Head': (-14, 0, 10)}, (0, 0, -.14), at=P0 + d_tube * .07, spare_on=0)
            up = lk({'Spine': (6, -4, -6), 'Chest': (2, 0, -4), 'Head': (-4, 0, 4)}, (0, 0, -.03), spare_on=0)
            lclips[act] = Clip(act, frames, loop, None, keys=[(1, r0l), (12, lk({'Head': (-4, 0, 14)})), (17, lk({'Head': (-6, 0, 18), 'Spine': (4, 0, -6)})),
                                                              (24, ready), (30, lay_on), (37, home), (38, home), (39, empty), (44, up), (47, dict(up, show={'Spare': 1})),
                                                              (50, r0l)], events=events)
        elif act == 'Hit':
            a = gk({'Spine': (-8, 0, -4), 'Chest': (-12, 0, -6), 'Head': (-12, 0, 6)}, ease='out')
            gclips[act] = Clip(act, frames, loop, None, keys=[(1, r0g), (4, a), (6, a), (10, r0g)])
            b = lk({'Spine': (-6, 0, -4), 'Chest': (-12, 0, -9), 'Head': (-12, 0, 6), 'Hips': (-2, 0, 0)}, (0, 0, -.015), ease='out')
            lclips[act] = Clip(act, frames, loop, None, keys=[(1, r0l), (4, b), (6, dict(b, root=(0, 0, -.02))), (10, r0l)])
        elif act in ('Death', 'DeathAlt'):
            back_fall = act == 'DeathAlt'
            struck = gk({'Spine': (-10, 0, -6), 'Chest': (-12, 0, -8), 'Head': (-14, 0, 6)}, ease='out', space='chest')
            # the kneeling legs open out as he goes over (the rest pose has the left knee up, the right on the ground)
            legs = {'Leg_L': (70, 0, 0), 'Shin_L': (-70, 0, 0), 'Leg_R': (10, 0, 0), 'Shin_R': (-80, 0, 0)}
            tip = gk(dict({'Root': (-30, 0, 0) if back_fall else (0, -36, 0), 'Spine': (-6, 0, 0), 'Head': (-6, 0, 0)},
                          **{b: (a[0] * .4, 0, 0) for b, a in legs.items()}), space='chest', ease='in')
            down = gk(dict({'Root': (-76, 0, 0) if back_fall else (0, -84, 0), 'Spine': (4, 0, 0), 'Head': (-12, 0, 8)}, **legs), space='chest', ground=1, ease='in')
            bounce = dict(down, r=dict(down['r'], Root=(-70, 0, 0) if back_fall else (0, -79, 0)), ease='out')
            gclips[act] = Clip(act, frames, loop, None, keys=[(1, r0g), (5, struck), (14, tip), (22, down), (26, bounce), (31, down), (40, down)], ground='all',
                               events=events)
            c = retime(L.death(act, -1 if act == 'Death' else 1), frames, act, events=events)
            out = []
            for f, s in c.keys:
                z = V(s.get('root', (0, 0, 0))).z
                t = min(1, max(0, (f - 3) / 14)) ** .8 if back_fall else 0
                out.append((f, dict(s, show={'Spare': 1}, root=(.23 * t, .11 * t, z))))  # he steps out to the side (+X)
            c.keys = out
            lclips[act] = c

    def pose_launcher(act, f):
        reset(launcher)
        if act == 'Walk':  # the launcher rocks as it is pushed along
            u.rotate_world(launcher, 'Hull', (1.5 * math.sin(2 * TAU * (f - 1) / 20), 0, 0))
        if act == 'Aim-fire-reload':
            k = spec_at([(1, {'p': 0.}), (11, {'p': 0.}), (12, {'p': -4.}), (13, {'p': -3.}), (19, {'p': 0., 'ease': 'io'}), (50, {'p': 0.})], f)
            u.rotate_world(launcher, 'Hull', (k['p'], 0, 0))
        upd()

    def pose_gunner(act, f):
        clip = gclips[act]
        gp.pose(clip, spec_at(clip.keys, f), f)

    def pose_loader(act, f):
        clip = lclips[act]
        lp.A.pose(clip, clip.fn(f) if clip.fn else spec_at(clip.keys, f), f)
    unit.add(launcher, pose_launcher)
    unit.add(gunner, pose_gunner, lambda act: gp.begin(gclips[act]))
    unit.add(loader, pose_loader, lambda act: lp.begin(lclips[act]))
    bpy.context.scene.render.fps = FPS
    table = unit.run()
    for per in (gp, lp):
        print('REACH', per.arm.name, json.dumps(sorted(((round(e, 4), c, s) for (c, s), e in per.A.reach.items()), reverse=True)[:6]), flush=True)
    set_clip('Idle', 1)
    return table, unit.acts


# ---- the options file, the builder hook, the sheets ----------------------------------------------------------

def options_extra(uid):
    """The unit's bake options as they are in the game today (everything but the clips)."""
    p = u.REPO / 'src' / 'assets' / 'units' / f'{uid}.json'
    if not p.exists():
        return {}
    o = json.loads(p.read_text())
    o.pop('clips', None)
    o.pop('restClip', None)
    return o


def hook(uid, author, archetype, sheet_kw=None):
    """For F.finish_unit (clips=, mode='NLA_TRACKS'): authors the clips after the shade bake (author() returns
    (table, order)), keeps the unit's bake options in its options file, renders the sheets after the export
    when TI_SHEETS is set."""
    state = {}

    def run():
        table, order = author()
        state['table'] = table
        return table, order

    def after():
        if os.environ.get('TI_SHEETS'):
            sheets(uid, state['table'], archetype, **(sheet_kw or {}))
            if os.environ.get('TI_SHEETS') == 'side':
                sheets(uid, state['table'], archetype, view='side', **(sheet_kw or {}))
    return run, after, options_extra(uid)


def sheets(uid, table, archetype, view='game', ortho=2.0, aim=(-.12, -.28, .66), cols=8, cell=(240, 240), team='2F6FD0'):
    """Workbench stills of every clip from the battle camera (every rig on its action), 8 frames a row (the
    event frames among them), written to plans/art-pilot/mounted-clips/<uid>-<sheet>.png."""
    import numpy as np
    dest = u.REPO / 'plans' / 'art-pilot' / 'mounted-clips'
    if os.environ.get('TI_SHEETS_DIR'):
        dest = u.REPO / os.environ['TI_SHEETS_DIR']
    dest.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = False
    scene.render.resolution_x, scene.render.resolution_y = cell
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('W')
    for tag in ('Team', 'Emblem'):
        if tag in bpy.data.materials:
            bpy.data.materials[tag].diffuse_color = (*(u.linear(int(team[i:i + 2], 16) / 255) for i in (0, 2, 4)), 1)
    cam = bpy.data.objects.new('SheetCam', bpy.data.cameras.new('SheetCam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho
    scene.camera = cam
    off = {'game': (1.6, -1.9, 2.1), 'side': (3.4, 0, .25), 'front': (.4, -3.4, .4)}[view]
    cam.location = V(aim) + V(off)
    cam.rotation_euler = (V(aim) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    me = bpy.data.meshes.new('SheetGround')
    me.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    gm = bpy.data.materials.new('SheetGround')
    gm.diffuse_color = (.36, .42, .26, 1)
    me.materials.append(gm)
    ground = bpy.data.objects.new('SheetGround', me)
    scene.collection.objects.link(ground)
    arms = [o for o in scene.objects if o.type == 'ARMATURE']
    for a in arms:
        a.hide_viewport = a.hide_render = True
    tmp = dest / f'_cells-{uid}'
    tmp.mkdir(parents=True, exist_ok=True)
    written = []
    for sheet, names in SHEETS[archetype].items():
        names = [n for n in names if n in table]
        W, H = cell
        img = np.ones((H * len(names), W * cols, 4), dtype=np.float32)
        for row, name in enumerate(names):
            set_clip(name)
            for col, fr in enumerate(C.sample_frames(table[name], cols)[:cols]):
                scene.frame_set(fr)
                path = tmp / f'{name}-{fr}.png'
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)
                im = bpy.data.images.load(str(path))
                px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
                bpy.data.images.remove(im)
                if any(v == fr for v in (table[name].get('events') or {}).values()):
                    px[H - 5:H, :, :] = (.85, .15, .1, 1)
                y0 = (len(names) - 1 - row) * H
                img[y0:y0 + H, col * W:(col + 1) * W] = px
        name = f'{uid}-{sheet}' + ('' if view == 'game' else '-' + view)
        out = bpy.data.images.new(name, W * cols, H * len(names), alpha=True)
        out.pixels = img.ravel().tolist()
        out.filepath_raw = str(dest / f'{name}.png')
        out.file_format = 'PNG'
        out.save()
        written.append(out.filepath_raw)
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    for a in arms:
        a.hide_viewport = a.hide_render = False
    set_clip('Idle', 1)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.objects.remove(ground, do_unlink=True)
    print('SHEETS', written, flush=True)
    return written
