// UI explanations for the engine's authoritative attack validation. No separate eligibility rules.
const REASONS = {
  no_moves: 'This army has already moved or attacked. End the turn before attacking again.',
  no_units: 'No available land units here. Units committed to another battle cannot attack.',
  cost: 'Not enough resources to launch this attack.',
  no_war: 'Declare war on this region’s owner before attacking.',
  not_your_region: 'The attack must start from a region you own.',
  bad_target: 'This region cannot be attacked.',
  already_held: 'Your army already holds this region.',
  not_adjacent: 'The target must share a land border with the attacking army.',
  bad_fleet: 'Select one of your fleets to launch a landing.',
  not_coastal: 'Amphibious assaults require a coastal region.',
  out_of_reach: 'This coast is outside the fleet’s current reach.'
};

export const describeAttackBlock = validation => validation.ok ? null
  : REASONS[validation.reason] || 'This attack is currently unavailable.';
