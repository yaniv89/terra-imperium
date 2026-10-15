// src/i18n/locales/msg.he.js
// The engine's message tables (phase H3, src/engine/messages.js), one file per area.
import turn from './msg/turn.he';
import action from './msg/action.he';
import diplo from './msg/diplo.he';
import battle from './msg/battle.he';
import city from './msg/city.he';
import world from './msg/world.he';

export default { ...turn, ...action, ...diplo, ...battle, ...city, ...world };
