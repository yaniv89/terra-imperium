# scripts/blender/build_nature.py
# The battle's nature files (plans/ART-MODELS-PLAN.md section 7, Wave 1; src/assets/battle/nature/
# README.md): the resource nodes stone-outcrop, ore-outcrop, gold-vein and fish-shoal (objects
# `full`, `half`, `depleted`), the herds herd-sheep-goat and herd-cattle (object `animal`), and the
# vegetation kits temperate, mediterranean and desert (tree-s, tree-m, tree-l, stump, felled, bush,
# rock-s, rock-m, grass-tuft, log-pile). One 1024 atlas per file (512 for herds and fish), LOD0..LOD2 per object, no ground plate.
# 13 October (MD06, four resources): stone, gold and fish rebuilt to be told apart at battle zoom, the grove's
# stump and felled states and the log pile; ore is retired (plans/art-pilot/md06-nodes-loads/LOG.md).
# 16 October (W12): berry-bushes.glb in four climate bands and stump-2, stump-3 in every vegetation
# kit (plans/art-pilot/berries-stumps/LOG.md).
#   blender -b --factory-startup -P scripts/blender/build_nature.py -- <out_dir> [file,file...]
import math
import os
import random
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_trees as tr  # noqa: E402


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
    def nuggets(ms, rng, spots, far=1, mid=4, fine=6):
        """Loose nuggets on the ground; the first `fine` are finely faceted at LOD0."""
        for k, (x, y, r) in enumerate(spots):
            seed = rng.randrange(1 << 30)
            tn.blob(ms, 'gold_bright', (x, y, r * 0.75), r, (1.15, 1.0, 0.8), random.Random(seed), 0.2, 2 if k < fine else 1, lod=0, only=(0,))
            if k < mid:
                tn.blob(ms, 'gold_bright', (x, y, r * 0.75), r * (1.3 if k < far else 1.0), (1.15, 1.0, 0.8), random.Random(seed), 0.15, 1,
                        lod=2 if k < far else 1, only=(1, 2) if k < far else (1,))
    def lode(ms, rng, spots, mid=2):
        """The exposed lode: angular chunks of gold piled up a cleft in the rock's front face
        (the reference sheet's reading: dark rock, a seam of nuggets, not stripes)."""
        for k, (x, y, z, r) in enumerate(spots):
            tn.blob(ms, 'gold_bright', (x, y, z), r, (1.1, 1.0, 0.9), rng, 0.22, 1, lod=1 if k < mid else 0, yaw=rng.uniform(0, 360))
    def full(ms, rng):
        # (x, y, radius, height), its levels of detail, its seams (height share, tilt, dip, thickness):
        # steep and thin, so they read as cracks filled with gold, about a sixth of the rock's face
        crag3(ms, 'gold_rock', 0.0, 0.07, 0.15, 0.33, rng, (3, 2, 1), [(0.35, 68, 255, 0.022), (0.55, 74, 40, 0.02)])
        crag3(ms, 'gold_rock', -0.18, -0.03, 0.115, 0.22, rng, (3, 1, 1), [(0.45, 66, 215, 0.02)])
        crag3(ms, 'gold_rock', 0.18, -0.05, 0.105, 0.18, rng, (2, 1, None), [(0.45, 70, 310, 0.03)])
        crag3(ms, 'gold_rock', 0.03, -0.17, 0.075, 0.1, rng, (2, None, None))
        lode(ms, rng, [(0.03, -0.1, 0.03, 0.042), (-0.03, -0.07, 0.085, 0.036), (0.035, -0.05, 0.135, 0.032), (0.0, -0.025, 0.185, 0.027), (-0.05, -0.115, 0.02, 0.03)])
        nuggets(ms, rng, [(-0.1, -0.21, 0.03), (0.15, -0.2, 0.026), (-0.24, -0.17, 0.022), (0.28, 0.06, 0.022), (0.22, -0.23, 0.018), (-0.17, -0.25, 0.018)], far=1, mid=2, fine=2)
        rubble(ms, 'gold_rock', rng, 8, 0.34)
    def half(ms, rng):
        crag3(ms, 'gold_rock', 0.0, 0.05, 0.125, 0.18, rng, (3, 2, 1), [(0.45, 68, 250, 0.02)])
        crag3(ms, 'gold_rock', -0.15, -0.05, 0.09, 0.115, rng, (2, 1, None), [(0.5, 66, 210, 0.026)])
        lode(ms, rng, [(0.03, -0.075, 0.025, 0.034), (-0.01, -0.05, 0.07, 0.028)], mid=1)
        nuggets(ms, rng, [(0.1, -0.15, 0.024), (-0.05, -0.19, 0.02), (0.2, -0.04, 0.018)], far=1, mid=2, fine=1)
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

