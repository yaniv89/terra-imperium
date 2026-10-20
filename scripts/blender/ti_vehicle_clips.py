# scripts/blender/ti_vehicle_clips.py
# Authored battle clips for the Modern vehicles and their crews, to the contract of
# plans/art/clip-animation-pipeline.md section 7 (7.4: what the code session must know), over the machinery of
# ti_mounted_clips.py (several rigs in one file, one glTF animation per clip, carried crews):
#   - the vehicle rigs of ti_mounts.py: the tank (Hull, Track_L/R, Turret, Barrel; road wheels moved here to
#     bones of their own, RoadWheel_<side><k>, children of the tracks, so they can turn) and the wheeled rig
#     (Hull, Wheel_<axle>_<side>, optional Turret and Barrel)
#   - Move: the wheels (or the road wheels) turn a whole number of times a loop at the vehicle's natural ground
#     speed (written in the options file's notes and the LOG in tiles a second), the hull rides its suspension;
#     the wheels' centres stay where they stand (the hull moves over them), so nothing sinks into the ground
#   - Fire: the barrel recoils along its bore and runs out again (a translation of the Barrel bone only), the
#     hull rocks; the event `fire` is the shot. Turret and Barrel are NEVER rotated: the Turret bone is not keyed
#     at all and the Barrel bone only in location, so the game's own aim (yaw, pitch) stays free
#   - Hit: a jolt; Wreck: the burnt hulk settles (the hull drops onto its wheels with a list, a wheel splayed),
#     its crew thrown off or slumped where they are; settle on the last frame
#   - crews keep the person rig: Idle, the vehicle's other clips, and Death (the crew killed, the vehicle
#     standing)
# 20 fps, in place, loops closed, Idle frame 1 is the rest pose of every rig, exactly. Blender Z up, front -Y.
import bpy, math, os, json
from mathutils import Vector, Matrix, Quaternion, Euler
import ti_units as u
import ti_clips as C
import ti_foot_clips as FC
import ti_mounted_clips as MC
from ti_clips import Clip, nrm, upd, FPS, spec_at

V = Vector
TILES_PER_H = .95  # unitModels.js ART_UNIT_WORLD


def acts(fire_frames, fire_at, move_frames, crew=True):
    t = {'Idle': (41, True, {}), 'Move': (move_frames, True, {}), 'Fire': (fire_frames, False, {'fire': fire_at}),
         'Hit': (10, False, {}), 'Wreck': (40, False, {'settle': 40})}
    if crew:
        t['Death'] = (40, False, {'settle': 40})
    return t


ORDER = ('Idle', 'Move', 'Fire', 'Hit', 'Death', 'Wreck')
SHEETS = {'moving': ['Idle', 'Move', 'Hit'], 'combat': ['Fire', 'Death', 'Wreck']}


# ---- the vehicle ---------------------------------------------------------------------------------------------

def add_road_wheel_bones(rig, prefix='Tank'):
    """The tank's road wheels (<prefix>Wheel<side><k> and their hubs, on Track_<side>) move to bones of their own,
    RoadWheel_<side><k>, children of the tracks at each wheel's centre (the same place, the same limb in the
    battle's bake: the body). Returns the bone names."""
    centres = {}
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or ob.parent != rig or not ob.name.startswith(prefix + 'Wheel') or ob.name.endswith('Hub'):
            continue
        side, k = ob.name[len(prefix) + 5], ob.name[len(prefix) + 6:]
        vs = [rig.matrix_world.inverted() @ ob.matrix_world @ v.co for v in ob.data.vertices]
        c = sum(vs, V()) / len(vs)
        centres[(side, k)] = (c, [ob.name, ob.name + 'Hub'])
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    names = []
    for (side, k), (c, _) in sorted(centres.items()):
        b = rig.data.edit_bones.new(f'RoadWheel_{side}{k}')
        b.head, b.tail, b.roll = c, c + V((.06 if side == 'L' else -.06, 0, 0)), 0
        b.parent = rig.data.edit_bones[f'Track_{side}']
        names.append(b.name)
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    for (side, k), (c, obs) in centres.items():
        for n in obs:
            ob = bpy.data.objects.get(n)
            if ob is None:
                continue
            g = ob.vertex_groups.get(f'Track_{side}')
            assert g, n
            g.name = f'RoadWheel_{side}{k}'
    return names


