"""scripts/blender/ti_units.py: the shared battle unit rig and body (plans/ART-MODELS-PLAN.md 4.1).

Blender 5.2, a standing person is H = 1 tall, feet on Z = 0, the front faces Blender -Y (glTF +Z).
Flat colours per material, no textures: Team, Skin, Emblem, Metal, Wood, Leather, Cloth (a file may
recolour a tag, e.g. Leather as a bay horse's coat). The first half is the Codex body and rig of
2026-10-07 (canonical 21 bones, the faceted adult body at about 900 triangles, its lite crew
derivative, action and floor helpers); the second half (Claude) adds mounts (horse, ox) with bone
names the soldier loader maps (src/battle/render/gltfUnitLoader.js: Mount_LegFront_L ... trot in
diagonal pairs), baking a pose into the rest pose (seated riders, drivers), assembling a unit under one
root and exporting it. Build scripts: build_unit_body.py, build_bronze_*.py, build_units_bronze.py.
Outputs go to art-build/units/<id>/ (gitignored) or TI_UNITS_OUT; the game copy is packed with
`npm run pack:models -- src/assets/units/<id>.glb`.
"""
import bpy,math,json,os
from pathlib import Path
from mathutils import Vector,Quaternion

REPO=Path(__file__).resolve().parents[2]
def out_dir(uid):
 """Where a unit's build writes: $TI_UNITS_OUT/<id> or art-build/units/<id> in the repository."""
 base=Path(os.environ['TI_UNITS_OUT']) if os.environ.get('TI_UNITS_OUT') else REPO/'art-build'/'units'
 d=base/uid;d.mkdir(parents=True,exist_ok=True);return d

COLORS={'Team':'BFBFBF','Skin':'D9A07A','Emblem':'E6D6AF','Metal':'BE9655','Wood':'94704A','Leather':'986C49','Cloth':'E7DDC7','Hair':'5B4030'}
ARM=None

def linear(v):return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def palette():
 for name,h in COLORS.items():
  m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
  c=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
  m.diffuse_color=(*c,1);n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=.68;n.inputs['Metallic'].default_value=.35 if name=='Metal' else 0
 return {n:bpy.data.materials[n] for n in COLORS}

def mesh_obj(name,verts,faces,material,bone=None,attachment=False,weights=None,arm=None):
 arm=arm or ARM
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(bpy.data.materials[material])
 if attachment:ob['attachment']=True
 if arm:
  ob.parent=arm;mod=ob.modifiers.new('CanonicalRig','ARMATURE');mod.object=arm
  if weights is None:weights=[{bone or 'Hips':1} for _ in verts]
  for i,w in enumerate(weights):
   for b,weight in w.items():
    group=ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b);group.add([i],weight,'REPLACE')
 for p in me.polygons:p.use_smooth=False
 # UVs retained for Emblem and later source editing, no texture atlas.
 uv=me.uv_layers.new(name='UVMap')
 for face in me.polygons:
  for li in face.loop_indices:
   co=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(.5+co.x,.5+co.z)
 return ob

def tube(name,centers,radii,material,weights=None,sides=8,arm=None,attachment=False):
 verts=[];faces=[];vw=[];n=len(centers)
 for i,center in enumerate(centers):
  c=Vector(center);d=Vector(centers[min(n-1,i+1)])-Vector(centers[max(0,i-1)]);d.normalize()
  u=Vector((0,-1,0));u-=d*u.dot(d)
  if u.length<.05:u=Vector((1,0,0));u-=d*u.dot(d)
  u.normalize();v=d.cross(u).normalized()
  rx,ry=(radii[i],radii[i]) if isinstance(radii[i],(int,float)) else radii[i]
  wt=weights[i] if weights else {'Hips':1}
  if isinstance(wt,str):wt={wt:1}
  for j in range(sides):
   a=2*math.pi*j/sides;verts.append(tuple(c+u*math.cos(a)*ry+v*math.sin(a)*rx));vw.append(wt)
  if i:
   for j in range(sides):
    a=(i-1)*sides+j;b=(i-1)*sides+(j+1)%sides;c0=i*sides+(j+1)%sides;d0=i*sides+j
    faces.extend([(a,b,c0),(a,c0,d0)])
 for end in (0,n-1):
  idx=len(verts);verts.append(tuple(centers[end]));vw.append(vw[end*sides]);offset=end*sides
  for j in range(sides):faces.append((idx,offset+(j+1)%sides,offset+j) if end==0 else (idx,offset+j,offset+(j+1)%sides))
 return mesh_obj(name,verts,faces,material,weights=vw,arm=arm,attachment=attachment)

