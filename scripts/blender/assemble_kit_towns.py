# scripts/blender/assemble_kit_towns.py
# Assemble the six towns of a regional kit delivered as finished Blender models
# (plans/art/blender-delivery-spec.md): <kit_dir>/<age>/houses/model.glb (house-poor,
# house-common, house-rich), landmark-1/model.glb and landmark-2/model.glb (object `landmark`).
# It lays the houses round a free centre (poor outside, rich next to the square, facing the
# centre, no overlaps, all on the ground), puts the landmarks at the north, lays a ground patch in
# the colour of the kit's street swatch, and hands everything to ti_town.build_file, which bakes
# ONE atlas per file (the kit's own textures bake through Cycles) and builds LOD1 and LOD2.
# A second mode builds the regional shared file from a Kingdoms kit (palace-small, palace,
# walls-medium).
#
#   python scripts/blender/assemble_kit_towns.py <kit_dir> <age> <style> <out_dir> [atlas]
#   python scripts/blender/assemble_kit_towns.py shared <kit_dir> <style> <out_dir> [atlas]
#   python scripts/blender/assemble_kit_towns.py shared-towns <towns_age_dir> <age> <style> <out_dir> [atlas]
#     (plans/art/towns/bronze, bronze, israelite: shared-bronze-israelite.glb from the delivered
#     palace-small, palace, walls-medium, colony-camp and field-1..4 folders that exist)
#   ONLY=small-a,big-b limits the towns built; NO_LANDMARKS=1 builds houses-only towns.
#   kit_dir is the style folder (plans/art/kits/nile); towns land in <out_dir>/<age>-town-<size>-<v>-<style>.glb
#   (and .blend beside it), the shared file in <out_dir>/shared-kingdoms-<style>.glb.
import math
import os
import random
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402

# ---- town sizes (1 unit = 10 m) -----------------------------------------------------------------
# R: ground radius; free: the free centre's radius (about 12 m across); count: houses wanted;
# lm_cap: (max footprint, max height) a landmark is scaled down to in that size (a 20 m pylon does
# not fit a 40 m town). rings, filled in this order: types (in order round the ring), anchor
# ('outer' pushes a house as far out as the ground allows, ('inner', e) puts its front edge e from
# the centre), band (how far a house may slip from there to fit a gap), spread (False packs the
# ring tight from `start` degrees instead of spreading it evenly round the town).
SIZES = {
    'small': dict(R=2.0, free=0.6, count=(6, 8), lm_cap=(1.0, 1.6), lm_out=True, edge=0.92,
                  rings=[dict(types=['common', 'poor', 'poor', 'poor', 'poor', 'poor', 'poor', 'poor'], anchor='outer', band=0.12)]),
    'medium': dict(R=3.0, free=0.6, count=(12, 14), lm_cap=(1.6, 2.4),
                   rings=[dict(types=['rich'], anchor=('inner', 0.62), band=0.0, spread=False, start=262),
                          dict(types=['poor', 'poor', 'common', 'poor', 'poor', 'poor', 'poor', 'common', 'poor', 'poor'], anchor='outer', band=0.0, max=10),
                          dict(types=['common', 'rich', 'common'], anchor=('inner', 0.62), band=0.04)],
                   # when the rich house leaves too little room (two big landmarks): the denser ring
                   fallback=[dict(types=['poor', 'poor', 'common', 'poor', 'poor', 'poor', 'poor', 'common', 'poor', 'poor'], anchor='outer', band=0.0, max=10),
                             dict(types=['rich', 'common', 'rich', 'common'], anchor=('inner', 0.62), band=0.04)],
                   fallback2=[dict(types=['poor', 'poor', 'common', 'poor', 'poor', 'poor', 'poor', 'poor', 'poor', 'poor'], anchor='outer', band=0.0, max=10),
                              dict(types=['common', 'poor', 'common', 'poor'], anchor=('inner', 0.62), band=0.08)]),
    'big': dict(R=4.0, free=0.6, count=(22, 26), lm_cap=(1.9, 3.6),
                rings=[dict(types=['poor', 'common', 'poor', 'poor', 'poor', 'common', 'poor', 'poor'] * 3, anchor='outer', band=0.0, max=17),
                       dict(types=['rich', 'common', 'rich', 'common', 'common', 'rich', 'common', 'rich', 'common', 'rich'], anchor=('inner', 1.35), band=0.18)],
                fallback=[dict(types=['poor', 'common', 'poor', 'poor', 'poor', 'poor', 'poor', 'poor'] * 3, anchor='outer', band=0.0, max=17),
                          dict(types=['rich', 'common', 'poor', 'common', 'rich', 'poor', 'common', 'poor', 'common', 'poor'], anchor=('inner', 1.3), band=0.2)]),
}
GROUND_SCALE = 0.985   # the patch radius (its wobble reaches about +4%: the footprint stays within 5%)
EDGE = 0.90            # buildings keep inside 90% of the radius (the solid part of the patch)
MIN_GAP = 0.03         # 30 cm at least between two buildings
# Landmark angles (degrees, 90 = north) and which landmark, per size and variant.
LANDMARKS = {
    ('small', 'a'): [('landmark-1', 90)],
    ('small', 'b'): [('landmark-2', 100)],
    ('medium', 'a'): [('landmark-1', 120), ('landmark-2', 58)],
    ('medium', 'b'): [('landmark-2', 128), ('landmark-1', 72)],
    ('big', 'a'): [('landmark-1', 118), ('landmark-2', 60)],
    ('big', 'b'): [('landmark-2', 124), ('landmark-1', 66)],
}
# Modern landmarks may stand up to 50 m in the big town (art spec 3b): its height cap is raised.
MODERN_BIG_CAP = (1.9, 5.0)
LOD1_BUDGET = 10000  # a whole town's LOD1 triangles (brief: 60,000 / 10,000 / 1,500)
TOWNS = [(s, v) for s in ('small', 'medium', 'big') for v in ('a', 'b')]


