# scripts/blender/build_town_information.py
# The Information map towns (eight-ages plan U89, KTD16): base plus 4 regional kits, small, medium and big, layouts a
# and b: src/assets/map/towns/information-town-<size>-<v>[-<style>].glb, on the Stone town builder's plan
# (build_town_stone.plan: the gate street, the landmark plots, houses packed without overlaps, props) with today's
# kit (ti_information_kit.py) in place of its huts:
#   base    clad apartment blocks with balconies, glass residential towers, villas; an office tower and a stadium
#   europe  brick apartment blocks, villas under dark roofs, glass towers; an office tower and a stadium
#   levant  sand-coloured court blocks with roof terraces and solar panels, towers; a sand tower and a glass mall
#   sinic   glass towers, blocks with red lacquer roofs; a tiered tower and a TV tower
#   indic   ochre apartment blocks, glass towers; an ochre office tower and a TV tower
# Props: parks with trees, car parks with cars, solar arrays, water towers, street lights, containers, cell masts.
# One 1024 atlas per file, LOD0..LOD2 (the far level trimmed to the town budget), Town / Ground / Team.
#   blender -b --factory-startup -P scripts/blender/build_town_information.py -- <style|base> <small|medium|big> <a|b> <out_dir>
import math
import os
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_information_kit as ik  # noqa: E402
import build_town_stone as bs  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

STYLES = ('base', 'europe', 'levant', 'sinic', 'indic')
GROUNDS = {'base': ('earth', ('#8c8f8a', '#999c96', '#a6a9a2', '#82857f')),
           'europe': ('earth', ('#868a82', '#93978e', '#a0a49a', '#7c8078')),
           'levant': ('earth', ('#b6a482', '#c4b290', '#d0c09e', '#aa9876')),
           'sinic': ('earth', ('#888a84', '#95978f', '#a2a49c', '#7e8078')),
           'indic': ('earth', ('#a48a6a', '#b29876', '#bea682', '#988060'))}
WALL = {'base': 'in_panel_win', 'europe': 'in_brick_win', 'levant': 'in_sand_win', 'sinic': 'in_panel_win', 'indic': 'in_ochre_win'}


# ---- houses --------------------------------------------------------------------------------------

def block(ms, rng, x, y, yaw, w=.5, d=.36, storeys=3, wall='in_panel_win', roof=None):
    """An apartment block: a plinth, the facade, balconies on the front, a parapet (or a low pitched `roof`)."""
    f = tm.house_frame(x, y, yaw)
    h = STOREY * storeys
    ms.box('in_plinth', (w + .02, d + .02, .03), at=(0, 0, G), lod=2, frame=f)
    ms.box(wall, (w, d, h), at=(0, 0, G + .03), lod=2, frame=f)
    for k in range(storeys - 1):  # the balconies
        ms.box('in_panel', (w * .8, .04, .01), at=(0, -d / 2 - .02, G + .03 + STOREY * (k + 1)), lod=0, frame=f)
    if roof:
        ms.box(roof, (w + .04, d + .04, .12), at=(0, 0, G + .03 + h), lod=2, frame=f, taper=.45)
    else:
        ms.box('in_panel', (w + .006, d + .006, .02), at=(0, 0, G + .03 + h), lod=1, frame=f)
        if rng.random() < .5:  # rooftop solar
            ms.box('in_solar', (w * .6, d * .5, .01), at=(0, 0, G + .05 + h), lod=0, frame=f)
    return G + .03 + h


