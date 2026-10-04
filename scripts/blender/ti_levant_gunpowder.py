# scripts/blender/ti_levant_gunpowder.py
# The Gunpowder Age Levant kit (Levant, Mesopotamia, Arabia, Persia; plans/art-image-spec.md
# section 3b; sheets in plans/art/kits/levant/gunpowder/): a town is layout x kit, so these towns
# stand on the base Gunpowder layouts (build_town_gunpowder_<size>_<v>.py) with the kit's
# buildings on their spots:
# - houses (houses.png, street.png, roofscape.png): the poor one-storey lime-plaster house on a
#   rubble plinth with a flat roof, parapet, plank porch, ladder and roof clutter; the common
#   two-storey courtyard house (plaster over an ashlar plinth, a terracotta hip roof round an open
#   court with a tree, a timber kiosk with lattice screens over the door); the rich courtyard
#   mansion (an ashlar ground floor, a blue-tiled pointed portal, two timber kiosks, a turquoise
#   dome on the back wing, a fountain in the court), half of them flat-roofed under grey lead domes
#   as in the street sheet's top row;
# - landmark-1, the tiled mosque: arcaded ranges round a court with a fountain, a tiled iwan
#   portal at the front between two turquoise minarets with balconies, a prayer hall at the back
#   under a turquoise dome on a tiled drum;
# - landmark-2, the covered souk: a cross of buff-brick barrel-vaulted arms under grey tile, cut
#   stone arched gates at the four ends, an octagonal lantern over the crossing, shops with canvas
#   awnings in the corners.
# The base layouts' European pieces become Levant ones: the town halls the souk, the churches the
# mosque, the windmills a bathhouse (hammam) with lead domes and a windcatcher, the wells
# fountains, the iron lamps lanterns on posts, barrels jars, rail fences low stone walls, a share of
# the trees cypresses. Stalls, gardens, bastions and the cobbled ground stay as they are.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_gunpowder as gp  # noqa: E402
from ti_town import G  # noqa: E402
from ti_gunpowder import _t, _rz  # noqa: E402

NEW = ['lvg_plaster', 'lvg_ashlar', 'lvg_tileblue', 'lvg_turq', 'lvg_lattice', 'lvg_brick', 'lvg_vault',
       'lvg_cutstone', 'lvg_canvas', 'lvg_paving', 'lvg_rooftile']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    tm.mat_simple('lvg_plaster', ['#e0d2b6', '#ebe1cb', '#d4c4a3', '#efe7d6'], scale=14.0, bump=0.3, dirt=True)
    tm.mat_mudwall('lvg_ashlar', wash='#cdb48e', brick='#ccb18a', brick2='#b89c76', mortar='#8c775b', wash_cover=0.0,
                   bond=(0.06, 0.025, 0.003))
    tm.mat_mudwall('lvg_tileblue', wash='#2a6fb0', brick='#1f5aa6', brick2='#2aa3b0', mortar='#e6dec8', wash_cover=0.0,
                   bond=(0.014, 0.014, 0.002))
    tm.mat_mudwall('lvg_turq', wash='#34aab0', brick='#2fa6ad', brick2='#45bcb8', mortar='#1f5590', wash_cover=0.0,
                   bond=(0.018, 0.008, 0.0012))
    tm.mat_mudwall('lvg_lattice', wash='#5a3e28', brick='#24180f', brick2='#2c1e13', mortar='#74503a', wash_cover=0.0,
                   bond=(0.011, 0.011, 0.0035))
    tm.mat_mudwall('lvg_brick', wash='#c89f68', brick='#c69c62', brick2='#b48a54', mortar='#9b8566', wash_cover=0.0,
                   bond=(0.026, 0.009, 0.0015))
    tm.mat_mudwall('lvg_vault', wash='#736d64', brick='#78716a', brick2='#665f57', mortar='#433f3a', wash_cover=0.0,
                   bond=(0.022, 0.012, 0.002))
    tm.mat_mudwall('lvg_cutstone', wash='#cfc3a9', brick='#d0c4aa', brick2='#bdb197', mortar='#8b8170', wash_cover=0.0,
                   bond=(0.08, 0.04, 0.003))
    tm.mat_mudwall('lvg_rooftile', wash='#bd5a35', brick='#c8653d', brick2='#ad4f2e', mortar='#6e2e19', wash_cover=0.0,
                   bond=(0.03, 0.012, 0.002))
    tm.mat_simple('lvg_canvas', ['#d6cdb9', '#e2dac8', '#c6bca6'], scale=20.0, bump=0.3,
                  stripes={'dir': 'Y', 'scale': 40.0, 'distortion': 2.0})
    tc.mat_paving('lvg_paving', stone=('#cfc4ae', '#c1b59d', '#dbd1bc'), mortar='#8f8572', slab=(0.05, 0.05))


if not any(n == 'levant-gunpowder' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('levant-gunpowder', make_materials))

KIT = {'max_storeys': 3, 'replace': {}, 'used': set()}
ORIG_TREE = gp.tree
HOUSE_H = {1: 0.34, 2: 0.52, 3: 0.72}


# ---- small helpers ------------------------------------------------------------------------------

def pointed_outline(w, spring, rise, n=5):
    """A pointed (two-centred) arch outline [(x, z)...]: rise <= w / 2."""
    rise = min(rise, w / 2 - 1e-4)
    R = (w * w / 4 + rise * rise) / w
    cx = w / 2 - R
    a1 = math.atan2(rise, -cx)
    pts = [(-w / 2, 0.0), (w / 2, 0.0)]
    for i in range(n + 1):
        a = a1 * i / n
        pts.append((cx + R * math.cos(a), spring + R * math.sin(a)))
    for i in range(n - 1, -1, -1):
        a = a1 * i / n
        pts.append((-(cx + R * math.cos(a)), spring + R * math.sin(a)))
    return pts


def arch(ms, mat, F, x, z, w, spring, rise, y=-0.004, depth=0.006, lod=1, n=5, pointed=True):
    """An arch-headed panel (an opening, a niche) on a face frame F at local y, facing -Y."""
    pts = pointed_outline(w, spring, rise, n) if pointed else gp.arch_outline(w, spring, rise, n * 2)
    gp.slab(ms, mat, [(px + x, pz + z) for px, pz in pts], depth, f=F @ _t(0, y, 0), lod=lod)


def lattice_window(ms, F, x, z, ww=0.05, wh=0.08, lod=1, surround='lvg_ashlar'):
    """A window closed by a carved lattice screen in a stone surround."""
    if surround:
        gp.quad(ms, surround, F, x, -0.003, z - 0.012, ww + 0.022, wh + 0.024, lod=0)
    gp.quad(ms, 'lvg_lattice', F, x, -0.005, z, ww, wh, lod=lod)


