# scripts/blender/ti_stone_map.py
# Stone Age parts (eight-ages plan U90, U91) on the town kit (ti_town.py) and the outposts' camp
# parts (build_map_outposts.py): round wattle-and-daub huts under conical thatch, hide tents and
# lean-tos, drying racks with hides, meat or fish, dugout canoes with paddlers, digging-stick garden
# beds, stumps of a cleared wood, stone cairns, carved totem poles, bone and antler heaps and the
# palisade on its earth bank. Scale as the town kit: 1 unit = 10 m, heights raised 1.3x, front -Y.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402  (registers bark, hide, horn, fish, foliage...)
import ti_bronze as tb  # noqa: E402
import build_map_outposts as bo  # noqa: E402  (registers op_hide, op_ember...; cone_tent, fire_pit)
from ti_town import G  # noqa: E402

NEW = ['st_daub', 'st_flint', 'st_skin', 'st_ochre', 'st_meat', 'st_tilled', 'st_sprout']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    s = tm.mat_simple
    s('st_daub', ['#8e6a46', '#a07a52', '#7e5c3c', '#b08a60'], scale=16.0, bump=0.5, dirt=True)
    s('st_flint', ['#3c3a38', '#4e4b48', '#2e2c2a'], scale=30.0, rough=0.5, bump=0.3)
    s('st_skin', ['#9a6a48', '#a87656', '#8a5c3e'], scale=20.0, bump=0.1)
    s('st_ochre', ['#9c3a22', '#b04a2a', '#d0b48a', '#2a2420'], scale=14.0, bump=0.3)
    s('st_meat', ['#6a2a1e', '#7e3626', '#5a2018'], scale=24.0, bump=0.3)
    s('st_tilled', ['#4e3624', '#5e4230', '#42301e'], scale=30.0, bump=0.7)
    s('st_sprout', ['#4e7a2a', '#6a8e34', '#86a040', '#3e6224'], scale=50.0, bump=0.6)


if not any(n == 'stone' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('stone', make_materials))

WORLD = tm.house_frame(0, 0, 0)
cone_tent = bo.cone_tent
fire_pit = bo.fire_pit
stakes_arc = bo.stakes_arc
pole_pennant = bo.pole_pennant


# ---- budget trim (build_improvement_fort_classical.py) -------------------------------------------

def _levels(p):
    _bm, _mat, lod, only = p
    if isinstance(only, int):
        only = (only,)
    return tuple(i for i in (0, 1, 2) if (only is None and i <= lod) or (only is not None and i in only))


def shown_tris(ms, lod):
    return sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in ms.parts if lod in _levels(p))


def trim(ms, lod, budget):
    """Decimate the parts shown at `lod` when the object is over its budget there."""
    import bpy
    total = shown_tris(ms, lod)
    if total <= budget:
        return
    ratio = (budget - 20) / total
    rest = []
    for p in ms.parts:
        bm, mat, maxlod, _only = p
        lv = _levels(p)
        if lod not in lv:
            rest.append(p)
            continue
        others = tuple(i for i in lv if i != lod)
        if others:
            rest.append((bm.copy(), mat, maxlod, others))
        me = bpy.data.meshes.new('_trim'); bm.to_mesh(me)
        ob = bpy.data.objects.new('_trim', me); bpy.context.collection.objects.link(ob)
        mod = ob.modifiers.new('budget', 'DECIMATE'); mod.ratio = max(0.02, ratio)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        reduced = bmesh.new(); reduced.from_mesh(ev.to_mesh()); ev.to_mesh_clear()
        rest.append((reduced, mat, maxlod, (lod,)))
        bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me); bm.free()
    ms.parts[:] = rest


def on_ground(ms):
    """Nothing below the ground or the waterline (validate_model.py): hulls, paddles and weir stakes
    flattened at z = 0, where the game's water surface hides the cut."""
    for p in ms.parts:
        for v in p[0].verts:
            if v.co.z < 0:
                v.co.z = 0.0


