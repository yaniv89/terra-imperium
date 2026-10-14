# scripts/blender/ti_mesopotamia_classical.py
# The Mesopotamian kit for the Classical Age (audit I215): Babylon and the river towns from the
# Neo-Assyrian and Neo-Babylonian kings through the Achaemenid, Seleucid and Parthian centuries.
# The houses keep the Bronze kit's courts (ti_mesopotamia_bronze.py) but grow: more baked brick, door
# frames and footings in it, stepped merlons on the parapets of the better houses, roof beams
# projecting under the parapet, upper storeys, roof gardens with palms on the rich houses. The
# marsh reed huts and date palms stay at the edges.
#   landmark-1  the great ziggurat (Etemenanki): five battered stages of baked brick, one long
#               straight stair up the front, the high shrine at the top faced in blue glazed brick.
#   landmark-2  the temple of the city god (Esagila): a long baked-brick temple with stepped merlons,
#               its gate towers faced in blue glazed brick with ochre bands and rows of plain
#               rosettes (no beasts, no emblems), team banners on the towers.
#   gate        the big town's gate (the Ishtar Gate's look): twin glazed-brick towers with
#               stepped merlons and ochre bands.
# Shared file: palace-small (a baked-brick residence with a glazed door surround), palace (the
# throne room's glazed facade behind a court and a towered gate) and the wall rings (the double walls
# of Babylon: battered mud brick, a blue glazed band at the foot, towers, a glazed gate).
# Materials: the Bronze kit's `msb_` ones plus `msc_` glazes.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_mesopotamia_bronze as mb  # noqa: E402
from ti_town import G  # noqa: E402
from ti_mesopotamia_bronze import rect, block, footing, door, vent, jar, palm, obox  # noqa: E402,F401

NEW = ['msc_glaze', 'msc_glaze_band', 'msc_rosette']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    # blue glazed brick (the Ishtar Gate's lapis blue, varied tile to tile), its ochre-yellow band,
    # and the pale rosettes set in rows on the band
    tm.mat_mudwall('msc_glaze', wash='#2f5f9a', brick='#2c5a95', brick2='#24508a', mortar='#1d3557', wash_cover=0.0,
                   bond=(0.03, 0.011, 0.0018))
    tm.mat_simple('msc_glaze_band', ['#c99a3c', '#d6a948', '#b98a33'], scale=30.0, rough=0.35, bump=0.1)
    tm.mat_simple('msc_rosette', ['#ece0c4', '#f3ead6', '#ddcfaf'], scale=30.0, rough=0.35, bump=0.1)