def oriel(ms, F, x, z, w, h, depth=0.07, lod=1, roof='lvg_rooftile'):
    """A timber kiosk (a projecting balcony closed by lattice screens) on a face frame F: a box on
    two brackets, lattice front and sides, a small tile cap."""
    ms.box('timber', (w, depth, h), at=(x, -depth / 2, z), lod=lod, frame=F)
    gp.quad(ms, 'lvg_lattice', F, x, -depth - 0.002, z + h * 0.16, w * 0.86, h * 0.64, lod=lod)
    for sx in (-1, 1):
        SF = F @ _t(x + sx * (w / 2 + 0.002), -depth / 2, 0) @ _rz(sx * 90)
        gp.quad(ms, 'lvg_lattice', SF, 0, 0, z + h * 0.16, depth * 0.7, h * 0.64, lod=0)
        gp.beam(ms, 'timber', F, (x + sx * w * 0.36, -0.002, z - 0.07), (x + sx * w * 0.36, -depth + 0.01, z - 0.004),
                t=0.014, lod=0)
    ms.box('timber', (w + 0.02, depth + 0.02, 0.014), at=(x, -depth / 2, z - 0.012), lod=0, frame=F)
    ms.box(roof, (w + 0.03, depth + 0.035, 0.022), at=(x, -depth / 2 - 0.005, z + h), lod=lod, frame=F)


def tiled_portal(ms, F, x, w, h, depth=0.05, lod=2, door_w=None):
    """A pishtaq: a projecting ashlar frame with a blue-tiled face, a pointed niche of cream stone
    holding the door, turquoise edging and a cornice; its front at local y -depth of face F."""
    ms.box('lvg_ashlar', (w, depth + 0.01, h), at=(x, -depth / 2 + 0.005, G), lod=lod, frame=F)
    P = F @ _t(x, -depth, 0)
    gp.quad(ms, 'lvg_tileblue', P, 0, -0.002, G + 0.03, w * 0.86, h - 0.06, lod=1)
    nw = w * 0.56
    arch(ms, 'lvg_cutstone', P, 0, G + 0.03, nw, h * 0.42, nw * 0.42, y=-0.006, lod=1)
    dw = door_w or min(0.09, nw * 0.5)
    arch(ms, 'door', P, 0, G + 0.03, dw, min(0.17, h * 0.3), dw * 0.4, y=-0.009, lod=0)
    for sx in (-1, 1):
        gp.quad(ms, 'lvg_turq', P, sx * w * 0.45, -0.003, G + 0.03, w * 0.04, h - 0.06, lod=0)
    gp.quad(ms, 'lvg_turq', P, 0, -0.003, G + h - 0.05, w * 0.94, 0.025, lod=0)
    ms.box('lvg_ashlar', (w + 0.02, depth + 0.03, 0.02), at=(x, -depth / 2, G + h), lod=0, frame=F)
    for k in range(3):  # steps
        ms.box('lvg_ashlar', (nw - 0.03 * k, 0.03, 0.01 * (3 - k)), at=(x, -depth - 0.045 + 0.02 * k, G), lod=0, frame=F)


def parapet(ms, f, w, d, z, h=0.04, t=0.022, mat='lvg_plaster', lod=1, cx=0.0, cy=0.0):
    for px, py, pw, pd in ((0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t),
                           (w / 2 - t / 2, 0, t, d - 2 * t)):
        ms.box(mat, (pw, pd, h), at=(cx + px, cy + py, z), lod=lod, frame=f)


def ring_hip(ms, f, w, d, cw, cd, z0, rise, mat='lvg_rooftile', over=0.03, lod=1, only=(0, 1)):
    """A hip roof round an open court: outer eaves, a ridge over the middle of each wing, inner
    eaves round the court; one closed solid."""
    W, D = w / 2 + over, d / 2 + over
    Wi, Di = cw / 2 - over * 0.5, cd / 2 - over * 0.5
    Wr, Dr = (w / 2 + cw / 2) / 2, (d / 2 + cd / 2) / 2
    ze = z0 - over * 0.5
    zr = z0 + rise
    O = [(-W, -D, ze), (W, -D, ze), (W, D, ze), (-W, D, ze)]
    R = [(-Wr, -Dr, zr), (Wr, -Dr, zr), (Wr, Dr, zr), (-Wr, Dr, zr)]
    Ii = [(-Wi, -Di, ze), (Wi, -Di, ze), (Wi, Di, ze), (-Wi, Di, ze)]
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.append((i, j, 4 + j, 4 + i))
        faces.append((4 + i, 4 + j, 8 + j, 8 + i))
        faces.append((8 + i, 8 + j, j, i))
    gp.solid(ms, mat, O + R + Ii, faces, f=f, lod=lod, only=only)


