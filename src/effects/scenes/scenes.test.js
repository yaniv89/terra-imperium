// Smoke-runs every action's choreography through its whole timeline against a fake SVG DOM and a
// fake projector, for both an off-origin two-place effect and a one-place effect: no scene may
// throw, and each must actually put something visible on screen at its key moment.
import { describe, it, expect, beforeAll } from 'vitest';
import { EFFECT_REGISTRY } from '../../data/effectRegistry';
import { getScene, getImpactDelay } from './index';
import { createStage } from '../fx';
import { REGION_COORDINATES } from '../../data/regionCoordinates';
import { getNationCapital } from '../../data/regions';

class FakeNode {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.parent = null; this.textContent = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); }
  get firstChild() { return this.children[0] || null; }
}
const all = (n, out = []) => { out.push(n); n.children.forEach((c) => all(c, out)); return out; };

beforeAll(() => { globalThis.document = { createElementNS: (_ns, tag) => new FakeNode(tag) }; });

const FR = getNationCapital('fr');
const DE = getNationCapital('de');
// A simple equirectangular projector: 4px per degree around a 800x600 screen.
const projector = { zoom: 1, project: (lat, lng, alt = 0) => ({ x: 400 + (lng - 5) * 4, y: 300 - (lat - 48) * 4 - alt * 200, visible: true }) };

const runScene = (actionType, fromId, toId) => {
  const { scene, spec } = getScene(actionType);
  const svg = new FakeNode('svg'); const defs = new FakeNode('defs');
  const effect = { id: 1, actionType, fromRegionId: fromId, toRegionId: toId, createdAt: 0, variant: actionType === 'construct_building' ? 'economy' : (actionType === 'develop_resource_site' ? 'iron' : 'infantry'), age: 'kingdoms' };
  const stage = createStage(svg, defs, 1);
  const state = scene.build(stage, effect, spec, { ageId: 'kingdoms' });
  const from = REGION_COORDINATES[fromId]; const to = REGION_COORDINATES[toId];
  let visibleAtImpact = 0;
  const impact = Math.min(scene.duration - 1, getImpactDelay(actionType) + 150);
  for (let t = 0; t <= scene.duration; t += 50) {
    const f = { t, from, to, z: 1, project: projector.project, src: projector.project(from.lat, from.lng, 0), dst: projector.project(to.lat, to.lng, 0), effect };
    scene.draw(state, f);
    if (Math.abs(t - impact) < 50) {
      visibleAtImpact = all(stage.root).filter((n) => n !== stage.root && n.attrs.opacity !== undefined && Number(n.attrs.opacity) > 0.05).length;
    }
  }
  stage.destroy();
  return { visibleAtImpact };
};

describe('every action choreography', () => {
  Object.keys(EFFECT_REGISTRY).forEach((actionType) => {
    it(`${actionType} animates without errors and shows something at its key moment`, () => {
      const twoPlace = ['strike', 'declareWar', 'march', 'navalBattle', 'tradeRoute', 'gift', 'envoy', 'claimLine', 'hostility', 'pact', 'rupture', 'vassalize', 'espionage'].includes(EFFECT_REGISTRY[actionType].scene);
      const { visibleAtImpact } = runScene(actionType, twoPlace ? FR : DE, DE);
      expect(visibleAtImpact).toBeGreaterThan(2);
    });
  });
});