def budgeted(layout, budgets=(7600, 1400, 280)):
    """A layout that ends trimmed to the improvements' budget (8,000 / 1,500 / 300 with room)."""
    def run(ms, rng):
        out = layout(ms, rng)
        on_ground(ms)
        for lod, b in zip((0, 1, 2), budgets):
            trim(ms, lod, b)
        on_ground(ms)  # the trim can move a vertex a hair under
        return out
    return run


# ---- dwellings -------------------------------------------------------------------------------------

def round_hut(ms, x, y, r=0.3, wall=0.18, top=0.56, yaw=0.0, wall_mat='st_daub', roof='thatch'):
    """A round wattle-and-daub hut under a conical thatch roof with a smoke hole, the door to -Y.
    LOD0 and LOD1 at ten sides, LOD2 at six."""
    f = tm.house_frame(x, y, yaw)
    for segs, only in ((10, (0, 1)), (6, (2,))):
        ms.cyl(wall_mat, r, r * 0.98, wall, at=(0, 0, G), segs=segs, lod=2, frame=f, caps=False, only=only)
        ms.cyl(roof, r * 1.22, r * 0.1, top - G - wall + 0.02, at=(0, 0, G + wall - 0.03), segs=segs, lod=2, frame=f, only=only)
    ms.cyl('dark', r * 0.11, r * 0.06, 0.03, at=(0, 0, top - 0.02), segs=6, lod=0, frame=f)  # the smoke hole's rim
    ms.box('dark', (r * 0.42, 0.012, wall * 0.86), at=(0, -r - 0.002, G), lod=1, frame=f)
    ms.box('timber', (r * 0.56, 0.02, 0.022), at=(0, -r - 0.006, G + wall * 0.86), lod=0, frame=f)  # the lintel
    for k in range(6):  # roof poles poking through at the top
        a = 2 * math.pi * k / 6
        tn.limb(ms, 'timber', (math.cos(a) * r * 0.12, math.sin(a) * r * 0.12, top - 0.04), (math.cos(a) * r * 0.2, math.sin(a) * r * 0.2, top + 0.06), 0.006, 0.005, segs=4, lod=0)
    return f


def lean_to(ms, x, y, yaw, w=0.42, d=0.26, h=0.26, mat='op_hide'):
    """A lean-to of hides on two forked posts and a ridge pole, open to the front (-Y)."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-w / 2, w / 2):
        ms.cyl('timber', 0.011, 0.009, h + 0.03, at=(sx, -d / 2, G), segs=5, lod=1, frame=f)
    tn.limb(ms, 'timber', f @ Vector((-w / 2 - 0.04, -d / 2, G + h)), f @ Vector((w / 2 + 0.04, -d / 2, G + h)), 0.009, 0.009, segs=5, lod=1)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w / 2, -d / 2, G + h), (w / 2, -d / 2, G + h), (w / 2, d / 2, G), (-w / 2, d / 2, G))]
    bm.faces.new(v)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
    ms.add(bm, mat, 2, matrix=f)
    for sx in (-1, 1):  # side flaps
        bm = bmesh.new()
        t = [bm.verts.new(p) for p in ((sx * w / 2, -d / 2, G + h), (sx * w / 2, d / 2, G), (sx * w / 2, -d / 2, G))]
        bm.faces.new(t if sx > 0 else list(reversed(t)))
        ms.add(bm, mat, 1, matrix=f)


def hide_frame(ms, x, y, yaw, w=0.2, h=0.22, mat='hide_pale'):
    """A hide stretched on a square frame of poles, leaning back on a prop."""
    f = tm.house_frame(x, y, yaw) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    for sx in (-w / 2, w / 2):
        tn.limb(ms, 'timber', f @ Vector((sx, 0, G - 0.01)), f @ Vector((sx, 0, G + h + 0.03)), 0.007, 0.006, segs=4, lod=1)
    for z in (G + 0.03, G + h):
        tn.limb(ms, 'timber', f @ Vector((-w / 2 - 0.02, 0, z)), f @ Vector((w / 2 + 0.02, 0, z)), 0.006, 0.006, segs=4, lod=0)
    bm = bmesh.new()  # the hide: a rough outline, laced inside the frame
    pts = [(-w * 0.42, G + 0.05), (-w * 0.3, G + 0.02), (w * 0.3, G + 0.02), (w * 0.43, G + 0.06), (w * 0.4, G + h * 0.55),
           (w * 0.44, G + h - 0.02), (0, G + h - 0.035), (-w * 0.44, G + h - 0.02), (-w * 0.4, G + h * 0.55)]
    bm.faces.new([bm.verts.new((px, 0.002, pz)) for px, pz in pts])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.006)
    ms.add(bm, mat, 1, matrix=f)


def drying_rack(ms, x, y, yaw, w=0.4, h=0.2, hang='st_meat', n=6, fish=False):
    """Two forked posts and a cross pole hung with strips of meat (or split fish)."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-w / 2, w / 2):
        for lean in (-1, 1):  # each end an A of two poles
            tn.limb(ms, 'timber', f @ Vector((sx, lean * 0.05, G - 0.005)), f @ Vector((sx, 0, G + h + 0.02)), 0.006, 0.005, segs=4, lod=1)
    tn.limb(ms, 'timber', f @ Vector((-w / 2 - 0.03, 0, G + h)), f @ Vector((w / 2 + 0.03, 0, G + h)), 0.006, 0.006, segs=4, lod=1)
    for k in range(n):
        px = -w / 2 + w * (k + 0.5) / n
        if fish:
            ms.box('fish', (0.028, 0.006, 0.07), at=(px, 0, G + h - 0.075), lod=0, frame=f, taper=0.5)
        else:
            ms.box(hang, (0.022, 0.006, 0.09 if k % 2 else 0.07), at=(px, 0, G + h - (0.09 if k % 2 else 0.07)), lod=0, frame=f)
    ms.add(_flat(w * 0.85, 0.07), 'fish' if fish else hang, 1, matrix=f @ Matrix.Translation(Vector((0, 0, G + h - 0.08))), only=(1,))


