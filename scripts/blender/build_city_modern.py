# scripts/blender/build_city_modern.py
# The Modern city kit for the battle (plans/ART-MODELS-PLAN.md section 6; src/assets/battle/city/
# README.md), four files in the Modern town kit's stuff (ti_modern.py, ti_modern_battle.py) so a besieged
# city of the age matches its town on the map:
#   walls-modern.glb  the wall kit (wall-straight, wall-corner, tower, gate-open, gate-closed; each
#                     -damaged and -breached; the pieces' sizes and origins of build_city_bronze.py) in
#                     concrete and wire: precast T-wall slabs on a footing with concertina wire on posts
#                     along the top and sandbags on the inner step; a concrete guard tower on a bunker
#                     foot; a gateway of two pillboxes with a sliding steel mesh gate and a barrier arm.
#                     Damaged: slabs knocked askew and fallen, wire cut; breached: the slabs down in a
#                     heap of concrete through the gap.
#   ruins-modern.glb  rubble-s, rubble-m, rubble-l (concrete, render, brick, corrugated sheet), beams, scorch
#   fort-modern.glb   fort: a bunker line in the 50 m circle: ti_modern's earth berm with a trench, barbed
#                     wire and four pillboxes round a command bunker, prefab barrack huts, a radio mast,
#                     two sandbagged gun pits and the flag
#   civic-modern.glb  keep, keep-damaged, keep-ruined: the headquarters of rts-modern.glb (a three-storey
#                     rendered block behind its wall); ruined, its walls stand as stubs
# One 1024 atlas per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_modern.py -- <out_dir> [walls,ruins,fort,civic]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import build_rts_modern as rg  # noqa: E402 (patches ti_classical's house and tree first)
import ti_modern as tmd  # noqa: E402
import ti_modern_battle as mb  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_city_classical as cc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
from ti_town import G  # noqa: E402

H = cb.H      # 5 m: the slabs' top
T = cb.T      # the footprint's thickness (the footing)
RUIN_MATS = {'mudwall': 'md_concrete', 'mudwall_bare': 'md_render', 'reed': 'md_corrugated', 'brick': 'md_brick', 'limewash': 'md_concrete'}


def remat(layout, mapping=None):
    return rc.remat(layout, mapping or rg.MATS)


# ---- wall pieces ------------------------------------------------------------------------------------

def slab(ms, f, x, w, h, lean=0.0, fallen=False, lod=2, only=None):
    """One precast T-wall slab centred at x (local), its face to -Y: a thin tall panel on a footing."""
    if fallen:  # lying on its face in front of the line
        ff = f @ Matrix.Translation(Vector((x, -0.08, 0))) @ Matrix.Rotation(math.radians(rb_rand(x) * 20 - 10), 4, 'Z')
        ms.box('md_concrete', (w - 0.01, h * 0.9, 0.05), at=(0, -h * 0.3, 0), lod=1, frame=ff)
        return
    sf = f @ Matrix.Translation(Vector((x, 0, 0))) @ Matrix.Rotation(math.radians(lean), 4, 'X')
    ms.box('md_concrete', (w - 0.008, 0.18, 0.05), at=(0, 0.02, 0), lod=lod, frame=sf)
    ms.box('md_concrete', (w - 0.008, 0.05, h), at=(0, 0, 0.05), lod=lod, frame=sf, taper=0.97)


def rb_rand(x):
    return (math.sin(x * 91.7) + 1) / 2


def wire_run(ms, f, x0, x1, z, lod=0):
    """Concertina wire on short posts: a zigzag of thin strands along the top."""
    n = max(2, int((x1 - x0) / 0.1))
    for i in range(n):
        a, b = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
        p0 = f @ Vector((a, -0.02, z + (0.035 if i % 2 else 0.0)))
        p1 = f @ Vector((b, 0.02, z + (0.0 if i % 2 else 0.035)))
        tmd.rod(ms, 'md_wire', tuple(p0), tuple(p1), 0.004, segs=3, lod=lod)
    for i in range(0, n + 1, 3):
        x = x0 + (x1 - x0) * i / n
        p0 = f @ Vector((x, 0, z - 0.03)); p1 = f @ Vector((x, 0, z + 0.05))
        tmd.rod(ms, 'md_steel', tuple(p0), tuple(p1), 0.005, segs=3, lod=0)


