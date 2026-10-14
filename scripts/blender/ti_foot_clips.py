# scripts/blender/ti_foot_clips.py
# Authored battle clips for the foot soldiers of the five ages, to the contract of
# plans/art/clip-animation-pipeline.md section 7 (and 7.2, the foot soldiers), over the shared tooling of
# ti_clips.py (the workers' poser and author, generalised):
#   - the clip sets by archetype: melee (spear, sword, pike), bow, gun (musket, rifle), support (the
#     worker clips whose tool the unit carries, plus Hit and Death); see SETS
#   - 20 fps, in place (Root moves on X and Y never; it rises and falls with the gaits and turns for the
#     falls), loops closed (the last frame repeats the first), Idle frame 1 is the rest pose exactly
#   - the weapon stays on its bone (Prop_R, or Prop_L for a bow or a rifle held in the left fist): a pose
#     places the weapon in the world (`W`: a point of it, its axis and its face) and the hands go to it,
#     each on a station along the weapon (`on`, from the butt) or to a free target (`p`, `d`, `f`), blended
#     by `w`; so a hand slides along a haft (a pike held near the butt, a musket at the stock's wrist) and
#     the other hand can leave the weapon (the musket held in the left hand while the right rams)
#   - a nocked arrow on its own bone Tool_Arrow (a child of Prop_R), hidden by scale from the release until
#     the next arrow comes out of the quiver; the Bronze bow's string bone Prop_String follows the drawing
#     hand
#   - events (1-based): contact (Attack, Attack2, Melee-fallback, Mine, Build, Repair; held two frames),
#     release (Draw-aim-release), fire and reloaded (Aim-fire-reload), settle (Death, DeathAlt: the last
#     frame, lying still)
# Blender Z up, the front faces -Y, a standing person is 1 tall.
import bpy, math, os, json
from mathutils import Vector, Matrix
import ti_units as u
import ti_figure as F
import ti_clips as C
import ti_worker_clips as WC
from ti_clips import Clip, nrm, frame3, upd, tool_frame, FPS

V = Vector
SETS = {
    'melee': ('Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Attack', 'Attack2', 'Block', 'Hit', 'Death', 'DeathAlt', 'Cheer'),
    'bow': ('Idle', 'Walk', 'Run', 'Draw-aim-release', 'Melee-fallback', 'Hit', 'Death', 'DeathAlt'),
    'gun': ('Idle', 'Walk', 'Run', 'Aim-fire-reload', 'Melee-fallback', 'Hit', 'Death', 'DeathAlt'),
    'support': ('Idle', 'Walk', 'Run', 'Mine', 'Build', 'Repair', 'Hit', 'Death'),
}
SHEETS = {
    'melee': {'moving': ['Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Cheer'], 'combat': ['Attack', 'Attack2', 'Block', 'Hit', 'Death', 'DeathAlt']},
    'bow': {'moving': ['Idle', 'Walk', 'Run', 'Hit'], 'combat': ['Draw-aim-release', 'Melee-fallback', 'Death', 'DeathAlt']},
    'gun': {'moving': ['Idle', 'Walk', 'Run', 'Hit'], 'combat': ['Aim-fire-reload', 'Melee-fallback', 'Death', 'DeathAlt']},
    'support': {'moving': ['Idle', 'Walk', 'Run', 'Hit', 'Death'], 'work': ['Mine', 'Build', 'Repair']},
}
LOOPS = {'Idle', 'IdleAlt', 'Walk', 'Run', 'Retreat-run', 'Cheer', 'Mine', 'Build', 'Repair'}


def pitch(theta, yaw=0., roll=0.):
    """A held thing's (axis, face) from upright and facing front (axis +Z, face -Y): tipped `theta`
    degrees forward (90: level, pointing to the front; 180: straight down), turned `yaw` degrees to
    the left about Z, rolled `roll` degrees about its own axis (180: the face up when level)."""
    R = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(theta), 3, 'X')
    a, f = R @ V((0, 0, 1)), R @ V((0, -1, 0))
    if roll:
        f = Matrix.Rotation(math.radians(roll), 3, a) @ f
    return tuple(a), tuple(f)


# ---- what the soldier holds ---------------------------------------------------------------------------

class Kit:
    """kind: 'spear', 'sword', 'pike' (melee), 'bow', 'gun', 'tool' (support). side: the hand that holds
    the weapon (its bone Prop_<side>). shield: a shield on the other arm (Prop_L). two_hands: the other
    hand rests on the weapon too (the Modern rifle). bayonet: a gun with a bayonet thrusts in
    Melee-fallback (else it strikes with the butt). arrow: the nocked arrow's objects (moved to
    Tool_Arrow); string: the bow has a string bone (Prop_String). quiver: 'back' or 'hip'. still: the
    other hand stays where it is at rest in the work clips (a mantlet on the left arm). tool: the support
    tool ('pick', 'maul', 'spade'). fingers: {side: object name} for a fist not made by F.fist."""

    def __init__(self, kind, side='R', shield=False, two_hands=False, bayonet=False, arrow=(), string=False, quiver='back',
                 still=False, tool=None, fingers=None, archetype=None):
        self.kind, self.side, self.shield, self.two_hands, self.bayonet = kind, side, shield, two_hands, bayonet
        self.arrow, self.string, self.quiver, self.still, self.tool, self.fingers = tuple(arrow), string, quiver, still, tool, fingers
        self.other = 'L' if side == 'R' else 'R'
        self.bone = 'Prop_' + side
        self.archetype = archetype or {'spear': 'melee', 'sword': 'melee', 'pike': 'melee', 'bow': 'bow', 'gun': 'gun', 'tool': 'support'}[kind]


def add_arrow_bone(arm, kit, meshes):
    """The nocked arrow moves from Prop_R to its own bone Tool_Arrow (a child of Prop_R at the grip, the
    same shape and rest pose: its vertices still classify as the right arm), so it can be hidden by scale."""
    G, ax = C.rest_grip('R', (kit.fingers or {}).get('R'))
    a, _ = tool_frame(ax)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    b = arm.data.edit_bones.new('Tool_Arrow')
    b.head, b.tail, b.roll = G, G + a * .08, 0
    b.parent = arm.data.edit_bones['Prop_R']
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    bpy.ops.object.select_all(action='DESELECT')
    moved = []
    for ob in meshes:
        if ob.name in kit.arrow:
            g = ob.vertex_groups.get('Prop_R')
            assert g, ob.name
            g.name = 'Tool_Arrow'
            moved.append(ob.name)
    assert sorted(moved) == sorted(kit.arrow), (moved, kit.arrow)


