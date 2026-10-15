# scripts/blender/ti_mesopotamia_gunpowder.py
# The Mesopotamian kit for the Gunpowder Age (audit I215, part 2): Ottoman and Safavid Iraq, Baghdad,
# Basra, Mosul, Najaf and Karbala from the sixteenth to the nineteenth century.
#   houses      courtyard houses of yellow-brown brick (the Kingdoms houses, ti_mesopotamia_kingdoms.py,
#               in this age's brick) with carved timber shanasheel oriels on the common houses too and
#               wind catchers (badgir) on most roofs; reed huts only in the marsh towns' edges.
#   landmark-1  the shrine (Kadhimiya, Najaf, Karbala): a square court wall faced in tile, the shrine
#               block under a tall tiled dome on a drum (turquoise with a pale band), two minarets
#               with balconies and tiled caps, team banners at the gate.
#   landmark-2  the covered bazaar (a qaysariyya): a long brick hall roofed by rows of small brick
#               domes with skylights, a tiled portal at its end, a khan's gate beside it.
#   gate        the big town's gate: a brick gatehouse between round bastions (the Ottoman Baghdad
#               walls), team banners.
# Shared file: palace-small (a pasha's courtyard house with shanasheel and a dome), palace (the
# serai: a two-storey arcaded government house round a court, a clock tower), and brick wall rings
# with round bastions. Materials carry the `mgp_` prefix; the Kingdoms kit's `mkg_` and the Levant
# Kingdoms kit's helpers are used too.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_mesopotamia_bronze as mb  # noqa: E402
import ti_mesopotamia_kingdoms as mk  # noqa: E402
import ti_levant_kingdoms as lk  # noqa: E402
from ti_town import G  # noqa: E402
from ti_mesopotamia_bronze import rect, block, jar, palm  # noqa: E402,F401

NEW = ['mgp_brick', 'mgp_brick2', 'mgp_tile', 'mgp_band']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    # Ottoman Baghdad's yellow-brown brick with darker joints, a second tone for neighbours
    tm.mat_mudwall('mgp_brick', wash='#c09862', brick='#bb925d', brick2='#a8814f', mortar='#8e7048', wash_cover=0.05,
                   bond=(0.032, 0.012, 0.002))
    tm.mat_mudwall('mgp_brick2', wash='#cba877', brick='#c6a170', brick2='#b28d5f', mortar='#9a7b52', wash_cover=0.3,
                   bond=(0.032, 0.012, 0.002))
    # the shrines' tile: turquoise ground with cobalt and pale patterning, and a pale tiled band
    tm.mat_simple('mgp_tile', ['#2a9aa6', '#2276a8', '#38b0b0', '#e6dcc4'], scale=90.0, bump=0.1, rough=0.35)
    tm.mat_simple('mgp_band', ['#e8e0cc', '#d8cfb8', '#f0ead8'], scale=40.0, bump=0.1, rough=0.4)


if not any(n == 'mesopotamia_gunpowder' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('mesopotamia_gunpowder', make_materials))

mb.HOUSE_WALLS[:] = ['mgp_brick', 'mgp_brick2']
mb.POOR_WALLS[:] = ['mgp_brick2', 'msb_brick']
EARTH_GROUND = mb.EARTH_GROUND
palm_at, hut_at, bundles_at, oven_at, bits_at, stall, shaduf_well = mb.palm_at, mb.hut_at, mb.bundles_at, mb.oven_at, mb.bits_at, mb.stall, mb.shaduf_well
canal_noria = mk.canal_noria


# ---- houses -------------------------------------------------------------------------------------

def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, side=None, light=False, **_):
    """The Ottoman Baghdad courtyard house: the Kingdoms house in this age's brick, a shanasheel on
    every common and rich house, a second wind catcher on the rich ones."""
    f = mk.court_house(ms, rng, x, y, w, d, yaw=yaw, rich=rich, side=side, light=light)
    W, D, m = w / 2, d / 2, 0.012
    h = 0.3 if rich else 0.28
    if not rich:
        mk.shanasheel(ms, f, -W * 0.25, -D + m, G + h * 0.5, min(0.24, w * 0.34), h=0.13, depth=0.04)
    elif not light:
        bd = max(0.13, 0.3 * d)
        lk.badgir(ms, f, W * 0.5, (D - m - bd + D) / 2, G + h + 0.22, s=0.07, h=0.18, mat=mb.HOUSE_WALLS[0], slots=2, lod=1)
    return f


def mesopotamia_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    if kind == 'poor':
        return mk.poor_house(ms, rng, x, y, w, d, **s)
    return court_house(ms, rng, x, y, w, d, rich=(kind == 'rich'), **{k: v for k, v in s.items() if k in ('yaw', 'side', 'light')})


