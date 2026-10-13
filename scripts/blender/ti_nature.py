# scripts/blender/ti_nature.py
# Nature parts for the battle (plans/ART-MODELS-PLAN.md section 7; src/assets/battle/nature/README.md):
# faceted rocks, trees (trunk and canopy blobs, palms, cypress spires), grass tufts, bushes, felled
# logs and stumps, water ripples and fish, and two herd animals. Built on the town kit's Mesher and
# atlas bake (ti_town.build_file), so a battlefield's trees and rocks share the towns' look: flat
# shading, one baked atlas per file, the Town material. No ground plate: everything stands on Z = 0.
# Scale 1 unit = 10 m, true size (trees 3 to 8 m, nodes 4 to 8 m across), the front facing Blender -Y.
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['rock', 'rock_dark', 'sandstone', 'ore', 'verdigris', 'quartz', 'gold', 'bark', 'bark_pale', 'birch',
       'cut_wood', 'foliage', 'foliage_dark', 'foliage_light', 'olive_leaf', 'cypress_leaf', 'pine_leaf', 'palm_leaf',
       'acacia_leaf', 'dry_shrub', 'tuft', 'tuft_dry', 'wool', 'wool_dark', 'hide', 'hide_pale', 'horn', 'hoof',
       'ripple', 'deep_water', 'fish',
       # the four battle resources (MD06, 13 October): a pale quarry, gold in dark rock, a shoal's water
       'quarry', 'quarry_cut', 'rubble', 'pit', 'gold_rock', 'gold_bright', 'shoal_water', 'fish_silver', 'foam']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    s = tm.mat_simple
    s('rock', ['#7d776c', '#948d80', '#a7a092', '#6c665c'], scale=9.0, bump=0.7)
    s('rock_dark', ['#5c5750', '#6e685f', '#4d4842'], scale=11.0, bump=0.7)
    s('sandstone', ['#b89870', '#c9ab80', '#a88a62', '#d2b88e'], scale=8.0, stripes={'dir': 'Z', 'scale': 30.0, 'distortion': 3.0}, bump=0.6)
    s('ore', ['#7a3e22', '#9a5530', '#5e3a2a', '#b06a3a'], scale=14.0, bump=0.6)
    s('verdigris', ['#3f7a62', '#5a9478', '#2e5e4c'], scale=20.0, bump=0.4)
    s('quartz', ['#ddd6c8', '#ece6da', '#c8c0b0'], scale=16.0, rough=0.5, bump=0.4)
    s('gold', ['#d8a838', '#f0cc5a', '#c4922c'], scale=30.0, rough=0.4, bump=0.2)
    s('bark', ['#4a3a2a', '#5c4834', '#3a2e22'], scale=10.0, stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 8.0}, bump=0.7)
    s('bark_pale', ['#7a6a58', '#8e7e68', '#655648'], scale=10.0, stripes={'dir': 'Z', 'scale': 50.0, 'distortion': 10.0}, bump=0.7)
    s('birch', ['#d8d2c4', '#c4bcae', '#2e2a26'], scale=26.0, bump=0.3)
    s('cut_wood', ['#c49a64', '#d6b07a', '#a8804e'], scale=8.0, stripes={'dir': 'Z', 'scale': 200.0, 'distortion': 2.0}, bump=0.3)
    s('foliage', ['#3b5a24', '#4e7030', '#5f823a', '#33501f'], scale=14.0, bump=0.8)
    s('foliage_dark', ['#2a4420', '#365428', '#22381a'], scale=14.0, bump=0.8)
    s('foliage_light', ['#5c7c30', '#6f9038', '#83a044'], scale=14.0, bump=0.8)
    s('olive_leaf', ['#5f6e4a', '#76845c', '#8a9670'], scale=16.0, bump=0.8)
    s('cypress_leaf', ['#243a22', '#2e4a2a', '#1c2e1a'], scale=18.0, stripes={'dir': 'Z', 'scale': 40.0, 'distortion': 6.0}, bump=0.8)
    s('pine_leaf', ['#2c4626', '#3a5a30', '#24381e'], scale=16.0, bump=0.8)
    s('palm_leaf', ['#4a6a2a', '#5e7e34', '#7a8a40'], scale=20.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 2.0}, bump=0.5)
    s('acacia_leaf', ['#5e6a30', '#727c3a', '#4c5626'], scale=14.0, bump=0.8)
    s('dry_shrub', ['#7a6e44', '#8e7f50', '#655a38'], scale=16.0, bump=0.8)
    s('tuft', ['#5a7a2c', '#76923a', '#9aa456', '#4a6624'], scale=40.0, stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 4.0}, bump=0.6)
    s('tuft_dry', ['#a89458', '#c2ac6c', '#8e7a46'], scale=40.0, stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 4.0}, bump=0.6)
    s('wool', ['#d8d0bc', '#e6dfcd', '#c4baa4'], scale=40.0, bump=0.8)
    s('wool_dark', ['#4e4034', '#5e4e40', '#3e3228'], scale=30.0, bump=0.6)
    s('hide', ['#7a4a2a', '#8e5a34', '#5e3820'], scale=12.0, bump=0.3)
    s('hide_pale', ['#c8b8a0', '#d8cab2', '#b0a088'], scale=12.0, bump=0.3)
    s('horn', ['#d8ccb0', '#c0b090', '#e6dcc4'], scale=20.0, bump=0.2)
    s('hoof', ['#2a2420', '#3a322c'], scale=20.0, bump=0.1)
    s('ripple', ['#7fa2a8', '#93b4b8', '#6e939a'], scale=20.0, rough=0.2, bump=0.0)
    s('deep_water', ['#24484e', '#2e5a60', '#1e3c42'], scale=12.0, rough=0.2, bump=0.0)
    s('fish', ['#4a5a5c', '#6a7a7c', '#c8ccc4'], scale=30.0, rough=0.4, bump=0.1)
    # MD06: stone is PALE and cut square, gold is DARK rock with bright yellow, so the two never read alike
    s('quarry', ['#a5a198', '#b6b2a8', '#c2beb4', '#99958b'], scale=9.0, bump=0.6)
    s('quarry_cut', ['#c4c1b8', '#d2cfc6', '#b7b4ab'], scale=6.0, stripes={'dir': 'Z', 'scale': 55.0, 'distortion': 1.5}, bump=0.25)
    s('rubble', ['#8c877d', '#9d988d', '#7b766d'], scale=22.0, bump=0.7)
    s('pit', ['#3d3832', '#4a443c', '#322e29'], scale=14.0, bump=0.4)
    s('gold_rock', ['#3a3531', '#4a433d', '#2c2825', '#554c44'], scale=11.0, bump=0.7)
    s('gold_bright', ['#f0b90f', '#ffd428', '#ffe45c', '#e3a600'], scale=26.0, rough=0.35, bump=0.15)
    s('shoal_water', ['#4fa3b5', '#66b7c6', '#3f93a6'], scale=9.0, rough=0.2, bump=0.0)
    s('fish_silver', ['#c9d3d6', '#e4eaeb', '#a9b6ba'], scale=30.0, rough=0.3, bump=0.1)
    s('foam', ['#e9f3f4', '#f7fbfb', '#d6e8ea'], scale=30.0, rough=0.4, bump=0.0)