if not any(n == 'mesopotamia_classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('mesopotamia_classical', make_materials))

EARTH_GROUND = mb.EARTH_GROUND

# re-exports the town builder uses
palm_at, hut_at, bundles_at, oven_at, bits_at, stall, shaduf_well = mb.palm_at, mb.hut_at, mb.bundles_at, mb.oven_at, mb.bits_at, mb.stall, mb.shaduf_well


# ---- details ------------------------------------------------------------------------------------

def stepped_merlons(ms, f, x0, x1, y, z, step=0.05, size=0.026, mat='msb_baked', face=-1, along='x', lod=0):
    """Babylonian stepped merlons along a wall top: each merlon a small block with a narrower step
    on top (two boxes), along x at y, or along y at x."""
    span = x1 - x0
    n = max(2, int(span / step))
    for k in range(n):
        p = x0 + span * (k + 0.5) / n
        for (s, dz, hz) in ((1.0, 0.0, size * 0.55), (0.55, size * 0.55, size * 0.45)):
            if along == 'x':
                ms.box(mat, (size * s, 0.014, hz), at=(p, y + face * 0.002, z + dz), lod=lod, frame=f)
            else:
                ms.box(mat, (0.014, size * s, hz), at=(y + face * 0.002, p, z + dz), lod=lod, frame=f)


def merlon_rim(ms, f, x0, x1, y0, y1, z, step=0.05, size=0.026, mat='msb_baked', lod=0):
    """Stepped merlons round all four edges of a flat roof (x0..x1, y0..y1) at height z."""
    stepped_merlons(ms, f, x0, x1, y0 + 0.007, z, step, size, mat, -1, 'x', lod)
    stepped_merlons(ms, f, x0, x1, y1 - 0.007, z, step, size, mat, 1, 'x', lod)
    stepped_merlons(ms, f, y0 + 0.03, y1 - 0.03, x0 + 0.007, z, step, size, mat, -1, 'y', lod)
    stepped_merlons(ms, f, y0 + 0.03, y1 - 0.03, x1 - 0.007, z, step, size, mat, 1, 'y', lod)


def beam_ends(ms, f, x0, x1, y, z, step=0.06, face=-1):
    """The ends of the roof beams projecting from a wall face just under the parapet."""
    n = max(2, int((x1 - x0) / step))
    for k in range(n):
        ms.box('timber', (0.012, 0.03, 0.012), at=(x0 + (x1 - x0) * (k + 0.5) / n, y + face * 0.012, z), lod=0, frame=f)


def glazed_panel(ms, f, x0, x1, y, z0, z1, face=-1, rosettes=True, bands=2, lod=1):
    """A wall face in blue glazed brick with ochre bands and, on each band, a row of plain pale
    rosettes (discs): the Processional Way's palette without its beasts."""
    w = x1 - x0
    cx = (x0 + x1) / 2
    ms.box('msc_glaze', (w, 0.008, z1 - z0), at=(cx, y + face * 0.004, z0), lod=lod, frame=f)
    for k in range(bands):
        zb = z0 + (z1 - z0) * (k + 1) / (bands + 1)
        ms.box('msc_glaze_band', (w, 0.01, 0.018), at=(cx, y + face * 0.006, zb - 0.009), lod=0, frame=f)
        if rosettes:
            n = max(2, int(w / 0.045))
            for i in range(n):
                px = x0 + w * (i + 0.5) / n
                ms.cyl('msc_rosette', 0.007, 0.007, 0.004, at=(px, y + face * 0.011, zb), rot=(90, 0, 0), segs=6, lod=0, frame=f)


def glazed_side(ms, f, y0, y1, x, z0, z1, face=-1, bands=2, lod=1):
    """glazed_panel on a side face (along y at x)."""
    sf = f @ Matrix.Translation(Vector((x, (y0 + y1) / 2, 0))) @ Matrix.Rotation(math.radians(90 if face > 0 else -90), 4, 'Z')
    glazed_panel(ms, sf, -(y1 - y0) / 2, (y1 - y0) / 2, 0, z0, z1, face=-1, bands=bands, lod=lod)


# ---- houses -------------------------------------------------------------------------------------

def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, side=None, garden=True, **_):
    """The Babylonian courtyard house: the Bronze kit's court house, then baked-brick door frame and
    footing, roof beam ends along the street front, stepped merlons on the parapets of the better
    houses and, on the rich ones, a roof garden with a palm and shrubs in planters."""
    f = mb.court_house(ms, rng, x, y, w, d, yaw=yaw, rich=rich, side=side, upper=rich)
    W, D, m = w / 2, d / 2, 0.012
    h = 0.3 if rich else 0.28
    beam_ends(ms, f, -W + m + 0.02, W - m - 0.02, -D + m, G + h * 0.92 - 0.02)
    if rich or rng.random() < 0.45:
        stepped_merlons(ms, f, -W + m, W - m, -D + m + 0.007, G + h * 0.92 + 0.026, mat='msb_baked')
    if rich and garden:  # (garden=False: the battle builds' lighter rich house, inside the damage budget)
        bd = max(0.13, 0.3 * d)
        top2 = G + h + 0.22
        yb = D - m - bd
        merlon_rim(ms, f, -W + m + 0.02, W - m - 0.02, yb + 0.005, D - m, top2 + 0.026, step=0.06, mat='msb_baked')
        # the roof garden on the front range: planters with shrubs and a small palm
        for k, px in enumerate((-W * 0.5, W * 0.5)):
            ms.box('msb_baked', (0.08, 0.06, 0.03), at=(px, -D + m + 0.06, G + h * 0.92), lod=0, frame=f)
            ms.sphere('leaf', 0.04, at=(px, -D + m + 0.06, G + h * 0.92 + 0.05), scale=(1.2, 1, 0.8), u=6, v=4, lod=0, frame=f)
    return f


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, reed=False, **_):
    return mb.poor_house(ms, rng, x, y, w, d, yaw=yaw, side=side, reed=reed)


