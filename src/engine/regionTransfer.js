// src/engine/regionTransfer.js
// One shared "this province changes hands" step for the paths that move a region outside a war's
// own conquest code: a successful revolt, Settle/Colonize, and the returnRegion/captureRegions event
// effects. Each used to hand-roll the owner swap, and each got a different subset wrong — none
// cleared a lingering foreign `occupiedBy`, captureRegions never set `formerOwner`, and a revolt or
// returnRegion happily handed land to a nation already flagged isEliminated (a zombie owner that
// never acts again).
//
// Pure: returns the next region record plus, when the new owner was a dead nation, its revived
// record (the caller writes both back in its own mutation style — resolveTurn.js mutates drafts,
// the reducer/event code spreads).
import { getFormerOwnerOnConquest } from '../data/rebellion';

export const transferRegion = (region, newOwnerId, nations, overrides = {}) => {
  // eslint-disable-next-line no-unused-vars -- destructured only to drop any occupation marker
  const { occupiedBy, conquest, ...rest } = region;
  const nextRegion = {
    ...rest,
    owner: newOwnerId,
    formerOwner: getFormerOwnerOnConquest(region.id, region.owner, newOwnerId),
    underInvasion: false,
    ...overrides
  };
  const heir = nations?.[newOwnerId];
  // A dead nation reclaiming land rises again — a real liberation, not a zombie owner.
  const revivedNation = heir?.isEliminated
    ? { ...heir, isEliminated: false, isAtWar: false, capitalRegionId: region.id }
    : null;
  return { region: nextRegion, revivedNation };
};