if not any(n == 'nature' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('nature', make_materials))


# ---- shapes -------------------------------------------------------------------------------------

def blob(ms, mat, at, r, scale=(1, 1, 1), rng=None, jitter=0.18, subdiv=1, lod=2, only=None, cut=None, yaw=0.0):
    """A faceted lump (an icosphere with its points pushed in and out): rocks and canopy masses.
    `cut` (local z, before scaling) keeps only the part above it, capped; `only` limits it to LODs."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    if rng is not None and jitter:
        for v in bm.verts:
            v.co *= 1.0 + rng.uniform(-jitter, jitter)
    if cut is not None:
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cut), plane_no=(0, 0, 1), clear_inner=True)
        edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
        if edges:
            bmesh.ops.holes_fill(bm, edges=edges)
    m = (Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
         @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0))))
    return ms.add(bm, mat, lod, m, only=only)


def rock(ms, mat, x, y, r, rng, flat=0.7, subdiv=1, lod=2, only=None, sink=0.25):
    """A boulder sitting on the ground: a jittered lump, its foot cut flat a little below Z = 0."""
    sx, sy = rng.uniform(0.85, 1.25), rng.uniform(0.8, 1.15)
    cz = -r * sink * flat
    cut = (-0.006 - cz) / flat  # the foot cut flat just under Z = 0 (validate_model: nothing below -0.01)
    return blob(ms, mat, (x, y, cz), r, (sx, sy, flat), rng, 0.22, subdiv, lod, only, cut=cut, yaw=rng.uniform(0, 360))


def limb(ms, mat, p0, p1, r0, r1, segs=6, lod=2, only=None, caps=True):
    """A tapered round piece from p0 to p1 (trunks, branches, legs, logs)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r0, radius2=r1, depth=d.length)
    bmesh.ops.translate(bm, vec=(0, 0, d.length / 2), verts=bm.verts)
    m = Matrix.Translation(p0) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    return ms.add(bm, mat, lod, m, only=only)


