# scripts/blender/ti_clips.py
# The shared clip tooling of the battle units (plans/art/clip-animation-pipeline.md section 7), lifted
# out of ti_worker_clips.py (the five workers, 2026-10-14) for the foot soldiers (ti_foot_clips.py):
#   - the rest pose's hands (rest_grip: the fist's grip point and knuckle axis), a held object's frame
#     (tool_frame, frame3)
#   - key specs and their per-frame blend (spec_at, ease, mix), the Clip record
#   - the Poser: hand targets in armature space, two-bone reach for arms and legs, planted feet
#   - the Author: poses every frame of every clip and writes one action per clip (an NLA track each,
#     muted), keying the Tool_* bones' scale (a tool is shown by its bone's scale, 1 or 0)
#   - ground_set / lowest: the lowest foot or body point for the gaits and the falls
#   - options_json: the unit's options file with its "clips" table; render_sheets: contact sheets
#     from the battle camera
# 20 fps, events 1-based, frame f at f / 20 s in the GLB. Blender Z up, the front faces -Y, H = 1.
import bpy, math, json
from mathutils import Vector, Matrix, Quaternion
import ti_units as u
import ti_figure as F

FPS = 20
FLOOR = .001  # ti_units.ground_actions keeps the lowest point at this height


def upd():
    bpy.context.view_layer.update()


def nrm(v):
    v = Vector(v)
    return v.normalized() if v.length > 1e-9 else v


# ---- the rest pose's hands ------------------------------------------------------------------------

def rest_grip(side, name=None):
    """The fist's grip point and knuckle axis in the rest pose, read off its Fingers_<side> tube (two
    rings and the two cap centres, the last two vertices: F.fist and the Bronze spearman's own)."""
    ob = bpy.data.objects[name or (F.prefix + 'Fingers_' + side)]
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    a, b = vs[-2], vs[-1]
    return (a + b) / 2 + Vector((0, .004, 0)), (b - a).normalized()


def tool_frame(axis):
    """The work tools' own frame at the right fist: the haft along the knuckle axis (pointing up or
    forward), the face (blade, pick point, hammer face) at right angles towards the front."""
    a = nrm(axis)
    if a.z < -.2 or (abs(a.z) <= .2 and a.y > 0):
        a = -a
    f = Vector((0, -1, 0))
    if abs(a.dot(f)) > .9:
        f = Vector((0, 0, -1))
    f = nrm(f - a * a.dot(f))
    return a, f


def frame3(a, f):
    a = nrm(a)
    f = nrm(Vector(f) - a * a.dot(Vector(f)))
    if f.length < 1e-6:
        f = nrm(Vector((0, -1, 0)) - a * a.y * -1)
    s = a.cross(f)
    return Matrix((s, f, a)).transposed()


# ---- key specs, per-frame evaluation ----------------------------------------------------------------

def ease(t, kind):
    if kind == 'lin':
        return t
    if kind == 'in':
        return t * t
    if kind == 'out':
        return 1 - (1 - t) * (1 - t)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    if a is None or b is None:
        return b if t >= .5 else a
    if isinstance(a, dict):
        out = {}
        for k in set(a) | set(b):
            va, vb = a.get(k), b.get(k)
            if va is None:
                va = zero_like(vb)
            if vb is None:
                vb = zero_like(va)
            out[k] = mix(va, vb, t)
        return out
    if isinstance(a, (tuple, list)):
        return tuple(x + (y - x) * t for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):  # numbers and flags (plant, free) blend
        return float(a) + (float(b) - float(a)) * t
    return b if t >= .5 else a


def zero_like(v):
    if isinstance(v, dict):
        return {k: zero_like(x) for k, x in v.items()}
    if isinstance(v, (tuple, list)):
        return tuple(0 for _ in v)
    if isinstance(v, (int, float)):
        return 0
    return v


def spec_at(keys, frame):
    """The key spec at `frame`: keys are [(frame, spec)]; a spec's 'ease' shapes the way into it."""
    if frame <= keys[0][0]:
        return keys[0][1]
    for (f0, s0), (f1, s1) in zip(keys, keys[1:]):
        if f0 <= frame <= f1:
            t = 0 if f1 == f0 else (frame - f0) / (f1 - f0)
            return mix(s0, s1, ease(t, s1.get('ease', 'io')))
    return keys[-1][1]


class Clip:
    def __init__(self, name, frames, loop, tool, keys=None, fn=None, ground=None, events=None, barrow=False):
        self.name, self.frames, self.loop, self.tool = name, frames, loop, tool
        self.keys, self.fn, self.ground, self.events, self.barrow = keys, fn, ground, events or {}, barrow