# ---- 2D layout (pure Python) --------------------------------------------------------------------

class Box:
    """A footprint rectangle: origin (x, y), yaw (degrees, the house frame's), half sizes, and the
    local offset of the object's bounding-box centre from its origin."""

    def __init__(self, x, y, yaw, hw, hd, ox=0.0, oy=0.0):
        self.x, self.y, self.yaw, self.hw, self.hd = x, y, yaw, hw, hd
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        self.ax = (c, s)
        self.ay = (-s, c)
        self.cx = x + c * ox - s * oy
        self.cy = y + s * ox + c * oy
        self.rad = math.hypot(hw, hd)

    def corners(self, pad=0.0):
        out = []
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            lx, ly = sx * (self.hw + pad), sy * (self.hd + pad)
            out.append((self.cx + self.ax[0] * lx + self.ay[0] * ly, self.cy + self.ax[1] * lx + self.ay[1] * ly))
        return out

    def overlaps(self, other, gap):
        """Separating axes, with `gap` of clearance between the two."""
        if math.hypot(self.cx - other.cx, self.cy - other.cy) > self.rad + other.rad + gap:
            return False
        a, b = self.corners(gap / 2), other.corners(gap / 2)
        for axis in (self.ax, self.ay, other.ax, other.ay):
            pa = [p[0] * axis[0] + p[1] * axis[1] for p in a]
            pb = [p[0] * axis[0] + p[1] * axis[1] for p in b]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return False
        return True

    def min_radius(self):
        """Distance from the origin to the nearest point of the rectangle."""
        dx, dy = -self.cx, -self.cy
        lx = dx * self.ax[0] + dy * self.ax[1]
        ly = dx * self.ay[0] + dy * self.ay[1]
        qx = max(-self.hw, min(self.hw, lx))
        qy = max(-self.hd, min(self.hd, ly))
        return math.hypot(lx - qx, ly - qy)

    def max_radius(self):
        return max(math.hypot(px, py) for px, py in self.corners())


def box_at(dims, r, angle, scale=1.0):
    """The footprint of an object of `dims` (w, d, ox, oy) at polar (r, angle), facing the centre."""
    a = math.radians(angle)
    x, y = r * math.cos(a), r * math.sin(a)
    w, d, ox, oy = dims[:4]
    return Box(x, y, tm.facing_centre(x, y), w * scale / 2, d * scale / 2, ox * scale, oy * scale)


def outer_radius(dims, limit):
    """The largest radius at which a house facing the centre stays inside `limit`."""
    lo, hi = 0.0, limit
    for _ in range(30):
        mid = (lo + hi) / 2
        if box_at(dims, mid, 90).max_radius() <= limit:
            lo = mid
        else:
            hi = mid
    return lo


def radii(dims, anchor, band, limit, free):
    """Radii to try for a house, the preferred one first, then slipping up to `band` away."""
    r_out = outer_radius(dims, limit)
    r_in = free + 0.05 + dims[1] / 2 - dims[3]  # its front edge at the free centre
    pref = r_out if anchor == 'outer' else min(r_out, anchor[1] + dims[1] / 2 - dims[3])
    out = [pref]
    for k in range(1, int(band / 0.04) + 1):
        for r in ((pref - 0.04 * k,) if anchor == 'outer' else (pref + 0.04 * k, pref - 0.04 * k)):
            if r_in <= r <= r_out:
                out.append(r)
    return out


