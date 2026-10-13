"""Three missing vegetation kits, isolated builder with a mandatory 2D sheet gate.
Prepare (no bpy import/meshes): python build_vegetation_remaining.py --prepare
Build: blender -b -t 4 --python build_vegetation_remaining.py -- \
  /workspace/remaining-production/nature --sheet /parent/reference.png
Or bpy module: python build_vegetation_remaining.py OUT --sheet REFERENCE.png
Only this script, its unique helper, three nature GLBs and own scratch are owned.
Parent owns mesh packing, runtime checks, queues, progress and commits.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE=Path(__file__).resolve().parent
REPO=HERE.parent.parent
DEFAULT=Path('/workspace/remaining-production/nature')
KITS=('conifer','tropical','cold')
ROOTS=('tree-s','tree-m','tree-l','stump','felled','bush','rock-s','rock-m','grass-tuft')

def args():
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('out_dir',nargs='?',default=str(DEFAULT))
    p.add_argument('--prepare',action='store_true')
    p.add_argument('--sheet',type=Path,help='Parent-generated sheet covering the selected kits; read before mesh build.')
    p.add_argument('--kits',default=','.join(KITS))
    p.add_argument('--audit-saved',action='store_true',help='Audit saved roots/atlas and ground any positive-height feet without changing UVs or triangle counts.')
    p.add_argument('--previews-only',action='store_true',help='Render the existing saved BLENDs without rebuilding meshes or atlases.')
    p.add_argument('--replace-owned',action='store_true',help='Replace a repo target only if it still matches this scratch bundle before rebuilding.')
    p.add_argument('--scratch-only',action='store_true',help='Do not copy passing GLBs to src/assets/battle/nature.')
    return p.parse_args(argv)

def preview(bpy,kit,out,phone=False):
    from mathutils import Vector
    import math
    scene=bpy.context.scene
    for root in [o for o in scene.objects if o.type=='EMPTY']:
        for child in root.children:child.hide_render=not child.name.startswith('LOD0')
    # Only move root empties for preview; the editable saved model is already written.
    positions={'tree-s':(-.80,.35),'tree-m':(0,.35),'tree-l':(.85,.35),'stump':(-.85,-.55),'felled':(-.18,-.58),'bush':(.62,-.48),'rock-s':(-.72,-.86),'rock-m':(.1,-.97),'grass-tuft':(.75,-.83)}
    for name,(x,y) in positions.items():bpy.data.objects[name].location=(x,y,0)
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.render.resolution_x=211 if phone else 844;scene.render.resolution_y=98 if phone else 390;scene.render.resolution_percentage=100
    import ti_blender as studio
    studio.setup_render(scene,samples=24,transparent=True)
    scene.cycles.use_denoising=False
    scene.render.threads_mode='FIXED';scene.render.threads=4
    sun=studio.setup_lights(scene)
    cam=bpy.data.objects.new('ReviewCamera',bpy.data.cameras.new('ReviewCamera'));scene.collection.objects.link(cam)
    target=Vector((0,-.2,.32));cam.location=target+Vector((2,-3,3));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.6;scene.camera=cam
    bpy.context.view_layer.update()
    basis=cam.rotation_euler.to_matrix()
    projected=[basis.transposed()@(o.matrix_world@Vector(c)-cam.location) for o in scene.objects if o.type=='MESH' and not o.hide_render for c in o.bound_box]
    low=[min(v[i] for v in projected) for i in range(2)];high=[max(v[i] for v in projected) for i in range(2)]
    cam.data.ortho_scale=max(high[0]-low[0],(high[1]-low[1])*844/390)*1.15
    cam.location+=basis@Vector(((low[0]+high[0])/2,(low[1]+high[1])/2,0))
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/('phone.png' if phone else 'preview.png'))
    bpy.ops.render.render(write_still=True)
    for obj in (sun,cam):bpy.data.objects.remove(obj,do_unlink=True)

def audit_saved(bpy,name,folder,repo,scratch_only=False):
    import ti_map as tm
    bpy.ops.wm.open_mainfile(filepath=str(folder/(name+'.blend')))
    target=repo/'src/assets/battle/nature'/(name+'.glb')
    previous_hash=hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest()
    if target.exists():assert hashlib.sha256(target.read_bytes()).hexdigest()==previous_hash,'Parent changed target; scratch source audit only is required'
    roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY'];assert {o.name for o in roots}==set(ROOTS)
    corrected={};audit={}
    for root in roots:
        assert tuple(root.location)==(0,0,0)
        rows=[]
        for level,o in enumerate(sorted(root.children,key=lambda c:c.name)):
            before=tm.triangles(o);uv_before=[tuple(d.uv) for d in o.data.uv_layers.active.data]
            foot=min(v.co.z for v in o.data.vertices)
            if foot>1e-7:
                for v in o.data.vertices:v.co.z-=foot
                corrected[root.name+'/'+o.name]=foot
            assert abs(min(v.co.z for v in o.data.vertices))<1e-7
            assert tm.triangles(o)==before and [tuple(d.uv) for d in o.data.uv_layers.active.data]==uv_before
            assert before<=(600,150,150)[level]
            assert {m.name for m in o.data.materials}=={'Town'}
            assert not o.modifiers and not o.hide_render
            lo=[min(v.co[i] for v in o.data.vertices) for i in range(3)]
            hi=[max(v.co[i] for v in o.data.vertices) for i in range(3)]
            if level==0:assert max(abs((hi[i]+lo[i])/2) for i in (0,1))<2e-6
            rows.append({'triangles':before,'bounds':[lo,hi],'min_z':lo[2],'max_z':hi[2]})
        assert len(rows)==3;audit[root.name]=rows
    images=[i for i in bpy.data.images if i.size[0]>0]
    assert len(images)==3 and all(tuple(i.size)==(1024,1024) and i.packed_file for i in images)
    assert not any(o.type in ('LIGHT','CAMERA') for o in bpy.context.scene.objects)
    if corrected:
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))
        tm.export_glb(str(folder/(name+'.glb')),roots+[c for r in roots for c in r.children])
        if not scratch_only:
            assert not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest()==previous_hash
            shutil.copy2(folder/(name+'.glb'),target)
        preview(bpy,name.removeprefix('vegetation-'),folder);preview(bpy,name.removeprefix('vegetation-'),folder,phone=True)
    result=subprocess.run(['python3',str(HERE/'validate_model.py'),str(folder/(name+'.glb')),str(folder),'tree'],text=True,capture_output=True)
    (folder/'validate.log').write_text(result.stdout+result.stderr);assert result.returncode==0
    tone_result=subprocess.run(['node',str(repo/'scripts/art/town-tone.mjs'),'--json',str(folder/(name+'.glb'))],text=True,capture_output=True,cwd=repo)
    assert tone_result.returncode==0
    tone=json.loads(tone_result.stdout)[str(folder/(name+'.glb'))];assert tone['Town']['effective']>=.26
    report=json.loads((folder/'report.json').read_text())
    report.update({'source_audit':audit,'feet_exact_zero':True,'all_lod0_footprints_centred':True,'three_packed_1024_images':True,'scene_no_studio_or_plinth':True,'root_foot_corrections':corrected,'tone':tone,'source_build_scripts_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (HERE/'build_vegetation_remaining.py',HERE/'ti_vegetation_remaining.py')},'published_sha256':hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None,'blender_version':bpy.app.version_string,'standard_preview_studio':'ti_blender.setup_lights + setup_render, four threads, no denoiser; bbox-framed nine roots'})
    (folder/'report.json').write_text(json.dumps(report,indent=2)+'\n');(folder/'tone.json').write_text(json.dumps(tone,indent=2)+'\n')
    print('VEGETATION_SAVED_AUDIT_PASS',name,tone,'feet corrected',corrected,flush=True)
    return report

def main():
    a=args();kits=tuple(a.kits.split(','));assert kits and all(k in KITS for k in kits)
    out=Path(a.out_dir).resolve();out.mkdir(parents=True,exist_ok=True)
    if a.prepare:
        rec={'status':'code-prepared-waiting-for-parent-2d-sheet','kits':kits,'roots':ROOTS,'budget_per_root':[600,150,150],'atlas':[1024,1024],'scale':'1 unit =10m','threads_max':4,'mesh_build_started':False,'sheet_gate':'--sheet must reference the parent-generated concept before any bpy/geometry import','integration_api':'ti_vegetation_remaining.items(kit) -> [(root_name,layout(ms,rng),None)]; ti_town.build_file(file_name,items,out,atlas=1024,seed=...)','owned_scripts':[str(HERE/'build_vegetation_remaining.py'),str(HERE/'ti_vegetation_remaining.py')],'parent_responsibilities':['2D sheet','mesh packing','runtime validation','queue/progress','commit/push']}
        (out/'prepared.json').write_text(json.dumps(rec,indent=2)+'\n');print(json.dumps(rec,indent=2));return
    if not a.sheet or not a.sheet.is_file():raise SystemExit('2D sheet is not ready: no mesh build performed. Supply --sheet after reviewing the parent concept.')
    sheet=a.sheet.resolve();sheet_hash=hashlib.sha256(sheet.read_bytes()).hexdigest()
    os.environ['OMP_NUM_THREADS']='4';os.environ['OPENBLAS_NUM_THREADS']='1'
    os.environ.setdefault('BLENDER_USER_CONFIG',str(out/'blender-user-config'))
    sys.path.insert(0,str(HERE));import bpy
    import ti_town as tt
    import ti_vegetation_remaining as helper
    reports=json.loads((out/'report.json').read_text()) if (out/'report.json').exists() else {}
    for kit in kits:
        name='vegetation-'+kit;folder=out/name;folder.mkdir(parents=True,exist_ok=True)
        if a.audit_saved:
            reports[name]=audit_saved(bpy,name,folder,REPO,a.scratch_only)
            (out/'report.json').write_text(json.dumps(reports,indent=2)+'\n');continue
        if a.previews_only:
            bpy.ops.wm.open_mainfile(filepath=str(folder/(name+'.blend')))
            preview(bpy,kit,folder);preview(bpy,kit,folder,phone=True)
            print('VEGETATION_PREVIEWS_PASS',name,flush=True);continue
        target=REPO/'src/assets/battle/nature'/(name+'.glb')
        previous_owned_hash=None
        if a.replace_owned and target.exists() and (folder/(name+'.glb')).exists():
            previous_owned_hash=hashlib.sha256((folder/(name+'.glb')).read_bytes()).hexdigest()
            assert hashlib.sha256(target.read_bytes()).hexdigest()==previous_owned_hash,'Parent target differs; refusing replacement'
        counts=tt.build_file(name,helper.items(kit),str(folder),atlas=1024,seed=7210+KITS.index(kit)*37)
        roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY'];assert {o.name for o in roots}==set(ROOTS)
        # Keep file roots at 0; the parent/game places each root separately.
        for root in roots:root.location=(0,0,0)
        source={}
        for root in roots:
            lods=sorted(root.children,key=lambda x:x.name)
            assert len(lods)==3
            source[root.name]=[]
            for level,obj in enumerate(lods):
                foot=min(v.co.z for v in obj.data.vertices)
                if foot>1e-7:
                    for v in obj.data.vertices:v.co.z-=foot
                obj.data.calc_loop_triangles();tri=len(obj.data.loop_triangles)
                assert tri<=(600,150,150)[level]
                assert abs(min(v.co.z for v in obj.data.vertices))<1e-7
                assert all(not p.use_smooth for p in obj.data.polygons)
                source[root.name].append({'triangles':tri,'min_z':min(v.co.z for v in obj.data.vertices)})
        # Drop unused final slots so nature exports only opaque Town.
        for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
            town=next(m for m in obj.data.materials if m.name=='Town')
            for p in obj.data.polygons:p.material_index=0
            obj.data.materials.clear();obj.data.materials.append(town)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))
        import ti_map as tm
        tm.export_glb(str(folder/(name+'.glb')),roots+[c for r in roots for c in r.children])
        # Save editable atlas maps beside the BLEND, keeping the maps packed too.
        for image in bpy.data.images:
            if tuple(image.size)==(1024,1024):
                image.filepath_raw=str(folder/(image.name+'.png'));image.file_format='PNG';image.save();image.pack()
        bpy.ops.wm.save_as_mainfile(filepath=str(folder/(name+'.blend')))
        command=[sys.executable,str(HERE/'validate_model.py'),str(folder/(name+'.glb')),str(folder),'tree']
        # CLI Blender's executable is not Python; use the system Python for validator.
        command[0]='python3';result=subprocess.run(command,text=True,capture_output=True)
        (folder/'validate.log').write_text(result.stdout+result.stderr)
        assert result.returncode==0,(name,result.stdout,result.stderr)
        validation=json.loads((folder/(name+'.validation.json')).read_text());assert validation['passed']
        tone_result=subprocess.run(['node',str(REPO/'scripts/art/town-tone.mjs'),'--json',str(folder/(name+'.glb'))],text=True,capture_output=True,cwd=REPO)
        assert tone_result.returncode==0,(name,tone_result.stderr)
        tone=json.loads(tone_result.stdout)[str(folder/(name+'.glb'))]
        assert tone['Town']['effective']>=.26,(name,tone)
        (folder/'tone.json').write_text(json.dumps(tone,indent=2)+'\n')
        preview(bpy,kit,folder);preview(bpy,kit,folder,phone=True)
        record={'kit':kit,'sheet':str(sheet),'sheet_sha256':sheet_hash,'atlas':1024,'counts':counts,'source_audit':source,'validation_passed':True,'tone':tone,'packed':False,'editable_blend':str(folder/(name+'.blend')),'preview':[844,390],'phone':[211,98],'threads_max':4,'publication':'scratch-only'}
        if not a.scratch_only:
            target=REPO/'src/assets/battle/nature'/(name+'.glb')
            if target.exists() and (not previous_owned_hash or hashlib.sha256(target.read_bytes()).hexdigest()!=previous_owned_hash):raise RuntimeError('Parent target appeared/changed while building; refusing to overwrite '+str(target))
            shutil.copy2(folder/(name+'.glb'),target);record['publication']=str(target);record['published_sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
        reports[name]=record;(folder/'report.json').write_text(json.dumps(record,indent=2)+'\n')
        (out/'report.json').write_text(json.dumps(reports,indent=2)+'\n');print('VEGETATION_REMAINING_PASS',name,flush=True)

if __name__=='__main__':main()
