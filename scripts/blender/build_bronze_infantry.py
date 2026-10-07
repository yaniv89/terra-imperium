# scripts/blender/build_bronze_infantry.py
# Bronze infantry (spearman): blender -b -P scripts/blender/build_bronze_infantry.py
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
import bpy,bmesh,sys,math,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import ti_units as u
OUT=u.out_dir('bronze-infantry')
bpy.ops.wm.read_factory_settings(use_empty=True)
arm,body=u.build_body(ready=True,modest=False);body.name='Body';meshes=[body]
# Covered skin is removed from this dressed export; complete neutral master remains editable separately.
bm=bmesh.new();bm.from_mesh(body.data)
covered=[f for f in bm.faces if .35<f.calc_center_median().z<.745 and abs(f.calc_center_median().x)<(.145 if f.calc_center_median().z>.535 else .15)]
bmesh.ops.delete(bm,geom=covered,context='FACES');bm.to_mesh(body.data);bm.free()
meshes.append(u.tube('Kilt',[(0,0,.350),(0,0,.400),(0,0,.505),(0,0,.537)],[(.128,.092),(.126,.087),(.104,.075),(.089,.061)],'Team',['Hips']*4,10,arm))
meshes.append(u.tube('LeatherCorselet',[(0,0,.535),(0,0,.59),(0,0,.67),(0,0,.737),(0,0,.755)],[(.094,.063),(.086,.062),(.11,.076),(.132,.078),(.118,.070)],'Leather',['Spine','Spine','Chest','Chest','Chest'],8,arm))
for side,sign in [('L',1),('R',-1)]:
 shoulder=arm.data.bones['Arm_'+side].head_local;elbow=arm.data.bones['Forearm_'+side].head_local
 meshes.append(u.tube('LinenSleeve_'+side,[tuple(shoulder),tuple(shoulder.lerp(elbow,.36)),tuple(shoulder.lerp(elbow,.48))],[(.047,.042),(.045,.039),(.042,.038)],'Cloth',['Arm_'+side]*3,6,arm))
 meshes.append(u.tube('CorseletStrap_'+side,[(sign*.097,-.078,.71),(sign*.074,.004,.80),(sign*.08,.06,.75)],[(.018,.011)]*3,'Leather',['Chest']*3,4,arm))
 # Restrained toe and ankle sandal straps, shape follows feet rather than bulky boots.
 meshes.append(u.box('SandalSole_'+side,(sign*.074,-.042,.008),(.066,.134,.016),'Leather','Foot_'+side,arm))
 meshes.append(u.tube('SandalToeStrap_'+side,[(sign*.074-.034,-.069,.023),(sign*.074,-.069,.040),(sign*.074+.034,-.069,.023)],[.010]*3,'Leather',['Foot_'+side]*3,4,arm))
 meshes.append(u.tube('SandalAnkle_'+side,[(sign*.074,0,.056),(sign*.074,0,.073)],[(.025,.028)]*2,'Leather',['Foot_'+side]*2,8,arm))
meshes.append(u.tube('LinenCollar',[(0,0,.778),(0,0,.821)],[(.052,.045),(.041,.037)],'Cloth',['Chest','Neck'],6,arm))
meshes.append(u.tube('BronzeCap',[(0,-.003,.945),(0,-.002,.958),(0,0,1.010),(0,0,1.034)],[(.065,.058),(.064,.057),(.022,.020),(.001,.001)],'Metal',['Head']*4,8,arm,attachment=True))

# Spear's total geometry is1.257142857H; separate attachment excludes it from body scaling.
x,y=-.223,-.137;base=.010;length=2.2/1.75;blade=.125;shaft_top=base+length-blade
meshes.append(u.tube('SpearShaft',[(x,y,base),(x,y,shaft_top)],[.009,.007],'Wood',['Prop_R']*2,6,arm,attachment=True))
meshes.append(u.tube('SpearSocket',[(x,y,shaft_top-.027),(x,y,shaft_top+.017)],[.012,.010],'Metal',['Prop_R']*2,6,arm,attachment=True))
v=[(x-.022,y,shaft_top+.035),(x,y-.008,shaft_top+.045),(x+.022,y,shaft_top+.035),(x,y+.008,shaft_top+.045),(x,y,base+length),(x,y,shaft_top-.001)]
f=[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,5,1),(1,5,2),(2,5,3),(3,5,0)]
meshes.append(u.mesh_obj('LeafSpearHead',v,f,'Metal','Prop_R',True,arm=arm))