def wall_run(ms, rng, x0, x1, state, frame=None, far=True):
    """A run of T-wall slabs from x0 to x1 (local x), wire along the top, sandbags on the inner side;
    `state` 0 whole, 1 damaged (slabs askew and one fallen, the wire cut), 2 breached (the middle down)."""
    f = frame if frame is not None else Matrix.Identity(4)
    n = max(2, int(round((x1 - x0) / 0.125)))
    w = (x1 - x0) / n
    # LOD2: one plain block (two stubs when breached)
    if state < 2:
        tmd.obox(ms, 'md_concrete', (x1 - x0, 0.06, H), at=((x0 + x1) / 2, 0, 0), lod=2, only=(2,), frame=f)
    else:
        for a, b in ((x0, x0 + (x1 - x0) * 0.35), (x0 + (x1 - x0) * 0.65, x1)):
            tmd.obox(ms, 'md_concrete', (b - a, 0.06, H), at=((a + b) / 2, 0, 0), lod=2, only=(2,), frame=f)
    gone = set()
    if state == 2:
        gone = {i for i in range(n) if 0.3 < (i + 0.5) / n < 0.7}
    fallen = set()
    if state == 1:
        fallen = {rng.randrange(1, n - 1)}
    for i in range(n):
        x = x0 + (i + 0.5) * w
        if i in gone:
            if rng.random() < 0.6:
                slab(ms, f, x, w, H, fallen=True)
            continue
        lean = 0.0
        if state == 1 and rng.random() < 0.35:
            lean = rng.uniform(-9, 9)
        slab(ms, f, x, w, H, lean=lean, fallen=i in fallen, lod=1, only=None)
    # the inner step of sandbags and the wire on top
    if state == 0:
        wire_run(ms, f, x0 + 0.02, x1 - 0.02, H + 0.05)
        _bags(ms, f, x0 + 0.03, x1 - 0.03)
    elif state == 1:
        wire_run(ms, f, x0 + 0.02, x0 + (x1 - x0) * 0.4, H + 0.05)
        wire_run(ms, f, x0 + (x1 - x0) * 0.62, x1 - 0.02, H + 0.05)
        _bags(ms, f, x0 + 0.03, x1 - 0.03)
    if state >= 1:
        for k in range(3 if state == 1 else 2):  # cracks on the outer face
            x = rng.uniform(x0 + 0.1, x1 - 0.1)
            ms.box('dark', (0.01, 0.006, rng.uniform(0.08, 0.2)), at=(x, -0.03, rng.uniform(0.1, 0.25)), lod=0, frame=f)
        cx = (x0 + x1) / 2
        if state == 1:
            cb.mound(ms, rng, cx + rng.uniform(-0.25, 0.25), -0.14, 0.12, 0.05, mat='md_concrete', frame=f, far=False)
            cb.bricks(ms, rng, cx, -0.16, 0.3, 8, mat='md_concrete', frame=f)
        else:
            cb.mound(ms, rng, cx, -0.04, 0.3, 0.1, mat='md_concrete', frame=f, far=far)
            cb.mound(ms, rng, cx - 0.12, 0.14, 0.14, 0.06, mat='md_sandbag', frame=f, far=False)
            cb.bricks(ms, rng, cx, -0.18, 0.4, 12, mat='md_concrete', frame=f)
            for k in range(3):  # bent rebar sticking out of the heap
                p = f @ Vector((cx + rng.uniform(-0.2, 0.2), rng.uniform(-0.1, 0.05), 0.04))
                tmd.rod(ms, 'md_pipe', tuple(p), (p.x + rng.uniform(-0.05, 0.05), p.y + rng.uniform(-0.05, 0.05), p.z + 0.12), 0.004, segs=3, lod=0)


def _bags(ms, f, x0, x1):
    p0 = f @ Vector((x0, 0.13, 0)); p1 = f @ Vector((x1, 0.13, 0))
    mb.sandbag_wall(ms, p0.x, p0.y, p1.x, p1.y, h=0.08, t=0.08, lod=1, z=0.0)


