# Original Bronze decorative kit, CC0-1.0. Blender5.2 only. One color+AO1024atlas.
# blender -b --factory-startup -t8 -P scripts/blender/build_props_bronze.py -- art-build/props-bronze
import os,sys,math,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import bpy,bmesh,numpy as np
import ti_map as tm,ti_town as tt,ti_nature as tn
from mathutils import Vector

def pole(ms,a,b,r=.006,mat='log',lod=2): tn.limb(ms,mat,a,b,r,r,segs=6,lod=lod)
def rope(ms,a,b,lod=0): pole(ms,a,b,.0025,'reed',lod)
def ring(ms,mat,r,z,th=.004,n=10,lod=1):
 for i in range(n):
  a=math.tau*i/n;b=math.tau*(i+1)/n;pole(ms,(r*math.cos(a),r*math.sin(a),z),(r*math.cos(b),r*math.sin(b),z),th,mat,lod)
def fence(ms,rng):
 for x in [-.12,.12]:
  pole(ms,(x,0,0),(x,0,.13),.007)
  for z in [.045,.09]:rope(ms,(x,-.008,z-.006),(x,.009,z+.006))
 for z in [.045,.09]:pole(ms,(-.13,0,z),(.13,0,z),.005)
def wall(ms,rng):
 for row in range(3):
  for j in range(4):ms.box('stone',(.067,.047,.028),at=(-.108+j*.071+(row%2)*.012,0,row*.03),bevel=.003,lod=1)
 ms.box('stone',(.3,.047,.089),at=(0,0,0),lod=2)
 # last block onlyLOD2, below replaces duplicate allLOD block
 ms.parts[-1]=(ms.parts[-1][0],ms.parts[-1][1],2,2)
def well(ms,rng):
 # annular curb: eight outward segments leave an actual dark open well
 for i in range(8):
  a=math.tau*i/8;ms.box('limewash',(.045,.022,.058),at=(.057*math.sin(a),.057*math.cos(a),0),rot_z=-math.degrees(a),bevel=.002)
 ms.cyl('dark',.046,.046,.001,at=(0,0,.009),segs=8)
 for x in [-.082,.082]:pole(ms,(x,0,0),(x,0,.205),.008)
 pole(ms,(-.094,0,.19),(.094,0,.19),.007)
 pole(ms,(0,0,.18),(0,0,.091),.0018,'reed',1)
 ms.cyl('reed',.013,.017,.025,at=(0,0,.064),segs=8,lod=1)
def cart(ms,rng):
 ms.box('log',(.105,.16,.016),at=(0,0,.044),bevel=.002)
 for x in [-.059,.059]:ms.box('log',(.013,.16,.058),at=(x,0,.055),bevel=.002)
 for y in [-.075,.075]:ms.box('log',(.13,.011,.058),at=(0,y,.055),bevel=.002)
 pole(ms,(-.084,0,.035),(.084,0,.035),.005)
 for x in [-.079,.079]:
  ms.cyl('log',.035,.035,.012,at=(x,0,.035),rot=(0,90,0),segs=10)
  ms.cyl('painted',.014,.014,.016,at=(x-.002,0,.035),rot=(0,90,0),segs=8,lod=1)
  for z in [-.012,.012]:ms.box('painted',(.014,.059,.009),at=(x,0,.035+z),lod=0)
 for x in [-.046,.046]:pole(ms,(x,-.077,.054),(x,-.21,.035),.005)
def hay(ms,rng):
 for l,n in [(0,12),(1,8),(2,6)]:
  before=len(ms.parts);ms.lathe('thatch',[(.074,0),(.077,.025),(.058,.085),(.028,.12),(.01,.132)],segs=n,lod=2)
  ms.parts[-1]=(ms.parts[-1][0],ms.parts[-1][1],2,l)
 ring(ms,'reed',.07,.04,.003,12,1)
 for a in [0,math.pi/2]:pole(ms,(.025*math.cos(a),.025*math.sin(a),.12),(0,0,.143),.003,'thatch',0)