def _flat(w, h):
    """A two-sided upright rectangle w wide from z 0 to h (a rack's hang at LOD1)."""
    bm = bmesh.new()
    a = [bm.verts.new(p) for p in ((-w / 2, 0, 0), (w / 2, 0, 0), (w / 2, 0, h), (-w / 2, 0, h))]
    bm.faces.new(a)
    bm.faces.new([bm.verts.new(v.co) for v in reversed(a)])
    return bm


def totem(ms, x, y, h=0.62, r=0.035, team=True, lod=2):
    """A carved and ochre-painted totem pole: stacked bulges, a beak and two side wings, a Team
    hide streamer near the top."""
    f = tm.house_frame(x, y, 0)
    prof = [(r * 1.15, G - 0.01), (r, G + 0.05)]
    n = 4
    for k in range(n):
        z0 = G + 0.05 + (h - 0.08) * k / n
        z1 = G + 0.05 + (h - 0.08) * (k + 1) / n
        prof += [(r * 1.18, z0 + (z1 - z0) * 0.3), (r * 1.05, z0 + (z1 - z0) * 0.7), (r * 0.9, z1)]
    prof += [(r * 0.5, G + h), (0.0, G + h + 0.01)]
    ms.lathe('st_ochre', prof, at=(x, y, 0), segs=6, lod=1)
    ms.cyl('st_ochre', r * 1.1, r * 0.8, h, at=(0, 0, G), segs=5, lod=2, frame=f, only=(2,))
    ms.box('st_ochre', (r * 0.6, r * 1.6, r * 0.6), at=(0, -r * 1.3, G + h * 0.7), lod=0, frame=f, taper=0.4)  # the beak
    ms.box('st_ochre', (r * 4.6, r * 0.4, r * 1.4), at=(0, 0, G + h * 0.82), lod=0, frame=f, taper=0.7)  # the wings
    for k in range(3):
        ms.box('dark', (r * 0.5, 0.004, r * 0.3), at=(0, -r * 1.12, G + 0.1 + k * h * 0.22), lod=0, frame=f)  # carved eyes
    if team:
        tt.pennant(ms, f, 0.0, 0.0, G + h - 0.02, yaw=-150, lod=1, w=0.16, h=0.1)