def wall_straight(state):
    def build(ms, rng):
        wall_run(ms, rng, -0.5, 0.5, state)
    return build


def wall_corner(state):
    """A corner: two half-length arms meeting at the origin (one along +x, one along +y), the outer
    faces outward (-Y and -X), a cast concrete block at the angle."""
    def build(ms, rng):
        wall_run(ms, rng, T / 2 - 0.05, 0.5, state, far=state < 2)
        wall_run(ms, rng, -0.5, -T / 2 + 0.05, state, frame=Matrix.Rotation(math.radians(-90), 4, 'Z'), far=False)
        h = H + 0.04 if state == 0 else H * (0.85 if state == 1 else 0.4)
        ms.box('md_concrete', (T, T, h), at=(0, 0, 0), lod=2, bevel=0.006)
    return build


def guard_tower(ms, rng, state, f=None):
    """A concrete guard tower 6 x 6 m: a bunker foot with slits, a square shaft, a cab with slit windows
    under a flat roof, a searchlight and a pennant pole (whole); the cab broken or the shaft a stub."""
    f = f if f is not None else Matrix.Identity(4)
    ms.box('md_bunker', (0.58, 0.55, 0.22), at=(0, 0, 0), lod=2, frame=f, bevel=0.012, taper=0.95)
    for k in range(4):
        a = k * math.pi / 2
        ms.box('dark', (0.2, 0.012, 0.035), at=(math.sin(a) * 0.29, -math.cos(a) * 0.278, 0.12), rot_z=math.degrees(a), lod=0, frame=f)
    if state == 2:
        ms.box('md_bunker', (0.3, 0.3, 0.22), at=(0, 0.05, 0.22), lod=1, frame=f)
        for k in range(4):
            cb.mound(ms, rng, rng.uniform(-0.3, 0.3), rng.uniform(-0.5, -0.3), 0.14, 0.06, mat='md_concrete', frame=f, far=k == 0)
        cb.bricks(ms, rng, 0, -0.45, 0.4, 12, mat='md_concrete', frame=f)
        return
    ms.box('md_bunker', (0.3, 0.3, 0.45), at=(0, 0.05, 0.22), lod=2, frame=f, taper=0.94)
    zc = 0.67
    ms.box('md_concrete', (0.46, 0.46, 0.03), at=(0, 0.05, zc), lod=2, frame=f)
    if state == 0:
        ms.box('md_concrete', (0.42, 0.42, 0.15), at=(0, 0.05, zc + 0.03), lod=2, frame=f, bevel=0.006)
        for k in range(4):
            a = k * math.pi / 2
            ms.box('dark', (0.28, 0.012, 0.04), at=(math.sin(a) * 0.212, 0.05 - math.cos(a) * 0.212, zc + 0.1), rot_z=math.degrees(a), lod=0, frame=f)
        ms.box('md_concrete', (0.48, 0.48, 0.03), at=(0, 0.05, zc + 0.18), lod=1, frame=f)
        p = f @ Vector((0.12, -0.08, 0))
        mb.searchlight(ms, p.x, p.y, zc + 0.21)
        ms.cyl('md_steel', 0.008, 0.006, 0.35, at=(-0.15, 0.2, zc + 0.21), segs=4, lod=1)
        q = f @ Vector((-0.15, 0.2, 0))
        tt.pennant(ms, rb.WORLD, q.x, q.y, zc + 0.55, yaw=-150, lod=1, w=0.16, h=0.1)
    else:
        for k, (x, y) in enumerate(((-0.17, -0.12), (0.17, -0.12), (0.17, 0.22))):
            ms.box('md_concrete', (0.06, 0.06, rng.uniform(0.06, 0.13)), at=(x, y, zc + 0.03), lod=1, frame=f)
        for k in range(2):
            ms.box('dark', (0.014, 0.006, 0.16), at=(rng.uniform(-0.1, 0.1), -0.1, rng.uniform(0.3, 0.5)), lod=0, frame=f)
        cb.mound(ms, rng, 0.15, -0.42, 0.14, 0.05, mat='md_concrete', frame=f)
        cb.bricks(ms, rng, 0, -0.45, 0.3, 8, mat='md_concrete', frame=f)