def slab(ms, mat, p0, p1, w, t=0.003, lod=2, only=None, droop=0.0):
    """A thin flat strip from p0 to p1, `w` wide (palm fronds, grass blades), tipped down by `droop`."""
    p0, p1 = Vector(p0), Vector(p1)
    mid = (p0 + p1) / 2 + Vector((0, 0, -droop))
    for a, b in ((p0, mid), (mid, p1)):
        d = b - a
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(w, t, d.length), verts=bm.verts)
        bmesh.ops.translate(bm, vec=(0, 0, d.length / 2), verts=bm.verts)
        q = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        ms.add(bm, mat, lod, Matrix.Translation(a) @ q, only=only)


# ---- trees --------------------------------------------------------------------------------------
# Budgets (validate_model.py `tree`): LOD0 600, LOD1 150, LOD2 150 triangles. A canopy is a few
# subdivided blobs at LOD0, two plain ones at LOD1 and one at LOD2.

def broadleaf(ms, rng, h, crown_r, trunk_r, bark='bark', leaf='foliage', shape=(1.0, 1.0, 0.8), crown_z=0.6, blobs=4, lean=0.0):
    """A broad tree: a tapered trunk, two or three limbs, a crown of `blobs` lumps."""
    top = (lean * h, 0, h * crown_z)
    foot = (0, 0, -0.008 if not lean else 0.0)  # a leaning trunk's tilted foot ring stays above -0.01
    limb(ms, bark, foot, top, trunk_r, trunk_r * 0.6, segs=6, lod=0)
    limb(ms, bark, foot, top, trunk_r, trunk_r * 0.6, segs=4, lod=2, only=(1, 2), caps=False)
    for k in range(2):
        a = rng.uniform(0, 2 * math.pi)
        limb(ms, bark, (top[0] * 0.7, 0, h * crown_z * 0.75), (top[0] + math.cos(a) * crown_r * 0.6, math.sin(a) * crown_r * 0.6, h * (crown_z + 0.12)), trunk_r * 0.5, trunk_r * 0.25, segs=4, lod=0)
    cz = h - crown_r * shape[2]
    for k in range(blobs):
        a = 2 * math.pi * k / blobs + rng.uniform(-0.4, 0.4)
        d = crown_r * 0.45
        r = crown_r * rng.uniform(0.55, 0.7)
        blob(ms, leaf, (top[0] + math.cos(a) * d * shape[0], math.sin(a) * d * shape[1], cz + rng.uniform(-0.1, 0.15) * crown_r), r, shape, rng, 0.2, 2, lod=0)
    blob(ms, leaf, (top[0], 0, cz + crown_r * 0.25), crown_r * 0.62, shape, rng, 0.2, 1, lod=0)
    blob(ms, leaf, (top[0], 0, cz), crown_r * 0.95, shape, rng, 0.12, 1, lod=1, only=(1,))
    blob(ms, leaf, (top[0] + crown_r * 0.2, crown_r * 0.1, cz + crown_r * 0.3), crown_r * 0.55, shape, rng, 0.12, 1, lod=1, only=(1,))
    blob(ms, leaf, (top[0], 0, cz), crown_r * 1.0, shape, rng, 0.1, 1, lod=2, only=(2,))


