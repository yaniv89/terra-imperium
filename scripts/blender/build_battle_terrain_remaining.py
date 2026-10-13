"""Five remaining battle-terrain files. No runtime, sim, queue or shared-helper changes.
Module: OMP_NUM_THREADS=2 /tmp/bpyenv/bin/python scripts/blender/build_battle_terrain_remaining.py --sheet <PNG> [--only ford] [--geometry-only]
CLI: blender -b -t 2 --python this-file -- --sheet <PNG> ...
The sheet must be provided and viewed by the author before geometry creation.
"""
import argparse,json,sys,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FILES=('river-kit','ford','bridge-wood','bridge-stone','bridge-steel')

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--sheet',type=Path,required=True);parser.add_argument('--out',type=Path,default=Path('/workspace/remaining-production/terrain'));parser.add_argument('--game-dir',type=Path,default=ROOT/'src/assets/battle/terrain');parser.add_argument('--only',choices=FILES);parser.add_argument('--threads',type=int,default=2);parser.add_argument('--geometry-only',action='store_true');parser.add_argument('--no-preview',action='store_true');ns=parser.parse_args(args)
    assert ns.sheet.is_file(),'Concept sheet path must exist before any mesh build';assert 1<=ns.threads<=2
    os.environ['OMP_NUM_THREADS']=str(ns.threads);os.environ['OPENBLAS_NUM_THREADS']=str(ns.threads)
    sys.path.insert(0,str(Path(__file__).parent));import ti_battle_terrain_remaining as helper
    import bpy
    ns.out.mkdir(parents=True,exist_ok=True);reports={}
    for receipt in ns.out.glob('*/delivery.json'):
        record=json.loads(receipt.read_text());reports[record['id']]=record
    if ns.geometry_only:reports={}
    for ident in ([ns.only] if ns.only else FILES):
        out=ns.out/ident;out.mkdir(parents=True,exist_ok=True)
        if ns.geometry_only:
            bpy.ops.wm.read_factory_settings(use_empty=True);helper.register_materials();helper.tt.make_materials();rows={}
            for k,(name,layout) in enumerate(helper.file_items(ident)):
                ms=helper.tm.Mesher();layout(ms,helper.tm.seeded(8217+k*41));helper.repair_open_normals(ms);rows[name]=[]
                for level,budget in enumerate(helper.BUDGETS):
                    obj=ms.build('LOD'+str(level),level,helper.tt.PROC);rows[name].append(helper.audit_geometry(obj,budget));bpy.data.objects.remove(obj,do_unlink=True)
            reports[ident]=rows
        else:
            roots,record=helper.build_file(ident,out,ns.game_dir,ns.sheet,ns.threads)
            if not ns.no_preview:helper.preview(roots,out,ns.threads)
            reports[ident]=record
        print('TERRAIN_READY',ident,flush=True)
    (ns.out/('geometry-checks.json' if ns.geometry_only else 'terrain-delivery.json')).write_text(json.dumps(reports,indent=2)+'\n')
    print('TERRAIN_GEOMETRY_PASSED' if ns.geometry_only else 'TERRAIN_DELIVERY_READY',flush=True)

if __name__=='__main__':main()
