// src/utils/nationalBorders.js
// Pulled out of GlobeView.jsx so the memoization key and the border-mesh filter — both plain,
// three.js/react-globe.gl-free logic — can be unit tested without mounting the actual WebGL globe.
import { mesh } from 'topojson-client';

// A cheap stand-in for the full `regions` object, used as a useMemo dependency in GlobeView so the
// (much pricier) mesh() call below only re-runs when ownership actually changes — e.g. a
// conquest — not on every unrelated dispatch or per-turn unrest/control drift. Object.values order
// follows Object.keys insertion order, which a `{...state.regions, [id]: ...}` merge preserves, so
// this string is stable across re-renders where ownership genuinely hasn't changed, regardless of
// what order the region ids happen to be visited in.
export const getOwnershipFingerprint = (regions) =>
  Object.values(regions).map((r) => r.owner).join('|');

// Every shared arc between two neighboring provinces whose current owners differ — i.e. the
// national border, redrawn from whatever `regions` says right now rather than a static,
// world-gen-time boundary. `a !== b` excludes the outer boundary of the whole dataset (coastlines),
// where topojson-client's mesh() reports the arc-owning geometry against itself.
export const computeNationalBorderMesh = (topology, object, regions) => {
  const owner = (id) => regions[id]?.owner;
  return mesh(topology, object, (a, b) => a !== b && owner(a.id) !== owner(b.id));
};
