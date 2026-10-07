# scripts/blender/build_units_bronze.py
# The Bronze base units Claude built in Wave 1 (plans/ART-MODELS-PLAN.md 4.2, 4.3), on the shared rig
# and body of ti_units.py, in the town-building look (faceted, flat colours, readable at 30 px):
#   bronze-cavalry   light two-horse chariot, six-spoke wheels, a driver and an archer (2,500 target)
#   bronze-support   baggage train: one ox in shafts with a withers yoke, a two-wheeled cart with
#                    solid wheels, storage jars, sacks under a Team cover, a seated driver
#   bronze-general   a mounted commander (Team cloak and plume, bronze scale and helmet, mace) and a
#                    standard bearer on foot whose banner is the squad's Emblem
# Rest pose only (no clips): the soldier loader bakes the rest pose and its vertex rig walks the legs
# and swings the arms; authored clips and their VAT bake come with Wave 0b (decision D5).
#   blender -b --factory-startup -P scripts/blender/build_units_bronze.py -- bronze-cavalry [more ids]
# Writes art-build/units/<id>/<id>.blend, <id>.glb (uncompressed) and report.json.
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 20


def rigid(name, defs, at=(0, 0, 0)):
    """A rigid vehicle's armature (bones named so the loader leaves them still: Hull, Wheel_*)."""
    return u.make_armature(name, defs, at)


