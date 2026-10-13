// plans/art-pilot/md09-machine-scale/copy-built.mjs
// Copy the rebuilt machine units (GLB and JSON) from art-build/units/ into src/assets/units/.
//   node plans/art-pilot/md09-machine-scale/copy-built.mjs [id ...]
import { copyFileSync, existsSync } from 'node:fs';

const UNITS = {
  'bronze-siege': 'art-build/units/bronze-siege',
  'classical-siege': 'art-build/units/classical/classical-siege',
  'kingdoms-siege': 'art-build/units/kingdoms/kingdoms-siege',
  'gunpowder-siege': 'art-build/units/gunpowder/gunpowder-siege',
  'modern-siege': 'art-build/units/modern/modern-siege',
  'modern-cavalry': 'art-build/units/modern/modern-cavalry',
  'modern-support': 'art-build/units/modern/modern-support',
  'modern-general': 'art-build/units/modern/modern-general',
  'modern-raider': 'art-build/units/modern/modern-raider',
  // signature units (src/assets/units/signature/): tanks, the stone-thrower, the lantaka, the camels
  'kingdom-of-israel': 'art-build/units/signature/kingdom-of-israel',
  marcomannia: 'art-build/units/signature/marcomannia',
  'bosporan-kingdom': 'art-build/units/signature/bosporan-kingdom',
  tondo: 'art-build/units/signature/tondo',
  saba: 'art-build/units/signature/saba',
  qedar: 'art-build/units/signature/qedar',
  kindah: 'art-build/units/signature/kindah'
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(UNITS);
for (const id of ids) {
  const dir = UNITS[id] || id; const name = id.split('/').pop();
  const to = dir.includes('/signature/') ? 'src/assets/units/signature' : 'src/assets/units';
  for (const ext of ['glb', 'json']) {
    const from = `${dir}/${name}.${ext}`;
    if (!existsSync(from)) { console.log(`missing ${from}`); continue; }
    copyFileSync(from, `${to}/${name}.${ext}`);
    console.log(`${from} -> ${to}/${name}.${ext}`);
  }
}