def small_dome(ms, f, x, y, z, r, mat='gp_lead', drum='lvg_plaster', drum_h=0.03, lod=1, finial=True):
    ms.cyl(drum, r * 1.02, r * 1.02, drum_h, at=(x, y, z), segs=10, lod=lod, frame=f)
    ms.sphere(mat, r, at=(x, y, z + drum_h), scale=(1, 1, 1.05), u=10, v=5, lod=0, frame=f, cut_below=0.0)
    if lod >= 1:
        ms.sphere(mat, r, at=(x, y, z + drum_h), scale=(1, 1, 1.05), u=6, v=3, lod=lod, only=tuple(range(1, lod + 1)),
                  frame=f, cut_below=0.0)
    if finial:
        ms.cyl('bronze', 0.005, 0.003, 0.04, at=(x, y, z + drum_h + r * 1.0), segs=4, lod=0, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def poor_house(ms, rng, x, y, w, d, yaw=None, awning=None):
    """The poor house: one storey of lime plaster on a rubble plinth, a flat roof with a parapet,
    a plank porch over the door, a lattice window, a ladder to the roof and roof clutter."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = HOUSE_H[1]
    ms.box('lvg_plaster', (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.005)
    ms.box('lvg_ashlar', (w + 0.008, d + 0.008, 0.07), at=(0, 0, G), lod=0, frame=f)
    ms.box('roof', (w - 0.03, d - 0.03, 0.008), at=(0, 0, G + h), lod=1, frame=f)
    parapet(ms, f, w, d, G + h, h=0.04)
    F = gp.faces_of(f, w, d)[0][0]
    dx = rng.choice((-1, 1)) * w * 0.2
    ms.box('door', (0.075, 0.012, 0.17), at=(dx, -d / 2 - 0.002, G + 0.02), lod=1, frame=f)
    ms.box('timber', (0.11, 0.02, 0.016), at=(dx, -d / 2 - 0.004, G + 0.19), lod=0, frame=f)
    ms.box('lvg_ashlar', (0.12, 0.05, 0.02), at=(dx, -d / 2 - 0.025, G), lod=0, frame=f)
    lattice_window(ms, F, -dx * 1.1, G + 0.17, ww=0.05, wh=0.06)
    for F2, length, side in gp.faces_of(f, w, d)[1:]:
        if side != 'back':
            lattice_window(ms, F2, 0, G + 0.18, ww=0.04, wh=0.05, lod=0)
    if awning:
        tc.awning(ms, f, dx, -d / 2 - 0.006, 0.26, depth=0.15, z=0.24)
    else:
        tt.front_shade(ms, f, dx, -d / 2, 0.2, depth=0.13, z=0.25, mat='gp_plank')
    top = G + h
    r = rng.random()
    if r < 0.4 and w * d > 0.24:  # a room on the roof
        uw, ud = w * 0.45, d * 0.5
        ux, uy = rng.choice((-1, 1)) * w * 0.24, d * 0.2
        ms.box('lvg_plaster', (uw, ud, 0.2), at=(ux, uy, top), lod=1, frame=f)
        parapet(ms, f, uw, ud, top + 0.2, h=0.03, t=0.018, lod=0, cx=ux, cy=uy)
        ms.box('door', (0.06, 0.012, 0.14), at=(ux, uy - ud / 2 - 0.002, top), lod=0, frame=f)
    elif r < 0.7:
        tt.pergola(ms, f, rng.uniform(-w * 0.15, w * 0.15), d * 0.12, top, min(0.26, w * 0.5), min(0.2, d * 0.4), mat='reed',
                   lod=0, post_h=0.13)
    for k in range(rng.randint(1, 2)):
        tt.jar(ms, f, rng.uniform(-w * 0.3, w * 0.3), rng.uniform(-d * 0.25, 0.0), 0.8, z=top)
    if rng.random() < 0.6:
        side = rng.choice((-1, 1))
        tt.ladder(ms, f, side * (w / 2 + 0.06), -d * 0.1, h + 0.03, yaw=side * 90, lean=16)
    for k in range(rng.randint(0, 2)):
        jx = rng.uniform(-w / 2 + 0.04, w / 2 - 0.04)
        if abs(jx - dx) > 0.1:
            tt.jar(ms, f, jx, -d / 2 - 0.04, rng.uniform(0.85, 1.1))
    return f


def court_house(ms, rng, x, y, w, d, yaw=None, storeys=2, rich=False, flat=False, awning=None):
    """A courtyard house: four wings round an open court (a tree, a fountain for the rich), plaster
    over an ashlar plinth (the rich an ashlar ground floor), a terracotta hip roof round the court
    or a flat roof with parapets; the common house a timber kiosk over the door, the rich a tiled
    portal between two kiosks and a dome on the back wing."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = HOUSE_H[storeys]
    sh = h / storeys
    cw, cd = max(0.18, w * 0.4), max(0.16, d * 0.36)
    sw, fd = (w - cw) / 2, (d - cd) / 2
    gp.box_only(ms, 'lvg_plaster', (w, d, h), (0, 0, G), f, (2,))
    ms.box('lvg_plaster', (w, fd, h), at=(0, -d / 2 + fd / 2, G), lod=1, frame=f)
    ms.box('lvg_plaster', (w, fd, h), at=(0, d / 2 - fd / 2, G), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('lvg_plaster', (sw, cd + 0.002, h), at=(sx * (w / 2 - sw / 2), 0, G), lod=1, frame=f)
    if rich:  # an ashlar ground floor (a skin on the outer faces)
        ms.box('lvg_ashlar', (w + 0.012, 0.008, sh), at=(0, -d / 2 - 0.002, G), lod=1, frame=f)
        ms.box('lvg_ashlar', (w + 0.012, 0.008, sh), at=(0, d / 2 + 0.002, G), lod=0, frame=f)
        for sx in (-1, 1):
            ms.box('lvg_ashlar', (0.008, d, sh), at=(sx * (w / 2 + 0.002), 0, G), lod=0, frame=f)
        ms.box('lvg_ashlar', (w + 0.02, d + 0.02, 0.016), at=(0, 0, G + sh - 0.008), lod=0, frame=f)
    else:
        ms.box('lvg_ashlar', (w + 0.008, d + 0.008, 0.06), at=(0, 0, G), lod=0, frame=f)
    # the court: paving, a tree (and a fountain for the rich), a door and windows on its walls
    gp.flat(ms, 'lvg_paving', [(-cw / 2, -cd / 2), (cw / 2, -cd / 2), (cw / 2, cd / 2), (-cw / 2, cd / 2)], G + 0.004, lod=1, f=f)
    tr = min(cw, cd) * 0.3
    tx = -cw * 0.22 if rich else 0.0
    ms.cyl('timber', 0.012, 0.009, h * 0.5, at=(tx, 0, G), segs=5, lod=0, frame=f)
    ms.sphere('leaf', tr * 1.15, at=(tx, 0, G + h * 0.62), scale=(1, 1, 0.85), u=8, v=5, lod=0, frame=f)
    ms.sphere('leaf', tr * 1.1, at=(tx, 0, G + h * 0.62), scale=(1, 1, 0.85), u=5, v=3, lod=1, only=1, frame=f)
    if rich:
        ms.cyl('lvg_tileblue', 0.05, 0.05, 0.03, at=(cw * 0.2, 0, G), segs=8, lod=0, frame=f)
        ms.cyl('water', 0.04, 0.04, 0.032, at=(cw * 0.2, 0, G), segs=8, lod=0, frame=f)
    CF = f @ _t(0, cd / 2, 0)  # the court's north wall, facing south
    gp.quad(ms, 'door', CF, 0, -0.002, G, 0.06, 0.15, lod=0)
    for k in range(storeys - 1):
        lattice_window(ms, CF, 0, G + sh * (k + 1) + sh * 0.3, ww=0.05, wh=0.07, lod=0, surround=None)
    # the front
    F = gp.faces_of(f, w, d)[0][0]
    zr = G + h
    if rich:
        pw = min(0.28, w * 0.34)
        tiled_portal(ms, F, 0, pw, h + 0.06, depth=0.05, lod=1)
        for sx in (-1, 1):
            ox = sx * (pw / 2 + (w / 2 - pw / 2) / 2)
            ow = min(0.2, (w / 2 - pw / 2) * 0.7)
            for k in range(1, storeys):
                oriel(ms, F, ox, G + sh * k + 0.03, ow, sh * 0.72, depth=0.06, lod=1 if k == storeys - 1 else 0)
            lattice_window(ms, F, ox, G + sh * 0.32, ww=0.06, wh=min(0.1, sh * 0.42))
    else:
        dx = 0.0
        gp.arched_door(ms, F, dx, 0, 0.08, 0.13, 0.04, surround='lvg_ashlar')
        ms.box('lvg_ashlar', (0.14, 0.05, 0.022), at=(dx, -0.025, G), lod=0, frame=F)
        ow = min(0.28, w * 0.46)
        for k in range(1, storeys):
            oriel(ms, F, dx, G + sh * k + 0.03, ow, sh * 0.72, depth=0.07, lod=1 if k == storeys - 1 else 0)
        for sx in (-1, 1):
            wx = sx * (ow / 2 + (w / 2 - ow / 2) / 2)
            for k in range(storeys):
                lattice_window(ms, F, wx, G + sh * k + sh * 0.32, ww=0.05, wh=min(0.09, sh * 0.4), lod=1 if k == 0 else 0)
        if awning:
            tc.awning(ms, f, awning[0] + (w * 0.28 if abs(awning[0]) < 0.1 else 0), -d / 2 - 0.006, min(awning[1], w * 0.4),
                      depth=0.15, z=min(0.24, sh * 0.85))
    for F2, length, side in gp.faces_of(f, w, d)[1:]:
        n = max(1, int(round(length / 0.26)))
        for i in range(n):
            lattice_window(ms, F2, -length / 2 + length * (i + 0.5) / n, G + sh * (storeys - 1) + sh * 0.32, ww=0.045,
                           wh=0.07, lod=0)
    # the roof
    if flat:
        ms.box('roof', (w - 0.02, fd - 0.01, 0.008), at=(0, -d / 2 + fd / 2, zr), lod=0, frame=f)
        ms.box('roof', (w - 0.02, fd - 0.01, 0.008), at=(0, d / 2 - fd / 2, zr), lod=0, frame=f)
        parapet(ms, f, w, d, zr, h=0.045, lod=1)
        parapet(ms, f, cw + 0.03, cd + 0.03, zr, h=0.03, t=0.015, lod=0)
        small_dome(ms, f, w * 0.22 if rich else -w * 0.25, d / 2 - fd / 2, zr, min(0.075, fd * 0.36), mat='gp_lead')
        if rich and w > 0.6:
            small_dome(ms, f, -w / 2 + sw / 2, 0, zr, min(0.06, sw * 0.36), mat='gp_lead', lod=0)
        tt.jar(ms, f, w * 0.3, -d / 2 + fd / 2, 0.75, z=zr)
    else:
        rise = min(0.15, min(sw, fd) * 0.9)
        ring_hip(ms, f, w, d, cw, cd, zr, rise)
        gp.hip(ms, f, w, d, zr, rise * 0.8, mat='lvg_rooftile', lod=2, only=2)
        if rich:
            ms.cyl('lvg_tileblue', 0.07, 0.07, rise * 0.6 + 0.05, at=(0, d / 2 - fd / 2, zr + rise * 0.4), segs=10, lod=1, frame=f)
            ms.sphere('lvg_turq', 0.075, at=(0, d / 2 - fd / 2, zr + rise + 0.05), scale=(1, 1, 1.15), u=10, v=5, lod=0,
                      frame=f, cut_below=0.0)
            ms.sphere('lvg_turq', 0.075, at=(0, d / 2 - fd / 2, zr + rise + 0.05), scale=(1, 1, 1.15), u=6, v=3, lod=1,
                      only=1, frame=f, cut_below=0.0)
            ms.cyl('bronze', 0.006, 0.003, 0.05, at=(0, d / 2 - fd / 2, zr + rise + 0.13), segs=4, lod=0, frame=f)
        else:
            gp.chimney(ms, f, w / 2 - sw / 2, d / 2 - fd / 2, zr, rise + 0.03, w=0.045, d=0.05)
    for k in range(rng.randint(0, 2)):
        jx = rng.uniform(-w / 2 + 0.05, w / 2 - 0.05)
        if abs(jx) > 0.12:
            tt.jar(ms, f, jx, -d / 2 - 0.04, rng.uniform(0.85, 1.1))
    if rng.random() < 0.5:
        gp.flower_pot(ms, f, rng.choice((-1, 1)) * w * 0.4, -d / 2 - 0.03)
    return f


def kit_house(ms, rng, x, y, w, d, yaw=None, awning=None, typ=None, **_ignored):
    """One of the kit's houses on a layout's spot, picked by the spot's size (and the rng)."""
    key = (round(x, 3), round(y, 3))
    if key in KIT['replace']:
        spec = KIT['replace'][key]
        if spec and key not in KIT['used']:
            spec(ms, rng)
        KIT['used'].add(key)
        return None
    area = w * d
    if typ is None:
        r = rng.random()
        typ = 'poor' if area < 0.3 or r < 0.22 else ('rich' if area >= 0.45 or r > 0.82 else 'common')
    if typ == 'poor':
        return poor_house(ms, rng, x, y, w, d, yaw=yaw, awning=awning)
    if typ == 'common':
        return court_house(ms, rng, x, y, w, d, yaw=yaw, storeys=2, flat=rng.random() < 0.3, awning=awning)
    st = 3 if KIT['max_storeys'] >= 3 and rng.random() < 0.5 else 2
    return court_house(ms, rng, x, y, w, d, yaw=yaw, storeys=st, rich=True, flat=rng.random() < 0.5)


def kit_styled(ms, rng, x, y, w, d, yaw=None, palette='a', storeys=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


def kit_gp_house(ms, rng, x, y, w, d, yaw=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


# ---- landmark 1: the tiled mosque ---------------------------------------------------------------

def minaret(ms, f, x, y, top, r, rh):
    """A turquoise-tiled minaret: an ashlar base, a tapering shaft, two balconies, an upper shaft
    and a small dome with a gilt finial reaching `top`."""
    s = top - G
    ms.cyl('lvg_ashlar', r * 1.25, r * 1.2, rh * 0.7, at=(x, y, G), segs=8, lod=1, frame=f)
    z1 = G + s * 0.7
    ms.cyl('lvg_turq', r, r * 0.9, z1 - G, at=(x, y, G), segs=12, lod=1, frame=f)
    ms.cyl('lvg_turq', r, r * 0.1, s * 0.98, at=(x, y, G), segs=6, lod=2, only=2, frame=f)
    for k in (0.35, 0.55):
        ms.cyl('lvg_tileblue', r * 1.03, r * 0.95, 0.03, at=(x, y, G + s * k), segs=12, lod=0, frame=f)
    ms.cyl('lvg_ashlar', r * 0.9, r * 1.55, 0.03, at=(x, y, z1), segs=12, lod=1, frame=f)  # corbelled balcony
    ms.cyl('lvg_ashlar', r * 1.55, r * 1.55, 0.02, at=(x, y, z1 + 0.03), segs=12, lod=0, frame=f)
    ms.cyl('bronze', r * 1.5, r * 1.5, 0.025, at=(x, y, z1 + 0.05), segs=12, lod=0, frame=f, caps=False)
    z2 = G + s * 0.86
    ms.cyl('lvg_turq', r * 0.78, r * 0.74, z2 - z1, at=(x, y, z1 + 0.03), segs=10, lod=1, frame=f)
    ms.cyl('lvg_ashlar', r * 0.7, r * 1.2, 0.025, at=(x, y, z2), segs=10, lod=0, frame=f)
    ms.cyl('lvg_cutstone', r * 0.6, r * 0.6, s * 0.035, at=(x, y, z2 + 0.025), segs=8, lod=0, frame=f)
    zd = z2 + 0.025 + s * 0.035
    ms.sphere('lvg_turq', r * 0.78, at=(x, y, zd), scale=(1, 1, 1.25), u=10, v=5, lod=0, frame=f, cut_below=0.0)
    ms.cyl('lvg_turq', r * 0.78, 0.004, r * 0.95, at=(x, y, zd), segs=6, lod=1, only=1, frame=f)
    ms.cyl('bronze', 0.006, 0.003, top - (zd + r * 0.95), at=(x, y, zd + r * 0.95), segs=4, lod=0, frame=f)
    ms.sphere('bronze', 0.012, at=(x, y, top - 0.04), u=6, v=4, lod=0, frame=f)


def mosque(ms, rng, x, y, top, w=1.2, d=1.2, yaw=0, **_ignored):
    """The tiled mosque: ashlar arcaded ranges round a paved court with a fountain, a tiled iwan
    portal in the middle of the front between two turquoise minarets reaching `top`, a prayer hall
    at the back with a tiled iwan on the court and a turquoise dome on a tiled drum (dome top about
    0.8 of `top`, near the sheet's 20 m dome beside 24 m minarets)."""
    f = tm.house_frame(x, y, yaw)
    s = top - G
    k = min(w, d)
    rh = min(s * 0.22, 0.36)                 # the ranges' height
    rd = max(0.14, k * 0.17)                 # the ranges' depth
    dh = d * 0.4                             # the prayer hall's depth
    yN = d / 2 - dh / 2
    side_len = d - rd - dh
    yc = -d / 2 + rd + side_len / 2
    ms.box('lvg_ashlar', (w + 0.03, d + 0.03, 0.025), at=(0, 0, G), lod=1, frame=f)
    gp.box_only(ms, 'lvg_ashlar', (w, d, rh), (0, 0, G), f, (2,))
    ms.box('lvg_ashlar', (w, rd, rh), at=(0, -d / 2 + rd / 2, G), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('lvg_ashlar', (rd, side_len + 0.002, rh), at=(sx * (w / 2 - rd / 2), yc, G), lod=1, frame=f)
    hh = rh * 1.2
    ms.box('lvg_ashlar', (w, dh, hh), at=(0, yN, G), lod=1, frame=f)
    # roofs: lead flats inside low parapets
    for (bx, by, bw, bd, bz) in ((0, -d / 2 + rd / 2, w, rd, rh), (-(w / 2 - rd / 2), yc, rd, side_len, rh),
                                 (w / 2 - rd / 2, yc, rd, side_len, rh), (0, yN, w, dh, hh)):
        ms.box('gp_lead', (bw - 0.03, bd - 0.03, 0.006), at=(bx, by, G + bz), lod=0, frame=f)
        ms.box('lvg_tileblue', (bw + 0.004, bd + 0.004, 0.03), at=(bx, by, G + bz - 0.05), lod=0, frame=f)
    parapet(ms, f, w, d, G + rh, h=0.025, t=0.02, mat='lvg_ashlar', lod=0)
    # the court
    cwid = w - 2 * rd
    gp.flat(ms, 'lvg_paving', [(-cwid / 2, -d / 2 + rd), (cwid / 2, -d / 2 + rd), (cwid / 2, yN - dh / 2),
                               (-cwid / 2, yN - dh / 2)], G + 0.027, lod=1, f=f)
    fr = min(0.08, cwid * 0.12)
    ms.cyl('lvg_tileblue', fr, fr, 0.035, at=(0, yc, G + 0.025), segs=8, lod=0, frame=f)
    ms.cyl('water', fr * 0.8, fr * 0.8, 0.037, at=(0, yc, G + 0.025), segs=8, lod=0, frame=f)
    ms.cyl('lvg_cutstone', 0.012, 0.01, 0.06, at=(0, yc, G + 0.025), segs=6, lod=0, frame=f)
    # arcades: on the front and the outer sides, and round the court
    aw = 0.09
    ah = rh * 0.62
    pw = min(0.5, w * 0.36)
    F = f @ _t(0, -d / 2, 0)
    n = max(1, int((w / 2 - pw / 2 - 0.06) / 0.14))
    for sx in (-1, 1):
        for i in range(n):
            ax = sx * (pw / 2 + 0.06 + (w / 2 - pw / 2 - 0.08) * (i + 0.5) / n)
            arch(ms, 'dark', F, ax, G + 0.025, aw, ah * 0.6, aw * 0.42, lod=1)
            gp.quad(ms, 'lvg_tileblue', F, ax, -0.002, G + ah + 0.02, aw + 0.03, rh * 0.18, lod=0)
    for sx in (-1, 1):
        SF = f @ _rz(sx * 90) @ _t(0, -w / 2, 0)
        CF = f @ _t(sx * (w / 2 - rd), 0, 0) @ _rz(-sx * 90)
        m = max(1, int(round(side_len / 0.16)))
        for i in range(m):
            ay = -d / 2 + rd + side_len * (i + 0.5) / m
            arch(ms, 'dark', SF, sx * ay, G + 0.025, aw, ah * 0.6, aw * 0.42, lod=0)
            arch(ms, 'dark', CF, -sx * ay, G + 0.025, aw, ah * 0.6, aw * 0.42, lod=0)
            gp.quad(ms, 'lvg_tileblue', CF, -sx * ay, -0.002, G + ah + 0.02, aw + 0.03, rh * 0.18, lod=0)
    SC = f @ _t(0, -d / 2 + rd, 0) @ _rz(180)  # the front range's court face
    mm = max(2, int(cwid / 0.16))
    for i in range(mm):
        ax = -cwid / 2 + cwid * (i + 0.5) / mm
        if abs(ax) > pw / 2:
            arch(ms, 'dark', SC, ax, G + 0.025, aw, ah * 0.6, aw * 0.42, lod=0)
    # the front portal (iwan) between the minarets
    ph = min(s * 0.5, rh * 2.4)
    tiled_portal(ms, F, 0, pw, ph, depth=0.06, lod=2, door_w=min(0.1, pw * 0.3))
    mr = max(0.03, k * 0.032)
    for sx in (-1, 1):
        minaret(ms, f, sx * (pw / 2 + mr * 1.3), -d / 2 - 0.02, top, mr, rh)
    # the prayer hall: an iwan on the court, the domed chamber
    NF = f @ _t(0, yN - dh / 2, 0)
    iw = min(0.36, w * 0.28)
    tiled_portal(ms, NF, 0, iw, min(hh * 1.5, s * 0.36), depth=0.04, lod=1, door_w=min(0.08, iw * 0.3))
    cw = min(w * 0.56, dh * 1.3)
    dr = cw * 0.46
    drum_h = s * 0.05
    H = dr * 1.08 * 1.75
    ch = max(hh + 0.12, min(s * 0.42, s * 0.8 - H - drum_h))
    ms.box('lvg_ashlar', (cw, cw, ch), at=(0, yN + 0.02, G), lod=2, frame=f, bevel=0.004)
    ms.box('lvg_tileblue', (cw + 0.01, cw + 0.01, 0.035), at=(0, yN + 0.02, G + ch - 0.05), lod=0, frame=f)
    for FF, length, side in gp.faces_of(f @ _t(0, yN + 0.02, 0), cw, cw):
        gp.quad(ms, 'lvg_tileblue', FF, 0, -0.002, G + hh + 0.02, cw * 0.5, (ch - hh) * 0.75, lod=0)
        arch(ms, 'dark', FF, 0, G + hh + 0.05, cw * 0.18, (ch - hh) * 0.35, cw * 0.07, y=-0.004, lod=0)
    zd0 = G + ch
    ms.cyl('lvg_tileblue', dr, dr, drum_h, at=(0, yN + 0.02, zd0), segs=16, lod=1, frame=f)
    ms.cyl('lvg_tileblue', dr, dr, drum_h, at=(0, yN + 0.02, zd0), segs=8, lod=2, only=2, frame=f)
    for i in range(8):
        a = 360.0 * i / 8
        DF = f @ _t(0, yN + 0.02, 0) @ _rz(a) @ _t(0, -dr, 0)
        arch(ms, 'dark', DF, 0, zd0 + drum_h * 0.2, 0.04, drum_h * 0.35, 0.018, y=-0.003, lod=0, n=3)
    zd = zd0 + drum_h
    r0 = dr * 1.08
    prof = [(r0 * 0.96, zd), (r0 * 1.07, zd + H * 0.16), (r0 * 1.07, zd + H * 0.32), (r0 * 0.95, zd + H * 0.52),
            (r0 * 0.72, zd + H * 0.72), (r0 * 0.38, zd + H * 0.88), (r0 * 0.1, zd + H * 0.97), (0.01, zd + H)]
    ms.lathe('lvg_turq', prof, at=(0, yN + 0.02, 0), segs=18, lod=0, frame=f)
    ms.sphere('lvg_turq', r0 * 1.02, at=(0, yN + 0.02, zd), scale=(1, 1, H / r0 / 1.02), u=10, v=5, lod=1, only=1,
              frame=f, cut_below=0.0)
    ms.cyl('lvg_turq', r0, r0 * 0.15, H, at=(0, yN + 0.02, zd), segs=8, lod=2, only=2, frame=f)
    ms.cyl('bronze', 0.008, 0.004, s * 0.06, at=(0, yN + 0.02, zd + H - 0.01), segs=5, lod=0, frame=f)
    ms.sphere('bronze', 0.016, at=(0, yN + 0.02, zd + H + 0.01), u=6, v=4, lod=0, frame=f)
    # two small domes on the hall's corners
    for sx in (-1, 1):
        small_dome(ms, f, sx * (w / 2 - rd * 0.6), yN + dh * 0.15, G + hh, min(0.06, rd * 0.35), mat='lvg_turq',
                   drum='lvg_ashlar', lod=0)
    return f


def mosque_for_church(ms, rng, x, y, top, w=0.62, length=1.0, yaw=0, **_ignored):
    """The mosque on a base layout's church spot, sized from the church's plan."""
    return mosque(ms, rng, x, y, top, w=min(length * 0.95, 1.25), d=min(length * 0.98, 1.3), yaw=yaw)


# ---- landmark 2: the covered souk ---------------------------------------------------------------

def souk(ms, rng, x, y, w, d, top=None, yaw=0, **_ignored):
    """The covered souk: two crossing buff-brick arms under grey-tiled barrel vaults, an arched
    cut-stone gate at each end, small arched windows, an octagonal lantern with a tile pyramid over
    the crossing, and shops with lattice fronts and canvas awnings in the four corners."""
    w = min(w, 2.0)
    d = min(max(d * 1.2, w * 0.78), w * 0.85)
    f = tm.house_frame(x, y, yaw)
    aw = min(0.44, max(0.26, w * 0.28))
    wh = aw * 0.7 + 0.16
    vr = aw / 2 + 0.015
    crown = G + wh + vr
    semi = [(vr * math.cos(math.pi * i / 10), wh + G + vr * math.sin(math.pi * i / 10)) for i in range(11)]
    semi2 = [(vr * math.cos(math.pi * i / 4), wh + G + vr * math.sin(math.pi * i / 4)) for i in range(5)]
    for af, length in ((f, d), (f @ _rz(90), w)):
        ms.box('lvg_brick', (aw, length, wh), at=(0, 0, G), lod=2, frame=af)
        gp.slab(ms, 'lvg_vault', semi, length + 0.03, f=af @ _t(0, -length / 2 - 0.015, 0), lod=1)
        gp.slab(ms, 'lvg_vault', semi2, length + 0.03, f=af @ _t(0, -length / 2 - 0.015, 0), lod=2, only=2)
        for sy in (-1, 1):
            ms.box('lvg_cutstone', (aw + 0.02, 0.04, 0.025), at=(0, sy * (length / 2 - 0.02), G + wh - 0.025), lod=0, frame=af)
    # the four gates
    for F, length in ((f @ _t(0, -d / 2, 0), aw), (f @ _rz(180) @ _t(0, -d / 2, 0), aw), (f @ _rz(90) @ _t(0, -w / 2, 0), aw),
                      (f @ _rz(-90) @ _t(0, -w / 2, 0), aw)):
        R = vr + 0.03
        gate = [(-R, G), (R, G)] + [(R * math.cos(math.pi * i / 10), G + wh + R * math.sin(math.pi * i / 10)) for i in range(11)]
        gp.slab(ms, 'lvg_cutstone', gate, 0.035, f=F @ _t(0, -0.035, 0), lod=1)
        ow = aw * 0.62
        arch(ms, 'dark', F, 0, G, ow, wh * 0.62, ow * 0.5, y=-0.039, lod=1, pointed=False)
        for sx in (-1, 1):  # the jambs
            ms.box('lvg_cutstone', (0.04, 0.05, wh * 0.62), at=(sx * (ow / 2 + 0.02), -0.04, G), lod=0, frame=F)
        gp.quad(ms, 'lvg_cutstone', F, 0, -0.045, G + wh * 0.62 + ow * 0.5 - 0.005, 0.035, 0.05, lod=0)  # keystone
        arch(ms, 'dark', F, 0, G + wh + vr * 0.25, 0.045, 0.04, 0.022, y=-0.039, lod=0, pointed=False)
    # small arched windows high on the arms' side walls
    for af, length in ((f, d), (f @ _rz(90), w)):
        for sx in (-1, 1):
            SF = af @ _rz(sx * 90) @ _t(0, -aw / 2, 0)
            for py in (-1, 1):
                yy = py * (aw / 2 + (length / 2 - aw / 2) * 0.55)
                arch(ms, 'dark', SF, sx * yy, G + wh * 0.72, 0.04, 0.05, 0.02, y=-0.003, lod=0, pointed=False)
    # the lantern
    lr = aw * 0.34
    lh = aw * 0.32
    zl = crown - 0.03
    ms.cyl('lvg_brick', lr, lr, lh, at=(0, 0, zl), segs=8, lod=2, frame=f @ _rz(22.5))
    for i in range(8):
        LF = f @ _rz(45 * i) @ _t(0, -lr * 0.93, 0)
        gp.quad(ms, 'dark', LF, 0, -0.003, zl + lh * 0.3, lr * 0.4, lh * 0.4, lod=0)
    ms.cyl('lvg_cutstone', lr * 1.12, lr * 1.12, 0.018, at=(0, 0, zl + lh), segs=8, lod=0, frame=f @ _rz(22.5))
    ms.cyl('lvg_vault', lr * 1.2, 0.01, lh * 0.95, at=(0, 0, zl + lh + 0.012), segs=8, lod=2, frame=f @ _rz(22.5))
    ms.cyl('bronze', 0.006, 0.003, 0.07, at=(0, 0, zl + lh * 1.9), segs=4, lod=0, frame=f)
    ms.sphere('bronze', 0.012, at=(0, 0, zl + lh * 1.9 + 0.02), u=6, v=4, lod=0, frame=f)
    # the corner shops
    cwid, cdep = w / 2 - aw / 2, d / 2 - aw / 2
    sh = min(0.26, wh * 0.72)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (aw / 2 + cwid / 2), sy * (aw / 2 + cdep / 2)
            ms.box('gp_plank', (cwid * 0.86, cdep * 0.82, sh), at=(cx, cy, G), lod=1, frame=f)
            # lattice fronts on the outer faces
            YF = f @ _t(cx, cy + sy * cdep * 0.41, 0) @ _rz(0 if sy < 0 else 180)
            XF = f @ _t(cx + sx * cwid * 0.43, cy, 0) @ _rz(sx * 90)
            gp.quad(ms, 'lvg_lattice', YF, 0, -0.002, G + 0.03, cwid * 0.7, sh * 0.6, lod=0)
            gp.quad(ms, 'lvg_lattice', XF, 0, -0.002, G + 0.03, cdep * 0.62, sh * 0.6, lod=0)
            # the canvas roof: sloping down from the arm wall outward
            slope = math.degrees(math.atan2(0.06, max(cwid, 0.1)))
            CF = f @ _t(cx, cy, G + sh + 0.04) @ tm.Matrix.Rotation(math.radians(sx * slope), 4, 'Y')
            ms.box('lvg_canvas', (cwid * 1.0, cdep * 1.0, 0.012), at=(0, 0, 0), lod=1, frame=CF)
            for px in (-1, 1):
                ms.box('timber', (0.012, 0.012, sh + 0.02),
                       at=(cx + sx * cwid * 0.48, cy + px * cdep * 0.45, G), lod=0, frame=f)
            for k in range(2):
                tt.crate(ms, f, cx + rng.uniform(-cwid * 0.3, cwid * 0.3), sy * (d / 2 + 0.035), 0.9, rng.uniform(-15, 15))
            tt.jar(ms, f, cx + sx * cwid * 0.3, sy * (d / 2 + 0.04), 0.9)
    # team banners either side of the front gate
    F = f @ _t(0, -d / 2, 0)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.035, 0.006, wh * 0.4), at=(sx * (aw / 2 + 0.06), -0.04, G + wh * 0.45), lod=1, frame=F)
    return f


def souk_for_hall(ms, rng, x, y, w, d, top=None, yaw=0, **_ignored):
    return souk(ms, rng, x, y, w, d, top=top, yaw=yaw)


# ---- the windmills' stand-in: the hammam --------------------------------------------------------

def hammam(ms, x, y, top, yaw=0, r=0.2, **_ignored):
    """A bathhouse: a plaster block on an ashlar plinth under lead domes studded with glass
    oculi, an arched door under a tiled panel, a square windcatcher tower with slotted vents."""
    f = tm.house_frame(x, y, yaw)
    w, d = r * 3.0, r * 2.4
    h = 0.3
    ms.box('lvg_plaster', (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.005)
    ms.box('lvg_ashlar', (w + 0.01, d + 0.01, 0.07), at=(0, 0, G), lod=0, frame=f)
    ms.box('roof', (w - 0.03, d - 0.03, 0.008), at=(0, 0, G + h), lod=1, frame=f)
    parapet(ms, f, w, d, G + h, h=0.035, lod=0)
    F = gp.faces_of(f, w, d)[0][0]
    gp.quad(ms, 'lvg_tileblue', F, -w * 0.15, -0.003, G + 0.2, 0.14, 0.07, lod=0)
    arch(ms, 'door', F, -w * 0.15, G, 0.08, 0.12, 0.035, lod=1, pointed=True)
    ms.box('lvg_ashlar', (0.14, 0.04, 0.02), at=(-w * 0.15, -0.02, G), lod=0, frame=F)
    # the domes
    R = min(w, d) * 0.3
    zr = G + h
    ms.cyl('lvg_plaster', R * 1.05, R * 1.05, 0.04, at=(-w * 0.12, d * 0.05, zr), segs=12, lod=1, frame=f)
    ms.sphere('gp_lead', R, at=(-w * 0.12, d * 0.05, zr + 0.04), scale=(1, 1, 0.9), u=14, v=6, lod=0, frame=f, cut_below=0.0)
    ms.sphere('gp_lead', R, at=(-w * 0.12, d * 0.05, zr + 0.04), scale=(1, 1, 0.9), u=8, v=4, lod=1, only=1, frame=f,
              cut_below=0.0)
    ms.cyl('gp_lead', R, R * 0.2, R * 0.9, at=(-w * 0.12, d * 0.05, zr + 0.04), segs=6, lod=2, only=2, frame=f)
    for i in range(10):  # the glass oculi
        a = 2 * math.pi * i / 10
        for rr, zz in ((0.62, 0.62), (0.3, 0.88)):
            if rr < 0.5 and i % 2:
                continue
            px, py = -w * 0.12 + R * rr * math.cos(a), d * 0.05 + R * rr * math.sin(a)
            ms.sphere('gp_window', 0.02, at=(px, py, zr + 0.04 + R * 0.9 * zz), u=5, v=3, lod=0, frame=f)
    for sx in (-1, 1):
        small_dome(ms, f, w * 0.3, sx * d * 0.22, zr, min(0.07, d * 0.16), mat='gp_lead', lod=1, finial=False)
    # the windcatcher
    tw = max(0.12, r * 0.6)
    tz = max(G + h + 0.25, G + (top - G) * 0.75)
    tx, ty = w / 2 - tw / 2 - 0.02, -d / 2 + tw / 2 + 0.02
    ms.box('lvg_plaster', (tw, tw, tz - G), at=(tx, ty, G), lod=2, frame=f, bevel=0.004)
    for FF, length, side in gp.faces_of(f @ _t(tx, ty, 0), tw, tw):
        for k in range(3):
            gp.quad(ms, 'dark', FF, (k - 1) * tw * 0.28, -0.003, tz - 0.16, tw * 0.14, 0.12, lod=0 if k != 1 else 1)
    ms.box('lvg_ashlar', (tw + 0.03, tw + 0.03, 0.025), at=(tx, ty, tz), lod=1, frame=f)
    ms.box('lvg_plaster', (tw * 0.6, tw * 0.6, 0.03), at=(tx, ty, tz + 0.025), lod=0, frame=f)
    # a woodpile for the furnace and jars at the back
    tt.woodpile(ms, f, -w * 0.3, d / 2 + 0.06, 0)
    tt.jar(ms, f, w * 0.1, d / 2 + 0.05, 1.0)
    return f


# ---- the small things ---------------------------------------------------------------------------

def fountain(ms, x, y, yaw=15, **_ignored):
    """A public fountain: an octagonal ashlar basin with a tiled band, water, a column and bowl."""
    f = tm.house_frame(x, y, yaw)
    ms.cyl('lvg_ashlar', 0.12, 0.12, 0.07, at=(0, 0, G), segs=8, lod=1, frame=f)
    ms.cyl('lvg_tileblue', 0.122, 0.122, 0.025, at=(0, 0, G + 0.035), segs=8, lod=0, frame=f)
    ms.cyl('lvg_cutstone', 0.13, 0.13, 0.015, at=(0, 0, G + 0.07), segs=8, lod=0, frame=f)
    ms.cyl('water', 0.1, 0.1, 0.006, at=(0, 0, G + 0.07), segs=8, lod=0, frame=f)
    ms.cyl('lvg_cutstone', 0.016, 0.014, 0.12, at=(0, 0, G + 0.07), segs=6, lod=0, frame=f)
    ms.cyl('lvg_cutstone', 0.02, 0.045, 0.025, at=(0, 0, G + 0.17), segs=8, lod=0, frame=f)
    return f


def lantern(ms, x, y, h=0.3):
    """A lantern on a timber post with a bracket."""
    ms.cyl('timber', 0.01, 0.008, h, at=(x, y, G), segs=5, lod=1)
    ms.box('timber', (0.06, 0.01, 0.01), at=(x + 0.025, y, G + h - 0.02), lod=0)
    ms.cyl('bronze', 0.016, 0.014, 0.04, at=(x + 0.05, y, G + h - 0.08), segs=6, lod=0)
    ms.cyl('bronze', 0.018, 0.003, 0.025, at=(x + 0.05, y, G + h - 0.04), segs=6, lod=0)


def jar_for_barrel(ms, f, x, y, s=1.0, z=G):
    tt.jar(ms, f, x, y, s * 1.1, z=z)


def tree_or_cypress(ms, x, y, h=0.4, r=0.13, mat='leaf', lod2=True):
    if int(abs(x * 73.1 + y * 131.7)) % 5 < 2:
        tc.cypress(ms, x, y, h=h * 1.2, r=max(0.045, r * 0.45), lod=2 if lod2 else 1)
    else:
        ORIG_TREE(ms, x, y, h=h, r=r, mat=mat, lod2=lod2)


def stone_wall(ms, pts, h=0.12, step=0.2):
    """A low rubble wall along the polyline (the stand-in for the base layouts' rail fences)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        ms.box('lvg_ashlar', (length + 0.03, 0.035, 0.08), at=((x0 + x1) / 2, (y0 + y1) / 2, G - 0.005), rot_z=yaw, lod=1)
        ms.box('lvg_plaster', (length + 0.04, 0.045, 0.015), at=((x0 + x1) / 2, (y0 + y1) / 2, G + 0.075), rot_z=yaw, lod=0)


# ---- applying the kit to a base layout ----------------------------------------------------------

def apply(max_storeys=3, replace=None):
    """Swap the base layout's builders for the kit's. `replace` maps a house spot (x, y) to a
    builder fn(ms, rng) or None (to leave it empty)."""
    KIT['max_storeys'] = max_storeys
    KIT['replace'] = {(round(x, 3), round(y, 3)): fn for (x, y), fn in (replace or {}).items()}
    KIT['used'] = set()
    gp.styled = kit_styled
    gp.gp_house = kit_gp_house
    gp.town_hall = souk_for_hall
    gp.domed_church = mosque_for_church
    gp.twin_church = mosque_for_church
    gp.windmill = hammam
    gp.well = fountain
    gp.lamp = lantern
    gp.barrel = jar_for_barrel
    gp.tree = tree_or_cypress
    tb.rail_fence = stone_wall


def main(base_name, layout, ground, max_storeys=3, replace=None):
    """Build `gunpowder-<base_name>-levant.glb` (its object keeps the layout's name).
    argv: <out_dir> [atlas_px]."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    apply(max_storeys, replace)
    tt.build_file('gunpowder-%s-levant' % base_name, [(base_name, layout, ground)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