def fits(b, others, limit, free, gap):
    return b.max_radius() <= limit and b.min_radius() >= free and not any(b.overlaps(p, gap) for p in others)


def sweep(dims_of, types, ring, others, limit, free, gap, start):
    """Houses of `types` in order round the ring, each at the first angle after the previous one
    where it fits; a type that no longer fits anywhere gives way to a poor house."""
    anchor, band = ring['anchor'], ring['band']
    out = []
    cache = {t: radii(dims_of[t], anchor, band, limit, free) for t in dims_of if t.startswith(('poor', 'common', 'rich'))}
    a, end = start, start + 360.0
    for t in types:
        hit = None
        for tt_ in {'rich': ('rich', 'common', 'poor'), 'common': ('common', 'poor')}.get(t, (t,)):
            b_a = a
            while b_a < end and not hit:
                for r in cache[tt_]:
                    b = box_at(dims_of[tt_], r, b_a)
                    if fits(b, others + [o[1] for o in out], limit, free, gap):
                        hit = (tt_, b, b_a)
                        break
                else:
                    b_a += 1.0
            if hit:
                break
        if not hit:
            break
        out.append(hit[:2])
        a = hit[2]
    return out


def place_landmarks(specs, dims_of, limit, free, cap, out=False):
    """Each landmark near its angle, as close to the square as it fits (or, with `out`, as far
    out: a narrower slice of the ring, more room for houses), scaled to the size cap."""
    got = []
    for name, angle in specs:
        w, d, ox, oy, h = dims_of[name]
        s = min(1.0, cap[0] / max(w, d), cap[1] / h)
        done = None
        for tries in range(200):
            step = (tries + 1) // 2 * 2.0
            ang = angle + (step if tries % 2 else -step) * (1 if angle >= 90 else -1)
            r = free + 0.12
            while r < limit and not done:
                b = box_at(dims_of[name], r, ang, s)
                if b.min_radius() >= free + 0.1 and not any(b.overlaps(p[1], 0.12) for p in got):
                    if b.max_radius() <= limit:
                        done = (name, b, s)
                        while out:  # push it outward while it still fits
                            b2 = box_at(dims_of[name], r + 0.02, ang, s)
                            if b2.max_radius() > limit:
                                break
                            r += 0.02
                            done = (name, b2, s)
                    break
                r += 0.02
            if done:
                break
            if tries % 20 == 19:
                s *= 0.95  # still no room: a little smaller
        if not done:
            raise SystemExit('no room for %s' % name)
        got.append(done)
    return got


def forecourt(b, free):
    """The open ground between a landmark's front and the square, kept free of houses."""
    depth = max(0.0, b.min_radius() - free)
    a = math.atan2(b.y, b.x)
    mid = free + depth / 2
    return Box(mid * math.cos(a), mid * math.sin(a), b.yaw, b.hw * 0.8, depth / 2)


def landmark_specs(size, variant, single=False):
    """(name, angle) per landmark; a kit with one landmark puts it alone at the north."""
    specs = LANDMARKS[(size, variant)]
    return [('landmark-1', 90 if variant == 'a' else 100)] if single else specs


def plan_town(size, variant, dims_of, seed, landmarks=True, single=False, cap=None):
    """The whole layout: landmarks [(name, Box, scale)], houses [(type, Box)], props [(kind, Box)]."""
    cfg = SIZES[size]
    rng = random.Random(seed)
    R = cfg['R'] * GROUND_SCALE
    limit = R * cfg.get('edge', EDGE)
    free = cfg['free']
    lms = place_landmarks(landmark_specs(size, variant, single), dims_of, limit, free, cap or cfg['lm_cap'], out=cfg.get('lm_out', False)) if landmarks else []
    placed = [b for _n, b, _s in lms] + [forecourt(b, free) for _n, b, _s in lms if cfg.get('lm_out')]
    lo, hi = cfg['count']
    best = []
    for rings in (cfg['rings'], cfg.get('fallback'), cfg.get('fallback2')):  # the rich-house layout first, then denser ones
        if rings is None:
            continue
        for k in range(16):  # a few seeded arrangements: the first with enough houses wins
            start0 = 90.0 + rng.uniform(-8, 8) + (12 if variant == 'b' else 0)
            houses = lay_rings(rings, variant, dims_of, placed, limit, free, hi, start0, random.Random(seed + 7 + k))
            if len(houses) > len(best):
                best = houses
            if len(houses) >= lo:
                break
        if len(best) >= lo:
            break
    houses = best
    base_cap = cfg['lm_cap']
    if len(houses) < lo and lms and (cap or base_cap)[0] > base_cap[0] * 0.85:
        # still short: the landmarks a little smaller (at most twice, 10% each), then lay it out again
        c = cap or base_cap
        return plan_town(size, variant, dims_of, seed, landmarks, single, (c[0] * 0.9, c[1] * 0.9))
    if not (lo <= len(houses) <= hi):
        print('WARNING %s-%s: %d houses (wanted %d to %d)' % (size, variant, len(houses), lo, hi))
    return lms, houses, props_for(placed, houses, free, limit, rng)


