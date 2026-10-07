"""Original Bronze civic compounds, reusing delivered cultural house kits.
Run Blender --background --threads 8 --python this.py -- OUT THEME [--probe].
Design sheets precede each build. Fixed footprint/origin across damage states.
"""
import os, sys, random, json, inspect
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Matrix, Vector
import ti_map as tm
import ti_town as tt
import ti_nature as tn
import build_houses_damage_bronze as hd

# Convex packing avoids minute-long concave packing on many tiny islands.
_fast_uv = inspect.getsource(tm.smart_uv).replace('CONCAVE','CONVEX')
exec(_fast_uv, tm.__dict__)
THEME = sys.argv[sys.argv.index('--')+2]
OUT = os.path.abspath(sys.argv[sys.argv.index('--')+1])
STATE = {}
AK = None
if THEME in hd.KIT_THEMES:
    HOUSE, LIGHT, AK = hd.kit_layouts(THEME, os.path.abspath('art-build/kitsrc/plans/art/kits'), STATE)
else:
    if THEME != 'base': __import__('ti_%s_bronze' % THEME)
    HOUSE = {k: hd.procedural_house(THEME,k) for k in ('rich','common')}
    LIGHT = HOUSE

def fitted(ms, kind, at, dims, damage):
    part = tm.Mesher()
    if AK:
        original = STATE['parts']['house-'+kind]
        reduced = STATE['light']['house-'+kind]
        for lod, store in ((0,reduced.lod1 if damage else original.lod0),(1,original.lod1)):
            for role,bm in store.items():
                part.add(bm.copy(),'nl_houses_'+('team' if role=='team' else 'town'),only=(lod,))
    else:
        HOUSE[kind](part,random.Random(7331))
        part.parts=[(bm,mat,lod,(only,) if isinstance(only,int) else only) for bm,mat,lod,only in part.parts]
        # Far silhouette is constructed separately, preserving architectural type.
        kept=[]
        for bm,mat,lod,only in part.parts:
            levels=tuple(i for i in (0,1) if (only is None and i<=lod) or (only is not None and i in only))
            if levels: kept.append((bm,mat,lod,levels))
        part.parts=kept
    w,d,h=hd.normalise(part)
    matrix=Matrix.Translation(Vector(at)) @ Matrix.Diagonal(Vector((dims[0]/w,dims[1]/d,dims[2]/h,1)))
    for bm,mat,lod,only in part.parts: ms.add(bm,mat,lod,matrix,only)

def trim_budget(ms, lod, budget):
    """Decimate material surfaces only when necessary; keep every material component."""
    parts=[p for p in ms.parts if (p[3] is None and lod<=p[2]) or (p[3] is not None and lod in p[3])]
    total=sum(sum(max(0,len(f.verts)-2) for f in p[0].faces) for p in parts)
    if total<=budget:return
    ratio=(budget-20)/total
    remaining=[]
    for bm,mat,maxlod,only in ms.parts:
        levels=tuple(i for i in (0,1,2) if (only is None and i<=maxlod) or (only is not None and i in only))
        if lod not in levels:
            remaining.append((bm,mat,maxlod,only));continue
        others=tuple(i for i in levels if i!=lod)
        if others: remaining.append((bm.copy(),mat,maxlod,others))
        me=bpy.data.meshes.new('_trim');bm.to_mesh(me)
        ob=bpy.data.objects.new('_trim',me);bpy.context.collection.objects.link(ob)
        mod=ob.modifiers.new('budget','DECIMATE');mod.ratio=max(.01,ratio)
        deps=bpy.context.evaluated_depsgraph_get(); ev=ob.evaluated_get(deps)
        reduced=bmesh.new();reduced.from_mesh(ev.to_mesh());ev.to_mesh_clear()
        remaining.append((reduced,mat,maxlod,(lod,)))
        bpy.data.objects.remove(ob,do_unlink=True);bpy.data.meshes.remove(me);bm.free()
    ms.parts=remaining

def courtyard(ms,lod):
    mat='timber' if THEME in ('europe','steppe','monsoon') else 'mudwall_bare'
    for x in (-.92,.92):ms.box(mat,(.045,1.7,.18),at=(x,0,0),lod=lod)
    ms.box(mat,(1.88,.045,.18),at=(0,.85,0),lod=lod)
    for x in (-.64,.64):ms.box(mat,(.57,.045,.18),at=(x,-.85,0),lod=lod)