# Since 14 October (MD05, MD14: plans/art-pilot/md05-trees/LOG.md) a kit holds two to four SPECIES,
# each at three sizes (ti_trees.py). Object names: the first species is tree-s, tree-m, tree-l (the
# names the game has always read), the second tree-s-2, tree-m-2, tree-l-2, the third tree-s-3 ...
# The battle picks a species and a size per tree (src/battle/art/vegetationProps.js).

SIZES = ('s', 'm', 'l')


def species_items(species, first=1):
    """The tree objects of a list of species, numbered from `first` (1 has no suffix). Every tree
    has its own random stream (from its name), so adding a species never reshapes another."""
    out = []
    for k, fn in enumerate(species):
        for i, size in enumerate(SIZES):
            name = 'tree-%s%s' % (size, '' if first + k == 1 else '-%d' % (first + k))
            seed = zlib.crc32(('%s/%s' % (fn.__name__, name)).encode())
            out.append((name, lambda ms, rng, fn=fn, i=i, seed=seed: fn(ms, random.Random(seed), i)))
    return out


def kit(species, bark, leaf, bush_leaf, rock_mat, tuft_mat, retired=(), tuft=None):
    """A kit's objects. `retired` are the three trees the kit had before the species (built into
    nothing, only to draw the random numbers they drew, so the stump, the felled trunk, the bush
    and the rocks after them keep their shapes)."""
    def stump(ms, rng):
        for old in retired:
            old(tm.Mesher(), rng)
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
    def grass(ms, rng):
        if tuft:
            tuft(ms, rng)
        else:
            tn.grass_tuft(ms, rng, 0.05, mat=tuft_mat)
    def pile(ms, rng):
        tn.log_pile(ms, rng, bark=bark)
    # log-pile comes last of the old objects so those before it keep their shapes (one random
    # stream per file); the trees draw from streams of their own
    return [('stump', stump), ('felled', felled), ('bush', bush), ('rock-s', rock_s), ('rock-m', rock_m),
            ('grass-tuft', grass), ('log-pile', pile)] + species_items(species)


TEMPERATE = kit((tr.oak, tr.beech, tr.birch), 'bark', 'foliage', 'foliage', 'rock', 'tuft', retired=(
    lambda ms, rng: tn.broadleaf(ms, rng, 0.38, 0.1, 0.012, bark='birch', leaf='foliage_light', shape=(0.9, 0.9, 1.3), crown_z=0.45),   # birch
    lambda ms, rng: tn.broadleaf(ms, rng, 0.6, 0.24, 0.03, bark='bark', leaf='foliage', shape=(1.1, 1.1, 0.75), crown_z=0.45),           # oak
    lambda ms, rng: tn.broadleaf(ms, rng, 0.8, 0.22, 0.03, bark='bark_pale', leaf='foliage_dark', shape=(1.0, 1.0, 1.25), crown_z=0.4),  # beech
))

MEDITERRANEAN = kit((tr.olive, tr.stone_pine, tr.cypress), 'bark_pale', 'olive_leaf', 'olive_leaf', 'rock', 'tuft_dry', retired=(
    lambda ms, rng: tn.broadleaf(ms, rng, 0.34, 0.15, 0.024, bark='bark_pale', leaf='olive_leaf', shape=(1.1, 1.1, 0.7), crown_z=0.4, lean=0.12),  # olive
    lambda ms, rng: tn.umbrella(ms, rng, 0.62, 0.26),                                                                                        # stone pine
    lambda ms, rng: tn.spire(ms, rng, 0.82, 0.07),                                                                                           # cypress
))

DESERT = kit((tr.date_palm, tr.acacia, tr.tamarisk), 'bark_pale', 'palm_leaf', 'dry_shrub', 'sandstone', 'tuft_dry', retired=(
    lambda ms, rng: tn.broadleaf(ms, rng, 0.3, 0.13, 0.016, bark='bark', leaf='dry_shrub', shape=(1.1, 1.1, 0.7), crown_z=0.3),  # tamarisk
    lambda ms, rng: tn.acacia(ms, rng, 0.48, 0.28),                                                                              # umbrella thorn
    lambda ms, rng: tn.palm(ms, rng, 0.8, frond=0.3),                                                                            # date palm
))

# The steppe (MD14): poplars, wind-bent elms, saxaul, tall feather grass.
STEPPE = kit((tr.poplar, tr.elm, tr.saxaul), 'bark_pale', 'dry_shrub', 'dry_shrub', 'rock', 'tuft_dry', tuft=tr.tall_grass)


