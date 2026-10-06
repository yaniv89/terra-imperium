// src/data/peoples.js
// The peoples pool (plans/peoples-and-world-setup.md section 4, phase W0): 150 ancient peoples
// with new names, none copied from Civilization, that make up the nations of a new game. A world
// draws its major nations from this pool (src/engine/worldgen/peoplesWorld.js); the legacy
// 240-country world (src/data/worldNations.js) stays for old saves and for the engine's tests.
//
// Each entry: `id` (the slug that becomes the nation id), `name` (as the picker shows it),
// `adjective` (hand-written: logs, titles, unit names), `capital` (real name and approximate
// lat/lon; scripts/peoples/build-peoples.mjs snaps it to a tile), `land` (the modern country,
// ISO code: "in modern Iraq" and the culture-group lookups), `theme` (art theme: palaces and theme
// units, src/data/architecture.js), `weight` (A: cradles and great powers, B, C: how likely the
// picker makes it a major), `region`, `arrives` (late arrivals only: the year the land was
// settled; never drawn as a major), `pinned` (the Kingdom of Israel: always in the world,
// roadmap decision 13, with no other advantage).
// Built facts (capital tile, colour, the legacy id table) come from src/data/geo/peopleCapitals.json
// (npm run build:peoples). City names: src/data/peopleCities.json (20 a people, capital first).
import CITY_NAMES from './peopleCities.json';
import BUILT from './geo/peopleCapitals.json';
import countriesMeta from './geo/countries-meta.json';