def lay_rings(rings, variant, dims_of, placed, limit, free, hi, start, rng):
    houses = []
    for k, ring in enumerate(rings):
        types = list(ring['types'])
        if variant == 'b':
            rng.shuffle(types)  # another arrangement of the same mix
        others = placed + [b for _t, b in houses]
        # as many of the ring's houses as fit (no more than the town still wants), then the widest
        # gap that keeps them all, so they spread evenly round the ring
        a0 = ring.get('start', start) + (rng.uniform(-10, 10) if 'start' in ring else 0)
        n = min(len(sweep(dims_of, types, ring, others, limit, free, MIN_GAP, a0)), hi - len(houses), ring.get('max', 99))
        want = types[:n]
        best = sweep(dims_of, want, ring, others, limit, free, MIN_GAP, a0)
        g_lo, g_hi = MIN_GAP, 0.9
        for _ in range(9 if ring.get('spread', True) else 0):
            mid = (g_lo + g_hi) / 2
            res = sweep(dims_of, want, ring, others, limit, free, mid, a0)
            if len(res) >= n:
                g_lo, best = mid, res
            else:
                g_hi = mid
        houses += best
        start += 9.0
    return houses


def props_for(placed, houses, free, limit, rng):
    # props: a well by the square and a few heaps of jars and crates between the houses
    obstacles = placed + [b for _t, b in houses]
    props = []
    for kind, rad, n, rmin, rmax in (('well', 0.15, 1, free + 0.2, free + 1.0), ('clutter', 0.1, 3 + len(houses) // 6, free + 0.2, limit - 0.1)):
        got = 0
        for _ in range(400):
            if got >= n:
                break
            a = rng.uniform(150, 390)  # the south half and the sides; the landmarks keep the north
            r = rng.uniform(rmin, rmax)
            b = Box(r * math.cos(math.radians(a)), r * math.sin(math.radians(a)), rng.uniform(0, 90), rad, rad)
            if fits(b, obstacles, limit, free + 0.05, 0.05):
                props.append((kind, b))
                obstacles.append(b)
                got += 1
    return props


# ---- kit import ---------------------------------------------------------------------------------

class Part:
    """One kit object: per material role ('town' / 'team') the LOD0 bmesh, a decimated LOD1, and
    the LOD2 stand-in, all in the object's own frame (origin at its footprint centre)."""

    def __init__(self, name, key):
        self.name, self.key = name, key
        self.lod0, self.lod1, self.lod2 = {}, {}, {}
        self.dims = None
        self.height = 0.0
        self.tris = 0


ROLES = ('town', 'team', 'ground')


def _role(mat):
    """A kit material's role: a name holding 'team' is Team, 'ground' is Ground, the rest Town."""
    name = mat.name.lower() if mat else ''
    return 'team' if 'team' in name else 'ground' if 'ground' in name else 'town'


def _split_roles(me, mats):
    """{role: bmesh} keeping only the faces of each material role."""
    out = {}
    for role in ROLES:
        idx = [i for i, m in enumerate(mats) if m == role]
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in idx], context='FACES')
        if bm.faces:
            out[role] = bm
        else:
            bm.free()
    return out


def _decimated(obj, ratio):
    o = obj.copy()
    o.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(o)
    if ratio < 0.999:
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        for x in bpy.context.scene.objects:
            x.select_set(x == o)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    me = o.data
    bpy.data.objects.remove(o)
    return me


