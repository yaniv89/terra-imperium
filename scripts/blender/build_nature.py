# scripts/blender/build_nature.py
# The battle's nature files (plans/ART-MODELS-PLAN.md section 7, Wave 1; src/assets/battle/nature/
# README.md): the resource nodes stone-outcrop, ore-outcrop, gold-vein and fish-shoal (objects
# `full`, `half`, `depleted`), the herds herd-sheep-goat and herd-cattle (object `animal`), and the
# vegetation kits temperate, mediterranean and desert (tree-s, tree-m, tree-l, stump, felled, bush,
# rock-s, rock-m, grass-tuft). One 1024 atlas per file (512 for herds and fish), LOD0..LOD2 per object, no ground plate.
#   blender -b --factory-startup -P scripts/blender/build_nature.py -- <out_dir> [file,file...]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402


def rock_lods(ms, mat, x, y, r, rng, far=True, flat=0.7):
    """One boulder: a subdivided lump at LOD0, the same lump plain at LOD1 (and LOD2 when `far`)."""
    seed = rng.randrange(1 << 30)
    tn.rock(ms, mat, x, y, r, random.Random(seed), flat=flat, subdiv=2, lod=0)
    tn.rock(ms, mat, x, y, r, random.Random(seed), flat=flat, subdiv=1, lod=2 if far else 1, only=(1, 2) if far else (1,))


def chips(ms, mat, rng, n, spread, size=0.012):
    for k in range(n):
        a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.3, 1.0) * spread
        tn.rock(ms, mat, math.cos(a) * d, math.sin(a) * d, size * rng.uniform(0.7, 1.4), rng, flat=0.6, subdiv=1, lod=0)


