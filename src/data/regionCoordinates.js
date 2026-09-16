// src/data/regionCoordinates.js
// Real-world lat/lng for each of the game's 28 hand-authored regions (src/data/regions.js) —
// approximate coordinates of each region's principal city/area. Used to place combat effects
// (GlobeEffectsOverlay) and to fly the camera to a region on selection.
export const REGION_COORDINATES = {
  tel_aviv: { lat: 32.0853, lng: 34.7818 },
  jerusalem: { lat: 31.7683, lng: 35.2137 },
  haifa: { lat: 32.7940, lng: 34.9896 },
  galilee: { lat: 32.9234, lng: 35.2954 },
  negev: { lat: 30.9013, lng: 34.8113 },
  gaza: { lat: 31.5017, lng: 34.4668 },
  west_bank: { lat: 31.9522, lng: 35.2332 },
  golan: { lat: 33.0043, lng: 35.7856 },
  egypt_sinai: { lat: 29.3086, lng: 33.9243 },
  egypt_cairo: { lat: 30.0444, lng: 31.2357 },
  jordan_amman: { lat: 31.9454, lng: 35.9284 },
  syria_damascus: { lat: 33.5138, lng: 36.2765 },
  lebanon_south: { lat: 33.2704, lng: 35.2038 },
  lebanon_north: { lat: 33.8938, lng: 35.5018 },
  iraq_baghdad: { lat: 33.3152, lng: 44.3661 },
  iraq_basra: { lat: 30.5085, lng: 47.7835 },
  saudi_north: { lat: 29.9697, lng: 40.2064 },
  saudi_south: { lat: 24.7136, lng: 46.6753 },
  iran_west: { lat: 34.3277, lng: 47.0778 },
  iran_east: { lat: 35.6892, lng: 51.3890 },
  turkey_west: { lat: 38.4237, lng: 27.1428 },
  turkey_east: { lat: 39.9334, lng: 32.8597 },
  yemen: { lat: 15.3694, lng: 44.1910 },
  oman: { lat: 23.5880, lng: 58.3829 },
  uae: { lat: 24.4539, lng: 54.3773 },
  qatar: { lat: 25.2854, lng: 51.5310 },
  bahrain: { lat: 26.0667, lng: 50.5577 },
  kuwait: { lat: 29.3759, lng: 47.9774 }
};
