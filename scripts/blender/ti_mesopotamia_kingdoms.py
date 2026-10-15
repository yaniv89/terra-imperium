# scripts/blender/ti_mesopotamia_kingdoms.py
# The Mesopotamian kit for the Kingdoms Age (audit I215, part 2): Abbasid Baghdad, Samarra, Basra
# and Kufa in the Islamic Golden Age. Where the Levant kit's Kingdoms towns are cream plaster and
# lead roofs, these are buff baked brick laid in fine courses (the Abbasid brick of Baghdad and
# Samarra), with turquoise and cobalt glazed tile only on the great buildings.
#   houses      the Bronze kit's courtyard houses (ti_mesopotamia_bronze.court_house) in baked brick,
#               a pointed-arch doorway, a wind catcher over the back range, and on the rich houses an
#               upper storey with a carved timber oriel (shanasheel) over the street and a small brick
#               dome over one room; the marsh reed huts and the brick huts stay at the edges.
#   landmark-1  the Great Mosque of Samarra in small: a brick enclosure with half-round towers along
#               its walls and the spiral minaret (the Malwiya) standing before it.
#   landmark-2  a madrasa (the Mustansiriya) with its tall portal iwan faced in glazed tile, beside the
#               muqarnas cone of a tomb (the Zumurrud Khatun's), tiers of niches up to a finial.
#   gate        the big town's gate (the round city's gates): two round brick towers, the passage under
#               a domed gate chamber, team banners.
#   props       date palms, a canal with a noria (water wheel), reed bundles, stalls, a well.
# Shared file: palace-small (a courtyard house with an iwan and a dome), palace (the great iwan of an
# Abbasid palace, a vault like Taq Kasra's between blind-arcaded wings, a green dome behind), and the
# wall rings: the round city's brick walls with round towers.
# Helpers from ti_levant_kingdoms.py (the spiral minaret, pointed arches, the portal, the wind
# catcher, muqarnas) are used unchanged. Materials carry the `mkg_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_mesopotamia_bronze as mb  # noqa: E402
import ti_levant_kingdoms as lk  # noqa: E402
from ti_town import G  # noqa: E402
from ti_mesopotamia_bronze import rect, block, jar, palm, obox  # noqa: E402,F401

NEW = ['mkg_brick', 'mkg_brick2', 'mkg_tile', 'mkg_turq', 'mkg_wood', 'mkg_dome']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    # buff Abbasid baked brick in fine courses with pale joints, and a warmer tone for neighbours
    tm.mat_mudwall('mkg_brick', wash='#c9a670', brick='#c4a06a', brick2='#b48f5c', mortar='#dcc79c', wash_cover=0.08,
                   bond=(0.03, 0.011, 0.0018))
    tm.mat_mudwall('mkg_brick2', wash='#c39b68', brick='#bd9362', brick2='#a98257', mortar='#d6bf95', wash_cover=0.2,
                   bond=(0.03, 0.011, 0.0018))
    # cobalt and turquoise glazed tile (portals), turquoise (the green-blue domes), carved dark timber
    tm.mat_simple('mkg_tile', ['#1f5c9e', '#2a7cb4', '#36a0b8', '#1a4a86'], scale=70.0, bump=0.12, rough=0.4)
    tm.mat_simple('mkg_turq', ['#2f9a9c', '#3cb0ac', '#279088', '#48b8b0'], scale=40.0, bump=0.1, rough=0.35)
    tm.mat_simple('mkg_wood', ['#4a3220', '#5c4029', '#3e2a1b'], scale=8.0, stripes={'dir': 'Z', 'scale': 140.0, 'distortion': 4.0}, bump=0.4)
    tm.mat_simple('mkg_dome', ['#c9a670', '#d2b07a', '#bd9a66'], scale=30.0, bump=0.2)