def remaining_kit(kit_name, species):
    """The conifer, tropical or cold kit: its stump, felled trunk, bush, rocks and grass tuft from
    ti_vegetation_remaining.py exactly as build_vegetation_remaining.py built them (its layouts,
    its seed in REMAINING_SEEDS, its trees run first into nothing so the random stream after them
    is the same), and the trees from ti_trees.py in place of its own. Its own trees drew their far
    levels badly: the spruce's LOD1 as striped dark and pale cones, the palm's far fronds near
    black. Imported only here: the helper adds its materials to every file built after it."""
    import ti_vegetation_remaining as vr
    import ti_nature_wave7
    vr.tn = ti_nature_wave7  # the stump and felled trunk as checkpoint 38 shipped them (MD06 redrew ti_nature's)
    old = vr.items(kit_name)
    retired = [layout for _name, layout, _ground in old[:3]]
    rest = [(name, layout) for name, layout, _ground in old[3:]]
    first_name, first_layout = rest[0]

    def first(ms, rng):
        for layout in retired:
            layout(tm.Mesher(), rng)
        first_layout(ms, rng)
    return [(first_name, first)] + rest[1:] + species_items(species)


# The seeds build_vegetation_remaining.py gave the kits it built (7210 + 37 * its kit index).
REMAINING_SEEDS = {'vegetation-conifer': 7210, 'vegetation-tropical': 7247, 'vegetation-cold': 7284}


def node_items(states, suffix=''):
    full, half, depleted = states
    return [('full' + suffix, full), ('half' + suffix, half), ('depleted' + suffix, depleted)]


# ---- berry bushes (16 October, W12: the battle's food node of the field, scattered in pairs) ------
# One file, berry-bushes.glb, four climate bands: the plain `full`, `half`, `depleted` are the
# temperate bramble with red berries, and `<state>-dry` (a low grey-green shrub with near-black
# berries: myrtle, juniper), `<state>-cold` (ground-hugging bilberry with blue berries) and
# `<state>-tropical` (a glossy broadleaf bush with orange fruit) the others. The game picks the band
# from the battle's vegetation kit (src/battle/art/vegetation.js berryBand). What must read at battle
# zoom on a phone (a node about 30 px wide) is COLOUR: the berries are clusters far larger than life,
# in hues the grass never has, on the upper faces the camera sees. Full is a mound studded with them,
# half is thinner with a few clusters and bare twigs, depleted is a low dull bush of twigs with no
# berry at all (and no leaf the colour of the full one).

BERRY_MATS = {
    'berry_leaf': (['#2c5520', '#386626', '#23461a', '#2f5a22'], 14.0),      # bramble: dark, so the red sings
    'berry_red': (['#e8182c', '#ff3043', '#c40f22'], 24.0),
    'berry_leaf_dry': (['#56683f', '#637548', '#4a5c36'], 16.0),           # myrtle / juniper olive-green
    'berry_black': (['#4a1868', '#65288a', '#371150'], 24.0),
    'berry_leaf_cold': (['#35522c', '#416336', '#2b4524'], 14.0),          # bilberry
    'berry_blue': (['#3f66d8', '#5b82f0', '#2f50b4'], 24.0),
    'berry_leaf_trop': (['#2f7a2a', '#3f9234', '#256a22'], 12.0),          # glossy broadleaf
    'berry_orange': (['#ff8a10', '#ffb12a', '#f06808'], 24.0),
    'berry_spent': (['#5d6236', '#6b6f3e', '#4f5530'], 14.0),              # a picked bush gone dull
    'berry_twig': (['#6a4a34', '#7c5a40', '#55392a'], 20.0),
}
for _n in BERRY_MATS:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
for _n in ('berry_leaf', 'berry_leaf_dry', 'berry_leaf_cold', 'berry_leaf_trop', 'berry_spent', 'berry_red', 'berry_black', 'berry_blue', 'berry_orange'):
    tt.SMOOTH.add(_n)


def berry_materials():
    for name, (colors, scale) in BERRY_MATS.items():
        tm.mat_simple(name, colors, scale=scale, rough=0.45 if name.startswith('berry_') and 'leaf' not in name and name not in ('berry_spent', 'berry_twig') else 0.85, bump=0.4)


if not any(n == 'berries' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('berries', berry_materials))


def octa(ms, mat, at, r, lod=2, only=None, squash=1.0, top=False):
    """A berry cluster for the far levels: an octahedron, 8 triangles (`top`: its upper half only,
    4 triangles, for a cluster pressed into the bush)."""
    bm = bmesh.new()
    x, y, z = at
    p = [bm.verts.new(v) for v in ((x + r, y, z), (x - r, y, z), (x, y + r, z), (x, y - r, z), (x, y, z + r * squash), (x, y, z - r * squash))]
    for a, b in ((0, 2), (2, 1), (1, 3), (3, 0)):
        bm.faces.new((p[a], p[b], p[4]))
        if not top:
            bm.faces.new((p[b], p[a], p[5]))
    ms.add(bm, mat, lod, only=only)