def tower(state):
    def build(ms, rng):
        guard_tower(ms, rng, state)
    return build


def gate(state, open_):
    """A gateway 10 m wide: two concrete pillboxes flanking a 4 m opening, a steel mesh sliding gate
    (slid aside when open), a barrier arm, sandbags and a team banner on the pillboxes."""
    def build(ms, rng):
        gw = 0.4
        tw = (1.0 - gw) / 2
        th = 0.42 if state == 0 else 0.36 if state == 1 else 0.18
        for sx in (-1, 1):
            f = tm.house_frame(sx * (gw / 2 + tw / 2), 0, 0)
            ms.box('md_bunker', (tw, T + 0.08, th), at=(0, 0, 0), lod=2, frame=f, bevel=0.01, taper=0.96)
            if state < 2:
                ms.box('md_bunker', (tw + 0.02, T + 0.1, 0.04), at=(0, 0, th), lod=1, frame=f)
                ms.box('dark', (tw * 0.5, 0.012, 0.035), at=(0, -(T + 0.08) / 2 - 0.004, th * 0.55), lod=0, frame=f)
                if state == 0:
                    ms.box('team_cloth', (tw * 0.4, 0.006, th * 0.4), at=(0, -(T + 0.08) / 2 - 0.006, th * 0.08), lod=1, frame=f)
                    wire_run(ms, f, -tw / 2 + 0.02, tw / 2 - 0.02, th + 0.06)
        if state < 2:
            gh = H * 0.7
            if open_:
                for sx in (-1, 1):  # the mesh leaves slid behind the pillboxes
                    ms.box('md_steel', (gw / 2, 0.02, gh), at=(sx * (gw / 2 + gw / 4), 0.2, 0), lod=1)
                    ms.box('md_mesh', (gw / 2 - 0.02, 0.012, gh - 0.04), at=(sx * (gw / 2 + gw / 4), 0.2, 0.02), lod=0)
                ms.box('md_steel', (0.02, 0.02, 0.1), at=(-gw / 2 + 0.03, -0.1, 0), lod=1)
                bf = Matrix.Translation(Vector((-gw / 2 + 0.03, -0.1, 0.09))) @ Matrix.Rotation(math.radians(70), 4, 'Y')
                ms.box('md_marking', (0.012, 0.012, gw * 0.9), at=(0, 0, 0), lod=1, frame=bf)
            else:
                for sx in (-1, 1):
                    ms.box('md_steel', (gw / 2 - 0.004, 0.025, gh), at=(sx * gw / 4, 0.0, 0), lod=1)
                    ms.box('md_mesh', (gw / 2 - 0.03, 0.014, gh - 0.05), at=(sx * gw / 4, -0.002, 0.025), lod=0)
                wire_run(ms, Matrix.Identity(4), -gw / 2, gw / 2, gh + 0.02)
                ms.box('md_marking', (gw * 0.95, 0.012, 0.012), at=(0, -0.14, 0.1), lod=1)
                if state == 1:
                    ms.box('ash', (0.12, 0.03, 0.1), at=(0.05, -0.015, 0.05), lod=0)
        else:
            cb.mound(ms, rng, 0.0, -0.05, 0.34, 0.12, mat='md_concrete')
            cb.bricks(ms, rng, 0.0, -0.3, 0.45, 12, mat='md_concrete')
            ms.box('md_steel', (gw / 2, 0.02, 0.2), at=(-0.12, -0.3, 0.0), rot_z=70, lod=1)
            ms.box('md_mesh', (gw / 2, 0.01, 0.2), at=(0.1, -0.25, 0.0), rot_z=-50, lod=0)
        if state == 1:
            cb.mound(ms, rng, 0.38, -0.28, 0.1, 0.04, mat='md_concrete')
            cb.bricks(ms, rng, 0.3, -0.3, 0.2, 6, mat='md_concrete')
    return build