def spire(ms, rng, h, r, leaf='cypress_leaf', bark='bark', tiers=1):
    """A cypress or a spruce: a short trunk under one tall jittered spire (or stacked cones)."""
    limb(ms, bark, (0, 0, -0.008), (0, 0, h * 0.2), r * 0.18, r * 0.14, segs=5, lod=2)
    if tiers == 1:
        bm_scale = (1.0, 1.0, h * 0.85 / (2 * r))
        blob(ms, leaf, (0, 0, h * 0.12 + h * 0.85 / 2), r, bm_scale, rng, 0.12, 2, lod=0)
        blob(ms, leaf, (0, 0, h * 0.12 + h * 0.85 / 2), r, bm_scale, rng, 0.08, 1, lod=2, only=(1, 2))
    else:
        for k in range(tiers):
            z0 = h * (0.15 + 0.8 * k / tiers)
            rr = r * (1 - 0.7 * k / tiers)
            limb(ms, leaf, (0, 0, z0), (0, 0, z0 + h * 0.85 / tiers * 1.5), rr, 0.0, segs=8, lod=0)
            if k % 2 == 0:
                limb(ms, leaf, (0, 0, z0), (0, 0, z0 + h * 0.85 / tiers * 2.6), rr, 0.0, segs=5, lod=2, only=(1, 2), caps=False)


def umbrella(ms, rng, h, crown_r, leaf='pine_leaf', bark='bark_pale'):
    """An umbrella (stone) pine: a tall bare leaning trunk, a wide flat crown."""
    lean = rng.uniform(0.04, 0.08) * h
    limb(ms, bark, (0, 0, -0.008), (lean, 0, h * 0.82), crown_r * 0.07, crown_r * 0.05, segs=6, lod=0)
    limb(ms, bark, (0, 0, -0.008), (lean, 0, h * 0.82), crown_r * 0.07, crown_r * 0.05, segs=4, lod=2, only=(1, 2), caps=False)
    for k in range(5):
        a = 2 * math.pi * k / 5 + rng.uniform(-0.3, 0.3)
        blob(ms, leaf, (lean + math.cos(a) * crown_r * 0.5, math.sin(a) * crown_r * 0.5, h * 0.88), crown_r * 0.5, (1, 1, 0.42), rng, 0.2, 1, lod=0)
    blob(ms, leaf, (lean, 0, h * 0.9), crown_r * 0.55, (1, 1, 0.45), rng, 0.2, 1, lod=0)
    blob(ms, leaf, (lean, 0, h * 0.88), crown_r, (1, 1, 0.38), rng, 0.1, 1, lod=2, only=(1, 2))


def palm(ms, rng, h, frond=0.28, leaf='palm_leaf', bark='bark_pale', fronds=9):
    """A date palm: a ringed curving trunk and a head of drooping fronds."""
    bend = rng.uniform(0.05, 0.1) * h
    pts = [(bend * (t / 3) ** 2, 0, h * t / 3) for t in range(4)]
    for k, (a, b) in enumerate(zip(pts, pts[1:])):
        limb(ms, bark, a, b, 0.03 - 0.004 * k, 0.026 - 0.004 * k, segs=6, lod=0, caps=False)
    limb(ms, bark, pts[0], pts[-1], 0.03, 0.02, segs=4, lod=2, only=(1, 2), caps=False)
    top = Vector(pts[-1])
    for k in range(fronds):
        a = 2 * math.pi * k / fronds + rng.uniform(-0.15, 0.15)
        up = rng.uniform(-0.05, 0.12)
        tip = top + Vector((math.cos(a) * frond, math.sin(a) * frond, up * frond))
        slab(ms, leaf, top, tip, 0.05, t=0.004, lod=0, droop=frond * 0.32)
        if k % 3 == 0:
            slab(ms, leaf, top, tip, 0.07, t=0.004, lod=2, only=(1, 2), droop=frond * 0.32)
    blob(ms, 'bark', (top.x, 0, top.z - 0.01), 0.04, (1, 1, 1.2), rng, 0.1, 1, lod=1)  # the date clusters