# A band: leaf and berry materials, bush layouts per state [(x, y, radius, height share)], the berry
# size, how many clusters a state carries, and the shape of a bush (`flat` = its height over width).
BERRY_BANDS = {
    'temperate': dict(leaf='berry_leaf', fruit='berry_red', flat=0.78, berry=0.0125, canes=True,
                      full=[(-0.1, 0.06, 0.13), (0.12, 0.02, 0.115), (0.01, -0.13, 0.1)], clusters=(24, 9)),
    'dry': dict(leaf='berry_leaf_dry', fruit='berry_black', flat=0.55, berry=0.0125, canes=False,
                full=[(-0.11, 0.05, 0.14), (0.12, 0.04, 0.12), (0.0, -0.13, 0.11)], clusters=(24, 9)),
    'cold': dict(leaf='berry_leaf_cold', fruit='berry_blue', flat=0.45, berry=0.012, canes=False,
                 full=[(-0.12, 0.07, 0.11), (0.1, 0.08, 0.1), (0.13, -0.1, 0.09), (-0.07, -0.11, 0.1)], clusters=(20, 8)),
    'tropical': dict(leaf='berry_leaf_trop', fruit='berry_orange', flat=0.85, berry=0.016, canes=False, leaves=True,
                     full=[(-0.09, 0.05, 0.14), (0.12, 0.0, 0.12), (0.0, -0.13, 0.1)], clusters=(18, 7)),
}


def _bush_mass(ms, mat, x, y, r, flat, rng, far=True, lod1=True):
    """One bush: two clumps at LOD0 (80 triangles each), one rounded mass at LOD1 and LOD2."""
    seed = rng.randrange(1 << 30)
    own = random.Random(seed)
    tn.blob(ms, mat, (x, y, r * flat * 0.45), r, (1.0, 0.92, flat), own, 0.1, 2, lod=0, only=(0,), cut=-r * 0.45)
    a = own.uniform(0, 2 * math.pi)
    tn.blob(ms, mat, (x + math.cos(a) * r * 0.45, y + math.sin(a) * r * 0.45, r * flat * 0.35), r * 0.7, (1.0, 1.0, flat), own, 0.12, 2, lod=0, only=(0,), cut=-r * 0.35)
    if lod1:
        tn.blob(ms, mat, (x, y, r * flat * 0.45), r * 1.08, (1.0, 0.95, flat), random.Random(seed), 0.08, 1, lod=1, only=(1,), cut=-r * 0.45)
    if far:
        tn.blob(ms, mat, (x, y, r * flat * 0.45), r * 1.12, (1.0, 0.95, flat), random.Random(seed), 0.06, 1, lod=2, only=(2,), cut=-r * 0.45)


def _surface(x, y, r, flat, a, up):
    """A point on a bush's upper surface: `a` the bearing, `up` the elevation (radians)."""
    rr = r * 1.0
    return (x + math.cos(a) * math.cos(up) * rr * 0.98, y + math.sin(a) * math.cos(up) * rr * 0.9,
            r * flat * 0.45 + math.sin(up) * rr * flat * 0.98)


def _clusters(ms, band, bushes, n, rng, far_n):
    """`n` berry clusters spread over the bushes' upper faces (a golden-angle spiral a bush), four
    berries a cluster at LOD0 (octahedra, smooth-shaded: 8 triangles a berry), one larger half
    octahedron a cluster at LOD1, and `far_n` of them on the two bushes LOD2 keeps, larger again."""
    b = band['berry']
    fruit = band['fruit']
    per = max(1, math.ceil(n / len(bushes)))
    for k in range(n):
        i, j = k % len(bushes), k // len(bushes)
        x, y, r = bushes[i]
        a = j * 2.39996 + i * 1.3 + rng.uniform(-0.25, 0.25)
        up = 0.3 + 1.05 * (j + 0.5) / per + rng.uniform(-0.1, 0.1)
        cx, cy, cz = _surface(x, y, r, band['flat'], a, min(1.45, up))
        for q in range(4):
            qa = q * math.pi / 2 + rng.uniform(-0.4, 0.4)
            d = b * (1.25 if q else 0.0)
            octa(ms, fruit, (cx + math.cos(qa) * d, cy + math.sin(qa) * d, cz + (b * 0.9 if q == 0 else rng.uniform(0, b * 0.4))),
                 b * rng.uniform(0.95, 1.2), lod=0, only=(0,))
        octa(ms, fruit, (cx, cy, cz + b * 0.4), b * 2.5, lod=1, only=(1,), top=True)
        if i < 2 and j * 2 + i < far_n:  # on the two bushes LOD2 keeps, standing out of its larger mass
            fx, fy, fz = _surface(x, y, r * 1.14, band['flat'], a, min(1.45, up))
            octa(ms, fruit, (fx, fy, fz + b * 0.3), b * 3.4, lod=2, only=(2,), squash=0.9, top=True)