def box(name,center,scale,material,bone='Hips',arm=None,attachment=False):
 x,y,z=center;dx,dy,dz=(v/2 for v in scale)
 verts=[(x+sx*dx,y+sy*dy,z+sz*dz) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 faces=[(0,3,2),(0,2,1),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
 return mesh_obj(name,verts,faces,material,bone,arm=arm,attachment=attachment)

def rig(ready=False):
 global ARM
 defs=[('Root',(0,0,0),(0,0,.12),None),('Hips',(0,0,.47),(0,0,.55),'Root'),('Spine',(0,0,.55),(0,0,.68),'Hips'),('Chest',(0,0,.68),(0,0,.79),'Spine'),('Neck',(0,0,.80),(0,0,.855),'Chest'),('Head',(0,0,.855),(0,0,1),'Neck')]
 for side,sign in [('L',1),('R',-1)]:
  shoulder=(sign*.145,0,.785);elbow=(sign*(.205 if ready else .24),0,.645);wrist=(sign*(.215 if ready else .30),-.105 if ready else 0,.605 if ready else .485);hand=(wrist[0],wrist[1]-.008,wrist[2]-.06)
  defs += [('Arm_'+side,shoulder,elbow,'Chest'),('Forearm_'+side,elbow,wrist,'Arm_'+side),('Hand_'+side,wrist,hand,'Forearm_'+side),('Leg_'+side,(sign*.062,0,.47),(sign*.070,0,.255),'Hips'),('Shin_'+side,(sign*.070,0,.255),(sign*.074,0,.045),'Leg_'+side),('Foot_'+side,(sign*.074,0,.045),(sign*.074,-.082,.014),'Shin_'+side),('Prop_'+side,wrist,(wrist[0],wrist[1]-.045,wrist[2]),'Hand_'+side)]
 defs += [('Prop_Back',(0,.065,.735),(0,.065,.635),'Chest')]
 data=bpy.data.armatures.new('CanonicalHumanoid');arm=bpy.data.objects.new('RootRig',data);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,head,tail,parent in defs:
  b=data.edit_bones.new(name);b.head=head;b.tail=tail;b.roll=0
  if parent:b.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');arm.show_in_front=True;ARM=arm
 for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
 arm['body_height']=1.;arm['front']='Blender -Y';arm['fps']=20
 return arm

def build_body(ready=False,lite=False,modest=True):
 palette();arm=rig(ready);meshes=[];s=5 if lite else 8
 # Torso rings: oval depth, narrower waist, shoulder mass; coherent faceted adult silhouette.
 meshes.append(tube('BodyTorso',[(0,0,z) for z in [.445,.48,.54,.61,.68,.75,.79]],[(.093,.065),(.105,.070),(.084,.054),(.079,.054),(.106,.067),(.133,.068),(.10,.054)],'Skin',['Hips','Hips','Spine','Spine','Chest','Chest','Chest'],s,arm))
 meshes.append(tube('BodyNeck',[(0,0,.785),(0,0,.83),(0,0,.86)],[(.040,.035),(.033,.031),(.038,.034)],'Skin',['Neck']*3,6 if lite else 8,arm))
 # Head receives angular jaw/temple/crown, not a sphere or infant head.
 meshes.append(tube('BodyHead',[(0,-.009,z) for z in [.845,.861,.905,.954,.982,1]],[(.027,.031),(.043,.047),(.060,.053),(.059,.050),(.049,.041),(.028,.026)],'Skin',['Head']*6,6 if lite else 10,arm))
 if not lite:
  verts=[(-.013,-.062,.938),(.013,-.062,.938),(-.011,-.073,.905),(.011,-.073,.905),(0,-.083,.91)];faces=[(0,1,4),(0,4,2),(1,3,4),(2,4,3),(0,2,3),(0,3,1)]
  meshes.append(mesh_obj('FaceNose',verts,faces,'Skin','Head',arm=arm))
  for sign in [-1,1]:meshes.append(tube('Ear_'+str(sign),[(sign*.058,0,.905),(sign*.064,0,.927),(sign*.057,0,.947)],[.009,.013,.009],'Skin',['Head']*3,4,arm))
 for side,sign in [('L',1),('R',-1)]:
  shoulder=arm.data.bones['Arm_'+side].head_local;elbow=arm.data.bones['Forearm_'+side].head_local;wrist=arm.data.bones['Hand_'+side].head_local
  centers=[shoulder,shoulder.lerp(elbow,.32),elbow,elbow.lerp(wrist,.38),wrist]
  ws=['Arm_'+side,'Arm_'+side,{'Arm_'+side:.5,'Forearm_'+side:.5},'Forearm_'+side,'Hand_'+side]
  meshes.append(tube('BodyArm_'+side,[tuple(v) for v in centers],[(.041,.037),(.040,.035),(.029,.030),(.032,.031),(.020,.023)],'Skin',ws,s,arm))
  end=arm.data.bones['Hand_'+side].tail_local
  meshes.append(tube('BodyHand_'+side,[tuple(wrist),tuple(wrist.lerp(end,.55)),tuple(end)],[(.024,.021),(.026,.022),(.017,.016)],'Skin',['Hand_'+side]*3,4 if lite else 6,arm))
  if not lite:meshes.append(tube('Thumb_'+side,[tuple(wrist+Vector((-sign*.02,-.008,-.017))),tuple(wrist+Vector((-sign*.035,-.022,-.035)))],[.012,.009],'Skin',['Hand_'+side]*2,4,arm))
  centers=[(sign*.061,0,.465),(sign*.065,0,.405),(sign*.073,-.004,.295),(sign*.070,-.013,.252),(sign*.073,.006,.192),(sign*.074,.006,.100),(sign*.074,0,.045)]
  ws=['Leg_'+side,'Leg_'+side,'Leg_'+side,{'Leg_'+side:.45,'Shin_'+side:.55},'Shin_'+side,'Shin_'+side,'Foot_'+side]
  meshes.append(tube('BodyLeg_'+side,centers,[(.052,.049),(.050,.045),(.036,.034),(.032,.032),(.039,.036),(.026,.027),(.020,.022)],'Skin',ws,s,arm))
  meshes.append(tube('BodyFoot_'+side,[(sign*.074,.012,.025),(sign*.074,-.025,.027),(sign*.074,-.075,.018),(sign*.074,-.105,.015)],[(.022,.023),(.031,.029),(.033,.019),(.026,.013)],'Skin',['Foot_'+side]*4,4 if lite else 6,arm))
 if modest:meshes.append(tube('WorkshopWrap',[(0,0,.43),(0,0,.485),(0,0,.52)],[(.111,.078),(.109,.075),(.095,.068)],'Cloth',['Hips']*3,s,arm))
 # Join only shared body; separate future attachment geometry is excluded from loader scale.
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=meshes[0];body.name='LOD0';body['master_body']=True
 if lite:
  # Crew derivative, single finite simplification. All vertex-group weights are retained.
  dec=body.modifiers.new('CrewDerivative','DECIMATE');dec.ratio=.73;dec.use_collapse_triangulate=True
  bpy.ops.object.modifier_apply(modifier=dec.name)
 return arm,body

def rotate_world(arm,bone,angles):
 basis=arm.data.bones[bone].matrix_local.to_3x3();q=Quaternion((1,0,0),0)
 for axis,ang in zip([(1,0,0),(0,1,0),(0,0,1)],angles):
  q=q@Quaternion(basis.inverted()@Vector(axis),math.radians(ang))
 arm.pose.bones[bone].rotation_quaternion=q

def make_action(arm,name,frames,keys,loop=False):
 action=bpy.data.actions.new(name);arm.animation_data_create();arm.animation_data.action=action
 for frame,pose in keys:
  for pb in arm.pose.bones:pb.rotation_quaternion=Quaternion((1,0,0,0));pb.location=(0,0,0)
  for b,angles in pose.get('r',{}).items():rotate_world(arm,b,angles)
  for b,loc in pose.get('t',{}).items():arm.pose.bones[b].location=loc
  for pb in arm.pose.bones:
   pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
 action.use_frame_range=True;action.frame_start=1;action.frame_end=frames;action['loop']=loop
 track=arm.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,action);track.mute=True;arm.animation_data.action=None
 return action

def add_actions(arm,archetype='melee'):
 clips={}
 def add(name,n,keys,loop=False):clips[name]={'frames':n,'fps':20,'loop':loop};make_action(arm,name,n,keys,loop)
 idle={'r':{'Chest':(0,0,-1),'Head':(0,0,2)}}
 add('Idle',40,[(1,{}),(21,idle),(41,{})],True);add('IdleAlt',40,[(1,{}),(21,{'r':{'Head':(0,0,-8),'Chest':(0,0,2)}}),(41,{})],True)
 for name,n,a in [('Walk',20,19),('Run',14,32),('Retreat-run',14,30)]:
  p1={'r':{'Leg_L':(-a,0,0),'Leg_R':(a,0,0),'Shin_L':(8,0,0),'Shin_R':(24,0,0),'Arm_L':(8,0,0),'Arm_R':(-8,0,0)}}
  p2={'r':{'Leg_L':(a,0,0),'Leg_R':(-a,0,0),'Shin_L':(24,0,0),'Shin_R':(8,0,0),'Arm_L':(-8,0,0),'Arm_R':(8,0,0)}}
  add(name,n,[(1,p1),(1+n//2,p2),(n+1,p1)],True)
 add('Attack',20,[(1,{}),(6,{'r':{'Chest':(0,0,-12),'Arm_R':(-12,0,-10),'Forearm_R':(-18,0,0),'Prop_R':(12,0,0)}}),(11,{'r':{'Chest':(12,0,15),'Arm_R':(48,0,10),'Forearm_R':(25,0,0),'Prop_R':(18,0,0)}}),(20,{})])
 add('Attack2',24,[(1,{}),(7,{'r':{'Chest':(0,0,-18),'Arm_R':(-25,0,-8),'Prop_R':(-15,0,0)}}),(13,{'r':{'Chest':(7,0,20),'Arm_R':(35,0,12),'Forearm_R':(42,0,0),'Prop_R':(10,0,0)}}),(24,{})])
 add('Block',20,[(1,{}),(6,{'r':{'Arm_L':(18,-15,12),'Forearm_L':(20,0,0),'Chest':(0,0,-10)}}),(15,{'r':{'Arm_L':(18,-15,12),'Forearm_L':(20,0,0),'Chest':(-5,0,-12)}}),(20,{})])
 add('Hit',8,[(1,{}),(4,{'r':{'Chest':(-15,0,-12),'Head':(-10,0,0),'Hips':(-5,0,0)}}),(8,{})])
 for name,sign in [('Death',1),('DeathAlt',-1)]:
  # Root tilts the whole body while translating it to lie on floor; later floor pass fixes exact clearance.
  add(name,30,[(1,{}),(9,{'r':{'Chest':(-12*sign,0,sign*14),'Leg_L':(20,0,0),'Shin_L':(30,0,0)}}),(20,{'r':{'Root':(-60*sign,0,sign*12),'Chest':(-8*sign,0,0)},'t':{'Root':(0,.13,.12)}}),(30,{'r':{'Root':(-87*sign,0,sign*12),'Chest':(-5*sign,0,0),'Arm_R':(0,0,15),'Arm_L':(0,0,-15)},'t':{'Root':(0,.10,.10)}})])
 add('Cheer',32,[(1,{}),(9,{'r':{'Arm_R':(-42,0,-15),'Forearm_R':(-35,0,0),'Prop_R':(60,0,0),'Head':(-5,0,0)}}),(17,{}),(25,{'r':{'Arm_R':(-42,0,-15),'Forearm_R':(-35,0,0),'Prop_R':(60,0,0)}}),(33,{})],True)
 bpy.context.scene.render.fps=20;return clips

def export_file(path,arm,meshes):
 bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=arm
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_frame_range=False,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='NONE',export_optimize_animation_size=False)

def ground_actions(arm,meshes,floor=.001):
 """Finite per-frame vertical root correction, retaining authored actions and clear floor."""
 scene=bpy.context.scene;root=arm.pose.bones['Root'];basis=arm.data.bones['Root'].matrix_local.to_3x3();counts={}
 for track in arm.animation_data.nla_tracks:track.mute=True
 for track in arm.animation_data.nla_tracks:
  action=track.strips[0].action;arm.animation_data.action=action;n=int(action.frame_end);samples=[]
  for f in range(1,n+1):
   scene.frame_set(f);dg=bpy.context.evaluated_depsgraph_get();low=1e6
   for ob in meshes:
    eo=ob.evaluated_get(dg);me=eo.to_mesh();low=min(low,min((eo.matrix_world@v.co).z for v in me.vertices));eo.to_mesh_clear()
   delta=max(0,floor-low);samples.append((f,root.location.copy()+basis.inverted()@Vector((0,0,delta)),delta))
  for f,loc,delta in samples:root.location=loc;root.keyframe_insert('location',frame=f)
  if action.get('loop'):root.location=samples[0][1];root.keyframe_insert('location',frame=n+1)
  counts[action.name]={'corrected_frames':sum(x[2]>.00001 for x in samples),'maximum_vertical_lift':round(max(x[2] for x in samples),6)}
 arm.animation_data.action=bpy.data.actions.get('Idle');scene.frame_set(1);return counts

def triangles(objects):
 return sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH')

# ---- Claude additions (2026-10-07): recolouring, mounts, rest-pose baking, assembly, export ----

def set_colors(overrides):
 """Recolour material tags for one file: {'Leather': '9A6438'} or {'Metal': ('B4643C', .8, 0)}
 (hex, roughness, metallic). The tag names stay the unit contract; only the flat colour changes."""
 palette()
 for name,spec in overrides.items():
  h,rough,metal=(spec,.7,0) if isinstance(spec,str) else spec
  m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
  c=tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4))
  m.diffuse_color=(*c,1);n=m.node_tree.nodes.get('Principled BSDF')
  n.inputs['Base Color'].default_value=(*c,1);n.inputs['Roughness'].default_value=rough;n.inputs['Metallic'].default_value=metal

def make_armature(name,defs,location=(0,0,0)):
 """An armature object from [(bone, head, tail, parent)], heads and tails in its own space."""
 data=bpy.data.armatures.new(name);arm=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(arm)
 bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT')
 for bone,head,tail,parent in defs:
  b=data.edit_bones.new(bone);b.head=head;b.tail=tail;b.roll=0
  if parent:b.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode='OBJECT');arm.location=location
 for pb in arm.pose.bones:pb.rotation_mode='QUATERNION'
 return arm

