# scripts/blender/build_town_classical_regional_big.py
# Classical Age `town-big-<v>` for the Levant, Europe, Indic and Sinic kits (H-25, audits/mobile-campaign-2026-10-20:
# their big towns borrowed another kit). The style's own medium town (build_town_classical_<style>_medium_<v>.py: its
# streets, landmarks, market and houses, a 60 m square) is kept whole at the centre of an 80 m town, and a ring of the
# kit's houses (<style>_house, the same slots) is laid round it at RING, facing the centre, in the four bands either
# side of the axes where the ring clears the medium town's corners (BAND degrees), leaving the south street's gap.
# The ring's houses go without their small extras (LIGHT); over the town budget each level is trimmed as a whole.
#   blender -b --factory-startup -P scripts/blender/build_town_classical_regional_big.py -- <out_dir> <style> <a|b> [atlas_px]
import importlib
import math
import os
import random
import re
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_town_stone as bs  # noqa: E402  (trim)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT, STYLE, VARIANT = argv[0], argv[1], argv[2]
ATLAS = int(argv[3]) if len(argv) > 3 else 2048
assert STYLE in ('levant', 'europe', 'indic', 'sinic') and VARIANT in ('a', 'b'), argv

medium = importlib.import_module('build_town_classical_%s_medium_%s' % (STYLE, VARIANT))
kit = importlib.import_module('ti_%s_classical' % STYLE)
house = getattr(kit, '%s_house' % STYLE)

RING = 3.5         # the ring's radius (model units, 10 m)
BAND = 26.0        # half the arc either side of each axis that clears the medium town's corners
GATE = 12.0        # half the gap left for the south street, degrees
W, D = 0.78, 0.64  # a ring house's frontage and depth
BUDGET = (58000, 9500, 1450)  # under the town budget, as the Future towns
KINDS = ('poor', 'common', 'poor', 'common', 'poor')
# the ring's houses without their small extras (the medium town keeps its own)
LIGHT = dict(jar_n=0, cloth=False, awning=False, terrace=False, garden=False, stall=False, tree_in=False)


def ring_slots():
    slots, k = [], 0
    step = math.degrees((W + 0.12) / RING)
    for axis in (0, 90, 180, 270):
        n = int(2 * BAND // step) + 1
        for i in range(n):
            a = axis - BAND + (2 * BAND) * (i + 0.5) / n
            if abs(((a - 270 + 180) % 360) - 180) < GATE:  # the south street
                continue
            r = math.radians(a)
            slots.append(dict(LIGHT, x=RING * math.cos(r), y=RING * math.sin(r), w=W, d=D, yaw=a - 90, kind=KINDS[k % len(KINDS)]))
            k += 1
    return slots


def tris(parts, lod):
    return sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in parts if lod in bs._levels(p))


def light_house(ms, rng, slot):
    """The kit's house with LIGHT's extras switched off, dropping any of them this kind of house does not take."""
    slot = dict(slot)
    state = rng.getstate()
    while True:
        n = len(ms.parts)
        try:
            return house(ms, rng, slot)
        except TypeError as e:
            key = re.search(r"unexpected keyword argument '(\w+)'", str(e))
            if not key or key.group(1) not in LIGHT:
                raise
            del ms.parts[n:]
            slot.pop(key.group(1))
            rng.setstate(state)


def layout(ms, rng):
    medium.layout(ms, rng)
    first = len(ms.parts)
    ring = random.Random(zlib.crc32(('%s-%s' % (STYLE, VARIANT)).encode()))
    for slot in ring_slots():
        light_house(ms, ring, slot)
    # the town budget (60,000 / 10,000 / 1,500)
    print('RING', len(ms.parts) - first, 'parts', tris(ms.parts[first:], 0), 'of', tris(ms.parts, 0), flush=True)
    bs.trim(ms, 0, BUDGET[0])
    bs.trim(ms, 1, BUDGET[1])
    bs.trim(ms, 2, BUDGET[2])


if __name__ == '__main__':
    name = 'town-big-%s' % VARIANT
    file_name = 'classical-town-big-%s-%s' % (VARIANT, STYLE)
    g = dict(kit.PAVED)
    g.update(getattr(medium, 'GROUND', {}) or {})
    g.update(rx=4.0, ry=4.0)
    tt.build_file(file_name, [(name, layout, g)], OUT, atlas=ATLAS)
    sys.stdout.flush()
    os._exit(0)
