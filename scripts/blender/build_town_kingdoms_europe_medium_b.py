# scripts/blender/build_town_kingdoms_europe_medium_b.py
# Kingdoms Age `town-medium-b` in the Europe kit (art spec 3b; plans/art/kits/europe/kingdoms/): the
# layout of build_town_kingdoms_medium_b.py (a 60 m town: the mosque at the north-west with a market before it, market halls at the south-east), recorded below call by call, built
# with ti_europe_kingdoms.py: stone and half-timber town houses, merchant houses with walled
# yards and cottages chosen by plot size, cobbled lanes, stalls, and the Gothic church in the mosque's spot, the stone keep in the big market hall's, a half-timbered market hall in the other.
# build_town_kingdoms_easteurope_medium_b.py builds the same town with the onion-domed church.
#
#   python scripts/blender/build_town_kingdoms_europe_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_europe_kingdoms as ek  # noqa: E402

NAME = 'town-medium-b'
FILE = 'kingdoms-town-medium-b-europe'
SIZE = 'medium'
GROUND = {'n': 80, 'rx': 3.0, 'ry': 3.0, 'square': 0.62}
OVERRIDE = {4: 'church', 21: 'keep'}  # call index -> the kit piece standing there
OVERRIDE_EAST = {4: 'church', 21: 'keep'}