def mesopotamia_house(ms, rng, slot):
    """One house from a slot dict (x, y, w, d, kind and options; options the Classical damage and
    battle-skin builds pass for other kits are ignored)."""
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    if kind == 'poor':
        return poor_house(ms, rng, x, y, w, d, **s)
    return court_house(ms, rng, x, y, w, d, rich=(kind == 'rich'), **{k: v for k, v in s.items() if k in ('yaw', 'side', 'garden')})


# ---- landmark 1: the great ziggurat --------------------------------------------------------------

def ziggurat(ms, rng, x, y, w=1.45, d=1.35, h=1.2, yaw=None):
    """Etemenanki (about 91 m square and as high, here fitted to its spot): five battered stages of
    baked brick with bitumen bands and buttresses on the lowest, each set back evenly all round, one
    long straight stair up the front to the third stage, the high shrine on the top faced in blue
    glazed brick under stepped merlons, two team banners. `h` is the banner tops."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    sd = 0.2 * d
    fy0 = -D + sd
    hs = h / 1.2
    hts = [0.24, 0.17, 0.14, 0.12, 0.1]
    z = G - 0.004
    x0, x1, y0, y1 = -W, W, fy0, D
    tops = []
    for i, ht in enumerate(hts):
        z = mb._tier(ms, f, x0, x1, y0, y1, z, ht * hs + (0.004 if i == 0 else 0), taper=0.95, bands=i < 3)
        tops.append((x0, x1, y0, y1, z))
        if i == 0:
            mb._buttresses(ms, f, x0 + 0.04, x1 - 0.04, y0 + 0.006, G, ht * hs * 0.9, step=0.085, face=-1)
            for sx in (-1, 1):
                mb._side_buttresses(ms, f, y0 + 0.04, y1 - 0.04, sx * (W - 0.006), G, ht * hs * 0.9, step=0.09, face=sx)
        dx, dy = (x1 - x0) * 0.1, (y1 - y0) * 0.1
        x0, x1, y0, y1 = x0 + dx, x1 - dx, y0 + dy, y1 - dy
    # the shrine: blue glazed brick, stepped merlons, a tall door, banners
    sx0, sx1, sy0, sy1 = x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02
    zs = z
    shh = 0.14 * hs
    block(ms, f, sx0, sx1, sy0, sy1, zs, shh, wall='msc_glaze', lod=2, parapet=0.0)
    merlon_rim(ms, f, sx0, sx1, sy0, sy1, zs + shh, step=0.045, size=0.022, mat='msc_glaze')
    ms.box('msc_glaze_band', (sx1 - sx0 + 0.004, sy1 - sy0 + 0.004, 0.012), at=(0, (sy0 + sy1) / 2, zs + shh * 0.62), lod=0, frame=f)
    ms.box('dark', (0.045, 0.01, shh * 0.6), at=(0, sy0 - 0.003, zs), lod=1, frame=f)
    pole_h = max(0.06, h - (zs + shh - G) - 0.006)
    for px in (sx0 + 0.015, sx1 - 0.015):
        ms.cyl('timber', 0.006, 0.005, pole_h, at=(px, sy0 - 0.01, zs), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, px, sy0 - 0.01, zs + pole_h - 0.004, yaw=-120 if px < 0 else -60, w=0.09, h=0.06)
    # the stair: straight up the front from the ground to the third stage's top
    zt = tops[2][4]
    ty = tops[2][2]
    cw = max(0.12, 0.12 * w)
    n = 16
    for k in range(n):
        yy0 = -D + (ty - (-D)) * k / n
        ms.box('msb_baked', (cw, (ty + D) / n + 0.002, (zt - G) * (k + 1) / n), at=(0, yy0 + (ty + D) / n / 2, G - 0.004), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((0, (ty - D) / 2, (G + zt) / 2))) @ Matrix.Rotation(math.atan2(zt - G, ty + D), 4, 'X')
    obox(ms, 'msb_baked', (cw, math.hypot(ty + D, zt - G), 0.02), at=(0, 0, -0.01), frame=pf, lod=2, only=(1, 2))
    for sx in (-1, 1):
        ms.box('msb_baked', (0.02, fy0 + D, (tops[0][4] - G) * 0.6), at=(sx * (cw / 2 + 0.01), (-D + fy0) / 2, G - 0.004), lod=1, frame=f)
        ms.box('msb_baked', (0.045, 0.045, 0.08 * hs), at=(sx * (cw / 2 + 0.03), ty + 0.02, zt), lod=1, frame=f)  # piers at the landing
    jar(ms, f, -cw / 2 - 0.07, -D + 0.03, 1.1)
    jar(ms, f, cw / 2 + 0.07, -D + 0.02, 1.0)
    return f


# ---- landmark 2: the temple with glazed gate towers -------------------------------------------

def temple(ms, rng, x, y, w=1.3, d=1.05, h=1.0, yaw=None, palms=True):
    """Esagila (the temple of the city god): a long temple of baked brick on a low platform, its
    walls buttressed under stepped merlons, a gate of two tall towers in the long front faced in blue
    glazed brick with ochre bands and rows of plain rosettes, team banners above, a court with an
    altar before the door, palms at the platform's front corners. `h` is the banner tops."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.0
    ph = 0.06 * hs
    sd = 0.12 * d
    ty0 = -D + sd
    zp = mb._tier(ms, f, -W, W, ty0, D, G - 0.004, ph + 0.004, taper=0.98, bands=False)
    for k in range(4):
        ms.box('msb_baked', (0.24, sd / 4 + 0.002, (zp - G) * (k + 1) / 4), at=(0, -D + sd * (k + 0.5) / 4, G - 0.004), lod=0, frame=f)
    obox(ms, 'msb_baked', (0.24, sd, (zp - G) * 0.55), at=(0, -D + sd / 2, G - 0.004), frame=f, lod=2, only=(1, 2))
    rect(ms, f, 'msb_baked', -W + 0.02, W - 0.02, ty0 + 0.02, D - 0.02, zp, 0.004, lod=1)
    # the temple block
    cx0, cx1 = -W * 0.86, W * 0.86
    cy0, cy1 = ty0 + 0.3 * (D - ty0), D - 0.05 * d
    ch = 0.4 * hs
    block(ms, f, cx0, cx1, cy0, cy1, zp, ch, wall='msb_baked', lod=2, parapet=0.0)
    merlon_rim(ms, f, cx0, cx1, cy0, cy1, zp + ch, step=0.055, size=0.026)
    mb._buttresses(ms, f, cx0 + 0.03, cx1 - 0.03, cy0, zp, ch * 0.95, step=0.07, face=-1)
    for sx in (-1, 1):
        mb._side_buttresses(ms, f, cy0 + 0.03, cy1 - 0.03, cx0 if sx < 0 else cx1, zp, ch * 0.95, step=0.07, face=sx)
    # the glazed gate towers
    gw, gd = 0.16, 0.12
    gh = ch * 1.35
    for sx in (-1, 1):
        gx = sx * 0.15
        block(ms, f, gx - gw / 2, gx + gw / 2, cy0 - gd, cy0 + 0.02, zp, gh, wall='msc_glaze', lod=2, parapet=0.0)
        glazed_panel(ms, f, gx - gw / 2, gx + gw / 2, cy0 - gd, zp + 0.02, zp + gh - 0.02, face=-1, bands=2, lod=1)
        merlon_rim(ms, f, gx - gw / 2, gx + gw / 2, cy0 - gd, cy0 + 0.02, zp + gh, step=0.04, size=0.022, mat='msc_glaze')
    ms.box('msc_glaze', (0.14, gd - 0.02, ch * 0.95), at=(0, cy0 - gd / 2 + 0.01, zp), lod=1, frame=f)  # the gate passage's wall
    ms.box('dark', (0.08, 0.01, ch * 0.7), at=(0, cy0 - gd + 0.006, zp), lod=1, frame=f)
    ms.box('msc_glaze_band', (0.1, 0.012, 0.016), at=(0, cy0 - gd + 0.004, zp + ch * 0.7), lod=0, frame=f)
    pole_h = max(0.06, h - (zp - G + gh) - 0.01)
    for sx in (-1, 1):
        gx = sx * 0.15
        ms.cyl('timber', 0.006, 0.005, pole_h, at=(gx, cy0 - gd / 2, zp + gh), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, gx, cy0 - gd / 2, zp + gh + pole_h - 0.004, yaw=-120 if sx < 0 else -60, w=0.1, h=0.065)
    ms.box('msb_baked', (0.12, 0.06, 0.05), at=(0, cy0 - gd - 0.12, zp), lod=0, frame=f)  # the altar
    jar(ms, f, -0.12, cy0 - gd - 0.1, 0.9, z=zp)
    jar(ms, f, 0.12, cy0 - gd - 0.11, 0.8, z=zp)
    if palms:
        for sx in (-1, 1):
            palm(ms, rng, sx * (W - 0.09), ty0 + 0.08, h=min(0.5, h * 0.5), fronds=7, lod=1, z=zp, frame=f)
    return f


