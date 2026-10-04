# scripts/blender/ti_levant_kingdoms.py
# The Levant kit for the Kingdoms Age (art spec 3b: Levant, Mesopotamia, Arabia, Persia; Abbasid
# and Seljuk), from the sheets in plans/art/kits/levant/kingdoms/: houses.png (a 5 x 7 m poor
# mud-brick house with a walled yard and a palm-frond shade; an 8 x 12 m common courtyard house
# in cream plaster with a pointed-arch portal, a court with a pool and a wind catcher; a 14 x 18 m
# rich house of two storeys with a blue-tiled portal (pishtaq), carved timber balconies, two wind
# catchers, a court with a long pool and palms), street.png and roofscape.png (grey flagstone
# lanes between sandy plots, grey cloth shades, reed mats and pergolas on the flat roofs, jars,
# a well), materials.png (cream plaster, buff brick, grey paving, blue tile, carved wood, wind
# catchers), the great mosque with the spiral minaret (landmark-1, Samarra), the caravanserai
# gate (landmark-2), palace-small, palace and walls-medium.
# Uses ti_kingdoms.py's helpers (flat_block, screen_box, palm, tree, street, market stalls,
# lod2_block, banner_pointed, fountain, arcade_hall) and ti_classical.py's cypress and shrub,
# all unchanged. Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the
# sheets' heights. Materials carry the `lvk_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_kingdoms as tk  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