# Mount proportions in H (a standing person = 1). Bronze Age horses were small (about 1.35 m at the
# withers, 0.78 H); the ox is a long-horned draught ox like those of Egyptian tomb paintings.
MOUNTS={
 'horse':{'barrel':([(0,-.47,.64),(0,-.40,.63),(0,-.18,.585),(0,.12,.585),(0,.35,.62),(0,.46,.64)],[(.085,.07),(.145,.115),(.155,.125),(.15,.12),(.145,.125),(.075,.065)]),
  'neck':([(0,-.40,.68),(0,-.50,.84),(0,-.565,.95)],[(.06,.11),(.05,.08),(.045,.065)]),
  'head':([(0,-.56,.985),(0,-.665,.94),(0,-.78,.85)],[(.048,.062),(.042,.052),(.033,.04)]),
  'tail':[(0,.465,.65),(0,.53,.55),(0,.56,.38)],'tail_r':[.025,.04,.02],
  'leg_x':.085,'front_y':-.32,'hind_y':.32,'leg_top':.60,'knee':.30,'leg_r':(.05,.04,.028),'shin_r':(.026,.021,.023),
  'seat':(0,-.06,.765),'ears':True,'mane':True,'horns':False},
 'ox':{'barrel':([(0,-.50,.50),(0,-.42,.52),(0,-.18,.50),(0,.14,.49),(0,.38,.50),(0,.49,.50)],[(.11,.09),(.19,.15),(.20,.16),(.19,.155),(.175,.15),(.09,.08)]),
  'neck':([(0,-.44,.56),(0,-.55,.57),(0,-.62,.55)],[(.085,.13),(.075,.11),(.065,.09)]),
  'head':([(0,-.62,.58),(0,-.71,.50),(0,-.79,.40)],[(.06,.07),(.055,.062),(.045,.05)]),
  'tail':[(0,.50,.56),(0,.54,.42),(0,.55,.24)],'tail_r':[.018,.014,.03],
  'leg_x':.105,'front_y':-.34,'hind_y':.36,'leg_top':.46,'knee':.22,'leg_r':(.062,.05,.034),'shin_r':(.032,.027,.03),
  'seat':(0,0,.70),'ears':True,'mane':False,'horns':True},
}

