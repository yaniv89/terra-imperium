# scripts/blender/build_town_kingdoms_europe_small_a.py
# Kingdoms Age `town-small-a` in the Europe kit (art spec 3b; plans/art/kits/europe/kingdoms/): the
# layout of build_town_kingdoms_small_a.py (a European village: half-timbered town houses and cottages round a 40 m square, the church at the north-west), recorded below call by call, built
# with ti_europe_kingdoms.py: stone and half-timber town houses, merchant houses with walled
# yards and cottages chosen by plot size, cobbled lanes, stalls, and the Gothic church in the church's spot.
# build_town_kingdoms_easteurope_small_a.py builds the same town with the onion-domed church.
#
#   python scripts/blender/build_town_kingdoms_europe_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_europe_kingdoms as ek  # noqa: E402

NAME = 'town-small-a'
FILE = 'kingdoms-town-small-a-europe'
SIZE = 'small'
GROUND = {'rx': 2.0, 'ry': 2.0, 'square': 0.6}
OVERRIDE = {}  # call index -> the kit piece standing there
OVERRIDE_EAST = {}

# (function, positional args, keyword args) of the base layout, in its order
CALLS = [   ('paved_strip', [0.0, -0.65, 0.0, -1.95, 0.45], {}),
    ('church', [-0.82, 1.38], {'top': 1.0, 'yaw': 0}),
    ('tudor_house', [0.2, 1.4, 0.92, 0.66], {'chimneys': 2, 'jar_n': 2, 'yaw': 0}),
    ('tudor_house', [1.45, 1.4, 0.72, 0.8], {'hipped': True, 'rise': 0.4, 'roof': 'thatch', 'yaw': 0}),
    ('tudor_house', [-1.45, -0.05, 0.8, 0.66], {'chimneys': 1, 'yaw': 90}),
    ('tudor_house', [-1.4, -1.15, 0.92, 0.74], {'awning_w': 0.36, 'chimneys': 2, 'jar_n': 3, 'yaw': 90}),
    ('tudor_house', [1.48, 0.12, 0.86, 0.66], {'jar_n': 2, 'yaw': -90}),
    ('tudor_house', [1.45, -0.95, 0.6, 0.56], {'rise': 0.28, 'roof': 'thatch', 'yaw': -90}),
    ('well', [1.45, -1.55], {'yaw': 10}),
    ('broadleaf', [-1.4, 1.75], {'h': 0.439, 'r': 0.167}),
    ('broadleaf', [-1.85, 1.3], {'h': 0.385, 'r': 0.162}),
    ('broadleaf', [0.9, 1.85], {'h': 0.417, 'r': 0.136}),
    ('broadleaf', [-1.85, -0.55], {'h': 0.436, 'r': 0.138}),
    ('broadleaf', [1.85, -0.45], {'h': 0.442, 'r': 0.136}),
    ('broadleaf', [0.85, -1.8], {'h': 0.426, 'r': 0.159}),
    ('broadleaf', [-0.8, -1.8], {'h': 0.394, 'r': 0.147}),
    ('broadleaf', [-1.85, 0.75], {'h': 0.457, 'r': 0.138}),
    ('broadleaf', [1.85, 0.8], {'h': 0.44, 'r': 0.164}),
    ('shrub', [-0.85, 0.65], {'r': 0.062}),
    ('shrub', [0.9, -0.5], {'r': 0.062}),
    ('shrub', [-0.8, -0.6], {'r': 0.059}),
    ('shrub', [0.85, 0.75], {'r': 0.069}),
    ('woodpile', [0.85, 1.0, 0], {}),
    ('clutter', [-0.85, -1.2, 3], {})]


def layout(ms, rng):
    ek.replay(ms, rng, CALLS, SIZE, override=OVERRIDE)


if __name__ == '__main__':
    ek.main(FILE, NAME, layout, GROUND)