class Vehicle:
    """A vehicle rig posed from a spec: bob, pitch, roll (degrees; the hull about the middle of its axles, the
    wheels' centres kept where they stand), spin (degrees, every rolling wheel), camber {bone: degrees}
    (a wheel splayed in the Wreck), recoil (the barrel's travel back along its bore)."""

    def __init__(self, rig, wheels, bore=None, barrel='Barrel'):
        self.rig = rig
        B = rig.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in B}
        self.wheels = list(wheels)          # bones that roll
        self.fixed = [b.name for b in B if b.name.startswith(('Wheel_', 'Track_'))]  # kept on the ground
        ys = [B[w].head_local.y for w in self.fixed] or [0]
        zs = [B[w].head_local.z for w in self.fixed] or [B['Hull'].head_local.z]
        self.pivot = V((0, (min(ys) + max(ys)) / 2, sum(zs) / len(zs)))
        self.radius = {w: B[w].head_local.z for w in self.wheels}
        self.barrel = barrel if barrel in B else None
        self.bore = nrm(V(bore)) if bore is not None else None
        self.D = Matrix.Identity(4)

    def pb(self, n):
        return self.rig.pose.bones[n]

    def pose(self, s):
        MC.reset(self.rig)
        if s is None:
            upd()
            self.D = Matrix.Identity(4)
            return
        R = Euler((math.radians(s.get('pitch', 0)), math.radians(s.get('roll', 0)), 0), 'XYZ').to_matrix().to_4x4()
        slide = V((0, s.get('slide', 0), 0))  # a towed gun rolling back on its wheels at the shot (2026-10-20)
        D = Matrix.Translation(self.pivot + slide + V((0, 0, s.get('bob', 0)))) @ R @ Matrix.Translation(-self.pivot)
        self.pb('Hull').matrix = D @ self.rest['Hull']
        upd()
        R3 = D.to_3x3()
        axle = nrm(R3 @ V((1, 0, 0)))
        spin = math.radians(s.get('spin', 0))
        camber = s.get('camber', {})
        for w in self.fixed:  # the wheel or the track stays where it stands, turned with the hull
            rest = self.rest[w]
            Rw = R3 @ rest.to_3x3()
            if w in camber:
                Rw = Matrix.Rotation(math.radians(camber[w]), 3, nrm(R3 @ V((0, 1, 0)))) @ Rw
            if w in self.wheels and spin:
                Rw = Matrix.Rotation(spin, 3, axle) @ Rw
            self.pb(w).matrix = Matrix.Translation(rest.translation + slide) @ Rw.to_4x4()
            upd()
        for w in self.wheels:  # road wheels on a track: they turn on their own bone
            if w in self.fixed or not spin:
                continue
            u.rotate_world(self.rig, w, (math.degrees(spin), 0, 0))
        upd()
        if 'Beam' in self.rig.data.bones:  # a trebuchet's arm about its axle, its stone hidden once loosed
            u.rotate_world(self.rig, 'Beam', (s.get('beam', 0), 0, 0))  # (positive: the long arm rises over the top)
            self.pb('Tool_Stone').scale = (1, 1, 1) if s.get('stone', 1) > .5 else (0, 0, 0)
            upd()
        d = s.get('recoil', 0)
        if self.barrel and self.bore is not None and abs(d) > 1e-6:
            self.pb(self.barrel).location = self.rest[self.barrel].to_3x3().inverted() @ (-self.bore * d)
            upd()
        self.D = self.pb('Hull').matrix @ self.rest['Hull'].inverted()


def move_spec(T, revs, bob=.004, pitch=.35):
    def fn(f):
        ph = ((f - 1) % T) / T
        return {'spin': 360 * revs * ph, 'bob': -bob * .5 + bob * .5 * math.cos(2 * math.pi * 2 * ph), 'pitch': pitch * math.sin(2 * math.pi * ph)}
    return fn


def idle_spec(shudder=.0012):
    def fn(f):
        if f in (1, 41):
            return None
        return {'bob': shudder * math.sin(2 * math.pi * (f - 1) / 4), 'pitch': .05 * math.sin(2 * math.pi * (f - 1) / 20)}
    return fn


def keyed(keys):
    return lambda f: spec_at(keys, f)


HIT = [(1, {}), (3, {'roll': 1.6, 'pitch': -.8, 'bob': .006, 'ease': 'out'}), (6, {'roll': -.6, 'pitch': .3}), (10, {})]


def wreck(splay=None, drop=.045, roll=3.5, pitch=1.6):
    """The hulk: the blast lifts the hull, it drops lower than it stood with a list (a wheel splayed)."""
    cam = {splay: 0.} if splay else {}
    up = {'bob': .03, 'pitch': -2.5, 'roll': -1.0, 'camber': dict(cam), 'ease': 'out'}
    down = {'bob': -drop, 'pitch': pitch, 'roll': roll, 'camber': {k: 22. for k in cam}, 'ease': 'in'}
    bounce = dict(down, bob=-drop * .8, roll=roll * .85, ease='out')
    return [(1, {'camber': dict(cam)}), (4, up), (12, down), (16, bounce), (22, down), (40, down)]