class FootPoser(C.Poser):
    def __init__(self, arm, kit, meshes):
        G, ax = C.rest_grip(kit.side, (kit.fingers or {}).get(kit.side))
        super().__init__(arm, {}, tool_frame(ax), kit.fingers)
        self.kit = kit
        B = arm.data.bones
        self.hf = {s: tool_frame(self.grip[s][1]) for s in 'LR'}
        self.rpole = {}
        for s in 'LR':
            S, E, W = B['Arm_' + s].head_local, B['Forearm_' + s].head_local, B['Hand_' + s].head_local
            dn = nrm(W - S)
            self.rpole[s] = tuple(nrm((E - S) - dn * (E - S).dot(dn)))
        # the weapon: its rest frame at the holding fist and its stations (from the butt) along its axis
        self.G0 = self.grip[kit.side][0].copy()
        self.a0, self.f0 = self.hf[kit.side]
        lo, hi = 1e9, -1e9
        for ob in meshes:
            if not ob.get('attachment'):
                continue
            names = {g.index: g.name for g in ob.vertex_groups}
            for v in ob.data.vertices:
                if any(names.get(g.group) == kit.bone and g.weight > .5 for g in v.groups):
                    t = (ob.matrix_world @ v.co - self.G0).dot(self.a0)
                    lo, hi = min(lo, t), max(hi, t)
        assert lo < hi, 'no weapon on ' + kit.bone
        self.h0, self.length = -lo, hi - lo
        # the other fist: its rest station along the weapon (when it rests on it) and its turn on a haft
        Go = self.grip[kit.other][0]
        self.s_other = (Go - self.G0).dot(self.a0) + self.h0
        self.sign = {s: (1 if self.grip[s][1].dot(self.a0) >= 0 else -1) for s in 'LR'}


class FootAuthor(C.Author):
    def __init__(self, arm, poser, meshes, kit):
        super().__init__(arm, poser, meshes)
        self.kit = kit
        self.reach = {}

    def first_sign(self, clip):
        self.lsign = 1

    def pose(self, clip, spec, frame):
        P, kit = self.P, self.kit
        P.reset()
        if clip.name == 'Idle' and frame in (1, clip.frames):
            self.scales(clip, spec)
            upd()
            return  # frame 1 of Idle is the rest pose, exactly (and the loop closes on it)
        for b, ang in spec.get('r', {}).items():
            u.rotate_world(self.arm, b, ang)
        root = V(spec.get('root', (0, 0, 0)))
        P.pb('Root').location = P.rest['Root'].to_3x3().inverted() @ root
        upd()
        w = float(spec.get('plant', 0))
        if w > .001:
            legs = [n + s for n in ('Leg_', 'Shin_', 'Foot_') for s in 'LR']
            fk = {n: P.pb(n).rotation_quaternion.copy() for n in legs}
            P.plant(spec.get('feet'))
            if w < .999:
                for n in legs:
                    P.pb(n).rotation_quaternion = fk[n].slerp(P.pb(n).rotation_quaternion, w)
                upd()
        M = P.chest_delta() if spec.get('space', 'world') == 'chest' else Matrix.Identity(4)
        R3 = M.to_3x3()
        T = Qw = D = None
        ws = spec.get('W')
        if ws:
            D, Fd = nrm(R3 @ V(ws['d'])), nrm(R3 @ V(ws['f']))
            Qw = frame3(D, Fd) @ frame3(P.a0, P.f0).transposed()
            base = P.G0 + P.a0 * (ws['h'] - P.h0)
            T = Matrix.Translation(M @ V(ws['at'])) @ Qw.to_4x4() @ Matrix.Translation(-base)
        for s in (kit.side, kit.other):
            H = spec.get(s)
            if H:
                self.hand(clip, s, H, M, R3, T, Qw, D)
        if T is not None:
            pb = P.pb(kit.bone)
            pb.matrix = T @ P.rest[kit.bone]
            upd()
        if kit.string:
            self.string(float(spec.get('string', 0)))
        fl = float(spec.get('flat', 0))
        if fl > .001:  # the weapon turns about the grip to lie level on the ground
            self.lay_flat(kit.bone, fl)
        self.scales(clip, spec)
        upd()
        if clip.ground:
            self.to_ground(clip.ground)

    def hand(self, clip, s, H, M, R3, T, Qw, D):
        P = self.P
        G, ax = P.grip[s]
        Wr = P.wrist[s]
        wt = float(H.get('w', 0)) if T is not None and 'on' in H else 0.
        a0, f0 = P.hf[s]
        Pf = M @ V(H.get('p', G))
        Qf = frame3(nrm(R3 @ V(H.get('d', a0))), nrm(R3 @ V(H.get('f', f0)))) @ frame3(a0, f0).transposed()
        Pt, Q = Pf, Qf
        if wt > 1e-4:
            Pon = T @ (P.G0 + P.a0 * (H['on'] - P.h0))
            Qon = Qw if s == self.kit.side else (ax * P.sign[s]).rotation_difference(D).to_matrix()
            Pt = Pf.lerp(Pon, wt)
            Q = Qf.to_quaternion().slerp(Qon.to_quaternion(), wt).to_matrix()
        P.two_bone('Arm_' + s, 'Forearm_' + s, P.len['arm' + s], Pt - Q @ (G - Wr), V(H.get('pole', P.rpole[s])))
        P.orient('Hand_' + s, Q @ P.rest['Hand_' + s].to_3x3())
        e = (P.grip_now(s) - Pt).length
        key = (clip.name, s)
        self.reach[key] = max(self.reach.get(key, 0), e)

    def string(self, wt):
        """The Bronze bow's string (Prop_String, a child of Prop_L): where it rests on the bow, pulled `wt`
        of the way to the drawing fist."""
        P = self.P
        pl = P.pb('Prop_L')
        relaxed = pl.matrix @ P.rest['Prop_L'].inverted() @ P.rest['Prop_String'].translation
        R = (pl.matrix @ P.rest['Prop_L'].inverted()).to_3x3() @ P.rest['Prop_String'].to_3x3()
        mid = relaxed.lerp(P.grip_now('R'), max(0, min(1, wt)))
        P.pb('Prop_String').matrix = Matrix.Translation(mid) @ R.to_4x4()
        upd()

    def entry(self, clip):
        e = {'frames': clip.frames, 'fps': FPS, 'loop': clip.loop}
        if clip.tool:
            e['tool'] = clip.tool
        if clip.events:
            e['events'] = dict(clip.events)
        return e


# ---- the library ------------------------------------------------------------------------------------------

