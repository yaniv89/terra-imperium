# scripts/blender/build_city_classical.py
# The Classical city kit for the battle (plans/ART-MODELS-PLAN.md section 6; src/assets/battle/city/
# README.md), four files in the Classical town kit's stuff so a besieged Classical city matches its
# town on the map:
#   walls-classical.glb  the wall kit of build_city_bronze.py (wall-straight, wall-corner, tower,
#                        gate-open, gate-closed; each -damaged and -breached) in limestone ashlar
#                        with a marble band (Classical ashlar curtain walls, plan section 6)
#   ruins-classical.glb  rubble-s, rubble-m, rubble-l (plaster and ashlar, broken roof tiles),
#                        beams, scorch
#   fort-classical.glb   fort: a stone castellum in a 50 m circle (ashlar ring, corner towers, a
#                        gatehouse) round a barrack block, a granary, a tower, tents and a standard
#   civic-classical.glb  keep, keep-damaged, keep-ruined: the Classical town hall (the basilica hall
#                        of rts-classical.glb in its walled court) as the city's hall in a siege
# The shapes are the Bronze builders' (build_city_bronze.py, build_rts_bronze.py), their materials
# swapped (`remat`); one 1024 atlas per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_classical.py -- <out_dir> [walls,ruins,fort,civic]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_classical as tc  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from ti_town import G  # noqa: E402

WALL_MATS = {'brick': 'ashlar', 'limewash': 'marble'}
RUIN_MATS = {'mudwall': 'ashlar', 'mudwall_bare': 'cream', 'reed': 'tile', 'brick': 'ashlar'}
remat = rc.remat


def as_items(make):
    """build_city_bronze's (name, layout, ground) items with the Classical materials."""
    return [(n, remat(fn, WALL_MATS if 'wall' in n or 'gate' in n or 'tower' in n else RUIN_MATS), g) for n, fn, g in make()]


def shifted(layout):
    """Run a G-based layout (the town kit's parts) and move it down by G: no ground plate, nothing below Z = 0."""
    def build(ms, rng):
        out = layout(ms, rng)
        for bm, _m, _l, _o in ms.parts:
            bmesh.ops.translate(bm, vec=(0, 0, -G), verts=bm.verts)
            for v in bm.verts:  # footings and heaps that reached under the town ground sit on it
                if v.co.z < 0.0:
                    v.co.z = 0.0
        return out
    return build


# ---- the fort -------------------------------------------------------------------------------------

def fort(ms, rng):
    """`fort` (50 m circle): an ashlar ring with merlons, four corner towers and a gatehouse at the
    south round a tiled barrack block, a buttressed granary, a watch tower, two tent lines, a well
    and the standard."""
    tb.mud_wall_ring(ms, rng, R_out=2.2, R_in=2.04, H=0.36 * tb.WALL_RAISE, gate_x=0.2, band=('ashlar', 0.06),
                     towers=(45, 135, 225, 315), tower_size=0.4, tower_h=0.52 * tb.WALL_RAISE, gate_towers=(0.42, 0.56 * tb.WALL_RAISE),
                     n=(72, 36, 24), mat='ashlar')
    tc.roman_house(ms, rng, -0.55, 0.9, 1.1, 0.36, yaw=0, rise=0.12, h=0.34)
    tc.roman_house(ms, rng, 0.75, 0.55, 0.5, 0.36, yaw=-90, rise=0.12, h=0.38)
    ms.box('ashlar', (0.34, 0.34, 0.8), at=(0.95, -0.6, G), lod=2, bevel=0.004)  # the watch tower
    ms.box('dark', (0.03, 0.012, 0.09), at=(0.95, -0.775, G + 0.5), lod=0)
    tc.hip_roof(ms, tm.house_frame(0.95, -0.6, 0), 0.34, 0.34, G + 0.8, 0.14, over=0.05, curl=0.0, ornaments=False)
    for x, y in [(-1.0, 0.1), (-1.0, -0.45), (-0.55, -0.85)]:
        tb.tent(ms, x, y, w=0.22, d=0.32, h=0.2, yaw=90)
    tt.well(ms, 0.2, -0.2)
    ms.cyl('timber', 0.014, 0.011, 0.8, at=(-0.2, -0.5, G), segs=6, lod=1)
    tt.pennant(ms, rb.WORLD, -0.2, -0.5, G + 0.795, yaw=-150, lod=2, w=0.22, h=0.14)
    for k in range(4):
        tt.jar(ms, rb.WORLD, 0.55 + 0.06 * k, 0.2 + 0.03 * (k % 2), 1.2)


