// src/components/independents/independentArt.js
// The independents' art hooks (phase W4; plans/ART-PRODUCTION-PLAN.md on claude/bronze-towns, the
// W1 and W2-4 rows). Each helper returns the URL of a delivered file, or null while the art is not
// there, and the caller draws the placeholder the plan allows:
//   personality shields   src/assets/icons/independents/<personality>.svg   (S1 icons, through
//                         data/icons.js like every other icon group); placeholder: a plain dot in
//                         the personality's colour on an empty shield, never a letter
//   action icons          src/assets/icons/independents/<id>.svg (raid-torch, raze, tribute, grudge,
//                         submit, trade-pact, hire-mercenaries, mercenary-contract); placeholder:
//                         the lucide glyph the component already shows
//   town dressings        src/assets/map/independents/<band>/<personality>-dressing.glb (S13, the
//                         W1 path in data/independents.js INDEPENDENT_ART); placeholder: none (the
//                         land theme's town alone)
//   tribal camps          src/assets/map/independents/tribal-camp-<biome>.glb (S13); placeholder:
//                         the colony camp
//   burning town          src/assets/fx/map/burning-town/sheet.json (S12 frames); placeholder: the
//                         flame badge of the raid layer
import { iconUrl } from '../../data/icons';
import { AGE_BAND, PERSONALITIES } from '../../data/independents';

/** The personality shield's URL, or null (placeholder: ShieldMark draws a dot in `shieldColour`). */
export const shieldUrl = (personality) => iconUrl('independents', personality);
/** The placeholder dot's colour (the W1 map badge colour). */
export const shieldColour = (personality) => PERSONALITIES[personality]?.badge || PERSONALITIES.tribal.badge;

/** The eight W2-4 icons by what they mean in the UI. */
export const ACTION_ICON_IDS = {
  raid: 'raid-torch', raze: 'raze', tribute: 'tribute', grudge: 'grudge', join: 'submit',
  trade: 'trade-pact', hire: 'hire-mercenaries', contract: 'mercenary-contract'
};
/** An action icon's URL, or null (the caller keeps its glyph). */
export const actionIconUrl = (key) => iconUrl('independents', ACTION_ICON_IDS[key]);

const MODELS = import.meta.glob('../../assets/map/independents/**/*.glb', { query: '?url', import: 'default', eager: true });
const modelUrl = (rel) => MODELS[`../../assets/map/independents/${rel}`] || null;

/** The town dressing of an independent of `personality` in age `ageId`, or null (no dressing yet). */
export const dressingUrl = (personality, ageId = 'bronze') => modelUrl(`${AGE_BAND[ageId] || 'early'}/${personality}-dressing.glb`);
/** A tribal camp by biome (steppe, desert, forest, jungle, tundra...), or null (the colony camp stands in). */
export const tribalCampUrl = (biome) => modelUrl(`tribal-camp-${biome}.glb`);

const FX = import.meta.glob('../../assets/fx/map/burning-town/sheet.json', { query: '?url', import: 'default', eager: true });
/** The burning-town effect's sheet, or null (the raid layer's flame badge stands in). */
export const burningTownFxUrl = () => Object.values(FX)[0] || null;
