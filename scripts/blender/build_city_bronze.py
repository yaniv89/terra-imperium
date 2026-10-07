# scripts/blender/build_city_bronze.py
# The Bronze city destruction kit for the battle (plans/ART-MODELS-PLAN.md section 6, Wave 1;
# src/assets/battle/city/README.md), three files in the Bronze town kit's materials so a besieged
# city matches its town on the map:
#   walls-bronze.glb  wall-straight (10 m along model x, outer face to Blender -Y), wall-corner, tower,
#                     gate-open, gate-closed; each also -damaged (under 70% HP) and -breached (down)
#   ruins-bronze.glb  rubble-s (8 m), rubble-m (14 m), rubble-l (24 m), beams, scorch
#   fort-bronze.glb   fort: an earth rampart and log palisade in a 50 m circle, gatehouse, watch tower
# Battle budgets (validate_model.py): wall-kit 1,500 / 400 / 80, ruin 1,200 / 300 / 80, fort as an
# improvement 8,000 / 1,500 / 300. One atlas per file, LOD0..LOD2, origin on the ground (Z = 0).
#   blender -b --factory-startup -P scripts/blender/build_city_bronze.py -- <out_dir> [walls,ruins,fort]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_nature as tn  # noqa: E402
from ti_town import G  # noqa: E402

H = 0.5     # 5 m wall
T = 0.24    # 2.4 m thick at the foot
BATTER = 0.035
BAND = ('limewash', 0.12)


# ---- shapes -------------------------------------------------------------------------------------

def prism(ms, mat, profile, x0, x1, lod=2, only=None, frame=None):
    """A closed profile [(y, z), ...] (counter-clockwise seen from +X) extruded from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ms.add(bm, mat, lod, frame if frame is not None else Matrix.Identity(4), only=only)


def wall_profile(h):
    """The wall's section: battered outer face (-Y), plumb inner face."""
    return [(-T / 2, 0.0), (T / 2, 0.0), (T / 2, h), (-T / 2 + BATTER * h / H, h)]


def bricks(ms, rng, cx, cy, spread, n, z=0.0, mat='brick', lod=0, frame=None):
    for k in range(n):
        x, y = cx + rng.uniform(-spread, spread), cy + rng.uniform(-spread, spread) * 0.6
        ms.box(mat, (0.045, 0.03, 0.018), at=(x, y, z), rot_z=rng.uniform(0, 180), lod=lod, frame=frame)


def mound(ms, rng, x, y, r, h, mat='brick', yaw=0.0, frame=None, far=True):
    """A rubble heap: a faceted low lump at LOD0, a plain one at LOD1 (and LOD2 when `far`)."""
    if frame is not None:
        p = frame @ Vector((x, y, 0))
        x, y = p.x, p.y
        yaw += math.degrees(frame.to_euler().z)
    tn.blob(ms, mat, (x, y, -0.005), r, (1.0, 0.75, h / r), rng, 0.25, 2, lod=0, cut=0.0, yaw=yaw)
    tn.blob(ms, mat, (x, y, -0.005), r, (1.0, 0.75, h / r), rng, 0.15, 1, lod=2 if far else 1, only=(1, 2) if far else (1,), cut=0.0, yaw=yaw)


def charred_beam(ms, rng, x, y, z0, length, yaw, lift=0.02, frame=None):
    if frame is not None:
        p = frame @ Vector((x, y, 0))
        x, y = p.x, p.y
        yaw += math.degrees(frame.to_euler().z)
    a = math.radians(yaw)
    tn.limb(ms, 'ash', (x - math.cos(a) * length / 2, y - math.sin(a) * length / 2, z0 + 0.01),
            (x + math.cos(a) * length / 2, y + math.sin(a) * length / 2, z0 + lift), 0.012, 0.01, segs=5, lod=0)


