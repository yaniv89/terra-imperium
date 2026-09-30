// src/battle/render/zoomLod.js
// THREE.LOD picks a level by camera → object distance ÷ camera.zoom. Under the battlefield's
// orthographic camera the real distance is a constant (the camera sits 120 tiles back along the
// iso axis) and it pans, so for an army-wide LOD holder at the origin that distance would change as
// you scroll across the map — the wrong signal. ZoomLOD keeps THREE.LOD's API, levels and
// hysteresis but measures an "apparent distance" = baseDistance ÷ zoom: zooming out is walking away.
import { LOD } from 'three';

export class ZoomLOD extends LOD {
  constructor(baseDistance = 120) {
    super();
    this.baseDistance = baseDistance;
    this.type = 'ZoomLOD';
  }

  apparentDistance(camera) { return this.baseDistance / Math.max(1e-6, camera.zoom || 1); }

  update(camera) {
    const levels = this.levels;
    if (levels.length <= 1) return;
    const distance = this.apparentDistance(camera);
    levels[0].object.visible = true;
    let i = 1;
    for (; i < levels.length; i++) {
      let d = levels[i].distance;
      if (levels[i].object.visible) d -= d * levels[i].hysteresis; // stay on a level until clearly past it
      if (distance >= d) { levels[i - 1].object.visible = false; levels[i].object.visible = true; } else break;
    }
    this._currentLevel = i - 1;
    for (; i < levels.length; i++) levels[i].object.visible = false;
  }
}

// Zoom at which soldiers swap to their imposters: the renderer's zoom runs 0.45 (far) … 3 (close),
// 1 at the start. Below ~0.72 a soldier is < ~14 px tall on a phone.
export const IMPOSTER_ZOOM = 0.72;
export const IMPOSTER_DISTANCE = 120 / IMPOSTER_ZOOM;
