# scripts/blender/ti_units_bow.py
# Bronze archer equipment (self bow, quiver, knife) for build_bronze_ranged.py
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
"""Bronze archer equipment from the approved local 2D sheet. Blender Z up, front -Y."""
import bpy, math, os, json
from mathutils import Vector

def material(name,color,roughness=.65,metallic=0):
 m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic;return m

def mesh(name,vertices,faces,mat,bone=None,rig=None):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat);o['attachment']=True
 if rig and bone:
  g=o.vertex_groups.new(name=bone);g.add(list(range(len(vertices))),1,'REPLACE');a=o.modifiers.new('Rig','ARMATURE');a.object=rig;o.parent=rig
 return o

def tube(name,points,radii,mat,bone=None,rig=None,sides=6):
 vs=[];fs=[]
 for j,p in enumerate(points):
  tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]);tangent.normalize();side=tangent.cross(Vector((0,1,0))).normalized();up=tangent.cross(side).normalized()
  for i in range(sides):
   a=i*2*math.pi/sides;vs.append(tuple(Vector(p)+radii[j]*(math.cos(a)*side+math.sin(a)*up)))
 for j in range(len(points)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.append(tuple(reversed(range(sides))));fs.append(tuple((len(points)-1)*sides+i for i in range(sides)))
 return mesh(name,vs,fs,mat,bone,rig)

def equipment(rig=None):
 wood=material('Wood',(.29,.15,.072));leather=material('Leather',(.25,.13,.075));linen=material('Cloth',(.72,.65,.52));bronze=material('Metal',(.51,.32,.10),.38,.65);team=material('Team',(.52,.52,.52))
 bowpoints=[]
 for i in range(17):
  t=i/16;z=.035+.85*t;y=-.08-.095*math.sin(math.pi*t);bowpoints.append((.255,y,z))
 bow=tube('self-bow',bowpoints,[.006+.003*math.sin(math.pi*i/16)for i in range(17)],wood,'Prop_L',rig)
 tube('bow-grip',[(.255,-.174,.405),(.255,-.174,.475)],[.012,.012],leather,'Prop_L',rig,8)
 tube('bow-string',[(.255,-.08,.035),(.255,-.08,.44),(.255,-.08,.885)],[.0013]*3,linen,'Prop_L',rig,4)
 # Back quiver cylindrical wall, open crown with inner rim, no closed top cap.
 cx,cy=-.074,.095;z0,z1=.55,.825;r=.034;sides=10;vs=[]
 for z,rad in[(z0,r*.8),(z1,r),(z1,r*.77),(z0+.012,r*.6)]:
  for i in range(sides):a=2*math.pi*i/sides;vs.append((cx+rad*math.cos(a),cy+rad*math.sin(a),z))
 faces=[]
 for ring in range(3):
  for i in range(sides):a=ring*sides+i;b=ring*sides+(i+1)%sides;faces.append((a,b,b+sides,a+sides))
 faces.append(tuple(3*sides+i for i in reversed(range(sides))))
 mesh('back-quiver',vs,faces,leather,'Prop_Back',rig)
 for z in[z0+.025,z1-.017]:
  points=[(cx+(r+.002)*math.cos(2*math.pi*i/sides),cy+(r+.002)*math.sin(2*math.pi*i/sides),z)for i in range(sides+1)]
  tube('quiver-binding',points,[.0035]*len(points),wood,'Prop_Back',rig,4)
 for n in range(6):
  a=n*math.pi*2/6;x=cx+.018*math.cos(a);y=cy+.018*math.sin(a);h=.873+.012*(n%3)
  tube('arrow-shaft-'+str(n),[(x,y,.59),(x,y,h)],[.0018,.0018],wood,'Prop_Back',rig,4)
  mesh('arrow-head-'+str(n),[(x-.006,y,h-.003),(x+.006,y,h-.003),(x,y-.002,h+.022),(x,y+.002,h+.022)],[(0,1,2),(1,0,3),(0,2,3),(1,3,2)],bronze,'Prop_Back',rig)
  mesh('arrow-fletching-'+str(n),[(x-.006,y,h-.055),(x+.006,y,h-.055),(x+.005,y,h-.034),(x-.005,y,h-.034)],[(0,1,2,3)],linen,'Prop_Back',rig)
 # Small sheathed knife at the right hip, an inset brass pommel.
 tube('knife-sheath',[(-.12,-.027,.37),(-.10,-.035,.50)],[.009,.012],leather,'Hips',rig,6)
 tube('knife-hilt',[(-.10,-.035,.50),(-.092,-.035,.54)],[.007,.007],bronze,'Hips',rig,6)
 return bow

if __name__=='__main__':
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);equipment()
 import sys;sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)));import ti_units;out=str(ti_units.out_dir('bronze-ranged'));bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'bronze-ranged-equipment.blend'))
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,'bronze-ranged-equipment.glb'),export_format='GLB',export_extras=True)
 bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=24;bpy.context.scene.render.resolution_x=844;bpy.context.scene.render.resolution_y=390;bpy.context.scene.render.resolution_percentage=100
 bpy.context.scene.world.color=(.26,.27,.30);bpy.ops.object.light_add(type='AREA',location=(1,-2,3));bpy.context.object.data.energy=160;bpy.context.object.data.size=2
 bpy.ops.object.camera_add(location=(1,-1,1.25));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.48))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.2;bpy.context.scene.camera=cam;bpy.context.scene.render.filepath=os.path.join(out,'equipment-proof.png');bpy.ops.render.render(write_still=True)
