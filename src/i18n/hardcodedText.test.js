// src/i18n/hardcodedText.test.js
// Keeps new English text out of the files already converted to t() (phase H0). Add a file to
// CONVERTED when you convert it. A line that must keep a literal (a data id, an icon name) ends
// with `// i18n-ok`. Checks JSX text between tags and the text attributes below.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const CONVERTED = [
  'src/components/panels/DomesticPanel.jsx',
  'src/components/ruler/RulerSheet.jsx',
  'src/components/panels/GovernmentChangeDialog.jsx',
  'src/components/panels/LegacyPanel.jsx',
  'src/components/panels/WorldCongressSheet.jsx',
  'src/components/panels/MilitaryPanel.jsx',
  'src/components/ui/NationOverviewSheet.jsx',
  'src/components/modals/AgeAdvanceBanner.jsx',
  'src/components/modals/NationEliminatedBanner.jsx',
  'src/components/modals/GameOverModal.jsx',
  'src/components/ui/ActionButton.jsx',
  'src/components/ui/TitleScreen.jsx',
  'src/components/ui/SettingsSheet.jsx',
  'src/components/ui/LanguageSwitch.jsx',
  'src/components/ui/StartScreen.jsx',
  'src/components/ui/MapPicker.jsx',
  'src/components/ui/TurnDock.jsx',
  'src/components/ui/TurnReportSheet.jsx',
  'src/components/panels/LogConsole.jsx',
  'src/components/modals/BattleSummaryToast.jsx',
  'src/components/ui/WaitingChips.jsx',
  'src/components/ui/IdleChip.jsx',
  'src/components/ui/NextPrompt.jsx',
  'src/components/ui/WorldTopBar.jsx',
  'src/components/ui/ResourceBar.jsx',
  'src/components/ui/MapCard.jsx',
  'src/components/map/MarchBar.jsx',
  'src/components/map/SettleBar.jsx',
  'src/components/map/LensStrip.jsx',
  'src/components/map/MapModeToggle.jsx',
  'src/components/map/MapZoomControls.jsx',
  'src/components/map/MiniMap.jsx',
  'src/components/map/MapModal.jsx',
  'src/components/map/MapGoals.jsx',
  'src/components/globe/MapLegend.jsx',
  'src/components/panels/PanelDrawer.jsx',
  'src/components/panels/ActionPanelTabs.jsx',
  'src/components/panels/ActionPanel.jsx',
  'src/components/panels/LogDrawer.jsx',
  'src/components/panels/EmpireOverview.jsx',
  'src/components/city/CityList.jsx',
  'src/components/battle/BattleHud.jsx',
  'src/components/battle/EconomyHud.jsx',
  'src/components/battle/BattleResultScreen.jsx',
  'src/components/battle/BattleReportSheet.jsx',
  'src/components/battle/BattleReplay.jsx',
  'src/components/battle/PreBattleModal.jsx',
  'src/components/battle/DefenseSheet.jsx',
  'src/components/battle/PeaceDealSheet.jsx',
  'src/components/battle/PeaceOfferSheet.jsx',
  'src/components/battle/BattleFailure.jsx',
  'src/components/battle/TacticalBattleScreen.jsx',
  'src/components/battle/TacticalBattleHost.jsx',
  'src/components/battle/warAtlas.jsx',
  'src/components/battle/BattleMinimap.jsx',
  'src/components/capture/CaptureCard.jsx',
  'src/components/independents/IndependentSheet.jsx',
  'src/components/independents/TributeDemandSheet.jsx',
  'src/components/independents/IndependentBits.jsx',
  'src/components/independents/CityStateBadge.jsx',
  'src/components/modals/OnboardingOverlay.jsx',
  'src/components/modals/ResearchChoiceSheet.jsx',
  'src/components/modals/RazeControl.jsx',
  'src/components/modals/RegionInfoModal.jsx',
  'src/components/map/NationSheet.jsx',
  'src/components/panels/NationCard.jsx'
];

const TEXT_ATTRS = 'label|hint|title|subtitle|aria-label|placeholder|confirmLabel|cancelLabel|alt|text';