def kit_house(ms, rng, x, y, w, d, yaw=None, typ='common', **_):
    """The entry build_houses_damage_gunpowder.py and build_rts_skins_gunpowder.py call (light)."""
    return mesopotamia_house(ms, rng, dict(kind=typ, x=x, y=y, w=w, d=d, yaw=yaw, light=True))


# ---- landmark 1: the shrine with its tiled dome -------------------------------------------------

def tiled_dome(ms, f, x, y, z, r, drum_h, lod=1):
    """A tall tiled dome (slightly pointed) on a tiled drum with a pale band, a bronze finial."""
    ms.cyl('mgp_tile', r * 1.02, r * 1.02, drum_h, at=(x, y, z), segs=16, lod=lod, frame=f)
    ms.cyl('mgp_band', r * 1.05, r * 1.05, drum_h * 0.2, at=(x, y, z + drum_h * 0.8), segs=16, lod=0, frame=f)
    zd = z + drum_h
    ms.lathe('mgp_tile', [(r, zd), (r * 1.04, zd + r * 0.35), (r * 0.9, zd + r * 0.8), (r * 0.55, zd + r * 1.15),
                          (r * 0.15, zd + r * 1.38), (0.0, zd + r * 1.45)], at=(x, y, 0), segs=16, lod=0, frame=f)
    ms.cyl('mgp_tile', r, r * 0.12, r * 1.45, at=(x, y, zd), segs=8, lod=lod, only=tuple(range(1, lod + 1)), frame=f)  # LOD1/2
    ms.cyl('bronze', 0.008, 0.004, 0.08, at=(x, y, zd + r * 1.42), segs=5, lod=0, frame=f)
    ms.sphere('bronze', 0.014, at=(x, y, zd + r * 1.42 + 0.03), u=6, v=4, lod=0, frame=f)
    return zd + r * 1.45


def minaret(ms, f, x, y, top, r=0.045):
    """A minaret: a tiled shaft, a balcony on brackets near the top, a slim lantern and a tiled cap."""
    zb = top - 0.18
    ms.cyl('mgp_brick', r * 1.25, r * 1.2, 0.08, at=(x, y, G - 0.004), segs=10, lod=1, frame=f)
    ms.cyl('mgp_tile', r, r * 0.85, zb - G, at=(x, y, G), segs=10, lod=1, frame=f)
    ms.cyl('mgp_band', r * 1.6, r * 1.6, 0.025, at=(x, y, zb), segs=10, lod=0, frame=f)
    ms.cyl('mgp_band', r * 1.2, r, 0.02, at=(x, y, zb - 0.02), segs=10, lod=0, frame=f)
    ms.cyl('mgp_tile', r * 0.7, r * 0.65, 0.09, at=(x, y, zb + 0.025), segs=10, lod=1, frame=f)
    ms.cyl('mgp_tile', r * 0.75, 0.004, top - (zb + 0.115), at=(x, y, zb + 0.115), segs=10, lod=1, frame=f)


