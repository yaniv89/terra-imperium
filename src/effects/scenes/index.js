// src/effects/scenes/index.js
// Every choreography by name (EFFECT_REGISTRY's `scene` field), plus the timing lookups the rest of
// the app needs: how long an action's effect lives (EffectsContext), when its big moment lands
// (GlobeView's camera punch-in/shake), and how long a mobile sheet should peek (useAutoPeek).
import { getEffectSpec } from '../../data/effectRegistry';
import * as military from './military';
import * as domestic from './domestic';
import * as statecraft from './statecraft';
import * as diplomacy from './diplomacy';
import * as spectacle from './spectacle';

const isScene = (v) => v && typeof v === 'object' && typeof v.draw === 'function' && typeof v.build === 'function';
const collect = (...mods) => Object.fromEntries(mods.flatMap((m) => Object.entries(m).filter(([, v]) => isScene(v))));

export const SCENES = collect(military, domestic, statecraft, diplomacy, spectacle);

export const getScene = (actionType) => {
  const spec = getEffectSpec(actionType);
  return { scene: SCENES[spec.scene] || SCENES.strike, spec };
};

// Total lifetime of an action's effect, in ms.
export const getEffectDuration = (actionType) => getScene(actionType).scene.duration;

// When the effect's key moment happens (impact, the seal stamping, the rocket igniting...), in ms.
export const getImpactDelay = (actionType) => {
  const { scene, spec } = getScene(actionType);
  return typeof scene.impactAt === 'function' ? scene.impactAt(spec) : 0;
};

// The longest any effect can live — a safe upper bound for anything that needs a single number.
export const MAX_EFFECT_DURATION_MS = Math.max(...Object.values(SCENES).map((s) => s.duration));
