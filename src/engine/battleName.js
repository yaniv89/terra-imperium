// src/engine/battleName.js
// The outcome service's name for a battle (plans/MASTER-PLAN.md section 4 "Battles"): the kinds of
// battleOutcome.js mapped onto phase W0's names (battleNames.js): an assault or a defence is
// "Siege of <city>", a field battle "Battle of <place>", a landing "Landing at <city>", a sea
// battle or a fight for the waters "Sea battle off <place>", a rising "Revolt in <city>". Pure.
import { battleName } from './battleNames';

const KIND = { invasion: 'assault', defense: 'assault', assault: 'assault', landing: 'landing', amphibious: 'landing', field: 'field', naval: 'naval', lane: 'naval', intercept: 'naval', suppress: 'rebellion', raid: 'raid', sack: 'sack', sally: 'sally' };

/** The name of a battle. `b`: { kind (an outcome kind), regionId, tile }. Never empty. */
export const battleNameOf = (state, b) => battleName(state, { kind: KIND[b?.kind] || b?.kind || 'assault', targetRegionId: b?.regionId ?? null, tile: b?.tile ?? null });