class Lib:
    """Key specs for one soldier (the poser knows his rest pose and his weapon)."""

    def __init__(self, P, kit):
        self.P, self.kit = P, kit
        self.side, self.other = kit.side, kit.other

    # -- spec helpers --
    def W(self, at, d, f, h=None):
        return {'at': tuple(at), 'd': tuple(d), 'f': tuple(f), 'h': self.P.h0 if h is None else h}

    def free(self, s, p=None, d=None, f=None, pole=None, on=None, w=0.):
        P = self.P
        H = {'p': tuple(p if p is not None else P.grip[s][0]), 'd': tuple(d if d is not None else P.hf[s][0]),
             'f': tuple(f if f is not None else P.hf[s][1]), 'pole': tuple(pole if pole is not None else P.rpole[s]), 'w': w}
        H['on'] = on if on is not None else (P.h0 if s == self.side else P.s_other)
        return H

    def on(self, s, station=None, pole=None):
        """A fist on the weapon at `station` (from the butt)."""
        return self.free(s, pole=pole, on=station, w=1.)

    def rest(self, **extra):
        """The rest pose as a weapon spec (every bone where it rests: the clips that start or end there)."""
        P, k = self.P, self.kit
        spec = {'space': 'world', 'plant': 1, 'r': {}, 'W': self.W(P.G0, P.a0, P.f0), self.side: self.on(self.side, P.h0)}
        spec[self.other] = self.on(self.other, P.s_other) if k.two_hands else self.free(self.other)
        if k.arrow:
            spec['show'] = {'Arrow': 1}
        if k.string:
            spec['string'] = 0
        spec.update(extra)
        return spec

    def key(self, r=None, root=(0, 0, 0), W=None, hands=None, ease=None, **extra):
        """A weapon key: torso rotations `r`, the weapon `W`, the hands {side: spec}; the rest for the rest."""
        spec = self.rest()
        spec['r'] = dict(r or {})
        spec['root'] = tuple(root)
        if W:
            spec['W'] = W
        for s, H in (hands or {}).items():
            spec[s] = H
        if ease:
            spec['ease'] = ease
        spec.update(extra)
        return spec

    # -- FK clips: idle, gaits, hit, falls --
    def arms_swing(self):
        k = self.kit
        if k.two_hands:
            return 0, 0
        if k.kind == 'pike':
            return 4, 0  # the left fist stays on the sword's pommel
        return 5, 4

    def idle(self, alt=False):
        k = self.kit
        if alt:  # shift the weight, look round to the left and back
            mid = {'Hips': (0, 1.5, 4), 'Spine': (.8, -1, -2), 'Chest': (0, -.8, -3), 'Head': (-2, 0, 12)}
            keys = [(1, {}), (12, {'r': mid}), (26, {'r': dict(mid, Head=(1, 0, 6))}), (41, {})]
            return Clip('IdleAlt', 41, True, None, keys=keys)
        keys = [(1, {}), (21, {'r': {'Chest': (0, 0, -1), 'Head': (-1, 0, 2), 'Spine': (.6, 0, 0)}}), (41, {})]
        return Clip('Idle', 41, True, 'Arrow' if k.arrow else None, keys=keys)

    def gait(self, name, period, stride, knee, lean, arms=1., run=False):
        sr, sl = self.arms_swing()
        base = WC.gait(name, period, stride, knee, lean, 'foot', run=run)

        def fn(f):
            spec = base.fn(f)
            ph = ((f - 1) % period) / period
            sw = math.cos(2 * math.pi * ph)
            r = spec['r']
            if sr:
                r['Arm_R'] = (-sr * arms * sw, 0, 0)
            if sl:
                r['Arm_L'] = (sl * arms * sw, 0, 0)
            if run and sr:
                r['Forearm_R'] = (-5, 0, 0)
            if self.kit.arrow:
                spec['show'] = {'Arrow': 1}
            return spec
        return Clip(name, period + 1, True, 'Arrow' if self.kit.arrow else None, fn=fn, ground='feet')

    def hit(self):
        W = {'plant': True}
        recoil = dict(W, r={'Spine': (-5, 0, -3), 'Chest': (-12, 0, -9), 'Head': (-12, 0, 6), 'Hips': (-2, 0, 0), 'Arm_L': (-6, 0, -4)},
                      root=(0, 0, -.015), ease='out')
        keys = [(1, dict(W)), (3, recoil), (5, dict(recoil, root=(0, 0, -.02))), (8, dict(W))]
        return Clip('Hit', 8, False, 'Arrow' if self.kit.arrow else None, keys=keys)

    def death(self, name, sign):
        """Struck, the knees buckle, he topples (forward, sign 1; backward, -1), the weapon slips round
        in the fist and lies along the ground; still from the settle frame (the last) on."""
        W = {'plant': True}
        struck = dict(W, r={'Spine': (-6, 0, -4 * sign), 'Chest': (-14, 0, -10 * sign), 'Head': (-14, 0, 6), 'Arm_L': (-10, 0, -8), 'Arm_R': (-6, 0, 8)},
                      root=(0, 0, -.02), ease='out')
        buckle = dict(W, r={'Spine': (14 * sign, 0, 4), 'Chest': (10 * sign, 0, 6), 'Head': (12 * sign, 0, 0), 'Arm_L': (-14, 0, -12),
                            'Arm_R': (-10, 0, 12), 'Hips': (6 * sign, 0, 0)}, root=(0, 0, -.16))
        legs = {'Leg_L': (-30, 0, 0), 'Leg_R': (-24, 0, 0), 'Shin_L': (44, 0, 0), 'Shin_R': (38, 0, 0)}
        if sign < 0:
            legs = {'Leg_L': (-36, 0, 4), 'Leg_R': (-30, 0, -4), 'Shin_L': (52, 0, 0), 'Shin_R': (46, 0, 0)}
        fall = {'r': dict(legs, Root=(52 * sign, 0, 6 * sign), Spine=(6 * sign, 0, 4), Chest=(4 * sign, 0, 4), Head=(6 * sign, 0, 0),
                          Arm_L=(-26, 0, -26), Arm_R=(-20, 0, 26)), 'ease': 'in'}
        down = {'r': {'Root': (90 * sign, 0, 8 * sign), 'Leg_L': (-4, 0, 0), 'Leg_R': (-2, 0, 2), 'Shin_L': (14, 0, 0), 'Shin_R': (8, 0, 0),
                      'Spine': (-4 * sign, 0, 2), 'Chest': (-2 * sign, 0, 0), 'Head': (-14 * sign, 0, 0), 'Arm_L': (-12, 0, -30), 'Arm_R': (-8, 0, 30)},
                'ease': 'in'}
        if sign < 0:  # on his back: the knees up a little, the arms out
            down['r'].update({'Leg_L': (-16, 0, 6), 'Leg_R': (-6, 0, -4), 'Shin_L': (30, 0, 0), 'Shin_R': (12, 0, 0), 'Arm_L': (-40, 0, -44), 'Arm_R': (-30, 0, 40)})
        bounce = {'r': dict(down['r'], Root=(86 * sign, 0, 8 * sign), Chest=(-6 * sign, 0, 0), Head=(-20 * sign, 0, 0)), 'ease': 'out'}
        still = {'r': dict(down['r'], Root=(89 * sign, 0, 8 * sign), Head=(-12 * sign, 0, 18 * sign))}
        keys = [(1, dict(W)), (4, struck), (10, buckle), (16, fall), (21, down), (24, bounce), (28, still), (30, still)]
        flat = {16: .5, 21: 1, 24: 1, 28: 1, 30: 1}
        keys = [(f, dict(s, flat=flat.get(f, 0))) for f, s in keys]
        if self.kit.arrow:
            keys = [(f, dict(s, show={'Arrow': 1})) for f, s in keys]
        return Clip(name, 30, False, 'Arrow' if self.kit.arrow else None, keys=keys, ground='all', events={'settle': 30})

    # -- the clip set --
    def clips(self):
        k = self.kit
        out = [self.idle(), self.gait('Walk', 20, 19, 42, 2), self.gait('Run', 14, 30, 74, 9, arms=1.8, run=True), self.hit(),
               self.death('Death', 1)]
        if k.archetype != 'support':
            out.append(self.death('DeathAlt', -1))
        if k.archetype == 'melee':
            out += [self.idle(alt=True), self.gait('Retreat-run', 14, 28, 70, 4, arms=1.4, run=True)]
            out += MELEE[k.kind](self)
        elif k.archetype == 'bow':
            out += [bow_draw(self), bow_melee(self)]
        elif k.archetype == 'gun':
            out += [gun_fire(self), gun_melee(self)]
        else:
            out += support(self)
        order = SETS[k.archetype]
        out = [c for c in out if c.name in order]
        return sorted(out, key=lambda c: order.index(c.name))


