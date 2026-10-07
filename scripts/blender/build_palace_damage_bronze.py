# Original procedural palace damage, derived from intact ti_bronze geometry.
import os,sys,random,math,inspect,json
import bpy,bmesh
from mathutils import Vector
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
sys.path.insert(0,os.path.join(BASE,'scripts/blender'))
import ti_map as tm,ti_town as tt,ti_bronze as tb,ti_nature as tn
import build_houses_damage_bronze as hd
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv and sys.argv[sys.argv.index('--')+1] != '--probe' else os.path.join(BASE,'art-build/palace-damage-bronze')
os.makedirs(OUT,exist_ok=True)
def tri(bm):return sum(len(f.verts)-2 for f in bm.faces)
def bbox(bm):return hd.bounds([(bm,None,0,None)])
def prune(ms,fn):
 keep=[]
 for p in ms.parts:
  if fn(p):p[0].free()
  else:keep.append(p)
 ms.parts=keep

def cavity(ms,center,size):
 # Boolean a real recess into intersecting structural solids, before UV unwrap.
 bpy.ops.mesh.primitive_cube_add(size=1,location=center);cutter=bpy.context.object;cutter.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for i,(bm,mat,lod,only) in enumerate(ms.parts):
  if mat not in ('pylon','roof'):continue
  lo,hi=bbox(bm)
  if any(hi[a]<center[a]-size[a]/2 or lo[a]>center[a]+size[a]/2 for a in range(3)):continue
  me=bpy.data.meshes.new('_cut');bm.to_mesh(me);obj=bpy.data.objects.new('_cut',me);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
  mod=obj.modifiers.new('Actual broken roof recess','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
  bpy.ops.object.modifier_apply(modifier=mod.name);nb=bmesh.new();nb.from_mesh(obj.data);bm.free();ms.parts[i]=(nb,mat,lod,only);bpy.data.objects.remove(obj,do_unlink=True)
 bpy.data.objects.remove(cutter,do_unlink=True)
 prune(ms,lambda p:not p[0].faces)

def heap_at(ms,rng,x,y,z,rx,ry,h):
 start=len(ms.parts);hd.heap(ms,rng,'pylon',x,y,rx,ry,h)
 for bm,*_ in ms.parts[start:]:bmesh.ops.translate(bm,verts=bm.verts,vec=(0,0,z))

def ramp(ms,lo,hi):
 bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
 for v in bm.verts:
  t=v.co.y+.5;v.co.x=lo.x+(v.co.x+.5)*(hi.x-lo.x);v.co.y=lo.y+t*(hi.y-lo.y);v.co.z=lo.z if v.co.z<0 else lo.z+(hi.z-lo.z)*t
 bmesh.ops.remove_doubles(bm,verts=bm.verts[:],dist=.00001);ms.add(bm,'pylon',2,only=(1,2) if not CURRENT_SMALL and lo.z<.1 else (1,))

def lods(ms,ruin):
 # Explicit intermediate ramp equivalents retain authored stair footprints.
 groups={};updated=[];far=[]
 for bm,mat,lod,only in ms.parts:
  lo,hi=bbox(bm);sz=hi-lo
  isstep=mat=='pylon' and lod==1 and only is None and .12<sz.x<.22 and sz.y<.027 and sz.z>.02
  if isstep:
   key=(round((lo.x+hi.x)/2,3),round(lo.z,3));groups.setdefault(key,[]).append((lo,hi));lod=0
  # Far tier masses; trim copings/details without discarding surviving Team.
  if lod==2 or (mat=='team_cloth' and not ruin):
   if mat=='pylon' and sz.z>.14 and sz.x>.18 and sz.y>.14:
    hb=bm.copy();res=bmesh.ops.convex_hull(hb,input=hb.verts[:],use_existing_faces=False)
    old=[f for f in hb.faces if f not in res['geom']]
    if old:bmesh.ops.delete(hb,geom=old,context='FACES_ONLY')
    loose=[v for v in hb.verts if not v.link_faces]
    if loose:bmesh.ops.delete(hb,geom=loose,context='VERTS')
    far.append((hb,mat,2,(2,)));lod=1
   elif mat=='team_cloth' and not ruin:lod=2;only=None
   else:lod=min(lod,1)
  updated.append((bm,mat,lod,only))
 ms.parts=updated+far
 for spans in groups.values():
  lo=Vector(tuple(min(a[k] for a,b in spans) for k in range(3)));hi=Vector(tuple(max(b[k] for a,b in spans) for k in range(3)));ramp(ms,lo,hi)
 # Far rubble is purpose-built simple tapered bricks with source-aligned surfaces.
 for x,y,z,w,d,h in ((-.12,.08,.48 if ruin and not CURRENT_SMALL else .035,.28,.23,.065),):
  if not ruin:z=.59 if not CURRENT_SMALL else .055;x=.22 if not CURRENT_SMALL else .08;y=-.07
  bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
  for v in bm.verts:
   top=v.co.z>0;v.co.x=x+v.co.x*w*(.62 if top else 1);v.co.y=y+v.co.y*d*(.7 if top else 1);v.co.z=z+(v.co.z+.5)*h
  ms.add(bm,'pylon',2,only=(2,))
 # Some source only=(1,2) heaps are demoted to LOD1 above. Explicit far form is shared atlas sampled.

def layout(small,ruin):
 def build(ms,rng):
  global CURRENT_SMALL;CURRENT_SMALL=small
  (tb.palace_small if small else tb.palace)(ms,rng)
  if ruin:
   hd.cut(ms,Vector((0,0,.20 if small else .48)),Vector((.08,-.12,1)),True)
   # Uneven masonry edge; changes only freshly severed vertices.
   for bm,mat,lod,only in ms.parts:
    for v in bm.verts:
     if abs(v.co.z+v.co.x*.08-v.co.y*.12-(.20 if small else .48))<.0002:v.co.z+=.012*math.sin(v.co.x*47+v.co.y*31)
   cavity(ms,(-.065,.02,.30) if small else (0,.10,.64),(.48,.43,.34) if small else (.92,.73,.40))
   prune(ms,lambda p:p[1] in ('team_cloth','roof','door') or (p[1]=='terracotta'))
   heap_at(ms,rng,-.07 if small else 0,.02 if small else .12,.13 if small else .45,.21 if small else .39,.19 if small else .30,.11)
   for k in range(13):
    ms.box('pylon',(.055,.038,.027),at=(rng.uniform(-.23,.14) if small else rng.uniform(-.4,.4),rng.uniform(-.16,.20),.19 if small else .48),rot_z=rng.uniform(0,180),lod=0)
   for k in range(3):hd.charred(ms,rng,rng.uniform(-.17,.1),rng.uniform(-.08,.15),.22 if small else .52,.28 if small else .57,.30,k*49)
  else:
   # Fracture front-right upper corner; lower intact tiers and left facade stay unchanged.
   co=Vector((.19,-.15,.43)) if small else Vector((.18,-.08,.96))
   hd.cut(ms,co,Vector((.7,-.65,1.1)),True)
   cavity(ms,(.11,-.11,.53) if small else (.06,.18,1.54),(.20,.22,.36) if small else (.13,.15,.20))
   heap_at(ms,rng,.15 if small else .23,-.15 if small else -.07,.035 if small else .59,.11 if small else .17,.10 if small else .13,.065)
   for k in range(10):
    ms.box('pylon',(.034,.026,.024),at=(rng.uniform(.02,.18) if small else rng.uniform(.10,.34),rng.uniform(-.23,-.08) if small else rng.uniform(-.14,.06),.05 if small else 1.02),rot_z=rng.uniform(0,180),lod=0)
   for k in range(3):hd.charred(ms,rng,.08 if small else .12,-.1 if small else .12,.35 if small else 1.13,.40 if small else 1.20,.21,k*54)
   prune(ms,lambda p:p[1]=='terracotta')
  lods(ms,ruin)
  # Projecting cut-edge bricks make real fractures legible, not only a smooth diagonal.
  if ruin:
   for k,(x,y) in enumerate(((-.28,.23),(-.24,.23),(.17,.22),(.18,-.18),(-.27,-.17),(-.22,-.17)) if small else ((-.43,.35),(-.37,.35),(.4,.3),(.44,-.15),(-.4,-.19),(-.35,-.19))):
    z=(.20 if small else .48)-x*.08+y*.12
    ms.box('pylon',(.055,.052,.04+(k%2)*.025),at=(x,y,z-.006),lod=1 if k<1 else 0)
   ms.box('pylon',(.13,.075,.04),at=(-.24 if small else -.39,.23 if small else .35,.23 if small else .53),lod=2)
  elif not small:
   for k in range(3):
    x=.14+k*.055;y=.02;z=.96+(.7*(.18-x)+.65*(y+.08))/1.1
    ms.box('pylon',(.061,.04,.045+k*.01),at=(x,y,z-.01),rot_z=k*9,lod=1)
   ms.box('pylon',(.16,.055,.045),at=(.21,.02,1.01),lod=2)
  # Empty and loose edges from clipped detail are excluded.
  for bm,*_ in ms.parts:
   loose=[v for v in bm.verts if not v.link_faces]
   if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
  prune(ms,lambda p:not p[0].faces)
 return build

items=[('palace-damaged',layout(False,False),None),('palace-ruined',layout(False,True),None),('palace-small-damaged',layout(True,False),None),('palace-small-ruined',layout(True,True),None)]
if '--probe' in sys.argv:
 bpy.ops.wm.read_factory_settings(use_empty=True);tt.make_materials()
 counts={}
 for name,fn,_ in items:
  ms=tm.Mesher();fn(ms,random.Random(2000));counts[name]=[tm.triangles(ms.build(name+str(l),l,tt.PROC)) for l in range(3)]
 print('COUNTS',json.dumps(counts));open(os.path.join(OUT,'probe-counts.json'),'w').write(json.dumps(counts,indent=2))
else:
 # Local wrapper switches only this build to OptiX; shared helper remains unmodified.
 bpy.context.scene.render.threads_mode='FIXED';bpy.context.scene.render.threads=8
 code=inspect.getsource(tm.bake_atlas).replace("scene.cycles.device = 'CPU'","scene.cycles.device = 'GPU'")
 exec(compile(code,'<palace-local-gpu-bake>','exec'),tm.__dict__)
 bake_gpu=tm.bake_atlas
 def progress_bake(*a,**k):
  print('GPU BAKE START',flush=True)
  return bake_gpu(*a,**k)
 tm.bake_atlas=progress_bake
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for d in prefs.devices:d.use=d.type=='OPTIX'
 uvcode=inspect.getsource(tm.smart_uv).replace("shape_method='CONCAVE'","shape_method='CONVEX'")
 exec(compile(uvcode,'<palace-local-uv-packer>','exec'),tm.__dict__)
 print('START BUILD WITH CONVEX UV PACK',flush=True)
 counts=tt.build_file('palace-damage-bronze',items,OUT,atlas=2048,seed=2000)
 open(os.path.join(OUT,'counts.json'),'w').write(json.dumps(counts,indent=2));sys.stdout.flush();os._exit(0)







