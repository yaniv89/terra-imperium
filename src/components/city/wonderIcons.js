// src/components/city/wonderIcons.js
// One lucide glyph per wonder (src/data/greatProjects.js), for the city build list, the province
// card and the Great Projects list. A wonder without an entry falls back to Landmark.
import {
  Triangle, Flower2, Mountain, Library, CircleDot, Lamp, Store, Church, Crown, Orbit, Anchor, Gem, Rocket, Building2, Atom, Landmark, Castle
} from 'lucide-react';

export const WONDER_ICONS = {
  great_pyramids: Triangle, hanging_gardens: Flower2, great_wall: Mountain,
  great_library: Library, colosseum: CircleDot, lighthouse: Lamp,
  grand_bazaar: Store, great_cathedral: Church, forbidden_city: Crown,
  royal_observatory: Orbit, arsenal: Anchor, palace_of_versailles: Gem,
  space_program: Rocket, international_exchange: Building2, atomic_research_center: Atom,
  solomons_temple: Landmark, masada: Castle
};

/** The icon component for a wonder id. */
export const wonderIcon = (projectId) => WONDER_ICONS[projectId] || Landmark;