# ---- melee ------------------------------------------------------------------------------------------------
# Torso rotations are world-axis degrees per bone (they add down the chain): X leans forward, Z turns to
# the left (a negative Z brings the left shoulder forward).

def shield_hand(L, p=(.16, -.24, .66), turn=-12):
    """The shield arm forward, the shield's face turned `turn` degrees about Z (negative: across the body)."""
    d, f = pitch(0, turn)
    return L.free('L', p=p, d=d, f=f, pole=(1, .4, -.6))


def melee_spear(L):
    """A one-handed spear and a shield: an underarm thrust (Attack), an overhand stab from above the
    shoulder (Attack2), the shield up (Block), the spear raised and shaken (Cheer)."""
    P, k = L.P, L.kit
    R = L.side
    shield = shield_hand(L) if k.shield else L.free(L.other)
    hold = lambda: L.on(R, pole=(-1, .3, -.6))  # noqa: E731
    # Attack: guard (the spear forward and up at the hip), drawn back, the thrust, recovered
    d, f = pitch(62)
    guard = L.key({'Spine': (4, 0, -4), 'Chest': (2, 0, -6)}, W=L.W((-.17, -.16, .64), d, f), hands={R: hold(), L.other: shield})
    d, f = pitch(80)
    back = L.key({'Spine': (0, 0, -10), 'Chest': (-2, 0, -12), 'Head': (0, 0, 10)}, (0, 0, .004), W=L.W((-.18, .03, .67), d, f),
                 hands={R: hold(), L.other: shield})
    d, f = pitch(84)
    thrust = L.key({'Hips': (2, 0, 6), 'Spine': (8, 0, 10), 'Chest': (6, 0, 12), 'Head': (-8, 0, -12)}, (0, 0, -.03),
                   W=L.W((-.10, -.37, .69), d, f), hands={R: hold(), L.other: shield_hand(L, (.18, -.17, .64))}, ease='in')
    a1 = Clip('Attack', 21, False, None, keys=[(1, guard), (7, back), (11, thrust), (12, thrust), (16, dict(back, ease='out')), (21, guard)],
              events={'contact': 11})
    # Attack2: the spear lifted over the shoulder, point to the front, stabbed down and forward
    d, f = pitch(100)
    over = L.key({'Spine': (-2, 0, -8), 'Chest': (-4, 0, -12), 'Head': (2, 0, 8)}, (0, 0, .004), W=L.W((-.16, .02, .93), d, f, h=P.h0),
                 hands={R: L.on(R, pole=(-1, .6, .3)), L.other: shield})
    d, f = pitch(108)
    stab = L.key({'Hips': (2, 0, 6), 'Spine': (10, 0, 10), 'Chest': (8, 0, 12), 'Head': (-8, 0, -10)}, (0, 0, -.035),
                 W=L.W((-.10, -.30, .84), d, f, h=P.h0), hands={R: L.on(R, pole=(-1, .6, .3)), L.other: shield_hand(L, (.18, -.17, .64))}, ease='in')
    a2 = Clip('Attack2', 25, False, None, keys=[(1, guard), (8, over), (13, stab), (14, stab), (19, dict(over, ease='out')), (25, guard)],
              events={'contact': 13})
    # Block: the shield up and forward, the spear held back
    blk = block(L, guard, hold)
    return [a1, a2, blk, cheer(L)]


def block(L, guard, hold):
    """Block: crouched behind the shield (up to the eyes, pushed forward, turned across the body), the
    weapon kept back; without a shield the weapon comes up across the body instead."""
    k = L.kit
    R = L.side
    if k.shield:
        up = L.key({'Hips': (4, 0, -4), 'Spine': (6, 0, -6), 'Chest': (2, 0, -8), 'Head': (-4, 0, 6)}, (0, 0, -.04), W=guard['W'],
                   hands={R: hold(), L.other: shield_hand(L, (.10, -.27, .80), -24)})
        jolt = L.key({'Hips': (2, 0, -4), 'Spine': (3, 0, -6), 'Chest': (-2, 0, -8), 'Head': (-2, 0, 6)}, (0, 0, -.045), W=guard['W'],
                     hands={R: hold(), L.other: shield_hand(L, (.10, -.24, .81), -24)}, ease='out')
    else:
        d, f = pitch(-30, -70)
        up = L.key({'Hips': (4, 0, -4), 'Spine': (6, 0, -6), 'Chest': (2, 0, -8), 'Head': (-4, 0, 6)}, (0, 0, -.04), W=L.W((-.10, -.24, .84), d, f),
                   hands={R: hold((-1, .2, -.6)), L.other: L.free(L.other)})
        jolt = dict(up, root=(0, 0, -.045), ease='out')
    return Clip('Block', 20, False, None, keys=[(1, guard), (6, up), (10, jolt), (15, up), (20, guard)])