const RAW = [
  { id: 'israel', name: 'Israel', adjective: 'Israelite', capital: { name: 'Jerusalem', lat: 31.78, lon: 35.23 }, land: 'il', theme: 'israelite', weight: 'A', region: 'neareast', pinned: true },
  { id: 'ugarit', name: 'Ugarit', adjective: 'Ugaritic', capital: { name: 'Ugarit', lat: 35.6, lon: 35.78 }, land: 'sy', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'mari', name: 'Mari', adjective: 'Mariote', capital: { name: 'Mari', lat: 34.55, lon: 40.89 }, land: 'sy', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'akkad', name: 'Akkad', adjective: 'Akkadian', capital: { name: 'Kish', lat: 32.54, lon: 44.6 }, land: 'iq', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'elam', name: 'Elam', adjective: 'Elamite', capital: { name: 'Anshan', lat: 29.98, lon: 52.4 }, land: 'ir', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'media', name: 'Media', adjective: 'Median', capital: { name: 'Hagmatana', lat: 34.8, lon: 48.52 }, land: 'ir', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'kanesh', name: 'Kanesh', adjective: 'Kaneshite', capital: { name: 'Kanesh', lat: 38.85, lon: 35.63 }, land: 'tr', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'lydia', name: 'Lydia', adjective: 'Lydian', capital: { name: 'Sardis', lat: 38.49, lon: 28.04 }, land: 'tr', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'phrygia', name: 'Phrygia', adjective: 'Phrygian', capital: { name: 'Gordion', lat: 39.65, lon: 31.98 }, land: 'tr', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'pontus', name: 'Pontus', adjective: 'Pontic', capital: { name: 'Sinope', lat: 42.02, lon: 35.15 }, land: 'tr', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'urartu', name: 'Urartu', adjective: 'Urartian', capital: { name: 'Tushpa', lat: 38.5, lon: 43.34 }, land: 'tr', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'colchis', name: 'Colchis', adjective: 'Colchian', capital: { name: 'Phasis', lat: 42.15, lon: 41.67 }, land: 'ge', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'aghvank', name: 'Aghvank', adjective: 'Aghvan', capital: { name: 'Kabalak', lat: 40.98, lon: 47.85 }, land: 'az', theme: 'levant', weight: 'C', region: 'neareast' },
  { id: 'saba', name: 'Saba', adjective: 'Sabaean', capital: { name: 'Maryab', lat: 15.42, lon: 45.33 }, land: 'ye', theme: 'levant', weight: 'A', region: 'neareast' },
  { id: 'kindah', name: 'Kindah', adjective: 'Kindite', capital: { name: 'Qaryat al-Faw', lat: 19.78, lon: 45.15 }, land: 'sa', theme: 'levant', weight: 'C', region: 'neareast' },
  { id: 'magan', name: 'Magan', adjective: 'Maganite', capital: { name: 'Bat', lat: 23.27, lon: 56.75 }, land: 'om', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'dilmun', name: 'Dilmun', adjective: 'Dilmunite', capital: { name: "Qal'at al-Bahrain", lat: 26.23, lon: 50.52 }, land: 'bh', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'qedar', name: 'Qedar', adjective: 'Qedarite', capital: { name: 'Adumattu', lat: 29.81, lon: 39.87 }, land: 'sa', theme: 'levant', weight: 'C', region: 'neareast' },
  { id: 'nabataea', name: 'Nabataea', adjective: 'Nabataean', capital: { name: 'Hegra', lat: 26.79, lon: 37.95 }, land: 'sa', theme: 'levant', weight: 'B', region: 'neareast' },
  { id: 'kemet', name: 'Kemet', adjective: 'Kemetic', capital: { name: 'Men-nefer', lat: 29.85, lon: 31.25 }, land: 'eg', theme: 'nile', weight: 'A', region: 'northafrica' },
  { id: 'kerma', name: 'Kerma', adjective: 'Kerman', capital: { name: 'Kerma', lat: 19.6, lon: 30.41 }, land: 'sd', theme: 'nile', weight: 'A', region: 'northafrica' },
  { id: 'alodia', name: 'Alodia', adjective: 'Alodian', capital: { name: 'Soba', lat: 15.52, lon: 32.68 }, land: 'sd', theme: 'nile', weight: 'C', region: 'northafrica' },
  { id: 'libu', name: 'The Libu', adjective: 'Libu', capital: { name: 'Siwa', lat: 29.2, lon: 25.52 }, land: 'eg', theme: 'nile', weight: 'C', region: 'northafrica' },
  { id: 'cyrene', name: 'Cyrene', adjective: 'Cyrenaic', capital: { name: 'Cyrene', lat: 32.82, lon: 21.86 }, land: 'ly', theme: 'maghreb', weight: 'B', region: 'northafrica' },
  { id: 'garamantes', name: 'Garamantes', adjective: 'Garamantian', capital: { name: 'Garama', lat: 26.55, lon: 13.07 }, land: 'ly', theme: 'maghreb', weight: 'B', region: 'northafrica' },
  { id: 'numidia', name: 'Numidia', adjective: 'Numidian', capital: { name: 'Cirta', lat: 36.37, lon: 6.61 }, land: 'dz', theme: 'maghreb', weight: 'A', region: 'northafrica' },
  { id: 'mauretania', name: 'Mauretania', adjective: 'Mauretanian', capital: { name: 'Volubilis', lat: 34.07, lon: -5.55 }, land: 'ma', theme: 'maghreb', weight: 'B', region: 'northafrica' },
  { id: 'keftiu', name: 'Keftiu', adjective: 'Keftian', capital: { name: 'Knossos', lat: 35.3, lon: 25.16 }, land: 'gr', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'ahhiyawa', name: 'Ahhiyawa', adjective: 'Ahhiyawan', capital: { name: 'Mycenae', lat: 37.73, lon: 22.76 }, land: 'gr', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'odrysia', name: 'Odrysia', adjective: 'Odrysian', capital: { name: 'Seuthopolis', lat: 42.62, lon: 25.4 }, land: 'bg', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'illyria', name: 'Illyria', adjective: 'Illyrian', capital: { name: 'Scodra', lat: 42.07, lon: 19.51 }, land: 'al', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'dacia', name: 'Dacia', adjective: 'Dacian', capital: { name: 'Sarmizegetusa', lat: 45.62, lon: 23.31 }, land: 'ro', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'rasenna', name: 'Rasenna', adjective: 'Rasennan', capital: { name: 'Velzna', lat: 42.72, lon: 12.11 }, land: 'it', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'nuragi', name: 'The Nuragi', adjective: 'Nuragic', capital: { name: 'Barumini', lat: 39.7, lon: 8.99 }, land: 'it', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'tartessos', name: 'Tartessos', adjective: 'Tartessian', capital: { name: 'Tartessos', lat: 37.26, lon: -6.95 }, land: 'es', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'celtiberia', name: 'Celtiberia', adjective: 'Celtiberian', capital: { name: 'Numantia', lat: 41.81, lon: -2.44 }, land: 'es', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'lusitania', name: 'Lusitania', adjective: 'Lusitanian', capital: { name: 'Conimbriga', lat: 40.1, lon: -8.49 }, land: 'pt', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'arverni', name: 'Arverni', adjective: 'Arvernian', capital: { name: 'Gergovia', lat: 45.71, lon: 3.12 }, land: 'fr', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'belgae', name: 'Belgae', adjective: 'Belgic', capital: { name: 'Durocortorum', lat: 49.25, lon: 4.03 }, land: 'fr', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'noricum', name: 'Noricum', adjective: 'Norican', capital: { name: 'Noreia', lat: 47, lon: 14.4 }, land: 'at', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'marcomannia', name: 'Marcomannia', adjective: 'Marcomannic', capital: { name: 'Marobudum', lat: 50, lon: 14.4 }, land: 'cz', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'cherusci', name: 'Cherusci', adjective: 'Cheruscan', capital: { name: 'Tulifurdum', lat: 52, lon: 9 }, land: 'de', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'durotriges', name: 'Durotriges', adjective: 'Durotrigan', capital: { name: 'Maiden Castle', lat: 50.7, lon: -2.47 }, land: 'gb', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'brigantes', name: 'Brigantes', adjective: 'Brigantian', capital: { name: 'Stanwick', lat: 54.5, lon: -1.73 }, land: 'gb', theme: 'europe', weight: 'A', region: 'europe' },
  { id: 'ulaid', name: 'Ulaid', adjective: 'Ulaid', capital: { name: 'Emain Macha', lat: 54.35, lon: -6.7 }, land: 'gb', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'fortriu', name: 'Fortriu', adjective: 'Verturian', capital: { name: 'Burghead', lat: 57.7, lon: -3.49 }, land: 'gb', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'geats', name: 'Geats', adjective: 'Geatish', capital: { name: 'Skara', lat: 58.39, lon: 13.44 }, land: 'se', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'rygir', name: 'Rygir', adjective: 'Rygian', capital: { name: 'Avaldsnes', lat: 59.35, lon: 5.27 }, land: 'no', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'bosporan_kingdom', name: 'Bosporan Kingdom', adjective: 'Bosporan', capital: { name: 'Panticapaeum', lat: 45.35, lon: 36.47 }, land: 'ua', theme: 'europe', weight: 'B', region: 'europe' },
  { id: 'cucuteni', name: 'Cucuteni', adjective: 'Cucutenian', capital: { name: 'Talianki', lat: 48.8, lon: 30.47 }, land: 'ua', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'avaria', name: 'Avaria', adjective: 'Avar', capital: { name: 'Hring', lat: 47, lon: 19.5 }, land: 'hu', theme: 'europe', weight: 'C', region: 'europe' },
  { id: 'khazaria', name: 'Khazaria', adjective: 'Khazar', capital: { name: 'Atil', lat: 46.4, lon: 47.9 }, land: 'ru', theme: 'steppe', weight: 'B', region: 'europe' },
  { id: 'sarmatians', name: 'The Sarmatians', adjective: 'Sarmatian', capital: { name: 'Uspe', lat: 50, lon: 44 }, land: 'ru', theme: 'steppe', weight: 'C', region: 'europe' },
  { id: 'oxus', name: 'Oxus', adjective: 'Oxus', capital: { name: 'Gonur', lat: 37.55, lon: 62.18 }, land: 'tm', theme: 'steppe', weight: 'A', region: 'centralasia' },
  { id: 'parthava', name: 'Parthava', adjective: 'Parthian', capital: { name: 'Nisa', lat: 37.95, lon: 58.21 }, land: 'tm', theme: 'steppe', weight: 'B', region: 'centralasia' },
  { id: 'bactria', name: 'Bactria', adjective: 'Bactrian', capital: { name: 'Bactra', lat: 36.76, lon: 66.9 }, land: 'af', theme: 'steppe', weight: 'A', region: 'centralasia' },
  { id: 'sogdia', name: 'Sogdia', adjective: 'Sogdian', capital: { name: 'Marakanda', lat: 39.65, lon: 66.98 }, land: 'uz', theme: 'steppe', weight: 'A', region: 'centralasia' },
  { id: 'khwarazm', name: 'Khwarazm', adjective: 'Khwarazmian', capital: { name: 'Kath', lat: 41.38, lon: 60.99 }, land: 'uz', theme: 'steppe', weight: 'B', region: 'centralasia' },
  { id: 'wusun', name: 'Wusun', adjective: 'Wusun', capital: { name: 'Chigu', lat: 42.4, lon: 77.5 }, land: 'kg', theme: 'steppe', weight: 'B', region: 'centralasia' },
  { id: 'andronovo', name: 'The Andronovo', adjective: 'Andronovo', capital: { name: 'Arkaim', lat: 52.65, lon: 59.57 }, land: 'ru', theme: 'steppe', weight: 'C', region: 'centralasia' },
  { id: 'botai', name: 'Botai', adjective: 'Botai', capital: { name: 'Botai', lat: 53.27, lon: 67.85 }, land: 'kz', theme: 'steppe', weight: 'C', region: 'centralasia' },
  { id: 'gokturk', name: 'Gokturk', adjective: 'Gokturk', capital: { name: 'Ötüken', lat: 47.5, lon: 101.5 }, land: 'mn', theme: 'steppe', weight: 'A', region: 'centralasia' },
  { id: 'xianbei', name: 'Xianbei', adjective: 'Xianbei', capital: { name: 'Xilin Gol', lat: 44, lon: 116 }, land: 'cn', theme: 'steppe', weight: 'C', region: 'centralasia' },
  { id: 'kroraina', name: 'Kroraina', adjective: 'Krorainan', capital: { name: 'Loulan', lat: 40.52, lon: 89.92 }, land: 'cn', theme: 'steppe', weight: 'C', region: 'centralasia' },
  { id: 'khotan', name: 'Khotan', adjective: 'Khotanese', capital: { name: 'Yotkan', lat: 37.07, lon: 79.87 }, land: 'cn', theme: 'steppe', weight: 'C', region: 'centralasia' },
  { id: 'zhangzhung', name: 'Zhangzhung', adjective: 'Zhangzhung', capital: { name: 'Khyunglung', lat: 31.1, lon: 81.2 }, land: 'cn', theme: 'steppe', weight: 'B', region: 'centralasia' },
  { id: 'yarlung', name: 'Yarlung', adjective: 'Yarlung', capital: { name: 'Yumbulagang', lat: 29.03, lon: 91.77 }, land: 'cn', theme: 'steppe', weight: 'B', region: 'centralasia' },
  { id: 'meluhha', name: 'Meluhha', adjective: 'Meluhhan', capital: { name: 'Harappa', lat: 30.63, lon: 72.87 }, land: 'pk', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'gandhara', name: 'Gandhara', adjective: 'Gandharan', capital: { name: 'Takshashila', lat: 33.75, lon: 72.82 }, land: 'pk', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'saurashtra', name: 'Saurashtra', adjective: 'Saurashtran', capital: { name: 'Lothal', lat: 22.52, lon: 72.25 }, land: 'in', theme: 'indic', weight: 'C', region: 'southasia' },
  { id: 'kuru', name: 'Kuru', adjective: 'Kuru', capital: { name: 'Hastinapura', lat: 29.16, lon: 78.01 }, land: 'in', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'kosala', name: 'Kosala', adjective: 'Kosalan', capital: { name: 'Shravasti', lat: 27.51, lon: 82.05 }, land: 'in', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'magadha', name: 'Magadha', adjective: 'Magadhan', capital: { name: 'Rajagriha', lat: 25.03, lon: 85.42 }, land: 'in', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'avanti', name: 'Avanti', adjective: 'Avantian', capital: { name: 'Ujjayini', lat: 23.18, lon: 75.78 }, land: 'in', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'kalinga', name: 'Kalinga', adjective: 'Kalingan', capital: { name: 'Tosali', lat: 20.2, lon: 85.82 }, land: 'in', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'satavahana', name: 'Satavahana', adjective: 'Satavahana', capital: { name: 'Pratishthana', lat: 19.48, lon: 75.38 }, land: 'in', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'pandya', name: 'Pandya', adjective: 'Pandyan', capital: { name: 'Madurai', lat: 9.93, lon: 78.12 }, land: 'in', theme: 'indic', weight: 'A', region: 'southasia' },
  { id: 'rajarata', name: 'Rajarata', adjective: 'Rajaratan', capital: { name: 'Anuradhapura', lat: 8.31, lon: 80.4 }, land: 'lk', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'kamarupa', name: 'Kamarupa', adjective: 'Kamarupan', capital: { name: 'Pragjyotishpura', lat: 26.15, lon: 91.74 }, land: 'in', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'vanga', name: 'Vanga', adjective: 'Vangan', capital: { name: 'Chandraketugarh', lat: 22.7, lon: 88.69 }, land: 'in', theme: 'indic', weight: 'B', region: 'southasia' },
  { id: 'shang', name: 'Shang', adjective: 'Shang', capital: { name: 'Yin', lat: 36.12, lon: 114.31 }, land: 'cn', theme: 'sinic', weight: 'A', region: 'eastasia' },
  { id: 'zhou', name: 'Zhou', adjective: 'Zhou', capital: { name: 'Haojing', lat: 34.23, lon: 108.77 }, land: 'cn', theme: 'sinic', weight: 'A', region: 'eastasia' },
  { id: 'chu', name: 'Chu', adjective: 'Chu', capital: { name: 'Ying', lat: 30.35, lon: 112.19 }, land: 'cn', theme: 'sinic', weight: 'A', region: 'eastasia' },
  { id: 'shu', name: 'Shu', adjective: 'Shu', capital: { name: 'Sanxingdui', lat: 30.99, lon: 104.2 }, land: 'cn', theme: 'sinic', weight: 'A', region: 'eastasia' },
  { id: 'qi', name: 'Qi', adjective: 'Qi', capital: { name: 'Linzi', lat: 36.85, lon: 118.33 }, land: 'cn', theme: 'sinic', weight: 'A', region: 'eastasia' },
  { id: 'yue', name: 'Yue', adjective: 'Yue', capital: { name: 'Kuaiji', lat: 30, lon: 120.58 }, land: 'cn', theme: 'sinic', weight: 'B', region: 'eastasia' },
  { id: 'dian', name: 'Dian', adjective: 'Dian', capital: { name: 'Jinning', lat: 24.67, lon: 102.6 }, land: 'cn', theme: 'sinic', weight: 'B', region: 'eastasia' },
  { id: 'nanyue', name: 'Nanyue', adjective: 'Nanyue', capital: { name: 'Panyu', lat: 23.13, lon: 113.26 }, land: 'cn', theme: 'sinic', weight: 'B', region: 'eastasia' },
  { id: 'buyeo', name: 'Buyeo', adjective: 'Buyeo', capital: { name: 'Buyeo', lat: 43.83, lon: 126.55 }, land: 'cn', theme: 'korea', weight: 'B', region: 'eastasia' },
  { id: 'gojoseon', name: 'Gojoseon', adjective: 'Gojoseon', capital: { name: 'Wanggeom-seong', lat: 39.02, lon: 125.75 }, land: 'kp', theme: 'korea', weight: 'A', region: 'eastasia' },
  { id: 'baekje', name: 'Baekje', adjective: 'Baekje', capital: { name: 'Ungjin', lat: 36.46, lon: 127.12 }, land: 'kr', theme: 'korea', weight: 'A', region: 'eastasia' },
  { id: 'yamatai', name: 'Yamatai', adjective: 'Yamatai', capital: { name: 'Makimuku', lat: 34.55, lon: 135.85 }, land: 'jp', theme: 'japan', weight: 'A', region: 'eastasia' },
  { id: 'emishi', name: 'Emishi', adjective: 'Emishi', capital: { name: 'Isawa', lat: 39.14, lon: 141.14 }, land: 'jp', theme: 'japan', weight: 'C', region: 'eastasia' },
  { id: 'van_lang', name: 'Van Lang', adjective: 'Lac Viet', capital: { name: 'Phong Chau', lat: 21.32, lon: 105.4 }, land: 'vn', theme: 'monsoon', weight: 'A', region: 'southeastasia' },
  { id: 'champa', name: 'Champa', adjective: 'Cham', capital: { name: 'Simhapura', lat: 15.85, lon: 108.25 }, land: 'vn', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'funan', name: 'Funan', adjective: 'Funanese', capital: { name: 'Vyadhapura', lat: 11.1, lon: 105 }, land: 'kh', theme: 'monsoon', weight: 'A', region: 'southeastasia' },
  { id: 'pyu', name: 'Pyu', adjective: 'Pyu', capital: { name: 'Sri Ksetra', lat: 18.8, lon: 95.29 }, land: 'mm', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'dvaravati', name: 'Dvaravati', adjective: 'Dvaravati', capital: { name: 'Nakhon Pathom', lat: 13.82, lon: 100.06 }, land: 'th', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'srivijaya', name: 'Srivijaya', adjective: 'Srivijayan', capital: { name: 'Palembang', lat: -2.99, lon: 104.76 }, land: 'id', theme: 'monsoon', weight: 'A', region: 'southeastasia' },
  { id: 'tarumanagara', name: 'Tarumanagara', adjective: 'Taruma', capital: { name: 'Sundapura', lat: -6.2, lon: 106.85 }, land: 'id', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'medang', name: 'Medang', adjective: 'Medang', capital: { name: 'Mataram', lat: -7.6, lon: 110.2 }, land: 'id', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'kutai', name: 'Kutai', adjective: 'Kutai', capital: { name: 'Muara Kaman', lat: -0.2, lon: 116.9 }, land: 'id', theme: 'monsoon', weight: 'C', region: 'southeastasia' },
  { id: 'butuan', name: 'Butuan', adjective: 'Butuanon', capital: { name: 'Butuan', lat: 8.95, lon: 125.54 }, land: 'ph', theme: 'monsoon', weight: 'B', region: 'southeastasia' },
  { id: 'tondo', name: 'Tondo', adjective: 'Tondo', capital: { name: 'Tondo', lat: 14.61, lon: 120.97 }, land: 'ph', theme: 'monsoon', weight: 'C', region: 'southeastasia' },
  { id: 'tichitt', name: 'Tichitt', adjective: 'Tichitt', capital: { name: 'Dhar Tichitt', lat: 18.44, lon: -9.5 }, land: 'mr', theme: 'maghreb', weight: 'B', region: 'africa' },
  { id: 'wagadu', name: 'Wagadu', adjective: 'Soninke', capital: { name: 'Koumbi Saleh', lat: 15.67, lon: -7.99 }, land: 'mr', theme: 'maghreb', weight: 'A', region: 'africa' },
  { id: 'djenne_djeno', name: 'Djenné-Djeno', adjective: 'Djenne', capital: { name: 'Djenné-Djeno', lat: 13.89, lon: -4.56 }, land: 'ml', theme: 'maghreb', weight: 'B', region: 'africa' },
  { id: 'kanem', name: 'Kanem', adjective: 'Kanembu', capital: { name: 'Njimi', lat: 14.5, lon: 14.5 }, land: 'td', theme: 'maghreb', weight: 'A', region: 'africa' },
  { id: 'nok', name: 'Nok', adjective: 'Nok', capital: { name: 'Nok', lat: 9.5, lon: 8 }, land: 'ng', theme: 'westafrica', weight: 'A', region: 'africa' },
  { id: 'ife', name: 'Ife', adjective: 'Ife', capital: { name: 'Ile-Ife', lat: 7.48, lon: 4.56 }, land: 'ng', theme: 'westafrica', weight: 'B', region: 'africa' },
  { id: 'bono', name: 'Bono', adjective: 'Bono', capital: { name: 'Bono Manso', lat: 7.9, lon: -1.98 }, land: 'gh', theme: 'westafrica', weight: 'B', region: 'africa' },
  { id: 'd_mt', name: "D'mt", adjective: "D'mt", capital: { name: 'Yeha', lat: 14.29, lon: 39.02 }, land: 'et', theme: 'nile', weight: 'A', region: 'africa' },
  { id: 'punt', name: 'Punt', adjective: 'Puntite', capital: { name: 'Opone', lat: 10.42, lon: 51.27 }, land: 'so', theme: 'nile', weight: 'B', region: 'africa' },
  { id: 'ajuran', name: 'Ajuran', adjective: 'Ajuran', capital: { name: 'Merca', lat: 1.71, lon: 44.77 }, land: 'so', theme: 'eastafrica', weight: 'B', region: 'africa' },
  { id: 'kilwa', name: 'Kilwa', adjective: 'Kilwan', capital: { name: 'Kilwa Kisiwani', lat: -8.96, lon: 39.51 }, land: 'tz', theme: 'eastafrica', weight: 'B', region: 'africa' },
  { id: 'kitara', name: 'Kitara', adjective: 'Kitaran', capital: { name: 'Bigo', lat: 0.4, lon: 31.4 }, land: 'ug', theme: 'eastafrica', weight: 'B', region: 'africa' },
  { id: 'engaruka', name: 'Engaruka', adjective: 'Engaruka', capital: { name: 'Engaruka', lat: -3, lon: 35.97 }, land: 'tz', theme: 'eastafrica', weight: 'C', region: 'africa' },
  { id: 'luba', name: 'Luba', adjective: 'Luba', capital: { name: 'Kabongo', lat: -7.33, lon: 25.58 }, land: 'cd', theme: 'westafrica', weight: 'B', region: 'africa' },
  { id: 'lunda', name: 'Lunda', adjective: 'Lunda', capital: { name: 'Musumba', lat: -8.55, lon: 22.85 }, land: 'cd', theme: 'westafrica', weight: 'B', region: 'africa' },
  { id: 'ndongo', name: 'Ndongo', adjective: 'Ndongo', capital: { name: 'Kabasa', lat: -9.3, lon: 14.9 }, land: 'ao', theme: 'westafrica', weight: 'B', region: 'africa' },
  { id: 'mapungubwe', name: 'Mapungubwe', adjective: 'Mapungubwe', capital: { name: 'Mapungubwe Hill', lat: -22.19, lon: 29.38 }, land: 'za', theme: 'eastafrica', weight: 'A', region: 'africa' },
  { id: 'mutapa', name: 'Mutapa', adjective: 'Mutapa', capital: { name: 'Zvongombe', lat: -16.4, lon: 31.3 }, land: 'zw', theme: 'eastafrica', weight: 'B', region: 'africa' },
  { id: 'merina', name: 'Merina', adjective: 'Merina', capital: { name: 'Ambohimanga', lat: -18.76, lon: 47.56 }, land: 'mg', theme: 'eastafrica', weight: 'B', region: 'africa', arrives: 500 },
  { id: 'khoekhoe', name: 'The Khoekhoe', adjective: 'Khoekhoe', capital: { name: 'Camissa', lat: -33.9, lon: 18.6 }, land: 'za', theme: 'eastafrica', weight: 'C', region: 'africa' },
  { id: 'san', name: 'The San', adjective: 'San', capital: { name: 'Tsodilo', lat: -18.75, lon: 21.73 }, land: 'bw', theme: 'eastafrica', weight: 'C', region: 'africa' },
  { id: 'caral', name: 'Caral', adjective: 'Caral', capital: { name: 'Caral', lat: -10.89, lon: -77.52 }, land: 'pe', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'moche', name: 'Moche', adjective: 'Moche', capital: { name: 'Huaca del Sol', lat: -8.13, lon: -78.99 }, land: 'pe', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'wari', name: 'Wari', adjective: 'Wari', capital: { name: 'Huari', lat: -13.06, lon: -74.17 }, land: 'pe', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'tiwanaku', name: 'Tiwanaku', adjective: 'Tiwanaku', capital: { name: 'Tiwanaku', lat: -16.55, lon: -68.67 }, land: 'bo', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'diaguita', name: 'Diaguita', adjective: 'Diaguita', capital: { name: 'Calchaquí', lat: -25.5, lon: -66 }, land: 'ar', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'muisca', name: 'Muisca', adjective: 'Muisca', capital: { name: 'Bacatá', lat: 4.71, lon: -74.07 }, land: 'co', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'marajoara', name: 'Marajoara', adjective: 'Marajoara', capital: { name: 'Marajó', lat: -0.9, lon: -49.6 }, land: 'br', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'tupinamba', name: 'Tupinambá', adjective: 'Tupinamba', capital: { name: 'Guanabara', lat: -22.9, lon: -43.2 }, land: 'br', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'jaragua', name: 'Jaragua', adjective: 'Jaragua', capital: { name: 'Jaragua', lat: 18.5, lon: -72.8 }, land: 'ht', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'kalinago', name: 'Kalinago', adjective: 'Kalinago', capital: { name: 'Waitukubuli', lat: 15.41, lon: -61.37 }, land: 'dm', theme: 'americas', weight: 'C', region: 'americas', arrives: 1200 },
  { id: 'teotihuacan', name: 'Teotihuacan', adjective: 'Teotihuacano', capital: { name: 'Teotihuacan', lat: 19.69, lon: -98.84 }, land: 'mx', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'zapotec', name: 'Zapotec', adjective: 'Zapotec', capital: { name: 'Monte Albán', lat: 17.04, lon: -96.77 }, land: 'mx', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'mutal', name: 'Mutal', adjective: 'Mutal', capital: { name: 'Mutal', lat: 17.22, lon: -89.62 }, land: 'gt', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'hopewell', name: 'Hopewell', adjective: 'Hopewell', capital: { name: 'Chillicothe', lat: 39.33, lon: -82.98 }, land: 'us', theme: 'americas', weight: 'A', region: 'americas' },
  { id: 'hohokam', name: 'Hohokam', adjective: 'Hohokam', capital: { name: 'Snaketown', lat: 33.18, lon: -111.92 }, land: 'us', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'chaco', name: 'Chaco', adjective: 'Chacoan', capital: { name: 'Pueblo Bonito', lat: 36.06, lon: -107.96 }, land: 'us', theme: 'americas', weight: 'B', region: 'americas' },
  { id: 'calusa', name: 'Calusa', adjective: 'Calusa', capital: { name: 'Calos', lat: 26.42, lon: -81.86 }, land: 'us', theme: 'americas', weight: 'C', region: 'americas' },
  { id: 'haida', name: 'Haida', adjective: 'Haida', capital: { name: 'Kiusta', lat: 54.2, lon: -130.1 }, land: 'ca', theme: 'americas', weight: 'C', region: 'americas' },
  { id: 'dorset', name: 'Dorset', adjective: 'Dorset', capital: { name: 'Igloolik', lat: 69.37, lon: -81.8 }, land: 'ca', theme: 'americas', weight: 'C', region: 'americas', arrives: -500 },
  { id: 'lapita', name: 'Lapita', adjective: 'Lapita', capital: { name: 'Talepakemalai', lat: -1.6, lon: 149.7 }, land: 'pg', theme: 'pacific', weight: 'B', region: 'oceania', arrives: -1600 },
  { id: 'wahgi', name: 'The Wahgi', adjective: 'Wahgi', capital: { name: 'Kuk', lat: -5.78, lon: 144.33 }, land: 'pg', theme: 'pacific', weight: 'C', region: 'oceania' },
  { id: 'gunditjmara', name: 'Gunditjmara', adjective: 'Gunditjmara', capital: { name: 'Budj Bim', lat: -38.07, lon: 141.92 }, land: 'au', theme: 'monsoon', weight: 'C', region: 'oceania' },
  { id: 'saudeleur', name: 'Saudeleur', adjective: 'Saudeleur', capital: { name: 'Pohnpei', lat: 6.84, lon: 158.33 }, land: 'fm', theme: 'pacific', weight: 'C', region: 'oceania', arrives: 1100 },
  { id: 'latte_chiefs', name: 'The Latte chiefs', adjective: 'Latte', capital: { name: 'Guåhan', lat: 13.44, lon: 144.79 }, land: 'gu', theme: 'pacific', weight: 'C', region: 'oceania', arrives: 800 },
  { id: 'bau', name: 'Bau', adjective: 'Bauan', capital: { name: 'Bau', lat: -17.99, lon: 178.62 }, land: 'fj', theme: 'pacific', weight: 'C', region: 'oceania', arrives: -1000 }
];

