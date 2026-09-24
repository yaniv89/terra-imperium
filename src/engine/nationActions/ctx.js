// src/engine/nationActions/ctx.js
// Two implementations of the same small read/write surface, so one action-handler function can
// run identically for the player (via the reducer) and for an AI nation (via the AI decision
// phase in resolveTurn) — see src/engine/nationState.js's header for why that unification matters.
//
// A handler never touches `state` directly; it only ever calls these methods. That's what makes
// the same handler safe to run from either context without knowing which one it's in.
import { getPool, getResearched, getTechAgeId } from '../nationState';

// Used by the reducer. Copy-on-FIRST-write per bucket (regions, nations, the player's own resource
// pool): a handler that reads a lot but writes nothing leaves `state` completely untouched, so
// `commit()` returns the exact same reference it was given — the no-op guard contract every
// existing `.toBe(state)` reducer test relies on, preserved even for actions that move through
// this new layer.
export const immutableCtx = (state) => {
  let next = state;
  let regionsCopied = false;
  let nationsCopied = false;
  const logs = [];

  const ensureRegions = () => {
    if (!regionsCopied) { next = { ...next, regions: { ...next.regions } }; regionsCopied = true; }
  };
  const ensureNations = () => {
    if (!nationsCopied) { next = { ...next, nations: { ...next.nations } }; nationsCopied = true; }
  };

  return {
    readRegion: (id) => next.regions[id],
    writeRegion: (id, region) => { ensureRegions(); next.regions[id] = region; },
    readNation: (id) => next.nations[id],
    writeNation: (id, nation) => { ensureNations(); next.nations[id] = nation; },
    readPool: (nationId) => getPool(next, nationId),
    writePool: (nationId, pool) => {
      if (nationId === next.playerNationId) { next = { ...next, resources: pool }; }
      else { ensureNations(); next.nations[nationId] = { ...next.nations[nationId], economy: pool }; }
    },
    getResearched: (nationId) => getResearched(next, nationId),
    getTechAgeId: (nationId) => getTechAgeId(next, nationId),
    log: (message, type) => { logs.push({ year: next.year, message, type }); },
    // Returns the SAME reference passed to immutableCtx if nothing was ever written and nothing
    // was logged; otherwise the accumulated next state with any logged messages appended once.
    commit: () => (next === state && logs.length === 0 ? state : { ...next, logs: [...next.logs, ...logs] })
  };
};

// Used by the AI decision phase in resolveTurn. Takes buckets the caller has ALREADY shallow-copied
// once for the whole turn (`{...state.regions}`, `{...state.nations}`) and mutates them in place
// across every AI nation's decisions that turn — deliberately not copy-on-write per action, since
// that would cost one extra object spread per AI decision (cheap alone, real money at ~80
// decisions across 240 nations every turn). The caller owns committing `regions`/`nations` back
// onto state once, after every AI nation has had its turn.
//
// `log` is a no-op here on purpose: the AI phase doesn't write every nation's every micro-decision
// into state.logs (240 nations doing that every turn would drown the player's own log) — callers
// that want a notable AI action to show up push their own log entry directly, the same way
// resolveTurn's existing AI passes (processAIRecruitment, processAIWarDecisions) already do.
export const draftCtx = (state, regions, nations) => ({
  readRegion: (id) => regions[id],
  writeRegion: (id, region) => { regions[id] = region; },
  readNation: (id) => nations[id],
  writeNation: (id, nation) => { nations[id] = nation; },
  readPool: (nationId) => (nationId === state.playerNationId ? state.resources : nations[nationId]?.economy) || {},
  writePool: (nationId, pool) => {
    if (nationId === state.playerNationId) {
      throw new Error('draftCtx must not write the player\'s pool — the player always goes through immutableCtx/the reducer');
    }
    nations[nationId] = { ...nations[nationId], economy: pool };
  },
  getResearched: (nationId) => (nationId === state.playerNationId
    ? Object.keys(state.techTree || {}).filter((id) => state.techTree[id]?.researched)
    : (nations[nationId]?.tech?.researched || [])),
  getTechAgeId: (nationId) => (nationId === state.playerNationId ? state.techAgeId : nations[nationId]?.tech?.ageId) || state.age,
  log: () => {}
});