def melee_sword(L):
    """A sword (and a shield): a cut from over the right shoulder down and across (Attack), a thrust
    (Attack2), the shield up (Block), the sword raised (Cheer)."""
    k = L.kit
    R = L.side
    shield = shield_hand(L) if k.shield else L.free(L.other)
    hold = lambda pole=(-1, .3, -.6): L.on(R, pole=pole)  # noqa: E731
    d, f = pitch(38)
    guard = L.key({'Spine': (4, 0, -4), 'Chest': (2, 0, -6)}, W=L.W((-.18, -.20, .70), d, f), hands={R: hold(), L.other: shield})
    d, f = pitch(-58, -10)
    wind = L.key({'Spine': (-2, 0, -12), 'Chest': (-4, 0, -16), 'Head': (2, 0, 12)}, (0, 0, .004), W=L.W((-.18, .02, .95), d, f),
                 hands={R: hold((-1, .4, .2)), L.other: shield})
    d, f = pitch(118, 28)
    cut = L.key({'Hips': (3, 0, 8), 'Spine': (10, 0, 12), 'Chest': (8, 0, 16), 'Head': (-8, 0, -12)}, (0, 0, -.035),
                W=L.W((-.04, -.30, .66), d, f), hands={R: hold((-1, -.2, -.6)), L.other: shield_hand(L, (.19, -.16, .62))}, ease='in')
    d, f = pitch(140, 40)
    follow = L.key({'Hips': (3, 0, 9), 'Spine': (10, 0, 14), 'Chest': (8, 0, 18), 'Head': (-8, 0, -12)}, (0, 0, -.035),
                   W=L.W((.02, -.24, .58), d, f), hands={R: hold((-1, -.2, -.6)), L.other: shield_hand(L, (.19, -.16, .62))}, ease='out')
    a1 = Clip('Attack', 21, False, None, keys=[(1, guard), (7, wind), (11, cut), (12, cut), (15, follow), (21, guard)], events={'contact': 11})
    d, f = pitch(84)
    draw = L.key({'Spine': (0, 0, -10), 'Chest': (-2, 0, -12), 'Head': (0, 0, 10)}, (0, 0, .004), W=L.W((-.19, .01, .70), d, f),
                 hands={R: hold(), L.other: shield})
    d, f = pitch(90)
    thrust = L.key({'Hips': (2, 0, 6), 'Spine': (9, 0, 10), 'Chest': (6, 0, 12), 'Head': (-8, 0, -12)}, (0, 0, -.03),
                   W=L.W((-.10, -.36, .70), d, f), hands={R: hold(), L.other: shield_hand(L, (.19, -.16, .64))}, ease='in')
    a2 = Clip('Attack2', 25, False, None, keys=[(1, guard), (8, draw), (13, thrust), (14, thrust), (19, dict(draw, ease='out')), (25, guard)],
              events={'contact': 13})
    return [a1, a2, block(L, guard, hold), cheer(L)]


def melee_pike(L):
    """A pike in both hands, held near its butt (the right fist slides down the shaft, the left takes it
    in front): levelled at the chest and thrust (Attack), thrust low at the belly (Attack2), angled up
    across the body to parry (Block), raised upright and shaken (Cheer)."""
    P = L.P
    R, O = L.side, L.other
    hr, hl = .26, .52  # the fists' stations from the butt
    turn = {'Hips': (0, 0, -12), 'Spine': (4, 0, -10), 'Chest': (2, 0, -12), 'Head': (0, 0, 30)}
    d, f = pitch(86)
    guard = L.key(turn, W=L.W((-.05, -.02, .74), d, f, h=hr), hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.6, -.2, -1))})
    d, f = pitch(88)
    back = L.key(dict(turn, Spine=(0, 0, -12), Chest=(-2, 0, -14)), (0, 0, .004), W=L.W((-.05, .06, .75), d, f, h=hr),
                 hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.6, -.2, -1))})
    d, f = pitch(90)
    thrust = L.key({'Hips': (4, 0, -6), 'Spine': (10, 0, -4), 'Chest': (6, 0, -6), 'Head': (-10, 0, 20)}, (0, 0, -.035),
                   W=L.W((-.03, -.18, .73), d, f, h=hr), hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.6, -.2, -1))}, ease='in')
    a1 = Clip('Attack', 21, False, None, keys=[(1, guard), (7, back), (11, thrust), (12, thrust), (16, dict(back, ease='out')), (21, guard)],
              events={'contact': 11})
    d, f = pitch(98)
    lowb = L.key(dict(turn, Spine=(2, 0, -12)), (0, 0, -.01), W=L.W((-.05, .05, .64), d, f, h=hr),
                 hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.6, -.2, -1))})
    d, f = pitch(100)
    low = L.key({'Hips': (4, 0, -6), 'Spine': (12, 0, -4), 'Chest': (8, 0, -6), 'Head': (-12, 0, 20)}, (0, 0, -.05),
                W=L.W((-.03, -.17, .62), d, f, h=hr), hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.6, -.2, -1))}, ease='in')
    a2 = Clip('Attack2', 25, False, None, keys=[(1, guard), (8, lowb), (13, low), (14, low), (19, dict(lowb, ease='out')), (25, guard)],
              events={'contact': 13})
    d, f = pitch(40, 18)
    parry = L.key(dict(turn, Chest=(-2, 0, -14), Head=(4, 0, 24)), (0, 0, -.02), W=L.W((-.08, -.06, .66), d, f, h=hr),
                  hands={R: L.on(R, hr, pole=(-1, .5, -.4)), O: L.on(O, hl, pole=(.8, -.3, -.5))})
    blk = Clip('Block', 20, False, None, keys=[(1, guard), (6, parry), (15, parry), (20, guard)])
    return [a1, a2, blk, cheer(L)]


def cheer(L):
    """The weapon raised high in the right fist and shaken twice (a loop); the other arm up a little."""
    P, k = L.P, L.kit
    R = L.side
    d, f = pitch(-8)
    top = 1.01 if k.kind != 'pike' else .94
    hi = L.key({'Spine': (-3, 0, 0), 'Chest': (-6, 0, 0), 'Head': (-12, 0, 0)}, (0, 0, .008), W=L.W((-.19, -.05, top), d, f),
               hands={R: L.on(R, pole=(-1, .3, -.3)), L.other: L.free(L.other) if not k.shield else shield_hand(L, (.18, -.16, .72), -6)})
    d, f = pitch(4)
    lo = L.key({'Spine': (-1, 0, 0), 'Chest': (-1, 0, 0), 'Head': (-4, 0, 0)}, (0, 0, .001), W=L.W((-.21, -.09, top - .15), d, f),
               hands={R: L.on(R, pole=(-1, .3, -.3)), L.other: L.free(L.other) if not k.shield else shield_hand(L, (.18, -.16, .66), -6)})
    return Clip('Cheer', 33, True, None, keys=[(1, lo), (9, hi), (17, lo), (25, hi), (33, lo)])