def load_kit(paths, lod1_ratio=None, lod2_tris=None, lod2_box=()):
    """Import GLBs {key: path}; returns ({object name: Part}, {key: image}). Imported objects are
    removed again (they would shade the AO bake). Material roles: see _role."""
    parts, images = {}, {}
    for key, path in paths.items():
        before = set(bpy.data.objects)
        mats_before = set(bpy.data.materials)
        bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]
        for o in new:
            if o.type != 'MESH':
                continue
            o.data = o.data.copy()
            o.data.transform(o.matrix_world)
            o.matrix_world = Matrix.Identity(4)
            me = o.data
            if me.uv_layers:
                me.uv_layers[0].name = 'orig'
            mats = [_role(m) for m in me.materials]
            for m in me.materials:
                for n in (m.node_tree.nodes if m and m.use_nodes else []):
                    if n.type == 'TEX_IMAGE' and n.image and key not in images:
                        images[key] = n.image
            p = Part(o.name.split('.')[0], key)
            vs = [v.co for v in me.vertices]
            lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
            hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
            p.dims = (hi.x - lo.x, hi.y - lo.y, (hi.x + lo.x) / 2, (hi.y + lo.y) / 2)
            p.height = hi.z
            me.calc_loop_triangles()
            p.tris = len(me.loop_triangles)
            p.lod0 = _split_roles(me, mats)
            r1 = lod1_ratio(p) if lod1_ratio else 1.0
            p.lod1 = _split_roles(_decimated(o, r1), mats)
            if p.name in lod2_box or key in lod2_box:
                bm = bmesh.new()  # a plain block: walls and roof read from the atlas at that zoom
                bmesh.ops.create_cube(bm, size=1.0)
                bmesh.ops.scale(bm, vec=(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z), verts=bm.verts)
                bmesh.ops.translate(bm, vec=((hi + lo) / 2), verts=bm.verts)
                bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.5], context='FACES')
                p.lod2 = {'town': bm}
            else:
                n2 = lod2_tris(p) if lod2_tris else 120
                p.lod2 = _split_roles(_decimated(o, min(1.0, n2 / max(1, p.tris))), mats)
            parts[p.name if p.name not in parts else key + ':' + p.name] = p  # two files may share an object name
        for o in new:
            bpy.data.objects.remove(o)
        for m in set(bpy.data.materials) - mats_before:
            m.name = '_kit_' + m.name  # keep the names Town / Team free for the final materials
    return parts, images


