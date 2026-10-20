# scripts/blender/ti_worker_clips.py
# Work tools and authored clips for the five base workers (manifest rows U06, AN15, AN16, MD07), to
# the contract of plans/art/clip-animation-pipeline.md section 7:
#   - tools on their own bones, children of Prop_R: Tool_Held (the tool the unit holds today, its
#     old parts reweighted from Prop_R, so the rest pose is unchanged), Tool_Axe, Tool_Pick,
#     Tool_Sickle, Tool_Hammer (Modern builds with its sledgehammer, Tool_Held); Gunpowder adds
#     Tool_Wheel (the barrow's wheel, a child of Tool_Held at the axle). A tool is shown by its bone's
#     scale: 1 in the clips that use it, 0 elsewhere; Idle frame 1 (the rest pose the game bakes)
#     shows Tool_Held only
#   - twelve clips at 20 fps, in place, loops closed: Idle, Walk, Run, Carry, Chop, Mine, Harvest,
#     Build, Repair, Deposit, Hit, Death; every frame keyed (posed by hand targets, two-bone reach
#     for the arms, planted feet for the work clips, the lowest foot on the ground for the gaits and
#     the lowest point for Death)
#   - event frames (1-based): contact (Chop, Mine, Build, Repair), cut (Harvest), pour (Deposit),
#     settle (Death); contact frames held two frames
#   - the options file <uid>.json with "clips" (frames, loop, tool, events)
#   - contact sheets from the battle camera (render_sheets)
# Used by build_bronze_worker.py, build_classical_worker.py, build_kingdoms_worker.py,
# build_gunpowder_worker.py and build_modern_worker.py. Blender Z up, the front faces -Y, H = 1.
# The generic machinery (the poser, the author, key specs, the options file, contact sheets) lives in
# ti_clips.py since the foot soldiers' clips (ti_foot_clips.py) share it.
import bpy, math, json, os
from mathutils import Vector
import ti_units as u
import ti_figure as F
import ti_clips as C
from ti_clips import FPS, nrm, rest_grip, tool_frame, Clip, Poser, Author  # noqa: F401  (builders reach them through this module)

WORK_TOOLS = ('Axe', 'Pick', 'Sickle', 'Hammer')
CLIP_ORDER = ('Idle', 'Walk', 'Run', 'Carry', 'Chop', 'Mine', 'Harvest', 'Pick', 'Fish', 'Herd', 'Build', 'Repair', 'Deposit', 'Hit', 'Death',
              'DeathAlt', 'Cheer')
SHEETS = {'moving': ['Idle', 'Walk', 'Run', 'Carry', 'Hit', 'Death', 'DeathAlt', 'Cheer'], 'work': ['Chop', 'Mine', 'Harvest', 'Build', 'Repair', 'Deposit'],
          'food': ['Pick', 'Fish', 'Herd']}


# ---- tool bones and tool meshes --------------------------------------------------------------------

