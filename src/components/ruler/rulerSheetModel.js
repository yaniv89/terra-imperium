// src/components/ruler/rulerSheetModel.js
// What the Ruler sheet shows (RULER-PLAN 6.2, differentiation plan U14), as a pure model over
// engine/rulers.js: the header (level, renown bar, points, decrees), the six attribute rows, the
// Virtue tree (taken / open / too dear / locked), the ambitions of the age and the last deeds.
import { rulerLevel, renownForLevel, MAX_RULER_LEVEL, attributeCost } from '../../data/rulers';
import { BRANCHES, TIERS, virtueAt, tierAgeIndex } from '../../data/rulerVirtues';
import { AGE_ORDER } from '../../data/ages';
import { ATTRIBUTES, rulerPoints, raiseBlock, virtueBlock, attributeCap, freeReshape } from '../../engine/rulers';
import { decreesOf, decreeCap } from '../../engine/decrees';
import { ambitionDef } from '../../engine/ambitions';

/** Points waiting to be spent: what the tab badge counts (ambitions pay themselves, so none wait). */
export const rulerBadge = (state) => {
  const p = rulerPoints(state.nations?.[state.playerNationId]?.ruler);
  return p.attribute + p.virtue;
};

const treeCell = (state, id, virtue) => {
  const ruler = state.nations[id].ruler;
  const taken = ruler.traits.includes(virtue.id);
  const block = taken ? null : virtueBlock(state, id, virtue.id);
  const locked = block === 'Opens in a later age' || block === 'Needs the tier before it' || block === 'One capstone only';
  // A tier locked by age names the age that opens it (rulers.js virtueBlock reads the same index).
  const opensAge = block === 'Opens in a later age' ? AGE_ORDER[tierAgeIndex(virtue.tier, AGE_ORDER.length - 1)] : null;
  return { id: virtue.id, virtue, state: taken ? 'taken' : !block ? 'open' : locked ? 'locked' : 'dear', block, opensAge };
};

export const rulerSheetModel = (state) => {
  const id = state.playerNationId;
  const nation = state.nations[id];
  const ruler = nation?.ruler;
  if (!ruler) return null;
  const pts = rulerPoints(ruler);
  const level = rulerLevel(ruler.renown);
  const from = renownForLevel(level);
  const to = level >= MAX_RULER_LEVEL ? from : renownForLevel(level + 1);
  const cap = attributeCap(state, id);
  return {
    ruler, nationId: id, level, points: pts,
    renown: Math.floor(ruler.renown), from, to, pct: to > from ? Math.min(1, (ruler.renown - from) / (to - from)) : 1,
    decrees: decreesOf(nation), decreeCap: decreeCap(nation),
    reshapeFree: freeReshape(state, id),
    attributes: ATTRIBUTES.map((a) => {
      const value = ruler[a];
      return { id: a, value, cap, cost: attributeCost(value + 1), can: !raiseBlock(state, id, a), atCap: value >= cap };
    }),
    branches: BRANCHES.map((b) => ({ id: b, cells: Array.from({ length: TIERS }, (_, i) => treeCell(state, id, virtueAt(b, i + 1))) })),
    ambitions: (nation.ambitions?.offers || []).map((o) => ({ id: o.id, label: ambitionDef(o.id)?.label || o.id, done: !!o.done })),
    deeds: (ruler.deeds || []).slice(0, 12)
  };
};