if not any(n == 'mesopotamia_kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('mesopotamia_kingdoms', make_materials))

mb.HOUSE_WALLS[:] = ['mkg_brick', 'mkg_brick2']
mb.POOR_WALLS[:] = ['msb_brick', 'mkg_brick2']
EARTH_GROUND = mb.EARTH_GROUND
palm_at, hut_at, bundles_at, oven_at, bits_at, stall, shaduf_well = mb.palm_at, mb.hut_at, mb.bundles_at, mb.oven_at, mb.bits_at, mb.stall, mb.shaduf_well


# ---- details ------------------------------------------------------------------------------------

def shanasheel(ms, f, x, y, z, w, h=0.16, depth=0.05):
    """A carved timber oriel window over the street (Baghdad's shanasheel): a box cantilevered from
    the wall face at y (facing -Y) on brackets, latticed fronts, a little roof."""
    ms.box('mkg_wood', (w, depth, h), at=(x, y - depth / 2, z), lod=1, frame=f)
    n = max(3, int(w / 0.03))
    for k in range(n):
        px = x - w / 2 + w * (k + 0.5) / n
        ms.box('dark', (w / n * 0.55, 0.004, h * 0.62), at=(px, y - depth - 0.001, z + h * 0.2), lod=0, frame=f)
    ms.box('mkg_wood', (w + 0.02, depth + 0.02, 0.012), at=(x, y - depth / 2, z + h), lod=0, frame=f)
    for sx in (-w / 2 + 0.01, w / 2 - 0.01):
        ms.box('mkg_wood', (0.012, depth, 0.03), at=(x + sx, y - depth / 2, z - 0.03), lod=0, frame=f)


def brick_dome(ms, f, x, y, z, r, mat='mkg_dome', lod=1, drum=0.03):
    """A small dome on a low drum."""
    ms.cyl(mat, r * 1.05, r * 1.05, drum, at=(x, y, z), segs=12, lod=lod, frame=f)
    ms.sphere(mat, r, at=(x, y, z + drum), scale=(1, 1, 0.9), u=12, v=6, cut_below=0.0, lod=0, frame=f)
    ms.sphere(mat, r, at=(x, y, z + drum), scale=(1, 1, 0.9), u=8, v=3, cut_below=0.0, lod=lod, only=tuple(range(1, lod + 1)) or None, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, side=None, light=False, **_):
    """The Abbasid courtyard house: the Bronze kit's house in baked brick, a pointed-arch doorway
    surround, a wind catcher; rich: an upper storey with a shanasheel oriel over the street and a
    small dome over a room of the side range."""
    f = mb.court_house(ms, rng, x, y, w, d, yaw=yaw, rich=rich, side=side, upper=rich)
    W, D, m = w / 2, d / 2, 0.012
    h = 0.3 if rich else 0.28
    bd = max(0.13, 0.3 * d)
    yb = D - m - bd
    if not light:
        lk.badgir(ms, f, -W * 0.45, (yb + D) / 2, G + h + (0.22 if rich else 0.0), s=0.07, h=0.16, mat=mb.HOUSE_WALLS[0], slots=2, lod=1)
    if rich:
        shanasheel(ms, f, W * 0.15, -D + m, G + h * 0.95, min(0.34, w * 0.42), h=0.15)
        if not light:
            sw = max(0.12, 0.26 * w)
            brick_dome(ms, f, (W - m - sw / 2) * (1 if rng.random() < 0.5 else -1), -D + m + max(0.11, 0.21 * d) + 0.12, G + h * 0.96, min(0.07, sw * 0.42))
    return f


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, reed=False, **_):
    return mb.poor_house(ms, rng, x, y, w, d, yaw=yaw, side=side, reed=reed)


def mesopotamia_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    if kind == 'poor':
        return poor_house(ms, rng, x, y, w, d, **s)
    return court_house(ms, rng, x, y, w, d, rich=(kind == 'rich'), **{k: v for k, v in s.items() if k in ('yaw', 'side', 'light')})


def house(ms, rng, kind, x, y, w, d, yaw=None, **kw):
    """The entry build_houses_damage_kingdoms.py and build_rts_skins_kingdoms.py call (light: no wind
    catcher, no dome, inside the damage budgets)."""
    return mesopotamia_house(ms, rng, dict(kind=kind, x=x, y=y, w=w, d=d, yaw=yaw, light=True))


