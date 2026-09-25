// src/engine/aiMissiles.js
// Plan §M19: "AI builds ABM to level 1-2 when at war with a nuclear power." Full AI missile
// building/launching is explicitly scoped out here rather than half-wired: BUILD_MISSILE's real
// cost needs iron/oil/rareMetals for every tier but tactical (src/data/actionCosts.js), and M16's
// own aiEconomy.js never gave AI nations a tracked strategic-resource economy at all — that file's
// own header documents the trim ("AI doesn't track copper/iron/oil... unlike the player's own
// RECRUIT_STRATEGIC_RESOURCE_BY_AGE penalty/discount"). Inventing a second, AI-only, gold-only
// missile-cost path just to let AI build and fire missiles would be a bigger, separate addition
// than this milestone's "late-game integration" scope calls for. ABM defense's own cost (gold + mil
// only, src/data/actionCosts.js's buildAbmDefense) has no such gap, so it's the one piece of the
// plan's own missile-related AI ask that's genuinely affordable with the AI economy that already
// exists — this file does exactly that, nothing more.
import { ACTION_COSTS } from '../data/actionCosts';

// "level 1-2", not the player's own MAX_ABM_LEVEL (5) — a deliberately modest AI ceiling, not an
// attempt to match a player who actually invested in the full defense line.
export const AI_ABM_TARGET_LEVEL = 2;

// One ABM level per think, for any nation with a real economy (M16) that's currently at war with a
// nation holding at least one nuclear warhead — never for a nation not already fighting one, since
// this is meant to read as a wartime countermeasure, not passive nuclear-race paranoia.
export const processAIAbmDefense = (state, nations) => {
  const nextNations = { ...nations };
  const logs = [];
  Object.keys(nations).forEach((nationId) => {
    const nation = nextNations[nationId];
    if (!nation || nation.isPlayer || !nation.economy) return;
    if ((nation.abmDefenseLevel || 0) >= AI_ABM_TARGET_LEVEL) return;

    const atWarWithNuclearPower = (state.wars || []).some((w) => {
      if (!w.active) return false;
      const enemyId = w.aggressor === nationId ? w.enemy : (w.enemy === nationId ? w.aggressor : null);
      if (!enemyId) return false;
      return (nations[enemyId]?.missiles?.nuclear || 0) > 0;
    });
    if (!atWarWithNuclearPower) return;

    const costs = ACTION_COSTS.buildAbmDefense;
    if ((nation.economy.gold || 0) < costs.gold || (nation.economy.mil || 0) < costs.mil) return;

    nextNations[nationId] = {
      ...nation,
      abmDefenseLevel: (nation.abmDefenseLevel || 0) + 1,
      economy: { ...nation.economy, gold: nation.economy.gold - costs.gold, mil: nation.economy.mil - costs.mil }
    };
    logs.push({ message: `${nation.name} builds up its anti-ballistic-missile defenses.` });
  });
  return { nations: nextNations, logs };
};
