# scripts/blender/build_town_future.py
# The Future map towns (eight-ages plan U89, KTD16: Future base plus 2 regional kits), small, medium and big,
# layouts a and b: src/assets/map/towns/future-town-<size>-<v>[-<style>].glb, on the Stone town builder's plan
# (build_town_stone.plan: the gate street, the landmark plots, houses packed without overlaps, props) with the
# Future kit (ti_future_kit.py) in place of its huts:
#   base    white composite habitation pods, small habitat domes and slim residential towers with light bands;
#           landmarks an arcology (a stepped tower with a spire) and a command dome; a shield-pylon ring
#   sinic   tiered towers with dark lacquer eaves, pods; landmarks a tiered spire and a garden dome
#   levant  sand-coloured cubic blocks with solar roofs, domes; landmarks a sand arcology and a landing hub
# Props: hydroponic beds, landing pads, solar arrays, hover cars, crates, light posts, planters, beacons.
# One 1024 atlas per file, LOD0..LOD2 (the far level trimmed to the town budget), Town / Ground / Team.
#   blender -b --factory-startup -P scripts/blender/build_town_future.py -- <style|base> <small|medium|big> <a|b> <out_dir>
import math
import os
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_future_kit as fk  # noqa: E402
import build_town_stone as bs  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

STYLES = ('base', 'sinic', 'levant')
GROUNDS = {'base': ('earth', ('#8f948f', '#9da29c', '#aab0aa', '#858a85')),
           'sinic': ('earth', ('#8a8c84', '#979a90', '#a4a79c', '#7e8078')),
           'levant': ('earth', ('#b8a684', '#c6b492', '#d2c2a0', '#ac9a78'))}


# ---- houses --------------------------------------------------------------------------------------