def _canes(ms, band, bushes, rng, n, mat=None):
    """Arching bramble canes (or bare twigs on a picked bush), LOD0 only."""
    mat = mat or 'berry_twig'
    for k in range(n):
        x, y, r = bushes[k % len(bushes)]
        a = rng.uniform(0, 2 * math.pi)
        base = (x + math.cos(a) * r * 0.5, y + math.sin(a) * r * 0.5, r * band['flat'] * 0.5)
        mid = (x + math.cos(a) * r * 1.15, y + math.sin(a) * r * 1.15, r * band['flat'] * (1.15 + rng.uniform(0, 0.3)))
        tip = (x + math.cos(a) * r * 1.55, y + math.sin(a) * r * 1.55, r * band['flat'] * rng.uniform(0.35, 0.7))
        tn.limb(ms, mat, base, mid, 0.006, 0.004, segs=3, lod=0, caps=False)
        tn.limb(ms, mat, mid, tip, 0.004, 0.0015, segs=3, lod=0, caps=False)


def _twigs(ms, x, y, r, h, rng, n, far=False):
    """Bare twigs fanning up out of a picked bush."""
    for k in range(n):
        a = 2 * math.pi * k / n + rng.uniform(-0.3, 0.3)
        tip = (x + math.cos(a) * r * rng.uniform(0.7, 1.1), y + math.sin(a) * r * rng.uniform(0.7, 1.1), h * rng.uniform(0.8, 1.15))
        tn.limb(ms, 'berry_twig', (x + math.cos(a) * r * 0.15, y + math.sin(a) * r * 0.15, 0.0), tip, 0.006, 0.002, segs=3, lod=0, caps=False)
        if far and k < 3:
            tn.limb(ms, 'berry_twig', (x, y, 0.0), tip, 0.009, 0.004, segs=3, lod=1, only=(1,), caps=False)


def _leaves(ms, mat, bushes, flat, rng, n):
    """Big glossy leaves standing out of a tropical bush (two triangles each, LOD0)."""
    for k in range(n):
        x, y, r = bushes[k % len(bushes)]
        a = rng.uniform(0, 2 * math.pi)
        up = rng.uniform(0.1, 0.8)
        cx, cy, cz = _surface(x, y, r, flat, a, up)
        d = Vector((math.cos(a), math.sin(a), 0.35)).normalized()
        side = Vector((-math.sin(a), math.cos(a), 0)) * 0.022
        tip = Vector((cx, cy, cz)) + d * 0.06
        base = Vector((cx, cy, cz)) - d * 0.01
        mid = (base + tip) / 2 + Vector((0, 0, 0.008))
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in (base, mid + side, tip, mid - side)]
        bm.faces.new(vs)
        ms.add(bm, mat, 0, only=(0,))


def berry_bushes(band_name):
    band = BERRY_BANDS[band_name]
    leaf, flat = band['leaf'], band['flat']
    n_full, n_half = band['clusters']

    def full(ms, rng):
        bushes = band['full']
        for k, (x, y, r) in enumerate(bushes):
            _bush_mass(ms, leaf, x, y, r, flat, rng, far=k < 2)
        if band['canes']:
            _canes(ms, band, bushes, rng, 6)
        if band.get('leaves'):
            _leaves(ms, leaf, bushes, flat, rng, 14)
        _clusters(ms, band, bushes, n_full, rng, far_n=5)

    def half(ms, rng):
        # picked over: thinner bushes (one clump gone), bare twigs out of the picked side, a few clusters
        bushes = [(x * 0.95, y * 0.95, r * 0.82) for x, y, r in band['full'][:3]]
        for k, (x, y, r) in enumerate(bushes):
            _bush_mass(ms, leaf, x, y, r, flat * 0.9, rng, far=k < 2)
        for x, y, r in bushes[:2]:
            _twigs(ms, x + r * 0.4, y - r * 0.3, r * 0.6, r * flat * 1.25, rng, 4, far=True)
        if band['canes']:
            _canes(ms, band, bushes, rng, 3)
        if band.get('leaves'):
            _leaves(ms, leaf, bushes, flat * 0.9, rng, 6)
        _clusters(ms, dict(band, flat=flat * 0.9), bushes, n_half, rng, far_n=2)

    def depleted(ms, rng):
        # stripped: low dull mounds and bare twigs, no berry and no leaf of the full bush's colour
        bushes = [(x * 0.9, y * 0.9, r * 0.62) for x, y, r in band['full'][:3]]
        for k, (x, y, r) in enumerate(bushes):
            _bush_mass(ms, 'berry_spent', x, y, r, flat * 0.7, rng, far=k < 2)
            _twigs(ms, x, y, r * 1.1, r * 1.3, rng, 5, far=k == 0)
        for k in range(6):  # dropped leaves on the ground
            a, d = rng.uniform(0, 2 * math.pi), rng.uniform(0.12, 0.26)
            ms.box('berry_spent', (0.02, 0.014, 0.003), at=(math.cos(a) * d, math.sin(a) * d, 0), rot_z=rng.uniform(0, 180), lod=0)
    return full, half, depleted


