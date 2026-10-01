// Shared consequences for player and AI armies whose owner goes bankrupt.
export const DESERTION_SHARE = 0.15;
export const DESERTION_MORALE = 20;
export const DESERTION_DISBAND_BELOW = 50;
export const applyArmyDesertion = (units, ownerId) => {
  let deserted = 0;
  Object.values(units).forEach(u => {
    if (u.ownerId !== ownerId || !units[u.id]) return;
    const strength = Math.floor(u.strength * (1 - DESERTION_SHARE));
    deserted += u.strength - strength;
    if (strength < DESERTION_DISBAND_BELOW) {
      deserted += strength;
      delete units[u.id];
      // Dissolved transports cannot leave dangling cargo references.
      Object.values(units).filter(c => c.embarkedOn === u.id).forEach(c => { deserted += c.strength; delete units[c.id]; });
    } else units[u.id] = {...u,strength,morale:Math.max(0,(u.morale ?? 100)-DESERTION_MORALE)};
  });
  return deserted;
};