def tower(ms, rng, x, y, yaw, w=.34, d=.30, storeys=4, wall='fu_panel_win', cap='fu_graphite', eaves=None):
    """A slim residential tower: a plinth, stacked bevelled storeys stepping in a little, light bands between
    them, a graphite cap (or, `eaves`, flared lacquer eaves on every tier)."""
    f = tm.house_frame(x, y, yaw)
    # a glazed lobby podium, wider than the tower: the building's base on its plot (townComponents reads it)
    ms.box('fu_plinth', (w + .10, d + .10, .13), at=(0, 0, G), lod=2, frame=f)
    ms.box('fu_glow', (w + .104, .004, .01), at=(0, -(d + .10) / 2 - .002, G + .10), lod=0, frame=f)
    z = G + .13
    tiers = max(1, storeys // 2)
    per = storeys / tiers
    for k in range(tiers):
        s = 1 - .08 * k
        h = STOREY * per
        ms.box(wall, (w * s, d * s, h), at=(0, 0, z), lod=2, frame=f, bevel=min(w, d) * .12)
        if eaves:
            ms.box(eaves, (w * s + .08, d * s + .08, .025), at=(0, 0, z + h), lod=1, frame=f, taper=.8)
        else:
            ms.box('fu_glow', (w * s + .004, d * s + .004, .008), at=(0, 0, z + h - .01), lod=0, frame=f)
        z += h
    ms.box(cap, (w * .6, d * .6, .04), at=(0, 0, z), lod=1, frame=f)
    return z


def court_block(ms, rng, x, y, yaw, w=.46, d=.40, storeys=2):
    """A sand-coloured cubic block with a recessed loggia and a solar roof."""
    f = tm.house_frame(x, y, yaw)
    h = STOREY * storeys
    ms.box('fu_sand_win', (w, d, h), at=(0, 0, G), lod=2, frame=f)
    ms.box('fu_graphite', (w * .5, .02, h * .4), at=(0, -d / 2 - .002, G + .02), lod=0, frame=f)
    ms.box('fu_solar', (w * .8, d * .7, .012), at=(0, .02, G + h), lod=1, frame=f, taper=.95)
    ms.box('fu_glow', (w * .6, .006, .008), at=(0, -d / 2 - .004, G + h - .02), lod=0, frame=f)


HOUSE_KINDS = {'pod', 'dome', 'tower', 'tiered', 'court'}


def house_params(style, variant, kind, rng, size):
    if kind == 'pod':
        return dict(w=rng.uniform(.48, .62), d=rng.uniform(.34, .42), h=rng.uniform(.14, .18))
    if kind == 'dome':
        return dict(r=rng.uniform(.22, .28))
    if kind in ('tower', 'tiered'):
        big = size == 'big'
        return dict(w=rng.uniform(.28, .36), d=rng.uniform(.26, .32), storeys=rng.choice((3, 4, 4, 5) if big else (2, 3, 4)))
    if kind == 'court':
        return dict(w=rng.uniform(.44, .56), d=rng.uniform(.40, .48), storeys=rng.choice((1, 2, 2, 3)))
    raise ValueError(kind)


def foot(kind, p):
    if kind == 'dome':
        return (p['r'] + .03, p['r'] + .03)
    if kind in ('tower', 'tiered'):
        return (p['w'] / 2 + .08, p['d'] / 2 + .08)
    return (p['w'] / 2 + .04, p['d'] / 2 + .05)


def draw_house(ms, rng, kind, x, y, yaw, p):
    if kind == 'pod':
        f = fk.pod(ms, x, y, p['w'], p['d'], p['h'], yaw=yaw)
        if rng.random() < .4:
            ms.box('fu_solar', (p['w'] * .7, p['d'] * .6, .01), at=(0, 0, G + .06 + p['h']), lod=0, frame=f)
    elif kind == 'dome':
        fk.dome(ms, x, y, p['r'], mat='fu_glass' if rng.random() < .5 else 'fu_panel', segs=(12, 8, 6))
    elif kind == 'tower':
        tower(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'])
    elif kind == 'tiered':
        tower(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'], eaves='fu_lacquer')
    elif kind == 'court':
        court_block(ms, rng, x, y, yaw, w=p['w'], d=p['d'], storeys=p['storeys'])


# ---- landmarks ------------------------------------------------------------------------------------

def lm_arcology(ms, rng, x, y, yaw, top=1.9, wall='fu_panel_win'):
    """The arcology: a broad podium, a stepped tower in three tiers with light bands, a needle spire."""
    f = tm.house_frame(x, y, yaw)
    ms.box('fu_plinth', (1.0, .8, .06), at=(0, 0, G), lod=2, frame=f)
    ms.box(wall, (.9, .7, .22), at=(0, 0, G + .06), lod=2, frame=f, bevel=.06)
    z = G + .28
    for k, (w, d, h) in enumerate(((.62, .5, .45), (.46, .38, .40), (.32, .26, .34))):
        ms.box(wall, (w, d, h), at=(0, 0, z), lod=2, frame=f, bevel=.05)
        ms.box('fu_glow', (w + .006, d + .006, .01), at=(0, 0, z + h - .02), lod=0, frame=f)
        z += h
    ms.cyl('fu_graphite', .03, .008, top - (z - G), at=(0, 0, z), segs=6, lod=1, frame=f)
    ms.box('team_cloth', (.10, .006, .08), at=(0, -.252, G + .2), lod=1, frame=f)


def lm_command_dome(ms, rng, x, y, yaw):
    f = tm.house_frame(x, y, yaw)
    for k, s in enumerate((20, 12, 8)):
        ms.cyl('fu_panel_win', .55, .55, .22, at=(0, 0, G), segs=s, lod=k, only=(k,), frame=f)
        ms.sphere('fu_glass', 1.0, at=(0, 0, G + .22), scale=(.53, .53, .42), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0, frame=f)
    ms.cyl('fu_glow', .555, .555, .012, at=(0, 0, G + .22), segs=20, lod=0, caps=False, frame=f)
    ms.cyl('fu_graphite', .04, .015, .6, at=(0, 0, G + .62), segs=6, lod=1, frame=f)
    ms.box('team_cloth', (.14, .006, .1), at=(0, -.552, G + .08), lod=1, frame=f)


def lm_tiered_spire(ms, rng, x, y, yaw):
    f = tm.house_frame(x, y, yaw)
    z = G
    ms.box('fu_plinth', (.8, .8, .06), at=(0, 0, z), lod=2, frame=f)
    z += .06
    for k in range(5):
        w = .6 - .09 * k
        h = .26 - .02 * k
        ms.box('fu_panel_win', (w, w, h), at=(0, 0, z), lod=2, frame=f, bevel=.03)
        ms.box('fu_lacquer', (w + .12, w + .12, .03), at=(0, 0, z + h), lod=1, frame=f, taper=.75)
        z += h + .03
    ms.cyl('fu_glow', .02, .004, .3, at=(0, 0, z), segs=6, lod=1, frame=f)
    ms.box('team_cloth', (.1, .006, .08), at=(0, -.302, G + .1), lod=1, frame=f)


def lm_garden_dome(ms, rng, x, y, yaw):
    f = tm.house_frame(x, y, yaw)
    for k, s in enumerate((18, 12, 8)):
        ms.cyl('fu_plinth', .6, .6, .06, at=(0, 0, G), segs=s, lod=k, only=(k,), frame=f)
        ms.sphere('fu_green', 1.0, at=(0, 0, G + .06), scale=(.58, .58, .48), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0, frame=f)
    ms.box('team_cloth', (.12, .006, .08), at=(0, -.6, G + .02), lod=1, frame=f)


def lm_landing_hub(ms, rng, x, y, yaw):
    f = tm.house_frame(x, y, yaw)
    fk.landing_pad(ms, x - .25 * math.cos(math.radians(yaw)), y - .25 * math.sin(math.radians(yaw)), r=.32)
    fk.vtol(ms, x - .25 * math.cos(math.radians(yaw)), y - .25 * math.sin(math.radians(yaw)), yaw=yaw + 30, s=1.2)
    ms.box('fu_sand_win', (.36, .5, .36), at=(.34, 0, G), lod=2, frame=f, bevel=.04)
    ms.cyl('fu_graphite', .02, .006, .5, at=(.34, .1, G + .36), segs=5, lod=1, frame=f)
    ms.box('team_cloth', (.1, .006, .08), at=(.34, -.252, G + .2), lod=1, frame=f)


LANDMARKS = {
    'arcology': (lm_arcology, (.52, .42)),
    'command-dome': (lm_command_dome, (.58, .58)),
    'tiered-spire': (lm_tiered_spire, (.46, .46)),
    'garden-dome': (lm_garden_dome, (.62, .62)),
    'sand-arcology': (lambda ms, rng, x, y, yaw: lm_arcology(ms, rng, x, y, yaw, wall='fu_sand_win'), (.52, .42)),
    'landing-hub': (lm_landing_hub, (.62, .40)),
}
STYLE = {
    'base': dict(houses={'a': [(2, 'pod'), (1, 'dome'), (2, 'tower')], 'b': [(3, 'tower'), (2, 'pod')]}, lm={'a': ['arcology', 'command-dome'], 'b': ['command-dome', 'arcology']},
                 fence={'a': 'shield', 'b': 'wall'}, props=dict(hearth=3, granary=2, pits=1, platform=2, rack=2, pen=1, field=2, clutter=2, wood=2, menhir=2)),
    'sinic': dict(houses={'a': [(3, 'tiered'), (1, 'pod')], 'b': [(2, 'tiered'), (2, 'tower')]}, lm={'a': ['tiered-spire', 'garden-dome'], 'b': ['garden-dome', 'tiered-spire']},
                  fence={'a': 'wall', 'b': 'shield'}, props=dict(hearth=3, granary=1, pits=1, platform=1, rack=2, pen=1, field=3, clutter=2, wood=3, menhir=1)),
    'levant': dict(houses={'a': [(3, 'court'), (1, 'dome')], 'b': [(2, 'court'), (1, 'tower')]}, lm={'a': ['sand-arcology', 'landing-hub'], 'b': ['landing-hub', 'sand-arcology']},
                   fence={'a': 'wall', 'b': 'shield'}, props=dict(hearth=2, granary=2, pits=1, platform=3, rack=2, pen=1, field=2, clutter=3, wood=1, menhir=1)),
}


# ---- props (the Stone plan's prop slots, drawn as Future things) ---------------------------------------

def draw_prop(ms, rng, kind, x, y, yaw, style):
    f = tm.house_frame(x, y, yaw)
    if kind == 'field':  # hydroponic beds
        for k in range(3):
            ms.box('fu_green', (.5, .08, .03), at=(0, -.12 + .12 * k, G), lod=1 if k == 1 else 0, frame=f)
        ms.box('fu_glass', (.54, .34, .02), at=(0, 0, G), lod=2, frame=f)
    elif kind == 'pen':  # a landing pad
        fk.landing_pad(ms, x, y, r=.22)
    elif kind == 'platform':  # a solar array
        fk.solar_array(ms, x, y, w=.28, d=.18, yaw=yaw)
    elif kind in ('rack', 'canoe'):  # a parked hover car
        ms.box('fu_panel', (.10, .20, .05), at=(0, 0, G + .02), lod=1, frame=f, bevel=.02)
        ms.box('fu_glass', (.08, .08, .03), at=(0, -.02, G + .07), lod=0, frame=f)
        ms.box('fu_glow', (.08, .16, .004), at=(0, 0, G + .006), lod=0, frame=f)
    elif kind == 'granary':  # a water tank
        ms.cyl('fu_panel', .08, .08, .18, at=(x, y, G), segs=10, lod=1)
        ms.cyl('fu_glow', .081, .081, .01, at=(x, y, G + .14), segs=10, lod=0, caps=False)
    elif kind == 'hearth':  # a light post and a bench
        ms.cyl('fu_graphite', .008, .006, .2, at=(x, y, G), segs=4, lod=0)
        ms.box('fu_glow', (.03, .03, .02), at=(x, y, G + .2), lod=0)
    elif kind in ('clutter', 'pits'):  # cargo crates
        for k in range(3):
            ms.box('fu_panel' if k % 2 else 'fu_graphite', (.06, .06, .05), at=(-.07 + .07 * k, 0, G), lod=0, frame=f, bevel=.008)
    elif kind == 'wood':  # a planter with a tree
        ms.box('fu_plinth', (.12, .12, .04), at=(0, 0, G), lod=0, frame=f)
        ms.sphere('fu_green', .07, at=(x, y, G + .12), u=6, v=4, lod=1)
    elif kind in ('menhir', 'totem'):  # a beacon pylon
        fk.pylon(ms, x, y, h=.32, r=.03, rings=2)


def draw_fence(ms, rng, kind, r):
    a0, a1 = -90 + bs.GATE, 270 - bs.GATE
    if kind == 'shield':  # pylons with a glowing band between them at knee height
        n = int(2 * math.pi * r * (a1 - a0) / 360 / .5)
        for k in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * k / n)
            fk.pylon(ms, r * math.cos(a), r * math.sin(a), h=.30, r=.03, rings=1, lod=1)
        for lod, step in ((0, 4.0), (1, 8.0), (2, 15.0)):
            m = int(round((a1 - a0) / step))
            for k in range(m):
                a = a0 + (a1 - a0) * (k + .5) / m
                ar = math.radians(a)
                seg = 2 * math.pi * r * (a1 - a0) / 360 / m
                ms.box('fu_glow', (seg * 1.02, .012, .03), at=(r * math.cos(ar), r * math.sin(ar), G + .12), rot_z=a + 90, lod=lod) if lod == 0 else \
                    ms.add(bs._box_bm(seg * 1.02, .03, .2), 'fu_graphite', lod, only=(lod,),
                           matrix=bs.frame_at(r * math.cos(ar), r * math.sin(ar), a + 90))
    else:  # a low white panel wall with a light line
        for lod, step in ((0, 5.0), (1, 8.0), (2, 15.0)):
            m = int(round((a1 - a0) / step))
            for k in range(m):
                a = a0 + (a1 - a0) * (k + .5) / m
                ar = math.radians(a)
                seg = 2 * math.pi * r * (a1 - a0) / 360 / m - (.012 if lod == 0 else 0)
                ms.add(bs._box_bm(seg, .05, .18), 'fu_panel', lod, only=(lod,), matrix=bs.frame_at(r * math.cos(ar), r * math.sin(ar), a + 90))
                if lod == 0:
                    ms.box('fu_glow', (seg, .056, .01), at=(r * math.cos(ar), r * math.sin(ar), G + .14), rot_z=a + 90, lod=0)
    for s in (-1, 1):
        a = math.radians(-90 + s * bs.GATE)
        fk.pylon(ms, r * math.cos(a), r * math.sin(a), h=.42, r=.04, rings=2, lod=1)


# ---- the plan (build_town_stone.plan with the Future tables) -------------------------------------------

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
            draw_house(ms, rng, kind, x, y, yaw, p)
        for kind, x, y, yaw in props:
            draw_prop(ms, rng, kind, x, y, yaw, style)
        draw_fence(ms, rng, STYLE[style]['fence'][variant], fence_r)
    return layout


def file_name(style, size, variant):
    return 'future-town-%s-%s%s' % (size, variant, '' if style == 'base' else '-' + style)


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
