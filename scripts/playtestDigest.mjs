// scripts/playtestDigest.mjs
// A compact per-turn digest of one headless game for the playtester AI job (scripts/ai/playtester.mjs,
// plans/ai-output/README.md): one row per BLOCK turns (the player's cities, gold, techs, research,
// wars, battles, events shown, turn time, the AI world's counts) plus a list of notable moments with
// their turn numbers. Tooling only: it reads states and never changes one. No engine imports;
// scripts/simulate.mjs passes `getResearched` in. Small on purpose: a 300-turn game is about 30 rows.
//   const d = createDigest({ playerId, getResearched });  per turn: d.observe(before, after, ms, eventsShown)
//   d.result(finalState)
export const BLOCK = 10;
const NOTABLE_CAP = 400;

export const createDigest = ({ playerId, getResearched = null, isIndependent = () => false }) => {
  const blocks = []; const notable = [];
  let block = null;
  const note = (turn, kind, text) => { if (notable.length < NOTABLE_CAP) notable.push({ turn, kind, text }); };
  const nameOf = (s, id) => s.nations?.[id]?.name || id;
  const major = (s, id) => s.nations?.[id] && !isIndependent(s.nations[id]);
  const techCount = (s) => { const r = getResearched ? getResearched(s, playerId) : null; return r ? (r.size ?? r.length ?? Object.keys(r).length) : null; };

  const observe = (before, after, ms, eventsShown = []) => {
    const t = after.turnNumber;
    if (!block) block = { from: t, to: t, ms: [], battles: { won: 0, lost: 0, other: 0 }, events: [], aiWars: 0, aiCaptures: 0, playerCitiesLost: 0, playerCitiesTaken: 0 };
    block.to = t; block.ms.push(ms);

    // Battles the player fought this turn (battleReports is newest first).
    const seen = before.battleReportSeq || 0;
    (after.battleReports || []).filter((b) => Number(String(b.id).replace('battle-', '')) > seen).reverse().forEach((b) => {
      // outcome is the winning side ('attacker' | 'defender'), else 'stalemate'
      const won = b.outcome === 'attacker' || b.outcome === 'defender' ? (b.outcome === b.playerSide ? 'won' : 'lost') : 'other';
      block.battles[won] += 1;
      note(t, 'battle', `${b.name || b.kind}: ${b.outcome} (player ${b.playerSide}${b.commanded ? ', commanded' : ', auto'}${b.captured ? ', city taken' : ''}); men lost ${b.fallen?.[b.playerSide] ?? '?'}`);
    });
    eventsShown.forEach((title) => { block.events.push(title); note(t, 'event', title); });

    const wasWar = new Set((before.wars || []).filter((w) => w.active).map((w) => w.id));
    for (const w of after.wars || []) {
      const withPlayer = w.aggressor === playerId || w.enemy === playerId;
      if (w.active && !wasWar.has(w.id)) {
        if (withPlayer) note(t, 'war', `${nameOf(after, w.aggressor)} declared war on ${nameOf(after, w.enemy)}${w.cb ? ` (${w.cb})` : ''}`);
        else if (major(after, w.aggressor) && major(after, w.enemy)) { block.aiWars += 1; note(t, 'ai', `${nameOf(after, w.aggressor)} declared war on ${nameOf(after, w.enemy)}`); }
      } else if (!w.active && wasWar.has(w.id) && withPlayer) note(t, 'peace', `War ${nameOf(after, w.aggressor)} vs ${nameOf(after, w.enemy)} ended`);
    }
    for (const [id, c] of Object.entries(after.regions || {})) {
      const was = before.regions?.[id]?.owner;
      if (was === undefined || was === c.owner) continue;
      if (was === playerId) { block.playerCitiesLost += 1; note(t, 'city', `Lost ${c.name || id} to ${nameOf(after, c.owner)}`); }
      else if (c.owner === playerId) { block.playerCitiesTaken += 1; note(t, 'city', `Took ${c.name || id} from ${nameOf(after, was)}`); }
      else if (major(after, c.owner)) block.aiCaptures += 1;
    }
    for (const [id, n] of Object.entries(after.nations || {})) {
      if (n.isEliminated && !before.nations?.[id]?.isEliminated && major(after, id)) note(t, 'ai', `${n.name || id} was destroyed`);
    }
    const me0 = before.nations?.[playerId] || {}; const me1 = after.nations?.[playerId] || {};
    Object.entries(me1.eraGoals || {}).forEach(([age, g]) => { if (!me0.eraGoals?.[age]) note(t, 'eraGoals', `${age} scored: ${g.met?.length ?? 0} goals met${g.legacy ? ', legacy earned' : ', no legacy'}`); });
    const c0 = before.crises?.history?.length || 0;
    (after.crises?.history || []).slice(c0).forEach((c) => note(t, 'crisis', `${c.id} hit ${(c.nations || []).map((id) => nameOf(after, id)).join(', ')}${(c.nations || []).includes(playerId) ? ' (the player)' : ''}`));
    if (after.research?.lastCompleted && after.research.lastCompleted !== before.research?.lastCompleted) note(t, 'tech', `Researched ${after.research.lastCompleted.techId}`);
    if (after.gameStatus !== 'ACTIVE' && before.gameStatus === 'ACTIVE') note(t, 'end', `Game ended: ${after.gameStatus}`);

    if (t - block.from + 1 >= BLOCK || after.gameStatus !== 'ACTIVE') flush(after);
  };

  const flush = (s) => {
    if (!block) return;
    const cities = Object.values(s.regions || {}).filter((c) => c.owner === playerId && !c.outpost);
    const ms = block.ms.slice().sort((a, b) => a - b);
    blocks.push({
      turns: `${block.from}-${block.to}`, year: s.year,
      cities: cities.length, citySizes: cities.reduce((a, c) => a + (c.size || 0), 0),
      gold: Math.round(s.resources?.gold ?? 0), techs: techCount(s), researching: s.research?.current || null, queue: s.research?.queue?.length || 0,
      units: Object.values(s.units || {}).filter((u) => u.ownerId === playerId).length,
      warsWithPlayer: (s.wars || []).filter((w) => w.active && (w.aggressor === playerId || w.enemy === playerId)).map((w) => nameOf(s, w.aggressor === playerId ? w.enemy : w.aggressor)),
      battles: block.battles, events: block.events.length, citiesLost: block.playerCitiesLost, citiesTaken: block.playerCitiesTaken,
      aiWarsDeclared: block.aiWars, aiCitiesChanged: block.aiCaptures,
      majorsAlive: Object.entries(s.nations || {}).filter(([id, n]) => !n.isEliminated && major(s, id)).length,
      turnMs: { mean: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length), max: Math.round(ms[ms.length - 1]) }
    });
    block = null;
  };

  const result = (s) => { flush(s); return { player: { id: playerId, name: nameOf(s, playerId) }, finalTurn: s.turnNumber, finalYear: s.year, status: s.gameStatus, blockTurns: BLOCK, blocks, notable, notableCapped: notable.length >= NOTABLE_CAP }; };
  return { observe, result };
};
