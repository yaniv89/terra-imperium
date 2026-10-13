# scripts/blender/build_nature.py
# The battle's nature files (plans/ART-MODELS-PLAN.md section 7, Wave 1; src/assets/battle/nature/
# README.md): the resource nodes stone-outcrop, ore-outcrop, gold-vein and fish-shoal (objects
# `full`, `half`, `depleted`), the herds herd-sheep-goat and herd-cattle (object `animal`), and the
# vegetation kits temperate, mediterranean and desert (tree-s, tree-m, tree-l, stump, felled, bush,
# rock-s, rock-m, grass-tuft, log-pile). One 1024 atlas per file (512 for herds and fish), LOD0..LOD2 per object, no ground plate.
# 13 October (MD06, four resources): stone, gold and fish rebuilt to be told apart at battle zoom, the grove's
# stump and felled states and the log pile; ore is retired (plans/art-pilot/md06-nodes-loads/LOG.md).
#   blender -b --factory-startup -P scripts/blender/build_nature.py -- <out_dir> [file,file...]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
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


# ---- the four battle resources (MD06, 13 October: food, wood, stone, gold; ore is retired) -----
# Each node must be told from the others at battle zoom on a phone (a node is about 30 px wide):
#   stone  PALE grey and SQUARE: sawn benches stepping up a quarry face, loose cut blocks in front
#   gold   DARK rock in POINTED crags banded with bright yellow seams, nuggets at the foot
#   fish   a light patch of stirred water with ripples, dark fish under it and silver fish leaping
# and its three states by silhouette: full stands tall, half is one low step, depleted is a flat
# bed of rubble round a dark pit (lower than a man's knee, so it is never read as a node worth a
# walk). `outcrop` above still builds the retired ore-outcrop.glb as it shipped.

def rock3(ms, mat, x, y, r, rng, flat=0.7, subs=(3, 2, 1)):
    """One boulder at three levels of detail (None leaves a level out)."""
    seed = rng.randrange(1 << 30)
    for lod, sub in enumerate(subs):
        if sub is not None:
            tn.rock(ms, mat, x, y, r, random.Random(seed), flat=flat, subdiv=sub, lod=lod, only=(lod,))


def crag3(ms, mat, x, y, r, h, rng, subs=(3, 2, 1), veins=()):
    """One pointed crag at three levels of detail, the same seams through each."""
    seed = rng.randrange(1 << 30)
    for lod, sub in enumerate(subs):
        if sub is not None:
            tn.crag(ms, mat, x, y, r, h, random.Random(seed), subdiv=sub, lod=lod, only=(lod,), veins=veins)


def rubble(ms, mat, rng, n, spread, size=0.014, near=0, inner=0.3):
    """Small stones scattered round the node; the first `near` of them stay at LOD1."""
    for k in range(n):
        a, d = rng.uniform(0, 2 * math.pi), rng.uniform(inner, 1.0) * spread
        tn.rock(ms, mat, math.cos(a) * d, math.sin(a) * d, size * rng.uniform(0.7, 1.5), rng, flat=0.6, subdiv=1, lod=1 if k < near else 0)


def cut_block(ms, rng, x, y, z=0.0, yaw=0.0, size=(0.105, 0.075, 0.062), lod=1, mat='quarry_cut'):
    s = tuple(v * rng.uniform(0.9, 1.12) for v in size)
    ms.box(mat, s, at=(x, y, z), rot_z=yaw, lod=lod, bevel=0.005)


def worked_out(ms, rng, bed, stone):
    """A worked-out node: a flat bed of rubble round a dark pit, stones thrown about. Under 0.4 m."""
    seed = rng.randrange(1 << 30)
    for lod, sub in ((0, 2), (1, 2), (2, 1)):
        tn.blob(ms, bed, (0, 0, -0.004), 0.19, (1.2, 1.0, 0.13), random.Random(seed), 0.16, sub, lod=lod, only=(lod,), cut=0.0)
    tn.blob(ms, 'pit', (0.01, -0.01, 0.019), 0.1, (1.25, 1.0, 0.17), random.Random(seed + 1), 0.12, 1, lod=2, cut=0.0)
    rubble(ms, bed, rng, 12, 0.27, size=0.012, near=3, inner=0.55)
    rubble(ms, stone, rng, 6, 0.25, size=0.011, near=2, inner=0.6)