def ground_set(meshes, groups):
    """{object: [vertex indices]} of vertices weighted to any of `groups` (None: every vertex)."""
    out = {}
    for ob in meshes:
        if ob.get('attachment') and groups is not None:
            continue
        idx = []
        names = {g.index: g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            if groups is None or any(names.get(g.group, '').startswith(groups) for g in v.groups if g.weight > .3):
                idx.append(v.index)
        if idx:
            out[ob] = idx
    return out


def lowest(subset):
    dg = bpy.context.evaluated_depsgraph_get()
    low = 1e9
    for ob, idx in subset.items():
        eo = ob.evaluated_get(dg)
        me = eo.to_mesh()
        mw = eo.matrix_world
        for i in idx:
            z = (mw @ me.vertices[i].co).z
            if z < low:
                low = z
        eo.to_mesh_clear()
    return low


# ---- the poser: hand targets, two-bone reach, planted feet -----------------------------------------

class Poser:
    def __init__(self, arm, tool_frames, held_frame, fingers=None):
        self.arm = arm
        B = arm.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in B}
        self.len = {}
        for s in 'LR':
            self.len['arm' + s] = ((B['Forearm_' + s].head_local - B['Arm_' + s].head_local).length,
                                   (B['Hand_' + s].head_local - B['Forearm_' + s].head_local).length)
            self.len['leg' + s] = ((B['Shin_' + s].head_local - B['Leg_' + s].head_local).length,
                                   (B['Foot_' + s].head_local - B['Shin_' + s].head_local).length)
        self.grip = {s: rest_grip(s, (fingers or {}).get(s)) for s in 'LR'}
        self.wrist = {s: B['Hand_' + s].head_local.copy() for s in 'LR'}
        self.ankle = {s: B['Foot_' + s].head_local.copy() for s in 'LR'}
        self.frames = dict(tool_frames)
        self.frames['Held'] = held_frame
        self.tools = [b.name for b in B if b.name.startswith('Tool_') and b.parent and b.parent.name == 'Prop_R']

    def reset(self):
        for pb in self.arm.pose.bones:
            pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)

    def pb(self, name):
        return self.arm.pose.bones[name]

    def aim(self, name, direction):
        pb = self.pb(name)
        M = pb.matrix.copy()
        y = M.to_3x3().col[1].normalized()
        q = y.rotation_difference(nrm(direction))
        pb.matrix = Matrix.Translation(M.translation) @ (q.to_matrix() @ M.to_3x3()).to_4x4()
        upd()

    def orient(self, name, R3):
        pb = self.pb(name)
        pb.matrix = Matrix.Translation(pb.matrix.translation.copy()) @ R3.to_4x4()
        upd()

    def two_bone(self, upper, lower, lengths, target, pole):
        upd()
        S = self.pb(upper).head.copy()
        l1, l2 = lengths
        d = Vector(target) - S
        L = max(abs(l1 - l2) * 1.01 + 1e-4, min(d.length, (l1 + l2) * .999))
        dn = nrm(d)
        a = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
        h = math.sqrt(max(0, l1 * l1 - a * a))
        p = nrm(Vector(pole) - dn * Vector(pole).dot(dn))
        E = S + dn * a + p * h
        self.aim(upper, E - S)
        self.aim(lower, S + dn * L - E)

    def chest_delta(self):
        """The chest's move from rest to now (armature space): targets given in chest space ride on it."""
        return self.pb('Chest').matrix @ self.rest['Chest'].inverted()

    def hold_right(self, P, D, Fd, tool):
        """The right grip at P, the tool's haft along D and its face towards Fd (armature space)."""
        a0, f0 = self.frames[tool] if tool in self.frames else self.frames['Held']  # ('None': an empty fist, the held tool's grip)
        Q = frame3(D, Fd) @ frame3(a0, f0).transposed()
        G = self.grip['R'][0]
        W = self.wrist['R']
        self.two_bone('Arm_R', 'Forearm_R', self.len['armR'], P - Q @ (G - W), (-1, .35, -.7))
        self.orient('Hand_R', Q @ self.rest['Hand_R'].to_3x3())
        return Q

    def hold_left(self, P, D=None, sign=1, pole=(1, .35, -.7)):
        """The left grip at P; with D, the fist turned so its knuckles close round a haft along D."""
        G, ax = self.grip['L']
        W = self.wrist['L']
        Q = Matrix.Identity(3)
        if D is not None:
            Q = (ax * sign).rotation_difference(nrm(D)).to_matrix()
        self.two_bone('Arm_L', 'Forearm_L', self.len['armL'], P - Q @ (G - W), pole)
        if D is not None:
            self.orient('Hand_L', Q @ self.rest['Hand_L'].to_3x3())

    def hold(self, side, P, D, Fd, frame, pole):
        """Either fist's grip at P, the thing it holds (its rest frame `frame` = (axis, face)) turned so
        its axis runs along D and its face towards Fd. Returns the turn Q (rest to now)."""
        a0, f0 = frame
        Q = frame3(D, Fd) @ frame3(a0, f0).transposed()
        G = self.grip[side][0]
        W = self.wrist[side]
        self.two_bone('Arm_' + side, 'Forearm_' + side, self.len['arm' + side], P - Q @ (G - W), pole)
        self.orient('Hand_' + side, Q @ self.rest['Hand_' + side].to_3x3())
        return Q

    def grip_now(self, side):
        """Where the fist's grip point is now (armature space)."""
        pb = self.pb('Hand_' + side)
        return pb.matrix @ self.rest['Hand_' + side].inverted() @ self.grip[side][0]

    def plant(self, offsets=None):
        """Both feet where they stand at rest (plus `offsets`), knees forward, soles flat."""
        for s in 'LR':
            off = Vector((offsets or {}).get(s, (0, 0, 0)))
            self.two_bone('Leg_' + s, 'Shin_' + s, self.len['leg' + s], self.ankle[s] + off, (0, -1, .1))
            self.orient('Foot_' + s, self.rest['Foot_' + s].to_3x3())


