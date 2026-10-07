# scripts/blender/build_bronze_siege.py
# Bronze siege, step 2: four crew on the ram machinery, clips, floor check, export (after build_bronze_siege_machinery.py)
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
import bpy,sys,math,json
from mathutils import Vector
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent));import ti_units as unit
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
for index,(x,y) in enumerate([(-.70,-.415),(-.70,.625),(.70,-.415),(.70,.625)],1):
 arm,body=unit.build_body(ready=True,lite=True,modest=False);arm.name=f'Crew{index}Rig';body.name=f'Crew{index}Body';arm.parent=lod;arm.location=(x,y,0)
 clothes=[]
 clothes.append(unit.tube(f'Crew{index}Kilt',[(0,0,.34),(0,0,.45),(0,0,.515)],[(.13,.087),(.111,.078),(.093,.067)],'Team',['Hips']*3,6,arm))
 clothes.append(unit.tube(f'Crew{index}Linen',[(0,0,.515),(0,0,.61),(0,0,.73),(0,0,.78)],[(.097,.061),(.084,.06),(.137,.075),(.107,.06)],'Cloth',['Spine','Spine','Chest','Chest'],6,arm))
 clothes.append(unit.tube(f'Crew{index}Headcloth',[(0,0,.956),(0,0,.985),(0,0,1.009)],[(.064,.054),(.056,.047),(.03,.03)],'Cloth',['Head']*3,6,arm))
 clothes.append(unit.box(f'Crew{index}HeadclothTail',(0,.052,.925),(.065,.012,.10),'Cloth','Head',arm))
 # NLA tracks with identical names export one assembly clip across all five rigs.
 for name,n in clips.items():
  keys=[]
  for f in [1,1+n//4,1+n//2,1+3*n//4,n+1]:
   t=(f-1)/n;pose={'r':{'Hand_L':(-90,0,0),'Hand_R':(-90,0,0)}}
   if name=='Move':
    a=17*math.sin(t*2*math.pi);pose['r'].update({'Leg_L':(-a,0,0),'Leg_R':(a,0,0),'Shin_L':(max(0,a),0,0),'Shin_R':(max(0,-a),0,0)})
   if name in ('Idle','Move','Fire','Reload'):pose['r']['Chest']=(2+2*math.sin(t*2*math.pi),0,0)
   if name=='Destroyed':pose={'r':{'Root':(0,(1 if x>0 else -1)*75*t,0)},'t':{'Root':(0,0,.08*t)}}
   keys.append((f,pose))
  unit.make_action(arm,name,n+1,keys,name in ('Idle','Move'))
 crew.append({'rig':arm,'body':body,'meshes':[body,*clothes]})
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
assert tri<=3000,tri
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bronze-siege.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in ('MESH','ARMATURE','EMPTY'):o.select_set(True)
bpy.context.view_layer.objects.active=machinery
bpy.ops.export_scene.gltf(filepath=str(OUT/'bronze-siege.glb'),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='NONE')
(OUT/'assembly-report.json').write_text(json.dumps({'triangles':tri,'cap':3000,'crew':4,'wheels':4,'fps':20,'clips':clips,'floor_correction_maximum_by_clip':floor_corrections,'textures':0,'source_body':'scripts/blender/ti_units.py build_body lite derivative','human_height':1,'limitations':['VAT integration pending; authored animation not played by current battle renderer']},indent=2))
print('RAM_ASSEMBLY_AUTHORED',tri,flush=True)
