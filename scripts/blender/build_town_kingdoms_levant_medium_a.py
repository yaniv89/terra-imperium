# scripts/blender/build_town_kingdoms_levant_medium_a.py
# Kingdoms Age `town-medium-a` in the Levant kit (art spec 3b; plans/art/kits/levant/kingdoms/): the
# layout of build_town_kingdoms_medium_a.py (a 60 m town: the cathedral at the north-west, a big house at the north-east), recorded below call by call (copied from
# build_town_kingdoms_europe_medium_a.py), built with ti_levant_kingdoms.py: mud-brick yard houses,
# plastered courtyard houses with wind catchers and rich houses with tiled portals chosen by plot
# size, grey flagstone lanes on sandy ground, palms, and the mosque in the cathedral's spot, the caravanserai gate in the big house's.
#
#   python scripts/blender/build_town_kingdoms_levant_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_kingdoms as lk  # noqa: E402

NAME = 'town-medium-a'
FILE = 'kingdoms-town-medium-a-levant'
SIZE = 'medium'
GROUND = {'n': 80, 'rx': 3.0, 'ry': 3.0, 'square': 0.62}
# call index -> the kit piece standing there: 'mosque', 'gate', 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {2: ('mosque', dict(x=-1.85, y=2.0, s=0.6)), 3: ('gate', dict(x=1.9, y=2.1, s=0.7))}