def tower(ms, rng, x, y, yaw, w=.32, d=.28, storeys=6, wall='in_panel_win', eaves=None):
    """A residential tower on a glazed lobby podium wider than the tower (the building's base on its plot), its
    spandrel bands, a rooftop crown (or flared lacquer `eaves` on every few storeys)."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_plinth', (w + .10, d + .10, .13), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_glass', (w + .104, .004, .08), at=(0, -(d + .10) / 2 - .002, G + .03), lod=0, frame=f)
    z = G + .13
    h = STOREY * storeys
    ms.box(wall, (w, d, h), at=(0, 0, z), lod=2, frame=f)
    for k in range(1, storeys, 2):
        if eaves:
            ms.box(eaves, (w + .06, d + .06, .02), at=(0, 0, z + STOREY * k), lod=1, frame=f, taper=.85)
        else:
            ms.box('in_panel', (w + .004, d + .004, .008), at=(0, 0, z + STOREY * k), lod=0, frame=f)
    z += h
    ms.box('in_graphite', (w * .6, d * .6, .04), at=(0, 0, z), lod=1, frame=f)
    return z


def villa(ms, rng, x, y, yaw, w=.4, d=.32, roof='in_graphite', wall='in_panel'):
    """A detached house: two storeys under a hipped roof, a glass corner, a car port and a parked car."""
    f = tm.house_frame(x, y, yaw)
    h = STOREY * 2
    ms.box(wall, (w, d, h), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_glass', (w * .4, .004, h * .7), at=(w * .2, -d / 2 - .002, G + .02), lod=0, frame=f)
    ms.box(roof, (w + .06, d + .06, .1), at=(0, 0, G + h), lod=2, frame=f, taper=.4)
    ms.box('in_panel', (.12, .1, .006), at=(-w / 2 - .02, -d / 2 + .02, G + .1), lod=0, frame=f)
    car(ms, rng, -w / 2 + .02, -d / 2 - .04, 0, frame=f)


def car(ms, rng, x, y, yaw, frame=None, lod=0):
    f = (frame @ tm.house_frame(x, y, yaw)) if frame is not None else tm.house_frame(x, y, yaw)
    col = rng.choice(('in_cont_red', 'in_cont_blue', 'in_panel', 'in_graphite'))
    ms.box(col, (.05, .1, .025), at=(0, 0, G + .006), lod=lod, frame=f)
    ms.box('in_glass', (.044, .05, .018), at=(0, .004, G + .031), lod=0, frame=f)


HOUSE_KINDS = {'block', 'tower', 'villa', 'tiered'}


def house_params(style, variant, kind, rng, size):
    big = size == 'big'
    if kind == 'block':
        return dict(w=rng.uniform(.44, .58), d=rng.uniform(.32, .40), storeys=rng.choice((2, 3, 3, 4) if big else (2, 3)))
    if kind in ('tower', 'tiered'):
        return dict(w=rng.uniform(.28, .34), d=rng.uniform(.26, .30), storeys=rng.choice((4, 5, 6) if big else (3, 4, 5)))
    if kind == 'villa':
        return dict(w=rng.uniform(.34, .42), d=rng.uniform(.28, .34))
    raise ValueError(kind)


def foot(kind, p):
    if kind in ('tower', 'tiered'):
        return (p['w'] / 2 + .08, p['d'] / 2 + .08)
    if kind == 'villa':
        return (p['w'] / 2 + .08, p['d'] / 2 + .08)
    return (p['w'] / 2 + .04, p['d'] / 2 + .06)


def draw_house(ms, rng, kind, x, y, yaw, p, style):
    wall = WALL[style]
    if kind == 'block':
        roof = 'in_lacquer' if style == 'sinic' and rng.random() < .6 else ('in_graphite' if style == 'europe' and rng.random() < .4 else None)
        block(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'], wall=wall if style != 'sinic' else 'in_panel_win', roof=roof)
    elif kind == 'tower':
        tower(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'], wall='in_panel_win')
    elif kind == 'tiered':
        tower(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'], wall='in_panel_win', eaves='in_lacquer')
    elif kind == 'villa':
        villa(ms, rng, x, y, yaw, w=p['w'], d=p['d'], wall=wall,
              roof='in_lacquer' if style == 'sinic' else 'in_graphite')


# ---- landmarks ------------------------------------------------------------------------------------

def lm_office_tower(ms, rng, x, y, yaw, wall='in_panel_win'):
    """The business district's tower: a podium, a tall glass shaft stepping back twice, a crown and a mast."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_plinth', (1.0, .8, .05), at=(0, 0, G), lod=2, frame=f)
    ms.box(wall, (.9, .7, .2), at=(0, 0, G + .05), lod=2, frame=f)
    z = G + .25
    for w, d, h in ((.52, .44, .7), (.42, .36, .45), (.32, .28, .25)):
        ms.box('in_panel_win', (w, d, h), at=(0, 0, z), lod=2, frame=f)
        ms.box('in_panel', (w + .006, d + .006, .012), at=(0, 0, z + h - .012), lod=0, frame=f)
        z += h
    ms.box('in_graphite', (.04, .04, .3), at=(0, 0, z), lod=1, frame=f, taper=.4)
    ms.box('team_cloth', (.10, .006, .08), at=(0, -.352, G + .12), lod=1, frame=f)


