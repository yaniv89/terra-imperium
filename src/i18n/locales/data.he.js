// src/i18n/locales/data.he.js
// The Hebrew side of the game data (phase H4): one table keyed by data ids (tech.<id>,
// law.<id>.desc, sig.<peopleId> ...). The English data in src/data stays the source; English is
// never copied here, so a key missing in this table shows the data's own English (see dataText in core.js).
import systems from './data/he.systems';
import world from './data/he.world';
import events from './data/he.events';
import units from './data/he.units';
import tiles from './data/he.tiles';
import battle from './data/he.battle';
import city from './data/he.city';
import pnl1 from './data/he.pnl1';
import pnl2 from './data/he.pnl2';
import mapx from './data/he.mapx';
import misc2 from './data/he.misc2';
import ambitions from './data/he.ambitions';
import ruler from './data/he.ruler';
import deck from './data/he.deck';
import crises from './data/he.crises';

export default Object.freeze({ ...systems, ...world, ...events, ...units, ...tiles, ...battle, ...city, ...pnl1, ...pnl2, ...mapx, ...misc2, ...ambitions, ...ruler, ...deck, ...crises });
