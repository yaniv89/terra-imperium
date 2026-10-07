# scripts/blender/build_bronze_worker.py
# Bronze worker (laborer with basket and mattock): blender -b -P scripts/blender/build_bronze_worker.py
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
"""Bronze worker from inspected sheet and shared H1 canonical body; no runtime changes."""
import bpy,bmesh,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ti_units as u
OUT=u.out_dir('bronze-worker')
bpy.ops.wm.read_factory_settings(use_empty=True)
arm,body=u.build_body(ready=False,modest=False);body.name='Body';meshes=[body]
# Remove only skin fully hidden below the skirt; all visible adult anatomy comes from the shared body.
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.delete(bm,geom=[f for f in bm.faces if .345<f.calc_center_median().z<.529 and abs(f.calc_center_median().x)<.15],context='FACES')
bm.to_mesh(body.data);bm.free();body.data.update()
for side,sign in [('L',1),('R',-1)]:
 # A bare worker needs visible deltoid transitions; dressed troops cover this seam with sleeves.
 meshes.append(u.tube('ShoulderSkin_'+side,[(sign*.113,0,.768),(sign*.145,0,.785)],[(.045,.039),(.042,.038)],'Skin',['Chest','Arm_'+side],6,arm))
meshes.append(u.tube('TeamKilt',[(0,0,.345),(0,0,.40),(0,0,.49),(0,0,.53)],[(.131,.095),(.129,.090),(.108,.078),(.094,.064)],'Team',['Hips']*4,8,arm))
meshes.append(u.tube('KiltBelt',[(0,0,.512),(0,0,.535)],[(.099,.069),(.093,.064)],'Team',['Hips']*2,8,arm))
# One restrained overlapping cloth fold, to read as a wrap instead of a cylinder.
meshes.append(u.mesh_obj('KiltFrontFold',[(-.027,-.095,.351),(.028,-.095,.351),(.026,-.079,.516),(-.026,-.079,.516)],[(0,1,2),(0,2,3)],'Team','Hips',arm=arm))
meshes.append(u.tube('LinenHeadcloth',[(0,-.003,.962),(0,0,.983),(0,0,1.005),(0,0,1.011)],[(.064,.054),(.061,.049),(.034,.030),(.008,.008)],'Cloth',['Head']*4,8,arm))
for sign in (-1,1):
 meshes.append(u.mesh_obj('HeadclothTail'+str(sign),[(sign*.057,.016,.971),(sign*.061,.040,.961),(sign*.075,.052,.854),(sign*.046,.028,.849)],[(0,1,2),(0,2,3)],'Cloth','Head',arm=arm))
 # Small dark face planes add direction without an atlas or extra material role.
 cx=sign*.023;meshes.append(u.mesh_obj('Eye'+str(sign),[(cx-.007,-.063,.939),(cx+.007,-.063,.939),(cx+.007,-.064,.933),(cx-.007,-.064,.933)],[(0,1,2),(0,2,3)],'Leather','Head',arm=arm))
for side,sign in [('L',1),('R',-1)]:
 meshes.append(u.box('SandalSole_'+side,(sign*.074,-.042,.009),(.068,.134,.018),'Leather','Foot_'+side,arm))
 meshes.append(u.tube('SandalToeStrap_'+side,[(sign*.074-.034,-.068,.023),(sign*.074,-.068,.040),(sign*.074+.034,-.068,.023)],[.009]*3,'Leather',['Foot_'+side]*3,4,arm))
 meshes.append(u.tube('SandalAnkle_'+side,[(sign*.074,0,.058),(sign*.074,0,.073)],[(.026,.029)]*2,'Leather',['Foot_'+side]*2,6,arm))
# Hollow low-poly basket: outer wall, inner wall, rim and bottom. All geometry is separate/swappable.
cx,cy=.32,.015;n=10;verts=[];faces=[]
for radius,z in [(.061,.19),(.085,.36),(.078,.36),(.055,.20)]:
 for j in range(n):
  angle=2*math.pi*j/n;verts.append((cx+radius*math.cos(angle),cy+radius*.83*math.sin(angle),z))
for ring in (0,1,2):
 for j in range(n):faces.append((ring*n+j,ring*n+(j+1)%n,(ring+1)*n+(j+1)%n,(ring+1)*n+j))