def quarry():
    def full(ms, rng):
        rock3(ms, 'quarry', 0.03, 0.15, 0.2, rng, flat=0.95)
        rock3(ms, 'quarry', -0.2, 0.08, 0.13, rng, flat=0.85, subs=(2, 1, None))
        # the sawn benches: three steps up the face
        ms.box('quarry_cut', (0.38, 0.2, 0.1), at=(0.0, -0.04, 0), rot_z=5, lod=2, bevel=0.006)
        ms.box('quarry_cut', (0.24, 0.16, 0.09), at=(0.05, 0.02, 0.1), rot_z=-3, lod=2, bevel=0.006)
        ms.box('quarry_cut', (0.13, 0.12, 0.08), at=(0.1, 0.07, 0.19), rot_z=8, lod=2, bevel=0.006)
        for x, y, z, yaw in [(-0.19, -0.2, 0, 14), (-0.06, -0.24, 0, -8), (0.2, -0.21, 0, 32), (-0.13, -0.215, 0.064, 4), (0.27, -0.03, 0, 74)]:
            cut_block(ms, rng, x, y, z, yaw, lod=1)
        rubble(ms, 'quarry', rng, 12, 0.36, near=3)
    def half(ms, rng):
        rock3(ms, 'quarry', 0.0, 0.12, 0.13, rng, flat=0.75)
        ms.box('quarry_cut', (0.3, 0.18, 0.075), at=(0.0, -0.03, 0), rot_z=-6, lod=2, bevel=0.006)
        ms.box('quarry_cut', (0.13, 0.11, 0.06), at=(-0.06, 0.0, 0.075), rot_z=4, lod=2, bevel=0.006)
        for k, (x, y, z, yaw) in enumerate([(-0.18, -0.19, 0, 20), (0.16, -0.2, 0, -12), (0.24, -0.02, 0, 60)]):
            cut_block(ms, rng, x, y, z, yaw, lod=2 if k == 0 else 1)
        rubble(ms, 'rubble', rng, 9, 0.33, near=3)
        rubble(ms, 'quarry', rng, 7, 0.3, near=2)
    def depleted(ms, rng):
        worked_out(ms, rng, 'rubble', 'quarry')
        # the last courses of the benches, broken off at the ground
        ms.box('quarry_cut', (0.15, 0.1, 0.022), at=(-0.1, 0.1, 0), rot_z=12, lod=2)
        ms.box('quarry_cut', (0.1, 0.08, 0.018), at=(0.13, -0.09, 0), rot_z=-25, lod=1)
    return full, half, depleted


