# scripts/blender/build_units_bronze_irregular.py
# The Bronze irregulars of plans/ART-MODELS-PLAN.md 4.3, on the shared rig and body of ti_units.py
# and the helpers of build_units_bronze.py (reset, finish copied: that module builds on import) (Claude, 2026-10-07), rest pose only like the general:
#   bronze-raider     a light mounted raider: a small horse with a hide saddle cloth and loot sacks on
#                     both flanks, a rider in a Team tunic and headcloth, a lit torch raised in the right
#                     hand and a short javelin across the back. Drawn for raider squads of the cavalry
#                     class (raids and sacks: the attacking party), unitModels.js `raider`.
#   bronze-mercenary  a hired foot soldier in mixed foreign kit: a feathered crown over a bronze band,
#                     a banded corselet, a Team kilt, greaves, a neutral sash with a coin pouch, a round
#                     shield (the squad's Emblem) and a long bronze sword. Drawn for mercenary squads of
#                     the infantry class, unitModels.js `mercenary`.
# Culture neutral (no national motifs). Flame is its own flat material (not a tag).
#   blender -b --factory-startup -P scripts/blender/build_units_bronze_irregular.py -- bronze-raider bronze-mercenary
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import json  # noqa: E402


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 20


def finish(uid, parts, colors, notes):
    u.set_colors(colors)
    root = u.assemble(uid, parts)
    out = u.out_dir(uid)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        for p in o.data.polygons:
            p.use_smooth = False
    tris = u.scene_triangles()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{uid}.blend'))
    u.export_unit(out / f'{uid}.glb', animations=False)
    rigs = {o.name: [b.name for b in o.data.bones] for o in bpy.context.scene.objects if o.type == 'ARMATURE'}
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    report = {'id': uid, 'triangles': tris, 'rigs': rigs, 'materials': mats, 'colors': colors, 'textures': 0,
              'pose': 'rest pose only; clips and VAT with Wave 0b (ART-MODELS-PLAN D5)', 'person_height_H': 1, 'front': 'Blender -Y, glTF +Z', **notes}
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    print(f'BUILT {uid} triangles={tris} root={root.name}', flush=True)


def flame_material():
    m = bpy.data.materials.get('Flame') or bpy.data.materials.new('Flame')
    m.use_nodes = True
    c = tuple(u.linear(int('F29A2E'[i:i + 2], 16) / 255) for i in (0, 2, 4))
    m.diffuse_color = (*c, 1)
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*c, 1)
    n.inputs['Emission Color'].default_value = (*c, 1)
    n.inputs['Emission Strength'].default_value = .6
    return m


def seated_rider(name, at):
    """A rider astride (pose baked like the general's), dressed: Team tunic, hide vest, headcloth."""
    rider, body = u.build_body(ready=True, lite=False, modest=False); rider.name = f'{name}Rig'; body.name = f'{name}Body'
    u.drop_faces(body, lambda c: .36 < c.z < .75 and abs(c.x) < .135)
    u.tube('RiderTunic', [(0, 0, .36), (0, 0, .46), (0, 0, .60), (0, 0, .72), (0, 0, .785)], [(.135, .095), (.115, .082), (.092, .066), (.128, .076), (.105, .062)], 'Team', ['Hips', 'Hips', 'Spine', 'Chest', 'Chest'], 8, rider)
    u.tube('HideVest', [(0, .005, .58), (0, .005, .68), (0, .005, .76)], [(.098, .072), (.12, .082), (.13, .078)], 'Leather', ['Spine', 'Chest', 'Chest'], 6, rider)
    u.tube('Headcloth', [(0, -.003, .952), (0, 0, .99), (0, 0, 1.012)], [(.066, .058), (.06, .051), (.032, .03)], 'Team', ['Head'] * 3, 6, rider)
    u.tube('HeadclothTail', [(0, .05, .96), (0, .10, .90), (0, .13, .83)], [.03, .025, .012], 'Team', ['Head'] * 3, 4, rider)
    rider.location = at
    u.bake_rest_pose(rider, [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == rider],
                     {'r': {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0), 'Arm_R': (0, 0, 0)}})
    return rider


