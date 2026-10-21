// src/components/chronicle/chronicleModel.js
// What the Chronicle reader and the share image show (differentiation plan U29): one row per age the
// player lived in, read from state.chronicle (src/engine/chronicle.js). The open chapter takes the
// player's tiles as they are now. Years are labels only. Pure.
import { tileRuns } from '../../engine/chronicle';
import { ambitionDef } from '../../engine/ambitions';

const names = (state, rows, how) => rows.filter((r) => r.how === how).map((r) => state.regions?.[r.id]?.name).filter(Boolean);

export const chronicleModel = (state) => {
  const chapters = state.chronicle?.chapters || [];
  return chapters.map((c, i) => {
    const open = i === chapters.length - 1 && c.to == null;
    return {
      age: c.age,
      label: c.label,
      open,
      runs: open ? tileRuns(state) : c.tiles || [],
      battles: c.battles.map((b) => ({ name: b.name, fallen: b.fallen, result: b.outcome === b.side ? 'won' : b.outcome === 'stalemate' || !b.outcome ? 'drawn' : 'lost' })),
      founded: names(state, c.cities, 'founded'),
      taken: names(state, c.cities, 'taken'),
      lost: names(state, c.cities, 'lost'),
      wars: c.wars.map((w) => state.nations?.[w.enemy]?.name).filter(Boolean),
      ambitions: c.ambitions.map((a) => ({ id: a.id, label: ambitionDef(a.id)?.label || a.id }))
    };
  });
};
