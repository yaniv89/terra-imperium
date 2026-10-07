# scripts/blender/build_bronze_ranged.py
# Bronze ranged (archer, self bow and quiver): blender -b -P scripts/blender/build_bronze_ranged.py
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
import bpy,sys,os,math,json,hashlib,bmesh
from mathutils import Vector,Matrix,Quaternion
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import ti_units as H
import ti_units_bow as E
OUT=str(H.out_dir('bronze-ranged'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
arm,body=H.build_body(ready=False,lite=False,modest=False);body.name='bronze-ranged-body';body['role']='bronze-ranged';H.palette()
bpy.context.view_layer.objects.active=arm;arm.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bs=arm.data.edit_bones.new('Prop_String');bs.head=(.30,.094,.485);bs.tail=(.30,.094,.505);bs.parent=arm.data.edit_bones['Prop_L'];bpy.ops.object.mode_set(mode='OBJECT');arm.pose.bones['Prop_String'].rotation_mode='QUATERNION'
# Garments follow the sheet: cream linen short tunic, broad grey shoulder shawl, leather belt.
# Claude 2026-10-07: the kilt is Team (was Cloth) so the side reads at 30 px like the other units.
H.tube('linen-tunic',[(0,0,z)for z in[.43,.51,.60,.70,.77]],[(.118,.084),(.103,.079),(.088,.074),(.115,.082),(.140,.077)],'Cloth',['Hips','Hips','Spine','Chest','Chest'],8,arm)
H.tube('linen-kilt',[(0,0,.345),(0,0,.435),(0,0,.515)],[(.142,.087),(.122,.084),(.101,.075)],'Team',['Hips']*3,10,arm)
for side,sign in[('L',1),('R',-1)]:
 shoulder=arm.data.bones['Arm_'+side].head_local;elbow=arm.data.bones['Forearm_'+side].head_local
 H.tube('short-sleeve-'+side,[tuple(shoulder),tuple(shoulder.lerp(elbow,.46)),tuple(shoulder.lerp(elbow,.53))],[.052,.050,.049],'Cloth',['Arm_'+side]*3,8,arm)
 H.box('sandal-sole-'+side,(sign*.074,-.040,.010),(.067,.132,.014),'Leather','Foot_'+side,arm)
 H.box('sandal-toe-strap-'+side,(sign*.074,-.069,.042),(.072,.016,.014),'Leather','Foot_'+side,arm)
 H.box('sandal-ankle-strap-'+side,(sign*.074,.006,.061),(.050,.023,.026),'Leather','Foot_'+side,arm)
H.tube('belt',[(0,0,.509),(0,0,.529)],[(.106,.083),(.106,.083)],'Leather',['Hips']*2,12,arm)
H.box('belt-buckle',(-.032,-.086,.519),(.020,.009,.019),'Metal','Hips',arm)
# A folded front bib and back panel form the approved neutral Team shoulder wrap.
vs=[(-.145,-.037,.787),(-.075,-.068,.806),(0,-.048,.794),(.075,-.068,.806),(.145,-.037,.787),(.094,-.092,.741),(0,-.106,.708),(-.094,-.092,.741),(-.130,.064,.786),(.130,.064,.786),(.076,.081,.724),(-.076,.081,.724)]
faces=[(0,1,7),(1,2,6,7),(2,3,5,6),(3,4,5),(0,8,9,4),(8,11,10,9),(0,7,11,8),(4,9,10,5)]
H.mesh_obj('team-shoulder-shawl',vs,faces,'Team','Chest',arm=arm)
H.tube('hair-cap',[(0,-.003,.935),(0,-.002,.965),(0,0,.990),(0,0,1.014)],[(.065,.059),(.064,.056),(.051,.045),(.021,.020)],'Wood',['Head']*4,10,arm)
# Leather cross strap, rendered as a thin faceted raised band over the tunic.
H.mesh_obj('diagonal-quiver-strap',[(-.128,-.068,.794),(-.105,-.077,.794),(.103,-.084,.520),(.079,-.089,.520)],[(0,1,2,3)],'Leather','Chest',arm=arm)
E.equipment(arm)
for ob in bpy.context.scene.objects:
 if ob.type=='MESH' and ob.name.startswith(('self-bow','bow-grip','bow-string')):
  for v in ob.data.vertices:v.co+=Vector((.045,.174,.045))
string=bpy.data.objects['bow-string'];string.vertex_groups['Prop_L'].remove(list(range(4,8)));sg=string.vertex_groups.new(name='Prop_String');sg.add(list(range(4,8)),1,'REPLACE')
E.tube('nocked-arrow-shaft',[(-.30,0,.485),(-.30,-.42,.485)],[.0019,.0019],bpy.data.materials['Wood'],'Prop_R',arm,4)
E.mesh('nocked-arrow-head',[(-.306,-.415,.485),(-.294,-.415,.485),(-.30,-.438,.483),(-.30,-.438,.487)],[(0,1,2),(1,0,3),(0,2,3),(1,3,2)],bpy.data.materials['Metal'],'Prop_R',arm)
E.mesh('nocked-arrow-fletching',[(-.307,-.018,.485),(-.293,-.018,.485),(-.295,-.055,.485),(-.305,-.055,.485)],[(0,1,2,3)],bpy.data.materials['Cloth'],'Prop_R',arm)
# Canonical local skeleton clips at 20fps. Retain master gait/hit/death, add true archer phases.
H.add_actions(arm)
keep={'Idle','IdleAlt','Walk','Run','Hit','Death','DeathAlt'}
for track in list(arm.animation_data.nla_tracks):
 if track.name not in keep:arm.animation_data.nla_tracks.remove(track)
for action in list(bpy.data.actions):
 if action.name not in keep:bpy.data.actions.remove(action)
draw={'r':{'Chest':(0,0,-12),'Arm_L':(-68,0,-8),'Forearm_L':(-12,0,0),'Arm_R':(-45,0,62),'Forearm_R':(-86,0,-26),'Head':(0,0,12)}}
ready={'r':{'Arm_L':(-48,0,-4),'Forearm_L':(-20,0,0),'Arm_R':(-20,0,35),'Forearm_R':(-42,0,-8)}}
release={'r':{'Chest':(0,0,-9),'Arm_L':(-66,0,-8),'Forearm_L':(-12,0,0),'Arm_R':(-42,0,70),'Forearm_R':(-80,0,-18),'Head':(0,0,12)}}
H.make_action(arm,'Draw-aim-release',32,[(1,{}),(7,ready),(17,draw),(21,draw),(22,release),(27,ready),(33,{})],True)
H.make_action(arm,'Melee-fallback',20,[(1,{}),(6,{'r':{'Chest':(0,0,-16),'Arm_L':(-35,0,20),'Forearm_L':(-30,0,0)}}),(11,{'r':{'Chest':(8,0,18),'Arm_L':(-50,0,-20),'Forearm_L':(-8,0,0)}}),(20,{})])
# Solve bow pose explicitly in world space: left arm extends toward -Y, right draws to cheek.
# The bow socket keeps its upright rest orientation rather than rolling with the wrist.
action=bpy.data.actions['Draw-aim-release'];arm.animation_data.action=action
for frame,strength in[(1,0),(7,.50),(17,1),(21,1),(22,.93),(27,.50),(33,0)]:
 bpy.context.scene.frame_set(frame)
 for pb in arm.pose.bones:pb.rotation_quaternion=Quaternion((1,0,0,0));pb.location=(0,0,0)
 def aim(bone,direction):
  pb=arm.pose.bones[bone];rest=arm.data.bones[bone];head=pb.matrix.translation.copy();target=Vector(direction).to_track_quat('Y','Z');restq=rest.matrix_local.to_quaternion();q=restq.slerp(target,strength);pb.matrix=Matrix.Translation(head)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
 aim('Arm_L',(0,-1,.02));aim('Forearm_L',(0,-1,.02));aim('Arm_R',(.28,-.95,.15));aim('Forearm_R',(.83,.55,.1))
 prop=arm.pose.bones['Prop_L'];hand=arm.pose.bones['Hand_L'].matrix.translation.copy();prop.matrix=Matrix.Translation(hand)@arm.data.bones['Prop_L'].matrix_local.to_quaternion().to_matrix().to_4x4();bpy.context.view_layer.update()
 for pb in arm.pose.bones:pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('location',frame=frame)
arm.animation_data.action=None
# Draw-string midpoint follows the right nocking hand, with actual skeleton deformation.
# Prop_R carries the arrow, moves it downrange on release, then hides it by scale until reset.
for act in bpy.data.actions:
 arm.animation_data.action=act
 for frame in range(1,int(act.frame_range[1])+1):
  bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();pb=arm.pose.bones['Prop_R'];sb=arm.pose.bones['Prop_String'];pb.scale=(1,1,1);sb.scale=(1,1,1)
  lh=arm.pose.bones['Hand_L'].head.copy();rh=arm.pose.bones['Hand_R'].head.copy();propL=arm.pose.bones['Prop_L'];restString=arm.data.bones['Prop_String'].head_local
  relaxed=propL.matrix@arm.data.bones['Prop_L'].matrix_local.inverted()@restString
  pulling=act.name=='Draw-aim-release'and 7<=frame<=21
  strength=0 if not pulling else min(1,(frame-6)/11)
  midpoint=relaxed.lerp(rh,strength);sb.matrix=Matrix.Translation(midpoint)@arm.data.bones['Prop_String'].matrix_local.to_quaternion().to_matrix().to_4x4()
  if act.name=='Draw-aim-release'and 7<=frame<=26:
   direction=(lh-rh).normalized();anchor=rh.copy()
   if frame>=22:anchor+=direction*((frame-21)*.22)
   pb.matrix=Matrix.Translation(anchor)@direction.to_track_quat('Y','Z').to_matrix().to_4x4()
   if frame>=25:pb.scale=(.001,.001,.001)
  for node in[pb,sb]:node.keyframe_insert('rotation_quaternion',frame=frame);node.keyframe_insert('location',frame=frame);node.keyframe_insert('scale',frame=frame)
 arm.animation_data.action=None
floor_audit={};meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for act in bpy.data.actions:
 arm.animation_data.action=act;minimum=100;maxfix=0
 for frame in range(1,int(act.frame_range[1])+1):
  bpy.context.scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();low=100
  for ob in meshes:
   eo=ob.evaluated_get(deps);em=eo.to_mesh();low=min(low,min((eo.matrix_world@v.co).z for v in em.vertices));eo.to_mesh_clear()
  if low<.002:
   delta=.002-low;root=arm.pose.bones['Root'];root.location+=arm.data.bones['Root'].matrix_local.to_quaternion().inverted()@Vector((0,0,delta));root.keyframe_insert('location',frame=frame);maxfix=max(maxfix,delta)
  minimum=min(minimum,max(.002,low))
 floor_audit[act.name]={'minZ':round(minimum,5),'maxRootLift':round(maxfix,5)}
bpy.context.scene.render.fps=20;arm.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];tri=H.triangles(meshes)
render_tri=tri;bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'bronze-ranged-render.blend'))
# Derive the light game model without changing the shared neutral source. Clothing hides torso faces.
bm=bmesh.new();bm.from_mesh(body.data);hidden=[f for f in bm.faces if .355<f.calc_center_median().z<.78 and abs(f.calc_center_median().x)<.135 and abs(f.calc_center_median().y)<.078];bmesh.ops.delete(bm,geom=hidden,context='FACES');bm.to_mesh(body.data);bm.free()
for ob in meshes:
 if ob.name.startswith(('quiver-binding','self-bow')):
  bpy.context.view_layer.objects.active=ob;dec=ob.modifiers.new('GameSilhouetteReduction','DECIMATE');dec.ratio=.30 if ob.name.startswith('quiver-binding')else .68;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
