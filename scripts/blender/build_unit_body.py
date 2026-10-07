# scripts/blender/build_unit_body.py
# The shared neutral adult body and canonical 21-bone rig (sample melee clips): blender -b -P scripts/blender/build_unit_body.py
# Authored by the Codex agent on 2026-10-07 (local Blender 5.2), moved into the repository by Claude:
# outputs go to art-build/units/<id>/ (ti_units.out_dir), the shared helpers are ti_units.py.
import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent));import ti_units as u
OUT=u.out_dir('shared-neutral-body')
bpy.ops.wm.read_factory_settings(use_empty=True)
arm,body=u.build_body();body.name='Body'
clips=u.add_actions(arm);floor=u.ground_actions(arm,[body]);bpy.context.scene.render.fps=20
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'shared-neutral-body.blend'))
u.export_file(OUT/'shared-neutral-body.glb',arm,[body])
(OUT/'clips.json').write_text(json.dumps({'fps':20,'clips':clips,'role':'shared neutral modelling master; not extra base-unit logical job'},indent=2))
(OUT/'source-report.json').write_text(json.dumps({'triangles':u.triangles([body]),'body_height_H':1,'adult_head_heights':6.5,'bones':list(arm.data.bones.keys()),'flat_materials_no_textures':True,'workflow':'Conceptsheet before new geometry; local Blender5.2','source_sheet':'plans/art/units/wave1/shared-neutral-body.png'},indent=2))
(OUT/'floor-correction.json').write_text(json.dumps(floor,indent=2))
(OUT/'palette.json').write_text(json.dumps(u.COLORS,indent=2))