# ---- landmark 1: the Great Mosque of Samarra and its spiral minaret ------------------------------

def ziggurat(ms, rng, x, y, w=1.45, d=1.3, h=1.18, yaw=None):
    """(named for the layouts' first landmark) The mosque of Samarra: a brick enclosure across the
    back of the plot with half-round towers along its walls, a pointed doorway in the front wall, a
    low arcade inside, and the spiral minaret in front of it, reached by a short brick bridge."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.18
    r0 = 0.24 * min(1.0, w / 1.45) * (0.9 + 0.1 * hs)
    my = -D + r0 * 1.12
    ey0 = my + r0 + 0.06                           # the enclosure's front wall
    wh = 0.26 * hs
    # the enclosure: four walls round a court, half-round towers, a paved court with an arcade
    t = 0.05
    for (a, b, c, e) in ((-W, W, ey0, ey0 + t), (-W, W, D - t, D), (-W, -W + t, ey0, D), (W - t, W, ey0, D)):
        rect(ms, f, 'mkg_brick', a, b, c, e, G - 0.004, wh, lod=2)
    n = max(3, int(w / 0.22))
    for k in range(n + 1):
        px = -W + w * k / n
        for py in (ey0, D):
            ms.cyl('mkg_brick', 0.035, 0.035, wh + 0.02, at=(px, py, G - 0.004), segs=8, lod=0 if 0 < k < n else 1, frame=f)
    for py in (ey0 + 0.08, (ey0 + D) / 2, D - 0.08):
        for sx in (-1, 1):
            ms.cyl('mkg_brick', 0.035, 0.035, wh + 0.02, at=(sx * W, py, G - 0.004), segs=8, lod=0, frame=f)
    rect(ms, f, 'msb_roof', -W + t, W - t, ey0 + t, D - t, G, 0.004, lod=1)
    ah = wh * 0.7
    rect(ms, f, 'mkg_brick', -W + t, W - t, D - t - 0.12, D - t, G, ah, lod=1)  # the prayer hall's arcade front
    rect(ms, f, 'msb_roof', -W + t, W - t, D - t - 0.12, D - t, G + ah, 0.006, lod=1)
    na = max(4, int((w - 2 * t) / 0.12))
    for k in range(na):
        lk.pointed(ms, f, 'dark', -W + t + (w - 2 * t) * (k + 0.5) / na, D - t - 0.121, G, 0.03, ah * 0.85)
    lk.pointed(ms, f, 'dark', 0, ey0 - 0.002, G, 0.05, wh * 0.85, lod=1)
    # the spiral minaret before it, a bridge to the enclosure
    lk.spiral_minaret(ms, f, 0, my, r0, r0 * 0.52, h * 0.995)
    rect(ms, f, 'mkg_brick', -0.03, 0.03, my + r0 * 0.6, ey0 + 0.01, G + 0.04, 0.025, lod=0)
    return f


# ---- landmark 2: the madrasa and the muqarnas cone -----------------------------------------------

def muqarnas_cone(ms, f, x, y, z, r, h, tiers=8):
    """A muqarnas cone (the Zumurrud Khatun's tomb): an octagonal drum, then tiers of niches stepping
    in to a point, a finial."""
    zz = z
    for t in range(tiers):
        rr = r * (1 - t / (tiers + 0.6))
        hh = h / tiers
        ms.cyl('mkg_brick', rr, rr * 0.92, hh, at=(x, y, zz), segs=8, lod=1 if t % 2 == 0 else 0, frame=f)
        ms.cyl('mkg_brick2', rr * 1.01, rr * 1.01, hh * 0.18, at=(x, y, zz + hh * 0.82), segs=8, lod=0, frame=f)  # the tier's lip
        zz += hh
    ms.cyl('mkg_brick', r * 0.95, r * 0.15, h, at=(x, y, z), segs=6, lod=2, only=(2,), frame=f)
    ms.cyl('bronze', 0.008, 0.004, 0.07, at=(x, y, zz), segs=5, lod=0, frame=f)


def temple(ms, rng, x, y, w=1.3, d=1.05, h=1.0, yaw=None, palms=True):
    """(named for the layouts' second landmark) The madrasa: a two-storey brick block round a court,
    arcaded upper loggia, a tall portal iwan in the front faced in cobalt and turquoise tile with a
    muqarnas hood, team banners either side, and the muqarnas cone of a tomb at its back corner."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.0
    bh = 0.4 * hs
    y0 = -D + 0.05
    rect(ms, f, 'mkg_brick', -W, W * 0.55, y0, D, G - 0.004, bh, lod=2, bevel=0.004)
    rect(ms, f, 'msb_roof', -W + 0.02, W * 0.55 - 0.02, y0 + 0.02, D - 0.02, G + bh, 0.005, lod=1)
    for k, (kf, half, span) in enumerate(lk.faces4(f @ Matrix.Translation(Vector((-W * 0.225, (y0 + D) / 2, 0))), W * 1.55, D - y0)):
        n = max(3, int(span / 0.12))
        for i in range(n):
            lk.pointed(ms, kf, 'dark', -span / 2 + span * (i + 0.5) / n, -half - 0.003, G + bh * 0.55, 0.022, bh * 0.3)
    # the portal iwan
    pw, ph = 0.36 * min(1.0, w / 1.3), bh * 1.45
    px = -W * 0.225
    lk.pishtaq(ms, f, px, y0, G - 0.004, pw, ph, depth=0.06, mat='mkg_brick', tile=False, niche='lvk_niche', door=True, lod=2)
    ms.box('mkg_tile', (pw * 0.9, 0.004, ph * 0.93), at=(px, y0 - 0.061, G), lod=0, frame=f)
    lk.pointed(ms, f, 'mkg_turq', px, y0 - 0.064, G, pw * 0.36, ph * 0.84, lod=0)
    lk.pointed(ms, f, 'lvk_niche', px, y0 - 0.066, G, pw * 0.3, ph * 0.76, lod=1)
    lk.muqarnas(ms, f, px, y0 - 0.067, G + ph * 0.52, pw * 0.28, ph * 0.26, tiers=3)
    lk.pointed(ms, f, 'door', px, y0 - 0.069, G, pw * 0.15, ph * 0.38, lod=1)
    for sx in (-1, 1):
        bx = px + sx * (pw / 2 + 0.05)
        ms.box('team_cloth', (0.05, 0.006, bh * 0.6), at=(bx, y0 - 0.006, G + bh * 0.3), lod=1, frame=f)
    # the tomb with its muqarnas cone at the east end
    cx, cy = W * 0.75, (y0 + D) / 2 + 0.05
    cr = min(0.2, 0.15 * w)
    ms.cyl('mkg_brick', cr * 1.15, cr * 1.15, bh * 0.7, at=(cx, cy, G - 0.004), segs=8, lod=2, frame=f)
    lk.pointed(ms, f @ Matrix.Translation(Vector((cx, cy, 0))), 'dark', 0, -cr * 1.12, G, 0.03, bh * 0.5)
    muqarnas_cone(ms, f, cx, cy, G + bh * 0.7, cr, h - bh * 0.7 - 0.08)
    if palms:
        palm(ms, rng, -W + 0.12, y0 - 0.12, h=min(0.48, h * 0.45), fronds=7, lod=1, frame=f)
        palm(ms, rng, W * 0.4, y0 - 0.12, h=min(0.44, h * 0.42), fronds=7, lod=1, frame=f)
    return f


def town_gate(ms, rng, x, y, yaw=0.0, width=0.28, h=0.55):
    """A gate of the round city: two round brick towers, the passage under a pointed arch, a domed
    gate chamber over it, team banners, stubs of the wall."""
    f = tm.house_frame(x, y, yaw)
    tr = 0.12
    for sx in (-1, 1):
        cx = sx * (width / 2 + tr)
        ms.cyl('mkg_brick', tr, tr * 0.95, h, at=(cx, 0, G - 0.004), segs=14, lod=2, frame=f)
        ms.cyl('mkg_brick2', tr * 1.06, tr * 1.06, 0.03, at=(cx, 0, G + h - 0.03), segs=14, lod=0, frame=f)
        rect(ms, f, 'mkg_brick', cx + sx * tr * 0.6, cx + sx * (tr + 0.36), -0.05, 0.05, G - 0.004, 0.25, lod=1)
        ms.cyl('timber', 0.007, 0.006, 0.18, at=(cx, 0, G + h), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, cx, 0, G + h + 0.175, yaw=-120 if sx < 0 else -60, w=0.16, h=0.1)
    rect(ms, f, 'mkg_brick', -width / 2 - 0.02, width / 2 + 0.02, -0.11, 0.11, G - 0.004, h * 0.85, lod=2)
    lk.pointed(ms, f, 'dark', 0, -0.112, G, width * 0.32, h * 0.6, lod=1)
    lk.pointed(ms, f, 'mkg_tile', 0, -0.111, G + h * 0.62, width * 0.2, h * 0.16, lod=0)
    brick_dome(ms, f, 0, 0, G + h * 0.85, 0.1, mat='mkg_turq')


def canal_noria(ms, rng, x, y, yaw=0.0):
    """A short canal with a noria (a water wheel of timber lifting water to an aqueduct trough)."""
    f = mb.canal(ms, rng, x - 0.4 * math.cos(math.radians(yaw)), y - 0.4 * math.sin(math.radians(yaw)),
                 x + 0.4 * math.cos(math.radians(yaw)), y + 0.4 * math.sin(math.radians(yaw)), w=0.12, boat=False)
    wf = f @ Matrix.Translation(Vector((0.05, 0, G + 0.12)))
    ms.cyl('mkg_wood', 0.13, 0.13, 0.02, at=(0, -0.01, 0), rot=(90, 0, 0), segs=16, lod=1, frame=wf, caps=False)
    for k in range(6):
        ms.box('mkg_wood', (0.012, 0.012, 0.25), at=(0, 0, -0.125), lod=0, frame=wf @ Matrix.Rotation(math.radians(30 * k), 4, 'Y'))
    for sy in (-1, 1):
        ms.box('mkg_brick', (0.04, 0.03, 0.14), at=(0.05, sy * 0.05, G), lod=1, frame=f)
    rect(ms, f, 'mkg_brick', 0.08, 0.36, -0.03, 0.03, G, 0.17, lod=1)  # the aqueduct trough
    return f


# ---- the shared file (shared-kingdoms-mesopotamia.glb) -------------------------------------------

def palace_small(ms, rng):
    """`palace-small` (8 m): a governor's courtyard house in baked brick, a tiled portal iwan in the
    front, a turquoise dome over the reception hall, a shanasheel oriel, a team banner."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.38, 0.36
    top = block(ms, f, -W, W, -D, D, G, 0.36, wall='mkg_brick', lod=2)
    lk.pishtaq(ms, f, 0, -D, G, 0.24, 0.44, depth=0.04, mat='mkg_brick', tile=False, door=True, lod=2)
    ms.box('mkg_tile', (0.21, 0.004, 0.4), at=(0, -D - 0.041, G), lod=0, frame=f)
    lk.pointed(ms, f, 'lvk_niche', 0, -D - 0.044, G, 0.07, 0.34, lod=1)
    lk.pointed(ms, f, 'door', 0, -D - 0.046, G, 0.04, 0.18, lod=1)
    shanasheel(ms, f, W * 0.62, -D, G + 0.2, 0.2, h=0.13)
    brick_dome(ms, f, -W * 0.35, D * 0.3, top, 0.14, mat='mkg_turq')
    ms.cyl('timber', 0.006, 0.005, 0.3, at=(W * 0.6, D * 0.5, top), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, W * 0.6, D * 0.5, top + 0.295, yaw=-130, w=0.14, h=0.09)
    palm(ms, rng, W * 0.55, -D * 0.1, h=0.32, fronds=7, lod=1, z=top)


def palace(ms, rng):
    """`palace` (12 m): the Abbasid palace's great iwan (a vault like Taq Kasra's) in the middle of a
    brick front with tiers of blind arches on its wings, the throne hall behind under a green dome,
    team banners on the front."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.6, 0.55
    wh = 0.42
    rect(ms, f, 'mkg_brick', -W, W, -D + 0.1, D, G - 0.004, wh, lod=2, bevel=0.004)
    rect(ms, f, 'msb_roof', -W + 0.02, W - 0.02, -D + 0.12, D - 0.02, G + wh, 0.005, lod=1)
    for row in range(2):  # blind arcades on the wings, two tiers
        for sx in (-1, 1):
            for k in range(3):
                bx = sx * (0.25 + 0.11 * k)
                lk.pointed(ms, f, 'lvk_niche', bx, -D + 0.098, G + 0.05 + row * wh * 0.45, 0.035, wh * 0.36)
    # the great iwan: a tall pointed-parabolic vault opening in a raised frontispiece
    ih = 0.62
    rect(ms, f, 'mkg_brick', -0.22, 0.22, -D, -D + 0.12, G - 0.004, ih, lod=2)
    mb.arch_solid(ms, 'dark', f, -D - 0.002, -D + 0.1, 0.15, ih * 0.88, z0=G, n=8, lod=1)
    ms.box('mkg_tile', (0.42, 0.004, 0.05), at=(0, -D - 0.002, G + ih - 0.07), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.06, 0.006, 0.26), at=(sx * 0.3, -D + 0.094, G + wh * 0.3), lod=1, frame=f)
        ms.cyl('timber', 0.007, 0.006, 0.3, at=(sx * 0.2, -D + 0.06, G + ih), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, sx * 0.2, -D + 0.06, G + ih + 0.295, yaw=-120 if sx < 0 else -60, w=0.16, h=0.1)
    brick_dome(ms, f, 0, 0.2, G + wh, 0.2, mat='mkg_turq', drum=0.08)
    palm(ms, rng, -W + 0.1, -D - 0.06, h=0.45, fronds=8, lod=1)
    palm(ms, rng, W - 0.1, -D - 0.06, h=0.42, fronds=7, lod=1)