// Title stems: the word a title is built around when the picker's name does not read well inside
// one ("Kingdom of Israel", not "Kingdom of Kingdom of Israel"). Default: the name, with a
// leading "The" lowered ("Kingdom of the Nuragi").
const STEMS = { israel: 'Israel', bosporan_kingdom: 'Bosporus' };
const PICKER_NAMES = { israel: 'Kingdom of Israel' };
// Fixed titles by government for the peoples whose own name is already a title. The Kingdom of
// Israel keeps its full name (plans/peoples-and-world-setup.md 4.5) until it changes government.
const TITLE_OVERRIDES = {
  israel: { tribal: 'Kingdom of Israel', monarchy: 'Kingdom of Israel' },
  bosporan_kingdom: { monarchy: 'the Bosporan Kingdom' }
};

export const PEOPLE_WEIGHTS = { A: 3, B: 1.5, C: 1 };

// The pool's ten regions and the picker's six filter groups (section 3.3).
export const PEOPLE_REGIONS = {
  neareast: { name: 'Near East', group: 'neareast' },
  northafrica: { name: 'Nile and North Africa', group: 'africa' },
  europe: { name: 'Europe', group: 'europe' },
  centralasia: { name: 'Central Asia and the steppe', group: 'asia' },
  southasia: { name: 'South Asia', group: 'asia' },
  eastasia: { name: 'East Asia', group: 'asia' },
  southeastasia: { name: 'Southeast Asia', group: 'asia' },
  africa: { name: 'Africa south of the Sahara', group: 'africa' },
  americas: { name: 'The Americas', group: 'americas' },
  oceania: { name: 'Oceania', group: 'oceania' }
};
export const PEOPLE_REGION_GROUPS = [
  { id: 'neareast', name: 'Near East' },
  { id: 'europe', name: 'Europe' },
  { id: 'africa', name: 'Africa' },
  { id: 'asia', name: 'Asia' },
  { id: 'americas', name: 'Americas' },
  { id: 'oceania', name: 'Oceania' }
];