def wall_items():
    items = []
    for base, make in (('wall-straight', wall_straight), ('wall-corner', wall_corner), ('tower', tower)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, remat(make(state), RUIN_MATS), None))
    for base, open_ in (('gate-open', True), ('gate-closed', False)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, remat(gate(state, open_), RUIN_MATS), None))
    return items


# ---- the fort -------------------------------------------------------------------------------------

def fort(ms, rng):
    """`fort` (50 m circle): a bunker line: a grassed earth berm with a crest trench, barbed wire and
    four pillboxes round a sunken command bunker with a radio mast, two prefab barrack huts, two
    sandbagged gun pits, a parked lorry and the flag."""
    tmd.earthwork_ring(ms, rng, 1.95, 2.35, G + 0.15 * tb_raise(), 0.5, (45, 135, 225, 315), 0.26, 0.22 * tb_raise(), trench=True, n=(96, 28, 16), post_step=0.45)
    f = tm.house_frame(0.0, 0.55, 0)
    ms.box('md_turf', (0.9, 0.6, 0.12), at=(0, 0, G), lod=2, frame=f, taper=0.8)
    ms.box('md_bunker', (0.6, 0.4, 0.16), at=(0, -0.05, G), lod=2, frame=f, bevel=0.01)
    ms.box('dark', (0.3, 0.012, 0.04), at=(0, -0.256, G + 0.08), lod=0, frame=f)
    ms.box('dark', (0.12, 0.012, 0.12), at=(0.2, -0.256, G), lod=0, frame=f)
    mb.lattice_mast(ms, 0.32, 0.72, h=0.9, w=0.05)
    tmd.prefab(ms, -0.95, 0.1, 0.32, 0.7, wall_h=0.26, rise=0.05, ridge_y=True)
    tmd.prefab(ms, 0.95, 0.1, 0.32, 0.7, wall_h=0.26, rise=0.05, ridge_y=True)
    mb.gun_pit(ms, -0.6, -0.75, r=0.2, gun='aa')
    mb.gun_pit(ms, 0.6, -0.75, r=0.2, gun='aa')
    mb.truck(ms, 0.3, -0.2, yaw=200)
    mb.crates(ms, -0.35, -0.25)
    ms.cyl('md_steel', 0.012, 0.009, 0.8, at=(-0.2, -0.5, G), segs=6, lod=1)
    tt.pennant(ms, rb.WORLD, -0.2, -0.5, G + 0.795, yaw=-150, lod=2, w=0.22, h=0.14)


def tb_raise():
    import ti_bronze as tb
    return tb.WALL_RAISE


def fort_budgeted(ms, rng):
    """The fort within its budget: the far level (LOD2) decimated to the improvement budget (300)."""
    import build_improvement_fort_classical as fc  # noqa: E402
    fort(ms, rng)
    fc.trim(ms, 1, 1300)
    fc.trim(ms, 2, 220)


def hall_for_ruin(ms, rng):
    """The headquarters with its block walls named cream, so build_city_classical.ruined finds them."""
    out = rg.town_hall(ms, rng)
    ms.parts[:] = [(bm, 'cream' if mat in ('md_render_win', 'md_render') else mat, lod, only) for bm, mat, lod, only in ms.parts]
    return out


FILES = {
    'walls-modern': wall_items,
    'ruins-modern': lambda: [('rubble-s', remat(cb.rubble(0.8), RUIN_MATS), None), ('rubble-m', remat(cb.rubble(1.4), RUIN_MATS), None),
                             ('rubble-l', remat(cb.rubble(2.4), RUIN_MATS), None), ('beams', remat(cb.beams, RUIN_MATS), None), ('scorch', cb.scorch, None)],
    'fort-modern': lambda: [('fort', cc.shifted(remat(fort_budgeted)), None)],
    'civic-modern': lambda: [('keep', cc.shifted(remat(rg.town_hall)), None),
                             ('keep-damaged', cc.shifted(remat(rb.damaged(rg.town_hall), rg.DAMAGE_MATS)), None),
                             ('keep-ruined', cc.shifted(remat(cc.ruined(hall_for_ruin), {**rg.DAMAGE_MATS, 'cream': 'md_render_win'})), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-modern')
    only = [n if n.endswith('-modern') else n + '-modern' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6600 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