def scorch_plate(ms, rng, x, y, r, lod=1):
    n = 9
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        rr = r * rng.uniform(0.7, 1.15)
        pts.append((x + rr * math.cos(a), y + rr * math.sin(a), 0.002 + 0.0005 * (lod == 0)))
    ms.quad_strip('ash', pts, lod=lod)


# ---- wall pieces ------------------------------------------------------------------------------------

def wall_run(ms, rng, x0, x1, state, frame=None, merlon_skip=0.0, far=True):
    """One stretch of wall from x0 to x1 along local x: body, foot band, parapet with merlons and a
    timber walk; `state` 0 whole, 1 damaged (bites out of the top, cracks, fallen merlons, rubble at
    the foot), 2 breached (cut down to stubs at both ends, a rubble ramp through the gap). LOD0 has
    five sections, LOD1 three, LOD2 one (two stubs when breached)."""
    f = frame if frame is not None else Matrix.Identity(4)
    if state == 0:
        heights = [H] * 5
    elif state == 1:
        heights = [H - (rng.uniform(0.06, 0.14) if k in (1, 3) else 0.0) for k in range(5)]
    else:
        heights = [H * 0.62, H * 0.3, 0.06, H * 0.25, H * 0.55]
    span = x1 - x0
    sections = {
        0: [(x0 + span * k / 5, x0 + span * (k + 1) / 5, heights[k]) for k in range(5)],
        1: [(x0, x0 + span * 0.4, heights[0]), (x0 + span * 0.4, x0 + span * 0.6, heights[2]), (x0 + span * 0.6, x1, heights[4])],
        2: ([(x0, x1, sum(heights) / 5)] if state < 2 else [(x0, x0 + span * 0.4, heights[0]), (x0 + span * 0.6, x1, heights[4])]),
    }
    for lod, secs in sections.items():
        for a, b, h in secs:
            prism(ms, 'brick', wall_profile(h), a, b, lod=lod, only=(lod,), frame=f)
            if lod == 2:
                continue
            bh = min(BAND[1], h)
            prism(ms, BAND[0], [(-T / 2 - 0.004, 0.0), (-T / 2 + 0.01, 0.0), (-T / 2 + 0.01, bh), (-T / 2 - 0.004 + BATTER * bh / H, bh)], a, b, lod=lod, only=(lod,), frame=f)
            if h >= H - 0.001:  # the parapet and the walk where the top is whole
                yo = -T / 2 + BATTER
                prism(ms, 'brick', [(yo, h), (yo + 0.04, h), (yo + 0.04, h + 0.05), (yo, h + 0.05)], a, b, lod=lod, only=(lod,), frame=f)
                prism(ms, 'timber', [(yo + 0.04, h), (T / 2 - 0.02, h), (T / 2 - 0.02, h + 0.006), (yo + 0.04, h + 0.006)], a, b, lod=lod, only=(lod,), frame=f)
                if lod == 0:
                    m = max(1, int(round((b - a) / 0.11)))
                    for i in range(m):
                        if state == 1 and rng.random() < 0.45 or rng.random() < merlon_skip:
                            continue
                        ms.box('brick', (0.05, 0.04, 0.05), at=(a + (b - a) * (i + 0.5) / m, yo + 0.02, h + 0.05), lod=0, frame=f)
            elif state >= 1 and lod == 0:  # broken top: a ragged lip of bricks
                for i in range(3):
                    ms.box('brick', (0.05, 0.05, 0.03), at=(rng.uniform(a + 0.02, b - 0.02), rng.uniform(-0.06, 0.06), h), rot_z=rng.uniform(-20, 20), lod=0, frame=f)
    if state >= 1:
        for k in range(3 if state == 1 else 2):  # cracks on the outer face
            x = rng.uniform(x0 + 0.1, x1 - 0.1)
            ms.box('dark', (0.012, 0.006, rng.uniform(0.08, 0.18)), at=(x, -T / 2 + 0.006, rng.uniform(0.12, 0.25)), lod=0, frame=f)
        cx = (x0 + x1) / 2
        if state == 1:
            mound(ms, rng, cx + rng.uniform(-0.25, 0.25), -T / 2 - 0.08, 0.12, 0.05, frame=f, far=False)
            bricks(ms, rng, cx, -T / 2 - 0.12, 0.3, 8, frame=f)
        else:
            mound(ms, rng, cx, -0.06, 0.32, 0.12, frame=f, far=far)
            mound(ms, rng, cx - 0.15, T / 2 + 0.1, 0.16, 0.07, frame=f, far=False)
            bricks(ms, rng, cx, -T / 2 - 0.15, 0.4, 12, frame=f)
            charred_beam(ms, rng, cx + 0.12, T / 2 + 0.05, 0.0, 0.26, 20, frame=f)
            charred_beam(ms, rng, cx - 0.2, -0.05, 0.08, 0.22, -30, frame=f)


