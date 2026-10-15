// src/i18n/locales/data.he.js
// The Hebrew side of the game data (phase H4): one table keyed by data ids (tech.<id>,
// law.<id>.desc, sig.<peopleId> ...). The English data in src/data stays the source; English is
// never copied here, so a key missing in this table shows the data's own English (see dataText in core.js).
import systems from './data/he.systems';
import world from './data/he.world';
import events from './data/he.events';
import units from './data/he.units';
import tiles from './data/he.tiles';

export default Object.freeze({ ...systems, ...world, ...events, ...units, ...tiles });