def berry_items():
    out = node_items(berry_bushes('temperate'))
    for band in ('dry', 'cold', 'tropical'):
        out += node_items(berry_bushes(band), '-' + band)
    return out


# ---- stump variants (16 October, W12: every tree is wood, a felled tree leaves a stump) -----------
# Two more stumps a kit beside its `stump`: `stump-2` a tall trunk snapped off, jagged, its broken top
# lying beside it, and `stump-3` a low sawn stump with the cut log beside it and chips round it. The
# battle picks one of the three for each felled tree by a hash of its tile (render/treeFelling.js).
# Each draws from a random stream of its own (from the kit and its name), never from the file's, so
# every other object and the file's fringe keep their shapes. Bark: the kit's own trees' bark.

def _jagged_trunk(ms, bark, cut, r, h, own, segs, lod, only):
    """A trunk snapped off: a tube whose top ring rises and falls in splinters round a pale core."""
    bm = bmesh.new()
    bot, top = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        bot.append(bm.verts.new((math.cos(a) * r * 1.15, math.sin(a) * r * 1.15, -0.008)))
        hh = h * (1.0 + (0.45 if i % 2 == 0 else -0.05) * own.uniform(0.6, 1.0) * (1.4 if i == 0 else 1.0))
        top.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, hh)))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    ms.add(bm, bark, lod, only=only)
    # the broken wood: a pale cone inside the ring, peaking off centre
    bm = bmesh.new()
    ring = [bm.verts.new((math.cos(2 * math.pi * i / segs) * r * 0.97, math.sin(2 * math.pi * i / segs) * r * 0.97, h * 0.92)) for i in range(segs)]
    peak = bm.verts.new((r * 0.25, -r * 0.15, h * 1.35))
    for i in range(segs):
        bm.faces.new((ring[i], ring[(i + 1) % segs], peak))
    ms.add(bm, cut, lod, only=only)