def acacia(ms, rng, h, crown_r, leaf='acacia_leaf', bark='bark'):
    """An umbrella thorn: a forked trunk and a flat-topped layered crown."""
    for sx in (-1, 1):
        limb(ms, bark, (0, 0, -0.008), (sx * crown_r * 0.35, 0, h * 0.78), crown_r * 0.06, crown_r * 0.035, segs=5, lod=0)
    limb(ms, bark, (0, 0, -0.008), (0, 0, h * 0.78), crown_r * 0.07, crown_r * 0.04, segs=4, lod=2, only=(1, 2), caps=False)
    for k in range(4):
        a = 2 * math.pi * k / 4 + rng.uniform(-0.3, 0.3)
        blob(ms, leaf, (math.cos(a) * crown_r * 0.45, math.sin(a) * crown_r * 0.45, h * 0.86), crown_r * 0.5, (1, 1, 0.3), rng, 0.25, 1, lod=0)
    blob(ms, leaf, (0, 0, h * 0.88), crown_r, (1, 1, 0.24), rng, 0.12, 1, lod=2, only=(1, 2))


def bush(ms, rng, r, leaf='foliage', n=3):
    for k in range(n):
        a = 2 * math.pi * k / n
        blob(ms, leaf, (math.cos(a) * r * 0.4, math.sin(a) * r * 0.4, r * 0.25), r * rng.uniform(0.6, 0.75), (1, 1, 0.75), rng, 0.25, 1, lod=0, cut=-r * 0.3)
    blob(ms, leaf, (0, 0, r * 0.2), r, (1, 1, 0.65), rng, 0.15, 1, lod=2, only=(1, 2), cut=-r * 0.3)


def grass_tuft(ms, rng, h, mat='tuft', blades=9):
    for k in range(blades):
        a = 2 * math.pi * k / blades + rng.uniform(-0.3, 0.3)
        lean = rng.uniform(0.25, 0.5) * h
        hh = h * rng.uniform(0.7, 1.1)
        limb(ms, mat, (math.cos(a) * 0.006, math.sin(a) * 0.006, -0.002), (math.cos(a) * lean, math.sin(a) * lean, hh), 0.006, 0.0, segs=3, lod=0, caps=False)
    for k in range(3):
        a = 2 * math.pi * k / 3
        limb(ms, mat, (0, 0, -0.002), (math.cos(a) * h * 0.35, math.sin(a) * h * 0.35, h * 0.9), 0.01, 0.0, segs=3, lod=2, only=(1, 2), caps=False)


def disc(ms, mat, at, toward, r, segs=6, lod=0, only=None, flip=False):
    """A flat n-gon facing along `toward` (a log's sawn end, a stump's top): one face."""
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=False, segments=segs, radius=r)
    if flip:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    m = Matrix.Translation(Vector(at)) @ Vector(toward).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    return ms.add(bm, mat, lod, m, only=only)


