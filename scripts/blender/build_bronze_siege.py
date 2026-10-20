# scripts/blender/build_bronze_siege.py
# Bronze siege, step 2: four crew on the ram machinery, clips, floor check, export (after build_bronze_siege_machinery.py)
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
# Quality pass of 2026-10-14: the four pushers are the set's figures (ti_figure.crew: shaped heads,
# fists closed round the push handles, bare chests, kilts, a Team waist sash and a Team band on the
# headcloth), leaning into the handles in the rest pose; the clips keep their keys (without the old
# flat-hand turn); baked shade in COLOR_0 over the whole file (machine included).
import bpy,sys,math,json
from mathutils import Vector
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent));import ti_units as unit;import ti_mounts as tm;import ti_figure as F
OUT=unit.out_dir('bronze-siege')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'machinery.blend'))
machinery=bpy.data.objects['RamRig'];root=bpy.data.objects['bronze-siege'];lod=bpy.data.objects['LOD0']
lod.name='UnitAssembly'  # Unit validator recursively aggregates the one-detail articulated assembly.
clips={'Idle':40,'Move':20,'Deploy':20,'Aim':20,'Fire':20,'Reload':24,'Destroyed':30}
for name in clips:
 action=bpy.data.actions[name];action.use_frame_range=True;action.frame_start=1;action.frame_end=clips[name]+1
 track=machinery.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True
machinery.animation_data.action=None
crew=[]
def flat(name,hexcolor):
 c=tuple(unit.linear(int(hexcolor[i:i+2],16)/255) for i in (0,2,4))
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.7
flat('Skin','C98E66');flat('Hair','2B201A')
if 'Cloth' not in bpy.data.materials:flat('Cloth','E2D8C2')  # the curtains are Team now: linen for the crew's kilts and headcloths
# The crew at 1.0 (MD09: only the machine is bigger), each a step behind a push handle of the
# enlarged machinery (handles at y = -.598 and .598, reaching out to x = .91).
for index,(x,y) in enumerate([(-.72,-.493),(-.72,.703),(.72,-.493),(.72,.703)],1):
 # a pusher: bare chest, kilt, Team sash and headband, beard; leaning in, both fists on the handle
 # (the handle runs across the figure's front at y -.105, z .605 of its own space)
 arm=F.crew(f'Crew{index}',headgear='headcloth',accent='sash',bare=True,simple=True,lite=True,bearded=False)
 F.pose({'Spine':(7,0,0),'Chest':(6,0,0),'Head':(-11,0,0)})
 for side,s in (('L',1),('R',-1)):F.reach(side,(s*.170,-.066,.598),pole=(s*.8,.7,-.6))
 F.bake_rest()
 for side,s in (('L',1),('R',-1)):F.fist(side,(s*.170,-.105,.607),(1,0,0),half=.022)
 arm.parent=lod;arm.location=(x,y,0)
 clothes=F.own()
 body=clothes[0]
 # NLA tracks with identical names export one assembly clip across all five rigs.
 for name,n in clips.items():
  keys=[]
  for f in [1,1+n//4,1+n//2,1+3*n//4,n+1]:
   t=(f-1)/n;pose={'r':{}}
   if name=='Move':
    a=17*math.sin(t*2*math.pi);pose['r'].update({'Leg_L':(-a,0,0),'Leg_R':(a,0,0),'Shin_L':(max(0,a),0,0),'Shin_R':(max(0,-a),0,0)})
   if name in ('Idle','Move','Fire','Reload'):pose['r']['Chest']=(2+2*math.sin(t*2*math.pi),0,0)
   if name=='Destroyed':pose={'r':{'Root':(0,(1 if x>0 else -1)*75*t,0)},'t':{'Root':(0,0,.08*t)}}
   keys.append((f,pose))
  unit.make_action(arm,name,n+1,keys,name in ('Idle','Move'))
 crew.append({'rig':arm,'body':body,'meshes':[body,*clothes]})
F.normalize_weights()
floor_corrections={}
rigs=[machinery,*[c['rig'] for c in crew]]
for name,n in clips.items():
 for ob in rigs:ob.animation_data.action=next(t.strips[0].action for t in ob.animation_data.nla_tracks if t.name==name)
 maximum=0
 for frame in range(1,n+2):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update()
  for ob in rigs:
   dep=bpy.context.evaluated_depsgraph_get();minimum=100
   for child in ob.children:
    if child.type!='MESH':continue
    ev=child.evaluated_get(dep);me=ev.to_mesh()
    minimum=min(minimum,min((ev.matrix_world@v.co).z for v in me.vertices));ev.to_mesh_clear()
   if minimum<0:
    delta=-minimum;maximum=max(maximum,delta)
    ob.pose.bones['Root'].location+=ob.data.bones['Root'].matrix_local.to_3x3().inverted()@Vector((0,0,delta))
    ob.pose.bones['Root'].keyframe_insert('location',frame=frame)
 floor_corrections[name]=maximum
bpy.context.scene.frame_set(1)
for ob in [machinery,*[c['rig'] for c in crew]]:
 ob.animation_data.action=next(t.strips[0].action for t in ob.animation_data.nla_tracks if t.name=='Idle')
mesh=[o for o in bpy.context.scene.objects if o.type=='MESH'];tri=unit.triangles(mesh)
assert tri<=6000,tri  # a machine: 4,000 target, 6,000 hard (plans/art/TRIANGLE-BUDGET.md)
# baked shade (COLOR_0) over the machine and the crew, at the rest pose
for ob in [machinery,*[c['rig'] for c in crew]]:ob.animation_data.action=None
for ob in [machinery,*[c['rig'] for c in crew]]:
 for pb in ob.pose.bones:pb.location=(0,0,0);pb.rotation_quaternion=(1,0,0,0);pb.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
F.adopt(mesh);F.fix_normals();shade=F.bake_shade()
for ob in [machinery,*[c['rig'] for c in crew]]:
 ob.animation_data.action=next(t.strips[0].action for t in ob.animation_data.nla_tracks if t.name=='Idle')
bpy.context.scene.frame_set(1)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bronze-siege.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in ('MESH','ARMATURE','EMPTY'):o.select_set(True)
bpy.context.view_layer.objects.active=machinery
unit.smooth_organic()
bpy.ops.export_scene.gltf(filepath=str(OUT/'bronze-siege.glb'),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='NONE',export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_active_vertex_color_when_no_material=True)
(OUT/'assembly-report.json').write_text(json.dumps({'triangles':tri,'cap':6000,'shade_range':shade,'by_rig':{o.name:unit.triangles([m for m in mesh if m.parent==o]) for o in [machinery,*[c['rig'] for c in crew]]},'crew':4,'wheels':4,'fps':20,'clips':clips,'floor_correction_maximum_by_clip':floor_corrections,'textures':0,'source_body':'scripts/blender/ti_figure.py crew (quality pass of 2026-10-14)','human_height':1,'limitations':['VAT integration pending; authored animation not played by current battle renderer']},indent=2))
# The unit's bake options: drawn at the people's scale, spaced by its footprint (unitModels.js).
footprint,size=tm.machine_size()
(OUT/'bronze-siege.json').write_text(json.dumps({'enabled':True,'restClip':'^Idle$','rotateY':0,'quadruped':False,'triangleBudget':6000,'tags':{'team':'^Team(?:\\s|$)','skin':'^Skin(?:\\s|$)','emblem':'^Emblem(?:\\s|$)'},'footprint':footprint},indent=2)+'\n')
print('RAM_ASSEMBLY_AUTHORED',tri,'footprint',footprint,'metres',[round(v*1.8,2) for v in size],flush=True)