def gold_vein():
    def nuggets(ms, rng, spots, far=1, mid=4):
        for k, (x, y, r) in enumerate(spots):
            seed = rng.randrange(1 << 30)
            tn.blob(ms, 'gold_bright', (x, y, r * 0.75), r, (1.15, 1.0, 0.8), random.Random(seed), 0.2, 2, lod=0, only=(0,))
            if k < mid:
                tn.blob(ms, 'gold_bright', (x, y, r * 0.75), r * (1.3 if k < far else 1.0), (1.15, 1.0, 0.8), random.Random(seed), 0.15, 1,
                        lod=2 if k < far else 1, only=(1, 2) if k < far else (1,))
    def full(ms, rng):
        # (x, y, radius, height), its levels of detail, its seams (height share, tilt, dip, thickness)
        crag3(ms, 'gold_rock', 0.0, 0.07, 0.15, 0.33, rng, (3, 2, 1), [(0.3, 38, 250, 0.04), (0.62, 30, 60, 0.036), (0.5, 62, 330, 0.03)])
        crag3(ms, 'gold_rock', -0.18, -0.03, 0.115, 0.22, rng, (2, 2, 1), [(0.42, 34, 200, 0.036), (0.7, 40, 20, 0.03)])
        crag3(ms, 'gold_rock', 0.18, -0.05, 0.105, 0.18, rng, (2, 1, None), [(0.45, 42, 300, 0.036)])
        crag3(ms, 'gold_rock', 0.03, -0.17, 0.075, 0.1, rng, (2, None, None), [(0.5, 30, 240, 0.03)])
        nuggets(ms, rng, [(-0.07, -0.21, 0.034), (0.15, -0.2, 0.028), (-0.24, -0.17, 0.024), (0.28, 0.06, 0.024), (0.22, -0.23, 0.02), (-0.15, -0.25, 0.02)], far=1, mid=3)
        rubble(ms, 'gold_rock', rng, 8, 0.34)
    def half(ms, rng):
        crag3(ms, 'gold_rock', 0.0, 0.05, 0.125, 0.18, rng, (3, 2, 1), [(0.45, 36, 250, 0.036), (0.75, 30, 80, 0.028)])
        crag3(ms, 'gold_rock', -0.15, -0.05, 0.09, 0.115, rng, (2, 1, None), [(0.5, 40, 210, 0.03)])
        nuggets(ms, rng, [(0.1, -0.15, 0.026), (-0.05, -0.19, 0.022), (0.2, -0.04, 0.02)], far=1, mid=3)
        rubble(ms, 'gold_rock', rng, 14, 0.32, near=3)
    def depleted(ms, rng):
        worked_out(ms, rng, 'gold_rock', 'gold_rock')
        for x, y in [(-0.13, 0.1), (0.15, 0.07), (0.1, -0.13)]:  # the crags' stumps
            crag3(ms, 'gold_rock', x, y, 0.05, 0.04, rng, subs=(2, None, None))
        for x, y in [(-0.05, -0.16), (0.19, -0.03), (-0.19, -0.02)]:  # the last specks
            tn.blob(ms, 'gold_bright', (x, y, 0.007), 0.014, (1, 1, 0.7), rng, 0.2, 1, lod=1 if x < -0.1 else 0)
    return full, half, depleted


def fish_shoal():
    def water(ms, rng, r, mat='shoal_water'):
        """The shoal's patch of lighter, stirred water: a ragged flat disc just over the surface."""
        seed = rng.randrange(1 << 30)
        for lod, segs in ((0, 18), (1, 12), (2, 8)):
            own = random.Random(seed)
            bm = bmesh.new()
            vs = []
            for i in range(segs):
                a, rr = 2 * math.pi * i / segs, r * (1 + own.uniform(-0.09, 0.09))
                vs.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0.0012)))
            bm.faces.new(vs)
            ms.add(bm, mat, lod, only=(lod,))
    def rings(ms, spots, far=1):
        for k, (x, y, r, mat) in enumerate(spots):
            z = 0.002 + 0.0005 * k
            tn.ring(ms, mat, x, y, r, w=0.008, z=z, segs=20, lod=0, only=(0,))
            tn.ring(ms, mat, x, y, r, w=0.011, z=z, segs=12, lod=1, only=(1,))
            if k < far:
                tn.ring(ms, mat, x, y, r, w=0.016, z=z, segs=8, lod=2, only=(2,))
    def swimmers(ms, rng, n, spread, size, mid):
        for k in range(n):
            a, d = 2 * math.pi * k / n + rng.uniform(-0.4, 0.4), rng.uniform(0.25, 1.0) * spread
            tn.fish(ms, math.cos(a) * d, math.sin(a) * d, rng.uniform(0, 360), size=size * rng.uniform(0.85, 1.15), z=0.009, lod=1 if k < mid else 0)
    def leapers(ms, spots, far=1):
        for k, (x, y, yaw, size, jump) in enumerate(spots):
            tn.fish(ms, x, y, yaw, size=size, jump=jump, lod=2 if k < far else 1, mat='fish_silver')
            tn.ring(ms, 'foam', x, y, size * 0.42, w=size * 0.1, z=0.004, segs=10, lod=0, only=(0,))
    def full(ms, rng):
        water(ms, rng, 0.27)
        rings(ms, [(0, 0, 0.24, 'ripple'), (0.02, 0.01, 0.16, 'ripple'), (-0.14, 0.11, 0.085, 'ripple'), (0.14, -0.1, 0.09, 'ripple')])
        swimmers(ms, rng, 10, 0.21, 0.085, 6)
        leapers(ms, [(0.03, -0.04, 40, 0.11, 0.05), (-0.11, 0.05, 200, 0.095, 0.04), (0.13, 0.09, 310, 0.09, 0.035)], far=2)
    def half(ms, rng):
        water(ms, rng, 0.19)
        rings(ms, [(0, 0, 0.165, 'ripple'), (0.05, -0.03, 0.09, 'ripple')])
        swimmers(ms, rng, 5, 0.14, 0.08, 5)
        leapers(ms, [(-0.02, 0.02, 120, 0.095, 0.04)])
    def depleted(ms, rng):
        water(ms, rng, 0.11, mat='ripple')
        rings(ms, [(0, 0, 0.09, 'ripple')])
        swimmers(ms, rng, 1, 0.04, 0.06, 1)
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
    def pile(ms, rng):
        tn.log_pile(ms, rng, bark=bark)
    # log-pile comes last so the objects before it keep their shapes (one random stream per file)
    return [('tree-s', s), ('tree-m', m), ('tree-l', l), ('stump', stump), ('felled', felled), ('bush', bush),
            ('rock-s', rock_s), ('rock-m', rock_m), ('grass-tuft', tuft), ('log-pile', pile)]


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
    'stone-outcrop': node_items(quarry()),
    # retired with the ore resource (MD06): kept so the file can be rebuilt as it shipped until the
    # code stops pointing at it (plans/art-pilot/md06-nodes-loads/LOG.md has the replacement plan)
    'ore-outcrop': node_items(outcrop('rock_dark', accent='ore', accent2='verdigris')),
    'gold-vein': node_items(gold_vein()),
    'fish-shoal': node_items(fish_shoal()),
    'herd-sheep-goat': [('animal', sheep)],
    'herd-cattle': [('animal', cattle)],
    'vegetation-temperate': TEMPERATE,
    'vegetation-mediterranean': MEDITERRANEAN,
    'vegetation-desert': DESERT,
}