# (function, positional args, keyword args) of the base layout, in its order
CALLS = [   ('street', [((0.25, -0.64), (0.25, -2.8)), 0.7], {}),
    ('street', [((0.15, 0.64), (0.15, 2.8)), 0.36], {}),
    ('cathedral', [-2.05, 2.0], {'s': 0.85, 'top': 1.8, 'transept': True, 'yaw': 0}),
    (   'town_house',
        [2.0, 2.2, 1.1, 0.8],
        {'barrels': 3, 'chimneys': 2, 'dormer': True, 'gable_front': False, 'sign': True, 'storeys': 2, 'yaw': 0}),
    ('town_house', [1.2, 2.45, 0.5, 0.62], {'chimneys': 1, 'gable_front': True, 'roof': 'slate', 'storeys': 1, 'yaw': 0}),
    ('town_house', [-0.75, 2.4, 0.66, 0.6], {'barrels': 2, 'chimneys': 1, 'roof': 'thatch', 'yaw': 0}),
    ('town_house', [-0.3, 1.85, 0.5, 0.5], {'gable_front': True, 'roof': 'slate', 'storeys': 2, 'yaw': 0}),
    ('town_house', [0.62, 2.35, 0.6, 0.6], {'gable_front': True, 'roof': 'thatch', 'yaw': 0}),
    (   'town_house',
        [-2.35, 0.9, 0.86, 0.68],
        {'awning_w': None, 'barrels': 0, 'chimneys': 1, 'gable_front': False, 'roof': 'slate', 'storeys': 2, 'yaw': 90}),
    (   'town_house',
        [-2.35, 0.0, 0.62, 0.68],
        {'awning_w': 0.3, 'barrels': 0, 'chimneys': 2, 'gable_front': True, 'roof': 'slate', 'storeys': 1, 'yaw': 90}),
    (   'town_house',
        [-2.35, -0.9, 0.86, 0.68],
        {'awning_w': None, 'barrels': 2, 'chimneys': 1, 'gable_front': False, 'roof': 'thatch', 'storeys': 1, 'yaw': 90}),
    (   'town_house',
        [-2.35, -1.95, 0.62, 0.68],
        {'awning_w': None, 'barrels': 0, 'chimneys': 2, 'gable_front': True, 'roof': 'slate', 'storeys': 2, 'yaw': 90}),
    ('town_house', [-1.55, 0.45, 0.55, 0.5], {'gable_front': True, 'roof': 'thatch', 'yaw': 90}),
    ('town_house', [-1.55, -0.6, 0.6, 0.52], {'jetty': True, 'roof': 'slate', 'storeys': 2, 'yaw': 90}),
    ('town_house', [-1.25, -2.4, 0.8, 0.66], {'chimneys': 2, 'roof': 'slate', 'sign': True, 'storeys': 2, 'yaw': 180}),
    ('town_house', [-0.55, -2.35, 0.5, 0.6], {'gable_front': True, 'roof': 'slate', 'yaw': 180}),
    ('town_house', [-0.75, -1.7, 0.42, 0.42], {'gable_front': True, 'roof': 'thatch', 'yaw': 180}),
    ('town_house', [1.05, -2.4, 0.66, 0.64], {'gable_front': True, 'roof': 'slate', 'storeys': 2, 'yaw': 180}),
    ('town_house', [1.85, -2.35, 0.7, 0.66], {'barrels': 2, 'chimneys': 1, 'roof': 'slate', 'yaw': 180}),
    ('town_house', [2.4, 1.15, 0.62, 0.66], {'chimneys': 1, 'gable_front': True, 'roof': 'slate', 'storeys': 2, 'yaw': -90}),
    ('town_house', [2.4, 0.25, 0.82, 0.66], {'chimneys': 1, 'gable_front': False, 'roof': 'thatch', 'storeys': 1, 'yaw': -90}),
    ('town_house', [2.4, -0.65, 0.62, 0.66], {'chimneys': 1, 'gable_front': True, 'roof': 'slate', 'storeys': 2, 'yaw': -90}),
    ('town_house', [2.4, -1.5, 0.82, 0.66], {'chimneys': 1, 'gable_front': False, 'roof': 'slate', 'storeys': 1, 'yaw': -90}),
    ('market_stall', [1.62, 1.0], {'d': 0.34, 'w': 0.42, 'yaw': -90}),
    ('market_stall', [1.62, 0.45], {'d': 0.34, 'w': 0.42, 'yaw': -90}),
    ('market_stall', [1.62, -0.1], {'d': 0.34, 'w': 0.42, 'yaw': -90}),
    ('market_stall', [1.62, -0.65], {'d': 0.34, 'w': 0.42, 'yaw': -90}),
    ('well', [-0.95, -0.95], {'yaw': 10}),
    ('garden', [-2.65, -1.4, 0.4, 0.3], {'yaw': 90}),
    ('garden', [2.7, -0.2, 0.36, 0.3], {'yaw': 90}),
    ('garden', [-1.6, 2.75, 0.4, 0.26], {}),
    ('wattle_fence', [((-2.9, -2.9), (-1.7, -2.9))], {'h': 0.08, 'lod': 0, 'step': 0.25}),
    ('wattle_fence', [((0.65, -2.9), (2.9, -2.9), (2.9, -2.0))], {'h': 0.08, 'lod': 0, 'step': 0.25}),
    ('wattle_fence', [((2.9, 0.65), (2.9, 1.7))], {'h': 0.08, 'lod': 0, 'step': 0.25}),
    ('tree', [-2.888, 2.795], {'h': 0.386, 'lod2': False, 'r': 0.15}),
    ('tree', [-2.88, 1.247], {'h': 0.487, 'lod2': False, 'r': 0.163}),
    ('tree', [-1.372, 2.864], {'h': 0.416, 'lod2': False, 'r': 0.153}),
    ('tree', [1.4, 1.712], {'h': 0.393, 'lod2': False, 'r': 0.151}),
    ('tree', [2.822, 2.82], {'h': 0.381, 'lod2': False, 'r': 0.167}),
    ('tree', [2.812, -1.035], {'h': 0.396, 'lod2': False, 'r': 0.166}),
    ('tree', [-2.876, -0.421], {'h': 0.391, 'lod2': False, 'r': 0.162}),
    ('tree', [-1.993, -2.815], {'h': 0.457, 'lod2': False, 'r': 0.162}),
    ('tree', [2.572, -2.899], {'h': 0.418, 'lod2': False, 'r': 0.143}),
    ('tree', [-0.215, -2.885], {'h': 0.414, 'lod2': False, 'r': 0.151}),
    ('tree', [0.741, 1.774], {'h': 0.476, 'lod2': False, 'r': 0.136}),
    ('tree', [-1.181, 1.073], {'h': 0.381, 'lod2': False, 'r': 0.149}),
    ('conifer', [-2.9, 2.0], {'h': 0.504, 'lod2': False}),
    ('conifer', [2.85, 2.0], {'h': 0.51, 'lod2': False}),
    ('conifer', [-0.95, 2.85], {'h': 0.539, 'lod2': False}),
    ('shrub', [-1.1, -1.3], {'lod': 0, 'r': 0.057}),
    ('shrub', [0.75, -1.25], {'lod': 0, 'r': 0.062}),
    ('shrub', [-1.15, 0.85], {'lod': 0, 'r': 0.059}),
    ('shrub', [1.05, 1.25], {'lod': 0, 'r': 0.053}),
    ('shrub', [-0.4, 1.25], {'lod': 0, 'r': 0.065}),
    ('clutter', [-1.8, 1.2, 4], {}),
    ('clutter', [1.95, 1.65, 4], {}),
    ('clutter', [-1.8, -1.35, 4], {}),
    ('clutter', [1.7, -1.9, 4], {}),
    ('woodpile', [-2.7, 0.45, 90], {}),
    ('woodpile', [2.75, 0.75, 90], {})]


def layout(ms, rng):
    lk.replay(ms, rng, CALLS, SIZE, override=OVERRIDE)


if __name__ == '__main__':
    lk.main(FILE, NAME, layout, GROUND)