def cairn(ms, rng, x, y, r=0.06, h=0.1, lod=2):
    """A heap of fieldstones, a pale capstone on top."""
    tn.blob(ms, 'stone', (x, y, G), r, (1.0, 1.0, h / r * 0.9), rng, 0.2, 1, lod=lod, cut=0.0)
    for k in range(5):
        a = 2 * math.pi * k / 5 + rng.uniform(-0.3, 0.3)
        tn.blob(ms, 'stone', (x + math.cos(a) * r * 0.95, y + math.sin(a) * r * 0.95, G + 0.005), r * 0.36, (1.1, 1.0, 0.8), rng, 0.2, 1, lod=0)
    tn.blob(ms, 'rock', (x, y, G + h * 0.95), r * 0.38, (1.2, 1.0, 0.6), rng, 0.15, 1, lod=0)


def bone_heap(ms, rng, x, y, s=1.0):
    """A heap of mammoth bones and antlers: a few long bones, two curved tusks, a skull."""
    tn.blob(ms, 'horn', (x, y, G + 0.01 * s), 0.045 * s, (1.3, 1.0, 0.75), rng, 0.15, 1, lod=1)  # the skull
    for k in range(5):
        a = rng.uniform(0, 2 * math.pi)
        c = Vector((x + math.cos(a) * 0.03 * s, y + math.sin(a) * 0.03 * s, G + 0.012 * s))
        d = Vector((math.cos(a + 1.2), math.sin(a + 1.2), 0.08)) * 0.09 * s
        tn.limb(ms, 'horn', c - d, c + d, 0.008 * s, 0.006 * s, segs=4, lod=0)
    for sx in (-1, 1):  # tusks curving up
        p0 = Vector((x + sx * 0.02 * s, y - 0.03 * s, G + 0.02 * s))
        p1 = p0 + Vector((sx * 0.04, -0.06, 0.05)) * s
        p2 = p1 + Vector((sx * 0.04, -0.01, 0.06)) * s
        tn.limb(ms, 'horn', p0, p1, 0.011 * s, 0.009 * s, segs=5, lod=1)
        tn.limb(ms, 'horn', p1, p2, 0.009 * s, 0.003 * s, segs=5, lod=0)


def stump(ms, x, y, r=0.025, h=0.035):
    ms.cyl('bark', r * 1.15, r, h, at=(x, y, G - 0.005), segs=6, lod=0, caps=False)
    ms.cyl('cut_wood', r, r, 0.002, at=(x, y, G + h - 0.006), segs=6, lod=0)


def garden_bed(ms, rng, x, y, w, d, yaw, crop='st_sprout', mounds=(4, 3)):
    """A digging-stick garden: a dark tilled plot in a ring of pulled stones, planted in mounds
    (LOD0), as one low block at LOD1 and LOD2."""
    f = tm.house_frame(x, y, yaw)
    ms.box('st_tilled', (w, d, 0.012), at=(0, 0, G - 0.004), lod=0, frame=f, taper=0.96)
    nx, ny = mounds
    for i in range(nx):
        for j in range(ny):
            px = -w / 2 + w * (i + 0.5) / nx + rng.uniform(-0.012, 0.012)
            py = -d / 2 + d * (j + 0.5) / ny + rng.uniform(-0.012, 0.012)
            ms.sphere('st_tilled', min(w / nx, d / ny) * 0.36, at=(px, py, G + 0.006), scale=(1, 1, 0.55), u=6, v=3, lod=0, frame=f, cut_below=0)
            ms.sphere(crop, min(w / nx, d / ny) * 0.25, at=(px, py, G + 0.02), scale=(1, 1, 0.9), u=5, v=3, lod=0, frame=f, cut_below=0)
    ms.add(tb._block(crop, 0, 0, w * 0.95, d * 0.95, 0.03), crop, 2, matrix=f @ Matrix.Translation(Vector((0, 0, -0.004))), only=(1, 2))
    for k in range(int((w + d) * 2 / 0.07)):  # the stones pulled from the plot, along its edge
        t = k * 0.07 / (2 * (w + d))
        p = t * 2 * (w + d)
        if p < w:
            px, py = -w / 2 + p, -d / 2 - 0.02
        elif p < w + d:
            px, py = w / 2 + 0.02, -d / 2 + p - w
        elif p < 2 * w + d:
            px, py = w / 2 - (p - w - d), d / 2 + 0.02
        else:
            px, py = -w / 2 - 0.02, d / 2 - (p - 2 * w - d)
        if rng.random() < 0.7:
            ms.sphere('stone', 0.014, at=(px, py, G), scale=(1.2, 1, 0.7), u=5, v=3, lod=0, frame=f)