MELEE = {'spear': melee_spear, 'sword': melee_sword, 'pike': melee_pike}


# ---- bows -----------------------------------------------------------------------------------------------

def bow_draw(L):
    """Draw-aim-release: from the rest pose, the bow comes up and out in the left fist while the body
    turns side on, the right fist draws the arrow to the cheek (the Bronze string follows it), holds,
    looses (release: the arrow is hidden from that frame, the game flies it), takes a new arrow from the
    quiver (back or hip), nocks it and comes back to rest."""
    P, k = L.P, L.kit
    B, A = L.side, L.other  # the bow hand and the arrow hand
    side_on = {'Hips': (0, 0, -14), 'Spine': (0, 0, -10), 'Chest': (-2, 0, -10), 'Head': (-2, 0, 34)}
    bow_at = V((.10, -.30, .82))
    d, f = pitch(-6, 0)
    Wb = L.W(bow_at, d, f)

    def arrow(p, show=1, string=0., r=None, root=(0, 0, 0), W=None, ease=None, bowp=None):
        wb = W or Wb
        at = V(wb['at'])
        ad = nrm(at - V(p))
        spec = L.key(r or side_on, root, W=wb, hands={B: L.on(B, pole=(1, .2, -.5)), A: L.free(A, p=p, d=ad, f=(0, 0, -1), pole=(-1, .9, -.1))},
                     ease=ease, show={'Arrow': show})
        if k.string:
            spec['string'] = string
        return spec
    r0 = L.rest()
    nock = arrow((.06, -.14, .76), r={'Hips': (0, 0, -8), 'Spine': (0, 0, -6), 'Chest': (0, 0, -6), 'Head': (0, 0, 20)},
                 W=L.W((.14, -.26, .74), *pitch(-4)))
    draw = arrow((-.03, .00, .86), string=1., root=(0, 0, .004))
    loose = arrow((-.08, .05, .87), show=0, string=0., root=(0, 0, .004), ease='out')
    reach = (-.11, .12, .92) if k.quiver == 'back' else (-.14, -.02, .58)
    fetch = L.key({'Spine': (0, 0, -4), 'Chest': (0, 0, -4), 'Head': (0, 0, 10)}, W=L.W((.17, -.20, .66), *pitch(-2)),
                  hands={B: L.on(B), A: L.free(A, p=reach, d=(0, -.2, 1) if k.quiver == 'back' else (0, -.3, -1), f=(0, -1, 0), pole=(-1, .6, -.2))},
                  show={'Arrow': 0})
    if k.string:
        fetch['string'] = 0
    got = dict(fetch, show={'Arrow': 1})
    keys = [(1, r0), (7, nock), (16, draw), (21, draw), (22, loose), (25, dict(loose, ease='lin')), (28, fetch), (29, got), (33, dict(r0, ease='io'))]
    return Clip('Draw-aim-release', 33, False, 'Arrow' if k.arrow else None, keys=keys, events={'release': 22})


def bow_melee(L):
    """Melee-fallback: the arrow (or the empty fist) stabbed down and forward, the bow held aside."""
    k = L.kit
    B, A = L.side, L.other
    r0 = L.rest()
    up = L.key({'Spine': (-2, 0, -8), 'Chest': (-4, 0, -12), 'Head': (2, 0, 10)}, (0, 0, .004), W=L.W((.20, -.14, .66), *pitch(-8)),
               hands={B: L.on(B), A: L.free(A, p=(-.17, .02, .90), d=(0, -.6, -.8), f=(0, .8, -.6), pole=(-1, .6, .3))})
    hit = L.key({'Hips': (2, 0, 6), 'Spine': (9, 0, 10), 'Chest': (6, 0, 12), 'Head': (-8, 0, -10)}, (0, 0, -.03), W=L.W((.21, -.10, .62), *pitch(-8)),
                hands={B: L.on(B), A: L.free(A, p=(-.08, -.30, .70), d=(0, -.7, -.7), f=(0, .7, -.7), pole=(-1, .3, -.6))}, ease='in')
    for s in (up, hit):
        s['show'] = {'Arrow': 1}
    keys = [(1, r0), (6, up), (11, hit), (12, hit), (16, dict(up, ease='out')), (20, r0)]
    return Clip('Melee-fallback', 20, False, 'Arrow' if k.arrow else None, keys=keys, events={'contact': 11})


# ---- guns ----------------------------------------------------------------------------------------------------