def crate(ms,rng):
 ms.box('log',(.083,.066,.062),bevel=.002)
 for x in [-.029,.029]:
  for y in [-.034,.034]:ms.box('reed',(.007,.005,.062),at=(x,y,0),lod=1)
  ms.box('reed',(.007,.068,.004),at=(x,0,.06),lod=1)
 for z in [.018,.039]:
  for y in [-.034,.034]:ms.box('dark',(.083,.001,.0018),at=(0,y,z),lod=0)
def barrel(ms,rng):
 for l,n in [(0,12),(1,8),(2,6)]:
  ms.lathe('log',[(.029,0),(.036,.021),(.038,.052),(.03,.086)],segs=n,lod=2);ms.parts[-1]=(ms.parts[-1][0],ms.parts[-1][1],2,l)
 for z,r in [(.014,.034),(.068,.034)]:ring(ms,'reed',r,z,.003,10,1)
 for i in range(10):
  a=math.tau*i/10;pole(ms,(.031*math.cos(a),.031*math.sin(a),.01),(.032*math.cos(a),.032*math.sin(a),.076),.001,'painted',0)
def stall(ms,rng):
 for x in [-.11,.11]:
  for y in [-.065,.065]:pole(ms,(x,y,0),(x,y,.21),.006)
 ms.box('log',(.25,.105,.012),at=(0,-.025,.085),bevel=.002)
 for x in [-.1,.1]:pole(ms,(x,-.06,0),(x,-.06,.085),.005)
 # cloth canopy has solid shallow thickness and two pitched faces
 ms.quad_strip('linen',[(-.124,-.083,.191),(.124,-.083,.191),(.124,0,.225),(-.124,0,.225)],thickness=.002)
 ms.quad_strip('linen',[(-.124,0,.225),(.124,0,.225),(.124,.083,.191),(-.124,.083,.191)],thickness=.002)
 ms.box('linen',(.12,.005,.056),at=(0,-.079,.041),lod=1)
 for x,s in [(-.071,.52),(0,.72),(.062,.45)]:tt.jar(ms,None,x,-.025,s=s,z=.098)
 ms.cyl('terracotta',.012,.016,.027,at=(-.072,-.025,.098),segs=6,lod=2,only=(1,2))
def standard(ms,rng):
 pole(ms,(0,0,0),(0,0,.28),.0045)
 pole(ms,(-.058,0,.239),(.058,0,.239),.0035)
 ms.cyl('bronze',.013,.013,.008,at=(0,.004,.267),rot=(90,0,0),segs=10)
 ms.box('team_cloth',(.106,.003,.12),at=(0,0,.115))
def campfire(ms,rng):
 for i in range(8):
  a=math.tau*i/8;tn.blob(ms,'stone',(.065*math.cos(a),.065*math.sin(a),.012),.018,(1,1,.7),rng,.12,1,lod=1)
 ring(ms,'stone',.066,.012,.012,6,2)
 # ring onlyLOD2; allstonesremainmedium/near
 for k in range(len(ms.parts)-6,len(ms.parts)):ms.parts[k]=(ms.parts[k][0],ms.parts[k][1],2,2)
 for a in [0,1.05,2.1]:pole(ms,(-.045*math.cos(a),-.045*math.sin(a),.01),(.045*math.cos(a),.045*math.sin(a),.054),.01,'ash')
def shrine(ms,rng):
 for w,d,z,h in [(.145,.11,0,.02),(.115,.085,.02,.02),(.084,.059,.04,.018)]:ms.box('limewash',(w,d,h),at=(0,0,z),bevel=.002)
 for x in [-.024,.024]:pole(ms,(x,0,.058),(x,0,.101),.003,'bronze',2)
 ms.cyl('bronze',.044,.044,.008,at=(0,.004,.127),rot=(90,0,0),segs=12)
def marker(ms,rng):ms.box('stone',(.046,.034,.098),bevel=.005,taper=.72)
ITEMS=[('fence-a',fence,None),('field-wall-a',wall,None),('well',well,None),('cart',cart,None),('haystack',hay,None),('crate',crate,None),('barrel',barrel,None),('market-stall',stall,None),('standard',standard,None),('campfire',campfire,None),('shrine',shrine,None),('road-marker',marker,None)]

# Local adapters: shared town geometry/unwrap/UVtransfer; existing original town materials, color+AO only.
old_mats=tt.make_materials
def mats():
 old_mats()

