// User decision (29 Oct): "the camera should be where the player wants it to be." In a battle the
// camera moves only when the player pans, zooms, taps Go on an alert, uses All / Find / a squad or
// HUD button, taps the minimap, or turns on Follow. Every camera call in the battle screens must be
// one of these (a new one fails here until it is a player action and listed).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const CAMERA = /centerOn\(|frameGround\(|zoomBy\(|\.target\.[xz] \+?= |onFocus\?\.\(|onFocus\(a\.x/;
// [file, the line's text (trimmed start), why it is the player's]
const ALLOWED = [
  ['TacticalBattleScreen.jsx', 'renderer.frameGround((fighters.length ? fighters : own)', 'the first frame: where the battle opens, before any play'],
  ['TacticalBattleScreen.jsx', 'renderer.target.x += (gx - renderer.target.x) * k;', 'Follow, which only the player turns on (F or the button)'],
  ['TacticalBattleScreen.jsx', 'zoom: (factor, x, y) => rendererRef.current?.zoomBy(factor, x, y),', 'the wheel and the pinch'],
  ['TacticalBattleScreen.jsx', 'const lookAt = (x, z) => { rendererRef.current?.centerOn(x, z);', 'HUD buttons: Find, Go, the keep, Enemy, Base'],
  ['TacticalBattleScreen.jsx', 'const lookAtSquads = (list) => {', 'All and the squad buttons'],
  ['TacticalBattleScreen.jsx', 'onFocus={(x, y) => rendererRef.current?.centerOn(x / Q, y / Q)}', 'the alerts\' Go (BattleHud onClick)'],
  ['BattleHud.jsx', '{(onAlertGo || onFocus) && <button type="button" onClick={() => (onAlertGo ? onAlertGo(a) : onFocus(a.x, a.y))}', 'Go on an alert'],
  ['BattleHud.jsx', '{(onAlertGo || onFocus) && <button type="button" onClick={(e) => { e.stopPropagation(); if (onAlertGo) onAlertGo(a); else onFocus(a.x, a.y); }}', 'Go on a phone alert'],
  ['BattleHud.jsx', '<div key={a.id} onClick={() => (onAlertGo ? onAlertGo(a) : onFocus?.(a.x, a.y))}', 'a tap on an alert'],
  ['BattleMinimap.jsx', 'r.centerOn(g.x, g.z);', 'a tap on the minimap'],
];

describe('the battle camera moves only on a player action (user, 29 Oct)', () => {
  it('every camera call in the battle screens is a listed player action', () => {
    const dir = 'src/components/battle';
    const found = fs.readdirSync(dir).filter((f) => /\.(jsx?|mjs)$/.test(f) && !f.includes('.test.')).flatMap((f) => fs.readFileSync(`${dir}/${f}`, 'utf8').split(/\r?\n/)
      .map((l) => l.trim()).filter((l) => CAMERA.test(l) && !l.startsWith('//') && !l.startsWith('*')).map((l) => [f, l]));
    const unlisted = found.filter(([f, l]) => !ALLOWED.some(([af, al]) => af === f && l.startsWith(al)));
    expect(unlisted).toEqual([]);
  });

  it('the first clash is an alert with Go, never a jump', () => {
    const hud = fs.readFileSync('src/components/battle/BattleHud.jsx', 'utf8');
    expect(hud).not.toMatch(/a\.first\)[^\n]*\n[^\n]*onFocus/);
  });
});