def _round_walls(R_out, R_in, H, gate_x, n_towers, tower_r, gate_towers, mat='mkg_brick', band='mkg_brick2'):
    import ti_bronze as tb

    def build(ms, rng):
        tb.mud_wall_ring(ms, rng, R_out=R_out, R_in=R_in, H=H, gate_x=gate_x, band=(band, 0.1), buttresses=(),
                         towers=(), gate_towers=gate_towers, gate_flag=None, straps=True, mat=mat, banners=True,
                         n=(128, 48, 32), planks=False)
        # the round city's half-round towers, evenly round the ring, none at the gate
        Rm = (R_out + R_in) / 2
        for k in range(n_towers):
            a = -90 + 360.0 * (k + 0.5) / n_towers
            if abs(((a + 90 + 180) % 360) - 180) < 20:
                continue
            cx, cy = (R_out - 0.02) * math.cos(math.radians(a)), (R_out - 0.02) * math.sin(math.radians(a))
            ms.cyl(mat, tower_r, tower_r * 0.94, H * 1.18, at=(cx, cy, 0), segs=12, lod=1)
            ms.cyl(band, tower_r * 1.06, tower_r * 1.06, 0.03, at=(cx, cy, H * 1.18 - 0.03), segs=12, lod=0)
        del Rm
    return build


WALL_RAISE = 1.3
walls_small = _round_walls(2.22, 2.04, 0.38 * WALL_RAISE, 0.2, 8, 0.1, (0.4, 0.52 * WALL_RAISE))
walls_medium = _round_walls(3.2, 2.96, 0.48 * WALL_RAISE, 0.25, 12, 0.13, (0.5, 0.68 * WALL_RAISE))
walls_big = _round_walls(4.3, 3.97, 0.6 * WALL_RAISE, 0.3, 16, 0.16, (0.62, 0.86 * WALL_RAISE))
