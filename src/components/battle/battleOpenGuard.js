// src/components/battle/battleOpenGuard.js
// Whether a pending commanded battle may open (TacticalBattleHost.jsx), pure for tests. The phone
// playtest's frozen battle (an empty field, the enemy's houses, no troops, no buttons) is what these
// guard against: a battle that cannot be set up or has no troops on a side never opens (it is
// settled on Auto through the outcome service, with a log line), a set-up error is shown with the
// way back, and a mid-battle checkpoint is resumed only into the battle it was saved from.
import { buildInvasionSetup, setupHasBothSides, setupKeyOf, setupSideCounts, SETUP_VERSION } from '../../battle/setup/buildBattleSetup';

/** The battle for `pb`: { setup } or { setup: null, error } when building it threw. */
export const safeBattleSetup = (state, pb, build = buildInvasionSetup) => {
  if (!pb) return { setup: null };
  try { return { setup: build(state, pb) }; } catch (err) {
    console.error('[battle] the battle could not be set up', err);
    return { setup: null, error: err?.message || String(err) };
  }
};

/**
 * Why a pending battle must not open and is settled on Auto instead ('no_setup' | 'no_attackers' |
 * 'no_defenders', the ABANDON_TACTICAL_BATTLE reasons), or null when it can open. A set-up error
 * is not settled silently: the player sees it and chooses (BattleFailure).
 */
export const battleOpenProblem = ({ setup, error = null }) => {
  if (error) return null;
  if (!setup) return 'no_setup';
  if (!setupHasBothSides(setup)) return setupSideCounts(setup)[0] > 0 ? 'no_defenders' : 'no_attackers';
  return null;
};

/** A checkpoint may resume this battle only when it was saved from this very battle. */
export const checkpointFits = (cp, setup) => !!cp && cp.setupVersion === SETUP_VERSION && !!cp.setupKey && cp.setupKey === setupKeyOf(setup);