# (function, positional args, keyword args) of the base layout, in its order
CALLS = [   ('street', [((-0.55, -0.75), (-0.55, -2.8)), 0.55], {'mat': 'kg_sand_square'}),
    ('street', [((0.7, 0.75), (1.0, 1.4), (1.0, 2.8)), 0.32], {'mat': 'kg_sand_square'}),
    ('street', [((-0.75, 0.0), (-1.2, -0.1), (-2.8, -0.2)), 0.32], {'mat': 'kg_sand_square'}),
    ('street', [((0.75, -0.2), (2.8, -0.35)), 0.3], {'mat': 'kg_sand_square'}),
    (   'mosque',
        [-1.95, 2.2],
        {   'd': 0.8,
            'dome_r': 0.26,
            'h': 0.5,
            'mat': 'kg_whitewash',
            'minaret_at': (0.6, 0.32),
            'minaret_top': 1.8,
            'minaret_w': 0.24,
            'porch_bays': 4,
            'side_domes': True,
            'w': 0.95,
            'yaw': 0}),
    ('market_stall', [-2.55, 1.15], {'d': 0.36, 'w': 0.42, 'yaw': 0}),
    ('market_stall', [-2.05, 1.15], {'d': 0.36, 'w': 0.42, 'yaw': 0}),
    ('market_stall', [-1.55, 1.15], {'d': 0.36, 'w': 0.42, 'yaw': 0}),
    ('market_stall', [-2.4, 0.55], {'d': 0.36, 'w': 0.42, 'yaw': 0}),
    ('market_stall', [-1.9, 0.55], {'d': 0.36, 'w': 0.42, 'yaw': 0}),
    ('house', [-0.55, 2.55, 0.62, 0.58], {'screen': True, 'two': True, 'yaw': 0}),
    ('house', [0.25, 2.5, 0.66, 0.66], {'tiled': True, 'two': True, 'yaw': 0}),
    ('house', [1.6, 2.55, 0.64, 0.56], {'yaw': 0}),
    ('house', [2.45, 2.45, 0.6, 0.7], {'tiled': True, 'two': True, 'yaw': 0}),
    ('court_house', [-0.05, 1.6, 0.8, 0.7], {'court': 'palm', 'mat': 'kg_ochre', 'yaw': 0}),
    ('house', [1.65, 1.75, 0.6, 0.52], {'screen': True, 'two': True, 'yaw': 0}),
    ('court_house', [2.4, 0.95, 0.9, 0.82], {'court': 'fountain', 'mat': 'kg_whitewash', 'tiled_wing': True, 'yaw': -90}),
    ('house', [1.7, 0.6, 0.5, 0.56], {'tiled': True, 'two': True, 'yaw': -90}),
    ('house', [2.45, -0.05, 0.55, 0.62], {'awning_w': 0.3, 'yaw': -90}),
    ('house', [1.65, -0.85, 0.6, 0.5], {'screen': True, 'two': True, 'yaw': -90}),
    ('house', [2.5, -0.85, 0.5, 0.6], {'yaw': -90}),
    ('arcade_hall', [2.2, -2.05, 1.15, 1.2], {'bays': 4, 'mat': 'kg_ochre', 'rise': 0.32, 'yaw': 0}),
    ('arcade_hall', [0.45, -2.1, 0.95, 0.8], {'bays': 3, 'mat': 'kg_whitewash', 'rise': 0.26, 'yaw': 0}),
    ('stone_wall', [0.95, -1.55, 1.6, -1.55], {'h': 0.16, 'mat': 'kg_ochre', 't': 0.05}),
    ('cypress', [1.25, -1.75], {'h': 0.42, 'lod': 1}),
    ('fountain', [1.3, -2.25], {'r': 0.09}),
    ('court_house', [-2.3, -0.95, 0.8, 0.8], {'court': 'tree', 'mat': 'kg_ochre', 'yaw': 90}),
    ('house', [-1.45, -0.85, 0.5, 0.56], {'screen': True, 'two': True, 'yaw': 90}),
    ('house', [-2.5, -1.95, 0.6, 0.62], {'tiled': True, 'two': True, 'yaw': 90}),
    ('house', [-1.6, -1.75, 0.56, 0.5], {'stair': 1, 'yaw': 90}),
    ('house', [-2.35, -2.65, 0.62, 0.5], {'yaw': 180}),
    ('house', [-1.45, -2.55, 0.58, 0.6], {'screen': True, 'two': True, 'yaw': 180}),
    ('house', [-2.6, 0.0, 0.55, 0.5], {'awning_w': 0.28, 'yaw': 90}),
    ('house', [-1.55, 0.05, 0.42, 0.42], {'yaw': 90}),
    ('well', [0.75, -1.05], {'yaw': 20}),
    ('palm', [-2.818, 2.876], {'h': 0.467, 'lod2': False}),
    ('palm', [-1.014, 2.848], {'h': 0.594, 'lod2': False}),
    ('palm', [0.973, 1.995], {'h': 0.452, 'lod2': False}),
    ('palm', [2.884, 1.643], {'h': 0.499, 'lod2': False}),
    ('palm', [2.863, -1.481], {'h': 0.486, 'lod2': False}),
    ('palm', [-0.938, 1.172], {'h': 0.531, 'lod2': False}),
    ('palm', [0.816, -0.963], {'h': 0.451, 'lod2': False}),
    ('palm', [-2.869, -1.476], {'h': 0.595, 'lod2': False}),
    ('palm', [-0.986, -2.817], {'h': 0.568, 'lod2': False}),
    ('palm', [-0.961, -1.345], {'h': 0.549, 'lod2': False}),
    ('palm', [1.967, 0.02], {'h': 0.567, 'lod2': False}),
    ('palm', [-2.831, 0.556], {'h': 0.464, 'lod2': False}),
    ('palm', [0.191, -2.87], {'h': 0.532, 'lod2': False}),
    ('cypress', [-1.3, 2.85], {'h': 0.397, 'lod': 1}),
    ('cypress', [2.0, 2.0], {'h': 0.369, 'lod': 1}),
    ('cypress', [-2.85, -2.35], {'h': 0.386, 'lod': 1}),
    ('cypress', [1.05, 0.95], {'h': 0.377, 'lod': 1}),
    ('cypress', [-1.1, -0.45], {'h': 0.393, 'lod': 1}),
    ('tree', [0.4, 0.95], {'h': 0.335, 'lod2': False, 'r': 0.091}),
    ('tree', [-1.0, 0.65], {'h': 0.325, 'lod2': False, 'r': 0.09}),
    ('tree', [2.85, 0.35], {'h': 0.344, 'lod2': False, 'r': 0.107}),
    ('clutter', [-1.2, 0.45, 4], {}),
    ('clutter', [1.25, 0.3, 4], {}),
    ('clutter', [-1.0, -1.15, 4], {}),
    ('clutter', [0.25, -1.35, 4], {})]


def layout(ms, rng):
    ek.replay(ms, rng, CALLS, SIZE, override=OVERRIDE)


if __name__ == '__main__':
    ek.main(FILE, NAME, layout, GROUND)