faces.append(tuple(range(3*n,4*n)))
meshes.append(u.mesh_obj('Basket',verts,faces,'Wood','Prop_L',True,arm=arm))
for z,radius in [(.245,.070),(.320,.080)]:
 verts=[];faces=[]
 for h in (z-.006,z+.006):
  for j in range(n):
   a=2*math.pi*j/n;verts.append((cx+radius*math.cos(a),cy+radius*.83*math.sin(a),h))
 for j in range(n):faces.append((j,(j+1)%n,n+(j+1)%n,n+j))
 meshes.append(u.mesh_obj('BasketBinding'+str(z),verts,faces,'Leather','Prop_L',True,arm=arm))
centers=[(cx-.078,cy,.355),(cx-.050,cy,.420),(cx,cy,.458),(cx+.050,cy,.420),(cx+.078,cy,.355)]
meshes.append(u.tube('BasketHandle',centers,[.010]*5,'Wood',['Prop_L']*5,4,arm,True))
# Short wood handle and transverse mattock head, restrained matte bronze.
handle_top=(-.302,-.024,.456);handle_bottom=(-.380,-.110,.089)
meshes.append(u.tube('MattockHandle',[handle_bottom,handle_top],[.010,.008],'Wood',['Prop_R']*2,6,arm,True))
x,y,z=handle_bottom;verts=[(x-.085,y-.016,z-.016),(x+.085,y-.016,z-.016),(x+.085,y+.016,z-.016),(x-.085,y+.016,z-.016),(x-.070,y-.021,z+.012),(x+.070,y-.021,z+.012),(x+.070,y+.021,z+.012),(x-.070,y+.021,z+.012)]
faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
meshes.append(u.mesh_obj('MattockHead',verts,faces,'Metal','Prop_R',True,arm=arm))
meshes.append(u.box('MattockSocket',(x,y,z+.003),(.038,.047,.043),'Metal','Prop_R',arm,True))
# Exact Worker clip list from current ART-MODELS-PLAN and ART-PRODUCTION-PLAN S8.
clips={}
def add(name,period,keys,loop=False):
 action=u.make_action(arm,name,period,keys,loop)
 # Loop endpoints are included: period intervals at20fps, closed samples 1..period+1.
 if loop:action.frame_end=period+1
 clips[name]={'frames':period+1 if loop else period,'fps':20,'loop':loop,'period_intervals':period if loop else None}
 return action