# ---- the author: every frame posed, one action per clip ----------------------------------------------

class Author:
    """Poses every frame of every clip, then writes the actions (one NLA track each, muted, as
    ti_units.make_action does) and the clip table. pose() is the workers' (ti_worker_clips.py); the
    foot soldiers' FootAuthor (ti_foot_clips.py) has its own."""

    def __init__(self, arm, poser, meshes, barrow=None):
        self.arm, self.P, self.meshes, self.barrow = arm, poser, meshes, barrow
        self.feet = ground_set(meshes, ('Foot_', 'Shin_'))
        self.body = ground_set([m for m in meshes if not m.get('attachment')], None)
        self.table = {}

    def pose(self, clip, spec, frame):
        P = self.P
        P.reset()
        if clip.name == 'Idle' and frame in (1, clip.frames):
            self.scales(clip, spec)
            upd()
            return  # frame 1 of Idle is the rest pose, exactly (and the loop closes on it)
        for b, ang in spec.get('r', {}).items():
            u.rotate_world(self.arm, b, ang)
        root = Vector(spec.get('root', (0, 0, 0)))
        P.pb('Root').location = P.rest['Root'].to_3x3().inverted() @ root
        upd()
        w = float(spec.get('plant', 0))
        if w > .001:  # planted feet, blended with the keyed legs while the plant fades in or out
            legs = [n + s for n in ('Leg_', 'Shin_', 'Foot_') for s in 'LR']
            fk = {n: P.pb(n).rotation_quaternion.copy() for n in legs}
            P.plant(spec.get('feet'))
            if w < .999:
                for n in legs:
                    P.pb(n).rotation_quaternion = fk[n].slerp(P.pb(n).rotation_quaternion, w)
                upd()
        M = P.chest_delta() if spec.get('space', 'chest') == 'chest' else Matrix.Identity(4)
        R3 = M.to_3x3()
        hand = spec.get('R')
        if hand:
            D = R3 @ nrm(hand['d'])
            Fd = R3 @ nrm(hand['f']) if 'f' in hand else self.swing_face(spec, D, R3)
            Pt = M @ Vector(hand['p'])
            P.hold_right(Pt, D, Fd, clip.tool)
            left = spec.get('L')
            if left and 's' in left:
                P.hold_left(Pt + D * left['s'], D, self.lsign, left.get('pole', (1, .35, -.7)))
        left = spec.get('L')
        if left and 'p' in left:
            P.hold_left(M @ Vector(left['p']), (R3 @ nrm(left['d'])) if 'd' in left else None, 1, left.get('pole', (1, .35, -.7)))
        if clip.barrow:
            self.barrow_pose(spec)
        fl = float(spec.get('flat', 0))
        if fl > .001:  # the held tool turns about the grip to lie level (a dead man's staff on the ground)
            self.lay_flat('Tool_Held', fl)
        self.scales(clip, spec)
        upd()
        if clip.ground:
            self.to_ground(clip.ground)

    def to_ground(self, which):
        P = self.P
        subset = self.feet if which == 'feet' else self.body
        low = lowest(subset)
        rp = P.pb('Root')
        rp.location = rp.location + P.rest['Root'].to_3x3().inverted() @ Vector((0, 0, FLOOR - low))
        upd()

    def lay_flat(self, bone, fl):
        """The held thing on `bone` (its rest frame P.frames['Held']) turns about the grip to lie level,
        the grip let go down towards the ground, `fl` of the way (0 to 1)."""
        P = self.P
        pb = P.pb(bone)
        M = pb.matrix.copy()
        R = M.to_3x3()
        # dropped: the haft and the head both level, the grip let go down to the ground
        a0, f0 = P.frames['Held']
        R0 = R @ P.rest[bone].to_3x3().inverted()
        A, Fc = R0 @ a0, R0 @ f0
        H = Vector((A.x, A.y, 0))
        if H.length > 1e-3:
            H.normalize()
            side = H.cross(Vector((0, 0, 1)))
            Ft = side if side.dot(Fc) >= 0 else -side
            Rt = frame3(H, Ft) @ frame3(A, Fc).transposed() @ R
            q = R.to_quaternion().slerp(Rt.to_quaternion(), fl)
            t = M.translation.copy()
            t.z += (.03 - t.z) * fl
            pb.matrix = Matrix.Translation(t) @ q.to_matrix().to_4x4()
            upd()

    def swing_face(self, spec, D, R3):
        A = R3 @ nrm(spec.get('axis', (1, 0, 0)))
        return nrm(A.cross(D))

    def scales(self, clip, spec):
        show = spec.get('show')
        for t in self.P.tools:
            name = t[5:]
            on = 1.0 if name == clip.tool or (clip.tool is None and name == 'Held') else 0.0
            if show and name in show:
                on = show[name]
            self.P.pb(t).scale = (on, on, on)

    def barrow_pose(self, spec):
        """The Gunpowder barrow stays on the ground (tilted `tilt` degrees about its axle), the hands
        on its handles unless `free`; its wheel turns `wheel` degrees."""
        P, B = self.P, self.barrow
        th = math.radians(spec.get('tilt', 0))
        T = Matrix.Translation(B['axle']) @ Matrix.Rotation(th, 4, 'X') @ Matrix.Translation(-B['axle'])
        if not spec.get('free'):
            for s, pole in (('R', (-1, .3, -.6)), ('L', (1, .3, -.6))):
                G = P.grip[s][0]
                W = P.wrist[s]
                Q = T.to_3x3()
                P.two_bone('Arm_' + s, 'Forearm_' + s, P.len['arm' + s], T @ G - Q @ (G - W), pole)
                P.orient('Hand_' + s, Q @ P.rest['Hand_' + s].to_3x3())
        pb = P.pb('Tool_Held')
        pb.matrix = T @ P.rest['Tool_Held']
        upd()
        w = spec.get('wheel', 0)
        if w:
            u.rotate_world(self.arm, 'Tool_Wheel', (w, 0, 0))

    def first_sign(self, clip):
        """The left fist's turn on a two-handed haft: its knuckle axis along the haft or against it."""
        self.lsign = 1
        first = clip.keys[0][1] if clip.keys else clip.fn(1)
        if first.get('R') and first.get('L') and 's' in first['L'] and 'd' in first['R']:
            ax = self.P.grip['L'][1]
            self.lsign = 1 if ax.dot(nrm(first['R']['d'])) >= 0 else -1

    def run(self, clips):
        store = {}
        self.arm.animation_data_create()
        self.arm.animation_data.action = None
        for clip in clips:
            frames = []
            self.first_sign(clip)
            for f in range(1, clip.frames + 1):
                spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
                self.pose(clip, spec, f)
                frames.append({pb.name: (pb.rotation_quaternion.copy(), pb.location.copy(), pb.scale.copy()) for pb in self.arm.pose.bones})
            store[clip.name] = frames
        self.P.reset()
        upd()
        for clip in clips:
            self.write(clip, store[clip.name])
            self.table[clip.name] = self.entry(clip)
        return self.table

    def entry(self, clip):
        e = {'frames': clip.frames, 'fps': FPS, 'loop': clip.loop, 'tool': clip.tool or 'Held'}
        if clip.events:
            e['events'] = dict(clip.events)
        return e

    def write(self, clip, frames):
        arm = self.arm
        action = bpy.data.actions.new(clip.name)
        arm.animation_data.action = action
        last = {}
        tools = set(self.P.tools) | {'Tool_Wheel'}
        for f, pose in enumerate(frames, 1):
            for name, (q, loc, sc) in pose.items():
                pb = arm.pose.bones[name]
                if name in last and last[name].dot(q) < 0:
                    q = -q
                last[name] = q
                pb.rotation_quaternion = q
                pb.location = loc
                pb.keyframe_insert('rotation_quaternion', frame=f)
                pb.keyframe_insert('location', frame=f)
                if name in tools:
                    pb.scale = sc
                    pb.keyframe_insert('scale', frame=f)
        action.use_frame_range = True
        action.frame_start = 1
        action.frame_end = clip.frames
        action['loop'] = clip.loop
        track = arm.animation_data.nla_tracks.new()
        track.name = clip.name
        track.strips.new(clip.name, 1, action)
        track.mute = True
        arm.animation_data.action = None
        self.P.reset()