def cut_blocks(ms, mat, rng, x, y, n=3):
    for k in range(n):
        ms.box(mat, (0.07, 0.045, 0.04), at=(x + 0.08 * (k % 2) + rng.uniform(-0.01, 0.01), y + 0.06 * (k // 2), 0.04 * (k // 3)),
               rot_z=rng.uniform(-10, 10), lod=1 if k < 2 else 0, bevel=0.003)


def veins(ms, mat, rng, rocks, n=2, size=0.02):
    """Patches of another mineral pressed into the faces of the given rocks [(x, y, r)]."""
    for x, y, r in rocks:
        for k in range(n):
            a = rng.uniform(0, 2 * math.pi)
            z = r * rng.uniform(0.15, 0.4)
            tn.blob(ms, mat, (x + math.cos(a) * r * 0.85, y + math.sin(a) * r * 0.85, z), size * rng.uniform(0.8, 1.4), (1.4, 1.4, 0.6), rng, 0.2, 1, lod=0, yaw=math.degrees(a))


# ---- resource nodes (1,500 / 300 / 80) ----------------------------------------------------------

def outcrop(main='rock', accent=None, accent2=None, flecks=None):
    """Full, half and depleted states of a rock node; `accent` minerals sit in the rock faces."""
    def full(ms, rng):
        rocks = [(0.0, 0.05, 0.16), (-0.17, -0.06, 0.11), (0.16, -0.08, 0.12), (0.06, 0.22, 0.09), (-0.12, 0.2, 0.08)]
        for k, (x, y, r) in enumerate(rocks):
            rock_lods(ms, main, x, y, r, rng, far=k < 2, flat=0.85 if k == 0 else 0.7)
        if accent:
            veins(ms, accent, rng, rocks[:4], 2, 0.03)
        if accent2:
            veins(ms, accent2, rng, rocks[:3], 1, 0.025)
        if flecks:
            veins(ms, flecks, rng, rocks[:4], 3, 0.016)
        chips(ms, main, rng, 10, 0.32)
    def half(ms, rng):
        rocks = [(-0.05, 0.04, 0.12), (0.14, -0.04, 0.08), (-0.14, 0.16, 0.07)]
        for k, (x, y, r) in enumerate(rocks):
            rock_lods(ms, main, x, y, r, rng, far=k == 0)
        if accent:
            veins(ms, accent, rng, rocks, 2, 0.025)
        if flecks:
            veins(ms, flecks, rng, rocks[:2], 3, 0.014)
        cut_blocks(ms, main if main != 'rock_dark' else 'rock', rng, 0.08, -0.22)
        chips(ms, main, rng, 14, 0.3)
        if accent:
            chips(ms, accent, rng, 6, 0.22, 0.01)
    def depleted(ms, rng):
        tn.blob(ms, main, (0, 0, -0.005), 0.13, (1.25, 1.0, 0.3), rng, 0.2, 2, lod=0, cut=0.0)
        tn.blob(ms, main, (0, 0, -0.005), 0.13, (1.25, 1.0, 0.3), rng, 0.1, 1, lod=2, only=(1, 2), cut=0.0)
        for k in range(3):  # broken stumps of the quarried rock
            a = 2 * math.pi * k / 3 + rng.uniform(-0.4, 0.4)
            tn.rock(ms, main, math.cos(a) * 0.17, math.sin(a) * 0.15, 0.04, rng, flat=0.5, subdiv=1, lod=0)
        chips(ms, main, rng, 16, 0.3, 0.01)
        if accent:
            chips(ms, accent, rng, 5, 0.25, 0.008)
    return full, half, depleted


def fish_shoal():
    def full(ms, rng):
        for k, (x, y, r) in enumerate([(0, 0, 0.16), (0.02, 0.01, 0.1), (-0.14, 0.12, 0.08), (0.15, -0.1, 0.09), (0.0, 0.0, 0.24)]):
            tn.ring(ms, 'ripple', x, y, r, w=0.005, z=0.002 + 0.0006 * k, segs=20, lod=0)
            if k in (0, 4):
                tn.ring(ms, 'ripple', x, y, r, w=0.014, segs=8, lod=2, only=(1, 2))
        for k in range(9):
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.04, 0.22)
            tn.fish(ms, math.cos(a) * d, math.sin(a) * d, rng.uniform(0, 360), size=rng.uniform(0.04, 0.06), lod=0 if k > 2 else 1)
        tn.fish(ms, 0.03, 0.02, 40, size=0.06, jump=0.03, lod=1)
    def half(ms, rng):
        for x, y, r in [(0, 0, 0.12), (0.1, -0.08, 0.07)]:
            tn.ring(ms, 'ripple', x, y, r, w=0.005, z=0.002 + 0.0006 * (x > 0), segs=20, lod=0)
        tn.ring(ms, 'ripple', 0, 0, 0.12, w=0.014, segs=8, lod=2, only=(1, 2))
        for k in range(4):
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.04, 0.14)
            tn.fish(ms, math.cos(a) * d, math.sin(a) * d, rng.uniform(0, 360), size=0.045, lod=0 if k else 1)
    def depleted(ms, rng):
        tn.ring(ms, 'ripple', 0, 0, 0.08, w=0.004, segs=16, lod=0)
        tn.ring(ms, 'ripple', 0, 0, 0.08, w=0.01, segs=6, lod=2, only=(1, 2))
        tn.fish(ms, 0.03, 0.0, 120, size=0.04, lod=1)
    return full, half, depleted


# ---- herds (400 / 150 / 60) -----------------------------------------------------------------------

def sheep(ms, rng):
    """A fat-tailed sheep, 1.3 m long and 0.8 m at the back: cream wool, a dark face and legs."""
    tn.quadruped(ms, rng, 0.13, 0.08, body='wool', head='wool_dark', leg='wool_dark', horns=(0.012, 0.004, -0.004))


def cattle(ms, rng):
    """A long-horned ox, 2.4 m long and 1.4 m at the withers: red-brown hide, lyre horns."""
    tn.quadruped(ms, rng, 0.24, 0.14, body='hide', head='hide', leg='hide', horns=(0.05, -0.0, 0.05))


# ---- vegetation kits (600 / 150 / 150) ------------------------------------------------------------