def wattle_fence(ms, rng, r, a0, a1, step=6.0, h=0.12, gaps=(), cy=0.0):
    """A low fence of posts with woven withy panels between them along a circle (degrees)."""
    pts = []
    a = a0
    while a <= a1 + 1e-6:
        pts.append((a, r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))))
        a += step
    for i, (a, x, y) in enumerate(pts):
        if any(g0 <= a <= g1 for g0, g1 in gaps):
            continue
        ms.cyl('timber', 0.008, 0.007, h + 0.03, at=(x, y, G - 0.005), segs=4, lod=0, caps=False)
        if i + 1 < len(pts) and not any(g0 <= pts[i + 1][0] <= g1 for g0, g1 in gaps):
            _, nx, ny = pts[i + 1]
            ln = math.hypot(nx - x, ny - y)
            yaw = math.degrees(math.atan2(ny - y, nx - x))
            ms.box('reed', (ln, 0.012, h * rng.uniform(0.85, 1.0)), at=((x + nx) / 2, (y + ny) / 2, G - 0.004), rot_z=yaw, lod=1)


def digging_sticks(ms, x, y, n=3):
    for k in range(n):
        a = math.radians(-20 + 20 * k)
        tn.limb(ms, 'timber', (x + 0.02 * k, y, G), (x + 0.02 * k + 0.05 * math.sin(a), y + 0.03, G + 0.15), 0.004, 0.003, segs=4, lod=0)


def basket(ms, x, y, s=1.0):
    ms.lathe('reed', [(0.0, G), (0.022 * s, G), (0.03 * s, G + 0.03 * s), (0.026 * s, G + 0.045 * s), (0.0, G + 0.04 * s)], at=(x, y, 0), segs=8, lod=0)


def tree(ms, rng, x, y, h=0.5, crown=0.17, leaf='foliage'):
    """A broadleaf tree at (x, y) (ti_nature.broadleaf builds it at the origin)."""
    first = len(ms.parts)
    tn.broadleaf(ms, rng, h, crown, 0.018, leaf=leaf, blobs=3)
    for bm, *_ in ms.parts[first:]:
        bmesh.ops.translate(bm, vec=(x, y, G - 0.005), verts=bm.verts)


# ---- boats ---------------------------------------------------------------------------------------

def dugout(ms, f, L=0.55, W=0.075, H=0.05, z=0.0, lod=2, mat='log'):
    """A dugout canoe hollowed from one log along local Y, bow to -Y: a closed loft of U-shaped
    sections (outer hull, gunwales, the hollow) that narrows to raised points at both ends. LOD2
    takes a plain tapered block."""
    bm = bmesh.new()
    n = 9
    prof = [(-1.0, 1.0), (-0.98, 0.45), (-0.7, 0.08), (0.0, 0.0), (0.7, 0.08), (0.98, 0.45), (1.0, 1.0),
            (0.78, 1.0), (0.55, 0.42), (0.0, 0.3), (-0.55, 0.42), (-0.78, 1.0)]
    rings = []
    for j in range(n + 1):
        t = j / n
        yy = -L / 2 + L * t
        s = math.sin(math.pi * t) ** 0.55
        lift = 0.35 * (abs(t - 0.5) * 2) ** 3 * H
        sw, sh = max(s, 0.08), max(s, 0.5)
        ring = [bm.verts.new((px * W / 2 * sw, yy, z + lift + pz * H * sh)) for px, pz in prof]
        rings.append(ring)
    m = len(prof)
    for j in range(n):
        for i in range(m):
            k = (i + 1) % m
            bm.faces.new((rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, min(lod, 1), matrix=f)
    if lod >= 2:
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
        for v in bm.verts:
            if v.co.z < 0.1:
                v.co.x *= 0.6
        for v in bm.verts:
            if abs(v.co.y) > 0.4:
                v.co.x *= 0.35
        bmesh.ops.scale(bm, vec=(W, L, H), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, z), verts=bm.verts)
        ms.add(bm, mat, 2, matrix=f, only=(2,))


