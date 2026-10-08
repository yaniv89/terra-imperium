// src/data/signatureUnits.js
// Signature units (user decision 2026-10-06; plans/ART-MODELS-PLAN.md 4.5, 4.5a, 4.6): each of the
// 150 peoples has ONE signature unit in ONE age (its historical peak). In that age it replaces the
// people's base unit of the same role, which may be ANY base role: infantry, ranged, the mobile
// role (cavalry, chariots, camels, elephants, and the Modern tank), siege (Modern artillery),
// support, air or naval. In every other age the people fields the ordinary base units.
// Its model is src/assets/units/signature/<model>.glb (the roster's id, optional <model>.json beside
// it with the base units' bake options, src/assets/units/README.md); without the file the base
// unit stands. Rules (stats, costs) are the later "SU" phase: until then it fights with the base
// unit's rules, so this table only says which model to draw.
//   { [peopleId]: { ageId, classId, model, rig, name } }
// roles: the roster's inf = infantry, rng = ranged, mob = cavalry (the mobile role), sig = siege.
// rig: person | horse | camel | elephant | chariot-light | chariot-heavy | ox | tank | frame (the
// mounted rigs bake with the four-legged trot, the rest without).
// Seeded from the roster of plans/ART-MODELS-PLAN.md 4.5 (checked 2026-10-06); no files yet.
export const SIGNATURE_UNITS = Object.freeze({
  israel: { ageId: 'modern', classId: 'cavalry', model: 'kingdom-of-israel', rig: 'tank', name: 'Merkava main battle tank' },
  ugarit: { ageId: 'bronze', classId: 'cavalry', model: 'ugarit', rig: 'chariot-light', name: 'Ugaritic maryannu chariot crews' },
  mari: { ageId: 'bronze', classId: 'infantry', model: 'mari', rig: 'person', name: 'Mari spear guard' },
  akkad: { ageId: 'bronze', classId: 'infantry', model: 'akkad', rig: 'person', name: 'Sharur-bearing spearmen' },
  elam: { ageId: 'bronze', classId: 'ranged', model: 'elam', rig: 'person', name: 'Elamite archers' },
  media: { ageId: 'classical', classId: 'cavalry', model: 'media', rig: 'horse', name: 'Median horse archers' },
  kanesh: { ageId: 'bronze', classId: 'infantry', model: 'kanesh', rig: 'person', name: 'Old Assyrian karum caravan guards (improvised)' },
  lydia: { ageId: 'classical', classId: 'cavalry', model: 'lydia', rig: 'horse', name: 'Lydian lance cavalry' },
  phrygia: { ageId: 'bronze', classId: 'ranged', model: 'phrygia', rig: 'person', name: 'Phrygian peltasts' },
  pontus: { ageId: 'classical', classId: 'cavalry', model: 'pontus', rig: 'chariot-light', name: 'Pontic scythed chariot' },
  urartu: { ageId: 'bronze', classId: 'infantry', model: 'urartu', rig: 'person', name: 'Urartian fortress spearmen' },
  colchis: { ageId: 'bronze', classId: 'infantry', model: 'colchis', rig: 'person', name: 'Colchian oxhide-shield spearmen' },
  aghvank: { ageId: 'classical', classId: 'ranged', model: 'aghvank', rig: 'person', name: 'Aghvank skin-helmed javelin and bow troops' },
  saba: { ageId: 'classical', classId: 'ranged', model: 'saba', rig: 'camel', name: 'Sabaean camel archers' },
  kindah: { ageId: 'modern', classId: 'infantry', model: 'kindah', rig: 'camel', name: 'Arab Revolt camel riflemen' },
  magan: { ageId: 'bronze', classId: 'infantry', model: 'magan', rig: 'person', name: 'Maganite copper-spear guards (improvised)' },
  dilmun: { ageId: 'bronze', classId: 'ranged', model: 'dilmun', rig: 'person', name: 'Dilmun copper-spear guards (improvised)' },
  qedar: { ageId: 'classical', classId: 'cavalry', model: 'qedar', rig: 'camel', name: 'Qedarite camel raiders' },
  nabataea: { ageId: 'classical', classId: 'ranged', model: 'nabataea', rig: 'person', name: 'Nabataean cliff archers' },
  kemet: { ageId: 'bronze', classId: 'cavalry', model: 'kemet', rig: 'chariot-light', name: 'Chariot archers' },
  kerma: { ageId: 'bronze', classId: 'ranged', model: 'kerma', rig: 'person', name: 'Kerma long-bow archers' },
  alodia: { ageId: 'kingdoms', classId: 'cavalry', model: 'alodia', rig: 'horse', name: 'Alodian quilted-armour spear cavalry (improvised)' },
  libu: { ageId: 'bronze', classId: 'infantry', model: 'libu', rig: 'person', name: 'Libu feather-cloaked javelinmen' },
  cyrene: { ageId: 'classical', classId: 'cavalry', model: 'cyrene', rig: 'horse', name: 'Cyrenaean horse javelineers (improvised)' },
  garamantes: { ageId: 'bronze', classId: 'cavalry', model: 'garamantes', rig: 'chariot-light', name: 'Garamantian war chariot' },
  numidia: { ageId: 'classical', classId: 'cavalry', model: 'numidia', rig: 'horse', name: 'Numidian javelin riders' },
  mauretania: { ageId: 'classical', classId: 'infantry', model: 'mauretania', rig: 'person', name: 'Mauri javelin skirmishers (improvised)' },
  keftiu: { ageId: 'bronze', classId: 'infantry', model: 'keftiu', rig: 'person', name: 'Minoan figure-eight-shield spearmen' },
  ahhiyawa: { ageId: 'bronze', classId: 'infantry', model: 'ahhiyawa', rig: 'person', name: 'Mycenaean boar-tusk helmet spearmen' },
  odrysia: { ageId: 'gunpowder', classId: 'ranged', model: 'odrysia', rig: 'person', name: 'Haiduk musketeers' },
  illyria: { ageId: 'modern', classId: 'ranged', model: 'illyria', rig: 'person', name: 'Albanian Kachak riflemen' },
  dacia: { ageId: 'modern', classId: 'infantry', model: 'dacia', rig: 'person', name: 'Romanian mountain troops' },
  rasenna: { ageId: 'classical', classId: 'infantry', model: 'rasenna', rig: 'person', name: 'Rasenna hoplite phalanx' },
  nuragi: { ageId: 'modern', classId: 'infantry', model: 'nuragi', rig: 'person', name: 'Brigata Sassari infantry' },
  tartessos: { ageId: 'bronze', classId: 'infantry', model: 'tartessos', rig: 'person', name: 'Tartessian horned-helmet warriors' },
  celtiberia: { ageId: 'gunpowder', classId: 'ranged', model: 'celtiberia', rig: 'person', name: 'Spanish guerrilleros' },
  lusitania: { ageId: 'gunpowder', classId: 'ranged', model: 'lusitania', rig: 'person', name: 'Portuguese cacadores' },
  arverni: { ageId: 'classical', classId: 'cavalry', model: 'arverni', rig: 'horse', name: 'Arverni Gaulish noble horsemen' },
  belgae: { ageId: 'classical', classId: 'infantry', model: 'belgae', rig: 'person', name: 'Belgic noble swordsmen' },
  noricum: { ageId: 'modern', classId: 'infantry', model: 'noricum', rig: 'person', name: 'Kaiserschuetzen mountain riflemen' },
  marcomannia: { ageId: 'modern', classId: 'cavalry', model: 'marcomannia', rig: 'tank', name: 'Czechoslovak LT vz. 38 light tank' },
  cherusci: { ageId: 'classical', classId: 'infantry', model: 'cherusci', rig: 'person', name: 'Cherusci forest ambushers' },
  durotriges: { ageId: 'classical', classId: 'ranged', model: 'durotriges', rig: 'person', name: 'Durotrigan hillfort slingers' },
  brigantes: { ageId: 'classical', classId: 'cavalry', model: 'brigantes', rig: 'chariot-light', name: 'Brigantian chariot skirmishers' },
  ulaid: { ageId: 'gunpowder', classId: 'infantry', model: 'ulaid', rig: 'person', name: 'United Irishmen pikemen (1798)' },
  fortriu: { ageId: 'gunpowder', classId: 'infantry', model: 'fortriu', rig: 'person', name: 'Highland broadsword clansmen' },
  geats: { ageId: 'gunpowder', classId: 'infantry', model: 'geats', rig: 'person', name: 'Carolean pike-and-shot infantry' },
  rygir: { ageId: 'modern', classId: 'infantry', model: 'rygir', rig: 'person', name: 'Norwegian ski infantry' },
  bosporan_kingdom: { ageId: 'classical', classId: 'siege', model: 'bosporan-kingdom', rig: 'frame', name: 'Bosporan stone-thrower crews (improvised)' },
  cucuteni: { ageId: 'bronze', classId: 'infantry', model: 'cucuteni', rig: 'person', name: 'Cucuteni copper-axe warriors' },
  avaria: { ageId: 'gunpowder', classId: 'cavalry', model: 'avaria', rig: 'horse', name: 'Hungarian hussars' },
  khazaria: { ageId: 'kingdoms', classId: 'cavalry', model: 'khazaria', rig: 'horse', name: 'Khazar heavy horse archers' },
  sarmatians: { ageId: 'gunpowder', classId: 'cavalry', model: 'sarmatians', rig: 'horse', name: 'Winged hussars' },
  oxus: { ageId: 'bronze', classId: 'cavalry', model: 'oxus', rig: 'chariot-light', name: 'Oxus cart-borne spearmen (improvised)' },
  parthava: { ageId: 'classical', classId: 'cavalry', model: 'parthava', rig: 'horse', name: 'Parthian horse archers' },
  bactria: { ageId: 'classical', classId: 'cavalry', model: 'bactria', rig: 'horse', name: 'Bactrian armoured cavalry' },
  sogdia: { ageId: 'kingdoms', classId: 'cavalry', model: 'sogdia', rig: 'horse', name: 'Sogdian armoured horsemen (Panjikent murals)' },
  khwarazm: { ageId: 'kingdoms', classId: 'cavalry', model: 'khwarazm', rig: 'horse', name: 'Khwarazmian Kipchak horse archers' },
  wusun: { ageId: 'classical', classId: 'cavalry', model: 'wusun', rig: 'horse', name: 'Wusun horse archers' },
  andronovo: { ageId: 'bronze', classId: 'cavalry', model: 'andronovo', rig: 'chariot-light', name: 'Andronovo spoke-wheel charioteers' },
  botai: { ageId: 'bronze', classId: 'infantry', model: 'botai', rig: 'person', name: 'Botai horse-corral hunters (improvised)' },
  gokturk: { ageId: 'kingdoms', classId: 'cavalry', model: 'gokturk', rig: 'horse', name: 'Gokturk lamellar horse archers' },
  xianbei: { ageId: 'classical', classId: 'cavalry', model: 'xianbei', rig: 'horse', name: 'Xianbei armoured lancers' },
  kroraina: { ageId: 'classical', classId: 'ranged', model: 'kroraina', rig: 'person', name: 'Kroraina oasis archers (improvised)' },
  khotan: { ageId: 'kingdoms', classId: 'infantry', model: 'khotan', rig: 'person', name: 'Khotan oasis garrison spearmen (improvised)' },
  zhangzhung: { ageId: 'kingdoms', classId: 'infantry', model: 'zhangzhung', rig: 'person', name: 'Zhangzhung highland spearmen (improvised)' },
  yarlung: { ageId: 'kingdoms', classId: 'cavalry', model: 'yarlung', rig: 'horse', name: 'Yarlung lamellar lancers' },
  meluhha: { ageId: 'bronze', classId: 'ranged', model: 'meluhha', rig: 'person', name: 'Meluhhan bowmen (improvised)' },
  gandhara: { ageId: 'gunpowder', classId: 'ranged', model: 'gandhara', rig: 'person', name: 'Pashtun jezail riflemen' },
  saurashtra: { ageId: 'bronze', classId: 'infantry', model: 'saurashtra', rig: 'person', name: 'Saurashtran sea-trader guards (improvised)' },
  kuru: { ageId: 'bronze', classId: 'cavalry', model: 'kuru', rig: 'chariot-light', name: 'Kuru chariot-warriors' },
  kosala: { ageId: 'classical', classId: 'ranged', model: 'kosala', rig: 'person', name: 'Kosalan foot archers' },
  magadha: { ageId: 'classical', classId: 'cavalry', model: 'magadha', rig: 'elephant', name: 'Magadhan war elephants' },
  avanti: { ageId: 'classical', classId: 'cavalry', model: 'avanti', rig: 'horse', name: 'Avanti heavy cavalry (improvised)' },
  kalinga: { ageId: 'classical', classId: 'cavalry', model: 'kalinga', rig: 'elephant', name: 'Kalingan elephant corps' },
  satavahana: { ageId: 'classical', classId: 'cavalry', model: 'satavahana', rig: 'horse', name: 'Satavahana horsemen (improvised)' },
  pandya: { ageId: 'kingdoms', classId: 'infantry', model: 'pandya', rig: 'person', name: 'Pandyan swordsmen (improvised)' },
  rajarata: { ageId: 'kingdoms', classId: 'infantry', model: 'rajarata', rig: 'person', name: 'Rajaratan spearmen (improvised)' },
  kamarupa: { ageId: 'kingdoms', classId: 'cavalry', model: 'kamarupa', rig: 'elephant', name: 'Kamarupan war elephants' },
  vanga: { ageId: 'kingdoms', classId: 'ranged', model: 'vanga', rig: 'person', name: 'Vangan delta boat archers (improvised)' },
  shang: { ageId: 'bronze', classId: 'infantry', model: 'shang', rig: 'person', name: 'Shang dagger-axe warriors' },
  zhou: { ageId: 'bronze', classId: 'cavalry', model: 'zhou', rig: 'chariot-heavy', name: 'Zhou chariot lords' },
  chu: { ageId: 'classical', classId: 'infantry', model: 'chu', rig: 'person', name: 'Chu halberdiers' },
  shu: { ageId: 'bronze', classId: 'infantry', model: 'shu', rig: 'person', name: 'Shu spearmen of Sanxingdui (improvised)' },
  qi: { ageId: 'classical', classId: 'ranged', model: 'qi', rig: 'person', name: 'Qi crossbowmen of Maling' },
  yue: { ageId: 'classical', classId: 'infantry', model: 'yue', rig: 'person', name: 'Yue sword-masters' },
  dian: { ageId: 'classical', classId: 'cavalry', model: 'dian', rig: 'horse', name: 'Dian mounted swordsmen' },
  nanyue: { ageId: 'classical', classId: 'ranged', model: 'nanyue', rig: 'person', name: 'Nanyue crossbowmen (improvised)' },
  buyeo: { ageId: 'classical', classId: 'cavalry', model: 'buyeo', rig: 'horse', name: 'Buyeo mounted spearmen (improvised)' },
  gojoseon: { ageId: 'bronze', classId: 'infantry', model: 'gojoseon', rig: 'person', name: 'Gojoseon mandolin-dagger warriors' },
  baekje: { ageId: 'kingdoms', classId: 'cavalry', model: 'baekje', rig: 'horse', name: 'Baekje armoured cavalry' },
  yamatai: { ageId: 'classical', classId: 'ranged', model: 'yamatai', rig: 'person', name: 'Yamataian bowmen' },
  emishi: { ageId: 'kingdoms', classId: 'cavalry', model: 'emishi', rig: 'horse', name: 'Emishi horse archers' },
  van_lang: { ageId: 'bronze', classId: 'ranged', model: 'van-lang', rig: 'person', name: 'Van Lang bronze-drum archers' },
  champa: { ageId: 'kingdoms', classId: 'cavalry', model: 'champa', rig: 'elephant', name: 'Cham elephant lancers' },
  funan: { ageId: 'kingdoms', classId: 'ranged', model: 'funan', rig: 'person', name: 'Funan marine archers (improvised)' },
  pyu: { ageId: 'kingdoms', classId: 'infantry', model: 'pyu', rig: 'person', name: 'Pyu city-guard spearmen (improvised)' },
  dvaravati: { ageId: 'kingdoms', classId: 'infantry', model: 'dvaravati', rig: 'person', name: 'Dvaravati sword-and-spear infantry' },
  srivijaya: { ageId: 'kingdoms', classId: 'infantry', model: 'srivijaya', rig: 'person', name: 'Srivijayan orang laut sea warriors' },
  tarumanagara: { ageId: 'kingdoms', classId: 'infantry', model: 'tarumanagara', rig: 'person', name: 'Tarumanagara spear warriors (improvised)' },
  medang: { ageId: 'gunpowder', classId: 'infantry', model: 'medang', rig: 'person', name: 'Mataram kris infantry' },
  kutai: { ageId: 'gunpowder', classId: 'ranged', model: 'kutai', rig: 'person', name: 'Kutai sumpitan skirmishers' },
  butuan: { ageId: 'kingdoms', classId: 'infantry', model: 'butuan', rig: 'person', name: 'Butuan gold-ornament swordsmen' },
  tondo: { ageId: 'gunpowder', classId: 'siege', model: 'tondo', rig: 'frame', name: 'Tondo lantaka gun crews' },
  tichitt: { ageId: 'bronze', classId: 'ranged', model: 'tichitt', rig: 'person', name: 'Tichitt stone-village archers (improvised)' },
  wagadu: { ageId: 'kingdoms', classId: 'cavalry', model: 'wagadu', rig: 'horse', name: 'Wagadu iron-spear cavalry' },
  djenne_djeno: { ageId: 'kingdoms', classId: 'infantry', model: 'djenne-djeno', rig: 'person', name: 'Djenne-Djeno spearmen (improvised)' },
  kanem: { ageId: 'gunpowder', classId: 'cavalry', model: 'kanem', rig: 'horse', name: 'Bornu mailed horsemen' },
  nok: { ageId: 'classical', classId: 'infantry', model: 'nok', rig: 'person', name: 'Nok heavily armed warriors (improvised)' },
  ife: { ageId: 'kingdoms', classId: 'infantry', model: 'ife', rig: 'person', name: 'Ife beaded-crown spearmen (improvised)' },
  bono: { ageId: 'gunpowder', classId: 'ranged', model: 'bono', rig: 'person', name: 'Akan musketeers' },
  d_mt: { ageId: 'modern', classId: 'infantry', model: 'd-mt', rig: 'person', name: 'Ethiopian rifle infantry' },
  punt: { ageId: 'bronze', classId: 'ranged', model: 'punt', rig: 'person', name: 'Puntite dagger guards (improvised)' },
  ajuran: { ageId: 'gunpowder', classId: 'cavalry', model: 'ajuran', rig: 'horse', name: 'Ajuran matchlock horsemen' },
  kilwa: { ageId: 'gunpowder', classId: 'ranged', model: 'kilwa', rig: 'person', name: 'Kilwa mainland archers (1505)' },
  kitara: { ageId: 'kingdoms', classId: 'infantry', model: 'kitara', rig: 'ox', name: 'Kitaran longhorn cattle guards (improvised)' },
  engaruka: { ageId: 'kingdoms', classId: 'infantry', model: 'engaruka', rig: 'person', name: 'Engaruka terrace spearmen (improvised)' },
  luba: { ageId: 'gunpowder', classId: 'ranged', model: 'luba', rig: 'person', name: 'Luba bow-and-shield warriors (improvised)' },
  lunda: { ageId: 'gunpowder', classId: 'infantry', model: 'lunda', rig: 'person', name: 'Lunda musket-and-axe warriors (improvised)' },
  ndongo: { ageId: 'gunpowder', classId: 'ranged', model: 'ndongo', rig: 'person', name: 'Ndongo musket-and-axe guard' },
  mapungubwe: { ageId: 'kingdoms', classId: 'ranged', model: 'mapungubwe', rig: 'person', name: 'Mapungubwe gold-rhino archers (improvised)' },
  mutapa: { ageId: 'gunpowder', classId: 'infantry', model: 'mutapa', rig: 'person', name: 'Mutapa battle-axe and shield warriors' },
  merina: { ageId: 'gunpowder', classId: 'ranged', model: 'merina', rig: 'person', name: 'Merina musket highlanders' },
  khoekhoe: { ageId: 'gunpowder', classId: 'cavalry', model: 'khoekhoe', rig: 'ox', name: 'Khoekhoe ox riders' },
  san: { ageId: 'kingdoms', classId: 'ranged', model: 'san', rig: 'person', name: 'San poison-arrow hunters' },
  caral: { ageId: 'bronze', classId: 'ranged', model: 'caral', rig: 'person', name: 'Caral temple-city guards (improvised)' },
  moche: { ageId: 'kingdoms', classId: 'infantry', model: 'moche', rig: 'person', name: 'Moche warrior-priest clubmen' },
  wari: { ageId: 'kingdoms', classId: 'infantry', model: 'wari', rig: 'person', name: 'Wari mace-and-dart warriors' },
  tiwanaku: { ageId: 'kingdoms', classId: 'infantry', model: 'tiwanaku', rig: 'person', name: 'Tiwanaku spear-thrower warriors (improvised)' },
  diaguita: { ageId: 'gunpowder', classId: 'ranged', model: 'diaguita', rig: 'person', name: 'Calchaqui valley warriors' },
  muisca: { ageId: 'gunpowder', classId: 'infantry', model: 'muisca', rig: 'person', name: 'Muisca gold-adorned spearmen' },
  marajoara: { ageId: 'kingdoms', classId: 'ranged', model: 'marajoara', rig: 'person', name: 'Marajoara fortress archers (improvised)' },
  tupinamba: { ageId: 'gunpowder', classId: 'ranged', model: 'tupinamba', rig: 'person', name: 'Tupinamba feather-cloak archers' },
  jaragua: { ageId: 'gunpowder', classId: 'infantry', model: 'jaragua', rig: 'person', name: 'Taino cotton-armour spearmen (improvised)' },
  kalinago: { ageId: 'gunpowder', classId: 'infantry', model: 'kalinago', rig: 'person', name: 'Kalinago canoe raiders' },
  teotihuacan: { ageId: 'classical', classId: 'ranged', model: 'teotihuacan', rig: 'person', name: 'Teotihuacan atlatl warriors' },
  zapotec: { ageId: 'classical', classId: 'infantry', model: 'zapotec', rig: 'person', name: 'Zapotec obsidian-spear warriors' },
  mutal: { ageId: 'kingdoms', classId: 'infantry', model: 'mutal', rig: 'person', name: 'Mutal spear-and-shield lords' },
  hopewell: { ageId: 'classical', classId: 'infantry', model: 'hopewell', rig: 'person', name: 'Hopewell copper-ornament warriors (improvised)' },
  hohokam: { ageId: 'kingdoms', classId: 'ranged', model: 'hohokam', rig: 'person', name: 'Hohokam shell-and-bow archers' },
  chaco: { ageId: 'kingdoms', classId: 'ranged', model: 'chaco', rig: 'person', name: 'Chacoan great-house bowmen (improvised)' },
  calusa: { ageId: 'gunpowder', classId: 'infantry', model: 'calusa', rig: 'person', name: 'Calusa shell-spear warriors' },
  haida: { ageId: 'gunpowder', classId: 'ranged', model: 'haida', rig: 'person', name: 'Haida plank-armour musketeers' },
  dorset: { ageId: 'modern', classId: 'ranged', model: 'dorset', rig: 'person', name: 'Canadian Ranger riflemen' },
  lapita: { ageId: 'bronze', classId: 'infantry', model: 'lapita', rig: 'person', name: 'Lapita canoe spearmen (improvised)' },
  wahgi: { ageId: 'bronze', classId: 'ranged', model: 'wahgi', rig: 'person', name: 'Wahgi bamboo-arrow archers' },
  gunditjmara: { ageId: 'gunpowder', classId: 'ranged', model: 'gunditjmara', rig: 'person', name: 'Gunditjmara spear-and-boomerang men' },
  saudeleur: { ageId: 'kingdoms', classId: 'infantry', model: 'saudeleur', rig: 'person', name: 'Saudeleur basalt-city spearmen (improvised)' },
  latte_chiefs: { ageId: 'gunpowder', classId: 'ranged', model: 'latte-chiefs', rig: 'person', name: 'Latte chief slingers' },
  bau: { ageId: 'gunpowder', classId: 'infantry', model: 'bau', rig: 'person', name: 'Bau war-club warriors' }
});