def build_raider():
    reset(); u.palette(); flame_material(); parts = []
    horse, _ = u.quadruped('Mount', 'horse', (0, 0, 0), coat='Leather', dark='Wood'); parts.append(horse)
    u.box('HideCloth', (0, -.06, .665), (.32, .34, .10), 'Cloth', 'Mount_Spine', horse)
    # loot: a sack on each flank behind the rider's legs and a bundle on the croup
    for sx in (-1, 1):
        u.tube(f'LootSack{sx}', [(sx * .19, .16, .64), (sx * .21, .16, .55), (sx * .20, .16, .46)], [(.07, .08), (.09, .095), (.06, .07)], 'Cloth', ['Mount_Spine'] * 3, 6, horse)
        u.tube(f'SackTie{sx}', [(sx * .17, .16, .70), (sx * .19, .16, .64)], [.015, .02], 'Leather', ['Mount_Spine'] * 2, 4, horse)
    u.tube('LootBundle', [(-.12, .30, .74), (.12, .30, .74)], [(.06, .05), (.06, .05)], 'Leather', ['Mount_Spine'] * 2, 6, horse)
    u.tube('LootJar', [(0, .30, .78), (0, .30, .84), (0, .30, .90), (0, .30, .93)], [.035, .055, .03, .035], 'Wood', ['Mount_Spine'] * 4, 6, horse)
    rider = seated_rider('Raider', (0, -.07, .33)); parts.append(rider)
    w = rider.data.bones['Hand_R'].head_local
    # the torch raised forward of the face: a haft, a wrapped head, a flame
    u.tube('TorchHaft', [(w.x, w.y + .05, w.z - .10), (w.x, w.y - .06, w.z + .30)], [.010, .009], 'Wood', ['Prop_R'] * 2, 4, rider, attachment=True)
    u.tube('TorchWrap', [(w.x, w.y - .055, w.z + .28), (w.x, w.y - .07, w.z + .34)], [.022, .02], 'Leather', ['Prop_R'] * 2, 5, rider, attachment=True)
    u.tube('TorchFlame', [(w.x, w.y - .07, w.z + .335), (w.x, w.y - .075, w.z + .39), (w.x, w.y - .06, w.z + .46)], [.035, .03, .004], 'Flame', ['Prop_R'] * 3, 5, rider, attachment=True)
    # a short javelin slung across the back
    u.tube('Javelin', [(-.16, .10, .56), (.20, .07, .98)], [.007, .006], 'Wood', ['Chest'] * 2, 4, rider, attachment=True)
    u.tube('JavelinHead', [(.20, .07, .98), (.225, .065, 1.03)], [.012, .001], 'Metal', ['Chest'] * 2, 4, rider, attachment=True)
    finish('bronze-raider', parts, {'Leather': '8C5A34', 'Wood': '5E4430', 'Cloth': 'CDBB98', 'Metal': ('B98E4E', .45, .6), 'Team': 'BFBFBF', 'Skin': 'C98E66'},
           {'role': 'Bronze raider: a light mounted raider with loot sacks on both flanks, a bundle and a jar on the croup, a raised torch and a slung javelin; Team tunic and headcloth',
            'notes': 'Culture-neutral irregular from the base parts (plan 4.3). Mounted rather than in a chariot: a raid party rides light. The flame is a flat orange material named Flame; fire and smoke come from the battle effects.'})


