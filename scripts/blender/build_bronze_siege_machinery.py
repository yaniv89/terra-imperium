# scripts/blender/build_bronze_siege_machinery.py
# Bronze siege, step 1: the covered ram machinery (run build_bronze_siege.py after it)
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
"""Local Blender authoring: separate articulated ram machinery, no atlas or ground."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent));import ti_units
OUT=ti_units.out_dir('bronze-siege')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=20
def material(name,hexcolor):
 srgb=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
 linear=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in srgb)
 m=bpy.data.materials.new(name);m.diffuse_color=linear+(1,);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.84
 return m
mats={n:material(n,c) for n,c in [('Wood','957250'),('DarkWood','6B4F33'),('Leather','9C744C'),('Team','BFBFBF'),('Cloth','D8D2C4'),('Metal','A07834')]}
mats['DarkWood']=mats['Wood']  # Canonical unit material tags, no extra dark-wood shader tag.
root=bpy.data.objects.new('bronze-siege',None);bpy.context.collection.objects.link(root)
lod=bpy.data.objects.new('LOD0',None);bpy.context.collection.objects.link(lod);lod.parent=root
arm=bpy.data.armatures.new('RamRig');rig=bpy.data.objects.new('RamRig',arm);bpy.context.collection.objects.link(rig);rig.parent=lod
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
spec={'Root':((0,0,0),(0,0,.1),None),'Hull':((0,0,.3),(0,0,.6),'Root'),'Beam':((0,-.3,.48),(0,-.65,.48),'Hull')}
for side,x in [('L',-.435),('R',.435)]:
 for end,y in [('F',-.52),('B',.52)]:spec[f'Wheel_{side}{end}']=((x,y,.145),(x+.08,y,.145),'Hull')
for n,(head,tail,parent) in spec.items():
 b=arm.edit_bones.new(n);b.head=head;b.tail=tail
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
parts=[]
def finish(o,name,mat,bone):
 o.name=name;o.data.materials.append(mats[mat]);bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 for poly in o.data.polygons:poly.use_smooth=False
 group=o.vertex_groups.new(name=bone);group.add(list(range(len(o.data.vertices))),1,'REPLACE')
 mod=o.modifiers.new('Ram articulation','ARMATURE');mod.object=rig;o.parent=rig;o.select_set(False);parts.append(o);return o
def box(name,pos,size,mat='Wood',bone='Hull'):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.scale=size;return finish(o,name,mat,bone)
def cylinder(name,pos,radius,depth,mat='Wood',bone='Hull',axis='X',vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,end_fill_type='NGON',location=pos)
 o=bpy.context.object;o.rotation_euler=(0,math.pi/2,0) if axis=='X' else (math.pi/2,0,0)
 return finish(o,name,mat,bone)
for x in (-.31,.31):box('Chassis side rail',(x,0,.29),(.095,1.5,.12))
for y in (-.61,0,.61):box('Chassis cross member',(0,y,.29),(.78,.09,.09),'DarkWood')
for side,x in [('L',-.435),('R',.435)]:
 for end,y in [('F',-.52),('B',.52)]:
  bone=f'Wheel_{side}{end}'
  cylinder('Solid wheel '+bone,(x,y,.145),.145,.09,'Wood',bone)
  cylinder('Wheel hub '+bone,(x+(-.06 if x<0 else .06),y,.145),.048,.045,'DarkWood',bone,vertices=8)
for y in (-.52,.52):cylinder('Axle',(0,y,.145),.032,.98,'DarkWood',vertices=8)
for x in (-.355,.355):
 for y in (-.65,.65):box('Roof upright',(x,y,.52),(.065,.065,.53),'DarkWood')
for x in (-.36,.36):box('Roof edge beam',(x,0,.79),(.07,1.58,.07))
box('Roof ridge',(0,0,.92),(.045,1.6,.05),'DarkWood')
for side in (-1,1):
 verts=[(0,-.8,.925),(side*.42,-.8,.785),(side*.42,.8,.785),(0,.8,.925)]
 mesh=bpy.data.meshes.new('Hide roof panel');mesh.from_pydata(verts,[],[(0,1,2,3)]);mesh.update()
 o=bpy.data.objects.new('Hide roof',mesh);bpy.context.collection.objects.link(o);finish(o,'Hide roof','Leather','Hull')
 for y in (-.68,0,.68):
  a=Vector((0,y,.93));b=Vector((side*.415,y,.79));mid=(a+b)/2
  o=box('Roof rib',mid,(.036,.045,(b-a).length),'Wood');o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
 for y in (-.40,.40):box('Partial linen side curtain',(side*.365,y,.66),(.012,.59,.23),'Cloth')
 for y in (-.52,.52):box('Crew push handle',(side*.70,y,.605),(.48,.055,.055),'DarkWood')
cylinder('Suspended ram beam',(0,-.3,.49),.105,1.55,'Wood','Beam','Y',vertices=10)
cylinder('Plain bronze ram cap',(0,-1.125,.49),.112,.1,'Metal','Beam','Y',vertices=10)
for y in (-.47,.43):
 box('Beam suspension strap',(0,y,.67),(.06,.055,.34),'Leather','Beam')
 cylinder('Beam strap collar',(0,y,.49),.109,.06,'Leather','Beam','Y',vertices=10)
# All moving parts are separate rigidly weighted meshes. Crew is appended after shared-body authoring.
clips={'Idle':40,'Move':20,'Deploy':20,'Aim':20,'Fire':20,'Reload':24,'Destroyed':30}
rig.animation_data_create()
for clip,frames in clips.items():
 action=bpy.data.actions.new(clip);rig.animation_data.action=action
 for f in range(frames+1):
  t=f/frames;bpy.context.scene.frame_set(f+1)
  for pb in rig.pose.bones:
   pb.rotation_mode='XYZ';pb.location=(0,0,0);pb.rotation_euler=(0,0,0)
  if clip=='Idle':rig.pose.bones['Hull'].location.z=.002*math.sin(t*2*math.pi)
  if clip=='Move':
   for n in spec:
    if n.startswith('Wheel_'):rig.pose.bones[n].rotation_euler.y=t*2*math.pi
  if clip in ('Fire','Reload'):
   displacement=(math.sin(t*math.pi)**2 if clip=='Fire' else 1-t)*.18
   rig.pose.bones['Beam'].location=arm.bones['Beam'].matrix_local.to_3x3().inverted()@Vector((0,-displacement,0))
  if clip=='Deploy':rig.pose.bones['Hull'].location.z=.018*(1-t)
  if clip=='Aim':rig.pose.bones['Beam'].rotation_euler.x=.025*math.sin(t*math.pi)
  if clip=='Destroyed':
   rig.pose.bones['Hull'].rotation_euler.x=.18*t;rig.pose.bones['Beam'].rotation_euler.x=.35*t
  for pb in rig.pose.bones:
   pb.keyframe_insert('location',frame=f+1,group=pb.name);pb.keyframe_insert('rotation_euler',frame=f+1,group=pb.name)
 action.use_fake_user=True
rig.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in parts)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'machinery.blend'))
(OUT/'machinery-report.json').write_text(json.dumps({'triangles':tri,'fps':20,'clips':clips,'wheels':4,'crew_pending':4,'textures':0,'height':.95,'separate_beam':True,'separate_wheels':True},indent=2))
print('RAM_MACHINERY_AUTHORED',tri,flush=True)
