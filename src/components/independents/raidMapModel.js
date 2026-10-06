// src/components/independents/raidMapModel.js
// The independents' marks on the map (phase W4, plans/independent-cities.md 7), as plain lists in
// tile ids, so any renderer can draw them: the SVG flat map today (RaidMarkersOverlay.jsx) and the
// WebGL map of phase A2 (origin/claude/phase-a2-webgl-map, src/components/map/gl/sceneModel.js)
// later, which turns each list into sprites and lines the same way its markerSprites does.
//
//   parties   raid parties in the player's sight: { id (the independent), name, personality, tile,
//             route (tiles still to walk, the next first), targetTile, kind, target (words), eta
//             (turns), againstYou, phase ('out' | 'hold' | 'home') }
//   warnings  the tiles a raid against the player is heading for, shown once the party is seen or
//             the engine warned (3 tiles out): { tile, id, kind, target, eta }. The ring is drawn
//             even when the party itself is still in the fog.
//   sieges    sieges of independents' cities by others than the player, in sight: { cityId, tile,
//             name, by, byName, owner, ownerName, hp (0..1), encircled }
//   burning   cities being razed, in sight: { cityId, tile, name, by }
// Read only. Sight is engine/sight.js visibleTiles (the fog hook of phase A when it lands).
import { isIndependentNation, PERSONALITIES } from '../../data/independents';
import { visibleTiles } from '../../engine/sight';
import { raidEta } from '../../engine/raids';
import { unitTile } from '../../engine/armies';
import { raidTargetName, RAID_KIND_WORDS } from './independentSheetModel';

export const raidMapModel = (state, sight = visibleTiles(state, state.playerNationId)) => {
  const me = state.playerNationId;
  const parties = []; const warnings = []; const sieges = []; const burning = [];
  const partyTile = new Map();
  Object.values(state.units || {}).forEach((u) => {
    if (!u.raidOf || !(u.strength > 0) || partyTile.has(u.raidOf)) return;
    const t = unitTile(state, u);
    if (t != null) partyTile.set(u.raidOf, t);
  });
  Object.keys(state.nations || {}).sort().forEach((id) => {
    const n = state.nations[id];
    if (!isIndependentNation(n) || n.isEliminated) return;
    const raid = n.indep?.raid;
    const tile = partyTile.get(id);
    if (!raid || tile == null) return;
    const againstYou = raid.targetNationId === me;
    const seen = sight.has(tile);
    const eta = raidEta(state, id);
    const target = raidTargetName(state, raid);
    if (seen) {
      parties.push({
        id, name: n.name, personality: n.indep?.personality || 'tribal', colour: PERSONALITIES[n.indep?.personality]?.badge, tile,
        route: raid.phase === 'hold' ? [] : [...(raid.route || [])], targetTile: raid.targetTile, kind: raid.kind, kindWord: RAID_KIND_WORDS[raid.kind] || raid.kind,
        target, eta: eta?.turns ?? null, againstYou, phase: raid.phase
      });
    }
    if (againstYou && raid.phase !== 'home' && (seen || raid.warned)) warnings.push({ tile: raid.targetTile, id, kind: raid.kind, target, eta: eta?.turns ?? null });
  });
  Object.values(state.regions || {}).forEach((c) => {
    if (c.tile == null || !sight.has(c.tile)) return;
    if (c.siege?.by && c.siege.by !== me && c.owner !== me && isIndependentNation(state.nations?.[c.owner])) {
      sieges.push({
        cityId: c.id, tile: c.tile, name: c.name, by: c.siege.by, byName: state.nations[c.siege.by]?.name || 'rebels', owner: c.owner, ownerName: state.nations[c.owner]?.name || '',
        hp: Math.max(0, Math.min(1, (c.siege.hp ?? 0) / Math.max(1, c.siege.maxHp || 1))), encircled: !!c.siege.encircled
      });
    }
    if (c.razing) burning.push({ cityId: c.id, tile: c.tile, name: c.name, by: c.razing.by, size: c.size || 1 });
  });
  const byId = (a, b) => (String(a.cityId ?? a.id) < String(b.cityId ?? b.id) ? -1 : 1);
  return { parties, warnings, sieges: sieges.sort(byId), burning: burning.sort(byId) };
};

/** True when the model has nothing to draw (the overlay renders nothing). */
export const raidMapEmpty = (m) => !m.parties.length && !m.warnings.length && !m.sieges.length && !m.burning.length;
