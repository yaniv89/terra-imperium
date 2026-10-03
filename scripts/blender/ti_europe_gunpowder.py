# scripts/blender/ti_europe_gunpowder.py
# The Gunpowder Age Europe kit (plans/art-image-spec.md section 3b; sheets in
# plans/art/kits/europe/gunpowder/): a town is layout x kit, so these towns stand on the base
# Gunpowder layouts (build_town_gunpowder_<size>_<v>.py) with the kit's buildings on their spots:
# - houses (houses.png, street.png, roofscape.png): the poor brick cottage under a terracotta
#   gable with a dormer and green shutters, the common narrow brick house over a sandstone ground
#   floor under a slate mansard with dormers and iron balconies, the rich stucco house with a
#   rusticated ground floor, a pedimented door, railings and a slate mansard;
# - landmark-1, the Baroque church (cream stucco, a volute front, a copper dome on a drum);
# - landmark-2, the arcaded town hall (brick over a sandstone arcade, a slate mansard with
#   dormers, a clock cupola with a slate pyramid, team banners in the arcade);
# - landmark-colonies, the New England clapboard church with its front steeple, for the lands of
#   European settlement (the US, Canada, Australia, New Zealand), whose houses are white
#   clapboard cottages and houses beside Georgian brick ones.
# The windmills, bastions, stalls, wells, lamps and trees of the layouts stay as they are.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_gunpowder as gp  # noqa: E402
from ti_town import G  # noqa: E402

NEW = ['gp_clapboard', 'gp_copper', 'gp_trim']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    tm.mat_simple('gp_clapboard', ['#dcd9d0', '#ebe8e1', '#cfccc2'], scale=10.0, bump=0.5,
                  stripes={'dir': 'Z', 'scale': 160.0, 'distortion': 0.5}, dirt=True)
    tm.mat_simple('gp_copper', ['#4d6a64', '#5e7c74', '#6c7f78', '#55665f'], scale=16.0, rough=0.5, metal=0.2, bump=0.2,
                  stripes={'dir': 'Z', 'scale': 30.0, 'distortion': 1.0})
    tm.mat_simple('gp_trim', ['#e9e6de', '#f2f0ea'], scale=14.0, bump=0.1)


if not any(n == 'europe-gunpowder' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('europe-gunpowder', make_materials))

ORIG_HOUSE = gp.gp_house
ORIG_DOMED = gp.domed_church
KIT = {'mode': 'europe', 'max_storeys': 3, 'replace': {}, 'used': set()}


# ---- houses -------------------------------------------------------------------------------------

def _slots(w):
    n = max(1, int(round(w / 0.19)))
    return [-w / 2 + w * (i + 0.5) / n for i in range(n)]