def stump_variants(kit_name, bark, cut, bark2=None):
    bark2 = bark2 or bark

    def own(name):
        return random.Random(zlib.crc32(('stump/%s/%s' % (kit_name, name)).encode()))

    def stump2(ms, _rng):
        o = own('stump-2')
        r, h = 0.042, 0.11
        _jagged_trunk(ms, bark, cut, r, h, o, 8, 0, (0,))
        _jagged_trunk(ms, bark, cut, r * 1.05, h, random.Random(1), 5, 1, (1, 2))
        for k in range(4):  # roots
            a = 2 * math.pi * k / 4 + o.uniform(-0.3, 0.3)
            tn.limb(ms, bark, (0, 0, h * 0.3), (math.cos(a) * r * 2.4, math.sin(a) * r * 2.4, 0.0), r * 0.42, r * 0.14, segs=4, lod=0)
        # the broken-off top lying beside it, its splintered end toward the stump
        a = o.uniform(0.6, 1.2)
        p0 = Vector((math.cos(a) * r * 2.2, math.sin(a) * r * 2.2, r * 0.85))
        p1 = p0 + Vector((math.cos(a), math.sin(a), -0.02)) * 0.3
        tn.limb(ms, bark, p0, p1, r * 0.9, r * 0.55, segs=7, lod=0, caps=False)
        tn.disc(ms, cut, p0 - (p1 - p0).normalized() * 0.0004, (p1 - p0).normalized(), r * 0.9, 7, lod=0, flip=True)
        tn.limb(ms, bark, p0, p1, r * 0.95, r * 0.6, segs=4, lod=2, only=(1, 2))
        for k in range(2):  # its snapped limbs
            q = p0.lerp(p1, 0.55 + 0.3 * k)
            s = 1 if k % 2 else -1
            tn.limb(ms, bark, q, q + Vector((-math.sin(a) * s * 0.07, math.cos(a) * s * 0.07, 0.03)), r * 0.28, r * 0.12, segs=4, lod=0)
        for k in range(5):  # splinters and bark on the ground
            b, d = o.uniform(0, 2 * math.pi), o.uniform(1.6, 3.4) * r
            ms.box(cut if k % 2 else bark, (r * 0.7, r * 0.18, r * 0.1), at=(math.cos(b) * d, math.sin(b) * d, 0), rot_z=o.uniform(0, 180), lod=0)

    def stump3(ms, _rng):
        o = own('stump-3')
        r, h = 0.048, 0.032
        for segs, lod, only in ((9, 0, (0,)), (6, 2, (1, 2))):
            tn.limb(ms, bark2, (0, 0, -0.008), (0, 0, h), r * 1.12, r, segs=segs, lod=lod, only=only, caps=False)
            tn.disc(ms, cut, (0, 0, h), (0, 0, 1), r, segs, lod=lod, only=only)
        for k in range(3):  # roots
            a = 2 * math.pi * k / 3 + o.uniform(-0.3, 0.3) + 0.5
            tn.limb(ms, bark2, (0, 0, h * 0.4), (math.cos(a) * r * 2.1, math.sin(a) * r * 2.1, 0.0), r * 0.4, r * 0.14, segs=4, lod=0)
        # the trunk, sawn into a log, lying beside it
        a = o.uniform(-0.4, 0.2)
        c = Vector((r * 0.6, -r * 2.6, 0))
        d = Vector((math.cos(a), math.sin(a), 0))
        lr = r * 0.85
        p0, p1 = c - d * 0.16 + Vector((0, 0, lr)), c + d * 0.16 + Vector((0, 0, lr * 0.92))
        tn.log(ms, p0, p1, lr, bark=bark2, ends=cut, segs=7, lod=0, only=(0,), taper=0.92)
        tn.log(ms, p0, p1, lr, bark=bark2, ends=cut, segs=5, lod=2, only=(1, 2), taper=0.92)
        for k in range(9):  # fresh chips round the stump
            b, dd = o.uniform(0, 2 * math.pi), o.uniform(1.5, 3.6) * r
            ms.box(cut, (r * 0.45, r * 0.26, r * 0.1), at=(math.cos(b) * dd, math.sin(b) * dd + r * 0.6, 0), rot_z=o.uniform(0, 180), lod=1 if k < 3 else 0)
    return [('stump-2', stump2), ('stump-3', stump3)]


FILES = {
    'stone-outcrop': node_items(quarry()),
    # retired with the ore resource (MD06): kept so the file can be rebuilt as it shipped until the
    # code stops pointing at it (plans/art-pilot/md06-nodes-loads/LOG.md has the replacement plan)
    'ore-outcrop': node_items(outcrop('rock_dark', accent='ore', accent2='verdigris')),
    'gold-vein': node_items(gold_vein()),
    'fish-shoal': node_items(fish_shoal()),
    'herd-sheep-goat': [('animal', sheep)],
    'herd-cattle': [('animal', cattle)],
    # (the stump variants go after every older object of a kit: see stump_variants)
    'vegetation-temperate': TEMPERATE + stump_variants('temperate', 'bark_oak', 'cut_wood'),
    'vegetation-mediterranean': MEDITERRANEAN + stump_variants('mediterranean', 'bark_olive', 'cut_wood', 'bark_red'),
    'vegetation-desert': DESERT + stump_variants('desert', 'bark_oak', 'cut_wood', 'bark_dark'),
    # Log piles for the conifer, tropical and cold kits, which have no `log-pile` of their own: the
    # game stands `log-pile-<kit>` beside such a kit's grove (economyLayer.js).
    'log-piles': [
        ('log-pile-conifer', lambda ms, rng: tn.log_pile(ms, rng, bark='bark_pine', ends='cut_pine')),                  # pale pine
        ('log-pile-tropical', lambda ms, rng: tn.log_pile(ms, rng, length=0.27, r=0.035, bark='bark_hardwood', ends='cut_hardwood')),  # dark hardwood
        ('log-pile-cold', lambda ms, rng: tn.log_pile(ms, rng, length=0.24, r=0.023, bark=('birch', 'bark_larch', 'birch'), rows=(4, 3, 2), far_rows=(0,))),  # thin birch and larch; the far level keeps the bottom row, thicker
    ],
    # New files go last: a file's seed is its place in this list.
    'vegetation-steppe': STEPPE + stump_variants('steppe', 'bark_beech', 'cut_wood', 'bark_oak'),
    # The kits first built by build_vegetation_remaining.py (MD05, 14 October: their trees are
    # replaced, everything else is theirs, built as they built it; see remaining_kit)
    'vegetation-conifer': lambda: remaining_kit('conifer', (tr.spruce, tr.scots_pine, tr.fir)) + stump_variants('conifer', 'bark_dark', 'cut_pine', 'bark_red'),
    'vegetation-tropical': lambda: remaining_kit('tropical', (tr.jungle_giant, tr.coconut_palm, tr.banana)) + stump_variants('tropical', 'bark_jungle', 'cut_hardwood'),
    'vegetation-cold': lambda: remaining_kit('cold', (tr.larch, tr.dwarf_birch, tr.tundra_shrub)) + stump_variants('cold', 'bark_dark', 'cut_wood', 'bark_larch'),
    # W12 (16 October): the berry bush food node, four climate bands (see berry_bushes)
    'berry-bushes': berry_items(),
}