def recoil_keys(at, travel, frames, rock=1.2):
    """The shot at `at`: the barrel back `travel` along its bore at once, run out again over ten frames; the
    hull rocks back (nose up) and settles."""
    return [(1, {}), (at - 1, {}), (at, {'recoil': travel, 'pitch': -rock, 'bob': .004, 'ease': 'out'}),
            (at + 3, {'recoil': travel * .8, 'pitch': rock * .35}), (at + 10, {'recoil': 0, 'pitch': -.1}), (frames, {})]


def burst_keys(at, shots, gap, travel, frames):
    """A burst of `shots` (an automatic gun): the barrel kicks back on every shot."""
    k = [(1, {}), (at - 1, {})]
    for i in range(shots):
        f = at + i * gap
        k += [(f, {'recoil': travel, 'pitch': -.3, 'bob': .002, 'ease': 'out'}), (f + gap // 2, {'recoil': travel * .2, 'pitch': -.1})]
    k += [(at + shots * gap + 2, {}), (frames, {})]
    return k


# ---- crews ---------------------------------------------------------------------------------------------------

def crew_person(arm, kit=None):
    return MC.Person(arm, kit or FC.Kit('sword'), weapon=False)


def standing_crew(per, table, fire=None, death='slump', side=-1, carried=True, fall=None, dy=0.):
    """A standing crewman's clips (FK: the torso and the legs, the hands ride on the arms): Idle, Move (riding
    with bent knees, or walking when he is on foot), Fire (his own keys or a flinch), Hit, Death and Wreck:
    'slump' (he crumples where he stands) or 'thrown' (over the side `side`: -1 his right, 1 his left; he
    falls to the ground beside the vehicle)."""
    L = FC.Lib(per.P, per.kit)
    out = {}
    for act, (frames, loop, events) in table.items():
        if act == 'Idle':
            out[act] = Clip(act, frames, loop, None, keys=[(1, {}), (21, {'r': {'Chest': (0, 0, -2), 'Head': (-2, 0, 7), 'Spine': (.6, 0, 0)}, 'plant': 1}), (41, {})])
        elif act == 'Move':
            if carried:
                T = frames - 1

                def fn(f, T=T):
                    ph = ((f - 1) % T) / T
                    return {'r': {'Spine': (3, 0, 0), 'Head': (-3, 0, 0)}, 'root': (0, 0, -.012 + .004 * math.cos(2 * math.pi * 2 * ph)), 'plant': 1}
                out[act] = Clip(act, frames, loop, None, fn=fn)
            else:
                g = L.gait('Move', (frames - 1) // 2, 19, 42, 2)
                out[act] = Clip(act, frames, loop, None, fn=g.fn, ground='feet')
        elif act == 'Fire':
            if fire:
                out[act] = Clip(act, frames, loop, None, keys=fire, events=events)
            else:
                at = events['fire']
                flinch = {'r': {'Spine': (-3, 0, 0), 'Chest': (-4, 0, 0), 'Head': (-8, 0, 6)}, 'root': (0, 0, -.01), 'plant': 1, 'ease': 'out'}
                out[act] = Clip(act, frames, loop, None, keys=[(1, {}), (at, {}), (at + 2, flinch), (at + 6, dict(flinch, root=(0, 0, -.005))), (frames, {})], events=events)
        elif act == 'Hit':
            a = {'r': {'Spine': (-6, 0, -4), 'Chest': (-12, 0, -8), 'Head': (-12, 0, 6)}, 'root': (0, 0, -.015), 'plant': 1, 'ease': 'out'}
            out[act] = Clip(act, frames, loop, None, keys=[(1, {}), (4, a), (6, a), (10, {})])
        elif act in ('Death', 'Wreck'):
            out[act] = crew_death(L, act, frames, events, death, side, carried, fall, dy)
    return out


def crew_death(L, act, frames, events, how, side, carried, fall=None, dy=0.):
    if how == 'slump':  # he crumples where he stands: the knees give, he folds over and slides down
        k = [(1, {}), (5, {'r': {'Spine': (-8, 0, 4), 'Chest': (-12, 0, 6), 'Head': (-14, 0, 0)}, 'plant': 1, 'ease': 'out'}),
             (16, {'r': {'Spine': (30, 0, 8), 'Chest': (20, 0, 4), 'Head': (24, 0, 0), 'Arm_L': (-10, 0, -10), 'Arm_R': (-10, 0, 10)}, 'root': (0, 0, -.22), 'plant': 1, 'ease': 'in'}),
             (24, {'r': {'Spine': (44, 0, 10), 'Chest': (24, 0, 6), 'Head': (30, 0, 8), 'Arm_L': (-6, 0, -16), 'Arm_R': (-6, 0, 16)}, 'root': (0, 0, -.34), 'plant': 1}),
             (28, {'r': {'Spine': (40, 0, 10), 'Chest': (22, 0, 6), 'Head': (28, 0, 8), 'Arm_L': (-6, 0, -16), 'Arm_R': (-6, 0, 16)}, 'root': (0, 0, -.32), 'plant': 1, 'ease': 'out'}),
             (frames, {'r': {'Spine': (44, 0, 10), 'Chest': (24, 0, 6), 'Head': (32, 0, 12), 'Arm_L': (-6, 0, -16), 'Arm_R': (-6, 0, 16)}, 'root': (0, 0, -.34), 'plant': 1})]
        return Clip(act, frames, False, None, keys=k, events=events)
    if how == 'seated':  # the driver slumps forward in his seat
        k = [(1, {}), (5, {'r': {'Spine': (-8, 0, 0), 'Chest': (-12, 0, 0), 'Head': (-16, 0, 0)}, 'ease': 'out'}),
             (18, {'r': {'Spine': (30, 0, 6), 'Chest': (18, 0, 4), 'Head': (30, 0, 10)}, 'ease': 'in'}),
             (24, {'r': {'Spine': (34, 0, 8), 'Chest': (20, 0, 4), 'Head': (36, 0, 14)}}), (frames, {'r': {'Spine': (34, 0, 8), 'Chest': (20, 0, 4), 'Head': (36, 0, 14)}})]
        return Clip(act, frames, False, None, keys=k, events=events)
    # thrown or fallen: the foot soldiers' fall (forward, `fall` 1, or backward, -1) out to `side` (and `dy` back),
    # on the ground
    c = MC.retime(L.death(act, fall or (1 if side > 0 else -1)), frames, act, events=events)
    keys = []
    for f, s in c.keys:
        z = V(s.get('root', (0, 0, 0))).z
        t = min(1, max(0, (f - 4) / 14)) ** .8 if carried else min(1, max(0, (f - 3) / 14)) ** .8 * .3
        keys.append((f, dict(s, root=(side * (.5 if carried else .5) * t, dy * t, z), ground=1 if f >= 16 else 0)))
    c.keys = keys
    return c


# ---- the units ---------------------------------------------------------------------------------------------

def run(uid, parts, table, vehicle, vspecs, crews, archetype):
    """Pose the vehicle (`vspecs`: act -> spec function) and its crews ([(person, clips, carried, freeze)]),
    one action per rig per clip; the Turret is left unkeyed and the Barrel keyed in location only."""
    unit = MC.Unit(archetype, [a for a in ORDER if a in table], table)
    rig = vehicle.rig
    state = {}

    def pose_vehicle(act, f):
        vehicle.pose(None if (act == 'Idle' and f in (1, table[act][0])) else vspecs[act](f))
        state['D'] = rig.matrix_world @ vehicle.D @ rig.matrix_world.inverted()
    skip = {'Turret'} if 'Turret' in rig.data.bones else set()
    unit.add(rig, pose_vehicle, skip=skip, loc_only={'Barrel'} if 'Barrel' in rig.data.bones else set())
    for per, clips, carried, thrown_at in crews:
        M = per.arm.matrix_world.copy()

        def pose(act, f, per=per, clips=clips, carried=carried, thrown_at=thrown_at, M=M):
            clip = clips[act]
            spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
            if not carried:
                per.A.pose(clip, spec, f)
                return
            D = state['D']
            if thrown_at and act in ('Death', 'Wreck') and f >= thrown_at:  # he leaves the vehicle: frozen there
                key = ('Dk', per.arm.name)
                if f == thrown_at:
                    state[key] = D
                D = state[key]
            per.pose(clip, spec, f, M.inverted() @ D @ M)
        unit.add(per.arm, pose, lambda act, per=per, clips=clips: per.begin(clips[act]))
    bpy.context.scene.render.fps = FPS
    out = unit.run()
    for per, *_ in crews:
        print('CREW', per.arm.name, flush=True)
    MC.set_clip('Idle', 1)
    return out, unit.acts


def natural(vehicle, T, revs):
    """The ground speed (H/s, tiles/s) of a Move loop of T frames turning the wheels `revs` times."""
    r = max(vehicle.radius.values()) if vehicle.radius else .15
    hs = 2 * math.pi * r * revs / (T / FPS)
    return round(hs, 2), round(hs * TILES_PER_H, 2)


def tank(parts):
    rig = parts[0]
    wheels = add_road_wheel_bones(rig, 'Tank')
    B = rig.data.bones
    bore = B['Barrel'].tail_local - B['Barrel'].head_local
    v = Vehicle(rig, wheels, bore=bore)
    T, revs = 18, 3
    table = acts(30, 8, T + 1, crew=False)
    specs = {'Idle': idle_spec(), 'Move': move_spec(T, revs, bob=.005, pitch=.4), 'Fire': keyed(recoil_keys(8, .11, 30, rock=1.4)), 'Hit': keyed(HIT),
             'Wreck': keyed(wreck(None, drop=.035, roll=3, pitch=1.2))}
    out = run('modern-cavalry', parts, table, v, specs, [], 'vehicle')
    print('NATURAL modern-cavalry', natural(v, T, revs), flush=True)
    return out


def aa_truck(parts):
    rig, gunner = parts[0], parts[1]
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    v = Vehicle(rig, wheels, bore=(0, -math.cos(math.radians(38)), math.sin(math.radians(38))))
    T, revs = 20, 1
    table = acts(30, 8, T + 1)
    specs = {'Idle': idle_spec(), 'Move': move_spec(T, revs, bob=.006, pitch=.4), 'Fire': keyed(burst_keys(8, 5, 3, .045, 30)), 'Hit': keyed(HIT), 'Death': lambda f: {},
             'Wreck': keyed(wreck('Wheel_F_L', drop=.05, roll=3.5, pitch=1.8))}
    per = crew_person(gunner)
    hunch = {'r': {'Spine': (16, 0, 0), 'Chest': (6, 0, 0), 'Head': (-14, 0, 0)}, 'root': (0, 0, -.03), 'plant': 1}
    fire = [(1, {}), (6, hunch)] + [(8 + 3 * i, dict(hunch, root=(0, 0, -.034))) for i in range(5)] + [(24, hunch), (30, {})]
    clips = standing_crew(per, table, fire=fire, death='slump')
    out = run('modern-support', parts, table, v, specs, [(per, clips, True, None)], 'vehicle')
    print('NATURAL modern-support', natural(v, T, revs), flush=True)
    return out


def command_car(parts):
    rig, driver, officer = parts
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    v = Vehicle(rig, wheels)
    T, revs = 22, 4
    table = acts(25, 12, T + 1)
    specs = {'Idle': idle_spec(), 'Move': move_spec(T, revs, bob=.006, pitch=.5), 'Fire': lambda f: {}, 'Hit': keyed(HIT), 'Death': lambda f: {},
             'Wreck': keyed(wreck('Wheel_F_R', drop=.045, roll=-3.5, pitch=1.5))}
    dp = crew_person(driver)
    dclips = standing_crew(dp, table, death='seated')
    for a in ('Idle', 'Move', 'Fire', 'Hit'):  # seated: no planted feet
        c = dclips[a]
        if c.keys:
            c.keys = [(f, {k: val for k, val in s.items() if k != 'plant'}) for f, s in c.keys]
        else:
            g = c.fn
            c.fn = (lambda g: (lambda f: {k: val for k, val in g(f).items() if k != 'plant'}))(g)
    op = crew_person(officer)
    # Fire for a general: the order, his arm thrown forward at the enemy (`fire`: the moment it points)
    point = {'r': {'Spine': (6, 0, -6), 'Chest': (4, 0, -8), 'Head': (-4, 0, 6), 'Arm_R': (-78, 0, 12), 'Forearm_R': (-12, 0, 0)}, 'plant': 1}
    order = [(1, {}), (6, {'r': {'Arm_R': (-40, 0, 20), 'Forearm_R': (-40, 0, 0), 'Chest': (-2, 0, 4)}, 'plant': 1}), (12, dict(point, ease='in')), (13, point),
             (19, dict(point, r=dict(point['r'], Arm_R=(-60, 0, 10)))), (25, {})]
    oclips = standing_crew(op, table, fire=order, death='thrown', side=-1, fall=1)  # over the side to his right
    out = run('modern-general', parts, table, v, specs, [(dp, dclips, True, None), (op, oclips, True, 6)], 'vehicle')
    print('NATURAL modern-general', natural(v, T, revs), flush=True)
    return out


def technical(parts):
    rig, gunner = parts
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    v = Vehicle(rig, wheels, bore=(0, -1, .03))
    T, revs = 20, 3
    table = acts(30, 8, T + 1)
    specs = {'Idle': idle_spec(), 'Move': move_spec(T, revs, bob=.007, pitch=.5), 'Fire': keyed(burst_keys(8, 6, 2, .025, 30)), 'Hit': keyed(HIT), 'Death': lambda f: {},
             'Wreck': keyed(wreck('Wheel_2_R', drop=.05, roll=-4, pitch=-1.5))}
    per = crew_person(gunner)
    clips = standing_crew(per, table, death='thrown', side=0, fall=-1, dy=.32)  # out over the tailgate
    out = run('modern-raider', parts, table, v, specs, [(per, clips, True, 6)], 'vehicle')
    print('NATURAL modern-raider', natural(v, T, revs), flush=True)
    return out


def howitzer(parts):
    rig, c0, c1, c2 = parts
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    el = math.radians(28)
    v = Vehicle(rig, wheels, bore=(0, -math.cos(el), math.sin(el)))
    T, revs = 40, 1
    table = acts(40, 28, T + 1)
    specs = {'Idle': lambda f: None if f in (1, 41) else {}, 'Move': move_spec(T, revs, bob=.003, pitch=.2), 'Fire': keyed(recoil_keys(28, .22, 40, rock=.8)),
             'Hit': keyed(HIT), 'Death': lambda f: {}, 'Wreck': keyed(wreck('Wheel_F_L', drop=.04, roll=3, pitch=1))}
    cover = {'r': {'Spine': (14, 0, 0), 'Chest': (8, 0, 0), 'Head': (10, 0, 0), 'Arm_L': (-40, 0, 30), 'Arm_R': (-40, 0, -30), 'Forearm_L': (-70, 0, 0),
                   'Forearm_R': (-70, 0, 0)}, 'root': (0, 0, -.10), 'plant': 1}
    # the loader swings the shell in at the breech, the rammer drives it home twice, the observer watches the
    # fall of shot through his binoculars; all three turn away and cover up for the shot
    load = [(1, {}), (6, {'r': {'Spine': (28, 0, -10), 'Chest': (10, 0, -6), 'Arm_R': (-30, 0, 0), 'Arm_L': (-30, 0, 0)}, 'root': (0, 0, -.06), 'plant': 1}),
            (12, {'r': {'Spine': (10, 0, 8), 'Chest': (6, 0, 6), 'Arm_R': (-60, 0, 0), 'Arm_L': (-55, 0, 0)}, 'root': (0, 0, -.02), 'plant': 1}),
            (16, {'r': {'Spine': (4, 0, 0)}, 'plant': 1}), (22, cover), (34, cover), (40, {})]
    ram = {'r': {'Spine': (14, 0, 0), 'Arm_R': (-30, 0, 0), 'Arm_L': (-26, 0, 0)}, 'root': (0, 0, -.03), 'plant': 1}  # the rammer driven down the bore
    back = {'r': {'Spine': (6, 0, 0), 'Arm_R': (-12, 0, 0), 'Arm_L': (-10, 0, 0)}, 'plant': 1}
    rammer = [(1, {}), (12, back), (15, dict(ram, ease='in')), (17, back), (19, dict(ram, ease='in')), (21, back), (24, cover), (34, cover), (40, {})]
    look = {'r': {'Arm_R': (-70, 0, 20), 'Forearm_R': (-70, 0, 0), 'Arm_L': (-60, 0, -20), 'Forearm_L': (-60, 0, 0), 'Head': (-6, 0, 0)}, 'plant': 1}
    observer = [(1, {}), (8, look), (26, look), (28, dict(look, r=dict(look['r'], Spine=(-3, 0, 0), Head=(-10, 0, 0)), ease='out')), (34, look), (40, {})]
    crews = []
    for arm, fire, side in ((c0, load, -1), (c1, observer, 1), (c2, rammer, 1)):
        per = crew_person(arm)
        clips = standing_crew(per, table, fire=fire, death='thrown', side=side, carried=False)
        crews.append((per, clips, False, None))
    out = run('modern-siege', parts, table, v, specs, crews, 'vehicle')
    print('NATURAL modern-siege', natural(v, T, revs), flush=True)
    return out


# ---- the older machines (2026-10-20): a frame or a carriage on two wheels (rig: Hull, Wheel_L, Wheel_R) ----------

def machine_parts(parts):
    rig = next(p for p in parts if p.type == 'ARMATURE' and not p.name.startswith('Crew'))
    return rig, [p for p in parts if p.type == 'ARMATURE' and p.name.startswith('Crew')]


def roll_back(at, slide, frames, rock, r):
    """The shot at frame `at`: the machine kicks back `slide` on its wheels (they turn with it) and rolls forward
    again over a second; the trail or the frame rocks."""
    spin = -math.degrees(slide / r)
    return [(1, {}), (at - 1, {}), (at, {'slide': slide * .5, 'spin': spin * .5, 'pitch': -rock, 'bob': .004, 'ease': 'out'}),
            (at + 3, {'slide': slide, 'spin': spin, 'pitch': rock * .3}), (at + 18, {'slide': 0, 'spin': 0, 'pitch': 0, 'ease': 'io'}), (frames, {})]


def old_machine(uid, parts, fire_at, fire_frames, slide, rock, crew_fire):
    """Idle, Move (the wheels turn once a loop, the crew walk beside it), Fire (the machine kicks back and
    the crew work it: crew_fire(i) gives crewman i's keys, or None for a flinch), Hit, Death (the crew) and
    Wreck (a wheel splayed, the frame down on its side)."""
    rig, crew = machine_parts(parts)
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    v = Vehicle(rig, wheels)
    r = max(v.radius.values())
    T, revs = 40, 1
    table = acts(fire_frames, fire_at, T + 1)
    specs = {'Idle': lambda f: None if f in (1, 41) else {}, 'Move': move_spec(T, revs, bob=.004, pitch=.3),
             'Fire': keyed(roll_back(fire_at, slide, fire_frames, rock, r)), 'Hit': keyed(HIT), 'Death': lambda f: {},
             'Wreck': keyed(wreck(wheels[0], drop=.05, roll=4, pitch=1.2))}
    crews = []
    for i, arm in enumerate(crew):
        per = crew_person(arm)
        clips = standing_crew(per, table, fire=crew_fire(i), death='thrown', side=-1 if i % 2 == 0 else 1, carried=False)
        crews.append((per, clips, False, None))
    out = run(uid, parts, table, v, specs, crews, 'vehicle')
    print('NATURAL', uid, natural(v, T, revs), flush=True)
    return out


def _cover(at):
    """Crouched, head turned down and away for the shot; the arms keep their hold (a held rammer or ball stays put)."""
    return {'r': {'Spine': (12, 0, 0), 'Chest': (8, 0, 0), 'Head': (14, 0, 16)}, 'root': (0, 0, -.08), 'plant': 1}


def field_cannon(parts):
    """The Gunpowder field gun: the gun runs back on its wheels at the shot; the loader swings the ball in at
    the muzzle, the rammer drives it home, the gun layer leans on the trail; all cover for the shot."""
    at, n = 30, 46
    cover = _cover(at)
    ram = {'r': {'Spine': (14, 0, 0), 'Arm_R': (-55, 0, 0), 'Arm_L': (-50, 0, 0), 'Forearm_R': (-10, 0, 0)}, 'root': (0, 0, -.03), 'plant': 1}
    back = {'r': {'Spine': (6, 0, 0), 'Arm_R': (-25, 0, 0), 'Arm_L': (-20, 0, 0), 'Forearm_R': (-30, 0, 0)}, 'plant': 1}
    keys = {1: [(1, {}), (6, {'r': {'Spine': (28, 0, -10), 'Chest': (10, 0, -6), 'Arm_R': (-30, 0, 0), 'Arm_L': (-30, 0, 0)}, 'root': (0, 0, -.06), 'plant': 1}),
                (12, {'r': {'Spine': (10, 0, 8), 'Chest': (6, 0, 6), 'Arm_R': (-60, 0, 0), 'Arm_L': (-55, 0, 0)}, 'root': (0, 0, -.02), 'plant': 1}),
                (18, {'r': {'Spine': (4, 0, 0)}, 'plant': 1}), (at - 4, cover), (at + 8, cover), (n, {})],
            0: [(1, {}), (12, back), (15, dict(ram, ease='in')), (17, back), (19, dict(ram, ease='in')), (21, back), (at - 4, cover), (at + 8, cover), (n, {})],
            2: [(1, {}), (8, {'r': {'Spine': (24, 0, 0), 'Chest': (8, 0, 0), 'Head': (-14, 0, 0)}, 'root': (0, 0, -.10), 'plant': 1}),
                (20, {'r': {'Spine': (24, 0, 4), 'Chest': (8, 0, 2), 'Head': (-14, 0, 0)}, 'root': (0, 0, -.10), 'plant': 1}),
                (at - 4, cover), (at + 8, cover), (n, {})]}
    return old_machine('gunpowder-siege', parts, at, n, .045, 1.6, lambda i: keys.get(i))


def ballista(parts):
    """The Classical ballista: the man behind winds the winch (his fists turning round the axle), the two at
    the arms brace and lean clear; at the shot the frame jumps and settles."""
    at, n = 32, 44
    crank = [(1, {})]
    for k, f in enumerate(range(4, 26, 4)):
        a = 1 if k % 2 == 0 else -1
        crank.append((f, {'r': {'Spine': (10 + 4 * a, 0, 0), 'Chest': (4, 0, 0), 'Arm_L': (-30 - 20 * a, 0, 0), 'Arm_R': (-30 + 20 * a, 0, 0),
                                'Forearm_L': (-30 + 10 * a, 0, 0), 'Forearm_R': (-30 - 10 * a, 0, 0)}, 'root': (0, 0, -.02), 'plant': 1}))
    crank += [(28, {'r': {'Spine': (4, 0, 0)}, 'plant': 1}), (at + 2, {'r': {'Spine': (-4, 0, 0), 'Head': (-8, 0, 0)}, 'plant': 1, 'ease': 'out'}), (n, {})]
    brace = [(1, {}), (10, {'r': {'Spine': (18, 0, 0), 'Chest': (8, 0, 0), 'Head': (-12, 0, 0)}, 'root': (0, 0, -.05), 'plant': 1}),
             (24, {'r': {'Spine': (18, 0, 0), 'Chest': (8, 0, 0), 'Head': (-12, 0, 0)}, 'root': (0, 0, -.05), 'plant': 1}),
             (at - 2, {'r': {'Spine': (-4, 0, 0), 'Head': (-6, 0, 0)}, 'plant': 1}), (at + 3, {'r': {'Spine': (-6, 0, 0), 'Head': (-10, 0, 0)}, 'plant': 1, 'ease': 'out'}), (n, {})]
    return old_machine('classical-siege', parts, at, n, .012, 2.0, lambda i: crank if i == 2 else brace)


def trebuchet(parts):
    """The Kingdoms trebuchet: the counterweight drops, the beam whips up and over and looses the stone
    (event fire), overswings and settles; then the crew wind it down again at the winch and the stone is
    laid back in the sling."""
    at, n = 14, 60
    beam = [(1, {}), (8, {'beam': -3, 'ease': 'in'}), (12, {'beam': 70, 'ease': 'in'}), (at, {'beam': 112, 'stone': 0}),
            (18, {'beam': 138, 'stone': 0, 'ease': 'out'}), (24, {'beam': 118, 'stone': 0}), (30, {'beam': 126, 'stone': 0}),
            (34, {'beam': 122, 'stone': 0}), (54, {'beam': 0, 'stone': 0, 'ease': 'io'}), (57, {'beam': 0, 'stone': 1}), (n, {})]
    crank = [(1, {}), (at, {}), (at + 3, {'r': {'Spine': (-4, 0, 0), 'Head': (-12, 0, 0)}, 'plant': 1, 'ease': 'out'})]
    for k, f in enumerate(range(34, 54, 4)):
        a = 1 if k % 2 == 0 else -1
        crank.append((f, {'r': {'Spine': (14 + 4 * a, 0, 0), 'Chest': (4, 0, 0), 'Arm_L': (-30 - 20 * a, 0, 0), 'Arm_R': (-30 + 20 * a, 0, 0)},
                          'root': (0, 0, -.03), 'plant': 1}))
    crank += [(56, {}), (n, {})]
    rig, crew = machine_parts(parts)
    wheels = [b.name for b in rig.data.bones if b.name.startswith('Wheel_')]
    v = Vehicle(rig, wheels)
    T, revs = 40, 1
    table = acts(n, at, T + 1)
    specs = {'Idle': lambda f: None if f in (1, 41) else {}, 'Move': move_spec(T, revs, bob=.004, pitch=.25),
             'Fire': keyed([(f, dict(k, pitch=-.6 if f in (at, 18) else 0)) for f, k in beam]), 'Hit': keyed(HIT), 'Death': lambda f: {},
             'Wreck': keyed(wreck(wheels[0] if wheels else None, drop=.05, roll=4, pitch=1.2))}
    crews = []
    for i, arm in enumerate(crew):
        per = crew_person(arm)
        clips = standing_crew(per, table, fire=crank, death='thrown', side=-1 if i % 2 == 0 else 1, carried=False)
        crews.append((per, clips, False, None))
    out = run('kingdoms-siege', parts, table, v, specs, crews, 'vehicle')
    print('NATURAL kingdoms-siege', natural(v, T, revs), flush=True)
    return out


AUTHORS = {'modern-cavalry': tank, 'modern-support': aa_truck, 'modern-general': command_car, 'modern-raider': technical, 'modern-siege': howitzer}


def write_options(uid, table, order):
    """The unit's options file (its bake options and footprint as written by the build, plus the clips), and
    the contact sheets when TI_SHEETS is set."""
    out = u.out_dir(uid)
    p = out / f'{uid}.json'
    o = json.loads(p.read_text())
    o.pop('clips', None)
    o.pop('restClip', None)
    p.write_text(C.options_json(table, order, o))
    (out / 'clips.json').write_text(json.dumps({'fps': FPS, 'clips': table}, indent=2))
    if os.environ.get('TI_SHEETS'):
        kw = {'ortho': 3.2, 'aim': (-.1, -.2, .45)}
        sheets(uid, table, **kw)
        if os.environ.get('TI_SHEETS') == 'side':
            sheets(uid, table, view='side', **kw)


def sheets(uid, table, **kw):
    old = MC.SHEETS.get('vehicle')
    MC.SHEETS['vehicle'] = {k: [n for n in v if n in table] for k, v in SHEETS.items()}
    os.environ.setdefault('TI_SHEETS_DIR', os.path.join('plans', 'art-pilot', 'vehicle-clips'))
    try:
        return MC.sheets(uid, table, 'vehicle', **kw)
    finally:
        if old is None:
            MC.SHEETS.pop('vehicle', None)