def quadruped(prefix,kind='horse',at=(0,0,0),coat='Leather',dark='Wood',horn='Cloth'):
 """A horse or ox facing -Y with hooves on Z = 0, in its own armature at `at`. Bones: Mount_Root,
 Mount_Spine, Mount_Neck, Mount_Head, Mount_Tail, Rider (the seat socket), and per leg
 Mount_Leg{Front,Hind}_{L,R} + Mount_Shin{Front,Hind}_{L,R}: the loader trots front-left with
 hind-right. Returns (armature, meshes)."""
 P=MOUNTS[kind];x0=P['leg_x'];top=P['leg_top'];knee=P['knee']
 defs=[('Mount_Root',(0,0,0),(0,0,.1),None),('Mount_Spine',(0,.36,top+.02),(0,-.36,top+.02),'Mount_Root'),
  ('Mount_Neck',P['neck'][0][0],P['neck'][0][-1],'Mount_Spine'),('Mount_Head',P['head'][0][0],P['head'][0][-1],'Mount_Neck'),
  ('Mount_Tail',P['tail'][0],P['tail'][-1],'Mount_Spine'),('Rider',P['seat'],(P['seat'][0],P['seat'][1],P['seat'][2]+.1),'Mount_Spine')]
 legs=[]
 for end,y in [('Front',P['front_y']),('Hind',P['hind_y'])]:
  for side,sign in [('L',1),('R',-1)]:
   x=sign*x0;hock=(x,y+(.03 if end=='Hind' else 0),knee)
   defs+=[(f'Mount_Leg{end}_{side}',(x,y,top),hock,'Mount_Spine'),(f'Mount_Shin{end}_{side}',hock,(x,y,.0),f'Mount_Leg{end}_{side}')]
   legs.append((end,side,x,y,hock))
 arm=make_armature(f'{prefix}Rig',defs,at);meshes=[]
 c,r=P['barrel'];meshes.append(tube(f'{prefix}Barrel',c,r,coat,['Mount_Spine']*len(c),6,arm))
 c,r=P['neck'];meshes.append(tube(f'{prefix}Neck',c,r,coat,['Mount_Neck']*len(c),6,arm))
 c,r=P['head'];meshes.append(tube(f'{prefix}Head',c,r,coat,['Mount_Head']*len(c),6,arm))
 meshes.append(tube(f'{prefix}Tail',P['tail'],P['tail_r'],dark,['Mount_Tail']*3,4,arm))
 for end,side,x,y,hock in legs:
  b=f'Mount_Leg{end}_{side}';s=f'Mount_Shin{end}_{side}';lr=P['leg_r'];sr=P['shin_r']
  meshes.append(tube(f'{prefix}Thigh{end}_{side}',[(x,y,top-.02),((x+hock[0])/2,(y+hock[1])/2,(top+knee)/2),hock],[(lr[0],lr[0]*1.2),(lr[1],lr[1]*1.1),(lr[2],lr[2])],coat,[b]*3,5,arm))
  meshes.append(tube(f'{prefix}Cannon{end}_{side}',[hock,(x,y,.12),(x,y-.01,.055)],[sr[0],sr[1],sr[2]],coat,[s]*3,5,arm))
  meshes.append(box(f'{prefix}Hoof{end}_{side}',(x,y-.012,.026),(sr[2]*2.2,sr[2]*2.6,.052),dark,s,arm))
 hx,hy,hz=P['head'][0][0]
 if P['ears']:
  for sign in (-1,1):meshes.append(mesh_obj(f'{prefix}Ear{sign}',[(sign*.022,hy+.01,hz+.03),(sign*.045,hy+.02,hz+.03),(sign*.04,hy+.012,hz+.09)],[(0,1,2),(0,2,1)],coat,'Mount_Head',arm=arm))
 if P['mane']:
  # a crest along the top of the neck: left, right and ridge rows, both slopes
  pts=[(0,-.37,.80),(0,-.46,.90),(0,-.53,1.0),(0,-.57,1.035)];v=[];f=[]
  for x,y,z in pts:v+=[(-.022,y,z-.03),(.022,y,z-.03),(0,y+.025,z+.035)]
  for i in range(len(pts)-1):
   a=3*i;b=3*(i+1);f+=[(a,a+2,b+2),(a,b+2,b),(a+1,b+1,b+2),(a+1,b+2,a+2)]
  meshes.append(mesh_obj(f'{prefix}Mane',v,f,dark,'Mount_Neck',arm=arm))
 if P['horns']:
  for sign in (-1,1):
   # long lyre horns, outward then up
   meshes.append(tube(f'{prefix}Horn{sign}',[(sign*.04,hy+.01,hz+.03),(sign*.13,hy+.02,hz+.09),(sign*.16,hy,hz+.20)],[.018,.012,.004],horn,['Mount_Head']*3,4,arm))
 return arm,meshes

