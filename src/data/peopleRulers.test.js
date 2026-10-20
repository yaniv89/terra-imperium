import { describe, it, expect } from 'vitest';
import { PEOPLES_LIST } from './peoples';
import { HE_PERSONS } from '../i18n/locales/data/he.names';
import { nameOf } from '../i18n/names';
import rows from '../../plans/data/rulers.json';

// Leader names of Civilization I to VII (whole names; a shared first name inside a longer name is fine).
const CIV_LEADERS = [
  'Cleopatra', 'Ramesses', 'Ramses', 'Hatshepsut', 'Gilgamesh', 'Hammurabi', 'Nebuchadnezzar', 'Alexander', 'Pericles', 'Gorgo',
  'Augustus', 'Caesar', 'Trajan', 'Hannibal', 'Dido', 'Cyrus', 'Darius', 'Xerxes', 'Ashoka', 'Gandhi', 'Chandragupta',
  'Qin Shi Huang', 'Wu Zetian', 'Kublai Khan', 'Genghis Khan', 'Montezuma', 'Pachacuti', 'Pakal', 'Lady Six Sky', 'Mansa Musa',
  'Sundiata', 'Menelik', 'Shaka', 'Tomyris', 'Amanitore', 'Himiko', 'Kupe', 'Seondeok', 'Jayavarman', 'Gitarja', 'Saladin',
  'Suleiman', 'Tamar', 'Nzinga', 'Mvemba a Nzinga', 'Peter', 'Catherine', 'Victoria', 'Elizabeth', 'Boudicca', 'Brennus',
  'Ambiorix', 'Attila', 'Bismarck', 'Napoleon', 'Charlemagne', 'Harald', 'Hojo Tokimune', 'Poundmaker', 'Lautaro',
  'Wilhelmina', 'Kristina', 'Robert the Bruce', 'Jadwiga', 'Matthias Corvinus', 'Theodora', 'Justinian', 'Hiawatha',
  'Sitting Bull', 'Themistocles', 'Leonidas', 'Cyrus the Great', 'Ben Franklin', 'Confucius', 'Harriet Tubman', 'Isabella'
].map((n) => n.toLowerCase());

describe('rulers of the peoples (RU0)', () => {
  it('every people has a ruler with a name and a gender', () => {
    expect(PEOPLES_LIST).toHaveLength(150);
    PEOPLES_LIST.forEach((p) => {
      expect(p.ruler?.name, p.id).toMatch(/\S/);
      expect(['m', 'f'], p.id).toContain(p.ruler?.gender);
    });
  });

  it('no ruler name is a Civilization leader copied whole, and no two peoples share a ruler name', () => {
    const seen = new Set();
    PEOPLES_LIST.forEach((p) => {
      const n = p.ruler.name.toLowerCase();
      expect(CIV_LEADERS.includes(n), p.ruler.name).toBe(false);
      expect(seen.has(n), `${p.ruler.name} twice`).toBe(false);
      seen.add(n);
    });
  });

  it('keeps both sexes and only known title governments', () => {
    const f = PEOPLES_LIST.filter((p) => p.ruler.gender === 'f').length;
    expect(f).toBeGreaterThanOrEqual(15);
    PEOPLES_LIST.forEach((p) => Object.keys(p.ruler.titles || {}).forEach((g) => expect(['tribal', 'monarchy', 'theocracy', 'republic', 'dictatorship', 'technocracy', 'corporate'], p.id).toContain(g)));
  });

  it('the draft file has one row per people with a source, a web check and the same name', () => {
    expect(rows).toHaveLength(150);
    const byId = new Map(rows.map((r) => [r.id, r]));
    PEOPLES_LIST.forEach((p) => {
      const r = byId.get(p.id);
      expect(r, p.id).toBeDefined();
      expect(r.name).toBe(p.ruler.name);
      expect(r.source, p.id).toMatch(/\S/);
      expect(r.web_check, p.id).toMatch(/\S/);
      expect(['historical', 'legendary', 'attested_name', 'invented']).toContain(r.kind);
    });
  });

  it('every ruler name and epithet has a Hebrew spelling in Hebrew letters only', () => {
    PEOPLES_LIST.forEach((p) => {
      [p.ruler.name, p.ruler.epithet].filter(Boolean).forEach((en) => {
        expect(HE_PERSONS[en], `${en} of ${p.id}`).toBeTruthy();
        expect(nameOf('person', null, en, 'he'), en).not.toMatch(/[A-Za-z]/);
      });
    });
  });
});