# Circular shield lies inXZ; carried projection may look oval. Front faces-Y.
cx,cy,cz=.225,-.160,.610;rad=.18;n=14
verts=[(cx,cy-.022,cz)];verts.extend((cx+rad*math.cos(2*math.pi*j/n),cy-.007,cz+rad*math.sin(2*math.pi*j/n)) for j in range(n))
faces=[(0,j+1,(j+1)%n+1) for j in range(n)]
face=u.mesh_obj('ShieldFace',verts,faces,'Emblem','Prop_L',True,arm=arm)
for polygon in face.data.polygons:
 for li in polygon.loop_indices:
  co=face.data.vertices[face.data.loops[li].vertex_index].co;face.data.uv_layers.active.data[li].uv=((co.x-cx)/(rad*2)+.5,(co.z-cz)/(rad*2)+.5)
meshes.append(face)
verts=[];faces=[]
for j in range(n):
 a=2*math.pi*j/n
 for r,depth in [(rad-.014,-.007),(rad+.001,-.008),(rad+.001,.021),(rad-.014,.022)]:verts.append((cx+r*math.cos(a),cy+depth,cz+r*math.sin(a)))
for j in range(n):
 for k in range(4):
  a=j*4+k;b=j*4+(k+1)%4;c=((j+1)%n)*4+(k+1)%4;d=((j+1)%n)*4+k;faces.append((a,b,c,d))
meshes.append(u.mesh_obj('ShieldBoundRim',verts,faces,'Leather','Prop_L',True,arm=arm))
meshes.append(u.box('ShieldRearHorizontal',(cx,cy+.017,cz),(.31,.022,.027),'Wood','Prop_L',arm,True))
meshes.append(u.box('ShieldRearVertical',(cx,cy+.018,cz),(.027,.022,.31),'Wood','Prop_L',arm,True))
meshes.append(u.tube('ShieldGrip',[(cx,cy+.028,cz-.05),(cx,cy+.048,cz),(cx,cy+.028,cz+.05)],[.010]*3,'Leather',['Prop_L']*3,6,arm,attachment=True))

clips=u.add_actions(arm)
floor_report=u.ground_actions(arm,meshes)
arm.animation_data.action=bpy.data.actions['Idle'];bpy.context.scene.frame_set(1)
for track in arm.animation_data.nla_tracks:track.mute=True
bpy.context.scene.render.fps=20
# Keep all authored actions editable and prop sockets meaningful.
arm['equipment']={'spear_total_H':length,'shield_diameter_H':.36,'body_height_H':1.0}
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bronze-infantry.blend'))
u.export_file(OUT/'bronze-infantry.glb',arm,meshes)
(OUT/'clips.json').write_text(json.dumps({'fps':20,'clips':clips,'events':{'Attack':{'contact_frame':11},'Attack2':{'contact_frame':13},'Death':{'settle_frame':30},'DeathAlt':{'settle_frame':30}},'runtime_animation_playback':'pending VAT integration'},indent=2))
(OUT/'palette.json').write_text(json.dumps(u.COLORS,indent=2))
(OUT/'floor-correction.json').write_text(json.dumps(floor_report,indent=2))
(OUT/'source-report.json').write_text(json.dumps({'triangles':u.triangles(meshes),'body_triangles':u.triangles([body]),'bones':list(arm.data.bones.keys()),'material_contract':'flat colors; no textures/atlas','fps':20,'spear_total_H':length,'shield_diameter_H':.36,'source_sheet':'../../art-production/wave1-unit-design/bronze-infantry.png','props_excluded_body_measurement':True,'runtime_acceptance':'pending'},indent=2))
print('FINISHED',OUT,'TRIANGLES',u.triangles(meshes))
