# scripts/blender/build_town_bronze_mesopotamia.py
# The six Bronze Age towns of the Mesopotamian kit (audit I215; ti_mesopotamia_bronze.py), one per
# run: `town-<size>-<v>` in bronze-town-<size>-<v>-mesopotamia.glb (the object keeps the base name, so
# the game loads it like every other town file). The house plots are the base layouts'
# (ti_mesopotamia_layout.py), the landmarks stand north of the square (east in two layouts) clear of
# the battle hall's square, and the poor plots on the edges are the marsh reed huts.
#   small-a   the ziggurat                   small-b   the temple on its terrace
#   medium-a  ziggurat north, temple east    medium-b  temple north-west, small ziggurat east
#   big-a     ziggurat north, temple north-west, the mud-brick town gate at the south
#   big-b     temple north, ziggurat east
#
#   blender -b --factory-startup -P scripts/blender/build_town_bronze_mesopotamia.py -- <out_dir> <size> <a|b> [atlas_px]
import os
import random
import zlib
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_mesopotamia_bronze as mb  # noqa: E402
import ti_mesopotamia_layout as ml  # noqa: E402

# (kind, x, y, w, d, h, yaw): units; h is the top of the banner poles above the ground
LAYOUTS = {
    ('small', 'a'): dict(landmarks=[('ziggurat', 0.0, 1.26, 0.95, 0.78, 0.92, 0)], palms=7, huts=3, ovens=2),
    ('small', 'b'): dict(landmarks=[('temple', 0.1, 1.24, 0.92, 0.76, 0.85, 0)], palms=7, huts=3, ovens=2),
    ('medium', 'a'): dict(landmarks=[('ziggurat', 0.25, 1.78, 1.45, 1.25, 1.18, 0), ('temple', 1.95, 0.25, 1.2, 1.0, 1.0, -90)],
                          palms=11, huts=2, ovens=3),
    ('medium', 'b'): dict(landmarks=[('temple', -0.75, 1.72, 1.3, 0.95, 1.05, 0), ('ziggurat', 1.85, 0.55, 1.05, 0.95, 1.0, -90)],
                          palms=11, huts=2, ovens=3),
    ('big', 'a'): dict(landmarks=[('ziggurat', 0.55, 1.95, 1.5, 1.35, 1.2, 0), ('temple', -1.8, 1.55, 1.3, 1.0, 1.0, 0)],
                       gate=(0.0, -3.15), palms=15, huts=3, ovens=4),
    ('big', 'b'): dict(landmarks=[('temple', -0.5, 2.0, 1.45, 1.15, 1.05, 0), ('ziggurat', 2.1, 0.9, 1.4, 1.25, 1.15, -90)],
                       palms=15, huts=3, ovens=4),
}
REED_SHARE = {'small': 0.75, 'medium': 0.6, 'big': 0.55}  # of the poor plots, the reed huts


def town(size, v, kit=mb, seed=None, layouts=None):
    spec = (layouts or LAYOUTS)[(size, v)]
    lms = [(x, y, w, d, h, yaw) for (_k, x, y, w, d, h, yaw) in spec['landmarks']]
    ml.check_hall_clear(size, lms)
    pick = random.Random(seed if seed is not None else zlib.crc32(("%s-%s-meso" % (size, v)).encode()))
    slots, stalls, taken = ml.plan(size, v, lms)
    if spec.get('gate'):
        gx, gy = spec['gate']
        taken.append(ml.Rect(gx, gy, 0, 0.78, 0.18))
        slots = [(s, r) for (s, r) in slots if not r.overlaps(taken[-1], 0.03)]
    slots = ml.fill_houses(pick, size, slots, taken)
    reed = {i: (s['kind'] == 'poor' and pick.random() < spec.get('reed', REED_SHARE[size])) for i, (s, _r) in enumerate(slots)}

    def layout(ms, rng):
        for (kind, x, y, w, d, h, yaw) in spec['landmarks']:
            (kit.ziggurat if kind == 'ziggurat' else kit.temple)(ms, rng, x, y, w=w, d=d, h=h, yaw=yaw)
        if spec.get('gate'):
            kit.town_gate(ms, rng, spec['gate'][0], spec['gate'][1], yaw=0)
        for i, (s, _r) in enumerate(slots):
            slot = dict(s)
            if slot['kind'] == 'poor':
                slot['reed'] = reed[i]
            kit.mesopotamia_house(ms, rng, slot)
        for (x, y) in stalls:
            kit.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.55 else 'msb_reedmat')
        occupied = list(taken)
        well = ml.scatter(pick, size, occupied, 1, radius=0.2, rmin=0.32, rmax=0.6)
        for (x, y) in well:
            kit.shaduf_well(ms, rng, x, y, yaw=pick.uniform(-40, 40))
        for (x, y) in ml.scatter(pick, size, occupied, spec['huts'], radius=0.3, rmin=0.62, rmax=0.84):
            kit.hut_at(ms, rng, x, y, w=pick.uniform(0.4, 0.48), d=pick.uniform(0.5, 0.58))
        for (x, y) in ml.scatter(pick, size, occupied, spec['palms'], radius=0.1, rmin=0.4, rmax=0.88):
            kit.palm_at(ms, rng, x, y)
        for (x, y) in ml.scatter(pick, size, occupied, spec['ovens'], radius=0.07, rmin=0.35, rmax=0.85):
            kit.oven_at(ms, x, y)
        for (x, y) in ml.scatter(pick, size, occupied, 3 if size != 'small' else 2, radius=0.14, rmin=0.6, rmax=0.88):
            kit.bundles_at(ms, rng, x, y, yaw=pick.uniform(0, 180))
        for (x, y) in ml.scatter(pick, size, occupied, 3, radius=0.08, rmin=0.35, rmax=0.8):
            kit.bits_at(ms, rng, x, y, 4)
        if spec.get('noria'):  # later ages: a canal with a water wheel in a gap at the edge
            for (x, y) in ml.scatter(pick, size, occupied, 1, radius=0.34, rmin=0.5, rmax=0.84):
                kit.canal_noria(ms, rng, x, y, yaw=ml.facing(x, y) + 90)
    return layout, len(slots), len(stalls)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir, size, v = argv[0], argv[1], argv[2]
    atlas = int(argv[3]) if len(argv) > 3 else 2048
    layout, n_houses, n_stalls = town(size, v)
    print('houses', n_houses, 'stalls', n_stalls, flush=True)
    g = dict(mb.EARTH_GROUND)
    g.update(ml.GROUND[size])
    tt.build_file('bronze-town-%s-%s-mesopotamia' % (size, v), [('town-%s-%s' % (size, v), layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
