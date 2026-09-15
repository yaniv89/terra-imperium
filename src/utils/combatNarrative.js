// src/utils/combatNarrative.js
// Escalating flavor text for storm combat outcomes (Phase 9). Previously a decisive win, a
// narrow win, and a Pyrrhic win all produced the exact same log line — this maps the combat
// ratio calcCombatResult already computes into varied phrasing, entirely for free (no new
// state, no new RNG draws, no change to the actual combat math).

// Player-attacking storm outcomes.
export const narratePlayerStorm = (outcome, { regionName, ratio }) => {
  if (outcome === 'win') {
    if (ratio >= 2) return `Overwhelming victory! ${regionName} falls in a rout.`;
    if (ratio >= 1.3) return `Decisive victory — ${regionName} is captured!`;
    return `Hard-fought victory — ${regionName} is captured after fierce resistance.`;
  }
  if (outcome === 'stalemate') {
    return ratio >= 0.95
      ? `Offensive in ${regionName} grinds to a near-breakthrough — reinforcements needed.`
      : `Offensive in ${regionName}: progress slow.`;
  }
  // loss
  return ratio < 0.4
    ? `Routed! The offensive in ${regionName} collapses with heavy losses.`
    : `Offensive in ${regionName} stalled!`;
};

// Enemy-attacking storm outcomes. `outcome` distinguishes 'capture' (control hit 0, ownership
// transferred) from 'overrun' (control damage only) — these are different EVENTS, not different
// severities of the same event, so both keep their own ratio-scaled variants.
export const narrateEnemyStorm = (outcome, { regionName, nationName, ratio, damage }) => {
  if (outcome === 'capture') {
    return ratio >= 2
      ? `${nationName} shatters the defense and seizes ${regionName} in a lightning breakthrough!`
      : `${regionName} CAPTURED by ${nationName}!`;
  }
  if (outcome === 'overrun') {
    return ratio >= 2
      ? `${nationName} smashes through the line at ${regionName}! Control -${damage}%`
      : `${regionName} OVERRUN! Control -${damage}%`;
  }
  if (outcome === 'stalemate') {
    return `${regionName} under pressure. Control -${damage}%`;
  }
  // defender (player) wins
  return ratio < 0.4
    ? `${nationName} is routed at ${regionName} — a crushing defeat for the attacker.`
    : `Defended ${regionName}! ${nationName} repelled.`;
};
