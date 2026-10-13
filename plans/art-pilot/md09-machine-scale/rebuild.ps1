# plans/art-pilot/md09-machine-scale/rebuild.ps1
# Rebuild every unit this task touched (machines at two thirds of real size, camels at true size)
# and print each one's BUILT and MACHINE lines. Run from the repository root, then copy-built.mjs.
#   powershell -File plans/art-pilot/md09-machine-scale/rebuild.ps1
$b = "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"
$keep = "BUILT|MACHINE|RAM_|Error|Traceback|  File "
& $b -b --factory-startup -P scripts/blender/build_bronze_siege_machinery.py | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_bronze_siege.py | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_classical.py -- classical-siege | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_kingdoms.py -- kingdoms-siege | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_gunpowder.py -- gunpowder-siege | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_modern.py -- modern-siege modern-cavalry modern-support modern-general | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_modern_irregular.py -- modern-raider | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_modern_signature.py -- kingdom-of-israel marcomannia kindah | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_classical_signature.py -- bosporan-kingdom saba qedar | Select-String -Pattern $keep
& $b -b --factory-startup -P scripts/blender/build_units_gunpowder_signature.py -- tondo | Select-String -Pattern $keep
"REBUILD_DONE"