def kit_material(name, image):
    """A build material sampling the kit's own atlas through its original UVs (layer 'orig')."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'orig'
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    bsdf.inputs['Roughness'].default_value = 0.85
    return mat


def swatch_colours(path):
    """Four colours (dark to light quartiles) of the street swatch, for mat_earth."""
    img = bpy.data.images.load(path)
    px = list(img.pixels[:])
    bpy.data.images.remove(img)
    rgb = [(px[i], px[i + 1], px[i + 2]) for i in range(0, len(px), 4 * 7)]  # linear values

    def to_srgb(v):
        return 12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055
    rgb = [tuple(to_srgb(c) for c in p) for p in rgb]
    rgb.sort(key=lambda p: sum(p))
    out = []
    n = len(rgb)
    for q in range(4):
        chunk = rgb[q * n // 4:(q + 1) * n // 4]
        m = [sum(p[k] for p in chunk) / len(chunk) for k in range(3)]
        out.append('#%02x%02x%02x' % tuple(int(max(0, min(1, v)) * 255) for v in m))
    return tuple(out)


# The game multiplies Ground by the land's tint, so a town's ground must be light and neutral like the
# base shared files' (their ground averages about 0.70 in sRGB). mat_earth bakes about 1.1 to 1.15 times as
# bright as the colours it is given, so the swatch tones are scaled, hue kept, to this mean.
GROUND_SWATCH_LUM = 0.61


def ground_colours(colours, target=GROUND_SWATCH_LUM):
    rgb = [[int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)] for c in colours]
    lum = sum(sum(p) for p in rgb) / (3 * len(rgb))
    k = target / max(lum, 1e-3)
    return tuple('#%02x%02x%02x' % tuple(int(max(0, min(1, v * k)) * 255) for v in p) for p in rgb)


# ---- hooks into ti_town.build_file (wrappers; ti_map / ti_town stay untouched) --------------------
# build_file unwraps the joined LOD0 with Smart UV on the active layer and gives LOD1/LOD2 the
# atlas UVs by data transfer. The kit parts carry their original UVs as 'orig' (their materials
# sample the kit textures through it), so the atlas goes on a separate active layer 'UVMap' and
# 'orig' is dropped before export.
_smart_uv = tm.smart_uv
_transfer_uvs = tm.transfer_uvs


def _smart_uv_keep_orig(obj, *a, **kw):
    me = obj.data
    if 'orig' in me.uv_layers:
        uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
        me.uv_layers.active = uv
        uv.active_render = True
    return _smart_uv(obj, *a, **kw)


def _transfer_uvs_no_orig(src, dst):
    me = dst.data
    while 'orig' in me.uv_layers:
        me.uv_layers.remove(me.uv_layers['orig'])
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    return _transfer_uvs(src, dst)


tm.smart_uv = _smart_uv_keep_orig
tm.transfer_uvs = _transfer_uvs_no_orig


def register_materials(names, ground=None, team=(), kit_ground=()):
    for n in names:
        if n not in tt.PROC:
            tt.PROC.append(n)
        if n in team:
            tt.TO_FINAL[n] = 'Team'
        if n in kit_ground:  # a delivered ground: baked like the rest, exported as Ground
            tt.TO_FINAL[n] = 'Ground'
    if ground:
        base, colours = ground
        for n in (base, base + '_fringe', base + '_square'):
            if n not in tt.PROC:
                tt.PROC.append(n)
            tt.TO_FINAL[n] = 'Ground'
        if base + '_fringe' not in tt.FRINGES:
            tt.FRINGES.append(base + '_fringe')


def add_part(ms, part, frame, scale=1.0):
    """The kit object at `frame`: LOD0 as delivered, LOD1 decimated, LOD2 its stand-in."""
    m = frame @ Matrix.Scale(scale, 4)
    for lod, store in ((0, part.lod0), (1, part.lod1), (2, part.lod2)):
        for role, bm in store.items():
            mat = 'nl_%s_%s' % (part.key, role)
            if mat not in tt.PROC:  # a ground role only the shared-towns mode registers: bake it as Town
                mat = 'nl_%s_town' % part.key
            ms.add(bm.copy(), mat, lod=2, matrix=m, only=(lod,))


def finish(out_dir, file_name):
    """Drop the build-only UV layer, save the .blend and export the GLB."""
    for me in bpy.data.meshes:
        while 'orig' in me.uv_layers:
            me.uv_layers.remove(me.uv_layers['orig'])
    roots = [o for o in bpy.context.scene.objects if o.parent is None and o.type == 'EMPTY']
    exported = roots + [c for r in roots for c in r.children]
    for o in [o for o in bpy.context.scene.objects if o not in exported]:
        bpy.data.objects.remove(o)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, file_name + '.blend'))
    tm.export_glb(os.path.join(out_dir, file_name + '.glb'), exported)
    height = max(max((c.matrix_world @ Vector(v)).z for v in c.bound_box) for r in roots for c in r.children if c.name.startswith('LOD0'))
    print('wrote', os.path.join(out_dir, file_name + '.glb'), 'height', round(height, 3))
    return height


# ---- towns --------------------------------------------------------------------------------------

def seed_for(*keys):
    return zlib.crc32('/'.join(keys).encode()) & 0x7fffffff


def build_towns(kit_dir, age, style, out_dir, atlas=2048, only=(), landmarks=True):
    age_dir = os.path.join(kit_dir, age)
    paths = {'houses': os.path.join(age_dir, 'houses', 'model.glb')}
    for k in ('landmark-1', 'landmark-2'):
        p = os.path.join(age_dir, k, 'model.glb')
        if landmarks and os.path.exists(p):
            paths[k.replace('-', '')] = p
    # a kit with only landmark-1 (the Pacific marae) gets it alone in every town
    single = landmarks and list(paths) == ['houses', 'landmark1']
    landmarks = landmarks and (len(paths) == 3 or single)
    street = os.path.join(age_dir, 'materials', 'street-surface.png')
    os.makedirs(out_dir, exist_ok=True)
    results = {}
    for size, variant in TOWNS:
        tag = '%s-%s' % (size, variant)
        if only and tag not in only:
            continue
        state = {'lod1': 1.0}  # lod1: how much harder than usual LOD1 is decimated (dense kits)

        def kit_maker(state=state):
            # runs inside build_file's make_materials, after its factory reset: import the kit here
            def lod1_ratio(p):
                # about half of a light kit object; heavy kits (houses of 1,000+ triangles) are cut to
                # a fixed target so a big town's LOD1 stays inside its 10,000; state['lod1'] scales it
                # down further when a built town still comes out over budget (the LOD1 retry)
                if p.tris < 200:
                    return 1.0
                house = p.name.startswith('house')
                base = min(0.45 if house else 0.5, (240 if house else 800) / p.tris) if p.tris > 600 else (0.45 if house else 0.5)
                return base * state['lod1']

            def lod2_tris(p):
                return 110
            parts, images = load_kit(paths, lod1_ratio, lod2_tris, lod2_box=('house-poor', 'house-common', 'house-rich'))
            for key, img in images.items():
                kit_material('nl_%s_town' % key, img)
                kit_material('nl_%s_team' % key, img)
            colours = ground_colours(swatch_colours(street) if os.path.exists(street) else tt.EARTH)
            tm.mat_earth('nl_street', colors=colours)
            tm.mat_earth('nl_street_fringe', colors=colours)
            lighter = tuple('#%02x%02x%02x' % tuple(min(255, int(int(c[i:i + 2], 16) * 1.06)) for i in (1, 3, 5)) for c in colours)
            tm.mat_earth('nl_street_square', colors=lighter)
            state['parts'] = parts
        keys = list(paths)
        register_materials(['nl_%s_%s' % (k, r) for k in keys for r in ('town', 'team')], ground=('nl_street', None),
                           team=['nl_%s_team' % k for k in keys])
        tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]
        seed = seed_for(style, age, size, variant)
        R = SIZES[size]['R'] * GROUND_SCALE
        ground = dict(rx=R, ry=R, square=SIZES[size]['free'], mat='nl_street')
        name = 'town-%s-%s' % (size, variant)
        info = {}

        def layout(ms, rng, size=size, variant=variant, seed=seed, info=info, state=state):
            parts = state['parts']
            dims = {k: parts['house-' + k].dims for k in ('poor', 'common', 'rich')}
            if landmarks:
                for k in ('landmark-1',) if single else ('landmark-1', 'landmark-2'):
                    p = next(p for p in parts.values() if p.key == k.replace('-', ''))
                    dims[k] = p.dims + (p.height,)
            lms, houses, props = plan_town(size, variant, dims, seed, landmarks, single,
                                           cap=MODERN_BIG_CAP if (age, size) == ('modern', 'big') else None)
            for lname, b, s in lms:
                part = next(p for p in parts.values() if p.key == lname.replace('-', ''))
                add_part(ms, part, tm.house_frame(b.x, b.y, b.yaw), s)
            for t, b in houses:
                add_part(ms, parts['house-' + t], tm.house_frame(b.x, b.y, b.yaw))
            prng = random.Random(seed + 1)
            world = tm.house_frame(0, 0, 0)
            for kind, b in props:
                if age == 'modern':
                    continue
                if kind == 'well':
                    tt.well(ms, b.x, b.y, yaw=b.yaw)
                else:
                    tt.clutter(ms, world, b.x, b.y, prng, 4)
            info.update(houses=len(houses), types={t: sum(1 for x, _ in houses if x == t) for t in ('poor', 'common', 'rich')},
                        landmarks=[(n, round(s, 2)) for n, _b, s in lms])
            print('layout', name, info)
        file_name = '%s-town-%s-%s-%s' % (age, size, variant, style)
        for _ in range(3):
            counts = tt.build_file(file_name, [(name, layout, ground)], out_dir, atlas=atlas, seed=seed, write=False)
            lod1 = counts[name]['LOD1']
            if lod1 <= LOD1_BUDGET * 0.97:
                break
            # a dense kit (the 2048-atlas deliveries): decimate LOD1 harder and build again
            state['lod1'] *= LOD1_BUDGET * 0.92 / lod1
            print('LOD1 %d over the %d budget: rebuilding at x%.2f' % (lod1, LOD1_BUDGET, state['lod1']))
        height = finish(out_dir, file_name)
        results[file_name] = dict(info, triangles=counts[name], height=round(height, 3))
    return results


# ---- the shared file ----------------------------------------------------------------------------
WALLS_ACROSS = 6.8  # walls-medium: the ring round the 60 m town (brief: 6.4 to 6.9 across)


def build_shared(kit_dir, style, out_dir, atlas=2048):
    age_dir = os.path.join(kit_dir, 'kingdoms')
    paths = {'palacesmall': os.path.join(age_dir, 'palace-small', 'model.glb'),
             'palace': os.path.join(age_dir, 'palace', 'model.glb'),
             'walls': os.path.join(age_dir, 'walls-medium', 'model.glb')}
    state = {}
    budgets = {'palacesmall': (3000, 400), 'palace': (3000, 400), 'walls': (2300, 380)}

    def kit_maker():
        # LOD1 and LOD2 share each file's budget in proportion to its objects' triangles
        parts, images = load_kit(paths, lambda p: min(1.0, budgets[p.key][0] * 0.95 / total(p.key)),
                                 lambda p: budgets[p.key][1] * p.tris / total(p.key))
        for key, img in images.items():
            kit_material('nl_%s_town' % key, img)
            kit_material('nl_%s_team' % key, img)
        state['parts'] = parts

    tris_by_key = {}

    def total(key):
        return tris_by_key.get(key, 1)
    # triangle totals per file first (the walls file holds walls, gate and a tower)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for key, path in paths.items():
        bpy.ops.import_scene.gltf(filepath=path)
        n = 0
        for o in bpy.context.scene.objects:
            if o.type == 'MESH':
                o.data.calc_loop_triangles()
                n += len(o.data.loop_triangles)
        tris_by_key[key] = n
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o)
    keys = list(paths)
    register_materials(['nl_%s_%s' % (k, r) for k in keys for r in ('town', 'team')], team=['nl_%s_team' % k for k in keys])
    tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]

    def single(key):
        def layout(ms, rng):
            for p in state['parts'].values():
                if p.key == key:
                    add_part(ms, p, Matrix.Identity(4))
        return layout

    def walls(ms, rng):
        ring = [p for p in state['parts'].values() if p.key == 'walls']
        across = max(max(p.dims[0], p.dims[1]) for p in ring)
        s = WALLS_ACROSS / across
        for p in ring:  # the ring, its gate (south, -Y) and its tower, scaled across only
            add_part(ms, p, Matrix.Diagonal((s, s, 1.0, 1.0)))
    items = [('palace-small', single('palacesmall'), None), ('palace', single('palace'), None), ('walls-medium', walls, None)]
    file_name = 'shared-kingdoms-%s' % style
    counts = tt.build_file(file_name, items, out_dir, atlas=atlas, seed=seed_for(style, 'shared'), write=False)
    height = finish(out_dir, file_name)
    return {file_name: dict(triangles=counts, height=round(height, 3))}


# The objects of an age's shared file as delivered one per folder (plans/art/towns/<age>/<name>-<style>):
# kind (budget class), LOD1 and LOD2 triangle targets. Missing objects fall back in the game to the
# base shared file of the age.
TOWN_OBJECTS = [('palace-small', 3000, 400), ('palace', 3000, 400), ('walls-medium', 2300, 380),
                ('colony-camp', 2900, 480), ('field-1', 1450, 290), ('field-2', 1450, 290),
                ('field-3', 1450, 290), ('field-4', 1450, 290)]


def build_shared_objects(towns_dir, age, style, out_dir, atlas=2048):
    """shared-<age>-<style>.glb from <towns_dir>/<name>-<style>/model.glb for each object present.
    Camps and fields keep their delivered ground (material role 'ground', exported as Ground)."""
    found = [(n, l1, l2) for n, l1, l2 in TOWN_OBJECTS
             if os.path.exists(os.path.join(towns_dir, '%s-%s' % (n, style), 'model.glb'))]
    key_of = {n: n.replace('-', '') for n, _a, _b in found}
    paths = {key_of[n]: os.path.join(towns_dir, '%s-%s' % (n, style), 'model.glb') for n, _a, _b in found}
    budgets = {key_of[n]: (l1, l2) for n, l1, l2 in found}
    tris_by_key = {}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for key, path in paths.items():  # triangle totals per file first (walls: ring, gate and tower)
        bpy.ops.import_scene.gltf(filepath=path)
        n = 0
        for o in bpy.context.scene.objects:
            if o.type == 'MESH':
                o.data.calc_loop_triangles()
                n += len(o.data.loop_triangles)
        tris_by_key[key] = n
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o)
    state = {}

    def kit_maker():
        parts, images = load_kit(paths, lambda p: min(1.0, budgets[p.key][0] * 0.95 / tris_by_key[p.key]),
                                 lambda p: budgets[p.key][1] * p.tris / tris_by_key[p.key])
        for key, img in images.items():
            for role in ROLES:
                kit_material('nl_%s_%s' % (key, role), img)
        state['parts'] = parts
    keys = list(paths)
    register_materials(['nl_%s_%s' % (k, r) for k in keys for r in ROLES], team=['nl_%s_team' % k for k in keys],
                       kit_ground=['nl_%s_ground' % k for k in keys])
    tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]

    def single(key):
        def layout(ms, rng):
            for p in state['parts'].values():
                if p.key == key:
                    add_part(ms, p, Matrix.Identity(4))
        return layout

    def walls(ms, rng):
        ring = [p for p in state['parts'].values() if p.key == 'wallsmedium']
        across = max(max(p.dims[0], p.dims[1]) for p in ring)
        s = WALLS_ACROSS / across
        for p in ring:  # the ring, its gate (south, -Y) and its tower, scaled across only
            add_part(ms, p, Matrix.Diagonal((s, s, 1.0, 1.0)))
    items = [(n, walls if n == 'walls-medium' else single(key_of[n]), None) for n, _a, _b in found]
    file_name = 'shared-%s-%s' % (age, style)
    counts = tt.build_file(file_name, items, out_dir, atlas=atlas, seed=seed_for(style, age, 'shared'), write=False)
    height = finish(out_dir, file_name)
    return {file_name: dict(triangles=counts, height=round(height, 3))}


if __name__ == '__main__':
    import json
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    if argv and argv[0] == 'shared-towns':
        res = build_shared_objects(argv[1], argv[2], argv[3], argv[4], int(argv[5]) if len(argv) > 5 else 2048)
    elif argv and argv[0] == 'shared':
        res = build_shared(argv[1], argv[2], argv[3], int(argv[4]) if len(argv) > 4 else 2048)
    else:
        only = [n for n in os.environ.get('ONLY', '').split(',') if n]
        res = build_towns(argv[0], argv[1], argv[2], argv[3], int(argv[4]) if len(argv) > 4 else 2048, only,
                          landmarks=not os.environ.get('NO_LANDMARKS'))
    print('RESULT', json.dumps(res))
    sys.stdout.flush()
    os._exit(0)