def lm_stadium(ms, rng, x, y, yaw):
    """A stadium: an oval bowl of stands under a white roof ring, the green pitch inside, floodlight masts."""
    f = tm.house_frame(x, y, yaw)
    for k, s in enumerate((24, 14, 10)):
        ms.cyl('in_plinth', .62, .55, .22, at=(0, 0, G), segs=s, lod=k, only=(k,), frame=f, caps=False)
        ms.cyl('in_panel', .64, .6, .03, at=(0, 0, G + .22), segs=s, lod=k, only=(k,), frame=f, caps=False)
    ms.cyl('in_green', .44, .44, .02, at=(0, 0, G), segs=16, lod=1, frame=f)
    ms.box('in_mark', (.5, .006, .002), at=(0, 0, G + .022), lod=0, frame=f)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        ms.cyl('in_graphite', .01, .008, .42, at=(.62 * math.cos(a), .62 * math.sin(a), G), segs=4, lod=1, frame=f)
    ms.box('team_cloth', (.12, .006, .08), at=(0, -.6, G + .1), lod=1, frame=f)


def lm_mall(ms, rng, x, y, yaw, wall='in_sand_win'):
    """A shopping centre: a long low block, a glass atrium on top, a car park strip in front."""
    f = tm.house_frame(x, y, yaw)
    ms.box(wall, (1.0, .56, .22), at=(0, .06, G), lod=2, frame=f)
    ms.box('in_panel', (1.01, .57, .02), at=(0, .06, G + .22), lod=1, frame=f)
    ms.box('in_glass', (.4, .3, .14), at=(0, .06, G + .24), lod=2, frame=f, taper=.4)
    ms.box('in_pad', (1.0, .18, .004), at=(0, -.32, G), lod=1, frame=f)
    for k in range(5):
        car(ms, rng, -.36 + .18 * k, -.32, 0, frame=f)
    ms.box('team_cloth', (.12, .006, .08), at=(0, -.222, G + .12), lod=1, frame=f)