def town_gate(ms, rng, x, y, yaw=0.0, width=0.26, h=0.62):
    """The big town's gate (the Ishtar Gate's look): twin towers faced in blue glazed brick with
    ochre bands and rosette rows under stepped merlons, an arched passage, team banners, stubs of
    the town wall either side."""
    f = tm.house_frame(x, y, yaw)
    tw = 0.22
    for sx in (-1, 1):
        cx = sx * (width / 2 + tw / 2)
        block(ms, f, cx - tw / 2, cx + tw / 2, -0.13, 0.13, G, h, wall='msc_glaze', lod=2, parapet=0.0)
        glazed_panel(ms, f, cx - tw / 2, cx + tw / 2, -0.13, G + 0.02, G + h - 0.02, face=-1, bands=3, lod=1)
        merlon_rim(ms, f, cx - tw / 2, cx + tw / 2, -0.13, 0.13, G + h, step=0.045, size=0.026, mat='msc_glaze')
        rect(ms, f, 'msb_brick', cx + sx * tw / 2, cx + sx * (tw / 2 + 0.36), -0.05, 0.05, G, 0.26, lod=1)
        stepped_merlons(ms, f, min(cx + sx * tw / 2, cx + sx * (tw / 2 + 0.36)), max(cx + sx * tw / 2, cx + sx * (tw / 2 + 0.36)),
                        -0.043, G + 0.26, mat='msb_brick')
        ms.cyl('timber', 0.008, 0.006, 0.16, at=(cx, 0, G + h), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, cx, 0, G + h + 0.155, yaw=-120 if sx < 0 else -60, w=0.16, h=0.1)
    ms.box('msc_glaze', (width + 0.02, 0.22, h * 0.32), at=(0, 0, G + h * 0.6), lod=2, frame=f)
    glazed_panel(ms, f, -width / 2, width / 2, -0.11, G + h * 0.6, G + h * 0.92, face=-1, bands=1, lod=1)
    mb.arch_solid(ms, 'dark', f @ Matrix.Translation(Vector((0, 0, 0))), -0.112, -0.108, width / 2 - 0.01, h * 0.58, z0=G, n=6, lod=1)
    rect(ms, f, 'msb_bitumen', -width / 2, width / 2, -0.18, 0.18, G - 0.004, 0.008, lod=1)


