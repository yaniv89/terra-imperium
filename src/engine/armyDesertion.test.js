import {it,expect} from 'vitest';
import {applyArmyDesertion} from './armyDesertion';
it('charges the same bankruptcy losses to AI armies and leaves other nations untouched',()=>{
  const units={ai:{id:'ai',ownerId:'de',strength:1000,morale:80},player:{id:'player',ownerId:'fr',strength:1000,morale:80}};
  expect(applyArmyDesertion(units,'de')).toBe(150);
  expect(units.ai.strength).toBe(850);expect(units.ai.morale).toBe(60);
  expect(units.player.strength).toBe(1000);
});
it('does not recreate cargo after its bankrupt transport dissolves',()=>{
  const units={ship:{id:'ship',ownerId:'de',strength:20,morale:100},cargo:{id:'cargo',ownerId:'de',strength:1000,morale:100,embarkedOn:'ship'}};
  expect(applyArmyDesertion(units,'de')).toBe(1020);
  expect(units).toEqual({});
});