def lm_tv_tower(ms, rng, x, y, yaw):
    """A TV tower: a tapering concrete shaft, an observation pod, the antenna; a low base building."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_panel_win', (.6, .5, .14), at=(0, 0, G), lod=2, frame=f)
    ms.cyl('in_plinth', .08, .05, 1.4, at=(0, 0, G + .14), segs=10, lod=2, frame=f)
    for k, s in enumerate((14, 10, 8)):
        ms.sphere('in_glass', .13, at=(0, 0, G + 1.25), scale=(1, 1, .7), u=s, v=6, lod=k, only=(k,), frame=f)
    ms.cyl('in_graphite', .015, .006, .4, at=(0, 0, G + 1.54), segs=5, lod=1, frame=f)
    ms.box('team_cloth', (.1, .006, .08), at=(0, -.252, G + .07), lod=1, frame=f)


def lm_tiered_tower(ms, rng, x, y, yaw):
    """A tiered tower: glass storeys stepping in, each under a flared red lacquer eave, a finial."""
    f = tm.house_frame(x, y, yaw)
    z = G
    ms.box('in_plinth', (.8, .8, .06), at=(0, 0, z), lod=2, frame=f)
    z += .06
    for k in range(6):
        w = .6 - .07 * k
        h = .24
        ms.box('in_panel_win', (w, w, h), at=(0, 0, z), lod=2, frame=f)
        ms.box('in_lacquer', (w + .12, w + .12, .03), at=(0, 0, z + h), lod=1, frame=f, taper=.75)
        z += h + .03
    ms.cyl('in_graphite', .02, .004, .3, at=(0, 0, z), segs=6, lod=1, frame=f)
    ms.box('team_cloth', (.1, .006, .08), at=(0, -.302, G + .1), lod=1, frame=f)


LANDMARKS = {
    'office-tower': (lm_office_tower, (.52, .42)),
    'brick-tower': (lambda ms, rng, x, y, yaw: lm_office_tower(ms, rng, x, y, yaw, wall='in_brick_win'), (.52, .42)),
    'sand-tower': (lambda ms, rng, x, y, yaw: lm_office_tower(ms, rng, x, y, yaw, wall='in_sand_win'), (.52, .42)),
    'ochre-tower': (lambda ms, rng, x, y, yaw: lm_office_tower(ms, rng, x, y, yaw, wall='in_ochre_win'), (.52, .42)),
    'stadium': (lm_stadium, (.66, .66)),
    'mall': (lm_mall, (.52, .42)),
    'tv-tower': (lm_tv_tower, (.32, .27)),
    'tiered-tower': (lm_tiered_tower, (.46, .46)),
}
P = dict(hearth=3, granary=1, pits=1, platform=2, rack=3, pen=2, field=2, clutter=2, wood=3, menhir=1)
STYLE = {
    'base': dict(houses={'a': [(3, 'block'), (2, 'tower'), (1, 'villa')], 'b': [(2, 'tower'), (2, 'block'), (2, 'villa')]},
                 lm={'a': ['office-tower', 'stadium'], 'b': ['stadium', 'office-tower']}, fence={'a': 'rail', 'b': 'wall'}, props=P),
    'europe': dict(houses={'a': [(3, 'block'), (2, 'villa'), (1, 'tower')], 'b': [(2, 'villa'), (2, 'block'), (1, 'tower')]},
                   lm={'a': ['brick-tower', 'stadium'], 'b': ['stadium', 'brick-tower']}, fence={'a': 'rail', 'b': 'wall'}, props=P),
    'levant': dict(houses={'a': [(3, 'block'), (1, 'tower'), (1, 'villa')], 'b': [(2, 'block'), (2, 'tower')]},
                   lm={'a': ['sand-tower', 'mall'], 'b': ['mall', 'sand-tower']}, fence={'a': 'wall', 'b': 'rail'}, props=P),
    'sinic': dict(houses={'a': [(3, 'tower'), (2, 'block'), (1, 'tiered')], 'b': [(2, 'tiered'), (2, 'tower'), (1, 'block')]},
                  lm={'a': ['tiered-tower', 'tv-tower'], 'b': ['tv-tower', 'tiered-tower']}, fence={'a': 'wall', 'b': 'rail'}, props=P),
    'indic': dict(houses={'a': [(3, 'block'), (2, 'tower'), (1, 'villa')], 'b': [(2, 'block'), (2, 'tower')]},
                  lm={'a': ['ochre-tower', 'tv-tower'], 'b': ['tv-tower', 'ochre-tower']}, fence={'a': 'wall', 'b': 'rail'}, props=P),
}


# ---- props (the Stone plan's prop slots, drawn as today's things) ---------------------------------------

def draw_prop(ms, rng, kind, x, y, yaw, style):
    f = tm.house_frame(x, y, yaw)
    if kind == 'field':  # a park: lawn, a path, trees
        ms.box('in_green', (.5, .34, .006), at=(0, 0, G), lod=2, frame=f)
        ms.box('in_plinth', (.5, .04, .007), at=(0, 0, G), lod=0, frame=f)
        for k in range(3):
            ms.sphere('in_green', .06, at=(-.15 + .15 * k, .1, G + .1), u=6, v=4, lod=1, frame=f)
    elif kind == 'pen':  # a car park
        ms.box('in_pad', (.4, .28, .004), at=(0, 0, G), lod=1, frame=f)
        for k in range(4):
            car(ms, rng, -.15 + .1 * k, .06, 0, frame=f)
    elif kind == 'platform':  # a solar array
        ik.solar_array(ms, x, y, w=.28, d=.18, yaw=yaw)
    elif kind in ('rack', 'canoe'):  # a parked car
        car(ms, rng, x, y, yaw, lod=1)
    elif kind == 'granary':  # a water tower
        ms.cyl('in_plinth', .015, .015, .28, at=(x, y, G), segs=6, lod=1)
        ms.cyl('in_panel', .07, .07, .1, at=(x, y, G + .28), segs=10, lod=1)
    elif kind == 'hearth':  # a street light
        ms.cyl('in_graphite', .006, .005, .22, at=(x, y, G), segs=4, lod=0)
        ms.box('in_glow', (.04, .016, .01), at=(x, y, G + .22), lod=0)
    elif kind in ('clutter', 'pits'):  # bins and a container
        ik.container(ms, x, y, yaw, mat=rng.choice(('in_cont_red', 'in_cont_blue')), long=False, lod=0)
    elif kind == 'wood':  # a street tree in a planter
        ms.box('in_plinth', (.08, .08, .03), at=(0, 0, G), lod=0, frame=f)
        ms.sphere('in_green', .07, at=(x, y, G + .12), u=6, v=4, lod=1)
    elif kind in ('menhir', 'totem'):  # a small cell mast
        ik.pylon(ms, x, y, h=.4, r=.03, rings=1)


def draw_fence(ms, rng, kind, r):
    a0, a1 = -90 + bs.GATE, 270 - bs.GATE
    for lod, step in ((0, 5.0), (1, 8.0), (2, 15.0)):
        m = int(round((a1 - a0) / step))
        for k in range(m):
            a = a0 + (a1 - a0) * (k + .5) / m
            ar = math.radians(a)
            seg = 2 * math.pi * r * (a1 - a0) / 360 / m - (.012 if lod == 0 else 0)
            if kind == 'wall':  # a low concrete wall with a coping
                ms.add(bs._box_bm(seg, .05, .14), 'in_plinth', lod, only=(lod,), matrix=bs.frame_at(r * math.cos(ar), r * math.sin(ar), a + 90))
                if lod == 0:
                    ms.box('in_panel', (seg, .06, .012), at=(r * math.cos(ar), r * math.sin(ar), G + .14), rot_z=a + 90, lod=0)
            else:  # a hedge with a steel railing
                ms.add(bs._box_bm(seg, .06, .08), 'in_green', lod, only=(lod,), matrix=bs.frame_at(r * math.cos(ar), r * math.sin(ar), a + 90))
                if lod == 0:
                    ms.box('in_graphite', (seg, .008, .008), at=(r * math.cos(ar), r * math.sin(ar), G + .12), rot_z=a + 90, lod=0)
    for s in (-1, 1):  # the gate posts
        a = math.radians(-90 + s * bs.GATE)
        ms.box('in_panel', (.06, .06, .3), at=(r * math.cos(a), r * math.sin(a), G), lod=1)


# ---- the plan (build_town_stone.plan with the Information tables) -------------------------------------

def plan(style, size, variant, rng):
    saved = (bs.STYLE, bs.LANDMARKS, bs.SMALL_LANDMARKS, bs.foot, bs._house_params)
    bs.STYLE, bs.LANDMARKS, bs.SMALL_LANDMARKS, bs.foot, bs._house_params = STYLE, LANDMARKS, {}, foot, house_params
    try:
        return bs.plan(style, size, variant, rng)
    finally:
        bs.STYLE, bs.LANDMARKS, bs.SMALL_LANDMARKS, bs.foot, bs._house_params = saved


def town_layout(style, size, variant):
    def layout(ms, rng):
        lms, houses, props, fence_r = plan(style, size, variant, rng)
        for name, x, y, yaw in lms:
            LANDMARKS[name][0](ms, rng, x, y, yaw)
        for kind, x, y, yaw, p in houses:
            draw_house(ms, rng, kind, x, y, yaw, p, style)
        for kind, x, y, yaw in props:
            draw_prop(ms, rng, kind, x, y, yaw, style)
        draw_fence(ms, rng, STYLE[style]['fence'][variant], fence_r)
    return layout


def file_name(style, size, variant):
    return 'information-town-%s-%s%s' % (size, variant, '' if style == 'base' else '-' + style)


def build(style, size, variant, out_dir, atlas=1024):
    name = file_name(style, size, variant)
    R = bs.SIZES[size]['R']
    mat, colors = GROUNDS[style]
    bs.CUR_GROUND['colors'] = colors
    ground = dict(rx=R * .99, ry=R * .95, square=None, mat=mat)
    seed = zlib.crc32(name.encode()) & 0xffff

    def layout(ms, rng):
        town_layout(style, size, variant)(ms, tm.seeded(seed))
        bs.trim(ms, 1, 7800 if size == 'big' else 8500)  # a big town's file stays under 2 MB packed (KTD16)
        bs.trim(ms, 2, 1450)
    return tt.build_file(name, [('town-%s-%s' % (size, variant), layout, ground)], out_dir, atlas=atlas, seed=seed)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    style, size, variant, out_dir = argv[:4]
    assert style in STYLES and size in bs.SIZES and variant in ('a', 'b'), argv
    build(style, size, variant, out_dir)
    sys.stdout.flush()
    os._exit(0)