# Small objects need less than the README's 1024 atlas: one animal, a few ripples and fish.
SMALL_ATLAS = {'herd-sheep-goat': 512, 'herd-cattle': 512, 'fish-shoal': 512}


def material_transfer(src, dst):
    """UVs for a lower level of detail: every face takes the atlas point at the centre of the
    nearest LOD0 face OF ITS OWN MATERIAL (one flat colour a face). The stock transfer takes the
    nearest surface of any material, so a far level's gold seam could sample the dark rock beside
    it and a far tree's leaves its bark. The game's loader repairs such files the same way
    (src/battle/art/kitLoader.js transferLodUvs)."""
    from mathutils.kdtree import KDTree
    su = src.data.uv_layers.active.data
    samples = {}
    for face in src.data.polygons:
        name = src.data.materials[face.material_index].name
        centre = sum((src.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
        tex = sum((su[k].uv.copy() for k in face.loop_indices), Vector((0, 0))) / len(face.loop_indices)
        samples.setdefault(name, []).append((centre, tex))
    trees = {}
    for name, rows in samples.items():
        tree = KDTree(len(rows))
        for i, (centre, _tex) in enumerate(rows):
            tree.insert(centre, i)
        tree.balance()
        trees[name] = tree
    uv = dst.data.uv_layers.active or dst.data.uv_layers.new(name='UVMap')
    for face in dst.data.polygons:
        name = dst.data.materials[face.material_index].name
        if name not in trees:
            raise ValueError('a lower level uses %s, which its LOD0 does not have' % name)
        centre = sum((dst.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
        _co, index, _dist = trees[name].find(centre)
        for k in face.loop_indices:
            uv.data[k].uv = samples[name][index][1]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'nature')
    only = argv[1].split(',') if len(argv) > 1 else list(FILES)
    tm.transfer_uvs = material_transfer
    report = {}
    order = list(FILES)
    for name in only:
        items = [(obj, fn, None) for obj, fn in FILES[name]]
        # the seed is the file's own (its place in FILES), whichever files are built with it
        report[name] = tt.build_file(name, items, out_dir, atlas=SMALL_ATLAS.get(name, 1024), seed=4100 + 17 * order.index(name))
    import json
    with open(os.path.join(out_dir, 'report-%s.json' % ('all' if len(only) == len(FILES) else only[0])), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('NATURE_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