def add_tool_bones(arm, grip, axis, names, extra=None):
    """Bones Tool_<name>, children of Prop_R, their heads at the right grip along the haft axis.
    `extra`: [(name, head, tail, parent)] more bones (the barrow's wheel)."""
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for n in names:
        b = eb.new('Tool_' + n)
        b.head, b.tail, b.roll = grip, grip + axis * .08, 0
        b.parent = eb['Prop_R']
    for n, head, tail, parent in (extra or []):
        b = eb.new(n)
        b.head, b.tail, b.roll = head, tail, 0
        b.parent = eb[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    bpy.ops.object.select_all(action='DESELECT')


def reweight_held(names=None, group='Tool_Held'):
    """The parts that hung from Prop_R (the tool held today) now hang from Tool_Held: same shape,
    same rest pose, a bone of their own to show or hide. Returns the objects."""
    out = []
    for ob in F.meshes:
        g = ob.vertex_groups.get('Prop_R')
        if g and (names is None or ob.name in names):
            g.name = group
            out.append(ob)
    return out


def part(name, pts, thick, wide, mat, bone, normal, sides=4, caps=(True, True)):
    """A tool part swept along `pts`: per ring (thick along `normal`, wide across the path in the
    tool's plane). One mesh object on `bone` (an attachment)."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    N = nrm(normal)
    verts, faces = [], []
    for i, c in enumerate(pts):
        d = nrm(pts[min(n - 1, i + 1)] - pts[max(0, i - 1)])
        W = nrm(N.cross(d))
        t, w = thick[i] if isinstance(thick, (list, tuple)) else thick, wide[i] if isinstance(wide, (list, tuple)) else wide
        for j in range(sides):
            a = 2 * math.pi * (j + .5) / sides
            verts.append(tuple(c + N * math.cos(a) * t + W * math.sin(a) * w))
        if i:
            for j in range(sides):
                p, q = (i - 1) * sides + j, (i - 1) * sides + (j + 1) % sides
                faces += [(p, q, i * sides + (j + 1) % sides), (p, i * sides + (j + 1) % sides, i * sides + j)]
    for end, on in ((0, caps[0]), (n - 1, caps[1])):
        if not on:
            continue
        idx = len(verts)
        verts.append(tuple(pts[end]))
        for j in range(sides):
            p, q = end * sides + j, end * sides + (j + 1) % sides
            faces.append((idx, q, p) if end == 0 else (idx, p, q))
    ob = u.mesh_obj(F.prefix + name, verts, faces, mat, weights=[{bone: 1}] * len(verts), arm=F.arm, attachment=True)
    return ob


# Tool styles per age: haft and head materials, the axe's blade, the build tool's head.
STYLES = {
    'stone': {'haft': 'Wood', 'head': 'Stone', 'blade': .040, 'mallet': True, 'sickle': 'Flint'},  # (2026-10-20: knapped stone heads, a flint sickle)
    'bronze': {'haft': 'Wood', 'head': 'Metal', 'blade': .044, 'mallet': True, 'sickle': 'Metal'},
    'iron': {'haft': 'Wood', 'head': 'Metal', 'blade': .058, 'mallet': False, 'sickle': 'Metal'},
    'steel': {'haft': 'Wood', 'head': 'Metal', 'blade': .066, 'mallet': False, 'sickle': 'Metal'},
    'modern': {'haft': 'Wood', 'head': 'Metal', 'blade': .062, 'mallet': False, 'sickle': 'Metal', 'grip': 'Gear'},
}


def build_tools(G, a, f, style, which=WORK_TOOLS):
    """The work tools in the right fist, in the tool frame (grip G, haft a, face f): each held near
    the end of its haft, the head at the far end. Returns the new objects."""
    S = STYLES[style]
    s = a.cross(f)
    at = lambda h, y=0., x=0.: G + a * h + f * y + s * x  # noqa: E731
    out = []
    # Lean on purpose (each worker stays within 2,000 triangles with all its tools): three-sided hafts
    # of two rings, heads of three to four rings, the pointed tips left open.
    if 'Axe' in which:
        out.append(part('WorkAxeHaft', [at(-.110), at(.400)], .0125, .0125, S['haft'], 'Tool_Axe', s, 3))
        b = S['blade']
        out.append(part('WorkAxeHead', [at(.372, -.030), at(.372, .005), at(.368, .060), at(.366, .106)],
                        [.016, .017, .007, .002], [.020, .024, b * .70, b], S['head'], 'Tool_Axe', s, 4, caps=(True, False)))
    if 'Pick' in which:
        out.append(part('WorkPickHaft', [at(-.110), at(.415)], .0125, .0125, S['haft'], 'Tool_Pick', s, 3))
        out.append(part('WorkPickHead', [at(.368, -.150), at(.396, -.060), at(.396, .065), at(.364, .170)],
                        [.004, .015, .015, .003], [.005, .018, .018, .004], S['head'], 'Tool_Pick', s, 4, caps=(False, False)))
    if 'Sickle' in which:
        out.append(part('WorkSickleGrip', [at(-.045), at(.085)], .0150, .0150, S.get('grip', 'Wood'), 'Tool_Sickle', s, 3))
        # the blade: a crescent from the top of the grip up and over to the front, its edge inside
        c, R, pts, wd = at(.085, .085), .085, [], []
        for k in range(4):
            ph = math.radians(-8 + 196 * k / 3)
            pts.append(c - f * R * math.cos(ph) + a * R * math.sin(ph) * 1.15)
            wd.append(.015 - .011 * k / 3)
        out.append(part('WorkSickleBlade', pts, .0025, wd, S['sickle'], 'Tool_Sickle', s, 4, caps=(True, False)))
    if 'Hammer' in which:
        if S['mallet']:  # a wooden mallet: a stout handle, a round maul head across the face
            out.append(part('WorkHammerHandle', [at(-.060), at(.270)], .0130, .0130, 'Wood', 'Tool_Hammer', s, 3))
            out.append(part('WorkHammerHead', [at(.290, -.070), at(.290, .070)], .034, .034, 'Wood', 'Tool_Hammer', s, 6))
        else:  # an iron or steel hammer: a handle, a head with a face to the front and a peen behind
            out.append(part('WorkHammerHandle', [at(-.060), at(.290)], .0120, .0120, S['haft'], 'Tool_Hammer', s, 3))
            out.append(part('WorkHammerHead', [at(.300, -.052), at(.300, -.020), at(.300, .060)],
                            [.004, .014, .017], [.012, .016, .017], S['head'], 'Tool_Hammer', s, 4))
    return out


def shade_tools(objs):
    """COLOR_0 for the new tools: the ground-to-head gradient of F.bake_shade with a light, even
    occlusion (the body's own bake is left exactly as it was)."""
    for ob in objs:
        me = ob.data
        layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        for poly in me.polygons:
            for li in poly.loop_indices:
                p = ob.matrix_world @ me.vertices[me.loops[li].vertex_index].co
                v = max(.42, min(1, .9 * (.86 + .14 * min(1, max(0, p.z / .55)))))
                layer.data[li].color = (v, v, v, 1)
        me.color_attributes.active_color = layer
        me.color_attributes.render_color_index = 0


def fix_tool_normals(objs):
    import bmesh
    for ob in objs:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()


# ---- the clip library ----------------------------------------------------------------------------------

def gait(name, period, stride, knee, lean, kind, carry=False, run=False, arms=6):
    """A walk cycle in place: the left foot strikes on frame 1, the right half way; thighs swing
    `stride` degrees each way, the swinging knee lifts `knee` degrees; the lowest foot is kept on the
    ground every frame (the body rises and falls with the legs)."""
    def fn(f):
        ph = ((f - 1) % period) / period
        r = {}
        for side, off in (('L', 0), ('R', .5)):
            p = (ph + off) % 1
            r['Leg_' + side] = (-stride * math.cos(2 * math.pi * p), 0, 0)
            # stance (p 0 to .5): the knee gives a little after the strike; swing: it folds and opens
            k = 6 + 10 * math.sin(math.pi * p / .5) if p < .5 else 4 + knee * math.sin(math.pi * (p - .5) / .5) ** 1.4
            r['Shin_' + side] = (k, 0, 0)
            # the foot rolls: toe down at push off, flat at the strike
            r['Foot_' + side] = (-14 * math.sin(math.pi * (p - .30) / .32) if .30 < p < .62 else 0, 0, 0)
        sw = math.cos(2 * math.pi * ph)
        twist = 3 * sw if run else 2 * sw
        r['Spine'] = (lean * .4, 0, twist)
        r['Chest'] = (lean * .6, 0, -twist * 1.5)
        r['Head'] = (-lean * .7, 0, twist)
        spec = {'r': r, 'space': 'chest'}
        if kind == 'basket':
            # the left fist keeps the rope (no swing); the right arm swings the held tool a little
            r['Arm_R'] = (-arms * sw, 0, 0)
            if run:
                r['Arm_R'] = (-arms * sw - 8, 0, 0)
                r['Forearm_R'] = (-6, 0, 0)
            if carry:
                r['Arm_L'] = (-3, 0, 0)
        elif kind == 'barrow':
            spec['wheel'] = -360 * ph
        elif kind == 'sledge':
            spec['R'] = {'p': (-.165, -.150, .835), 'd': (.03, .95, .30), 'f': (1, 0, 0)}
            if carry:
                spec['L'] = {'p': (.150, -.060, .905), 'pole': (1, -.2, -1)}
            else:
                r['Arm_L'] = (arms * 2 * sw, 0, 6)
                r['Forearm_L'] = (-12 - (20 if run else 0), 0, 0)
        return spec
    return Clip(name, period + 1, True, 'Held', fn=fn, ground='feet', barrow=(kind == 'barrow'))


def idle(kind):
    keys = [(1, {}), (21, {'r': {'Chest': (0, 0, -1), 'Head': (-1, 0, 2), 'Spine': (.6, 0, 0)}}), (41, {})]
    if kind == 'barrow':
        keys = [(f, dict(s, plant=True)) for f, s in keys]
    return Clip('Idle', 41, True, 'Held', keys=keys, barrow=(kind == 'barrow'))


def chop():
    """Axe at a tree: a slow lift over the right shoulder, a fast diagonal swing down and across to
    the trunk in front, the bite held, a pull to free the blade, back to the guard."""
    W = {'plant': True, 'axis': (.15, .35, -.9)}
    ready = dict(W, r={'Spine': (4, 0, 0), 'Chest': (4, 0, 0)}, R={'p': (-.10, -.21, .66), 'd': (.10, -.35, .93)}, L={'s': -.085})
    up = dict(W, r={'Spine': (-3, 0, -10), 'Chest': (-5, 0, -16), 'Head': (4, 0, 8), 'Hips': (0, 0, -4)}, root=(0, 0, .005),
              R={'p': (-.17, -.02, .98), 'd': (-.10, .55, .83)}, L={'s': -.085})
    mid = dict(W, r={'Spine': (6, 0, 0), 'Chest': (6, 0, 4), 'Hips': (0, 0, 0)}, root=(0, 0, -.01),
               R={'p': (-.13, -.19, .88), 'd': (.10, -.55, .83)}, L={'s': -.085}, ease='in')
    # the bite: the haft level and across to the left, the head at the trunk in front at hip height
    hit = dict(W, r={'Spine': (8, 0, 8), 'Chest': (8, 0, 16), 'Head': (-10, 0, -8), 'Hips': (2, 0, 6)}, root=(0, 0, -.035),
               R={'p': (-.07, -.24, .66), 'd': (.45, -.86, .26)}, L={'s': -.085}, ease='in')
    pull = dict(W, r={'Spine': (6, 0, 4), 'Chest': (5, 0, 9), 'Head': (-6, 0, -4), 'Hips': (1, 0, 3)}, root=(0, 0, -.025),
                R={'p': (-.10, -.21, .68), 'd': (.25, -.80, .55)}, L={'s': -.085}, ease='out')
    keys = [(1, ready), (11, up), (14, mid), (17, hit), (18, hit), (22, pull), (33, ready)]
    return Clip('Chop', 33, True, 'Axe', keys=keys, events={'contact': 17})


def mine():
    """Pickaxe at a rock face: lifted high over the head, brought down hard on the face in front at
    knee to waist height, the bite held, levered free."""
    W = {'plant': True, 'axis': (1, 0, 0)}
    ready = dict(W, r={'Spine': (6, 0, 0), 'Chest': (6, 0, 0)}, root=(0, 0, -.01), R={'p': (-.09, -.22, .64), 'd': (0, -.30, .95)}, L={'s': -.085})
    up = dict(W, r={'Spine': (-4, 0, -3), 'Chest': (-8, 0, -4), 'Head': (6, 0, 0)}, root=(0, 0, .004),
              R={'p': (-.10, -.03, 1.00), 'd': (0, .50, .87)}, L={'s': -.085})
    mid = dict(W, r={'Spine': (8, 0, 0), 'Chest': (8, 0, 0)}, root=(0, 0, -.02), R={'p': (-.09, -.18, .90), 'd': (0, -.50, .87)}, L={'s': -.085}, ease='in')
    # the bite: the point into the rock face in front at knee to thigh height, a stride ahead
    hit = dict(W, r={'Spine': (12, 0, 2), 'Chest': (12, 0, 2), 'Head': (-12, 0, 0), 'Hips': (4, 0, 0)}, root=(0, 0, -.06),
               R={'p': (-.07, -.26, .64), 'd': (0, -.94, -.06)}, L={'s': -.085}, ease='in')
    lever = dict(W, r={'Spine': (9, 0, 0), 'Chest': (8, 0, 0), 'Head': (-9, 0, 0), 'Hips': (3, 0, 0)}, root=(0, 0, -.05),
                 R={'p': (-.08, -.23, .70), 'd': (0, -.88, .30)}, L={'s': -.085}, ease='out')
    keys = [(1, ready), (10, up), (13, mid), (15, hit), (16, hit), (20, lever), (29, ready)]
    return Clip('Mine', 29, True, 'Pick', keys=keys, events={'contact': 15})


def harvest():
    """Sickle at the crop: bent low, the left hand gathers a handful of stalks, the sickle sweeps
    under it from right to left (cut), the handful goes up over the left shoulder (into the basket
    or the load the game draws), and down again."""
    W = {'plant': True}
    S = lambda p, d, f: {'p': p, 'd': d, 'f': f}  # noqa: E731
    low = {'Hips': (14, 0, 0), 'Spine': (16, 0, 0), 'Chest': (14, 0, 0), 'Head': (-24, 0, 0)}
    reach = dict(W, r=dict(low, Chest=(14, 0, 6)), root=(0, 0, -.10), R=S((-.21, -.18, .60), (-.25, -.55, -.80), (1, 0, 0)),
                 L={'p': (.05, -.30, .55), 'pole': (1, .2, -.6)})
    grab = dict(W, r=dict(low, Chest=(16, 0, 10)), root=(0, 0, -.11), R=S((-.25, -.12, .68), (-.55, -.45, -.60), (1, .3, 0)),
                L={'p': (.02, -.31, .53), 'pole': (1, .2, -.6)})
    cut = dict(W, r=dict(low, Chest=(16, 0, -12)), root=(0, 0, -.11), R=S((.06, -.27, .55), (.45, -.55, -.70), (1, .4, 0)),
               L={'p': (.04, -.27, .58), 'pole': (1, .2, -.6)}, ease='in')
    lift = dict(W, r={'Hips': (8, 0, 0), 'Spine': (8, 0, 0), 'Chest': (6, 0, -10), 'Head': (-12, 0, -6)}, root=(0, 0, -.06),
                R=S((-.18, -.18, .64), (-.20, -.55, -.80), (1, 0, 0)), L={'p': (.15, -.07, .96), 'pole': (1, .3, -.3)}, ease='out')
    toss = dict(W, r={'Hips': (6, 0, 0), 'Spine': (6, 0, 0), 'Chest': (4, 0, -12), 'Head': (-10, 0, -8)}, root=(0, 0, -.05),
                R=S((-.18, -.18, .64), (-.20, -.55, -.80), (1, 0, 0)), L={'p': (.14, .05, 1.00), 'pole': (1, .3, -.3)})
    keys = [(1, reach), (8, grab), (13, cut), (14, cut), (20, lift), (25, toss), (37, reach)]
    return Clip('Harvest', 37, True, 'Sickle', keys=keys, events={'cut': 13})


def hammer(name, tool, crouch, period, contact, two_hands=False, heavy=False):
    """Build (hammer at a wall or frame at waist height) and Repair (crouched, quicker, shorter
    blows): the left hand steadies the work (or holds the haft of a heavy sledge)."""
    W = {'plant': True, 'axis': (1, 0, 0)}
    low = crouch
    left = (lambda: {'s': -.054}) if two_hands else (lambda: {'p': (.05, -.27, .58 - low * .2), 'pole': (1, .2, -.6)})
    lift = .30 if heavy else .22
    ready = dict(W, r={'Spine': (5 + low * 60, 0, 0), 'Chest': (4 + low * 40, 0, 0)}, root=(0, 0, -low),
                 R={'p': (-.13, -.23, .66), 'd': (0, -.25, .97)}, L=left())
    up = dict(W, r={'Spine': (low * 60, 0, -4), 'Chest': (-4 + low * 40, 0, -10), 'Head': (4, 0, 4)}, root=(0, 0, -low + .004),
              R={'p': (-.17, -.08, .66 + lift), 'd': (0, .55, .83)}, L=left())
    mid = dict(W, r={'Spine': (5 + low * 60, 0, 0), 'Chest': (6 + low * 40, 0, 0)}, root=(0, 0, -low - .01),
               R={'p': (-.14, -.21, .84), 'd': (0, -.55, .83)}, L=left(), ease='in')
    # the blow: Build strikes the wall or frame level at waist height (2026-10-20: it struck about the knee);
    # Repair, crouched, strikes lower and downward
    if low:
        R_hit = {'p': (-.10, -.26, .62 + (.05 if heavy else 0)), 'd': (.05, -.96, -.25 + (.12 if heavy else 0))}
    else:
        R_hit = {'p': (-.10, -.25, .76), 'd': (.05, -.93, .36 + (.08 if heavy else 0))}  # (in the leaning chest's space: level in the world)
    hit = dict(W, r={'Spine': (9 + low * 60, 0, 2), 'Chest': (12 + low * 40, 0, 5), 'Head': (-10, 0, 0)}, root=(0, 0, -low - .02),
               R=R_hit, L=left(), ease='in')
    back = dict(W, r={'Spine': (7 + low * 60, 0, 0), 'Chest': (8 + low * 40, 0, 2)}, root=(0, 0, -low - .01),
                R={'p': (-.12, -.25, .66), 'd': (0, -.70, .70)}, L=left(), ease='out')
    q = period
    keys = [(1, ready), (contact - 6, up), (contact - 2, mid), (contact, hit), (contact + 1, hit), (contact + 4, back), (q + 1, ready)]
    return Clip(name, q + 1, True, tool, keys=keys, events={'contact': contact})


def deposit_basket():
    """Lean forward and tip the basket over the left shoulder: the load pours out in front (the
    game drops it on `pour`), then straighten."""
    W = {'plant': True}
    stand = dict(W)
    bend = dict(W, r={'Hips': (6, 0, 0), 'Spine': (10, 0, 4), 'Chest': (12, -6, 8), 'Head': (-8, 0, 4), 'Arm_L': (-20, 0, 0),
                      'Hand_R': (-22, 0, 0), 'Prop_Back': (14, 18, 0)}, root=(0, 0, -.03))
    tip = dict(W, r={'Hips': (10, 0, 0), 'Spine': (16, 0, 6), 'Chest': (18, -12, 12), 'Head': (-12, 0, 6), 'Arm_L': (-34, 0, -6),
                     'Forearm_L': (8, 0, 0), 'Hand_R': (-36, 0, 0), 'Prop_Back': (40, 62, 0)}, root=(0, 0, -.05), ease='in')
    back = dict(W, r={'Hips': (4, 0, 0), 'Spine': (6, 0, 2), 'Chest': (6, -4, 4), 'Head': (-4, 0, 2), 'Arm_L': (-10, 0, 0),
                      'Hand_R': (-11, 0, 0), 'Prop_Back': (6, 8, 0)}, root=(0, 0, -.015), ease='out')
    keys = [(1, stand), (8, bend), (16, tip), (17, tip), (24, back), (30, stand)]
    return Clip('Deposit', 30, False, 'Held', keys=keys, events={'pour': 16})


def deposit_barrow():
    """Tip the barrow forward over its wheel: the handles come up, the load slides out (pour), the
    barrow comes down again."""
    stand = {'plant': True, 'tilt': 0}
    lift = {'plant': True, 'tilt': 14, 'r': {'Spine': (-4, 0, 0)}, 'root': (0, 0, .004)}
    tip = {'plant': True, 'tilt': 26, 'r': {'Spine': (-8, 0, 0), 'Chest': (-4, 0, 0)}, 'root': (0, 0, .008), 'ease': 'in'}
    keys = [(1, stand), (9, lift), (15, tip), (16, tip), (23, lift), (30, stand)]
    return Clip('Deposit', 30, False, 'Held', keys=keys, events={'pour': 15}, barrow=True)


def deposit_shoulder():
    """Shrug the load off the left shoulder: lean forward and to the left, the left hand pushes it
    off in front (pour), straighten."""
    sledge = {'p': (-.165, -.150, .835), 'd': (.03, .95, .30), 'f': (1, 0, 0)}
    on = {'plant': True, 'R': sledge, 'L': {'p': (.150, -.060, .905), 'pole': (1, -.2, -1)}}
    lean = {'plant': True, 'R': sledge, 'r': {'Spine': (8, 0, 0), 'Chest': (10, -10, 8), 'Head': (-6, 0, 0)}, 'root': (0, 0, -.02),
            'L': {'p': (.16, -.12, .90), 'pole': (1, -.2, -1)}}
    push = {'plant': True, 'R': sledge, 'r': {'Spine': (16, 0, 0), 'Chest': (18, -14, 14), 'Head': (-10, 0, 0)}, 'root': (0, 0, -.05),
            'L': {'p': (.10, -.30, .66), 'pole': (1, .2, -1)}, 'ease': 'in'}
    keys = [(1, on), (9, lean), (15, push), (16, push), (24, lean), (30, on)]
    return Clip('Deposit', 30, False, 'Held', keys=keys, events={'pour': 15})


def hit(kind):
    W = {'plant': True}
    recoil = dict(W, r={'Spine': (-5, 0, -3), 'Chest': (-12, 0, -9), 'Head': (-12, 0, 6), 'Hips': (-2, 0, 0)}, root=(0, 0, -.015), ease='out')
    keys = [(1, dict(W)), (3, recoil), (5, dict(recoil, root=(0, 0, -.02))), (8, dict(W))]
    if kind == 'sledge':
        keys = [(f, dict(s, R={'p': (-.165, -.150, .835), 'd': (.03, .95, .30), 'f': (1, 0, 0)})) for f, s in keys]
    return Clip('Hit', 8, False, 'Held', keys=keys, barrow=(kind == 'barrow'))


def death(kind, name='Death', flip=False):
    """Struck, the knees buckle, the body topples (forward; backward away from a barrow) and lies
    still from the settle frame on. The lowest point stays on the ground every frame."""
    sign = -1 if kind == 'barrow' else 1  # +X: the top falls forward (-Y)
    roll = 34 if flip else 0  # DeathAlt (2026-10-20): the same fall, twisted down onto the right side
    W = {'plant': True}
    struck = dict(W, r={'Spine': (-6, 0, -4), 'Chest': (-14, 0, -10), 'Head': (-14, 0, 6), 'Arm_L': (-10, 0, -8), 'Arm_R': (-6, 0, 8)},
                  root=(0, 0, -.02), ease='out')
    buckle = dict(W, r={'Spine': (14 * sign, 0, 4), 'Chest': (10 * sign, 0, 6), 'Head': (12 * sign, 0, 0), 'Arm_L': (-14, 0, -12),
                        'Arm_R': (-10, 0, 12), 'Hand_R': (50 if sign > 0 else 0, 0, 0), 'Hips': (6 * sign, 0, 0)}, root=(0, 0, -.16))
    legs = {'Leg_L': (-30, 0, 0), 'Leg_R': (-24, 0, 0), 'Shin_L': (44, 0, 0), 'Shin_R': (38, 0, 0)}
    fall = {'r': dict(legs, Root=(52 * sign, roll * .6, 6), Spine=(6 * sign, 0, 4), Chest=(4 * sign, 0, 4), Head=(6 * sign, 0, 0),
                      Arm_L=(-26, 0, -26), Arm_R=(-20, 0, 26), Hand_R=(60 if sign > 0 else 0, 0, 0)), 'ease': 'in'}
    down = {'r': {'Root': (90 * sign, roll, 8), 'Leg_L': (-4, 0, 0), 'Leg_R': (-2, 0, 2), 'Shin_L': (14, 0, 0), 'Shin_R': (8, 0, 0),
                  'Spine': (-4 * sign, 0, 2), 'Chest': (-2 * sign, 0, 0), 'Head': (-14 * sign, 0, 0), 'Arm_L': (-12, 0, -30), 'Arm_R': (-8, 0, 30)},
            'ease': 'in'}
    bounce = {'r': dict(down['r'], Root=(86 * sign, roll, 8), Chest=(-6 * sign, 0, 0), Head=(-20 * sign, 0, 0)), 'ease': 'out'}
    still = {'r': dict(down['r'], Root=(89 * sign, roll, 8), Head=(-12 * sign, 0, 18 * sign))}
    keys = [(1, dict(W)), (4, struck), (10, buckle), (16, fall), (21, down), (24, bounce), (28, still), (30, still)]
    if kind == 'barrow':
        keys = [(f, dict(s, free=True)) for f, s in keys]
    else:  # the held tool slips round in the fist and lies along the ground beside him
        flat = {16: .5, 21: 1, 24: 1, 28: 1, 30: 1}
        keys = [(f, dict(s, flat=flat.get(f, 0))) for f, s in keys]
    return Clip(name, 30, False, 'Held', keys=keys, ground='all', events={'settle': 30}, barrow=(kind == 'barrow'))


# ---- the food jobs and the win (2026-10-20): Pick (berries), Fish, Herd, Cheer -------------------------------------
# One Harvest swing used to stand for every food node; the game asks for these by node (clipPlayer.js
# NODE_ROLE: berries pick, fish fish, herd and cattle herd; farm keeps Harvest).

def pick(kind):
    """Berries: leaning in to the bush, the left hand reaches in low in front, plucks, and drops the handful
    over the left shoulder into the basket (a barrow man or a sledge man picks with both hands, the tool put
    down)."""
    W = {'plant': True}
    hide = {}
    lean = {'Hips': (6, 0, 0), 'Spine': (10, 0, 4), 'Chest': (8, 0, 6), 'Head': (-14, 0, 2)}
    reach = dict(W, **hide, r=lean, root=(0, 0, -.04), L={'p': (.08, -.33, .52), 'pole': (1, .2, -.6)})
    pluck = dict(W, **hide, r=dict(lean, Chest=(9, 0, 8)), root=(0, 0, -.045), L={'p': (.06, -.29, .56), 'pole': (1, .2, -.6)}, ease='out')
    up = dict(W, **hide, r={'Hips': (3, 0, 0), 'Spine': (4, 0, 0), 'Chest': (2, 0, -8), 'Head': (-8, 0, -8)}, root=(0, 0, -.02),
              L={'p': (.15, -.04, .98), 'pole': (1, .3, -.3)}, ease='io')
    drop = dict(up, L={'p': (.14, .05, 1.00), 'pole': (1, .3, -.3)})
    if kind != 'basket':  # the right hand picks too, a beat behind
        reach['R'] = {'p': (-.06, -.32, .56), 'd': (0, 0, 1)}
        pluck['R'] = {'p': (-.08, -.34, .50), 'd': (0, 0, 1)}
        up['R'] = drop['R'] = {'p': (-.06, -.30, .58), 'd': (0, 0, 1)}
    keys = [(1, reach), (7, pluck), (8, pluck), (15, up), (19, drop), (25, dict(reach, ease='io')), (33, reach)]
    return Clip('Pick', 33, True, 'Held' if kind == 'basket' else 'None', keys=keys, events={'cut': 7})  # ('None': empty-handed)


def fish(kind):
    """At the water's edge: a throwing net swung back low and cast out in front (cast), then the line drawn
    in hand over hand to the chest, and again. The held tool is laid down (hidden) for the clip."""
    W = {'plant': True}
    crouch = {'Hips': (8, 0, 0), 'Spine': (12, 0, 0), 'Chest': (8, 0, 0), 'Head': (-16, 0, 0)}

    def both(rp, lp):
        return {'R': {'p': rp, 'd': (0, -.3, .95)}, 'L': {'p': lp, 'pole': (1, .2, -.6)}}
    back = dict(W, r=dict(crouch, Chest=(6, 0, -18), Spine=(10, 0, -10)), root=(0, 0, -.06), **both((-.24, .02, .52), (.02, -.02, .54)))
    swing = dict(W, r=dict(crouch, Chest=(4, 0, 10)), root=(0, 0, -.04), ease='in', **both((-.12, -.30, .78), (.10, -.30, .80)))
    cast = dict(W, r={'Hips': (4, 0, 0), 'Spine': (4, 0, 4), 'Chest': (-2, 0, 12), 'Head': (-8, 0, 0)}, root=(0, 0, -.02),
                **both((-.10, -.36, .92), (.12, -.36, .94)))

    def haul(f, k):
        return (f, dict(W, r=crouch, root=(0, 0, -.06), **both((-.06, -.34 + .16 * k, .62 + .06 * k), (.08, -.18 - .16 * k, .68 - .06 * k))))
    keys = [(1, back), (6, swing), (9, cast), (10, cast), (14, dict(cast, ease='out'))]
    keys += [haul(f, i % 2) for i, f in enumerate(range(18, 38, 4))] + [(41, back)]
    return Clip('Fish', 41, True, 'None', keys=keys, events={'cast': 9})  # the tool laid down: empty-handed


def herd(kind):
    """Driving a herd: the tool held low as a goad and swept out to the right and back, the free arm thrown
    out to turn the beasts, the head following them; a barrow man waves both arms, the barrow set down."""
    W = {'plant': True}
    if kind != 'basket':  # the barrow set down, the sledge laid down: both arms wave
        a = dict(W, r={'Chest': (0, 0, 12), 'Head': (-4, 0, 20), 'Arm_L': (-60, 0, -40), 'Arm_R': (-30, 0, 20)})
        b = dict(W, r={'Chest': (0, 0, -12), 'Head': (-4, 0, -20), 'Arm_L': (-30, 0, -20), 'Arm_R': (-60, 0, 40)})
        keys = [(1, dict(W)), (11, a), (21, dict(W)), (31, b), (41, dict(W))]
        return Clip('Herd', 41, True, 'None', keys=keys)

    def goad(x, y, d):
        return {'p': (x, y, .60), 'd': d}
    out = dict(W, r={'Spine': (4, 0, -6), 'Chest': (4, 0, -16), 'Head': (-6, 0, -24)}, R=goad(-.20, -.26, (-.55, -.65, -.52)),
               L={'p': (.30, -.10, .80), 'pole': (1, .3, -.3)}, ease='io')
    mid = dict(W, r={'Spine': (3, 0, 0), 'Chest': (3, 0, 0), 'Head': (-4, 0, 0)}, R=goad(-.14, -.28, (-.10, -.80, -.58)),
               L={'p': (.18, -.14, .70), 'pole': (1, .3, -.6)})
    tap = dict(W, r={'Spine': (6, 0, 6), 'Chest': (6, 0, 10), 'Head': (-8, 0, 14)}, R=goad(-.08, -.30, (.30, -.75, -.58)),
               L={'p': (.20, -.06, .64), 'pole': (1, .3, -.6)}, ease='io')
    keys = [(1, mid), (11, out), (21, mid), (31, tap), (41, mid)]
    return Clip('Herd', 41, True, 'Held', keys=keys)


def cheer(kind):
    """The win: the tool raised high in the right fist and shaken twice, the head up (a barrow man punches the
    air with his left fist, the right on the handle)."""
    W = {'plant': True}
    if kind == 'barrow':  # the right fist stays on its handle, the left lets go (free_left) and punches the air twice
        W = dict(W, free_left=True)
        lo = dict(W, r={'Spine': (-1, 0, 0), 'Chest': (-3, 0, 0), 'Head': (-6, 0, 0)}, root=(0, 0, .002),
                  L={'p': (.21, -.10, .86), 'pole': (1, .2, -.4)})
        hi = dict(W, r={'Spine': (-6, 0, 0), 'Chest': (-12, 0, -6), 'Head': (-22, 0, -8)}, root=(0, 0, .022),
                  L={'p': (.17, -.05, 1.24), 'pole': (1, .4, -.2)}, ease='out')
        return Clip('Cheer', 33, True, 'Held', keys=[(1, lo), (9, hi), (17, lo), (25, hi), (33, lo)], barrow=True)
    hi = dict(W, r={'Spine': (-3, 0, 0), 'Chest': (-6, 0, 0), 'Head': (-12, 0, 0)}, root=(0, 0, .008), R={'p': (-.18, -.08, 1.04), 'd': (0, -.15, .99)},
              L={'p': (.20, -.10, .80), 'pole': (1, .3, -.3)})
    lo = dict(W, r={'Spine': (-1, 0, 0), 'Chest': (-2, 0, 0), 'Head': (-5, 0, 0)}, root=(0, 0, .002), R={'p': (-.19, -.10, .90), 'd': (0, -.15, .99)},
              L={'p': (.20, -.12, .72), 'pole': (1, .3, -.3)})
    return Clip('Cheer', 33, True, 'Held', keys=[(1, lo), (9, hi), (17, lo), (25, hi), (33, lo)])  # (a closed loop from the low pose)


def library(kind, build_tool='Hammer'):
    """The twelve clips for one worker. kind: 'basket' (a load on the back, the held tool upright
    in the right fist: Bronze, Classical, Kingdoms), 'barrow' (Gunpowder: pushing a barrow),
    'sledge' (Modern: a sledgehammer; it builds and repairs with it)."""
    heavy = build_tool == 'Held'
    clips = [idle(kind),
             gait('Walk', 20, 19, 42, 2, kind),
             gait('Run', 14, 30, 74, 9, kind, run=True, arms=10),
             gait('Carry', 24, 14, 32, 7, kind, carry=True),
             chop(), mine(), harvest(),
             hammer('Build', build_tool, 0.0, 24, 15, two_hands=heavy, heavy=heavy),
             hammer('Repair', build_tool, .07, 20, 11, two_hands=heavy, heavy=heavy),
             deposit_barrow() if kind == 'barrow' else deposit_shoulder() if kind == 'sledge' else deposit_basket(),
             hit(kind), death(kind),
             pick(kind), fish(kind), herd(kind), death(kind, 'DeathAlt', flip=True), cheer(kind)]
    return clips


# ---- one call from a builder -------------------------------------------------------------------------

def setup_tools(style, held=None, wheel=None):
    """Tool bones and the four work tools for the current figure (after its bake_rest and shade):
    the old Prop_R parts go to Tool_Held. `wheel`: (axle point, [object names]) for a barrow's wheel.
    Returns (tool frames, held frame, the new tool objects)."""
    arm = F.arm
    G, ax = rest_grip('R')
    a, f = tool_frame(ax)
    which = [t for t in WORK_TOOLS if not (held and t in held)]
    extra = [('Tool_Wheel', wheel[0], wheel[0] + Vector((.08, 0, 0)), 'Tool_Held')] if wheel else None
    add_tool_bones(arm, G, a, ['Held'] + which, extra)
    reweight_held()
    if wheel:
        for ob in F.meshes:
            if ob.name in wheel[1]:
                ob.vertex_groups['Tool_Held'].name = 'Tool_Wheel'
    objs = build_tools(G, a, f, style, which)
    fix_tool_normals(objs)
    shade_tools(objs)
    F.meshes.extend(objs)
    return {t: (a, f) for t in which}, objs


def author(kind, tool_frames, held_frame, build_tool='Hammer', barrow=None):
    P = Poser(F.arm, tool_frames, held_frame)
    A = Author(F.arm, P, F.meshes, barrow)
    bpy.context.scene.render.fps = FPS
    return A.run(library(kind, build_tool))


def finish_worker(uid, look, style, kind, held_frame=None, build_tool='Hammer', wheel=None, budget=2000, notes=None):
    """The end of a worker builder (as F.finish_rest, plus the tools and the clips): normals and the
    body's baked shade first (so the new tools change none of it), the tools, the twelve clips, the
    floor pass, the root empty named after the unit, the GLB with its clips, the options file
    <uid>.json with the clip table, clips.json and a report in art-build/units/<uid>/.
    TI_SHEETS=1 also renders the contact sheets into plans/art-pilot/worker-clips (TI_SHEETS=side:
    from the side too)."""
    out = u.out_dir(uid)
    F.fix_normals(F.facing, F.radial)
    shade = F.bake_shade()
    G, ax = rest_grip('R')
    held_frame = held_frame or tool_frame(ax)
    tool_frames, objs = setup_tools(style, held=('Hammer',) if build_tool == 'Held' else None, wheel=wheel)
    table = author(kind, tool_frames, held_frame, build_tool, {'axle': Vector(wheel[0])} if wheel else None)
    scene = bpy.context.scene
    scene.render.fps = FPS
    arm = F.arm
    floor = u.ground_actions(arm, F.meshes)
    arm.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    F.normalize_weights()
    tris = u.triangles(F.meshes)
    assert tris <= budget, (tris, sorted(((u.triangles([o]), o.name) for o in F.meshes), reverse=True)[:24])
    arm.name = 'UnitRig'
    root = u.assemble(uid, [arm])
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{uid}.blend'))
    F.export_glb(out / f'{uid}.glb', animations=True, extra=[root])
    mats = sorted({s.material.name for o in F.meshes for s in o.material_slots if s.material})
    report = {'id': uid, 'triangles': tris, 'budget': budget, 'objects': len(F.meshes), 'materials': mats,
              'colors': {k: u.COLORS[k] for k in mats if k in u.COLORS}, 'textures': 0, 'mounted': False,
              'bones': [b.name for b in arm.data.bones], 'pose': 'rest pose = Idle frame 1; twelve work clips (ti_worker_clips.py)',
              'front': 'Blender -Y, glTF +Z', 'shade_range': shade, 'look': look, 'floor': floor, **(notes or {}),
              'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
              'by_object': {o.name: u.triangles([o]) for o in F.meshes}}
    (out / 'source-report.json').write_text(json.dumps(report, indent=2))
    (out / 'clips.json').write_text(json.dumps({'fps': FPS, 'clips': table}, indent=2))
    (out / f'{uid}.json').write_text(options(table))
    if os.environ.get('TI_SHEETS'):
        dest = u.REPO / 'plans' / 'art-pilot' / 'worker-clips'
        render_sheets(dest, uid, table, arm)
        if os.environ.get('TI_SHEETS') == 'side':
            render_sheets(dest, uid, table, arm, view='side')
    print('FINISHED', out, 'TRIANGLES', tris, 'SHADE', shade, 'FLOOR', json.dumps(floor), flush=True)
    return tris


def options(table, extra=None):
    """The unit's options file (src/assets/units/<uid>.json): the bake options plus the clip table."""
    return C.options_json(table, CLIP_ORDER, extra)


# ---- contact sheets ------------------------------------------------------------------------------------

def render_sheets(out_dir, uid, table, arm, cols=8, cell=(190, 220), team='2F6FD0', view='game'):
    """Workbench stills of every clip from the battle camera (ti_clips.render_sheets), two sheets:
    moving and work. Written to out_dir/<uid>-<sheet>.png."""
    return C.render_sheets(out_dir, uid, table, arm, cols, cell, team, view, sheets=SHEETS)