const findHardcoded = (source) => {
  const found = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let inBlockComment = false;
  let prevCode = '';
  lines.forEach((raw, i) => {
    const before = prevCode;
    if (raw.trim()) prevCode = raw.trim();
    if (raw.includes('i18n-ok')) return;
    // a line of bare text inside JSX, under a tag that ends on the line before: <p>\n  Some words\n</p>
    if (/[^=]>$/.test(before) && /^[A-Z][^<>{}=;`'"]*[a-z]{2,}[^<>{}=;`'"]*$/.test(raw.trim()) && !/^(?:import|export|const|let|return)\b/.test(raw.trim())) {
      found.push({ line: i + 1, text: raw.trim() });
      return;
    }
    let line = raw;
    if (inBlockComment) {
      if (line.includes('*/')) { inBlockComment = false; line = line.slice(line.indexOf('*/') + 2); } else return;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    if (line.includes('/*')) { inBlockComment = true; line = line.slice(0, line.indexOf('/*')); }
    line = line.replace(/(^|\s)\/\/.*$/, '');
    // text between a tag and the next tag or brace: >Some words<
    // a ">" after a space is a comparison (x > 0), never the end of a tag
    const jsx = /(?<![=\s-])>([^<>{}=]*[A-Za-z]{2,}[^<>{}=]*)(?=<|\{)/g;
    let m;
    while ((m = jsx.exec(line))) {
      if (/^\s*$/.test(m[1]) || /&&|\|\|/.test(m[1])) continue; // code between two tags, not text
      found.push({ line: i + 1, text: m[1].trim() });
    }
    const attr = new RegExp(`\\b(?:${TEXT_ATTRS})="([^"]*[A-Za-z]{2,}[^"]*)"`, 'g');
    while ((m = attr.exec(line))) found.push({ line: i + 1, text: m[1] });
  });
  return found;
};

// Every other .jsx under src/components is checked too (the i18n sweep, 27 Oct), except these
// developer screens that players never see, and the colony block of the retired emergent world.
const DEV_ONLY = new Set([
  'src/components/admin/AdminPage.jsx',
  'src/components/map/TileViewer.jsx',
  'src/components/map/WorldLab.jsx',
  'src/components/modals/ColonyBlock.jsx'
]);
const allJsx = (dir) => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name).replace(/\\/g, '/');
  if (d.isDirectory()) return allJsx(p);
  return p.endsWith('.jsx') && !p.includes('.test.') ? [p] : [];
});

describe('no hard-coded English in converted files', () => {
  it('the finder flags JSX text and text attributes, and skips t() and i18n-ok', () => {
    expect(findHardcoded('<div>Hello there</div>')).toHaveLength(1);
    expect(findHardcoded('<Button label="Save game" />')).toHaveLength(1);
    expect(findHardcoded("<div>{t('a.b')}</div>")).toHaveLength(0);
    expect(findHardcoded('<div className="text-fa-muted">{x}</div>')).toHaveLength(0);
    expect(findHardcoded('<b>Raw</b> // i18n-ok')).toHaveLength(0);
    expect(findHardcoded('<p className="x">\n  Some words on their own line.\n</p>')).toHaveLength(1);
    expect(findHardcoded('const f = (x) =>\n  Math.max(x, 1);')).toHaveLength(0);
  });
  for (const file of CONVERTED) {
    it(`${file} has none`, () => {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(findHardcoded(src)).toEqual([]);
    });
  }
});

describe('no hard-coded English in any player-facing component', () => {
  const files = allJsx('src/components').filter((f) => !DEV_ONLY.has(f) && !CONVERTED.includes(f));
  it('finds the component files', () => expect(files.length).toBeGreaterThan(50));
  it('none has JSX text or a text attribute in English', () => {
    const found = files.flatMap((f) => findHardcoded(readFileSync(resolve(process.cwd(), f), 'utf8')).map((h) => `${f}:${h.line} ${h.text}`));
    expect(found).toEqual([]);
  });
});
