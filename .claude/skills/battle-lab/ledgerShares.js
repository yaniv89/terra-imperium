// .claude/skills/battle-lab/ledgerShares.js
// The ledger shape of one battle for the parity checks: per side, the share of the strength that
// went in which fell and which fled (src/engine/battleLedger.js sideTotals), so Command and Auto
// are compared on how a battle ends, not only on who wins.
import { sideTotals } from '../../../src/engine/battleLedger';

const rowsOf = (start, end) => {
  const byId = new Map(end.map((u) => [u.id, u]));
  return start.map((u) => { const e = byId.get(u.id); return { before: u.strength, after: e ? e.strength : 0, routed: !!e?.routed, fate: e?.fate }; });
};
const side = (start, end) => { const t = sideTotals(rowsOf(start, end)); const b = Math.max(1, t.before); return { fallen: t.fallen / b, fled: t.fled / b }; };

/** { att: { fallen, fled }, def: { fallen, fled } } as shares of the strength that went in. */
export const ledgerShares = (attStart, attEnd, defStart, defEnd) => ({ att: side(attStart, attEnd), def: side(defStart, defEnd) });

const mean = (list, s, k) => list.reduce((x, r) => x + r[s][k], 0) / Math.max(1, list.length);
const pct = (v) => `${Math.round(v * 100)}%`;
/** `fallenA=t/a fledA=t/a fallenD=t/a fledD=t/a`, tactical over auto, mean shares over the seeds. */
export const sharesText = ({ t, a }) => [['att', 'A'], ['def', 'D']].map(([s, L]) => `fallen${L}=${pct(mean(t, s, 'fallen'))}/${pct(mean(a, s, 'fallen'))} fled${L}=${pct(mean(t, s, 'fled'))}/${pct(mean(a, s, 'fled'))}`).join(' ');
