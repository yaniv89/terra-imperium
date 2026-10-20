// src/data/hearths.js
// Agricultural hearths (eight-ages plan U24, R11; plans/eras-origins-and-future.md 3.2): the places
// where farming already exists when the game opens. A people whose first home stands inside one
// starts with Agriculture; everyone else forages until it researches Agriculture (cheaper with every
// known neighbour that has it: techDiffusion.js), and a city with no Agriculture stops growing at
// FORAGE_SIZE_CAP. Areas are latitude and longitude boxes, so they hold on any grid and on the tile
// a generated world gives a people.
import { toLatLon } from './geo/geodesic';

export const AGRICULTURE_TECH = 'economy_agriculture';
export const FORAGE_SIZE_CAP = 3;

export const HEARTHS = [
  { id: 'fertile_crescent', name: 'Fertile Crescent', lat: [29, 38], lon: [34, 48], crops: ['wheat', 'barley', 'sheep', 'goats', 'cattle'] },
  { id: 'nile', name: 'Nile', lat: [22, 31.6], lon: [29, 34], crops: ['emmer', 'barley', 'cattle'] },
  { id: 'yellow_river', name: 'Yellow River', lat: [33, 40], lon: [104, 120], crops: ['millet', 'pigs'] },
  { id: 'yangtze', name: 'Yangtze', lat: [27, 33], lon: [108, 122], crops: ['rice', 'pigs'] },
  { id: 'indus', name: 'Indus', lat: [24, 31], lon: [66, 75], crops: ['wheat', 'barley', 'zebu'] },
  { id: 'mesoamerica', name: 'Mesoamerica', lat: [14, 21], lon: [-100, -88], crops: ['maize', 'squash'] },
  { id: 'andes', name: 'Andes', lat: [-18, -5], lon: [-80, -68], crops: ['potato', 'quinoa', 'llama'] },
  { id: 'new_guinea', name: 'New Guinea', lat: [-8, -3], lon: [140, 148], crops: ['taro', 'banana'] },
  { id: 'sahel', name: 'Sahel', lat: [12, 17], lon: [-10, 10], crops: ['sorghum'] },
  { id: 'ethiopian_highlands', name: 'Ethiopian Highlands', lat: [6, 14], lon: [36, 42], crops: ['teff'] }
];

/** The hearth a point lies in, or null. */
export const hearthAt = ({ lat, lon }) => HEARTHS.find((h) => lat >= h.lat[0] && lat <= h.lat[1] && lon >= h.lon[0] && lon <= h.lon[1]) || null;
/** The hearth a tile's centre lies in, or null. */
export const hearthOfTile = (tiles, tile) => (tile == null ? null : hearthAt(toLatLon(tiles.centres[tile])));

/** The city context of a nation that forages (no Agriculture): its cities stop at FORAGE_SIZE_CAP. */
export const forageCtx = (researched) => (researched.includes(AGRICULTURE_TECH) ? {} : { maxSize: FORAGE_SIZE_CAP });