def far(ms,state):
    mat='stone' if THEME in ('israelite','americas') else 'mudwall_bare'
    h=.62 if state==0 else .45 if state==1 else .16
    # Three open hall walls and a wing retain the empty court and ruined interior.
    for x in (-.61,.61):ms.box(mat,(.08,.68,h),at=(x,.29,0),lod=2)
    ms.box(mat,(1.3,.08,h),at=(0,.63,0),lod=2)
    ms.box(mat,(.46,.44,h*.68),at=(-.61,-.35,0),lod=2)
    # Two-sided low boundary planes preserve the court without collapsing thin walls.
    for x1,y1,x2,y2 in ((-.92,-.85,-.92,.85),(.92,-.85,.92,.85),(-.92,.85,.92,.85),(-.92,-.85,-.35,-.85),(.35,-.85,.92,-.85)):
        bm=bmesh.new();v=[bm.verts.new(co) for co in ((x1,y1,0),(x2,y2,0),(x2,y2,.15),(x1,y1,.15))]
        bm.faces.new(v);bm.faces.new([bm.verts.new(a.co.copy()) for a in v[::-1]]);ms.add(bm,mat,only=(2,))
    if state<2:
        pitched=THEME in ('europe','steppe','sinic','monsoon','americas','eastafrica','westafrica')
        if pitched:
            bm=bmesh.new()
            coords=[(-.69,-.13,h),(.69,-.13,h),(.69,.67,h),(-.69,.67,h),(-.5,.27,h+.28),(.5,.27,h+.28)]
            vs=[bm.verts.new(co) for co in coords]
            for face in ((0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)):bm.faces.new([vs[i] for i in face])
            ms.add(bm,'thatch',only=(2,))
        else:ms.box('roof',(1.38,.8,.045),at=(-.06 if state else 0,.27,h),lod=2)
        ms.box('team_cloth',(.48,.19,.015),at=(0,-.21,.38),lod=2)
    else:
        ms.box(mat,(.65,.52,.075),at=(0,.26,0),rot_z=17,lod=2)
    for bm,_mat,_lod,_only in ms.parts: pass

def layout(state):
    def build(ms,rng):
        rng=random.Random(8117)
        fitted(ms,'rich',(0,.28,0),(1.38,.86,.92),state>0)
        fitted(ms,'common',(-.62,-.37,0),(.51,.55,.53),state>0)
        # Boundary, open entrance and civic team canopy distinguish houses from a council hall.
        courtyard(ms,1)
        for x in (-.29,.29):ms.box('timber',(.025,.025,.38),at=(x,-.31,0),lod=1)
        ms.box('team_cloth',(.64,.34,.015),at=(0,-.2,.38),lod=1)
        ms.box('team_cloth',(.16,.014,.22),at=(.59,-.153,.31),lod=1)
        if THEME in ('base','levant','nile','maghreb','israelite'):
            ms.box('mudwall_bare',(.27,.28,.6),at=(.71,-.49,0),lod=1,taper=.82)
            ms.box('reed',(.34,.34,.025),at=(.71,-.49,.71),lod=1)
            for x in (.6,.82):ms.box('timber',(.02,.02,.11),at=(x,-.49,.6),lod=1)
        if state:
            # A true cut removes the main hall's upper right corner and roof, exposing the interior.
            hd.cut(ms,Vector((.36,.43,.58 if state==1 else .22)),Vector((.55,.25,1)),fill=False)
            if state==2:hd.cut(ms,Vector((0,0,.24)),Vector((-.08,.09,1)),fill=False)
            main,minor=hd.RUBBLE[THEME]
            for i in range(12 if state==1 else 22):
                ms.box(main,(rng.uniform(.055,.13),rng.uniform(.04,.1),rng.uniform(.025,.07)),at=(rng.uniform(-.5,.6),rng.uniform(-.5,.65),0),rot_z=rng.uniform(-90,90),lod=0)
            for i in range(3):hd.charred(ms,rng,.27+i*.08,.27,.2 if state==1 else .04,.4 if state==1 else .13,.3,-30+i*40)
        # Restrict near geometry before adding the separately budgeted far silhouette.
        ms.parts=[(bm,mat,lod,tuple(i for i in (0,1) if (only is None and i<=lod) or (only is not None and i in only))) for bm,mat,lod,only in ms.parts]
        ms.parts=[p for p in ms.parts if p[3]]
        trim_budget(ms,0,2400 if state==1 else 1100 if state==2 else 12000)
        trim_budget(ms,1,560 if state==1 else 280 if state==2 else 2400)
        low=tm.Mesher();far(low,state)
        low.parts=[(bm,mat,2,(2,)) for bm,mat,_lod,_only in low.parts]
        for bm,mat,lod,only in low.parts:ms.add(bm,mat,2,only=(2,))
    return build

name='civic-bronze'+('' if THEME=='base' else '-'+THEME)
items=[('keep',layout(0),None),('keep-damaged',layout(1),None),('keep-ruined',layout(2),None)]
os.makedirs(OUT,exist_ok=True)
if '--probe' in sys.argv:
    bpy.ops.wm.read_factory_settings(use_empty=True);tt.make_materials()
    counts={}
    for n,fn,_g in items:
        ms=tm.Mesher();fn(ms,random.Random(1));counts[n]={}
        for i in range(3):
            ob=ms.build(n+'-LOD'+str(i),i,tt.PROC);counts[n]['LOD'+str(i)]=tm.triangles(ob)
    print(json.dumps(counts),flush=True)
else:
    src=inspect.getsource(tm.bake_atlas).replace("scene.cycles.device = 'CPU'", "scene.cycles.device = 'GPU'\n    prefs = bpy.context.preferences.addons['cycles'].preferences\n    prefs.compute_device_type = 'OPTIX'\n    prefs.get_devices()\n    for device in prefs.devices: device.use = device.type == 'OPTIX'\n    scene.render.threads_mode = 'FIXED'\n    scene.render.threads = 8")
    exec(src,tm.__dict__)
    counts=tt.build_file(name,items,OUT,atlas=2048,seed=8117,write=AK is None)
    if AK:AK.finish(OUT,name)
    with open(os.path.join(OUT,name+'.report.json'),'w') as f:json.dump({'theme':THEME,'triangles':counts,'design':'design-sheet.png','license':'original procedural civic layout; existing project cultural kits'},f,indent=2)
sys.stdout.flush();os._exit(0)



