# scripts/blender/build_walls_bastion_gunpowder.py
# The Gunpowder battle wall kit as a bastion trace (plans/ART-MODELS-PLAN.md section 6: "Gunpowder bastion
# trace"; a known gap of checkpoint 29, whose kit kept the shared crenellated pieces in the age's stone).
# The same pieces, sizes and origins as build_city_bronze.wall_items (src/assets/battle/city/README.md):
#   wall-straight  10 m of curtain: a low battered grey stone scarp, a sandstone cordon, a turf parapet and
#                  rampart on top (ti_gunpowder.curtain, the map walls' section), the outer foot at -Y
#   wall-corner    two half curtains meeting at the origin (outer faces -Y and -X), a stone sentry box
#                  (an echauguette) on the salient under a slate cap
#   tower          an arrow-head bastion (6 x 6 m) pointing out (-Y): scarp, cordon, turf parapet, a gun
#                  platform and a cannon (ti_gunpowder.bastion)
#   gate-open, gate-closed  the sandstone gatehouse in the curtain (ti_gunpowder.gatehouse), the arched
#                  doors shut, or the passage dark and open
# each with -damaged (bites out of the parapet, a fallen cordon, rubble of scarp stone at the foot, a shot
# crater) and -breached (the curtain down to stubs either side of a rubble ramp of stone and turf).
# Called by build_city_gunpowder.py for walls-gunpowder.glb.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_gunpowder as tg  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402

W = 0.28     # the curtain's depth, outer foot to inner foot (2.8 m)
H = 0.42     # parapet top (4.2 m: a low gun wall)
HS = H * 0.72  # the scarp's top (the cordon)
BAT = H * 0.18
Y0 = -W / 2  # the outer foot line of a straight piece


def run(ms, x0, x1, h=H, frame=None):
    """One stretch of curtain along local x from x0 to x1 (outer foot on y = -W/2) at parapet height h."""
    f = frame if frame is not None else Matrix.Identity(4)
    if h >= H - 1e-6:
        g = tg.curtain(ms, (x0, Y0), (x1, Y0), W, H, HS, BAT, fringe=False)
    else:  # a broken stretch: the scarp cut down, a ragged turf top
        hs = min(HS, h)
        g = tg.curtain(ms, (x0, Y0), (x1, Y0), W, max(hs + 0.02, h), hs, BAT * hs / HS, fringe=False)
    n = len(ms.parts)  # the curtain's three slabs show near and middle; the far level is one block
    for i in range(n - 3, n):
        bm, mat, lod, only = ms.parts[i]
        ms.parts[i] = (bm, mat, 1, (0, 1))
    tg.slab(ms, 'gp_scarp', [(0.0, 0.0), (BAT, h), (W, h), (W, 0.0)], x1 - x0, f=tg._t(x0, Y0, 0), axis='X', lod=2, only=(2,))
    if frame is not None:  # move the parts the curtain just added into the frame
        n = len(ms.parts)
        for i in range(n - 4, n):
            bm, mat, lod, only = ms.parts[i]

            bmesh.ops.transform(bm, matrix=f, verts=bm.verts)
    return g


def rubble(ms, rng, x, y, size, frame=None, far=True):
    cb.mound(ms, rng, x, y, size, size * 0.4, mat='gp_scarp', frame=frame, far=False)
    cb.bricks(ms, rng, x, y - 0.05, size * 1.2, 8, mat='gp_sandstone', frame=frame)


def crater(ms, rng, x, y):
    ms.cyl('ash', 0.07, 0.05, 0.004, at=(x, y, 0.0), segs=9, lod=0)


def straight(state, x0=-0.5, x1=0.5, frame=None, far=True):
    def build(ms, rng):
        if state == 0:
            run(ms, x0, x1, frame=frame)
        elif state == 1:
            span = x1 - x0
            cut = x0 + span * rng.uniform(0.35, 0.6)
            run(ms, x0, cut - 0.06, frame=frame)
            run(ms, cut - 0.06, cut + 0.12, h=H * 0.78, frame=frame)
            run(ms, cut + 0.12, x1, frame=frame)
            rubble(ms, rng, cut + 0.03, Y0 - 0.1, 0.12, frame=frame, far=False)
            crater(ms, rng, x0 + span * 0.2, Y0 - 0.15)
            for k in range(2):  # cracks in the scarp
                ms.box('dark', (0.01, 0.006, 0.12), at=(x0 + span * rng.uniform(0.15, 0.85), Y0 + 0.02, 0.06), lod=0)
        else:
            span = x1 - x0
            run(ms, x0, x0 + span * 0.32, h=H * 0.8, frame=frame)
            run(ms, x1 - span * 0.32, x1, h=H * 0.7, frame=frame)
            rubble(ms, rng, (x0 + x1) / 2, Y0 + 0.02, 0.3, frame=frame, far=False)
            cb.mound(ms, rng, (x0 + x1) / 2 + 0.05, -Y0 - 0.02, 0.18, 0.07, mat='gp_turf', frame=frame, far=False)
            crater(ms, rng, (x0 + x1) / 2 - 0.15, Y0 - 0.2)
    return build