def log(ms, p0, p1, r, bark='bark', ends='cut_wood', segs=6, lod=2, only=None, taper=1.0):
    """A cut log from p0 to p1: bark round the side and a pale sawn face on each end (the cue that
    says worked wood at any zoom). An open tube and two faces: 2 * segs + 2 * (segs - 2) triangles."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    limb(ms, bark, p0, p1, r, r * taper, segs=segs, lod=lod, only=only, caps=False)
    disc(ms, ends, p0 - d * 0.0004, d, r, segs, lod, only, flip=True)
    disc(ms, ends, p1 + d * 0.0004, d, r * taper, segs, lod, only)


def log_stack(ms, x, y, length, r, rows=(3, 2, 1), bark='bark', yaw=0.0, stakes=True, far_rows=None, z=0.0):
    """Logs stacked in a pyramid along the local x axis, their sawn ends showing at both sides,
    between two stakes a side. LOD1 keeps every log five-sided, LOD2 four-sided (`far_rows`: only
    those rows, a little thicker)."""
    f = Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
    pitch = r * 2.02
    for row, n in enumerate(rows):
        zz = r + row * pitch * 0.87
        for k in range(n):
            yy = (k - (n - 1) / 2) * pitch
            a, b = f @ Vector((-length / 2, yy, zz)), f @ Vector((length / 2, yy, zz))
            log(ms, a, b, r, bark=bark, segs=6, lod=0)
            log(ms, a, b, r, bark=bark, segs=5, lod=1, only=(1,))
            if far_rows is None or row in far_rows:
                log(ms, a, b, r * (1.0 if far_rows is None else 1.25), bark=bark, segs=4, lod=2, only=(2,))
    if stakes:
        w = rows[0] * pitch / 2 + r * 0.3
        for sx in (-0.3, 0.3):
            for sy in (-1, 1):
                p = f @ Vector((sx * length, sy * w, -0.006))
                q = f @ Vector((sx * length, sy * w * 0.94, r * 2.7))
                limb(ms, bark, p, q, r * 0.24, r * 0.2, segs=4, lod=1, caps=False)


def _burn(rng, n):
    """Draw the `n` numbers a retired shape used to draw, so the objects built after it in the
    same file keep their shapes."""
    for _ in range(n):
        rng.uniform(0, 1)


def stump(ms, rng, r, h=0.05, bark='bark'):
    """A felled grove's stumps (MD06): a broad stump with a pale sawn top and spreading roots, two
    smaller ones beside it and pale chips on the ground. The pale tops are what reads from above."""
    _burn(rng, 3)
    own = random.Random(9107)
    for k, (x, y, rr, hh) in enumerate([(0.0, 0.0, r * 1.5, h * 1.3), (r * 4.0, r * 1.8, r * 1.1, h * 0.9), (-r * 2.6, r * 3.4, r * 0.9, h * 0.7)]):
        far = (1, 2) if k == 0 else (1,)
        limb(ms, bark, (x, y, -0.008), (x, y, hh), rr * 1.12, rr, segs=8, lod=0, caps=False)
        disc(ms, 'cut_wood', (x, y, hh), (0, 0, 1), rr, 8, lod=0)
        limb(ms, bark, (x, y, -0.008), (x, y, hh), rr * 1.12, rr, segs=5, lod=far[-1], only=far, caps=False)
        disc(ms, 'cut_wood', (x, y, hh), (0, 0, 1), rr, 5, lod=far[-1], only=far)
        roots = 4 if k == 0 else 3
        for i in range(roots):
            a = 2 * math.pi * i / roots + own.uniform(-0.3, 0.3)
            limb(ms, bark, (x, y, hh * 0.45), (x + math.cos(a) * rr * 2.3, y + math.sin(a) * rr * 2.3, 0.0), rr * 0.4, rr * 0.14, segs=4, lod=0)
    for i in range(7):  # chips of fresh wood
        a, d = own.uniform(0, 2 * math.pi), own.uniform(1.8, 4.5) * r
        ms.box('cut_wood', (r * 0.5, r * 0.28, r * 0.12), at=(math.cos(a) * d, math.sin(a) * d + r, 0), rot_z=own.uniform(0, 180), lod=0)


def felled(ms, rng, length, r, bark='bark', leaf='foliage'):
    """A grove being cut (MD06): the trunk down beside its pale-topped stump, the crown lopped and
    the first logs stacked. The trunk is thick enough to read at battle zoom (0.8 m across)."""
    _burn(rng, 12)
    own = random.Random(9203)
    r = r * 1.45
    sx = -length / 2 - r * 2.2
    for segs, lod, only in ((8, 0, None), (5, 2, (1, 2))):
        limb(ms, bark, (sx, 0, -0.008), (sx, 0, r * 1.5), r * 1.15, r * 1.02, segs=segs, lod=lod, only=only, caps=False)
        disc(ms, 'cut_wood', (sx, 0, r * 1.5), (0, 0, 1), r * 1.02, segs, lod=lod, only=only)
    a = Vector((-length / 2, 0.012, r * 0.9))
    b = Vector((length / 2, 0.03, r * 0.72))
    log(ms, a, b, r, bark=bark, segs=8, lod=0, taper=0.72)
    log(ms, a, b, r, bark=bark, segs=5, lod=2, only=(1, 2), taper=0.72)
    for k in range(3):  # the crown's limbs, lopped
        x = length / 2 - 0.05 * k
        limb(ms, bark, (x, 0.03, r), (x + 0.12, 0.03 + 0.09 * (1 if k % 2 else -1), r * 0.6), r * 0.3, r * 0.15, segs=4, lod=0)
    blob(ms, leaf, (length / 2 + 0.1, 0.03, r), length * 0.16, (1.2, 1, 0.5), own, 0.25, 1, lod=1, cut=-0.02)
    log_stack(ms, -length * 0.08, -r * 4.6, length * 0.42, r * 0.7, rows=(3, 2), bark=bark, stakes=False, far_rows=(0,))


def log_pile(ms, rng, length=0.26, r=0.032, bark='bark'):
    """A worked grove's marker (MD06): six cut logs stacked three, two, one between stakes."""
    log_stack(ms, 0, 0, length, r, rows=(3, 2, 1), bark=bark, stakes=True)