# ---- the shared file's palaces and walls (shared-classical-mesopotamia.glb) ----------------------

def residence(ms, rng):
    """`palace-small` (8 m): a governor's residence: a two-storey baked-brick house round a small
    court with stepped merlons, a glazed blue door surround with an ochre band, a team awning, a
    roof garden with a palm."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.38, 0.36
    footing(ms, f, -W, W, -D, D, lod=1)
    top = block(ms, f, -W, W, -D, D, G, 0.34, wall='msb_baked', lod=2, parapet=0.0)
    merlon_rim(ms, f, -W, W, -D, D, top, step=0.05, size=0.026)
    top2 = block(ms, f, -W + 0.02, W * 0.15, 0.0, D - 0.02, top, 0.24, wall='msb_plaster', lod=2, parapet=0.0)
    merlon_rim(ms, f, -W + 0.02, W * 0.15, 0.0, D - 0.02, top2, step=0.05, size=0.022)
    glazed_panel(ms, f, -0.1, 0.1, -D, G + 0.01, G + 0.3, face=-1, bands=1, lod=1)
    door(ms, f, 0, -D - 0.006, G, w=0.07, h=0.18, frame='msc_glaze_band')
    beam_ends(ms, f, -W + 0.03, W - 0.03, -D, G + 0.3)
    af = f @ Matrix.Translation(Vector((0, -D - 0.05, G + 0.22))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('team_cloth', (0.18, 0.1, 0.008), at=(0, 0, 0), lod=1, frame=af)
    for sx in (-0.08, 0.08):
        ms.box('timber', (0.008, 0.008, 0.2), at=(sx, -D - 0.095, G), lod=0, frame=f)
    palm(ms, rng, W * 0.55, -D * 0.4, h=0.32, fronds=7, lod=1, z=top)
    ms.box('msb_baked', (0.12, 0.08, 0.03), at=(W * 0.55, -D * 0.4, top), lod=0, frame=f)
    ms.cyl('timber', 0.006, 0.005, 0.26, at=(-W + 0.06, 0.05, top2), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, -W + 0.06, 0.05, top2 + 0.255, yaw=-130, w=0.14, h=0.09)


def throne_palace(ms, rng):
    """`palace` (12 m): Nebuchadnezzar's Southern Palace in small: a court behind a towered gate,
    the throne room across the back with its whole front faced in blue glazed brick (ochre bands,
    rosette rows, a stylised palm-column frieze of pale panels), stepped merlons all round, team
    banners on the gate."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.6, 0.54
    wh, t = 0.32, 0.06
    footing(ms, f, -W, W, -D, D, lod=1)
    block(ms, f, -W, W, -D, -D + t, G, wh, wall='msb_baked', lod=2, parapet=0.0)
    block(ms, f, -W, -W + t, -D + t, D, G, wh, wall='msb_baked', lod=2, parapet=0.0)
    block(ms, f, W - t, W, -D + t, D, G, wh, wall='msb_baked', lod=2, parapet=0.0)
    for (a, b, c, e) in ((-W, W, -D, -D + t), (-W, -W + t, -D + t, D), (W - t, W, -D + t, D)):
        merlon_rim(ms, f, a, b, c, e, G + wh, step=0.06, size=0.026)
    mb._buttresses(ms, f, -W + 0.03, W - 0.03, -D, G, wh * 0.92, step=0.08, face=-1)
    hy0, hy1 = D - 0.34, D
    hh = 0.6
    block(ms, f, -W, W, hy0, hy1, G, hh, wall='msb_baked', lod=2, parapet=0.0)
    merlon_rim(ms, f, -W, W, hy0, hy1, G + hh, step=0.06, size=0.03)
    glazed_panel(ms, f, -W + t + 0.01, W - t - 0.01, hy0, G + 0.02, G + hh - 0.04, face=-1, bands=2, lod=1)
    for k in range(4):  # the pale palm-column panels of the throne room's front
        px = -0.36 + 0.24 * k
        ms.box('msc_rosette', (0.03, 0.012, hh * 0.5), at=(px, hy0 - 0.012, G + hh * 0.2), lod=0, frame=f)
    ms.box('dark', (0.11, 0.012, 0.3), at=(0, hy0 - 0.012, G), lod=1, frame=f)
    # the gate towers in the front range
    gw, gh = 0.16, 0.52
    for sx in (-1, 1):
        gx = sx * 0.14
        block(ms, f, gx - gw / 2, gx + gw / 2, -D - 0.06, -D + t + 0.03, G, gh, wall='msc_glaze', lod=2, parapet=0.0)
        glazed_panel(ms, f, gx - gw / 2, gx + gw / 2, -D - 0.06, G + 0.02, G + gh - 0.02, face=-1, bands=2, lod=1)
        merlon_rim(ms, f, gx - gw / 2, gx + gw / 2, -D - 0.06, -D + t + 0.03, G + gh, step=0.04, size=0.024, mat='msc_glaze')
        ms.cyl('timber', 0.007, 0.006, 0.4, at=(gx, -D - 0.015, G + gh), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, gx, -D - 0.015, G + gh + 0.395, yaw=-120 if sx < 0 else -60, w=0.17, h=0.11)
    ms.box('dark', (0.1, 0.01, 0.28), at=(0, -D - 0.062, G), lod=1, frame=f)
    rect(ms, f, 'msb_baked', -W + t, W - t, -D + t, hy0, G, 0.004, lod=1)
    palm(ms, rng, -0.32, -0.08, h=0.5, fronds=8, lod=1)
    palm(ms, rng, 0.34, -0.12, h=0.46, fronds=7, lod=1)