def gun_fire(L):
    """Aim-fire-reload. Muzzle-loaders (Gunpowder): present (the butt in the right shoulder, the right
    fist at the stock's wrist, the left under the fore-stock, side on), fire, the kick, the musket
    brought down upright in front in the left hand, the right fetches a cartridge from the hip, pours,
    rams twice at the muzzle (reloaded), back to the order. Modern rifles: shouldered, fire, the kick,
    the left hand swaps the magazine (reloaded), back to rest."""
    P, k = L.P, L.kit
    R, O = L.side, L.other
    modern = P.length < .75
    r0 = L.rest()
    aim_r = {'Hips': (0, 0, -16), 'Spine': (3, 0, -12), 'Chest': (2, 0, -12), 'Head': (8, 0, 38)}
    if modern:
        hw, hf = P.h0, P.h0 + .17  # the pistol grip, the handguard
        d, f = pitch(90)
        aim = L.key(aim_r, W=L.W((-.06, -.13, .78), d, f, h=hw), hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)})
        kick = L.key(dict(aim_r, Chest=(-2, 0, -12), Head=(4, 0, 38)), (0, 0, .003), W=L.W((-.06, -.11, .79), *pitch(84), h=hw),
                     hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)}, ease='out')
        low_r = {'Spine': (4, 0, -6), 'Chest': (4, 0, -6), 'Head': (-14, 0, 14)}
        low = L.key(low_r, W=L.W((-.08, -.16, .64), *pitch(60, 10), h=hw), hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)})
        mag = (-.0, -.20, .60)
        pouch = L.key(low_r, W=low['W'], hands={'R': on_station(L, 'R', hw), 'L': L.free('L', p=(.05, -.13, .60), d=(0, 0, 1), f=(0, -1, 0), pole=(1, .2, -.8))})
        seat = L.key(low_r, W=low['W'], hands={'R': on_station(L, 'R', hw), 'L': L.free('L', p=mag, d=(0, 0, 1), f=(0, -1, 0), pole=(1, .2, -.8))})
        keys = [(1, r0), (6, aim), (8, aim), (9, kick), (11, aim), (16, low), (20, dict(pouch, ease='out')), (26, pouch), (31, seat),
                (32, seat), (34, low), (40, dict(r0, ease='io'))]
        return Clip('Aim-fire-reload', 40, False, None, keys=keys, events={'fire': 8, 'reloaded': 32})
    hw, hf = .24, .40  # the stock's wrist, the fore-stock
    d, f = pitch(90, 0, 180)  # level, the barrel on top
    aim = L.key(aim_r, W=L.W((-.07, -.14, .78), d, f, h=hw), hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)})
    kick = L.key(dict(aim_r, Chest=(-3, 0, -12), Head=(4, 0, 38)), (0, 0, .004), W=L.W((-.07, -.11, .80), *pitch(80, 0, 180), h=hw),
                 hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)}, ease='out')
    # loading: the musket upright in front of the left hip, its butt on the ground, held in the left fist
    up_w = L.W((.03, -.17, .012), *pitch(-2, 0, 180), h=0)
    hold_l = L.on('L', .60, pole=(1, .3, -.6))
    load_r = {'Spine': (4, 0, 6), 'Chest': (3, 0, 6), 'Head': (-12, 0, -8)}

    def rh(p, d=(0, 0, 1)):
        return L.free('R', p=p, d=d, f=(0, -1, 0), pole=(-1, .5, -.5), on=hw, w=0.)
    box = (-.12, -.02, .52)
    muzzle = V(up_w['at']) + V(up_w['d']) * (P.length + .02)
    lower = L.key(load_r, W=up_w, hands={'L': hold_l, 'R': rh((-.02, -.24, .70))})
    fetch = L.key(load_r, W=up_w, hands={'L': hold_l, 'R': rh(box, (0, -1, 0))})
    pour = L.key(load_r, W=up_w, hands={'L': hold_l, 'R': rh(muzzle + V((-.02, .03, .02)), (0, -1, 0))})
    ram_up = L.key(load_r, W=up_w, hands={'L': hold_l, 'R': rh(muzzle + V((-.01, .02, .10)))})
    ram_dn = L.key(load_r, W=up_w, hands={'L': hold_l, 'R': rh(muzzle + V((-.01, .02, .03)))})
    keys = [(1, r0), (8, aim), (10, aim), (11, kick), (14, aim), (19, lower), (23, fetch), (27, pour), (31, ram_up), (33, ram_dn),
            (35, ram_up), (37, ram_dn), (40, lower), (44, lower), (50, dict(r0, ease='io'))]
    return Clip('Aim-fire-reload', 50, False, None, keys=keys, events={'fire': 10, 'reloaded': 40})


def on_station(L, s, station):
    return L.on(s, station, pole=(-1, .6, -.5) if s == 'R' else (1, -.2, -1))


def gun_melee(L):
    """Melee-fallback: with a bayonet, the gun levelled at the hip and thrust; without, the butt swung
    up and driven forward at head height."""
    P, k = L.P, L.kit
    r0 = L.rest()
    if k.bayonet:
        hw, hf = .24, .46
        d, f = pitch(80, 0, 180)
        guard = L.key({'Hips': (0, 0, -10), 'Spine': (4, 0, -8), 'Chest': (2, 0, -8), 'Head': (0, 0, 22)}, (0, 0, -.01),
                      W=L.W((-.08, .02, .62), d, f, h=hw), hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)})
        d, f = pitch(86, 0, 180)
        thrust = L.key({'Hips': (4, 0, -4), 'Spine': (10, 0, -2), 'Chest': (6, 0, -2), 'Head': (-10, 0, 12)}, (0, 0, -.04),
                       W=L.W((-.05, -.16, .64), d, f, h=hw), hands={'R': on_station(L, 'R', hw), 'L': on_station(L, 'L', hf)}, ease='in')
        keys = [(1, r0), (6, guard), (11, thrust), (12, thrust), (16, dict(guard, ease='out')), (20, r0)]
        return Clip('Melee-fallback', 20, False, None, keys=keys, events={'contact': 11})
    modern = P.length < .75
    hb, ht = (P.h0, P.h0 + .17) if modern else (.30, .52)
    d, f = pitch(-150, 0, 0 if modern else 180)  # upside down: the butt up and forward
    wind = L.key({'Spine': (-2, 0, -10), 'Chest': (-4, 0, -12), 'Head': (2, 0, 10)}, (0, 0, .004), W=L.W((-.12, .04, .78), d, f, h=hb),
                 hands={'R': on_station(L, 'R', hb), 'L': on_station(L, 'L', ht)})
    d, f = pitch(-120, 0, 0 if modern else 180)
    strike = L.key({'Hips': (3, 0, 6), 'Spine': (10, 0, 10), 'Chest': (6, 0, 12), 'Head': (-8, 0, -10)}, (0, 0, -.03),
                   W=L.W((-.06, -.24, .80), d, f, h=hb), hands={'R': on_station(L, 'R', hb), 'L': on_station(L, 'L', ht)}, ease='in')
    keys = [(1, r0), (7, wind), (11, strike), (12, strike), (16, dict(wind, ease='out')), (20, r0)]
    return Clip('Melee-fallback', 20, False, None, keys=keys, events={'contact': 11})


# ---- support ---------------------------------------------------------------------------------------------------