def ziggurat(ms, rng, x, y, w=1.45, d=1.3, h=1.18, yaw=None):
    """(named for the layouts' first landmark) The shrine: a court wall with a tiled gate, the shrine
    block, its tall tiled dome on a drum, two minarets either side of the dome, team banners."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.18
    ch = 0.18 * hs
    t = 0.04
    for (a, b, c, e) in ((-W, W, D - t, D), (-W, -W + t, -D, D), (W - t, W, -D, D), (-W, -0.14, -D, -D + t), (0.14, W, -D, -D + t)):
        rect(ms, f, 'mgp_brick', a, b, c, e, G - 0.004, ch, lod=2)
    for sx in (-1, 1):  # the gate's tiled piers
        rect(ms, f, 'mgp_tile', sx * 0.14 - 0.04, sx * 0.14 + 0.04, -D - 0.01, -D + t + 0.01, G - 0.004, ch * 1.6, lod=1)
        ms.box('team_cloth', (0.05, 0.006, ch * 0.9), at=(sx * 0.14, -D - 0.014, G + ch * 0.4), lod=1, frame=f)
    lk.pointed(ms, f, 'dark', 0, -D - 0.002, G, 0.08, ch * 1.3, lod=1)
    rect(ms, f, 'msb_roof', -W + t, W - t, -D + t, D - t, G, 0.004, lod=1)
    # arcaded cells round the court (the pilgrims' rooms): pointed niches on the inner faces
    n = max(4, int(w / 0.11))
    for k in range(n):
        lk.pointed(ms, f @ Matrix.Rotation(math.pi, 4, 'Z'), 'dark', -W + w * (k + 0.5) / n, -D + t + 0.002, G, 0.022, ch * 0.75)
    # the shrine block, dome and minarets
    sw = 0.42 * w
    sy = D * 0.15
    top = block(ms, f, -sw / 2, sw / 2, sy - sw / 2, sy + sw / 2, G - 0.004, 0.3 * hs, wall='mgp_brick', lod=2, parapet=0.02)
    lk.pishtaq(ms, f, 0, sy - sw / 2, G - 0.004, sw * 0.55, 0.38 * hs, depth=0.03, mat='mgp_brick', tile=False, door=True, lod=1)
    ms.box('mgp_tile', (sw * 0.5, 0.004, 0.36 * hs), at=(0, sy - sw / 2 - 0.031, G), lod=0, frame=f)
    lk.pointed(ms, f, 'lvk_niche', 0, sy - sw / 2 - 0.034, G, sw * 0.14, 0.3 * hs, lod=0)
    r = sw * 0.36
    domed_top = tiled_dome(ms, f, 0, sy, top, r, 0.12 * hs)
    mtop = min(h, domed_top - G + 0.06)
    for sx in (-1, 1):
        minaret(ms, f, sx * (sw / 2 + 0.06), sy - sw / 2 + 0.02, G + mtop * 0.98)
    return f


# ---- landmark 2: the covered bazaar --------------------------------------------------------------

def temple(ms, rng, x, y, w=1.3, d=1.05, h=1.0, yaw=None, palms=True):
    """(named for the layouts' second landmark) The covered bazaar: a long brick hall roofed by two
    rows of small brick domes with skylights, shop arches along its front, a tiled portal at its
    west end, a khan's gate with a team banner at the east end."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.0
    bh = 0.3 * hs
    y0, y1 = -D * 0.55, D * 0.9
    rect(ms, f, 'mgp_brick', -W, W, y0, y1, G - 0.004, bh, lod=2, bevel=0.004)
    rect(ms, f, 'msb_roof', -W + 0.02, W - 0.02, y0 + 0.02, y1 - 0.02, G + bh, 0.005, lod=1)
    nx = max(3, int(w / 0.2))
    for row, yy in enumerate((y0 + (y1 - y0) * 0.28, y0 + (y1 - y0) * 0.72)):
        for k in range(nx):
            dx = -W + w * (k + 0.5) / nx
            mk.brick_dome(ms, f, dx, yy, G + bh, min(0.08, w / nx * 0.4), mat='mgp_brick2', lod=1 if (k + row) % 2 == 0 else 0, drum=0.015)
            ms.cyl('mgp_band', 0.012, 0.012, 0.03, at=(dx, yy, G + bh + 0.015 + min(0.08, w / nx * 0.4) * 0.88), segs=6, lod=0, frame=f)
    ns = max(4, int(w / 0.13))
    for k in range(ns):  # the shop arches, an awning over some
        sx = -W + w * (k + 0.5) / ns
        lk.pointed(ms, f, 'dark', sx, y0 - 0.002, G, w / ns * 0.3, bh * 0.62)
        if k % 2 == 0:
            af = f @ Matrix.Translation(Vector((sx, y0 - 0.05, G + bh * 0.6))) @ Matrix.Rotation(math.radians(-16), 4, 'X')
            ms.box('team_cloth' if k % 4 == 0 else 'msb_reedmat', (w / ns * 0.8, 0.09, 0.006), at=(0, 0, 0), lod=0, frame=af)
    # the tiled portal at the west end of the front, the khan gate at the east end
    lk.pishtaq(ms, f, -W + 0.16, y0, G - 0.004, 0.22, bh * 1.35, depth=0.04, mat='mgp_brick', tile=False, door=True, lod=1)
    ms.box('mgp_tile', (0.2, 0.004, bh * 1.28), at=(-W + 0.16, y0 - 0.041, G), lod=0, frame=f)
    lk.pointed(ms, f, 'lvk_niche', -W + 0.16, y0 - 0.044, G, 0.06, bh * 1.05, lod=0)
    gx = W - 0.14
    rect(ms, f, 'mgp_brick2', gx - 0.12, gx + 0.12, y0 - 0.04, y0 + 0.08, G - 0.004, bh * 1.5, lod=2)
    lk.pointed(ms, f, 'dark', gx, y0 - 0.042, G, 0.05, bh * 1.0, lod=1)
    ms.cyl('timber', 0.006, 0.005, max(0.06, h - bh * 1.5 - 0.02), at=(gx, y0 + 0.02, G + bh * 1.5), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, gx, y0 + 0.02, G + h - 0.03, yaw=-130, w=0.14, h=0.09)
    for k in range(3):
        mb.stall(ms, *(f @ Vector((-W + 0.3 + 0.3 * k, -D + 0.12, 0))).xy, rng, cloth='team_cloth' if k % 2 else 'msb_reedmat', w=0.22, d=0.15)
    if palms:
        palm(ms, rng, W - 0.08, -D + 0.08, h=min(0.46, h * 0.45), fronds=7, lod=1, frame=f)
    return f


def town_gate(ms, rng, x, y, yaw=0.0):
    mk.town_gate(ms, rng, x, y, yaw=yaw)


# ---- the shared file (shared-gunpowder-mesopotamia.glb) ------------------------------------------

def palace_small(ms, rng):
    """`palace-small` (8 m): a pasha's courtyard house: two storeys of brick, two shanasheel oriels
    over the front, a wind catcher, a small tiled dome, a team banner."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.38, 0.36
    top = block(ms, f, -W, W, -D, D, G, 0.46, wall='mgp_brick', lod=2)
    for sx in (-1, 1):
        mk.shanasheel(ms, f, sx * W * 0.5, -D, G + 0.24, 0.24, h=0.16)
    lk.pointed(ms, f, 'door', 0, -D - 0.003, G, 0.05, 0.2, lod=1)
    ms.box('mgp_tile', (0.14, 0.006, 0.04), at=(0, -D - 0.004, G + 0.21), lod=0, frame=f)
    lk.badgir(ms, f, W * 0.55, D * 0.5, top, s=0.09, h=0.2, mat='mgp_brick', slots=2, lod=1)
    tiled_dome(ms, f, -W * 0.4, D * 0.35, top, 0.1, 0.03)
    ms.cyl('timber', 0.006, 0.005, 0.26, at=(0, D * 0.6, top), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, 0, D * 0.6, top + 0.255, yaw=-130, w=0.14, h=0.09)


def palace(ms, rng):
    """`palace` (12 m): the serai: a two-storey brick government house round a court, arcaded galleries
    on both floors of the front, a tiled portal, and a brick clock tower at its corner with a tiled
    cap, team banners."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.58, 0.5
    h1, h2 = 0.26, 0.22
    top = block(ms, f, -W, W, -D, D, G - 0.004, h1 + h2, wall='mgp_brick', lod=2)
    for z, hh in ((G, h1), (G + h1, h2)):
        n = 8
        for k in range(n):
            lk.pointed(ms, f, 'dark', -W + 2 * W * (k + 0.5) / n, -D - 0.003, z + 0.02, 0.035, hh * 0.72)
        ms.box('mgp_band', (2 * W + 0.01, 0.012, 0.016), at=(0, -D - 0.005, z + hh - 0.02), lod=0, frame=f)
    lk.pishtaq(ms, f, 0, -D, G - 0.004, 0.24, h1 + h2 * 0.8, depth=0.04, mat='mgp_brick', tile=False, door=True, lod=1)
    ms.box('mgp_tile', (0.22, 0.004, h1 + h2 * 0.72), at=(0, -D - 0.041, G), lod=0, frame=f)
    # the clock tower
    tx, ty, tw = W - 0.09, -D + 0.09, 0.14
    rect(ms, f, 'mgp_brick2', tx - tw / 2, tx + tw / 2, ty - tw / 2, ty + tw / 2, top, 0.32, lod=2)
    ms.cyl('mgp_band', 0.04, 0.04, 0.006, at=(tx, ty - tw / 2 - 0.001, top + 0.22), rot=(90, 0, 0), segs=12, lod=0, frame=f)
    ms.cyl('mgp_tile', tw * 0.72, 0.004, 0.14, at=(tx, ty, top + 0.32), segs=4, lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.06, 0.006, 0.24), at=(sx * 0.22, -D - 0.006, G + h1 * 0.5), lod=1, frame=f)
    ms.cyl('timber', 0.007, 0.006, 0.3, at=(-W + 0.08, -D + 0.08, top), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, -W + 0.08, -D + 0.08, top + 0.295, yaw=-130, w=0.16, h=0.1)
    palm(ms, rng, -W + 0.1, -D - 0.08, h=0.45, fronds=8, lod=1)


WALL_RAISE = 1.3
walls_small = mk._round_walls(2.22, 2.04, 0.38 * WALL_RAISE, 0.2, 6, 0.13, (0.4, 0.52 * WALL_RAISE), mat='mgp_brick', band='mgp_brick2')
walls_medium = mk._round_walls(3.2, 2.96, 0.48 * WALL_RAISE, 0.25, 8, 0.18, (0.5, 0.68 * WALL_RAISE), mat='mgp_brick', band='mgp_brick2')
walls_big = mk._round_walls(4.3, 3.97, 0.6 * WALL_RAISE, 0.3, 10, 0.24, (0.62, 0.86 * WALL_RAISE), mat='mgp_brick', band='mgp_brick2')
