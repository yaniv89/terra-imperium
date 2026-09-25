// src/data/names.js
// Plan §M3: ruler/heir/dynasty name generation. The full plan calls for 22 UN-subregion-derived
// culture groups built by a data pipeline (scripts/build-culture-groups.mjs) keyed off the same
// npm geo package this project already uses for capitals — that pipeline doesn't exist yet, and
// building it is a real, separate task. This ships 8 broad flavor pools instead, covering the
// nations most players will actually see bordering them or playing as, with every other one of
// the 240 nations falling back to a generic pool — real flavor for the common case, honestly
// approximate for the long tail, rather than either blocking M3 on the full pipeline or faking
// precision the mapping doesn't have.
const NAME_POOLS = {
  western_european: {
    given: ['William', 'Henry', 'Charles', 'Louis', 'Frederick', 'Edward', 'Robert', 'Philip', 'Albert', 'George', 'Isabella', 'Eleanor', 'Margaret', 'Catherine', 'Anne'],
    dynasty: ['Valois', 'Habsburg', 'Plantagenet', 'Bourbon', 'Orange', 'Hohenzollern', 'Wittelsbach', 'Savoy']
  },
  southern_european: {
    given: ['Alfonso', 'Ferdinand', 'Carlos', 'Manuel', 'Pedro', 'Rodrigo', 'Diego', 'Sancho', 'Isabel', 'Juana', 'Beatriz', 'Constanza', 'Leonor'],
    dynasty: ['Trastamara', 'Braganza', 'Farnese', 'Medici', 'Aviz', 'Grimaldi']
  },
  slavic_eastern_european: {
    given: ['Ivan', 'Vladimir', 'Boris', 'Mikhail', 'Stefan', 'Casimir', 'Vaclav', 'Bogdan', 'Yaroslav', 'Olga', 'Irina', 'Sofia', 'Elena', 'Katarina'],
    dynasty: ['Romanov', 'Piast', 'Jagiellon', 'Rurikid', 'Nemanjic', 'Premyslid']
  },
  mena: {
    given: ['Faisal', 'Hassan', 'Omar', 'Tariq', 'Karim', 'Rashid', 'Malik', 'Yusuf', 'Amina', 'Layla', 'Zahra', 'Nadia', 'Farida'],
    dynasty: ['al-Rashid', 'al-Nasir', 'al-Din', 'Barakat', 'Zaydan', 'al-Sabah']
  },
  east_asian: {
    given: ['Wei', 'Jian', 'Hao', 'Ming', 'Feng', 'Yong', 'Akira', 'Hiroshi', 'Kenji', 'Mei', 'Ling', 'Yuki', 'Hana'],
    dynasty: ['Zhao', 'Li', 'Wang', 'Fujiwara', 'Minamoto', 'Tokugawa']
  },
  south_asian: {
    given: ['Arjun', 'Vikram', 'Raj', 'Ashok', 'Rohan', 'Dev', 'Priya', 'Anika', 'Meera', 'Kavita', 'Divya'],
    dynasty: ['Chauhan', 'Rathore', 'Gupta', 'Chola', 'Maurya']
  },
  sub_saharan_african: {
    given: ['Kwame', 'Kofi', 'Sekou', 'Jelani', 'Obi', 'Tafari', 'Amara', 'Zola', 'Nia', 'Ayana', 'Folami'],
    dynasty: ['Keita', 'Sundiata', 'Askia', 'Mansa', 'Shaka']
  },
  latin_american: {
    given: ['Diego', 'Mateo', 'Santiago', 'Emiliano', 'Rafael', 'Camila', 'Valentina', 'Sofia', 'Lucia', 'Isabela'],
    dynasty: ['Bolivar', 'Iturbide', 'Moctezuma', 'Pizarro', 'de la Vega']
  },
  generic: {
    given: ['Alex', 'Sam', 'Jordan', 'Morgan', 'Riley', 'Casey', 'Avery', 'Quinn', 'Taylor', 'Drew'],
    dynasty: ['Cross', 'Vale', 'Stone', 'Rivers', 'North']
  }
};

// A curated (not exhaustive) map of the country ids this codebase's regions/nations data actually
// uses (see src/data/worldNations.js's countriesMeta) to one of the pools above. Anything not
// listed here falls back to 'generic' in getCultureGroup below.
const COUNTRY_TO_GROUP = {
  fr: 'western_european', de: 'western_european', gb: 'western_european', be: 'western_european',
  nl: 'western_european', lu: 'western_european', at: 'western_european', ch: 'western_european',
  ie: 'western_european', us: 'western_european', ca: 'western_european', au: 'western_european',
  nz: 'western_european',
  es: 'southern_european', it: 'southern_european', pt: 'southern_european', gr: 'southern_european',
  mc: 'southern_european', sm: 'southern_european', va: 'southern_european',
  ru: 'slavic_eastern_european', pl: 'slavic_eastern_european', cz: 'slavic_eastern_european',
  sk: 'slavic_eastern_european', ua: 'slavic_eastern_european', by: 'slavic_eastern_european',
  bg: 'slavic_eastern_european', rs: 'slavic_eastern_european', hr: 'slavic_eastern_european',
  ro: 'slavic_eastern_european', hu: 'slavic_eastern_european',
  eg: 'mena', sa: 'mena', ae: 'mena', iq: 'mena', ir: 'mena', tr: 'mena', sy: 'mena', jo: 'mena',
  lb: 'mena', il: 'mena', ye: 'mena', om: 'mena', qa: 'mena', kw: 'mena', ma: 'mena', dz: 'mena',
  tn: 'mena', ly: 'mena',
  cn: 'east_asian', jp: 'east_asian', kr: 'east_asian', kp: 'east_asian', mn: 'east_asian',
  vn: 'east_asian', tw: 'east_asian',
  in: 'south_asian', pk: 'south_asian', bd: 'south_asian', lk: 'south_asian', np: 'south_asian',
  ng: 'sub_saharan_african', za: 'sub_saharan_african', ke: 'sub_saharan_african',
  et: 'sub_saharan_african', gh: 'sub_saharan_african', ml: 'sub_saharan_african',
  br: 'latin_american', mx: 'latin_american', ar: 'latin_american', co: 'latin_american',
  pe: 'latin_american', cl: 'latin_american', ve: 'latin_american'
};

export const getCultureGroup = (nationId) => COUNTRY_TO_GROUP[nationId] || 'generic';

const pick = (list, rng) => list[Math.floor(rng.next() * list.length)];

// A ruler/heir's given name plus their dynasty's name — `dynasty` is passed in rather than rolled
// here so an heir shares their predecessor's dynasty (see succession.js), only a fresh line
// (post-civil-war, or the game's very first ruler) rolls a brand new one.
export const generateGivenName = (nationId, rng) => pick(NAME_POOLS[getCultureGroup(nationId)].given, rng);
export const generateDynastyName = (nationId, rng) => pick(NAME_POOLS[getCultureGroup(nationId)].dynasty, rng);