def corner(state):
    """Two half curtains meeting at the origin; a sentry box on the salient."""
    def build(ms, rng):
        straight(state, Y0, 0.5, far=state < 2)(ms, rng)
        straight(state, -0.5, -Y0, frame=Matrix.Rotation(math.radians(-90), 4, 'Z'), far=False)(ms, rng)
        sx, sy = Y0 + 0.02, Y0 + 0.02
        if state < 2:  # the echauguette: a round stone sentry box corbelled out at the angle
            top = H + (0.12 if state == 0 else 0.0)
            ms.cyl('gp_sandstone', 0.025, 0.06, 0.06, at=(sx, sy, HS - 0.06), segs=8, lod=1)
            ms.cyl('gp_scarp', 0.06, 0.06, top - HS, at=(sx, sy, HS), segs=8, lod=1)
            if state == 0:
                ms.cyl('gp_slate', 0.075, 0.0, 0.09, at=(sx, sy, top), segs=8, lod=1)
                ms.box('dark', (0.02, 0.012, 0.04), at=(sx - 0.04, sy - 0.04, HS + 0.06), rot_z=45, lod=0)
        else:
            rubble(ms, rng, sx - 0.05, sy - 0.05, 0.14)
    return build


def tower(state):
    """An arrow-head bastion pointing out (-Y): its gorge at the back on y = W/2."""
    poly = [(-0.3, 0.3), (-0.3, -0.04), (0.0, -0.42), (0.3, -0.04), (0.3, 0.3)]

    def build(ms, rng):
        hb = H * 1.12 if state == 0 else H * 0.95 if state == 1 else H * 0.5
        tg.bastion(ms, rng, poly, hb, min(HS * 1.04, hb - 0.03), bat=BAT, gun=-90 if state == 0 else None, fringe=False, platform=state < 2)
        if state == 1:
            tg.cannon(ms, Matrix.Identity(4), 0.08, -0.02, hb, 25, s=1.25, lod=1)  # the gun knocked askew
            rubble(ms, rng, 0.12, -0.45, 0.14, far=False)
            crater(ms, rng, -0.25, -0.4)
        elif state == 2:
            rubble(ms, rng, 0.0, -0.4, 0.3)
            cb.mound(ms, rng, -0.1, 0.1, 0.18, 0.08, mat='gp_turf', far=False)
            cb.charred_beam(ms, rng, 0.15, -0.1, 0.2, 0.3, 20)
    return build


def gate(state, open_):
    gw = 0.36

    def build(ms, rng):
        c = W / 2  # the gatehouse's outer face on y = -W/2, centred at the origin
        gx = gw / 2 + 0.16
        if state < 2:
            n0 = len(ms.parts)
            tg.gatehouse(ms, rng, c, W, H, gw, flag_top=H + 0.45 if state == 0 else None)
            if open_:  # the passage open: the leaves dark (swung in out of sight)
                ms.parts[n0:] = [(bm, 'dark' if mat == 'door' else mat, lod, only) for bm, mat, lod, only in ms.parts[n0:]]
            if state == 1:  # the cornice and pediment knocked about, rubble at the foot
                top = H + 0.04
                kept = ms.parts[:n0]
                for bm, mat, lod, only in ms.parts[n0:]:
                    if min(v.co.z for v in bm.verts) > top and rng.random() < 0.6:
                        bm.free()
                    else:
                        kept.append((bm, mat, lod, only))
                ms.parts[:] = kept
                rubble(ms, rng, 0.2, Y0 - 0.12, 0.1, far=False)
                ms.box('ash', (0.1, 0.02, 0.1), at=(-0.05, Y0 - 0.036, 0.04), lod=0)
            run(ms, -0.5, -gx)
            run(ms, gx, 0.5)
        else:
            run(ms, -0.5, -gx - 0.1, h=H * 0.7)
            run(ms, gx + 0.1, 0.5, h=H * 0.75)
            for sx in (-1, 1):
                ms.box('gp_sandstone', (0.14, W, 0.16), at=(sx * (gw / 2 + 0.08), 0, 0), lod=2, bevel=0.004)
            rubble(ms, rng, 0.0, Y0, 0.32)
            cb.charred_beam(ms, rng, 0.05, -0.1, 0.04, 0.34, 10, lift=0.06)
            ms.box('door', (gw / 2, 0.03, 0.2), at=(-0.1, Y0 - 0.15, 0.0), rot_z=70, lod=1)
    return build


def wall_items():
    items = []
    for base, make in (('wall-straight', straight), ('wall-corner', corner), ('tower', tower)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, make(state), None))
    for base, open_ in (('gate-open', True), ('gate-closed', False)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, gate(state, open_), None))
    return items
