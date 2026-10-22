// src/engine/robots.js
// Robot armies (eight ages plan U67, R20, KTD17). After Autonomous Warfare a Future city can build
// any class as its robot variant (unitClasses.js ROBOT_VARIANTS); the unit carries `robot: true`
// and keeps its class, so every system that reads the class still works. What a robot changes:
//   manpower    none to build (RECRUIT_UNIT drops the hr cost, no levy on the province) and none to
//               refill (resolveTurn's reinforcement draws no hr for it)
//   price       ROBOT_PRODUCTION_MULT x the unit's production cost (world/cities.js productionCost)
//               and the age's rare metals (economy.js getRecruitUnitCost, as every Future recruit)
//   battle      power 72 / 54 (unitAgeWeight), no morale lost to hits or shocks (promotions.js
//               getPromotionMoraleLossMultiplier, sim/morale.js), so it never routs or turns Shaken
//   occupation  robots do not count as a garrison, and a conquered city (CONQUERED_TURNS) held by
//               robots with no human unit on its centre loses ROBOT_OCCUPATION_LOYALTY a turn
//               (loyalty.js): a robot army needs a human unit to hold what it takes
// Ripples: manpower (the player's hr pool), production queues, battle results (Command and Auto),
// city loyalty and flips, the AI's army mix (aiProduction.js keeps humans beside robots, U72).
import { isRobotUnlocked } from '../data/unitClasses';

export const ROBOT_PRODUCTION_MULT = 1.4;
export const ROBOT_OCCUPATION_LOYALTY = 2;

export const isRobot = (unit) => !!unit?.robot;

/** A recruit's cost for a robot: the same cost with no manpower. */
export const robotRecruitCost = (costs) => {
  const rest = { ...costs };
  delete rest.hr;
  return rest;
};

/** Is the city's centre held by robots only (at least one robot, no human unit)? */
export const robotsOnlyHold = (units) => units.length > 0 && units.every(isRobot);

/** Can a nation at `ageId` knowing `researched` queue `item` as a robot? (true for any non-robot item) */
export const canBuildRobot = (item, ageId, researched) => !item?.robot || isRobotUnlocked(ageId, item.classId, researched);
