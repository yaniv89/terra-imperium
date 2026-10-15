// src/i18n/locales/msg.en.js
// The engine's message tables (phase H3, src/engine/messages.js), one file per area.
import turn from './msg/turn.en';
import action from './msg/action.en';
import diplo from './msg/diplo.en';
import battle from './msg/battle.en';
import city from './msg/city.en';
import world from './msg/world.en';

export default { ...turn, ...action, ...diplo, ...battle, ...city, ...world };