# ---- the civic hall -------------------------------------------------------------------------------

def ruined(layout):
    """`keep-ruined`: the same compound burnt out: everything above about 1.5 m gone, the stubs left,
    heaps of its plaster and stone, fallen roof tiles and charred beams. Same origin and footprint."""
    def build(ms, rng):
        sockets = layout(ms, rng)
        keep = []
        bodies = []
        for bm, mat, lod, only in ms.parts:
            xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
            z0, z1 = min(zs), max(zs)
            if mat == 'cream' and max(xs) - min(xs) > 0.5 and max(ys) - min(ys) > 0.5:
                if lod == 2:  # the hall's block (one per LOD set): its walls stand as ragged stubs
                    bodies.append((min(xs), max(xs), min(ys), max(ys)))
                bm.free()
                continue
            if mat == 'team_cloth' or z0 > G + 0.16 or (z1 - z0 < 0.05 and z0 > G + 0.04):
                bm.free()
                continue
            cap = G + 0.16 * (0.6 + 0.4 * rng.random())
            for v in bm.verts:
                if v.co.z > cap:
                    v.co.z = cap
            keep.append((bm, mat, lod, only))
        ms.parts[:] = keep
        for x0, x1, y0, y1 in bodies:
            t = 0.045
            for (ax, ay, bx, by) in ((x0, y0, x1, y0), (x1, y0, x1, y1), (x1, y1, x0, y1), (x0, y1, x0, y0)):
                n = 4
                for i in range(n):
                    if rng.random() < 0.25:
                        continue  # a gap where the wall fell
                    u0, u1 = i / n, (i + 1) / n
                    cx, cy = ax + (bx - ax) * (u0 + u1) / 2, ay + (by - ay) * (u0 + u1) / 2
                    length = math.hypot(bx - ax, by - ay) / n
                    h = rng.uniform(0.06, 0.26)
                    ms.box('cream', (length + t, t, h), at=(cx, cy, G), rot_z=math.degrees(math.atan2(by - ay, bx - ax)), lod=2 if i % 2 == 0 else 1, bevel=0.003)
        mark = len(ms.parts)  # mounds and the scorch plate are built from Z = 0: lift them onto G
        for k in range(9):
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.1, 0.7)
            cb.mound(ms, rng, math.cos(a) * d, 0.25 + math.sin(a) * d * 0.8, rng.uniform(0.12, 0.24), rng.uniform(0.06, 0.12), mat=rng.choice(['ashlar', 'ashlar', 'tile']))
        for k in range(6):
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.1, 0.6)
            cb.charred_beam(ms, rng, math.cos(a) * d, 0.25 + math.sin(a) * d, 0.0, rng.uniform(0.2, 0.4), rng.uniform(0, 180), lift=0.02)
        cb.scorch_plate(ms, rng, 0, 0.25, 0.55, lod=1)
        for bm, _m, _l, _o in ms.parts[mark:]:
            bmesh.ops.translate(bm, vec=(0, 0, G), verts=bm.verts)
        return sockets
    return build


FILES = {
    'walls-classical': lambda: as_items(cb.wall_items),
    'ruins-classical': lambda: [('rubble-s', remat(cb.rubble(0.8), RUIN_MATS), None), ('rubble-m', remat(cb.rubble(1.4), RUIN_MATS), None),
                                ('rubble-l', remat(cb.rubble(2.4), RUIN_MATS), None), ('beams', remat(cb.beams, RUIN_MATS), None), ('scorch', cb.scorch, None)],
    'fort-classical': lambda: [('fort', shifted(fort), None)],
    'civic-classical': lambda: [('keep', shifted(rc.town_hall), None), ('keep-damaged', shifted(remat(rb.damaged(rc.town_hall), rc.DAMAGE_MATS)), None),
                                ('keep-ruined', shifted(ruined(rc.town_hall)), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-classical')
    only = [n if n.endswith('-classical') else n + '-classical' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6200 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