def _walls(R_out, R_in, H, gate_x, towers=(), buttresses=(), tower_size=0.5, tower_h=None, gate_towers=(0.5, 0.7), flag=None):
    import ti_bronze as tb

    def build(ms, rng):
        tb.mud_wall_ring(ms, rng, R_out=R_out, R_in=R_in, H=H, gate_x=gate_x, band=('msc_glaze', 0.12), buttresses=buttresses,
                         towers=towers, tower_size=tower_size, tower_h=tower_h, gate_towers=gate_towers, gate_flag=flag,
                         straps=True, mat='msb_brick', banners=True, n=(128, 48, 32), planks=False)
    return build


WALL_RAISE = 1.3
walls_small = _walls(2.22, 2.04, 0.38 * WALL_RAISE, 0.2, buttresses=(30, 150, 210, 330), gate_towers=(0.42, 0.52 * WALL_RAISE))
walls_medium = _walls(3.2, 2.96, 0.48 * WALL_RAISE, 0.25, towers=(30, 90, 150, 210, 330), tower_size=0.5,
                      tower_h=0.62 * WALL_RAISE, gate_towers=(0.56, 0.7 * WALL_RAISE))
walls_big = _walls(4.3, 3.97, 0.6 * WALL_RAISE, 0.3, towers=(0, 45, 90, 135, 180, 222, 318), tower_size=0.66,
                   tower_h=0.8 * WALL_RAISE, gate_towers=(0.7, 0.88 * WALL_RAISE), flag=1.4)