NEW = ['lvk_plaster', 'lvk_niche', 'lvk_mud', 'lvk_mudroof', 'lvk_brick', 'lvk_ashlar', 'lvk_trim', 'lvk_stone', 'lvk_tile',
       'lvk_lead', 'lvk_roof', 'lvk_dome', 'lvk_sand', 'lvk_sand_fringe', 'lvk_sand_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'lvk_sand': 'Ground', 'lvk_sand_fringe': 'Ground', 'lvk_sand_square': 'Ground'})
if 'lvk_sand_fringe' not in tt.FRINGES:
    tt.FRINGES.append('lvk_sand_fringe')


def make_materials():
    # the houses: cream lime plaster, its shaded recesses, and the poor houses' mud brick under a worn mud wash
    tm.mat_simple('lvk_plaster', ['#e2d1aa', '#d8c59c', '#eadbb9', '#cfba90'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_simple('lvk_niche', ['#9e8763', '#a8916b', '#927b58'], scale=16.0, bump=0.2, dirt=False)
    tm.mat_mudwall('lvk_mud', wash='#c39d6b', brick='#b58f5e', brick2='#a07c50', mortar='#8e6d47', wash_cover=0.55,
                   bond=(0.05, 0.022, 0.004))
    tm.mat_simple('lvk_mudroof', ['#b9946a', '#c6a275', '#aa875f'], scale=18.0, bump=0.3, dirt=True)
    # the mosque: buff baked brick in fine courses; the gate, the walls and the palace foot: sandstone ashlar
    tm.mat_mudwall('lvk_brick', wash='#b8915a', brick='#b98f58', brick2='#a07a48', mortar='#cdb284', wash_cover=0.0,
                   bond=(0.036, 0.014, 0.003))
    tm.mat_mudwall('lvk_ashlar', wash='#cdb181', brick='#cbae7c', brick2='#b6976a', mortar='#ddc99d', wash_cover=0.0,
                   bond=(0.065, 0.032, 0.004))
    tm.mat_simple('lvk_trim', ['#e2cfa4', '#ead9b2', '#d6c194'], scale=20.0, bump=0.3)
    tm.mat_mudwall('lvk_stone', wash='#a39d92', brick='#a8a297', brick2='#918b80', mortar='#bdb7ab', wash_cover=0.0,
                   bond=(0.06, 0.03, 0.004))
    # glazed blue tile (cobalt and turquoise), the lead roofs with standing seams, flat plaster roofs, a pale dome
    tm.mat_simple('lvk_tile', ['#1f4c96', '#2b69b4', '#3b8fc4', '#173a7c'], scale=70.0, bump=0.12, rough=0.4)
    tm.mat_simple('lvk_lead', ['#55595e', '#63676c', '#4a4e53'], scale=10.0, stripes={'dir': 'X', 'scale': 50.0, 'distortion': 0.3},
                  bump=0.25, rough=0.55)
    tm.mat_simple('lvk_roof', ['#dbcca9', '#e3d6b8', '#d0bf9c'], scale=18.0, bump=0.2, dirt=True)
    tm.mat_simple('lvk_dome', ['#d6d4cf', '#e4e2dc', '#c6c4bf'], scale=12.0, bump=0.15)
    # the ground: sandy earth plots, grey flagstone lanes and squares
    sand = ('#c2a274', '#cfb085', '#b69468', '#c9ab7f')
    for n in ('lvk_sand', 'lvk_sand_fringe'):
        tm.mat_earth(n, colors=sand)
    tc.mat_paving('lvk_sand_square', stone=('#a9a297', '#9b9489', '#b5aea3'), mortar='#7c756a', slab=(0.05, 0.036))


if not any(n == 'levant_kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('levant_kingdoms', make_materials))

SANDY = dict(mat='lvk_sand', power=8)


# ---- small helpers ------------------------------------------------------------------------------

def pointed_pts(cx, a, zj, n=5, k=1.3):
    """A two-centred (Persian) pointed arch over half-width a, springing at zj: the points from the
    right jamb over the apex to the left jamb. Rise = 0.633 x 2a for k 1.3."""
    R = a * k
    off = R - a
    th = math.acos(off / R)
    right = [(cx - off + R * math.cos(th * i / n), zj + R * math.sin(th * i / n)) for i in range(n + 1)]
    left = [(cx + off - R * math.cos(th * i / n), zj + R * math.sin(th * i / n)) for i in range(n - 1, -1, -1)]
    return right + left


def arch_rise(a, k=1.3):
    R = a * k
    return R * math.sin(math.acos((R - a) / R))


def pointed(ms, f, mat, cx, y, z0, a, h, lod=0, n=5, only=None):
    """A flat pointed-arch opening (door, window, niche) on the local y plane facing -Y: half-width
    a, total height h (jambs plus arch)."""
    zj = max(0.0, h - arch_rise(a))
    bm = bmesh.new()
    vs = [bm.verts.new((cx - a, y, z0)), bm.verts.new((cx + a, y, z0))]
    vs += [bm.verts.new((px, y, z0 + pz)) for px, pz in pointed_pts(cx, a, zj, n)]
    face = bm.faces.new(vs)
    bm.normal_update()
    if face.normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=[face])
    lod_ = max(only) if isinstance(only, tuple) else (only if only is not None else lod)
    ms.add(bm, mat, lod_, matrix=f, only=only)


def faces4(f, w, d):
    """The four outer faces of a w x d block in frame f: (frame whose local -Y is the face, half the
    distance to it, the face's width), front first, then east, back, west."""
    out = []
    for k in range(4):
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        out.append((kf, (d if k % 2 == 0 else w) / 2, w if k % 2 == 0 else d))
    return out


def badgir(ms, f, x, y, z, s=0.1, h=0.24, mat='lvk_plaster', slots=2, lod=1):
    """A wind catcher: a square shaft over the roof with tall slot vents on all four faces, a cornice
    and a flat cap."""
    ms.box(mat, (s, s, h), at=(x, y, z), lod=lod, frame=f)
    ms.box(mat, (s + 0.024, s + 0.024, 0.02), at=(x, y, z + h), lod=0, frame=f)
    ms.box(mat, (s + 0.012, s + 0.012, 0.012), at=(x, y, z + h * 0.42), lod=0, frame=f)
    for k in range(4):
        kf = f @ Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i in range(slots):
            sx = -s / 2 + s * (i + 0.5) / slots
            ms.box('dark', (s / slots * 0.45, 0.006, h * 0.4), at=(sx, -s / 2 - 0.002, z + h * 0.52), lod=0, frame=kf)


def pishtaq(ms, f, x, y, z0, w, h, depth=0.04, mat='lvk_plaster', tile=False, niche='lvk_niche', door=True, lod=1, steps=0):
    """A portal frame (pishtaq) standing proud of a wall face at local y (facing -Y): a block w wide
    and h high, a blue tile face when `tile`, a recessed pointed niche and a pointed timber door in
    it, a cornice, and `steps` steps in front."""
    yf = y - depth
    ms.box(mat, (w, depth + 0.01, h), at=(x, y - depth / 2 + 0.005, z0), lod=lod, frame=f)
    ms.box(mat, (w + 0.02, depth + 0.02, 0.02), at=(x, y - depth / 2 + 0.005, z0 + h), lod=0, frame=f)
    a = w * 0.32
    ah = min(h * 0.78, h - 0.04)
    if tile:
        ms.box('lvk_tile', (w * 0.88, 0.004, h * 0.92), at=(x, yf - 0.001, z0 + h * 0.02), lod=0, frame=f)
        pointed(ms, f, 'lvk_trim', x, yf - 0.004, z0, a * 1.12, ah * 1.06, lod=0)
    pointed(ms, f, niche, x, yf - 0.006, z0, a, ah, lod=0)
    if door:
        pointed(ms, f, 'door', x, yf - 0.009, z0 + (0.015 * steps), a * 0.52, ah * 0.52, lod=1)
    for k in range(steps):
        ms.box('lvk_stone', (w * 0.8 - 0.03 * k, 0.035, 0.015 * (steps - k)), at=(x, yf - 0.018 - 0.03 * k, z0 - 0.002), lod=0, frame=f)


def pool(ms, f, x, y, w, d, z=G, lod=0):
    """A courtyard pool: a blue tiled rim and still water."""
    ms.box('lvk_tile', (w, d, 0.024), at=(x, y, z), lod=lod, frame=f)
    ms.box('water', (w - 0.026, d - 0.026, 0.004), at=(x, y, z + 0.022), lod=0, frame=f)


def cloth_shade(ms, f, x, y, w, d, z, tilt=8.0, lod=0):
    """A grey cloth shade on four poles (team cloth), sloping a little."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.012, 0.012, z - G + (0.02 if sy > 0 else 0.0)), at=(x + sx * (w / 2 - 0.01), y + sy * (d / 2 - 0.01), G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(tilt), 4, 'X')
    ms.box('team_cloth', (w + 0.02, d + 0.02, 0.008), at=(0, 0, 0), lod=lod, frame=pf)


def lead_roof(ms, f, x, y, w, d, z0, rise, over=0.02, mat='lvk_lead', lod=1):
    """A low hip roof (lead sheet over a timber deck): one closed solid."""
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - 0.01
    bm = bmesh.new()
    c = [bm.verts.new((sx * W, sy * D, ze)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    if W >= D:
        r = W - D
        R0, R1 = bm.verts.new((-r, 0, z0 + rise)), bm.verts.new((r, 0, z0 + rise))
        bm.faces.new((c[0], c[1], R1, R0))
        bm.faces.new((c[2], c[3], R0, R1))
        bm.faces.new((c[1], c[2], R1))
        bm.faces.new((c[3], c[0], R0))
    else:
        r = D - W
        R0, R1 = bm.verts.new((0, -r, z0 + rise)), bm.verts.new((0, r, z0 + rise))
        bm.faces.new((c[0], c[1], R0))
        bm.faces.new((c[2], c[3], R1))
        bm.faces.new((c[1], c[2], R1, R0))
        bm.faces.new((c[3], c[0], R0, R1))
    bm.faces.new(list(reversed(c)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed solid: safe to orient
    ms.add(bm, mat, lod, matrix=f @ Matrix.Translation(Vector((x, y, 0))))


def grille_window(ms, f, x, y, z, w=0.045, h=0.07, lod=0):
    """A small window with a timber grille and sill."""
    ms.box('dark', (w, 0.006, h), at=(x, y - 0.003, z), lod=lod, frame=f)
    ms.box('timber', (w + 0.012, 0.012, 0.01), at=(x, y - 0.005, z - 0.008), lod=0, frame=f)
    ms.box('timber', (0.006, 0.008, h), at=(x, y - 0.006, z), lod=0, frame=f)


def jar(ms, f, x, y, s=1.0, z=G, mat='terracotta'):
    """A water jar (a lighter version of ti_town's: 6 sides, 5 rings)."""
    p = [(0.0, 0.0), (0.024 * s, 0.004), (0.032 * s, 0.035 * s), (0.016 * s, 0.072 * s), (0.016 * s, 0.084 * s), (0.0, 0.084 * s)]
    ms.lathe(mat, [(r, zz + z) for r, zz in p], at=(x, y, 0), segs=6, lod=0, frame=f)


def clutter(ms, f, x, y, rng, n=4):
    """A heap of jars, crates and baskets around (x, y)."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.5:
            jar(ms, f, px, py, rng.uniform(0.8, 1.15))
        elif r < 0.8:
            tt.crate(ms, f, px, py, rng.uniform(0.8, 1.1), rng.uniform(-20, 20))
        else:
            tt.basket(ms, f, px, py, rng.uniform(0.8, 1.1))


def palm(ms, rng, x, y, h=0.45, fronds=7):
    tk.palm(ms, rng, x, y, h=h, fronds=fronds, lod2=False)


# ---- the houses ---------------------------------------------------------------------------------

FOOT = []


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        p = f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))
        pts.append((p.x, p.y))
    FOOT.append((tag, pts))


def poor_house(ms, rng, x, y, w, d, yaw=None, **_):
    """The poor house (sheet: 5 x 7 m): one storey of mud brick under a worn mud wash, a flat mud
    roof with a low parapet, a reed mat and a hatch on it, a plank door under a reed lean-to, a
    small window; a walled yard at the side with a palm-frond shade, a grey cloth, jars and (on
    wider plots) a palm."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * 0.82
    yard = w >= 0.5
    bw = w * 0.6 if yard else w
    bx = -(w - bw) / 2
    top = tk.flat_block(ms, f, 'lvk_mud', bx, 0, bw, d, h, roof_items=(('mat', -bw * 0.1, d * 0.12),), rng=rng, lod2=False,
                        roof_mat='lvk_mudroof')
    ms.box('lvk_mud', (0.06, 0.06, 0.03), at=(bx + bw * 0.25, -d * 0.2, top), lod=0, frame=f)  # the roof hatch
    dx = bx - bw * 0.18
    ms.box('door', (0.075, 0.012, 0.16), at=(dx, -d / 2 - 0.004, G), lod=1, frame=f)
    pf = f @ Matrix.Translation(Vector((dx, -d / 2 - 0.05, G + 0.21))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('reed', (0.14, 0.11, 0.01), at=(0, 0, 0), lod=0, frame=pf)
    grille_window(ms, f, bx + bw * 0.22, -d / 2, G + 0.17, w=0.04, h=0.05)
    jar(ms, f, dx + 0.09, -d / 2 - 0.04, 0.9)
    if yard:
        yw = w - bw
        yx = w / 2 - yw / 2
        wh = 0.17
        for (px, py, pw, pd) in ((yx, -d / 2 + 0.015, yw, 0.03), (yx, d / 2 - 0.015, yw, 0.03), (w / 2 - 0.015, 0, 0.03, d - 0.06)):
            ms.box('lvk_mud', (pw, pd, wh), at=(px, py, G), lod=1, frame=f)
        ms.box('door', (0.07, 0.012, 0.12), at=(yx, -d / 2 - 0.002, G), lod=0, frame=f)
        tt.pergola(ms, f, yx, d * 0.22, G, yw - 0.04, d * 0.36, mat='reed', lod=0, post_h=0.2)
        if rng.random() < 0.5:
            cloth_shade(ms, f, yx, -d * 0.12, yw * 0.7, d * 0.2, G + 0.2, lod=0)
        else:
            p = f @ Vector((yx, -d * 0.12, 0))
            if rng.random() < 0.6:
                palm(ms, rng, p.x, p.y, h=rng.uniform(0.32, 0.4), fronds=6)
        for k in range(2):
            jar(ms, f, yx - yw / 2 + 0.05 + 0.05 * k, -d / 2 + 0.06, 0.85)
    tk.lod2_block(ms, f, w, d, h + 0.03, mat='lvk_mud')
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning_w=None, **_):
    """The common house (sheet: 8 x 12 m): cream plaster on a grey stone plinth, a one-storey range
    round a court with a two-storey room at the back carrying a wind catcher, a pointed-arch portal
    in the front wall, a court with a small tiled pool or a tree, a grey cloth shade and a reed
    pergola on the roof, grilled windows, jars; on narrow plots a closed block with a roof terrace."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY
    side = rng.choice((-1, 1))
    ms.box('lvk_stone', (w + 0.012, d + 0.012, 0.035), at=(0, 0, G), lod=0, frame=f)
    if min(w, d) >= 0.5:
        bd = d * 0.42
        by = d / 2 - bd / 2
        top = tk.flat_block(ms, f, 'lvk_plaster', 0, by, w, bd, h, lod2=False, roof_mat='lvk_roof',
                            roof_items=(('mat', -side * w * 0.25, 0.0),), rng=rng)
        uw = w * 0.46
        ux = side * (w - uw) / 2
        uh = STOREY * 0.8
        tk.flat_block(ms, f, 'lvk_plaster', ux, by + 0.01, uw, bd - 0.02, uh, z0=top, lod2=False, roof_mat='lvk_roof')
        badgir(ms, f, ux + side * (uw / 2 - 0.065), by + bd / 2 - 0.065, top + uh, s=0.1, h=0.22)
        grille_window(ms, f, ux, by - bd / 2 + 0.01, top + 0.1)
        ww = w * 0.3
        wx = -side * (w - ww) / 2
        wd = d - bd
        wy = -d / 2 + wd / 2
        tk.flat_block(ms, f, 'lvk_plaster', wx, wy, ww, wd, h * 0.85, lod2=False, roof_mat='lvk_roof')
        cw = w - ww
        cx = side * ww / 2
        ms.box('lvk_plaster', (cw, 0.035, h * 0.62), at=(cx, -d / 2 + 0.0175, G), lod=1, frame=f)
        ms.box('lvk_plaster', (0.035, wd - 0.035, h * 0.62), at=(side * (w / 2 - 0.0175), wy + 0.0175, G), lod=1, frame=f)
        pishtaq(ms, f, cx, -d / 2, G, 0.2, h * 0.92, depth=0.03, steps=2)
        cd = wd - 0.035
        ccx, ccy = cx - side * 0.0175, -d / 2 + 0.035 + cd / 2
        ms.box('lvk_sand_square', (cw - 0.035, cd, 0.006), at=(ccx, ccy, G), lod=0, frame=f)
        if cw > 0.4 and rng.random() < 0.6:
            pool(ms, f, ccx, ccy, 0.1, 0.1)
            for sx in (-1, 1):
                tc.shrub(ms, *(f @ Vector((ccx + sx * cw * 0.3, ccy + cd * 0.25, 0))).xy, r=0.04, lod=0)
        else:
            p = f @ Vector((ccx, ccy, 0))
            tk.tree(ms, p.x, p.y, h=0.3, r=0.08, lod2=False)
        cloth_shade(ms, f, ccx + side * cw * 0.18, ccy - cd * 0.1, cw * 0.4, cd * 0.4, G + h * 0.62, tilt=-6)
        pointed(ms, f, 'dark', ccx, by - bd / 2 - 0.003, G, 0.035, 0.12)
        for wxx in (-w * 0.32, w * 0.32):
            if abs(wxx - cx) > 0.14:
                grille_window(ms, f, wxx, -d / 2, G + 0.16)
        ph = h + uh
    else:
        top = tk.flat_block(ms, f, 'lvk_plaster', 0, 0, w, d, h, lod2=False, roof_mat='lvk_roof')
        uw, ud = w * 0.55, d * 0.5
        ux, uy = side * (w - uw) / 2, d / 2 - ud / 2
        uh = STOREY * 0.8
        tk.flat_block(ms, f, 'lvk_plaster', ux, uy, uw, ud, uh, z0=top, lod2=False, roof_mat='lvk_roof')
        badgir(ms, f, ux + side * (uw / 2 - 0.065), uy + ud / 2 - 0.065, top + uh, s=0.1, h=0.2)
        tt.pergola(ms, f, -side * w * 0.2, -d * 0.18, top, w * 0.4, d * 0.4, mat='reed', lod=0, post_h=0.14)
        pishtaq(ms, f, -side * w * 0.12, -d / 2, G, 0.18, h * 0.8, depth=0.025, steps=1)
        grille_window(ms, f, side * w * 0.25, -d / 2, G + 0.16)
        ph = h
    if awning_w:
        tt.front_shade(ms, f, -side * w * 0.3, -d / 2, min(awning_w, w * 0.35), depth=0.14, z=0.24, mat='team_cloth')
    for k in range(2):
        jar(ms, f, side * (w * 0.4 - 0.05 * k), -d / 2 - 0.04, rng.uniform(0.8, 1.05))
    tk.lod2_block(ms, f, w, d, ph * 0.75 + 0.03, mat='lvk_plaster')
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, **_):
    """The rich house (sheet: 14 x 18 m): two storeys of cream plaster on a stone terrace, a
    blue-tiled portal (pishtaq) rising over the front with a carved door up steps, carved timber
    balconies (mashrabiya) either side, pointed windows, two wind catchers at the back corners, a
    court with a long pool, palms and shrubs, an arcade on its back, a vine pergola and a grey
    cloth on the roof, cypresses by the front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h0, h1 = STOREY, STOREY * 0.88
    H = h0 + h1
    ms.box('lvk_stone', (w + 0.02, d + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    z = G + 0.05
    fd, bd = d * 0.3, d * 0.3
    sw = w * 0.24
    cd = d - fd - bd
    tk.flat_block(ms, f, 'lvk_plaster', 0, -d / 2 + fd / 2, w, fd, H, z0=z, lod2=False, roof_mat='lvk_roof')
    top = tk.flat_block(ms, f, 'lvk_plaster', 0, d / 2 - bd / 2, w, bd, H, z0=z, lod2=False, roof_mat='lvk_roof')
    for sx in (-1, 1):
        tk.flat_block(ms, f, 'lvk_plaster', sx * (w / 2 - sw / 2), -d / 2 + fd + cd / 2, sw, cd + 0.01, h0, z0=z, lod2=False,
                      roof_mat='lvk_roof')
    # the tiled portal over the middle of the front
    pw = min(0.36, max(0.24, w * 0.32))
    pishtaq(ms, f, 0, -d / 2, z, pw, H + 0.08, depth=0.045, tile=True, steps=3)
    for sx in (-1, 1):
        tk.screen_box(ms, f, sx * w * 0.32, -d / 2, z + h0 + 0.05, min(0.17, w * 0.18), h=0.14, depth=0.045)
        ms.box('lvk_tile', (min(0.17, w * 0.18), 0.004, 0.025), at=(sx * w * 0.32, -d / 2 - 0.003, z + H - 0.06), lod=0, frame=f)
        pointed(ms, f, 'dark', sx * w * 0.32, -d / 2 - 0.003, z + 0.05, 0.035, 0.15)
        for kf, half, span in faces4(f, w, d)[1:4:2]:
            for i in (-1, 1):
                pointed(ms, kf, 'dark', i * span * 0.25, -half - 0.003, z + h0 + 0.06, 0.03, 0.11)
    # the court
    ms.box('lvk_sand_square', (w - 2 * sw, cd, 0.006), at=(0, -d / 2 + fd + cd / 2, z), lod=0, frame=f)
    pool(ms, f, 0, -d / 2 + fd + cd / 2, 0.09, cd * 0.62, z=z)
    for sx in (-1, 1):
        p = f @ Vector((sx * (w / 2 - sw - 0.07), -d / 2 + fd + cd * 0.5, 0))
        if w - 2 * sw > 0.38:
            palm(ms, rng, p.x, p.y, h=rng.uniform(0.42, 0.5), fronds=7)
        else:
            tc.shrub(ms, p.x, p.y, r=0.045, lod=0)
    for i in range(3):
        pointed(ms, f, 'dark', -w * 0.25 + w * 0.25 * i, d / 2 - bd - 0.003, z, 0.045, 0.17)
    # the roof: two wind catchers at the back corners, a vine pergola and a cloth
    for sx in (-1, 1):
        badgir(ms, f, sx * (w / 2 - 0.08), d / 2 - 0.08, top, s=0.12, h=0.28)
    tt.pergola(ms, f, -w * 0.12, d / 2 - bd / 2, top, w * 0.3, bd * 0.6, mat='kg_garden', lod=0, post_h=0.14)
    cloth_shade(ms, f, w * 0.16, d / 2 - bd / 2, w * 0.2, bd * 0.5, top + 0.14, tilt=0)
    for sx in (-1, 1):
        p = f @ Vector((sx * (w / 2 - 0.05), -d / 2 - 0.05, 0))
        tc.cypress(ms, p.x, p.y, h=0.42, r=0.045, lod=1)
    tk.lod2_block(ms, f, w, d, H + 0.08, mat='lvk_plaster')
    return f


def house(ms, rng, kind, x, y, w, d, **kw):
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **kw)


# ---- landmark 1: the great mosque with the spiral minaret ---------------------------------------

def spiral_minaret(ms, f, x, y, r0, r1, top, turns=4.5):
    """The spiral minaret (Samarra): a tapering brick core wound round by a ramp with a parapet band,
    on a round plinth, an arcaded lantern at the top."""
    z0 = G
    lant_h = max(0.1, top * 0.07)
    zc = top - lant_h - 0.03
    ms.cyl('lvk_brick', r0 * 1.16, r0 * 1.12, 0.07, at=(x, y, z0 - 0.004), segs=16, lod=1, frame=f)
    ms.cyl('lvk_brick', r0, r1, zc - z0, at=(x, y, z0), segs=16, lod=0, frame=f)
    ms.cyl('lvk_brick', r0, r1, zc - z0, at=(x, y, z0), segs=10, lod=1, only=1, frame=f)
    ms.cyl('lvk_brick', r0 * 1.12, r1 * 0.7, top - z0, at=(x, y, z0), segs=6, lod=2, only=2, frame=f, caps=False)
    zs, ze = z0 + 0.07, zc - 0.03
    pitch = (ze - zs) / turns
    hb = pitch * 0.38
    for lod, per in ((0, 18), (1, 8)):
        n = int(turns * per)
        bm = bmesh.new()
        rings = []
        for i in range(n + 1):
            t = i / n
            a = 2 * math.pi * turns * t - math.pi / 2
            zz = zs + (ze - zs) * t
            rc = r0 + (r1 - r0) * (zz - z0) / (zc - z0)
            rw = 0.022 + 0.035 * (r0 / 0.28) * (1 - 0.5 * t)
            ri, ro = rc - 0.004, rc + rw
            zb = max(z0, zz - hb)
            c, s = math.cos(a), math.sin(a)
            rings.append([bm.verts.new((ri * c, ri * s, zz)), bm.verts.new((ro * c, ro * s, zz)),
                          bm.verts.new((ro * c, ro * s, zb)), bm.verts.new((ri * c, ri * s, zb))])
        for p, q in zip(rings, rings[1:]):
            for k in range(4):
                j = (k + 1) % 4
                bm.faces.new((p[k], p[j], q[j], q[k]))
        bm.faces.new(rings[0])
        bm.faces.new(list(reversed(rings[-1])))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed tube: safe to orient
        ms.add(bm, 'lvk_brick', lod, matrix=f @ Matrix.Translation(Vector((x, y, 0))), only=lod)
    # slit windows up the core
    for k in range(4):
        a = math.radians(30 + 97 * k)
        zz = zs + (ze - zs) * (0.2 + 0.2 * k)
        rc = r0 + (r1 - r0) * (zz - z0) / (zc - z0)
        sf = f @ Matrix.Translation(Vector((x + rc * math.cos(a), y + rc * math.sin(a), 0))) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
        pointed(ms, sf, 'dark', 0, -0.004, zz + pitch * 0.12, 0.016, 0.07)
    # the lantern
    ms.cyl('lvk_brick', r1 * 1.14, r1 * 1.14, 0.03, at=(x, y, zc), segs=14, lod=1, frame=f)
    lr = r1 * 0.86
    ms.cyl('lvk_brick', lr, lr, lant_h, at=(x, y, zc + 0.03), segs=14, lod=1, frame=f)
    for k in range(6):
        a = 2 * math.pi * k / 6
        sf = f @ Matrix.Translation(Vector((x + lr * math.cos(a), y + lr * math.sin(a), 0))) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
        pointed(ms, sf, 'dark', 0, -0.004, zc + 0.04, lr * 0.32, lant_h * 0.72, n=4)
    ms.cyl('lvk_brick', lr * 1.1, lr * 1.1, 0.02, at=(x, y, top - 0.02), segs=14, lod=0, frame=f)
    ms.cyl('lvk_roof', lr * 0.7, lr * 0.7, 0.012, at=(x, y, top - 0.01), segs=10, lod=0, frame=f)


def mosque(ms, rng, x, y, s=1.0, top=2.4, yaw=None, minaret_side=-1):
    """The great mosque (sheet: 24 m across with its minaret, a buff-brick court mosque with 8 to 9 m
    walls, low dark lead roofs round a paved court with a fountain and an arcade along its north
    side, a raised portal block (pishtaq) with a pointed arch and a carved door in the middle of the
    front, blind pointed niches along the front, pointed windows and pilaster strips on the sides,
    a timber awning at the front corner, a stone plinth on a paved apron, and the spiral minaret
    standing at the north-west corner, 24 m high)."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = 1.9 * s, 1.8 * s
    zw = 0.8 * min(1.0, 0.65 + 0.35 * s)
    foot(f, W + 0.3 * s, D + 0.2 * s, 0, 0, tag='mosque')
    ms.box('lvk_sand_square', (W + 0.24 * s, D + 0.2 * s, 0.014), at=(0, -0.04 * s, G - 0.004), lod=1, frame=f)
    ms.box('lvk_stone', (W + 0.02, D + 0.02, 0.06 * s), at=(0, 0, G), lod=1, frame=f)
    fr, cd = 0.22 * D, 0.44 * D
    br = D - fr - cd
    cw = 0.56 * W
    sr = (W - cw) / 2
    cy = -D / 2 + fr + cd / 2
    zf = zw * 0.94
    ms.box('lvk_brick', (W, br, zw), at=(0, D / 2 - br / 2, G), lod=1, frame=f, bevel=0.004)
    ms.box('lvk_brick', (W, fr, zf), at=(0, -D / 2 + fr / 2, G), lod=1, frame=f, bevel=0.004)
    for sx in (-1, 1):
        ms.box('lvk_brick', (sr, cd + 0.01, zf), at=(sx * (W / 2 - sr / 2), cy, G), lod=1, frame=f)
    tk.lod2_block(ms, f, W, D, zw + 0.06 * s, mat='lvk_lead')
    # the lead roofs, a raised clerestory over the back middle
    rise = 0.055 * s
    lead_roof(ms, f, 0, D / 2 - br / 2, W, br, G + zw, rise * 1.2)
    lead_roof(ms, f, 0, -D / 2 + fr / 2, W, fr, G + zf, rise)
    for sx in (-1, 1):
        lead_roof(ms, f, sx * (W / 2 - sr / 2), cy, sr, cd + 0.02, G + zf, rise)
    ms.box('lvk_brick', (W * 0.3, br * 0.55, 0.13 * s), at=(0, D / 2 - br / 2, G + zw), lod=1, frame=f)
    lead_roof(ms, f, 0, D / 2 - br / 2, W * 0.3, br * 0.55, G + zw + 0.13 * s, rise)
    # cornice bands along the top of every face
    for k, (kf, half, span) in enumerate(faces4(f, W, D)):
        ms.box('lvk_trim', (span + 0.02, 0.014, 0.025), at=(0, -half - 0.004, G + (zw if k == 2 else zf) - 0.03), lod=0, frame=kf)
    # the court: paving, the fountain, the north arcade (portico)
    ms.box('lvk_sand_square', (cw, cd, 0.006), at=(0, cy, G), lod=0, frame=f)
    ms.box('lvk_stone', (0.14 * s, 0.14 * s, 0.03), at=(0, cy, G), lod=0, frame=f)
    ms.cyl('water', 0.045 * s, 0.045 * s, 0.006, at=(0, cy, G + 0.028), segs=10, lod=0, frame=f)
    ms.cyl('lvk_stone', 0.012, 0.01, 0.07, at=(0, cy, G + 0.03), segs=6, lod=0, frame=f)
    bays = 6
    py = cy + cd / 2
    ph = zw * 0.62
    for i in range(bays + 1):
        px = -cw / 2 + 0.02 + (cw - 0.04) * i / bays
        ms.box('lvk_brick', (0.035 * s, 0.035 * s, ph), at=(px, py - 0.12 * s, G), lod=0, frame=f)
    ms.box('lvk_brick', (cw, 0.04 * s, zw * 0.2), at=(0, py - 0.12 * s, G + ph), lod=0, frame=f)
    ms.box('lvk_lead', (cw, 0.13 * s, 0.012), at=(0, py - 0.06 * s, G + ph + zw * 0.2), lod=0, frame=f)
    for i in range(bays):
        px = -cw / 2 + (cw) * (i + 0.5) / bays
        pointed(ms, f, 'dark', px, py - 0.003, G, cw / bays * 0.32, ph * 0.9)
    # the front: the portal block, blind niches, the awning
    pw = 0.5 * s
    ph_ = zw * 1.28
    ms.box('lvk_brick', (pw, fr + 0.06 * s, ph_), at=(0, -D / 2 + fr / 2 - 0.03 * s, G), lod=1, frame=f, bevel=0.004)
    lead_roof(ms, f, 0, -D / 2 + fr / 2 - 0.03 * s, pw, fr + 0.06 * s, G + ph_, rise * 0.8)
    yf = -D / 2 - 0.06 * s
    a = pw * 0.3
    pointed(ms, f, 'lvk_trim', 0, yf - 0.003, G, a * 1.25, ph_ * 0.8, lod=0)
    pointed(ms, f, 'lvk_niche', 0, yf - 0.005, G, a, ph_ * 0.72, lod=0)
    pointed(ms, f, 'door', 0, yf - 0.008, G, a * 0.55, ph_ * 0.42, lod=1)
    for i in range(3):
        nx = -W / 2 + 0.17 * s + i * 0.21 * s
        pointed(ms, f, 'lvk_niche', nx, -D / 2 - 0.004, G + 0.07 * s, 0.065 * s, zf * 0.55, lod=0)
    for i in range(2):
        nx = pw / 2 + 0.15 * s + i * 0.21 * s
        pointed(ms, f, 'lvk_niche', nx, -D / 2 - 0.004, G + 0.07 * s, 0.065 * s, zf * 0.55, lod=0)
    ax = W / 2 - 0.2 * s
    ms.box('door', (0.08 * s, 0.01, 0.17 * s), at=(ax, -D / 2 - 0.004, G), lod=0, frame=f)
    tt.front_shade(ms, f, ax, -D / 2, 0.26 * s, depth=0.16 * s, z=0.3 * s, mat='timber')
    # the sides and the back: pilaster strips and pointed windows
    for kf, half, span in faces4(f, W, D)[1:]:
        n = max(3, round(span / (0.42 * s)))
        for i in range(n + 1):
            ms.box('lvk_brick', (0.04 * s, 0.012, zf * 0.92), at=(-span / 2 + span * i / n, -half - 0.005, G), lod=0, frame=kf)
        for i in range(n):
            pointed(ms, kf, 'dark', -span / 2 + span * (i + 0.5) / n, -half - 0.004, G + zw * 0.38, 0.03 * s, 0.13 * s)
    # the spiral minaret at the north-west corner (north-east with minaret_side 1)
    r0 = max(0.17, 0.28 * s)
    mx, my = minaret_side * (W / 2 + r0 * 0.15), D / 2 - r0 * 0.6
    spiral_minaret(ms, f, mx, my, r0, r0 * 0.52, top)
    return f


# ---- landmark 2: the caravanserai gate ----------------------------------------------------------

def muqarnas(ms, f, x, y, z, a, h, tiers=4):
    """Stalactite vaulting in the hood of a niche: tiers of small pointed cells stepping out, each
    with a shaded hollow."""
    for t in range(tiers):
        n = 7 - t
        span = a * (0.92 - 0.2 * t)
        cw = 2 * span / n
        zz = z + h * (0.04 + 0.22 * t)
        dy = 0.008 * (tiers - t)
        for i in range(n):
            cx = x - span + cw * (i + 0.5)
            ms.box('lvk_trim', (cw * 0.94, dy, h * 0.2), at=(cx, y - dy / 2, zz), lod=0, frame=f)
            pointed(ms, f, 'lvk_niche', cx, y - dy - 0.001, zz, cw * 0.36, h * 0.17, n=3)


def gate_tower(ms, f, x, y, tw, th, mat='lvk_ashlar', lod=1, slits=2):
    """A square tower with a cornice, merlons and slits."""
    ms.box(mat, (tw, tw, th), at=(x, y, G), lod=lod, frame=f, bevel=0.004)
    ms.box(mat, (tw + 0.02, tw + 0.02, 0.03), at=(x, y, G + th - 0.03), lod=0, frame=f)
    ms.box('lvk_stone', (tw - 0.03, tw - 0.03, 0.006), at=(x, y, G + th), lod=0, frame=f)
    tb.merlons(ms, f, x, y, tw + 0.02, tw + 0.02, G + th, step=0.07, size=0.04, h=0.055, mat=mat)
    for k in range(slits):
        ms.box('dark', (0.018, 0.006, 0.07), at=(x, y - tw / 2 - 0.003, G + th * (0.5 + 0.22 * k)), lod=0, frame=f)


def caravanserai_gate(ms, rng, x, y, s=1.0, top=1.6, yaw=None):
    """The caravanserai gate (sheet: 18 m wide, 10 m deep, 16 m to the merlons): a sandstone gate
    block between four square corner towers, a crenellated parapet, a great pointed arch in a
    moulded frame with muqarnas in its hood and a carved timber door below, an open pointed
    passage at the back, a flat roof, a timber lean-to shelter on the east side, steps in front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = 1.8 * s, 0.85 * s
    tw = 0.34 * s
    th = top - G - 0.055
    zw = th * 0.8
    foot(f, W + 0.4 * s, D + 0.15 * s, 0.1 * s, 0, tag='gate')
    ms.box('lvk_stone', (W + 0.06, D + 0.06, 0.04), at=(0, 0, G), lod=1, frame=f)
    ms.box('lvk_ashlar', (W - 0.04, D - 0.04, zw), at=(0, 0, G), lod=2, frame=f)
    ms.box('lvk_roof', (W - 0.06, D - 0.06, 0.006), at=(0, 0, G + zw), lod=0, frame=f)
    tb.merlons(ms, f, 0, 0, W - 0.04, D - 0.04, G + zw, step=0.08, size=0.04, h=0.055, mat='lvk_ashlar')
    for sx in (-1, 1):
        gate_tower(ms, f, sx * (W / 2 - tw / 2), -D / 2 + tw / 2 - 0.07 * s, tw, th, lod=2)
        gate_tower(ms, f, sx * (W / 2 - tw / 2), D / 2 - tw / 2, tw * 0.9, th * 0.97, lod=1, slits=0)
    # the front: the moulded frame, the niche with muqarnas, the door
    yf = -D / 2 - 0.004
    a = (W - 2 * tw) * 0.36
    ah = zw * 0.84
    ms.box('lvk_ashlar', (W - 2 * tw, 0.03, zw), at=(0, -D / 2 + 0.0, G), lod=0, frame=f)
    yf = -D / 2 - 0.016
    fw, fh = a * 2.5, min(zw - 0.05, ah * 1.12)
    for (bx, bz, bw_, bh_) in ((-fw / 2, 0, 0.03, fh), (fw / 2, 0, 0.03, fh), (0, fh - 0.03, fw + 0.03, 0.03)):
        ms.box('lvk_trim', (bw_, 0.014, bh_), at=(bx, yf + 0.004, G + bz), lod=0, frame=f)
    pointed(ms, f, 'lvk_trim', 0, yf, G, a * 1.14, ah * 1.06, lod=0)
    pointed(ms, f, 'lvk_niche', 0, yf - 0.003, G, a, ah, lod=1)
    muqarnas(ms, f, 0, yf - 0.004, G + ah * 0.42, a * 0.95, ah * 0.5)
    pointed(ms, f, 'lvk_trim', 0, yf - 0.006, G, a * 0.5, ah * 0.52, lod=0)
    pointed(ms, f, 'door', 0, yf - 0.008, G, a * 0.42, ah * 0.48, lod=1)
    ms.box('timber', (0.008, 0.004, ah * 0.46), at=(0, yf - 0.011, G), lod=0, frame=f)
    for k in range(2):
        ms.box('lvk_stone', (a * 1.6 - 0.06 * k, 0.05, 0.015 * (2 - k)), at=(0, yf - 0.05 + 0.03 * k, G), lod=0, frame=f)
    # the back: an open pointed passage
    bf = f @ Matrix.Rotation(math.pi, 4, 'Z')
    pointed(ms, bf, 'lvk_trim', 0, -D / 2 - 0.004, G, a * 0.7, ah * 0.72, lod=0)
    pointed(ms, bf, 'dark', 0, -D / 2 - 0.006, G, a * 0.55, ah * 0.62, lod=1)
    # the east lean-to shelter
    ef = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tt.front_shade(ms, ef, 0.1 * s, -W / 2, 0.36 * s, depth=0.18 * s, z=0.24, mat='reed')
    ms.box('door', (0.07, 0.01, 0.15), at=(0.1 * s, -W / 2 - 0.004, G), lod=0, frame=ef)
    jar(ms, ef, 0.25 * s, -W / 2 - 0.05, 1.0)
    return f


# ---- the shared objects: palace-small, palace, walls-medium -------------------------------------

def balustrade(ms, f, x, y, w, d, z, mat='lvk_plaster', lod=0):
    """A pierced parapet: a rail, small posts and a dark band between."""
    for (px, py, pw, pd) in ((0, -d / 2, w, 0.016), (0, d / 2, w, 0.016), (-w / 2, 0, 0.016, d), (w / 2, 0, 0.016, d)):
        ms.box('dark', (pw * 0.98, pd * 0.6, 0.04), at=(x + px, y + py, z), lod=lod, frame=f)
        ms.box(mat, (pw + 0.004, pd + 0.004, 0.014), at=(x + px, y + py, z + 0.04), lod=lod, frame=f)


def palace_small(ms, rng):
    """`palace-small` (sheet: about 18 x 18 m, 10 m walls, 12 m to the wind catcher): a two-storey
    cream-plastered house round a court with a long pool and four palms, a blue-tiled portal with a
    carved door up steps in the middle of the front, carved timber balconies either side, pointed
    windows, a pierced parapet, a tall wind catcher at the north-east corner, a grey cloth over the
    roof terrace, a team pennant, cypresses and shrubs along the front. Built at 10 x 9 m to fit
    the capital's free centre."""
    f = tm.house_frame(0, 0, 0)
    w, d = 1.0, 0.92
    h0, h1 = 0.36, 0.32
    H = h0 + h1
    ms.box('lvk_stone', (w + 0.04, d + 0.04, 0.05), at=(0, 0, G), lod=1, frame=f)
    z = G + 0.05
    fd, bd, sw = 0.3, 0.28, 0.24
    cd = d - fd - bd
    ms.box('lvk_plaster', (w, fd, H), at=(0, -d / 2 + fd / 2, z), lod=2, frame=f, bevel=0.003)
    ms.box('lvk_plaster', (w, bd, H), at=(0, d / 2 - bd / 2, z), lod=2, frame=f)
    for sx in (-1, 1):
        ms.box('lvk_plaster', (sw, cd + 0.01, H * (1.0 if sx < 0 else 0.62)), at=(sx * (w / 2 - sw / 2), 0, z), lod=1, frame=f)
    for (bx, by, bw_, bd_) in ((0, -d / 2 + fd / 2, w, fd), (0, d / 2 - bd / 2, w, bd), (-(w / 2 - sw / 2), 0, sw, cd + 0.02)):
        ms.box('lvk_roof', (bw_ - 0.03, bd_ - 0.03, 0.006), at=(bx, by, z + H), lod=0, frame=f)
    balustrade(ms, f, 0, -d / 2 + 0.012, w - 0.02, 0.02, z + H)
    ms.box('lvk_plaster', (w, 0.02, 0.054), at=(0, d / 2 - 0.01, z + H), lod=0, frame=f)
    ms.box('lvk_trim', (w + 0.02, d + 0.02, 0.02), at=(0, 0, z + h0 - 0.01), lod=0, frame=f)
    # the court
    ms.box('lvk_sand_square', (w - 2 * sw, cd, 0.006), at=(0, 0, z), lod=0, frame=f)
    pool(ms, f, 0, 0, 0.08, cd * 0.62, z=z)
    for sx in (-1, 1):
        for sy in (-1, 1):
            palm(ms, rng, sx * 0.13, sy * cd * 0.28, h=0.42, fronds=7)
    # the front: portal, balconies, windows
    pishtaq(ms, f, 0, -d / 2, z, 0.34, H + 0.12, depth=0.05, tile=True, steps=3)
    for sx in (-1, 1):
        tk.screen_box(ms, f, sx * 0.33, -d / 2, z + h0 + 0.06, 0.16, h=0.16, depth=0.05)
        for wx in (sx * 0.22, sx * 0.43):
            pointed(ms, f, 'dark', wx, -d / 2 - 0.003, z + 0.08, 0.03, 0.15)
        pointed(ms, f, 'dark', sx * 0.43, -d / 2 - 0.003, z + h0 + 0.08, 0.03, 0.15)
    for kf, half, span in faces4(f, w, d)[1:]:
        for i in range(3):
            px = -span / 2 + span * (i + 0.5) / 3
            pointed(ms, kf, 'dark', px, -half - 0.003, z + 0.08, 0.028, 0.13)
            pointed(ms, kf, 'dark', px, -half - 0.003, z + h0 + 0.08, 0.028, 0.13)
    ms.box('door', (0.08, 0.01, 0.16), at=(0.25, d / 2 + 0.004, z), lod=0, frame=f)
    # the roof: the wind catcher, the terrace cloth, the pennant
    badgir(ms, f, w / 2 - 0.1, d / 2 - 0.1, z + H, s=0.16, h=1.2 - z - H - 0.02, slots=3)
    cloth_shade(ms, f, -0.12, d / 2 - bd / 2, 0.36, 0.18, z + H + 0.16, tilt=0)
    ms.cyl('timber', 0.008, 0.006, 0.26, at=(w / 2 - 0.05, -d / 2 + 0.06, z + H), segs=5, lod=1, frame=f)
    tt.pennant(ms, f, w / 2 - 0.05, -d / 2 + 0.06, z + H + 0.26, w=0.16, h=0.09)
    for sx in (-1, 1):
        tc.cypress(ms, sx * (w / 2 + 0.05), -d / 2 + 0.03, h=0.5, r=0.05, lod=1)
        tc.cypress(ms, sx * (w / 2 + 0.05), d * 0.2, h=0.46, r=0.05, lod=0)
        for k in range(2):
            tc.shrub(ms, sx * (0.26 + 0.12 * k), -d / 2 - 0.06, r=0.045, lod=0)
    return f


def dome_on_drum(ms, f, x, y, z, r, lod=1):
    ms.cyl('lvk_plaster', r * 1.04, r * 1.04, 0.06, at=(x, y, z), segs=16, lod=lod, frame=f)
    ms.sphere('lvk_dome', r, at=(x, y, z + 0.06), scale=(1, 1, 0.95), u=16, v=8, cut_below=0.0, lod=0, frame=f)
    ms.sphere('lvk_dome', r, at=(x, y, z + 0.06), scale=(1, 1, 0.95), u=10, v=4, cut_below=0.0, lod=1, only=1, frame=f)
    ms.cyl('bronze', 0.008, 0.004, 0.08, at=(x, y, z + 0.06 + r * 0.93), segs=5, lod=0, frame=f)
    ms.sphere('bronze', 0.018, at=(x, y, z + 0.06 + r * 0.95 + 0.03), u=6, v=4, lod=0, frame=f)


def palace(ms, rng):
    """`palace` (sheet: 24 m across, 18 m to the wind catchers): two storeys round a court, a buff
    ashlar ground floor with pointed arcades and a cream-plastered upper floor with an arcaded
    loggia, a tall blue-tiled portal in the middle of the front with team banners either side, a
    pale dome on a drum behind it, two tall wind catchers at the back corners, grey cloth shades on
    the roof terraces, a court with a fountain pool and four palms, potted trees by the steps.
    Built at 13 x 12.5 m to fit the capital's free centre."""
    f = tm.house_frame(0, 0, 0)
    w, d = 1.3, 1.24
    h0, h1 = 0.4, 0.36
    H = h0 + h1
    ms.box('lvk_stone', (w + 0.05, d + 0.05, 0.05), at=(0, 0, G), lod=1, frame=f)
    z = G + 0.05
    fd, bd, sw = 0.34, 0.36, 0.3
    cd = d - fd - bd
    blocks = [(0, -d / 2 + fd / 2, w, fd), (0, d / 2 - bd / 2, w, bd)] + [(sx * (w / 2 - sw / 2), -d / 2 + fd + cd / 2, sw, cd + 0.01) for sx in (-1, 1)]
    for bx, by, bw_, bd_ in blocks:
        ms.box('lvk_ashlar', (bw_, bd_, h0), at=(bx, by, z), lod=2, frame=f)
        ms.box('lvk_plaster', (bw_, bd_, h1), at=(bx, by, z + h0), lod=2, frame=f)
        ms.box('lvk_roof', (bw_ - 0.03, bd_ - 0.03, 0.006), at=(bx, by, z + H), lod=0, frame=f)
    ms.box('lvk_trim', (w + 0.02, d + 0.02, 0.022), at=(0, 0, z + h0 - 0.011), lod=0, frame=f)
    balustrade(ms, f, 0, 0, w - 0.02, d - 0.02, z + H)
    # the front arcades (ground floor in the stone, the loggia above)
    pw = 0.42
    for sx in (-1, 1):
        x0, x1 = sx * (pw / 2 + 0.02), sx * (w / 2 - 0.03)
        lo, hi = min(x0, x1), max(x0, x1)
        n = 3
        for i in range(n):
            cx = lo + (hi - lo) * (i + 0.5) / n
            pointed(ms, f, 'dark', cx, -d / 2 - 0.003, z, 0.05, 0.26)
            pointed(ms, f, 'lvk_niche', cx, -d / 2 - 0.003, z + h0 + 0.03, 0.05, 0.25)
            pointed(ms, f, 'dark', cx, -d / 2 - 0.005, z + h0 + 0.05, 0.034, 0.18)
        for i in range(n + 1):
            ms.box('lvk_plaster', (0.02, 0.012, h1 * 0.85), at=(lo + (hi - lo) * i / n, -d / 2 - 0.006, z + h0), lod=0, frame=f)
        tk.banner_pointed(ms, f, sx * (pw / 2 + 0.06), -d / 2, z + H - 0.04, w=0.07, h=0.24)
    for kf, half, span in faces4(f, w, d)[1:]:
        n = 5
        for i in range(n):
            cx = -span / 2 + span * (i + 0.5) / n
            pointed(ms, kf, 'dark', cx, -half - 0.003, z + 0.09, 0.03, 0.17)
            pointed(ms, kf, 'dark', cx, -half - 0.003, z + h0 + 0.08, 0.035, 0.18)
    bf = f @ Matrix.Rotation(math.pi, 4, 'Z')
    pishtaq(ms, bf, 0, -d / 2, z, 0.2, h0 + 0.1, depth=0.03, tile=True)
    # the tiled portal and the dome
    pishtaq(ms, f, 0, -d / 2, z, pw, H + 0.3, depth=0.07, tile=True, steps=4)
    ms.box('lvk_plaster', (0.44, 0.36, 0.14), at=(0, -d / 2 + fd / 2 + 0.06, z + H), lod=1, frame=f)
    dome_on_drum(ms, f, 0, -d / 2 + fd / 2 + 0.06, z + H + 0.14, 0.17)
    # the court
    ms.box('lvk_sand_square', (w - 2 * sw, cd, 0.006), at=(0, -d / 2 + fd + cd / 2, z), lod=0, frame=f)
    pool(ms, f, 0, -d / 2 + fd + cd / 2, 0.2, 0.2, z=z)
    ms.cyl('lvk_stone', 0.03, 0.02, 0.07, at=(0, -d / 2 + fd + cd / 2, z + 0.02), segs=8, lod=0, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            palm(ms, rng, sx * 0.24, -d / 2 + fd + cd / 2 + sy * cd * 0.3, h=0.42, fronds=7)
    # the roof: wind catchers, cloth shades
    for sx in (-1, 1):
        badgir(ms, f, sx * (w / 2 - 0.12), d / 2 - 0.12, z + H, s=0.17, h=1.8 - z - H - 0.02, slots=3)
        cloth_shade(ms, f, sx * (w / 2 - sw / 2), -d / 2 + fd + cd / 2, 0.18, 0.26, z + H + 0.17, tilt=0)
        cloth_shade(ms, f, sx * 0.32, d / 2 - bd / 2, 0.22, 0.18, z + H + 0.17, tilt=0)
        for k in range(2):
            p = (sx * (pw / 2 + 0.1 + 0.25 * k), -d / 2 - 0.08)
            jar(ms, f, p[0], p[1], 1.3)  # a potted tree by the steps
            ms.sphere('shrub', 0.045, at=(p[0], p[1], G + 0.15), u=7, v=5, lod=0, frame=f)
    return f


def square_tower(ms, f, tw, th, band=0.1, lod=2):
    """A square sandstone wall tower: a grey stone foot course, a cornice, merlons, a flat top, slits."""
    ms.box('lvk_ashlar', (tw, tw, th), at=(0, 0, 0), lod=lod, frame=f)
    ms.box('lvk_stone', (tw + 0.008, tw + 0.008, band), at=(0, 0, 0), lod=1, frame=f)
    ms.box('lvk_ashlar', (tw + 0.03, tw + 0.03, 0.035), at=(0, 0, th - 0.035), lod=0, frame=f)
    ms.box('lvk_stone', (tw - 0.02, tw - 0.02, 0.006), at=(0, 0, th), lod=0, frame=f)
    tb.merlons(ms, f, 0, 0, tw + 0.03, tw + 0.03, th, step=0.08, size=0.045, h=0.065, mat='lvk_ashlar')
    for k in range(2):
        ms.box('dark', (0.024, 0.006, 0.08), at=(0, -tw / 2 - 0.003, th * (0.45 + 0.25 * k)), lod=0, frame=f)


def walls_medium(ms, rng):
    """`walls-medium` (sheet: about 66 m across, 6 m walls, 8 m square towers): a sandstone curtain
    wall on a grey stone foot course with merlons and a stone wall-walk, seven square towers round
    it, a gatehouse at the south of two square towers flying team pennants and hung with team
    banners round a gate with a portcullis and open timber doors, a stair up the inner face."""
    RAISE = tb.WALL_RAISE
    R_out, R_in = 3.22, 3.0
    H = 0.6 * RAISE
    gate_x = 0.24
    gtw = 0.5
    gth = 0.85 * RAISE
    tw, th = 0.48, 0.8 * RAISE
    towers = (95, 50, 12, -30, 207, 170, 128)
    Rm = (R_out + R_in) / 2
    half = math.degrees(math.asin((gate_x + gtw * 0.5) / Rm))
    a0, a1 = -90 + half, 270 - half
    for lod in (0, 1, 2):
        steps = (128, 56, 28)[lod]
        if lod < 2:
            tb.sweep(ms, 'lvk_stone', [(R_out + 0.012, 0.0), (R_out, 0.1)], a0, a1, steps, lod=lod, only=lod)
            tb.sweep(ms, 'lvk_ashlar', [(R_out, 0.1), (R_out, H)], a0, a1, steps, lod=lod, only=lod)
        else:
            tb.sweep(ms, 'lvk_ashlar', [(R_out, 0.0), (R_out, H)], a0, a1, steps, lod=lod, only=lod)
        tb.sweep(ms, 'lvk_stone', [(R_out, H), (R_in, H)], a0, a1, steps, lod=lod, only=lod)
        tb.sweep(ms, 'lvk_ashlar', [(R_in, H), (R_in, 0.0)], a0, a1, steps, lod=lod, only=lod)
        if lod < 2:
            ph = 0.035 if lod == 0 else 0.09
            tb.sweep(ms, 'lvk_ashlar', [(R_out, H), (R_out, H + ph), (R_out - 0.04, H + ph), (R_out - 0.04, H)], a0, a1, steps, lod=lod, only=lod)
            tb.sweep(ms, 'lvk_ashlar', [(R_in + 0.03, H), (R_in + 0.03, H + 0.03), (R_in, H + 0.03), (R_in, H)], a0, a1, steps, lod=lod, only=lod)
    # the footing: sandy earth bands either side
    tb.sweep(ms, 'lvk_sand_fringe', [(R_out + 0.2, 0.0), (R_out, G + 0.004)], 0, 360, 56, lod=1)
    tb.sweep(ms, 'lvk_sand', [(R_in, G * 0.6), (R_in - 0.35, G * 0.5)], 0, 360, 56, lod=1)
    tb.sweep(ms, 'lvk_sand_fringe', [(R_in - 0.35, G * 0.5), (R_in - 0.49, G * 0.3)], 0, 360, 56, lod=1)
    t_half = [(a, math.degrees(math.asin(tw * 0.62 / R_out))) for a in towers]
    tb.merlon_ring(ms, R_out - 0.02, H + 0.035, a0, a1, 0.12, t_half, size=(0.065, 0.045, 0.07), mat='lvk_ashlar')
    for i in range(14):
        a = a0 + (a1 - a0) * (i + 0.5) / 14
        if any(abs((a - c + 180) % 360 - 180) < hw * 1.4 for c, hw in t_half):
            continue
        ms.box('dark', (0.025, 0.01, 0.07), at=(0, -0.002, H * 0.6), lod=0, frame=tb.ring_frame(R_out, a))
    for a in towers:
        square_tower(ms, tb.ring_frame(Rm + 0.04, a), tw, th)
    # the gatehouse
    gy = -Rm
    for sx in (-1, 1):
        gf = tm.house_frame(sx * (gate_x + gtw / 2), gy - 0.04, 0)
        square_tower(ms, gf, gtw, gth)
        ms.cyl('timber', 0.009, 0.007, 0.3, at=(0, 0.05, gth), segs=5, lod=1, frame=gf)
        tt.pennant(ms, gf, 0, 0.05, gth + 0.3, w=0.2, h=0.11, yaw=-160 if sx > 0 else -150)
        tk.banner_pointed(ms, gf, 0, -gtw / 2, gth * 0.78, w=0.12, h=gth * 0.4)
        ms.box('dark', (0.04, 0.006, 0.07), at=(0, -gtw / 2 - 0.003, gth * 0.84), lod=0, frame=gf)
    gw = 2 * gate_x
    gd = R_out - R_in + 0.08
    gf = tm.house_frame(0, gy, 0)
    gh = H + 0.08
    ms.box('lvk_ashlar', (gw + 0.02, gd, gh), at=(0, 0, 0), lod=2, frame=gf)
    tb.merlons(ms, gf, 0, 0, gw + 0.02, gd, gh, step=0.1, size=0.045, h=0.06, mat='lvk_ashlar')
    oh = H * 0.66
    ms.box('dark', (gw * 0.82, 0.006, oh), at=(0, -gd / 2 - 0.003, 0), lod=1, frame=gf)
    ms.box('lvk_trim', (gw * 0.9, 0.014, 0.03), at=(0, -gd / 2 - 0.007, oh), lod=0, frame=gf)
    for i in range(7):
        px = -gw * 0.38 + gw * 0.76 * i / 6
        ms.box('kg_iron', (0.01, 0.008, oh * 0.45), at=(px, -gd / 2 - 0.008, oh * 0.55), lod=0, frame=gf)
    for zz in (0.62, 0.8, 0.96):
        ms.box('kg_iron', (gw * 0.8, 0.008, 0.01), at=(0, -gd / 2 - 0.008, oh * zz), lod=0, frame=gf)
    for sx in (-1, 1):  # the doors, swung open outward
        df = gf @ Matrix.Translation(Vector((sx * gw * 0.41, -gd / 2 - 0.01, 0))) @ Matrix.Rotation(math.radians(sx * 70), 4, 'Z')
        ms.box('door', (gw * 0.41, 0.022, oh * 0.95), at=(-sx * gw * 0.205, 0, 0), lod=1, frame=df)
    ms.box('dark', (gw * 0.82, 0.006, oh), at=(0, gd / 2 + 0.003, 0), lod=1, frame=gf)
    # a stair up the inner face by the west tower
    k = 9
    da = math.degrees(0.075 / R_in)
    for i in range(k):
        a = 160 + i * da
        ms.box('lvk_ashlar', (0.078, 0.11, H * (i + 1) / k), at=(0, 0.055, 0.0), lod=0, frame=tb.ring_frame(R_in, a))


# ---- building a town on a base Kingdoms layout ----------------------------------------------------
# The town scripts take the base town's calls as recorded in build_town_kingdoms_europe_<size>_<v>.py
# (positions, sizes, yaws as build_town_kingdoms_<size>_<v>.py drew them); `replay` swaps each for
# this kit's piece.

SIZES = {'small': dict(mosque=(0.5, 1.6), gate=(0.62, 1.25)), 'medium': dict(mosque=(0.68, 2.0), gate=(0.8, 1.45)),
         'big': dict(mosque=(0.85, 2.4), gate=(0.95, 1.6))}
HOUSES = ('tudor_house', 'town_house', 'court_house', 'flat_house', 'house')
VEG = ('tree', 'palm', 'broadleaf', 'conifer', 'cypress', 'shrub', 'clutter', 'woodpile', 'garden', 'market_stall', 'jar', 'well',
       'fountain', 'wattle_fence', 'stone_wall', 'pergola')
REC = []  # (call index, name, first part, last part) of the last replay, for the layout check


def house_kind(name, w, d, kw):
    area = w * d
    if name == 'court_house' or area >= 0.6:
        return 'rich'
    if area < 0.3 or (name in ('tudor_house',) and kw.get('roof') == 'thatch'):
        return 'poor'
    return 'common'


def _rect(cx, cy, hx, hy, yaw):
    c, s = abs(math.cos(math.radians(yaw))), abs(math.sin(math.radians(yaw)))
    ex, ey = hx * c + hy * s, hx * s + hy * c
    return (cx - ex, cy - ey, cx + ex, cy + ey)


def landmark_rect(kind, x, y, s, yaw):
    if kind == 'mosque':
        W, D = 1.9 * s, 1.8 * s
        r0 = max(0.17, 0.28 * s)
        return _rect(x - r0 * 0.6, y + 0.05 * s, W / 2 + r0 * 0.6 + 0.05, D / 2 + 0.12 * s, yaw)
    W, D = 1.8 * s, 0.85 * s
    return _rect(x + 0.1 * s, y, W / 2 + 0.2 * s, D / 2 + 0.08 * s, yaw)


def _inside(px, py, r, m=0.04):
    return r[0] - m < px < r[2] + m and r[1] - m < py < r[3] + m


def _overlap(a, b):
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def replay(ms, rng, calls, size, override=None):
    """Build the base layout's calls with this kit. `override` maps a call's index to 'mosque',
    'gate', 'skip', a house kind, or (kind, dict) with x, y, s, top, yaw, minaret_side to move or
    size a landmark. Base pieces that a (bigger) landmark covers are left out."""
    override = override or {}
    del REC[:]
    lms = []
    for i, ov in override.items():
        kind, opt = (ov, {}) if isinstance(ov, str) else ov
        if kind not in ('mosque', 'gate'):
            continue
        name, args, kw = calls[i]
        s, top = SIZES[size][kind]
        o = dict(x=args[0], y=args[1], s=s, top=top, yaw=0 if kind == 'gate' else kw.get('yaw', 0))
        if kind == 'mosque':
            o['yaw'] = 0
        o.update(opt)
        lms.append((i, kind, o, landmark_rect(kind, o['x'], o['y'], o['s'], o['yaw'])))
    covered = [r for _i, _k, _o, r in lms]
    world = tm.house_frame(0, 0, 0)
    tree_n = 0
    for i, (name, args, kw) in enumerate(calls):
        start = len(ms.parts)
        ov = override.get(i)
        kind = ov if isinstance(ov, str) or ov is None else ov[0]
        if kind == 'skip':
            continue
        if kind in ('mosque', 'gate'):
            o = next(o for j, _k, o, _r in lms if j == i)
            if kind == 'mosque':
                mosque(ms, rng, o['x'], o['y'], s=o['s'], top=o['top'], yaw=o['yaw'], minaret_side=o.get('minaret_side', -1))
            else:
                caravanserai_gate(ms, rng, o['x'], o['y'], s=o['s'], top=o['top'], yaw=o['yaw'])
            REC.append((i, kind, start, len(ms.parts)))
            continue
        if name in VEG and len(args) >= 2 and isinstance(args[0], (int, float)) and any(_inside(args[0], args[1], r) for r in covered):
            continue
        if name in HOUSES and kind in (None, 'poor', 'common', 'rich'):
            x, y, w, d = args[:4]
            hr = _rect(x, y, w / 2, d / 2, kw.get('yaw', 0) or 0)
            if any(_overlap(hr, r) > 0.02 for r in covered):
                continue
            k = kind or house_kind(name, w, d, kw)
            house(ms, rng, k, x, y, w, d, yaw=kw.get('yaw'), awning_w=kw.get('awning_w') if k == 'common' else None)
        elif name in ('church', 'cathedral', 'mosque', 'caravanserai', 'keep_tower'):
            pass  # a landmark spot that the town script gives no override: left free
        elif name == 'arcade_hall':
            x, y, w, d = args[:4]
            tk.arcade_hall(ms, rng, x, y, w * 0.85, d * 0.7, yaw=kw.get('yaw'), mat='lvk_plaster')
        elif name == 'round_tower':
            gate_tower(ms, world, args[0], args[1], args[2] * 1.5, args[3] * 1.15, lod=2)
        elif name == 'stone_tower':
            gate_tower(ms, world, args[0], args[1], 0.5, 1.3, lod=2)
        elif name == 'market_stall':
            tk.market_stall(ms, rng, *args, **kw)
        elif name in ('street', 'paved_strip'):
            if name == 'street':
                tk.street(ms, args[0], args[1], mat='lvk_sand_square')
            else:
                x0, y0, x1, y1, w = args
                tk.street(ms, [(x0, y0), (x1, y1)], w, mat='lvk_sand_square')
        elif name == 'garden':
            tk.garden(ms, rng, *args, **kw)
        elif name == 'wattle_fence':
            for (x0, y0), (x1, y1) in zip(args[0], args[0][1:]):
                tk.stone_wall(ms, x0, y0, x1, y1, h=0.12, t=0.035, mat='lvk_mud')
        elif name == 'stone_wall':
            kw = dict(kw)
            kw['mat'] = 'lvk_mud'
            tk.stone_wall(ms, *args, **kw)
        elif name in ('tree', 'broadleaf', 'palm'):
            tree_n += 1
            if name == 'palm' or tree_n % 3 != 0:
                palm(ms, rng, args[0], args[1], h=kw.get('h', 0.45) * (1.0 if name == 'palm' else 1.05), fronds=7)
            else:
                tk.tree(ms, args[0], args[1], h=kw.get('h', 0.4) * 0.9, r=kw.get('r', 0.13) * 0.9, lod2=False)
        elif name in ('conifer', 'cypress'):
            tc.cypress(ms, args[0], args[1], h=kw.get('h', 0.45), r=0.055, lod=1)
        elif name == 'shrub':
            tc.shrub(ms, *args, **kw)
        elif name == 'well':
            tt.well(ms, args[0], args[1], yaw=kw.get('yaw', 10))
        elif name == 'fountain':
            pool(ms, world, args[0], args[1], 0.2, 0.2, lod=1)
            ms.cyl('lvk_stone', 0.025, 0.018, 0.08, at=(args[0], args[1], G + 0.02), segs=8, lod=0)
        elif name == 'clutter':
            clutter(ms, world, args[0], args[1], rng, int(args[2]) if len(args) > 2 else 4)
        elif name == 'woodpile':
            for k in range(3):
                jar(ms, world, args[0] - 0.06 + 0.06 * k, args[1], 1.1)
        elif name == 'jar':
            jar(ms, world, args[0], args[1], 1.0)
        # anything else (the pergola in the free centre) is left out
        REC.append((i, name, start, len(ms.parts)))


def main(file_name, obj_name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(SANDY)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