const stemOf = (p) => STEMS[p.id] || (p.name.startsWith('The ') ? `the ${p.name.slice(4)}` : p.name);

export const PEOPLES_LIST = Object.freeze(RAW.map((p) => Object.freeze({
  ...p,
  name: PICKER_NAMES[p.id] || p.name,
  stem: stemOf(p),
  plural: p.name.startsWith('The '),
  weightValue: PEOPLE_WEIGHTS[p.weight],
  regionGroup: PEOPLE_REGIONS[p.region].group,
  landName: countriesMeta[p.land]?.name || p.land,
  cities: Object.freeze([...(CITY_NAMES[p.id] || [])]),
  titles: TITLE_OVERRIDES[p.id] || null,
  tile: BUILT.capitals?.[p.id] ?? null,
  color: BUILT.colors?.[p.id] || '#64748b'
})));

export const PEOPLES = Object.freeze(Object.fromEntries(PEOPLES_LIST.map((p) => [p.id, p])));
export const PEOPLE_IDS = Object.freeze(PEOPLES_LIST.map((p) => p.id));
export const PINNED_PEOPLE_IDS = Object.freeze(PEOPLES_LIST.filter((p) => p.pinned).map((p) => p.id));

/** The people record of a nation id, or null (a legacy country id). */
export const peopleOf = (nationId) => (nationId && PEOPLES[nationId]) || null;
export const isPeopleId = (nationId) => !!peopleOf(nationId);

// Old country id (the 240-nation world: 'eg', 'cn', 'fr') -> the people of that land, built by
// scripts/peoples/build-peoples.mjs: the heaviest people whose land is that country, nearest its
// capital on ties, else the people whose capital is nearest. One way only: tests and old tables
// use it to name a people by its modern land; old saves keep their country ids (mode 'full').
export const LEGACY_NATION_IDS = Object.freeze({ ...(BUILT.legacy || {}) });
/** A people id for a people id (unchanged) or an old country id; null when unknown. */
export const peopleForNationId = (id) => (PEOPLES[id] ? id : LEGACY_NATION_IDS[id] || null);

/** The modern country a nation stands for: a people's land, or a legacy id itself. Tables keyed by
 * country (culture groups, doctrines, name pools) read through this. */
export const countryOfNation = (nationId) => PEOPLES[nationId]?.land || nationId;

/** "in modern Iraq", or null for a legacy nation. */
export const modernLandLine = (nationId) => { const p = peopleOf(nationId); return p ? `in modern ${p.landName}` : null; };