def kit(trees, bark, leaf, bush_leaf, rock_mat, tuft_mat):
    s, m, l = trees
    def stump(ms, rng):
        tn.stump(ms, rng, 0.03, bark=bark)
    def felled(ms, rng):
        tn.felled(ms, rng, 0.42, 0.028, bark=bark, leaf=leaf)
    def bush(ms, rng):
        tn.bush(ms, rng, 0.07, leaf=bush_leaf)
    def rock_s(ms, rng):
        rock_lods(ms, rock_mat, 0, 0, 0.05, rng)
    def rock_m(ms, rng):
        rock_lods(ms, rock_mat, 0, 0, 0.11, rng, flat=0.75)
        rock_lods(ms, rock_mat, 0.1, -0.05, 0.05, rng, far=False)
    def tuft(ms, rng):
        tn.grass_tuft(ms, rng, 0.05, mat=tuft_mat)
    return [('tree-s', s), ('tree-m', m), ('tree-l', l), ('stump', stump), ('felled', felled), ('bush', bush),
            ('rock-s', rock_s), ('rock-m', rock_m), ('grass-tuft', tuft)]


TEMPERATE = kit((
    lambda ms, rng: tn.broadleaf(ms, rng, 0.38, 0.1, 0.012, bark='birch', leaf='foliage_light', shape=(0.9, 0.9, 1.3), crown_z=0.45),   # birch
    lambda ms, rng: tn.broadleaf(ms, rng, 0.6, 0.24, 0.03, bark='bark', leaf='foliage', shape=(1.1, 1.1, 0.75), crown_z=0.45),           # oak
    lambda ms, rng: tn.broadleaf(ms, rng, 0.8, 0.22, 0.03, bark='bark_pale', leaf='foliage_dark', shape=(1.0, 1.0, 1.25), crown_z=0.4),  # beech
), 'bark', 'foliage', 'foliage', 'rock', 'tuft')

MEDITERRANEAN = kit((
    lambda ms, rng: tn.broadleaf(ms, rng, 0.34, 0.15, 0.024, bark='bark_pale', leaf='olive_leaf', shape=(1.1, 1.1, 0.7), crown_z=0.4, lean=0.12),  # olive
    lambda ms, rng: tn.umbrella(ms, rng, 0.62, 0.26),                                                                                        # stone pine
    lambda ms, rng: tn.spire(ms, rng, 0.82, 0.07),                                                                                           # cypress
), 'bark_pale', 'olive_leaf', 'olive_leaf', 'rock', 'tuft_dry')

DESERT = kit((
    lambda ms, rng: tn.broadleaf(ms, rng, 0.3, 0.13, 0.016, bark='bark', leaf='dry_shrub', shape=(1.1, 1.1, 0.7), crown_z=0.3),  # tamarisk
    lambda ms, rng: tn.acacia(ms, rng, 0.48, 0.28),                                                                              # umbrella thorn
    lambda ms, rng: tn.palm(ms, rng, 0.8, frond=0.3),                                                                            # date palm
), 'bark_pale', 'palm_leaf', 'dry_shrub', 'sandstone', 'tuft_dry')


def node_items(states):
    full, half, depleted = states
    return [('full', full), ('half', half), ('depleted', depleted)]


FILES = {
    'stone-outcrop': node_items(outcrop('rock')),
    'ore-outcrop': node_items(outcrop('rock_dark', accent='ore', accent2='verdigris')),
    'gold-vein': node_items(outcrop('rock', accent='quartz', flecks='gold')),
    'fish-shoal': node_items(fish_shoal()),
    'herd-sheep-goat': [('animal', sheep)],
    'herd-cattle': [('animal', cattle)],
    'vegetation-temperate': TEMPERATE,
    'vegetation-mediterranean': MEDITERRANEAN,
    'vegetation-desert': DESERT,
}

# Small objects need less than the README's 1024 atlas: one animal, a few ripples and fish.
SMALL_ATLAS = {'herd-sheep-goat': 512, 'herd-cattle': 512, 'fish-shoal': 512}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'nature')
    only = argv[1].split(',') if len(argv) > 1 else list(FILES)
    report = {}
    for k, name in enumerate(only):
        items = [(obj, fn, None) for obj, fn in FILES[name]]
        report[name] = tt.build_file(name, items, out_dir, atlas=SMALL_ATLAS.get(name, 1024), seed=4100 + 17 * k)
    import json
    with open(os.path.join(out_dir, 'report-%s.json' % ('all' if len(only) == len(FILES) else only[0])), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('NATURE_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