# Small objects need less than the README's 1024 atlas: one animal, a few ripples and fish.
SMALL_ATLAS = {'herd-sheep-goat': 512, 'herd-cattle': 512, 'fish-shoal': 512, 'log-piles': 512}


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


def soft_crown_uvs(src, dst):
    """UVs for the far levels of a soft crown (ti_trees.py). A crown is clumps pushed into each
    other: the faces inside are baked black (no light reaches them), and the one round mass that
    stands for the crown from far would take its colour from them wherever it runs through the
    clumps. So every far face of a soft leaf material takes one atlas point: the centre of the
    nearest full-model face of its material that sees the open air and faces the same way."""
    from mathutils.bvhtree import BVHTree
    sm, dm = src.data, dst.data
    soft = [m.name in tt.SMOOTH for m in dm.materials]
    if not any(soft[p.material_index] for p in dm.polygons):
        return
    bvh = BVHTree.FromPolygons([v.co for v in sm.vertices], [tuple(p.vertices) for p in sm.polygons])
    su = sm.uv_layers.active.data
    open_faces, all_faces = {}, {}
    for face in sm.polygons:
        name = sm.materials[face.material_index].name
        if name not in tt.SMOOTH:
            continue
        row = (face.center.copy(), face.normal.copy(), sum((su[k].uv.copy() for k in face.loop_indices), Vector((0, 0))) / len(face.loop_indices))
        all_faces.setdefault(name, []).append(row)
        if bvh.ray_cast(face.center + face.normal * 1e-4, face.normal, 0.15)[0] is None and face.normal.z > -0.35:
            open_faces.setdefault(name, []).append(row)
    # and of those, not the darkest third: a face in the crease where two clumps meet sees the air
    # but is baked dark, and one such face would show as a dark triangle on the far crown
    base = next((im for im in bpy.data.images if im.name.endswith('_base')), None)
    if base is not None:
        import numpy as np
        w, h = base.size
        px = np.array(base.pixels[:], dtype=np.float32).reshape(h, w, 4)

        def lum(t):
            x, y = min(w - 1, max(0, int(t.x * w))), min(h - 1, max(0, int(t.y * h)))
            return float(px[y, x, 0] * 0.3 + px[y, x, 1] * 0.59 + px[y, x, 2] * 0.11)
        for name, rows in open_faces.items():
            if len(rows) > 6:
                cut = sorted(lum(r[2]) for r in rows)[len(rows) // 3]
                open_faces[name] = [r for r in rows if lum(r[2]) >= cut]
    uv = dm.uv_layers.active.data
    for face in dm.polygons:
        if not soft[face.material_index]:
            continue
        name = dm.materials[face.material_index].name
        rows = open_faces.get(name) or all_faces.get(name)
        if not rows:
            continue
        c, n = face.center, face.normal
        pick = min(rows, key=lambda r: (r[0] - c).length - 0.2 * r[1].dot(n))
        for k in face.loop_indices:
            uv[k].uv = pick[2]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'nature')
    only = argv[1].split(',') if len(argv) > 1 else list(FILES)
    tm.transfer_uvs = material_transfer
    by_face = tm.transfer_uvs_by_face  # what ti_town.build_file gives the lower levels

    def transfer(src, dst):
        by_face(src, dst)
        soft_crown_uvs(src, dst)
    tm.transfer_uvs_by_face = transfer
    report = {}
    order = list(FILES)
    only = sorted(only, key=lambda n: n in REMAINING_SEEDS)  # those import their helper's materials: last
    for name in only:
        entries = FILES[name]() if callable(FILES[name]) else FILES[name]
        items = [(obj, fn, None) for obj, fn in entries]
        # the seed is the file's own (its place in FILES), whichever files are built with it
        seed = REMAINING_SEEDS.get(name, 4100 + 17 * order.index(name))
        report[name] = tt.build_file(name, items, out_dir, atlas=SMALL_ATLAS.get(name, 1024), seed=seed)
    import json
    with open(os.path.join(out_dir, 'report-%s.json' % ('all' if len(only) == len(FILES) else only[0])), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('NATURE_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