def wheel(prefix, arm, bone, cx, cy, cz, radius, spokes=6, mat='Wood', hub='Metal'):
    """A spoked wheel in the YZ plane (axle along X): a triangular-section rim, spokes, a hub."""
    out = []
    n = 10; v = []; f = []
    for i in range(n):
        a = 2 * math.pi * i / n; ca, sa = math.cos(a), math.sin(a)
        for dx, dr in [(-.016, 0), (.016, 0), (0, -.03)]:
            r = radius + dr
            v.append((cx + dx, cy + r * ca, cz + r * sa))
    for i in range(n):
        j = (i + 1) % n
        for k in range(3):
            a0 = 3 * i + k; a1 = 3 * i + (k + 1) % 3; b0 = 3 * j + k; b1 = 3 * j + (k + 1) % 3
            f += [(a0, a1, b1), (a0, b1, b0)]
    out.append(u.mesh_obj(f'{prefix}Rim', v, f, mat, bone, arm=arm))
    for i in range(spokes // 2):
        a = math.pi * i / (spokes // 2)
        ob = u.box(f'{prefix}Spoke{i}', (cx, cy, cz), (.018, 2 * radius - .03, .02), mat, bone, arm)
        ob.data.transform(Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Translation((-cx, -cy, -cz)))
        out.append(ob)
    out.append(u.tube(f'{prefix}Hub', [(cx - .04, cy, cz), (cx + .04, cy, cz)], [.04, .04], hub, [bone] * 2, 6, arm))
    return out


def disc_wheel(prefix, arm, bone, cx, cy, cz, radius, mat='Wood'):
    """A solid (tripartite plank) wheel: a short 10-sided drum with a raised hub."""
    return [u.tube(f'{prefix}Disc', [(cx - .03, cy, cz), (cx + .03, cy, cz)], [radius, radius], mat, [bone] * 2, 10, arm),
            u.tube(f'{prefix}Hub', [(cx - .055, cy, cz), (cx + .055, cy, cz)], [.05, .05], mat, [bone] * 2, 6, arm)]


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


# ---- bronze-cavalry: light two-horse chariot -------------------------------------------------------

def build_cavalry():
    reset(); u.palette(); parts = []
    for name, x in [('HorseNear', .165), ('HorseOff', -.165)]:
        arm, _ = u.quadruped(name, 'horse', (x, -.62, 0), coat='Leather', dark='Wood')
        parts.append(arm)
    car = rigid('ChariotRig', [('Hull', (0, .22, .30), (0, .22, .5), None), ('Wheel_L', (.36, .30, .27), (.42, .30, .27), 'Hull'), ('Wheel_R', (-.36, .30, .27), (-.42, .30, .27), 'Hull')])
    parts.append(car)
    floor = .33
    u.box('CarFloor', (0, .22, floor - .015), (.52, .34, .03), 'Wood', 'Hull', car)
    u.box('CarFront', (0, .055, floor + .19), (.5, .025, .38), 'Team', 'Hull', car)  # dyed hide breastwork
    for sx in (-1, 1):
        u.box(f'CarSide{sx}', (sx * .25, .17, floor + .16), (.022, .25, .32), 'Cloth', 'Hull', car)  # pale hide sides
    rail = [(-.25, .30, floor + .34), (-.25, .06, floor + .38), (0, .045, floor + .40), (.25, .06, floor + .38), (.25, .30, floor + .34)]
    u.tube('CarRail', rail, [.016] * 5, 'Wood', ['Hull'] * 5, 4, car)
    u.tube('Axle', [(-.40, .30, .27), (.40, .30, .27)], [.02, .02], 'Wood', ['Hull'] * 2, 4, car)
    u.tube('Pole', [(0, .26, .29), (0, -.10, .40), (0, -.55, .60), (0, -.93, .78)], [.02, .02, .018, .016], 'Wood', ['Hull'] * 4, 4, car)
    u.box('Yoke', (0, -.93, .80), (.50, .035, .032), 'Wood', 'Hull', car)
    for sx in (-1, 1):
        u.box(f'YokeSaddle{sx}', (sx * .165, -.93, .765), (.05, .05, .07), 'Metal', 'Hull', car)
    u.tube('Quiver', [(-.275, .30, floor + .10), (-.275, .10, floor + .40)], [.034, .04], 'Leather', ['Hull'] * 2, 5, car)
    u.tube('QuiverArrows', [(-.275, .12, floor + .40), (-.275, .09, floor + .47)], [.026, .02], 'Wood', ['Hull'] * 2, 4, car)
    for side, sx in [('L', 1), ('R', -1)]:
        wheel(f'Wheel{side}', car, f'Wheel_{side}', sx * .36, .30, .27, .27)
    # crew on the floor: the driver (right) holds the reins, the archer (left) a self bow
    drv, _ = u.crew('Driver', (-.10, .24, floor), head='headcloth'); parts.append(drv)
    arc, _ = u.crew('Archer', (.11, .25, floor), head='cap'); parts.append(arc)
    bpy.context.view_layer.update()
    # reins: from between the driver's hands to each horse's mouth (rigid with the driver's hands)
    hl = drv.matrix_world @ drv.data.bones['Hand_L'].head_local; hr = drv.matrix_world @ drv.data.bones['Hand_R'].head_local
    grip = (hl + hr) / 2
    inv = drv.matrix_world.inverted()
    for name, hx in [('NearRein', .165), ('OffRein', -.165)]:
        mouth = Vector((hx, -.62 - .76, .87))
        pts = [tuple(inv @ grip), tuple(inv @ grip.lerp(mouth, .5) + Vector((0, 0, -.04))), tuple(inv @ mouth)]
        u.tube(name, pts, [.007] * 3, 'Leather', ['Hand_L', 'Hand_L', 'Hand_L'], 3, drv)
    # the archer's self bow in the left hand (Prop_L), string to the back; a bronze tipped arrow nocked
    w = arc.data.bones['Hand_L'].head_local
    pts = []; n = 7
    for i in range(n):
        t = i / (n - 1); z = w.z - .40 + .80 * t; y = w.y - .05 - .07 * math.sin(math.pi * t)
        pts.append((w.x + .01, y, z))
    u.tube('SelfBow', pts, [.006, .009, .011, .012, .011, .009, .006], 'Wood', ['Prop_L'] * n, 4, arc, attachment=True)
    u.tube('BowString', [pts[0], (w.x + .01, w.y + .02, w.z), pts[-1]], [.003] * 3, 'Cloth', ['Prop_L'] * 3, 3, arc, attachment=True)
    finish('bronze-cavalry', parts, {'Leather': '9A6236', 'Wood': '5A4130', 'Cloth': 'E4D8BF', 'Metal': ('BE9655', .45, .6), 'Team': 'BFBFBF', 'Skin': 'C98E66'},
           {'role': 'Chariots (bronze cavalry): two horses side by side, two crew, six-spoke wheels, axle at the rear of the car, rear-entry car with pale hide sides and a Team-dyed front',
            'notes': 'Horses are small Bronze Age horses (0.78 H at the withers). Yoke on the withers with saddles; no stirrups or collars. Culture-neutral: no national motifs.'})


# ---- bronze-support: ox baggage cart ------------------------------------------------------------------

def build_support():
    reset(); u.palette(); parts = []
    ox, _ = u.quadruped('Ox', 'ox', (0, -.66, 0), coat='Leather', dark='Wood', horn='Cloth'); parts.append(ox)
    cart = rigid('CartRig', [('Hull', (0, .40, .40), (0, .40, .6), None), ('Wheel_L', (.34, .42, .25), (.40, .42, .25), 'Hull'), ('Wheel_R', (-.34, .42, .25), (-.40, .42, .25), 'Hull')])
    parts.append(cart)
    bed = .44
    u.box('CartBed', (0, .42, bed - .02), (.54, .66, .04), 'Wood', 'Hull', cart)
    for sx in (-1, 1):
        u.box(f'SideBoard{sx}', (sx * .265, .42, bed + .05), (.025, .66, .10), 'Wood', 'Hull', cart)
    u.box('TailBoard', (0, .745, bed + .05), (.54, .025, .10), 'Wood', 'Hull', cart)
    u.tube('Axle', [(-.38, .42, .25), (.38, .42, .25)], [.025, .025], 'Wood', ['Hull'] * 2, 4, cart)
    for side, sx in [('L', 1), ('R', -1)]:
        disc_wheel(f'Wheel{side}', cart, f'Wheel_{side}', sx * .34, .42, .25, .25)
        # shafts from the bed's front corners to the yoke on the ox's withers
        u.tube(f'Shaft{side}', [(sx * .21, .30, bed - .03), (sx * .21, .02, bed + .02), (sx * .21, -.55, .62), (sx * .215, -1.0, .70)], [.02, .02, .018, .016], 'Wood', ['Hull'] * 4, 4, cart)
    u.box('WithersYoke', (0, -.98, .73), (.50, .045, .04), 'Wood', 'Hull', cart)
    for sx in (-1, 1):
        u.box(f'YokePad{sx}', (sx * .07, -.98, .70), (.06, .07, .05), 'Leather', 'Hull', cart)
    # the load: storage jars at the back, sacks under a Team cover at the front
    for i, (x, y) in enumerate([(.13, .62), (-.13, .62), (0, .58)]):
        h = .02 if i < 2 else .05
        u.tube(f'Jar{i}', [(x, y, bed), (x, y, bed + .06 + h), (x, y, bed + .16 + h), (x, y, bed + .23 + h), (x, y, bed + .26 + h)], [.045, .085, .078, .036, .045], 'Metal', ['Hull'] * 5, 6, cart)
    for i, x in enumerate((.12, -.12)):
        u.tube(f'Sack{i}', [(x, .34, bed), (x, .34, bed + .08), (x, .34, bed + .15)], [(.10, .08), (.105, .085), (.06, .05)], 'Cloth', ['Hull'] * 3, 6, cart)
    u.tube('LoadCover', [(-.25, .34, bed + .10), (-.12, .34, bed + .18), (.12, .34, bed + .18), (.25, .34, bed + .10)], [(.07, .15), (.05, .16), (.05, .16), (.07, .15)], 'Team', ['Hull'] * 4, 6, cart)
    # the driver sits on the front of the bed, legs over the front board, a goad in the right hand
    drv, meshes = u.crew('Driver', (0, .20, bed - .43), lite=False, head='headcloth'); parts.append(drv)
    u.bake_rest_pose(drv, [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == drv],
                     {'r': {'Leg_L': (-88, 0, 0), 'Leg_R': (-88, 0, 0), 'Shin_L': (85, 0, 0), 'Shin_R': (85, 0, 0), 'Chest': (6, 0, 0)}})
    w = drv.data.bones['Hand_R'].head_local
    u.tube('Goad', [(w.x, w.y + .05, w.z - .10), (w.x - .02, w.y - .30, w.z + .32)], [.008, .006], 'Wood', ['Prop_R'] * 2, 4, drv, attachment=True)
    finish('bronze-support', parts, {'Leather': 'A87B52', 'Wood': '8A6646', 'Cloth': 'E2D6BC', 'Metal': ('B4683F', .85, 0), 'Team': 'BFBFBF', 'Skin': 'C98E66'},
           {'role': 'Baggage train (bronze support): one long-horned draught ox in shafts with a withers yoke, two-wheeled cart with solid wheels, storage jars, sacks under a Team cover, a seated driver with a goad',
            'notes': 'Metal is recoloured terracotta for the jars in this file (the tag only sets the flat colour). Horns use Cloth (pale horn).'})


# ---- bronze-general: mounted commander and standard bearer -------------------------------------------

def build_general():
    reset(); u.palette(); parts = []
    horse, hm = u.quadruped('Mount', 'horse', (0, 0, 0), coat='Leather', dark='Wood'); parts.append(horse)
    u.box('SaddleCloth', (0, -.06, .665), (.34, .36, .12), 'Team', 'Mount_Spine', horse)
    # the commander, seated astride (pose baked into the rest pose)
    rider, body = u.build_body(ready=True, lite=False, modest=False); rider.name = 'CommanderRig'; body.name = 'CommanderBody'
    u.drop_faces(body, lambda c: .36 < c.z < .75 and abs(c.x) < .135)
    rm = [body]
    rm.append(u.tube('Tunic', [(0, 0, .36), (0, 0, .45), (0, 0, .53)], [(.135, .095), (.115, .082), (.097, .07)], 'Cloth', ['Hips'] * 3, 8, rider))
    rm.append(u.tube('ScaleCorselet', [(0, 0, .52), (0, 0, .60), (0, 0, .68), (0, 0, .745), (0, 0, .79)], [(.10, .07), (.092, .068), (.118, .08), (.138, .08), (.11, .064)], 'Metal', ['Spine', 'Spine', 'Chest', 'Chest', 'Chest'], 8, rider))
    rm.append(u.tube('Helmet', [(0, -.004, .935), (0, -.002, .955), (0, 0, 1.005), (0, 0, 1.03)], [(.068, .061), (.067, .06), (.035, .032), (.012, .012)], 'Metal', ['Head'] * 4, 8, rider))
    rm.append(u.tube('Plume', [(0, 0, 1.025), (0, .07, 1.085), (0, .15, 1.06), (0, .20, .98)], [.02, .035, .03, .012], 'Team', ['Head'] * 4, 5, rider))
    # a cloak from the shoulders falling behind over the horse's back (both sides drawn)
    rows = [[(-.13, .04, .785), (0, .06, .795), (.13, .04, .785)], [(-.17, .16, .55), (0, .19, .56), (.17, .16, .55)], [(-.19, .25, .36), (0, .29, .37), (.19, .25, .36)]]
    v = [p for r in rows for p in r]; f = []
    for i in range(2):
        for j in range(2):
            a = 3 * i + j; b = a + 1; c = a + 4; d = a + 3
            f += [(a, b, c), (a, c, d), (a, c, b), (a, d, c)]
    rm.append(u.mesh_obj('Cloak', v, f, 'Team', None, arm=rider, weights=[{'Chest': 1}] * 3 + [{'Spine': 1}] * 3 + [{'Hips': 1}] * 3))
    rider.location = (0, -.07, .33)
    u.bake_rest_pose(rider, [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == rider],
                     {'r': {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0)}})
    parts.append(rider)
    w = rider.data.bones['Hand_R'].head_local
    u.tube('MaceHaft', [(w.x, w.y + .06, w.z - .06), (w.x, w.y - .10, w.z + .26)], [.009, .008], 'Wood', ['Prop_R'] * 2, 4, rider, attachment=True)
    u.tube('MaceHead', [(w.x, w.y - .09, w.z + .23), (w.x, w.y - .115, w.z + .29), (w.x, w.y - .12, w.z + .31)], [.026, .03, .01], 'Metal', ['Prop_R'] * 3, 6, rider, attachment=True)
    # the standard bearer on foot at the horse's left shoulder; the banner is the squad's Emblem
    bearer, _ = u.crew('Bearer', (.50, -.05, 0), head='headcloth'); parts.append(bearer)
    w = bearer.data.bones['Hand_R'].head_local
    top = 1.62
    u.tube('StandardPole', [(w.x, w.y, .06), (w.x, w.y, top)], [.011, .009], 'Wood', ['Prop_R'] * 2, 4, bearer, attachment=True)
    u.box('StandardBar', (w.x + .12, w.y, top - .03), (.30, .02, .02), 'Metal', 'Prop_R', bearer, attachment=True)
    x0, x1, z0, z1, y = w.x - .02, w.x + .26, top - .27, top - .04, w.y - .012
    banner = u.mesh_obj('StandardEmblem', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', 'Prop_R', True, arm=bearer)
    uv = banner.data.uv_layers.active
    for poly in banner.data.polygons:
        for li in poly.loop_indices:
            co = banner.data.vertices[banner.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    finish('bronze-general', parts, {'Leather': '7E4F31', 'Wood': '3F2E22', 'Cloth': 'E7DDC7', 'Metal': ('C49A52', .4, .65), 'Team': 'BFBFBF', 'Skin': 'C98E66', 'Emblem': 'E6D6AF'},
           {'role': 'Bronze general: a mounted commander a size up from cavalry (Team cloak, saddle cloth and plume, bronze scale corselet and helmet, mace) with a standard bearer on foot; the banner prints the squad emblem',
            'notes': 'A role abstraction: Bronze Age commanders mostly fought from chariots; the plan (D6, 4.3) asks for a mounted general in every age. The pole, mace and banner are attachments (not counted in the model height).'})


BUILDERS = {'bronze-cavalry': build_cavalry, 'bronze-support': build_support, 'bronze-general': build_general}
ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(BUILDERS)
for uid in ids:
    BUILDERS[uid]()