# ---- the options file -----------------------------------------------------------------------------

def options_json(table, order, extra=None):
    """The unit's options file (src/assets/units/<uid>.json): the bake options plus the clip table."""
    opts = {'enabled': True, 'quadruped': False, 'restClip': '^Idle$', 'triangleBudget': 3000,
            'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}
    opts.update(extra or {})
    opts['clips'] = {n: table[n] for n in order if n in table}
    return json.dumps(opts, indent=2) + '\n'


# ---- contact sheets ------------------------------------------------------------------------------------

def sample_frames(info, n=8):
    frames = info['frames']
    picks = {1, frames}
    for f in (info.get('events') or {}).values():
        picks.add(f)
    k = 1
    while len(picks) < n and k < 50:
        for i in range(1, n):
            if len(picks) >= n:
                break
            picks.add(1 + round((frames - 1) * i / (n - 1)))
        k += 1
    return sorted(picks)[:n + 1]


def render_sheets(out_dir, uid, table, arm, cols=8, cell=(190, 220), team='2F6FD0', view='game', sheets=None, ortho=1.6, aim=(0, -.2, .45)):
    """Workbench stills of every clip from the battle camera (high three-quarter, as F.preview's
    'game' view), 7 or 8 frames a row (the event frames among them), one sheet per entry of `sheets`
    ({name: [clips]}). Written to out_dir/<uid>-<sheet>.png."""
    import numpy as np
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
    loc = {'game': (1.6, -1.9, 2.6), 'side': (3.2, -0.2, .7), 'front': (.4, -3.2, .9)}[view]
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    # a ground plane so the feet read
    me = bpy.data.meshes.new('SheetGround')
    me.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    gm = bpy.data.materials.new('SheetGround')
    gm.diffuse_color = (.36, .42, .26, 1)
    me.materials.append(gm)
    ground = bpy.data.objects.new('SheetGround', me)
    scene.collection.objects.link(ground)
    arm.hide_viewport = arm.hide_render = True
    tmp = out_dir / f'_cells-{uid}'
    tmp.mkdir(parents=True, exist_ok=True)
    written = []
    for sheet, names in sheets.items():
        W, H = cell
        img = np.ones((H * len(names), W * cols, 4), dtype=np.float32)
        for row, name in enumerate(names):
            if name not in table:
                continue
            arm.animation_data.action = bpy.data.actions[name]
            for col, fr in enumerate(sample_frames(table[name], cols)[:cols]):
                scene.frame_set(fr)
                path = tmp / f'{name}-{fr}.png'
                scene.render.filepath = str(path)
                bpy.ops.render.render(write_still=True)
                im = bpy.data.images.load(str(path))
                px = np.array(im.pixels[:], dtype=np.float32).reshape(H, W, 4)
                bpy.data.images.remove(im)
                ev = [k for k, v in (table[name].get('events') or {}).items() if v == fr]
                if ev:  # an event frame: a thin red bar along the top of its cell
                    px[H - 5:H, :, :] = (.85, .15, .1, 1)
                y0 = (len(names) - 1 - row) * H
                img[y0:y0 + H, col * W:(col + 1) * W] = px
        name = f'{uid}-{sheet}' + ('' if view == 'game' else '-' + view)
        out = bpy.data.images.new(name, W * cols, H * len(names), alpha=True)
        out.pixels = img.ravel().tolist()
        out.filepath_raw = str(out_dir / f'{name}.png')
        out.file_format = 'PNG'
        out.save()
        written.append(out.filepath_raw)
    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    arm.hide_viewport = arm.hide_render = False
    arm.animation_data.action = bpy.data.actions.get('Idle')
    scene.frame_set(1)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.objects.remove(ground, do_unlink=True)
    return written
