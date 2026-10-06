// src/components/map/gl/mapSprites.js
// Delivered sprite sheets for the WebGL map (plans/ART-PRODUCTION-PLAN.md, batch 08, spec S4):
// each in src/assets/map/sprites/<id>/ as frames (<id>-0.png, <id>-1.png, ...) plus sheet.json
// ({ "frame": [w, h], "frames": n, "fps": 12 }). Grey #BFBFBF where the nation colour goes.
// Until a sheet is delivered, spriteArt.js draws its placeholder. The ids the map asks for:
export const MAP_SPRITE_IDS = [
  'badge-plate',        // the city badge's plate (placeholder: the drawn disc)
  'army-base',          // the army marker's base (placeholder: the drawn shield)
  'standard-bronze', 'standard-classical', 'standard-kingdoms', 'standard-gunpowder', 'standard-modern', // army standards per age (placeholder: the shield)
  'ai-battle-clash',    // AI against AI battle in sight (placeholder: crossed swords on a disc)
  'ai-battle-smoke',    // its smoke loop (placeholder: none)
  'battle-result',      // the flash when a battle ends (placeholder: none)
  'route-dots'          // march route dots and arrowhead (placeholder: drawn lines)
];
// Map marker icons (spec S1), through src/data/icons.js: src/assets/icons/markers/siege.svg and
// src/assets/icons/markers/sea-battle.svg (placeholders: the battle marker).

const sheets = import.meta.glob('../../../assets/map/sprites/*/sheet.json', { eager: true, import: 'default' });
const frames = import.meta.glob('../../../assets/map/sprites/*/*.png', { eager: true, query: '?url', import: 'default' });

const SHEETS = {};
Object.entries(sheets).forEach(([file, sheet]) => {
  const id = file.match(/sprites\/([a-z0-9-]+)\/sheet\.json$/)?.[1];
  if (id) SHEETS[id] = { ...sheet, urls: [] };
});
Object.entries(frames).forEach(([file, url]) => {
  const m = file.match(/sprites\/([a-z0-9-]+)\/[a-z0-9-]+-(\d+)\.png$/);
  if (m && SHEETS[m[1]]) SHEETS[m[1]].urls[Number(m[2])] = url;
});

/** The delivered sheet ({ frame, frames, fps, urls }) or null (the placeholder draws). */
export const spriteSheet = (id) => (SHEETS[id]?.urls?.length ? SHEETS[id] : null);
/** The URL of one frame of a delivered sheet, or null. */
export const spriteFrameUrl = (id, frame = 0) => spriteSheet(id)?.urls[frame % spriteSheet(id).urls.length] || null;
/** The age's army standard id (decision: five ages now). */
export const standardFor = (ageId) => `standard-${['bronze', 'classical', 'kingdoms', 'gunpowder', 'modern'].find((a) => String(ageId || '').includes(a)) || 'bronze'}`;