/** Rigs whose figure is carried by four legs (the battle shader's trot). */
export const QUADRUPED_RIGS = ['horse', 'camel', 'elephant', 'chariot-light', 'chariot-heavy', 'ox'];

/** Rigs drawn with fewer, full-size figures than the role's squad. Drawing only: the squad's
 * strength, HP and combat numbers stay the role's. War elephants: two beasts a squad, side by side,
 * `spacing` battle tiles apart (BattleRenderer squadLook). */
export const RIG_FIGURES = Object.freeze({ elephant: Object.freeze({ figures: 2, spacing: 2.1 }) });
/** How a signature unit's squad is drawn when its rig says so ({ figures, spacing }), else null. */
export const rigFiguresOf = (entry) => (entry ? RIG_FIGURES[entry.rig] || null : null);

/** The people's signature unit when it is this age and role, else null. */
export const signatureUnitFor = (peopleId, ageId, classId, table = SIGNATURE_UNITS) => {
  const e = peopleId ? table[peopleId] : null;
  return e && e.ageId === ageId && e.classId === classId ? e : null;
};

/** The soldier layer key a signature unit draws under (beside the base `classId`). */
export const signatureKey = (classId, peopleId) => `${classId}~${peopleId}`;
/** The base class of a soldier layer key ('infantry~mari' -> 'infantry'). */
export const baseClassOf = (key) => String(key).split('~')[0];