def _door_x(w):
    s = _slots(w)
    return s[len(s) // 2]


def _railing(ms, f, w, d, door_x, gap=0.08):
    """Wrought-iron railings along the front with a gap at the door."""
    y = -d / 2 - 0.085
    for a, b in ((-w / 2 + 0.03, door_x - gap), (door_x + gap, w / 2 - 0.03)):
        if b - a > 0.04:
            ms.box('gp_iron', (b - a, 0.006, 0.05), at=((a + b) / 2, y, G), lod=0, frame=f)
            for px in (a, b):
                ms.box('gp_iron', (0.012, 0.012, 0.065), at=(px, y, G), lod=0, frame=f)


def _balconies(ms, f, w, d, z):
    for wx in _slots(w):
        ms.box('gp_iron', (0.075, 0.024, 0.03), at=(wx, -d / 2 - 0.012, z), lod=0, frame=f)


def _ground_floor(ms, f, w, d, sh):
    """A rusticated sandstone ground floor (the common and rich houses)."""
    ms.box('gp_sandstone', (w + 0.004, d + 0.004, sh), at=(0, 0, G), lod=1, frame=f)


def kit_house(ms, rng, x, y, w, d, yaw=None, awning=None, typ=None, **_ignored):
    """One of the kit's three houses on a layout's spot, picked by the spot's size (and the rng)."""
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
        typ = 'poor' if area < 0.3 or r < 0.2 else ('rich' if area >= 0.47 or r > 0.82 else 'common')
    st = min(3, KIT['max_storeys'])
    props, pots = rng.randint(1, 3), rng.randint(0, 2)
    colonies = KIT['mode'] == 'colonies'
    if typ == 'poor':
        f = ORIG_HOUSE(ms, rng, x, y, w, d, yaw=yaw, wall='gp_clapboard' if colonies else 'gp_brick',
                       roof='gp_slate' if colonies else 'gp_tile', kind='gable', storeys=1, h=0.38, rise=0.25,
                       shutters='gp_shutter', chimneys=1, dormers=0, awning=awning, props=props, pots=pots)
        gp.dormer(ms, f, 0.0, -d / 2 + 0.06, G + 0.37, w=0.08, h=0.09, mat='gp_slate' if colonies else 'gp_tile',
                  cheek='gp_clapboard' if colonies else 'gp_brick')
        return f
    if typ == 'common':
        if colonies:  # a two-storey clapboard house under a side gable, chimneys at both ends
            return ORIG_HOUSE(ms, rng, x, y, w, d, yaw=yaw, wall='gp_clapboard', roof='gp_slate', kind='gable', storeys=2,
                              rise=0.2, shutters='gp_shutter', chimneys=2, awning=awning, props=props, pots=pots)
        h = gp.HOUSE_H[st]
        dx = _door_x(w)
        f = ORIG_HOUSE(ms, rng, x, y, w, d, yaw=yaw, wall='gp_brick', roof='gp_slate', kind='mansard', storeys=st, h=h,
                       rise=0.08, shutters=None, chimneys=2, dormers=2, awning=awning, props=props, pots=pots, door_x=dx)
        _ground_floor(ms, f, w, d, h / st)
        _balconies(ms, f, w, d, G + h / st + h / st * 0.28)
        _railing(ms, f, w, d, dx)
        return f
    # rich
    h = gp.HOUSE_H[st] + (0.04 if st > 2 else 0.0)
    dx = _door_x(w)
    wall = 'gp_brick' if colonies else 'gp_stucco'
    kind = 'hip' if colonies or rng.random() < 0.3 else 'mansard'
    f = ORIG_HOUSE(ms, rng, x, y, w, d, yaw=yaw, wall=wall, roof='gp_slate', kind=kind, storeys=st, h=h,
                   rise=0.08 if kind == 'mansard' else 0.2, shutters='gp_shutter' if colonies else None, chimneys=2,
                   dormers=3 if w > 0.7 else 2, awning=awning, props=0, pots=0, door_x=dx)
    if not colonies:
        _ground_floor(ms, f, w, d, h / st)
        _balconies(ms, f, w, d, G + h / st + h / st * 0.28)
    F = gp.faces_of(f, w, d)[0][0]
    gp.pediment(ms, F, dx, -0.012, G + min(0.2, h / st * 0.72) + 0.06, 0.13, 0.035, depth=0.02, lod=0)
    for k in range(3):
        ms.box('gp_sandstone', (0.16 - 0.03 * k, 0.03, 0.01 * (3 - k)), at=(dx, -d / 2 - 0.045 + 0.02 * k, G), lod=0, frame=f)
    _railing(ms, f, w, d, dx)
    for sx in (-1, 1):
        gp.flower_pot(ms, f, dx + sx * 0.1, -d / 2 - 0.05)
    return f


def kit_styled(ms, rng, x, y, w, d, yaw=None, palette='a', storeys=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


def kit_gp_house(ms, rng, x, y, w, d, yaw=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


# ---- landmark 2: the arcaded town hall ---------------------------------------------------------

def arcaded_hall(ms, rng, x, y, w, d, top, yaw=0, storeys=3, tw=0.3, h=None, **_ignored):
    """The arcaded town hall: a sandstone arcade on the ground floor with team banners, brick
    upper floors with sandstone dressings, a slate mansard with dormers and iron cresting, and
    a clock cupola with a slate pyramid and a finial reaching `top`."""
    st = storeys
    h = h or gp.HOUSE_H[st]
    sh = h / st
    f = ORIG_HOUSE(ms, rng, x, y, w, d, yaw=yaw, wall='gp_brick', roof='gp_slate', kind='mansard', storeys=st, h=h,
                   shutters=None, chimneys=2, dormers=max(3, int(w / 0.22)), door=False, props=0, rise=0.08)
    ms.box('gp_sandstone', (w + 0.02, d + 0.02, sh), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_sandstone', (w + 0.03, d + 0.03, 0.022), at=(0, 0, G + sh - 0.01), lod=0, frame=f)
    n = max(3, int(round(w / 0.2)))
    if n % 2 == 0:
        n += 1
    aw = w / n * 0.66
    for side, (F, length, nm) in enumerate(gp.faces_of(f, w, d)):
        if nm == 'back':
            continue
        k_n = n if nm == 'front' else max(1, int(round(length / 0.2)))
        for i in range(k_n):
            ax = -length / 2 + length * (i + 0.5) / k_n
            pts = gp.arch_outline(aw, sh * 0.45, aw * 0.42, 6)
            gp.slab(ms, 'dark', [(px + ax, pz + G) for px, pz in pts], 0.012, f=F @ gp._t(0, -0.022, 0), lod=1)
            if nm == 'front':
                ms.box('door' if i == n // 2 else 'gp_window', (aw * 0.6, 0.006, sh * 0.48), at=(ax, -0.024, G), lod=0, frame=F)
                ms.box('bronze', (0.02, 0.02, 0.03), at=(ax, -0.03, G + sh * 0.62), lod=0, frame=F)
        if nm == 'front':
            for i in (1, n - 2):
                bx = -length / 2 + length * (i + 1) / n
                ms.box('team_cloth', (0.035, 0.006, sh * 0.62), at=(bx, -0.03, G + sh * 0.3), lod=1, frame=F)
                ms.box('gp_iron', (0.006, 0.05, 0.006), at=(bx, -0.03, G + sh * 0.92), lod=0, frame=F)
    zb = G + h + 0.15
    ms.box('gp_iron', (w * 0.5, 0.008, 0.03), at=(0, 0, zb + 0.07), lod=0, frame=f)
    for sx in (-1, 1):
        ms.cyl('gp_iron', 0.006, 0.002, 0.07, at=(sx * w * 0.25, 0, zb + 0.07), segs=4, lod=0, frame=f)
    z0 = zb - 0.06
    gp.clock_tower(ms, f @ gp._t(0, 0, z0 - G), top - (z0 - G), w=tw, body='gp_sandstone', cap='gp_slate', shaft=0.42,
                   door=False, bulb=False)
    return f


# ---- landmark 1: the Baroque church -------------------------------------------------------------

def baroque_church(ms, rng, x, y, top, w=0.62, length=1.0, yaw=0, **_ignored):
    """The Baroque church: the domed church with a copper dome and scrolled volutes either side
    of its front gable."""
    w = min(w, 0.8)
    length = min(length, 1.3)
    f = ORIG_DOMED(ms, rng, x, y, top, w=w, length=length, yaw=yaw, dome_mat='gp_copper')
    s = top - G
    fh = s * 0.3 + s * 0.08
    fw = w + 0.06
    fy = -length / 2
    for sx in (-1, 1):
        ms.cyl('gp_sandstone', 0.04, 0.04, 0.07, at=(sx * fw * 0.36, fy + 0.07, G + fh + 0.04), rot=(90, 0, 0), segs=10, lod=0, frame=f)
        ms.box('gp_sandstone', (fw * 0.14, 0.07, 0.05), at=(sx * fw * 0.28, fy + 0.035, G + fh), lod=1, frame=f)
    return f


# ---- the colonies' landmark: the clapboard church ----------------------------------------------

def clapboard_church(ms, rng, x, y, top, w=0.55, length=1.0, yaw=0, **_ignored):
    """The New England meeting house: a stone foundation, white clapboard walls with corner
    boards and tall sash windows, a grey slate gable, a pedimented door with steps, and a front
    steeple (a clapboard base, a louvred belfry, a lantern stage and a white spire to `top`)."""
    w = min(max(w * 0.8, 0.46), 0.62)
    length = min(max(length * 0.85, 0.8), 1.1)
    f = tm.house_frame(x, y, yaw)
    s = top - G
    eave = s * 0.3
    rise = w * 0.42
    ms.box('gp_scarp', (w + 0.02, length + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_clapboard', (w, length, eave), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('gp_trim', (0.026, 0.026, eave), at=(sx * (w / 2 - 0.01), sy * (length / 2 - 0.01), G), lod=0, frame=f)
    ms.box('gp_trim', (w + 0.02, length + 0.02, 0.02), at=(0, 0, G + eave - 0.02), lod=1, frame=f)
    gp.gable(ms, f @ gp._rz(90), length, w, G + eave, rise, mat='gp_slate', wall='gp_clapboard', over=0.03)
    for sx in (-1, 1):
        F = f @ gp._rz(sx * 90) @ gp._t(0, -w / 2, 0)
        for k in range(4):
            gp.window(ms, F, sx * (-length * 0.3 + k * length * 0.2 + 0.06), G + eave * 0.3, ww=0.06, wh=eave * 0.45, glass_lod=1)
    F = f @ gp._t(0, -length / 2, 0)
    for sx in (-1, 1):
        gp.window(ms, F, sx * w * 0.32, G + eave * 0.3, ww=0.06, wh=eave * 0.45, glass_lod=1)
    gp.window(ms, gp.faces_of(f, w, length)[1][0], 0, G + eave * 0.3, ww=0.06, wh=eave * 0.45, glass_lod=1)
    # the steeple, half set into the front
    tw = w * 0.42
    ty = -length / 2 + tw * 0.3
    tf = f @ gp._t(0, ty, 0)
    z1 = G + eave + rise + 0.04
    ms.box('gp_clapboard', (tw, tw, z1 - G), at=(0, 0, G), lod=2, frame=tf)
    TF = gp.faces_of(tf, tw, tw)[0][0]
    ms.box('door', (0.09, 0.012, 0.18), at=(0, -0.004, G + 0.05), lod=1, frame=TF)
    gp.pediment(ms, TF, 0, -0.012, G + 0.25, 0.14, 0.04, depth=0.02, lod=0)
    for sx in (-1, 1):
        ms.box('gp_trim', (0.02, 0.016, 0.2), at=(sx * 0.06, -0.006, G + 0.05), lod=0, frame=TF)
    gp.window(ms, TF, 0, G + eave + 0.02, ww=0.05, wh=0.1, glass_lod=1)
    for k in range(4):
        ms.box('gp_scarp', (0.2 - 0.03 * k, 0.035, 0.012 * (4 - k)), at=(0, ty - tw / 2 - 0.05 + 0.025 * k, G), lod=0, frame=f)
    ms.box('gp_trim', (tw + 0.03, tw + 0.03, 0.025), at=(0, 0, z1), lod=1, frame=tf)
    bw = tw * 0.82
    bh = s * 0.11
    z2 = z1 + 0.025
    ms.box('gp_clapboard', (bw, bw, bh), at=(0, 0, z2), lod=2, frame=tf)
    for F2, _l, _n in gp.faces_of(tf, bw, bw):
        gp.slab(ms, 'dark', [(px, pz + z2 + bh * 0.15) for px, pz in gp.arch_outline(bw * 0.45, bh * 0.45, bw * 0.2, 6)], 0.008,
                f=F2 @ gp._t(0, -0.004, 0), lod=1)
        for k in range(4):
            ms.box('gp_trim', (bw * 0.45, 0.006, 0.006), at=(0, -0.006, z2 + bh * (0.25 + 0.13 * k)), lod=0, frame=F2)
    ms.box('gp_trim', (bw + 0.03, bw + 0.03, 0.02), at=(0, 0, z2 + bh), lod=1, frame=tf)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('gp_trim', 0.01, 0.004, 0.05, at=(sx * bw * 0.45, sy * bw * 0.45, z2 + bh + 0.02), segs=4, lod=0, frame=tf)
    lw = bw * 0.72
    z3 = z2 + bh + 0.02
    lh = s * 0.06
    ms.cyl('gp_clapboard', lw * 0.6, lw * 0.6, lh, at=(0, 0, z3), segs=8, rot=(0, 0, 22.5), lod=1, frame=tf)
    ms.cyl('gp_trim', lw * 0.6, 0.006, top - z3 - lh - 0.02, at=(0, 0, z3 + lh), segs=8, rot=(0, 0, 22.5), lod=2, frame=tf)
    ms.sphere('bronze', 0.016, at=(0, 0, top - 0.016), u=6, v=4, lod=0, frame=tf)
    ms.cyl('gp_iron', 0.004, 0.004, 0.02, at=(0, 0, top - 0.04), segs=4, lod=0, frame=tf)
    # a stone path to the door
    gp.flat(ms, 'gp_gravel', [(-0.05, ty - tw / 2 - 0.06), (0.05, ty - tw / 2 - 0.06), (0.05, ty - tw / 2 - 0.3),
                              (-0.05, ty - tw / 2 - 0.3)], G + 0.003, lod=0, f=f)
    return f


# ---- applying the kit to a base layout ----------------------------------------------------------

def apply(mode='europe', max_storeys=3, replace=None):
    """Swap the base layout's house and landmark builders for the kit's: houses on every spot,
    the arcaded hall for the town hall, the Baroque church (or, for the colonies, the clapboard
    church) for the churches. `replace` maps a house spot (x, y) to a builder fn(ms, rng) or None
    (to leave it empty)."""
    KIT['mode'] = mode
    KIT['max_storeys'] = max_storeys
    KIT['replace'] = {(round(x, 3), round(y, 3)): fn for (x, y), fn in (replace or {}).items()}
    KIT['used'] = set()
    gp.styled = kit_styled
    gp.gp_house = kit_gp_house
    gp.town_hall = arcaded_hall
    church = clapboard_church if mode == 'colonies' else baroque_church
    gp.domed_church = church
    gp.twin_church = church


def main(base_name, layout, ground, max_storeys=3, replace=None):
    """Build `<base_name>-<mode>.glb` (its object keeps the layout's name) with the kit applied.
    argv: <out_dir> [atlas_px] [europe|colonies]. `replace(mode)` gives apply()'s replace map."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    mode = argv[2] if len(argv) > 2 else 'europe'
    apply(mode, max_storeys, replace(mode) if replace else None)
    tt.build_file('%s-%s' % (base_name, mode), [(base_name, layout, ground)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