# ---- quarry and gold (MD06) ------------------------------------------------------------------------

def crag(ms, mat, x, y, r, h, rng, subdiv=2, lod=0, only=None, jitter=0.14, taper=0.74, yaw=0.0, veins=(), vein_mat='gold_bright'):
    """A pointed crag: a jittered lump drawn in toward its top, its foot cut flat under Z = 0.
    `r` is its radius at the ground, `h` its height. `veins` are seams of `vein_mat` through it:
    (height as a share of h, tilt in degrees, compass direction of the dip in degrees, thickness);
    the faces a seam's slab crosses take the vein's material, so a seam is flush with the rock and
    ragged along the facets, never a hoop round it."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    for v in bm.verts:
        v.co *= 1.0 + rng.uniform(-jitter, jitter)
        k = 1.0 - taper * (v.co.z + 1.0) / 2.0
        v.co.x *= k
        v.co.y *= k
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, -0.5), plane_no=(0, 0, 1), clear_inner=True)
    edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges)
    sz = h / 1.5
    foot = 0.866 * (1.0 - taper * 0.25)  # the lump's radius where the ground cuts it
    m = (Matrix.Translation(Vector((x, y, 0.5 * sz - 0.006))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
         @ Matrix.Diagonal(Vector((r / foot, r / foot, sz, 1.0))))
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    if veins:
        slabs = []
        for share, tilt, dip, thick in veins:
            t, d = math.radians(tilt), math.radians(dip)
            slabs.append((Vector((x, y, h * share)), Vector((math.sin(t) * math.cos(d), math.sin(t) * math.sin(d), math.cos(t))), thick / 2))
        def in_vein(face):
            c = face.calc_center_median()
            return c.z > 0.004 and any(abs((c - p).dot(n)) < half for p, n, half in slabs)
        ore = bm.copy()
        bmesh.ops.delete(ore, geom=[f for f in ore.faces if not in_vein(f)], context='FACES')
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if in_vein(f)], context='FACES')
        if ore.faces:
            ms.add(ore, vein_mat, lod, only=only)
    return ms.add(bm, mat, lod, only=only)


# ---- herd animals (validate_model.py `herd`: 400 / 150 / 60) ---------------------------------------

def quadruped(ms, rng, length, height, body='wool', head='wool_dark', leg='wool_dark', horns=None, tail=True, horn_mat='horn'):
    """One grazing animal at true size, facing -Y: body, neck and head, four legs with hooves."""
    leg_h = height * 0.5
    bl = length * 0.74
    bz = leg_h + height * 0.2
    body_scale = (height * 0.3 / (bl / 2), 1.0, height * 0.29 / (bl / 2))
    blob(ms, body, (0, 0, bz), bl / 2, body_scale, rng, 0.06, 2, lod=0)
    blob(ms, body, (0, 0, bz), bl / 2, body_scale, None, 0, 1, lod=2, only=(1, 2))
    neck0 = Vector((0, -bl * 0.4, bz + height * 0.06))
    headp = Vector((0, -bl * 0.6, bz - height * 0.08))  # grazing: the head low
    limb(ms, body, neck0, headp, height * 0.12, height * 0.09, segs=5, lod=1)
    blob(ms, head, headp + Vector((0, -height * 0.08, -height * 0.06)), height * 0.13, (0.8, 1.35, 0.85), None, 0, 1, lod=2)
    for sx in (-1, 1):  # ears
        ms.box(head, (height * 0.12, height * 0.03, height * 0.05), at=(sx * height * 0.11, headp.y + height * 0.02, headp.z + height * 0.02), lod=0)
    if horns:
        for sx in (-1, 1):
            limb(ms, horn_mat, headp + Vector((sx * height * 0.06, 0, height * 0.08)), headp + Vector((sx * horns[0], horns[1], horns[2])), height * 0.035, height * 0.008, segs=4, lod=0, caps=False)
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * height * 0.13, sy * bl * 0.34
            limb(ms, leg, (x, y, 0.004), (x, y, leg_h + height * 0.08), height * 0.05, height * 0.06, segs=5, lod=1)
            ms.box('hoof', (height * 0.08, height * 0.08, height * 0.05), at=(x, y, 0), lod=0)
    for sy in (-1, 1):  # LOD2: each pair of legs as one post
        limb(ms, leg, (0, sy * bl * 0.34, 0), (0, sy * bl * 0.34, leg_h + height * 0.08), height * 0.14, height * 0.14, segs=3, lod=2, only=(2,), caps=False)
    if tail:
        limb(ms, body, (0, bl * 0.48, bz + height * 0.08), (0, bl * 0.56, bz - height * 0.25), height * 0.04, height * 0.02, segs=4, lod=0, caps=False)


# ---- water --------------------------------------------------------------------------------------

def ring(ms, mat, x, y, r, w=0.006, z=0.002, segs=16, lod=0, only=None):
    """A flat ring on the water: a ripple."""
    bm = bmesh.new()
    inner, outer = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        inner.append(bm.verts.new((x + (r - w) * math.cos(a), y + (r - w) * math.sin(a), z)))
        outer.append(bm.verts.new((x + r * math.cos(a), y + r * math.sin(a), z)))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
    return ms.add(bm, mat, lod, only=only)


def fish(ms, x, y, yaw, size=0.05, z=0.003, lod=0, jump=0.0, mat='fish', only=None):
    """A fish lying just under the surface (a dark shape), or leaping (`jump` > 0, arched above)."""
    f = tm.house_frame(x, y, yaw)
    if jump:
        f = f @ Matrix.Translation(Vector((0, 0, jump))) @ Matrix.Rotation(math.radians(-35), 4, 'X')
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size * 0.5)
    for v in bm.verts:
        v.co.x *= 0.28
        v.co.z *= 0.3
        v.co.y *= 1.0
    bmesh.ops.translate(bm, vec=(0, 0, z), verts=bm.verts)
    ms.add(bm, mat, lod, f, only=only)
    tail = bmesh.new()
    v = [tail.verts.new((0, size * 0.45, z)), tail.verts.new((-size * 0.18, size * 0.72, z)), tail.verts.new((size * 0.18, size * 0.72, z))]
    tail.faces.new(v)
    ms.add(tail, mat, lod, f, only=only)