def wall_straight(state):
    def build(ms, rng):
        wall_run(ms, rng, -0.5, 0.5, state)
    return build


def wall_corner(state):
    """A corner: two half-length arms meeting at the origin (one along +x, one along +y), the outer
    faces outward (-Y and -X), a square buttress at the angle."""
    def build(ms, rng):
        wall_run(ms, rng, -T / 2, 0.5, state, far=state < 2)
        wall_run(ms, rng, -0.5, T / 2, state, frame=Matrix.Rotation(math.radians(-90), 4, 'Z'), far=False)
        h = H + 0.06 if state == 0 else H * (0.85 if state == 1 else 0.4)
        ms.box('brick', (T + 0.08, T + 0.08, h), at=(0, 0, 0), lod=2, bevel=0.004, taper=0.94)
        ms.box(BAND[0], (T + 0.088, T + 0.088, BAND[1]), at=(0, 0, 0), lod=1)
    return build


def tower(state):
    """A square battered mud-brick tower, 6 x 6 m and 7.5 m high, merlons, slits, a timber floor and
    a team pennant on top; damaged: the top broken and merlons gone; breached: a stub in rubble."""
    def build(ms, rng):
        f = Matrix.Identity(4)
        if state == 0:
            tb.wall_tower(ms, f, 0.6, 0.57, 0.75, rng, flag_top=1.05, band=BAND)
        elif state == 1:
            tb.wall_tower(ms, f, 0.6, 0.57, 0.68, rng, band=BAND)
            ztop = 0.68
            kept = []
            for part in ms.parts:
                zs = [v.co.z for v in part[0].verts]
                if min(zs) > ztop - 0.01 and rng.random() < 0.55:
                    part[0].free()
                else:
                    kept.append(part)
            ms.parts[:] = kept
            for k in range(2):
                ms.box('dark', (0.014, 0.006, 0.16), at=(rng.uniform(-0.2, 0.2), -0.29, rng.uniform(0.15, 0.4)), lod=0)
            mound(ms, rng, 0.15, -0.42, 0.16, 0.06)
            bricks(ms, rng, 0.0, -0.45, 0.3, 8)
        else:
            ms.box('brick', (0.6, 0.57, 0.3), at=(0, 0, 0), lod=2, bevel=0.005, taper=0.95)
            ms.box(BAND[0], (0.606, 0.576, BAND[1]), at=(0, 0, 0), lod=1)
            for i in range(5):
                ms.box('brick', (0.08, 0.08, 0.05), at=(rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0.3), rot_z=rng.uniform(0, 90), lod=0)
            mound(ms, rng, 0.0, -0.45, 0.34, 0.14)
            mound(ms, rng, 0.3, 0.3, 0.2, 0.08)
            bricks(ms, rng, 0.0, -0.5, 0.4, 12)
            charred_beam(ms, rng, -0.2, -0.4, 0.06, 0.3, 15)
    return build