def bake_rest_pose(arm,meshes,pose):
 """Pose bones ({'r': {bone: (x, y, z degrees)}} as make_action) and make that the rest pose: the
 meshes keep the posed shape, the skeleton's rest matches it, weights are unchanged (a seated rider,
 a driver). The soldier loader then bakes this pose with no clip needed."""
 for pb in arm.pose.bones:pb.rotation_quaternion=Quaternion((1,0,0,0));pb.location=(0,0,0)
 for b,angles in pose.get('r',{}).items():rotate_world(arm,b,angles)
 bpy.context.view_layer.update()
 for ob in meshes:
  mod=next((m for m in ob.modifiers if m.type=='ARMATURE'),None)
  if not mod:continue
  bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=ob;ob.select_set(True)
  bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=arm;arm.select_set(True)
 bpy.ops.object.mode_set(mode='POSE');bpy.ops.pose.armature_apply(selected=False);bpy.ops.object.mode_set(mode='OBJECT')
 for ob in meshes:
  if ob.parent==arm and not any(m.type=='ARMATURE' for m in ob.modifiers):
   mod=ob.modifiers.new('CanonicalRig','ARMATURE');mod.object=arm

def drop_faces(ob,inside):
 """Delete the faces whose centre (object space) satisfies inside(Vector): skin hidden under clothes
 or inside a vehicle body."""
 import bmesh
 bm=bmesh.new();bm.from_mesh(ob.data)
 bmesh.ops.delete(bm,geom=[f for f in bm.faces if inside(f.calc_center_median())],context='FACES')
 bm.to_mesh(ob.data);bm.free();ob.data.update()