def paddler(ms, f, y, z, side=1, s=1.0, paddle=True, lod=0, body='op_hide_dark'):
    """A kneeling paddler in hides at local (0, y), facing -Y, a paddle down one side."""
    ms.box(body, (0.028 * s, 0.022 * s, 0.032 * s), at=(0, y, z), lod=lod, frame=f, taper=0.8)
    ms.sphere('st_skin', 0.011 * s, at=(0, y, z + 0.042 * s), u=6, v=4, lod=lod, frame=f)
    ms.sphere('dark', 0.0115 * s, at=(0, y + 0.002, z + 0.046 * s), scale=(1, 1, 0.7), u=6, v=3, lod=0, frame=f, cut_below=0)  # hair
    if paddle:
        a = f @ Vector((side * 0.02 * s, y - 0.01, z + 0.06 * s))
        b = f @ Vector((side * 0.05 * s, y + 0.035, z - 0.03 * s))
        tn.limb(ms, 'timber', a, b, 0.0025 * s, 0.0025 * s, segs=4, lod=0)
        ms.box('timber', (0.004, 0.01 * s, 0.03 * s), at=(side * 0.052 * s, y + 0.038, z - 0.05 * s), lod=0, frame=f)


def net_on_poles(ms, x, y, yaw, w=0.34, h=0.16):
    """A fishing net hung to dry between two poles: a thin reed sheet with sagging lower edge."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-w / 2, w / 2):
        ms.cyl('timber', 0.008, 0.007, h + 0.04, at=(sx, 0, G), segs=4, lod=1, frame=f)
    bm = bmesh.new()
    pts = [(-w / 2, G + h), (w / 2, G + h), (w / 2 - 0.02, G + h * 0.35), (0, G + h * 0.15), (-w / 2 + 0.02, G + h * 0.35)]
    bm.faces.new([bm.verts.new((px, 0, pz)) for px, pz in pts])
    bm.faces.new([bm.verts.new((px, 0.002, pz)) for px, pz in reversed(pts)])
    ms.add(bm, 'reed', 1, matrix=f)


def palisade_ring(ms, rng, r, h, gate_a, gate_w, step=0.046, z=G, wall_lod1=24, wall_lod2=12):
    """A ring of pointed log stakes at radius r (LOD0), as a log band at LOD1 and LOD2, open at
    angle gate_a (degrees) for gate_w degrees."""
    n = int(2 * math.pi * r / step)
    for i in range(n):
        a = 360.0 * i / n
        if abs((a - gate_a + 180) % 360 - 180) < gate_w / 2:
            continue
        x, y = r * math.cos(math.radians(a)), r * math.sin(math.radians(a))
        sh = h * rng.uniform(0.9, 1.06)
        rr = rng.uniform(0.019, 0.023)
        fr = tm.house_frame(x, y, rng.uniform(0, 360))
        ms.cyl('log', rr, rr * 0.94, sh, at=(0, 0, z - 0.02), segs=4, lod=0, frame=fr, caps=False)
        ms.cyl('log', rr * 0.94, 0.0, 0.05, at=(0, 0, z - 0.02 + sh), segs=4, lod=0, frame=fr, caps=False)
    a0, a1 = gate_a + gate_w / 2, gate_a + 360 - gate_w / 2
    for nseg, only in ((wall_lod1, (1,)), (wall_lod2, (2,))):
        tb.sweep(ms, 'log', [(r + 0.02, z - 0.02), (r + 0.02, z + h), (r - 0.02, z + h), (r - 0.02, z - 0.02)], a0, a1, nseg, lod=2, only=only, chunk=360.0 if only == (2,) else 60.0)