tri=H.triangles(meshes)
if tri>1494:
 bpy.context.view_layer.objects.active=body;body_tri=H.triangles([body]);dec=body.modifiers.new('GameBodyReduction','DECIMATE');dec.ratio=max(.45,1-(tri-1494)/body_tri);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
for ob in meshes:
 for vertex in ob.data.vertices:
  total=sum(g.weight for g in vertex.groups)
  if total and abs(total-1)>.000001:
   for g in vertex.groups:ob.vertex_groups[g.group].add([vertex.index],g.weight/total,'REPLACE')
tri=H.triangles(meshes)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'bronze-ranged.blend'));H.export_file(os.path.join(OUT,'bronze-ranged.glb'),arm,meshes)
clips={a.name:{'frames':[int(a.frame_range[0]),int(a.frame_range[1])],'fps':20,'loop':bool(a.get('loop',False))}for a in bpy.data.actions}
report={'unit':'bronze-ranged','status':'production proof pending visual review','triangles':tri,'render_triangles':render_tri,'soft_budget':1500,'hard_budget':3000,'bones':[b.name for b in arm.data.bones],'clips':clips,'floorAudit':floor_audit,'string':'Prop_String optional22nd bone skins bowstring midpoint; actual pull/release atframes7-22','arrow':'Prop_R carries nocked arrow, moves downrangeframes22-24, scalehides25-26, resets27','source_sheet':'art-production/wave1-unit-design/bronze-ranged.png','material_contract':'Current ART-MODELS-PLAN4.1 flat colours; shared approved stylized sheet. No texture atlas.','limitations':['Hand authored animations; source not motion captured.','No game code, runtime registration or sprite sheets changed.']}
with open(os.path.join(OUT,'production-report.json'),'w')as f:json.dump(report,f,indent=2)
# Warm camera proof, matching fixed strategy-view vector, and attack key frame contact sheet images.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.resolution_x=844;scene.render.resolution_y=390;scene.render.resolution_percentage=100;scene.world.color=(.28,.30,.34);scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.35
bpy.ops.object.light_add(type='AREA',location=(2.2,-1.0,3.8));bpy.context.object.data.energy=170;bpy.context.object.data.color=(1,.88,.72);bpy.context.object.data.size=2
bpy.ops.object.light_add(type='AREA',location=(-2,-1,2));bpy.context.object.data.energy=90;bpy.context.object.data.color=(.70,.84,1);bpy.context.object.data.size=3
bpy.ops.object.camera_add(location=(1.7,-1.7,2.55));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.52))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.45;scene.camera=cam
for name,frame in[('Idle',1),('Draw-aim-release',17),('Draw-aim-release',22),('Death',30)]:
 arm.animation_data.action=bpy.data.actions[name];scene.frame_set(frame);scene.render.filepath=os.path.join(OUT,f'proof-{name}-{frame}.png');bpy.ops.render.render(write_still=True)
arm.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'bronze-ranged.blend'))