def crew(prefix,at,lite=True,ready=True,yaw=0,head='headcloth'):
 """A dressed person in their own armature at `at` (the lite body for crews): Team kilt, linen top,
 headcloth or bronze cap. Returns (armature, meshes)."""
 arm,body=build_body(ready=ready,lite=lite,modest=False);arm.name=f'{prefix}Rig';body.name=f'{prefix}Body'
 drop_faces(body,lambda c:.36<c.z<.74 and abs(c.x)<.13)
 m=[body]
 m.append(tube(f'{prefix}Kilt',[(0,0,.34),(0,0,.45),(0,0,.525)],[(.13,.09),(.112,.08),(.095,.068)],'Team',['Hips']*3,6,arm))
 m.append(tube(f'{prefix}Linen',[(0,0,.515),(0,0,.61),(0,0,.73),(0,0,.785)],[(.098,.066),(.088,.064),(.135,.078),(.108,.062)],'Cloth',['Spine','Spine','Chest','Chest'],6,arm))
 if head=='headcloth':m.append(tube(f'{prefix}Headcloth',[(0,-.003,.952),(0,0,.99),(0,0,1.012)],[(.064,.056),(.058,.049),(.03,.03)],'Cloth',['Head']*3,6,arm))
 elif head=='cap':m.append(tube(f'{prefix}Cap',[(0,-.003,.945),(0,-.002,.96),(0,0,1.012),(0,0,1.036)],[(.066,.059),(.065,.058),(.022,.02),(.002,.002)],'Metal',['Head']*4,6,arm))
 arm.location=at;arm.rotation_euler=(0,0,math.radians(yaw))
 return arm,m

def assemble(uid,parts):
 """One root empty named `uid` (the unit file's object) over every armature and loose mesh."""
 root=bpy.data.objects.new(uid,None);bpy.context.collection.objects.link(root)
 bpy.context.view_layer.update()
 for ob in parts:
  mw=ob.matrix_world.copy();ob.parent=root;ob.matrix_world=mw
 return root

def export_unit(path,animations=False):
 """Export every armature, mesh and empty of the scene as one GLB (glTF Y up, front +Z), flat
 materials only, glTF extras kept (the attachment flags)."""
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type in ('MESH','ARMATURE','EMPTY'):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_skins=True,export_animations=animations,export_cameras=False,export_lights=False,export_extras=True,export_materials='EXPORT',export_image_format='NONE')

def scene_triangles():
 return triangles([o for o in bpy.context.scene.objects if o.type=='MESH'])