def color_ao_bake(obj,size=1024,ao_samples=24,margin=6):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.render.threads_mode='FIXED';scene.render.threads=8
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 scene.cycles.device='GPU'
 for o in scene.objects:o.select_set(o==obj)
 bpy.context.view_layer.objects.active=obj
 used={p.material_index for p in obj.data.polygons}
 for i in reversed(range(len(obj.data.materials))):
  if i not in used:obj.data.materials.pop(index=i)
 mats=[s.material for s in obj.material_slots];out={}
 for key,btype,samples,non,kw in [('color','DIFFUSE',1,False,{'pass_filter':{'COLOR'}}),('ao','AO',24,True,{})]:
  im=tm._img('props_'+key,size,non_color=non);tm._bake_target_nodes(mats,im);scene.cycles.samples=samples
  bpy.ops.object.bake(type=btype,margin=margin,use_clear=True,**kw)
  out[key]=np.array(im.pixels[:],dtype=np.float32).reshape(size,size,4)[::-1].copy();bpy.data.images.remove(im)
 # Preserve light stylized values: AO onlymodulates cavities and is clamped to .82.
 out['ao'][...,:3]=np.maximum(out['ao'][...,:3],.82)
 out['normal']=np.full_like(out['color'],.5);out['normal'][...,2:]=1
 out['rough']=np.full_like(out['color'],.9)
 for m in mats:
  n=m.node_tree.nodes.get('_bake')
  if n:m.node_tree.nodes.remove(n)
 return out

def final(name,base,normal,packed,alpha_mask=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=base;m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=.86 if name=='Team' else .9;b.inputs['Metallic'].default_value=0
 return m

def bounded_transfer(src,dst):
 # Far faces use a source-face patch, never edges across unrelated atlas islands.
 from mathutils.kdtree import KDTree
 su=src.data.uv_layers.active.data;trees={};samples={}
 for face in src.data.polygons:
  name=src.data.materials[face.material_index].name
  center=sum((src.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
  tex=sum((su[k].uv.copy() for k in face.loop_indices),Vector((0,0)))/len(face.loop_indices)
  samples.setdefault(name,[]).append((center,tex))
 for name,a in samples.items():
  tree=KDTree(len(a))
  for i,(center,_) in enumerate(a):tree.insert(center,i)
  tree.balance();trees[name]=tree
 uv=dst.data.uv_layers.active or dst.data.uv_layers.new(name='UVMap')
 for face in dst.data.polygons:
  name=dst.data.materials[face.material_index].name
  if name not in trees:raise ValueError('missing source material '+name)
  center=sum((dst.data.vertices[i].co for i in face.vertices),Vector())/len(face.vertices)
  _,index,_=trees[name].find(center);tex=samples[name][index][1]
  for k in face.loop_indices:uv.data[k].uv=tex
def main():
 args=sys.argv[sys.argv.index('--')+1:];out=os.path.abspath(args[0]);tt.make_materials=mats;tm.bake_atlas=color_ao_bake;tm.final_material=final;tm.transfer_uvs=bounded_transfer
 original_build=tm.Mesher.build
 def grounded_build(ms,*a,**kw):
  obj=original_build(ms,*a,**kw)
  for v in obj.data.vertices:v.co.z=max(0,v.co.z)
  low=min(v.co.z for v in obj.data.vertices)
  if low>0:
   for v in obj.data.vertices:v.co.z-=low
  return obj
 tm.Mesher.build=grounded_build
 counts=tt.build_file('props-bronze',ITEMS,out,atlas=1024,seed=7130)
 # Source and exportconsistencyaretheunmodifiedevaluatedmesh; nohiddensimplifier.
 report={'scale':'oneBlenderunit=10m;glTFYup;localbaseZ0','counts':counts,'atlas':1024,'materials':['Town','Team'],'license':'CC0-1.0','design':'design-sheet.png;referenceonlynotusedintextures','gpu':'OptiX','threads':8}
 for name,c in counts.items():assert c['LOD0']<=800,(name,c)
 json.dump(report,open(os.path.join(out,'source-audit.json'),'w'),indent=2)
 sys.stdout.flush();os._exit(0)
if __name__=='__main__':main()