def gate(state, open_):
    """A gateway 10 m wide: two flanking towers and a 4 m opening with plank doors (swung in when
    open), a lintel and a walk over it; team banners on the towers."""
    def build(ms, rng):
        gw = 0.4
        tw = (1.0 - gw) / 2
        th = 0.65 if state == 0 else 0.58 if state == 1 else 0.28
        for sx in (-1, 1):
            f = tm.house_frame(sx * (gw / 2 + tw / 2), 0, 0)
            if state < 2:
                tb.wall_tower(ms, f, tw, T + 0.08, th, rng, band=BAND)
                if state == 0:
                    tb.banner(ms, f, 0, -(T + 0.08) / 2 - 0.006, th - 0.08, w=tw * 0.4, h=th * 0.45)
            else:
                ms.box('brick', (tw, T + 0.08, th), at=(0, 0, 0), lod=2, frame=f, bevel=0.004)
        if state == 1:  # knock part of the merlons off
            kept = []
            for part in ms.parts:
                zs = [v.co.z for v in part[0].verts]
                if min(zs) > th - 0.01 and rng.random() < 0.5:
                    part[0].free()
                else:
                    kept.append(part)
            ms.parts[:] = kept
        dh = H * 0.82
        if state < 2:
            ms.box('brick', (gw + 0.04, T, H - dh + 0.02), at=(0, 0, dh), lod=2)
            ms.box('timber', (gw + 0.06, 0.05, 0.04), at=(0, -T / 2 - 0.01, dh - 0.02), lod=1)
            ms.box('timber', (gw, T - 0.04, 0.01), at=(0, 0, H + 0.02), lod=1)
            if open_:
                for sx in (-1, 1):  # the leaves swung inward against the passage walls
                    hinge = Vector((sx * gw / 2, 0.02, 0))
                    lf = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(sx * -95), 4, 'Z')
                    ms.box('door', (gw / 2 - 0.004, 0.03, dh - 0.02), at=(-sx * gw / 4, 0, 0), lod=1, frame=lf)
                    for k in range(3):
                        ms.box('bronze', (gw / 2 - 0.03, 0.008, 0.02), at=(-sx * gw / 4, -0.018, dh * (0.18 + 0.3 * k)), lod=0, frame=lf)
            else:
                tb.gate_doors(ms, Matrix.Translation(Vector((0, 0.02, 0))), gw, dh - 0.02, straps=True)
                if state == 1:
                    ms.box('ash', (0.12, 0.034, 0.1), at=(0.05, 0.0, 0.05), lod=0)  # a scorched, splintered patch
        else:
            mound(ms, rng, 0.0, -0.05, 0.36, 0.13)
            bricks(ms, rng, 0.0, -0.3, 0.45, 12)
            charred_beam(ms, rng, 0.05, -0.2, 0.05, 0.34, 10, lift=0.08)
            ms.box('door', (gw / 2, 0.03, 0.2), at=(-0.12, -0.3, 0.0), rot_z=70, lod=1)
        if state == 1:
            mound(ms, rng, 0.38, -0.28, 0.1, 0.04)
            bricks(ms, rng, 0.3, -0.3, 0.2, 6)
    return build


# ---- ruins ---------------------------------------------------------------------------------------

def rubble(size):
    """A fallen mud-brick building `size` across: a heap of its bricks with wall stubs standing,
    loose bricks, broken roof beams and a jar or two."""
    def build(ms, rng):
        r = size / 2
        mound(ms, rng, 0, 0, r * 0.62, 0.05 + 0.06 * size, mat='mudwall')
        for k in range(2 + int(size * 1.6)):
            a = 2 * math.pi * k / (2 + int(size * 1.6)) + rng.uniform(-0.3, 0.3)
            d = r * rng.uniform(0.55, 0.85)
            w = rng.uniform(0.12, 0.3) * min(1.5, size)
            h = rng.uniform(0.05, 0.16) * min(1.6, 0.6 + size * 0.4)
            ms.box('mudwall', (w, 0.04, h), at=(math.cos(a) * d, math.sin(a) * d, 0), rot_z=math.degrees(a) + 90 + rng.uniform(-10, 10), lod=1 if k < 3 else 0, bevel=0.003)
        for k in range(int(3 + size * 3)):
            a, d = rng.uniform(0, 2 * math.pi), r * rng.uniform(0.1, 0.8)
            charred_beam(ms, rng, math.cos(a) * d, math.sin(a) * d, rng.uniform(0.0, 0.04), rng.uniform(0.12, 0.3) * min(1.3, size), rng.uniform(0, 180), lift=rng.uniform(0.0, 0.05))
        bricks(ms, rng, 0, 0, r * 0.9, int(8 + 6 * size), mat='mudwall_bare')
        for k in range(max(1, int(size))):
            tt.jar(ms, tm.house_frame(0, 0, 0), rng.uniform(-r, r) * 0.7, rng.uniform(-r, r) * 0.7, 1.1, z=0.0)
    return build