def build_mercenary():
    reset(); u.palette(); parts = []
    arm, body = u.build_body(ready=True, lite=False, modest=False); arm.name = 'MercenaryRig'; body.name = 'MercenaryBody'
    u.drop_faces(body, lambda c: .35 < c.z < .745 and abs(c.x) < (.145 if c.z > .535 else .15))
    parts.append(arm)
    u.tube('Kilt', [(0, 0, .33), (0, 0, .40), (0, 0, .50), (0, 0, .537)], [(.132, .095), (.127, .088), (.104, .075), (.089, .061)], 'Team', ['Hips'] * 4, 10, arm)
    # the banded corselet of the sea raiders' hired men: three bronze hoops over a leather jerkin
    u.tube('Jerkin', [(0, 0, .53), (0, 0, .60), (0, 0, .68), (0, 0, .745), (0, 0, .77)], [(.094, .066), (.087, .063), (.112, .077), (.133, .079), (.112, .066)], 'Leather', ['Spine', 'Spine', 'Chest', 'Chest', 'Chest'], 8, arm)
    for i, z in enumerate((.58, .64, .70)):
        r = (.091 + .012 * i, .066 + .006 * i)
        u.tube(f'CorseletBand{i}', [(0, 0, z - .012), (0, 0, z + .012)], [r, r], 'Metal', ['Spine' if z < .62 else 'Chest'] * 2, 8, arm)
    # the neutral sash over the left shoulder and the coin pouch on it at the right hip
    u.tube('Sash', [(.10, -.07, .76), (0, -.085, .64), (-.10, -.075, .50)], [(.022, .008)] * 3, 'Cloth', ['Chest', 'Spine', 'Hips'], 4, arm)
    u.tube('CoinPouch', [(-.12, -.06, .47), (-.125, -.065, .43), (-.12, -.06, .39)], [.022, .034, .02], 'Leather', ['Hips'] * 3, 6, arm)
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Greave_{side}', [(sign * .073, -.008, .095), (sign * .073, -.01, .17), (sign * .072, -.012, .245)], [(.03, .031), (.041, .038), (.035, .034)], 'Metal', ['Shin_' + side] * 3, 6, arm)
        u.box(f'Sandal_{side}', (sign * .074, -.042, .008), (.066, .134, .016), 'Leather', 'Foot_' + side, arm)
    # the feathered crown: a bronze band and a ring of upright reeds round the head
    u.tube('CrownBand', [(0, -.004, .955), (0, -.003, .985)], [(.066, .059), (.066, .059)], 'Metal', ['Head'] * 2, 8, arm)
    for k in range(9):
        a = math.pi * (k / 8)  # the front half and the sides
        x, y = .058 * math.cos(a), -.05 * math.sin(a)
        u.box(f'Feather{k}', (x, y, 1.04), (.016, .008, .11), 'Cloth', 'Head', arm)
    # the long bronze sword (a Naue II type) in the right hand, point up
    w = arm.data.bones['Hand_R'].head_local
    u.tube('SwordGrip', [(w.x, w.y - .01, w.z - .05), (w.x, w.y - .01, w.z + .04)], [.012, .012], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('SwordGuard', (w.x, w.y - .01, w.z + .045), (.06, .02, .014), 'Metal', 'Prop_R', arm, True)
    v = [(w.x - .016, w.y - .01, w.z + .05), (w.x + .016, w.y - .01, w.z + .05), (w.x + .012, w.y - .01, w.z + .38), (w.x, w.y - .01, w.z + .44), (w.x - .012, w.y - .01, w.z + .38),
         (w.x, w.y - .02, w.z + .2), (w.x, w.y, w.z + .2)]
    f = [(0, 1, 5), (1, 2, 5), (2, 3, 5), (3, 4, 5), (4, 0, 5), (1, 0, 6), (2, 1, 6), (3, 2, 6), (4, 3, 6), (0, 4, 6)]
    u.mesh_obj('SwordBlade', v, f, 'Metal', 'Prop_R', True, arm=arm)
    # a round shield on the left arm, its face the squad's Emblem (as the base infantry's)
    cx, cy, cz = .225, -.160, .610; rad = .17; n = 14
    verts = [(cx, cy - .022, cz)] + [(cx + rad * math.cos(2 * math.pi * j / n), cy - .007, cz + rad * math.sin(2 * math.pi * j / n)) for j in range(n)]
    face = u.mesh_obj('ShieldFace', verts, [(0, j + 1, (j + 1) % n + 1) for j in range(n)], 'Emblem', 'Prop_L', True, arm=arm)
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            face.data.uv_layers.active.data[li].uv = ((co.x - cx) / (rad * 2) + .5, (co.z - cz) / (rad * 2) + .5)
    u.tube('ShieldRim', [(cx, cy - .004, cz + rad), (cx, cy - .004, cz - rad)], [.008, .008], 'Metal', ['Prop_L'] * 2, 4, arm, attachment=True)
    u.box('ShieldBarH', (cx, cy + .015, cz), (.28, .02, .025), 'Wood', 'Prop_L', arm, True)
    u.box('ShieldBarV', (cx, cy + .016, cz), (.025, .02, .28), 'Wood', 'Prop_L', arm, True)
    finish('bronze-mercenary', parts, {'Leather': '7A5236', 'Wood': '5A4130', 'Cloth': 'D9CDA8', 'Metal': ('C2995A', .4, .6), 'Team': 'BFBFBF', 'Skin': 'B9805C', 'Emblem': 'E6D6AF'},
           {'role': 'Bronze mercenary: a hired foot soldier in mixed foreign kit (feathered crown, banded corselet, greaves), a Team kilt, a neutral sash with a coin pouch, a round Emblem shield and a long bronze sword',
            'notes': 'From the base parts, no theme parts (plan 4.3, 4.4). Rest pose; the vertex rig walks the legs and swings the arms.'})


BUILDERS = {'bronze-raider': build_raider, 'bronze-mercenary': build_mercenary}
ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(BUILDERS)
for uid in ids:
    BUILDERS[uid]()
