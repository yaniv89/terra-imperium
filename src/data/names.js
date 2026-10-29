// src/data/names.js
// Plan §M3: ruler/dynasty name generation. The full plan calls for 22 UN-subregion-derived
// culture groups built by a data pipeline (scripts/build-culture-groups.mjs) keyed off the same
// npm geo package this project already uses for capitals — that pipeline doesn't exist yet, and
// building it is a real, separate task. This ships 8 broad flavor pools instead, covering the
// nations most players will actually see bordering them or playing as, with every other one of
// the 240 nations falling back to a generic pool — real flavor for the common case, honestly
// approximate for the long tail, rather than either blocking M3 on the full pipeline or faking
// precision the mapping doesn't have.
import { countryOfNation, PEOPLES } from './peoples';

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
// uses (see src/data/peopleNation.js's countriesMeta) to one of the pools above. Anything not
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

// The peoples of the pool (src/data/peoples.js) are ancient: their governors and advisors take
// names of their own culture and time, never the modern pools above (Mycenaeans were named
// Beatriz and Diego, manual playtest 29 Oct). Given names only; the dynasty pools stay legacy.
const ANCIENT_POOLS = {
  aegean: ['Alexandros', 'Nikias', 'Theron', 'Kleon', 'Lykos', 'Damon', 'Hektor', 'Menelaos', 'Helene', 'Ariadne', 'Kassandra', 'Penelope', 'Phaidra'],
  etruscan: ['Larth', 'Arnth', 'Vel', 'Aule', 'Lars', 'Sethre', 'Laris', 'Tanaquil', 'Ramtha', 'Thana', 'Velia', 'Fasti'],
  iberian: ['Viriathus', 'Indibilis', 'Mandonius', 'Arganthonios', 'Caro', 'Retogenes', 'Ambatus', 'Aucia', 'Boutia', 'Camala'],
  celtic: ['Ambiorix', 'Brennus', 'Caratacus', 'Dumnorix', 'Cunobelin', 'Commius', 'Togodumnus', 'Boudica', 'Cartimandua', 'Medb', 'Brigid'],
  germanic: ['Arminius', 'Segestes', 'Maroboduus', 'Hrothgar', 'Ingvar', 'Sigurd', 'Hrolf', 'Thusnelda', 'Gudrun', 'Sigrid', 'Hilda'],
  thracian: ['Burebista', 'Decebalus', 'Sitalkes', 'Seuthes', 'Kotys', 'Teres', 'Dromichaetes', 'Rhesus', 'Zia', 'Bendis'],
  mesopotamian: ['Sargon', 'Rimush', 'Shulgi', 'Zimri-Lim', 'Ishbi-Erra', 'Untash', 'Shutruk', 'Kutik', 'Enheduanna', 'Kubaba', 'Shibtu', 'Puabi'],
  egyptian: ['Ahmose', 'Thutmose', 'Amenhotep', 'Khufu', 'Senusret', 'Nebamun', 'Ramesses', 'Hatshepsut', 'Nefertari', 'Tiye', 'Merit'],
  levantine: ['David', 'Yoav', 'Asa', 'Hiram', 'Niqmaddu', 'Abimelech', 'Ammurapi', 'Deborah', 'Miriam', 'Tamar', 'Baalat'],
  arabian: ['Aretas', 'Malichus', 'Obodas', 'Karibil', 'Yathaamar', 'Hujr', 'Imru', 'Zabibe', 'Samsi', 'Shaqilath', 'Bilqis'],
  anatolian: ['Hattusili', 'Mursili', 'Suppiluliuma', 'Gyges', 'Alyattes', 'Midas', 'Gordias', 'Argishti', 'Sarduri', 'Puduhepa', 'Kubaba'],
  iranian: ['Cyaxares', 'Deioces', 'Arsaces', 'Mithridates', 'Spitamenes', 'Oxyartes', 'Farnbag', 'Roxana', 'Atossa', 'Amytis', 'Rhodogune'],
  steppe: ['Bumin', 'Istemi', 'Tardu', 'Bilge', 'Bayan', 'Tonyukuk', 'Kapgan', 'Bori', 'Ashina', 'Ilbilga', 'Ay'],
  indic: ['Chandragupta', 'Bimbisara', 'Ajatashatru', 'Pradyota', 'Kharavela', 'Satakarni', 'Udayana', 'Devanampiya', 'Prabhavati', 'Gautami', 'Sanghamitta', 'Sumitra'],
  sinic: ['Wu Ding', 'Ji Fa', 'Jiang Shang', 'Xiong Yi', 'Goujian', 'Zhao Tuo', 'Zhuang', 'Fu Hao', 'Bao Si', 'Xi Shi', 'Fu Jing'],
  korean: ['Dangun', 'Jumong', 'Onjo', 'Geunchogo', 'Wiman', 'Haemosu', 'Biryu', 'Yuhwa', 'Soseono', 'Arang'],
  japanese: ['Nashime', 'Aterui', 'More', 'Takeru', 'Ojin', 'Oyamato', 'Himiko', 'Iyo', 'Toyo', 'Jingu'],
  tibetan: ['Songtsen', 'Namri', 'Trisong', 'Ligmigya', 'Nyatri', 'Drigum', 'Tritsun', 'Sadmarkar'],
  seasian: ['Kaundinya', 'Jayavarman', 'Rudravarman', 'Bhadravarman', 'Purnawarman', 'Mulawarman', 'Balaputra', 'Sanjaya', 'Soma', 'Kulaprabhavati', 'Pramodhawardhani'],
  berber: ['Massinissa', 'Jugurtha', 'Syphax', 'Juba', 'Bocchus', 'Micipsa', 'Gulussa', 'Tin Hinan', 'Dihya', 'Sophonisba'],
  west_african: ['Oduduwa', 'Oranmiyan', 'Dinga', 'Kaya Maghan', 'Sumanguru', 'Dugu', 'Hume', 'Moremi', 'Yennenga', 'Amina'],
  nubian: ['Piye', 'Kashta', 'Taharqa', 'Shabaka', 'Arkamani', 'Parehu', 'Wahar', 'Amanirenas', 'Amanishakheto', 'Ati', 'Shanakdakhete'],
  bantu: ['Mutota', 'Matope', 'Ilunga', 'Nkongolo', 'Mbidi', 'Ruhinda', 'Ndahura', 'Wamara', 'Ralambo', 'Rueji', 'Nyabingi'],
  mesoamerican: ['Kinich', 'Yax Nuun', 'Siyaj Kak', 'Jasaw', 'Yikin', 'Cosijoeza', 'Ix Yohl', 'Ix Kabel', 'Ix Wak', 'Pelaxilla', 'Donaji'],
  andean: ['Naymlap', 'Tacaynamo', 'Manco', 'Sinchi', 'Mayta', 'Lloque', 'Nemequene', 'Tisquesusa', 'Ceterni', 'Ocllo', 'Cusi', 'Chimpu'],
  caribbean: ['Caonabo', 'Hatuey', 'Guarionex', 'Bohechio', 'Cunhambebe', 'Aimbere', 'Arariboia', 'Anacaona', 'Higuamota', 'Paraguacu', 'Moema'],
  north_american: ['Koyah', 'Ninstints', 'Skidegate', 'Cumshewa', 'Senquene', 'Popay', 'Tecumseh', 'Wingina', 'Nanyehi', 'Weetamoo', 'Awashonks'],
  pacific: ['Naulivou', 'Isokelekel', 'Olosohpa', 'Taga', 'Quipuha', 'Matapang', 'Hurao', 'Bunjil', 'Tui', 'Adi Kuila']
};
Object.entries(ANCIENT_POOLS).forEach(([group, given]) => { NAME_POOLS[group] = { given, dynasty: [] }; });
// A people reads the ancient group of its modern land; PEOPLE_GROUP corrects the lands that held
// more than one culture.
const LAND_TO_ANCIENT = {
  gr: 'aegean', it: 'etruscan', es: 'iberian', pt: 'iberian', fr: 'celtic', gb: 'celtic', at: 'celtic',
  de: 'germanic', cz: 'germanic', no: 'germanic', se: 'germanic', bg: 'thracian', ro: 'thracian', ua: 'thracian',
  hu: 'steppe', ru: 'iranian', iq: 'mesopotamian', bh: 'mesopotamian', om: 'mesopotamian', ir: 'iranian',
  eg: 'egyptian', il: 'levantine', sy: 'levantine', sa: 'arabian', ye: 'arabian', tr: 'anatolian', ge: 'anatolian',
  az: 'anatolian', tm: 'iranian', uz: 'iranian', kz: 'steppe', kg: 'steppe', mn: 'steppe', cn: 'sinic',
  kp: 'korean', kr: 'korean', jp: 'japanese', in: 'indic', pk: 'indic', lk: 'indic', id: 'seasian', kh: 'seasian',
  th: 'seasian', mm: 'seasian', ph: 'seasian', vn: 'seasian', dz: 'berber', ma: 'berber', ly: 'berber',
  ng: 'west_african', gh: 'west_african', ml: 'west_african', mr: 'west_african', td: 'west_african',
  sd: 'nubian', so: 'nubian', et: 'nubian', tz: 'bantu', ug: 'bantu', zw: 'bantu', za: 'bantu', cd: 'bantu',
  mg: 'bantu', bw: 'bantu', mx: 'mesoamerican', gt: 'mesoamerican', pe: 'andean', bo: 'andean', co: 'andean',
  ar: 'andean', br: 'caribbean', dm: 'caribbean', ht: 'caribbean', us: 'north_american', ca: 'north_american',
  pg: 'pacific', fj: 'pacific', fm: 'pacific', gu: 'pacific', au: 'pacific', al: 'thracian', af: 'iranian', ao: 'bantu'
};
const PEOPLE_GROUP = {
  bosporan_kingdom: 'aegean', cyrene: 'aegean', pontus: 'aegean', khazaria: 'steppe', elam: 'mesopotamian',
  libu: 'berber', khotan: 'iranian', kroraina: 'iranian', zhangzhung: 'tibetan', yarlung: 'tibetan',
  xianbei: 'steppe', buyeo: 'korean', wusun: 'steppe'
};

// The broad group of a nation's modern land; AI doctrines read it too (peopleNation.js), so it stays.
export const getCultureGroup = (nationId) => COUNTRY_TO_GROUP[countryOfNation(nationId)] || 'generic';
/** The name pool a nation's people draw from: a people's own ancient group, else its land's group. */
export const nameGroupOf = (nationId) => (PEOPLES[nationId] && (PEOPLE_GROUP[nationId] || LAND_TO_ANCIENT[countryOfNation(nationId)])) || getCultureGroup(nationId);

const pick = (list, rng) => list[Math.floor(rng.next() * list.length)];

// A ruler's given name plus their dynasty's name — `dynasty` is passed in rather than rolled
// here so a monarchy's next ruler keeps the royal house (see rulers.js), only a fresh line
// (post-civil-war, or the game's very first ruler) rolls a brand new one.
export const generateGivenName = (nationId, rng) => pick(NAME_POOLS[nameGroupOf(nationId)].given, rng);
/** The whole given-name list of a nation's culture group (for a deterministic fallback scan). */
export const givenNamePool = (nationId) => NAME_POOLS[nameGroupOf(nationId)].given;