def beams(ms, rng):
    """A heap of charred roof beams and reed matting, 6 m."""
    for k in range(7):
        charred_beam(ms, rng, rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.012 * (k // 3), rng.uniform(0.35, 0.55), rng.uniform(0, 180), lift=rng.uniform(0.0, 0.05))
    ms.box('timber', (0.5, 0.03, 0.025), at=(0, 0.1, 0.0), rot_z=15, lod=2)
    ms.box('ash', (0.2, 0.14, 0.006), at=(0.05, -0.05, 0.0), rot_z=30, lod=1)
    ms.box('reed', (0.16, 0.1, 0.006), at=(-0.1, 0.08, 0.004), rot_z=-20, lod=0)


def scorch(ms, rng):
    """A burnt patch on the ground, 10 m: ash and charred earth, a few embers of beams."""
    scorch_plate(ms, rng, 0, 0, 0.5, lod=2)
    scorch_plate(ms, rng, 0.1, -0.05, 0.3, lod=0)
    for k in range(3):
        charred_beam(ms, rng, rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0.0, rng.uniform(0.1, 0.2), rng.uniform(0, 180), lift=0.01)


# ---- the fort -------------------------------------------------------------------------------------

def palisade_ring(ms, rng, R=2.05, h=0.36, gate_w=0.42):
    """The fort's ring (lighter than the town's walls-small, for the improvement budget): an earth
    berm, sharpened logs one by one at LOD0, a toothless band at LOD1 and LOD2, a gap at the south."""
    berm = 0.04
    half = math.degrees(math.asin((gate_w / 2 + 0.04) / R))
    a0, a1 = -90 + half, 270 - half
    tb.sweep(ms, 'earth_fringe', [(R + 0.22, 0.0), (R + 0.1, berm)], 0, 360, 48, lod=0, only=(0, 1))
    tb.sweep(ms, 'earth', [(R + 0.1, berm), (R - 0.1, berm)], 0, 360, 48, lod=0, only=(0, 1))
    tb.sweep(ms, 'earth_fringe', [(R - 0.1, berm), (R - 0.22, 0.0)], 0, 360, 48, lod=0, only=(0, 1))
    n = int(math.radians(a1 - a0) * R / 0.046)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        lh = h * rng.uniform(0.9, 1.06)
        r = rng.uniform(0.019, 0.023)
        f = tb.ring_frame(R + rng.uniform(-0.006, 0.006), a, berm - 0.01)
        ms.cyl('log', r, r * 0.92, lh, at=(0, 0, 0), segs=4, lod=0, frame=f, caps=False)
        ms.cyl('log', r * 0.92, 0.0, 0.05, at=(0, 0, lh), segs=4, lod=0, frame=f, caps=False)
    tb.sweep(ms, 'reed', [(R + 0.024, berm + 0.2), (R + 0.024, berm + 0.215)], a0, a1, 48, lod=0)
    for lod, steps in ((1, 40), (2, 14)):
        tb.sweep(ms, 'log', [(R + 0.02, berm - 0.01), (R + 0.02, berm + h)], a0, a1, steps, lod=lod, only=(lod,))
        tb.sweep(ms, 'log', [(R + 0.02, berm + h), (R - 0.02, berm + h)], a0, a1, steps, lod=lod, only=(lod,))
        if lod == 1:
            tb.sweep(ms, 'log', [(R - 0.02, berm + h), (R - 0.02, berm - 0.01)], a0, a1, steps, lod=lod, only=(lod,))
    gf = tm.house_frame(0, -R, 0)  # the gatehouse: posts, lintel, a railed fighting platform, doors
    gh = 0.46
    for sx in (-1, 1):
        for sy in (-0.06, 0.06):
            ms.box('timber', (0.04, 0.04, gh + 0.08), at=(sx * (gate_w / 2 + 0.02), sy, 0), lod=2 if sy < 0 else 1, frame=gf)
    ms.box('timber', (gate_w + 0.12, 0.16, 0.03), at=(0, 0, gh), lod=1, frame=gf)
    for sy in (-0.07, 0.07):
        ms.box('timber', (gate_w + 0.1, 0.016, 0.016), at=(0, sy, gh + 0.08), lod=0, frame=gf)
    tb.gate_doors(ms, gf @ Matrix.Translation(Vector((0, 0.0, 0.0))), gate_w, gh - 0.04)


def fort_inside(ms, rng):
    """The inside of `fort` (50 m circle; the ring is palisade_ring): a mud-brick watch tower, three reed huts, a fire, a log pile, jars and a team pennant."""
    tb.watch_tower(ms, 0.9, 0.85, h=1.0, w=0.42)
    for x, y in [(-0.85, 0.55), (-0.2, 1.1), (0.95, -0.4)]:
        tb.hut(ms, x, y, w=0.5, d=0.34, wall_h=0.2, top=0.36)
    tb.fire_ring(ms, rng, 0.1, -0.2)
    tb.log_bundle(ms, -0.9, -0.5, 30)
    for k in range(4):
        tt.jar(ms, tm.house_frame(0, 0, 0), 0.4 + 0.06 * k, 0.35 + 0.03 * (k % 2), 1.2)
    top = (-0.2, -0.6)
    ms.cyl('timber', 0.014, 0.011, 0.75, at=(top[0], top[1], G), segs=6, lod=1)
    tt.pennant(ms, tm.house_frame(0, 0, 0), top[0], top[1], G + 0.745, yaw=-150, lod=2, w=0.22, h=0.14)


def grounded_parts(layout):
    """The fort mixes the town kit's G-based parts (tower, huts, jars) with its own ring built from
    Z = 0: build the ring first, then the layout, and move only the layout's parts down by G."""
    def build(ms, rng):
        mark = len(ms.parts)
        palisade_ring(ms, rng)
        ring = ms.parts[mark:]
        del ms.parts[mark:]
        layout(ms, rng)
        for bm, _m, _l, _o in ms.parts:
            bmesh.ops.translate(bm, vec=(0, 0, -G), verts=bm.verts)
        ms.parts.extend(ring)
    return build


def wall_items():
    items = []
    for base, make in (('wall-straight', wall_straight), ('wall-corner', wall_corner), ('tower', tower)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, make(state), None))
    for base, open_ in (('gate-open', True), ('gate-closed', False)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, gate(state, open_), None))
    return items


FILES = {
    'walls-bronze': wall_items,
    'ruins-bronze': lambda: [('rubble-s', rubble(0.8), None), ('rubble-m', rubble(1.4), None), ('rubble-l', rubble(2.4), None),
                             ('beams', beams, None), ('scorch', scorch, None)],
    'fort-bronze': lambda: [('fort', grounded_parts(fort_inside), None)],
}
ATLAS = {'walls-bronze': 1024, 'ruins-bronze': 1024, 'fort-bronze': 1024}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-bronze')
    only = [n if n.endswith('-bronze') else n + '-bronze' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=ATLAS[name], seed=5200 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