rest={};breath={'r':{'Chest':(0,0,-1),'Head':(0,0,2)}}
add('Idle',40,[(1,rest),(21,breath),(41,rest)],True)
for name,period,amplitude in [('Walk',20,19),('Run',14,30),('Carry',24,14)]:
 def gait(sign):
  a=amplitude*sign
  return {'r':{'Leg_L':(-a,0,0),'Leg_R':(a,0,0),'Shin_L':(8 if sign==1 else 23,0,0),'Shin_R':(23 if sign==1 else 8,0,0),'Arm_L':((2 if name=='Carry' else 7)*sign,0,0),'Arm_R':(-6*sign,0,0),'Forearm_L':(-3 if name=='Carry' else 0,0,0),'Chest':(5 if name=='Carry' else 0,0,0)}}
 add(name,period,[(1,gait(1)),(1+period//2,gait(-1)),(period+1,gait(1))],True)
add('Chop',32,[(1,{}),(9,{'r':{'Arm_R':(-98,0,-9),'Forearm_R':(-22,0,0),'Prop_R':(100,0,0),'Head':(-8,0,0)}}),(19,{'r':{'Chest':(14,0,6),'Arm_R':(-9,0,0),'Forearm_R':(6,0,0),'Prop_R':(-12,0,0)}}),(33,{})],True)
add('Mine',28,[(1,{'r':{'Chest':(8,0,0),'Arm_R':(-20,0,0),'Prop_R':(15,0,0)}}),(9,{'r':{'Chest':(8,0,-8),'Arm_R':(-55,0,0),'Forearm_R':(-14,0,0),'Prop_R':(45,0,0)}}),(17,{'r':{'Chest':(13,0,5),'Arm_R':(-10,0,0),'Forearm_R':(5,0,0),'Prop_R':(0,0,0)}}),(29,{'r':{'Chest':(8,0,0),'Arm_R':(-20,0,0),'Prop_R':(15,0,0)}})],True)
add('Harvest',36,[(1,{}),(10,{'r':{'Chest':(23,0,-7),'Head':(-9,0,0),'Arm_R':(-22,0,0),'Forearm_R':(25,0,0)}}),(22,{'r':{'Chest':(23,0,9),'Arm_R':(-14,0,0),'Forearm_R':(28,0,0),'Prop_R':(25,0,0)}}),(37,{})],True)
for name,period,lift in [('Build',24,55),('Repair',20,35)]:
 add(name,period,[(1,{'r':{'Arm_R':(-20,0,0),'Forearm_R':(10,0,0)}}),(1+period//3,{'r':{'Arm_R':(-lift,0,-6),'Forearm_R':(-18,0,0),'Prop_R':(55,0,0)}}),(1+2*period//3,{'r':{'Arm_R':(-20,0,0),'Forearm_R':(20,0,0),'Prop_R':(10,0,0),'Chest':(4,0,3)}}),(period+1,{'r':{'Arm_R':(-20,0,0),'Forearm_R':(10,0,0)}})],True)
add('Deposit',30,[(1,{}),(9,{'r':{'Arm_L':(-42,0,0),'Forearm_L':(12,0,0),'Prop_L':(0,0,-15),'Chest':(6,0,-7)}}),(18,{'r':{'Arm_L':(-42,0,0),'Forearm_L':(12,0,0),'Prop_L':(70,0,-15),'Chest':(6,0,-7)}}),(25,{'r':{'Arm_L':(-42,0,0),'Forearm_L':(12,0,0),'Prop_L':(0,0,-15)}}),(30,{})])
add('Hit',8,[(1,{}),(4,{'r':{'Chest':(-13,0,-9),'Head':(-9,0,0),'Hips':(-4,0,0)}}),(8,{})])
add('Death',30,[(1,{}),(9,{'r':{'Chest':(-12,0,12),'Leg_L':(20,0,0),'Shin_L':(30,0,0)}}),(20,{'r':{'Root':(-60,0,12),'Chest':(-8,0,0)},'t':{'Root':(0,.13,.12)}}),(30,{'r':{'Root':(-87,0,12),'Chest':(-5,0,0),'Arm_R':(0,0,15),'Arm_L':(0,0,-15)},'t':{'Root':(0,.10,.10)}})])
scene=bpy.context.scene;scene.render.fps=20;floor=u.ground_actions(arm,meshes)
arm.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
arm['archetype']='Worker';arm['reference']='reference-sheet.png';arm['attachments']='Basket/BasketHandle/BasketBinding: Prop_L; Mattock: Prop_R'
count=u.triangles(meshes);assert count<=3000
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bronze-worker.blend'));u.export_file(OUT/'bronze-worker.glb',arm,meshes)
(OUT/'clips.json').write_text(json.dumps({'fps':20,'clips':clips,'events':{'Chop':{'contact_frame':19},'Mine':{'contact_frame':17},'Harvest':{'cut_frame':22},'Build':{'contact_frame':17},'Repair':{'contact_frame':14},'Deposit':{'pour_frame':18},'Death':{'settle_frame':30}},'runtime_animation_playback':'pending VAT integration'},indent=2))
(OUT/'floor-correction.json').write_text(json.dumps(floor,indent=2));(OUT/'palette.json').write_text(json.dumps(u.COLORS,indent=2))
(OUT/'source-report.json').write_text(json.dumps({'id':'bronze-worker','triangles':count,'body_triangles':u.triangles([body]),'soft_target1500':count<=1500,'hard_cap3000':True,'bones':list(arm.data.bones.keys()),'fps':20,'materials':'flat tagged Team/Skin/Cloth/Leather/Wood/Metal; no atlas','body_H':1,'body_front':'Blender -Y, glTF +Z','reference_sheet':'reference-sheet.png','attachments_separate':True,'clip_list_source':'plans/ART-MODELS-PLAN.md Worker; plans/ART-PRODUCTION-PLAN.md S8','runtime_acceptance':'pending'},indent=2))
print('BRONZE_WORKER_BUILT',count,clips.keys(),flush=True)
