// src/battle/render/tokenFactory.js
// Zero-art-pipeline 3D pieces (Tactical Battles plan §15.2): every unit silhouette we already ship
// (game-icons.net, src/data/unitIcons.js) is extruded at runtime into a small standing token, like
// a board-game miniature — measured at ~100–720 triangles each, so hundreds of soldiers stay cheap.
import { ExtrudeGeometry } from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { getUnitIconPath } from '../../data/unitIcons';

const cache = new Map();

const shapesFromPath = (d) => new SVGLoader()
  .parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`)
  .paths.flatMap((p) => p.toShapes());

// 1 world unit tall, standing on y = 0, centred on x, facing +z; extruded 0.12 deep.
export const getTokenGeometry = (key, pathData) => {
  if (cache.has(key)) return cache.get(key);
  const geo = new ExtrudeGeometry(shapesFromPath(pathData), { depth: 60, bevelEnabled: false, curveSegments: 2 });
  geo.scale(1 / 512, -1 / 512, 1 / 512); // SVG is y-down
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
};

export const getUnitTokenGeometry = (ageId, classId) => {
  const d = getUnitIconPath(ageId, classId) || getUnitIconPath('bronze', classId) || getUnitIconPath('bronze', 'infantry');
  return getTokenGeometry(`unit:${ageId}:${classId}`, d);
};

export const disposeTokenCache = () => { cache.forEach((g) => g.dispose()); cache.clear(); };