def support(L):
    """The worker clips whose tool the engineer carries: Mine (a pick: lifted over the shoulder and
    driven into the ground in front), Build and Repair (the pick or the maul at a stake or a wall; the
    spade dug in, levered and the earth thrown aside). A mantlet on the left arm stays where it is."""
    P, k = L.P, L.kit
    R, O = 'R', 'L'
    r0 = L.rest()
    hr = .16  # the right fist near the haft's end
    out = []
    if k.tool in ('pick', 'maul'):
        def swing(name, frames, contact, low, crouch, heavy):
            hl = hr + .14
            two = not k.still
            left = (lambda: L.on(O, hl, pole=(1, .3, -.6))) if two else (lambda: L.free(O))
            rd = {'Spine': (4 + crouch * 50, 0, -4), 'Chest': (2 + crouch * 30, 0, -6)}
            d, f = pitch(60)
            ready = L.key(rd, (0, 0, -crouch), W=L.W((-.16, -.18, .64), d, f, h=hr), hands={R: L.on(R, hr), O: left()})
            d, f = pitch(-40 if heavy else -20)
            up = L.key({'Spine': (-3 + crouch * 50, 0, -8), 'Chest': (-6 + crouch * 30, 0, -12), 'Head': (6, 0, 6)}, (0, 0, -crouch + .004),
                       W=L.W((-.16, .02, .96 - crouch), d, f, h=hr), hands={R: L.on(R, hr, pole=(-1, .5, .3)), O: left()})
            d, f = pitch(low)
            hit = L.key({'Hips': (4, 0, 2), 'Spine': (12 + crouch * 50, 0, 6), 'Chest': (10 + crouch * 30, 0, 8), 'Head': (-12, 0, 0)},
                        (0, 0, -.05 - crouch), W=L.W((-.10, -.26, .62 - crouch * .8), d, f, h=hr), hands={R: L.on(R, hr), O: left()}, ease='in')
            d, f = pitch(low - 30)
            lever = L.key({'Spine': (9 + crouch * 50, 0, 2), 'Chest': (8 + crouch * 30, 0, 2), 'Head': (-8, 0, 0)}, (0, 0, -.04 - crouch),
                          W=L.W((-.12, -.22, .68 - crouch * .8), d, f, h=hr), hands={R: L.on(R, hr), O: left()}, ease='out')
            keys = [(1, r0), (4, ready), (contact - 6, up), (contact, hit), (contact + 1, hit), (contact + 5, lever), (frames - 3, ready), (frames, r0)]
            return Clip(name, frames, True, None, keys=keys, events={'contact': contact})
        if k.tool == 'pick':
            out.append(swing('Mine', 29, 15, 128, 0., True))
            out.append(swing('Build', 25, 15, 112, 0., False))
            out.append(swing('Repair', 21, 11, 120, .06, False))
        else:
            out.append(swing('Build', 25, 15, 150, 0., True))
            out.append(swing('Repair', 21, 11, 140, .06, False))
        return out
    # the spade: both hands on the haft, the blade driven down in front, levered, the earth thrown aside
    ht, hl = P.length - .02, P.h0 + .02  # the handle (top), the lower hand
    rd = {'Spine': (6, 0, -4), 'Chest': (4, 0, -4)}

    def dig(name, frames, contact, crouch):
        d, f = pitch(160, 0, 180)
        ready = L.key(rd, (0, 0, -crouch), W=L.W((-.05, -.30, .14), d, f, h=0), hands={R: L.on(R, ht, pole=(-1, .3, -.5)), O: L.on(O, hl, pole=(1, .3, -.6))})
        d, f = pitch(172, 0, 180)
        push = L.key({'Hips': (4, 0, 0), 'Spine': (12, 0, -2), 'Chest': (8, 0, -2), 'Head': (-10, 0, 0)}, (0, 0, -.05 - crouch),
                     W=L.W((-.05, -.30, .02), d, f, h=0), hands={R: L.on(R, ht, pole=(-1, .3, -.5)), O: L.on(O, hl, pole=(1, .3, -.6))}, ease='in')
        d, f = pitch(120, 0, 180)
        lever = L.key({'Hips': (6, 0, 0), 'Spine': (16, 0, 0), 'Chest': (10, 0, 0), 'Head': (-12, 0, 0)}, (0, 0, -.07 - crouch),
                      W=L.W((-.05, -.32, .08), d, f, h=0), hands={R: L.on(R, ht, pole=(-1, .3, -.5)), O: L.on(O, hl, pole=(1, .3, -.6))})
        d, f = pitch(100, 50, 180)
        toss = L.key({'Hips': (2, 0, 10), 'Spine': (6, 0, 14), 'Chest': (4, 0, 16), 'Head': (-6, 0, 10)}, (0, 0, -.03 - crouch),
                     W=L.W((.10, -.30, .34), d, f, h=0), hands={R: L.on(R, ht, pole=(-1, .3, -.5)), O: L.on(O, hl, pole=(1, .3, -.6))}, ease='out')
        keys = [(1, r0), (4, ready), (contact, push), (contact + 1, push), (contact + 5, lever), (frames - 5, toss), (frames - 2, ready), (frames, r0)]
        return Clip(name, frames, True, None, keys=keys, events={'contact': contact})
    out.append(dig('Build', 25, 13, 0.))
    out.append(dig('Repair', 21, 10, .05))
    return out


# ---- one call from a builder ---------------------------------------------------------------------------

def author(kit, arm=None, meshes=None):
    """Author the unit's clips (after its rest pose, normals and baked shade are final): the arrow bone,
    the poser, every clip, the floor pass over the body (the weapons may dip into the ground; the body
    never does). Returns (table, order)."""
    arm = arm or F.arm
    meshes = meshes if meshes is not None else F.meshes
    if kit.arrow:
        add_arrow_bone(arm, kit, meshes)
    P = FootPoser(arm, kit, meshes)
    A = FootAuthor(arm, P, meshes, kit)
    bpy.context.scene.render.fps = FPS
    lib = Lib(P, kit)
    table = A.run(lib.clips())
    body = [m for m in meshes if not m.get('attachment')]
    floor = u.ground_actions(arm, body)
    arm.animation_data.action = bpy.data.actions['Idle']
    bpy.context.scene.frame_set(1)
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    worst = sorted(((round(e, 4), c, s) for (c, s), e in A.reach.items()), reverse=True)[:8]
    print('REACH (largest misses: clip, hand)', json.dumps(worst), flush=True)
    print('STATIONS h0 %.3f length %.3f other %.3f' % (P.h0, P.length, P.s_other), flush=True)
    arm['archetype'] = kit.archetype
    return table, SETS[kit.archetype], floor


def sheets(uid, table, arm, kit, view='game'):
    dest = u.REPO / 'plans' / 'art-pilot' / 'foot-clips'
    if os.environ.get('TI_SHEETS_DIR'):  # elsewhere (a relative path is from the repository)
        dest = u.REPO / os.environ['TI_SHEETS_DIR']
    dest.mkdir(parents=True, exist_ok=True)
    big = kit.kind == 'pike'
    return C.render_sheets(dest, uid, table, arm, view=view, sheets=SHEETS[kit.archetype], ortho=2.6 if big else 1.8, aim=(0, -.35, .6) if big else (0, -.2, .5))


def clips_hook(uid, kit):
    """For F.finish_rest / F.finish_unit (clips=): authors the clips after the shade bake and renders the
    contact sheets after the export when TI_SHEETS is set (TI_SHEETS=side: a side view too)."""
    state = {}

    def run():
        table, order, floor = author(kit)
        state['table'] = table
        return table, order

    def after():
        if os.environ.get('TI_SHEETS'):
            sheets(uid, state['table'], F.arm, kit)
            if os.environ.get('TI_SHEETS') == 'side':
                sheets(uid, state['table'], F.arm, kit, view='side')
    return run, after
