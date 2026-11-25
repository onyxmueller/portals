// The Settings panel: how edges map to crewmates (for the whole crew), throw feel (this phone
// only), and a few housekeeping buttons. Tap outside it to close.
import { view } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { net, state, send } from '../net.js';
import { text, button } from './widgets.js';

const HELP = {
  neighbors: 'Phones in a row or circle. Your left edge leads to the room on your left, your right edge to the room on your right.',
  portals: 'Every other room owns a coloured stretch of your left, top and right edges. Fling at their colour.',
};

export function openSettings(scene) {
  const { W, H } = view;
  const pw = Math.min(W - 20, 360), half = (pw - 40) / 2;
  const blocker = scene.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0).setDepth(19).setInteractive();
  const panel = scene.add.container(W / 2, 0).setDepth(20);
  let y = 22;
  const heading = (s) => { panel.add(text(scene, 0, y, s, { size: 12, color: COLORS.faint })); y += 28; };
  const place = (b, x) => { panel.add(b); b.setPosition(x, y); return b; };

  heading('EDGE MAPPING (WHOLE CREW)');
  const neighbors = place(button(scene, 'Neighbors', () => send({ t: 'mode', mode: 'neighbors' }), { w: half }), -half / 2 - 4);
  const portals = place(button(scene, 'Portals', () => send({ t: 'mode', mode: 'portals' }), { w: half }), half / 2 + 4);
  y += 50;
  const help = text(scene, 0, y, '', { size: 12, color: COLORS.dim }).setWordWrapWidth(pw - 36);
  panel.add(help);
  y += 44;

  heading('FEEL (THIS PHONE)');
  // A row with a label and - / + buttons that nudge one of the SETTINGS numbers.
  const stepper = (label, key, step, min, max, show) => {
    const t = text(scene, -pw / 2 + 18, y, '', { size: 13 }).setOrigin(0, 0.5);
    const paint = () => t.setText(`${label}: ${show(SETTINGS[key])}`);
    const nudge = (d) => { SETTINGS[key] = Math.round(Math.max(min, Math.min(max, SETTINGS[key] + d)) * 10) / 10; paint(); };
    panel.add(t);
    place(button(scene, '−', () => nudge(-step), { w: 44, h: 34 }), pw / 2 - 18 - 44 - 8 - 22);
    place(button(scene, '+', () => nudge(step), { w: 44, h: 34 }), pw / 2 - 18 - 22);
    paint();
    y += 44;
  };
  stepper('Fling speed needed', 'flingSpeed', 50, 50, 1500, (v) => v);
  stepper('Friction', 'friction', 0.2, 0, 5, (v) => v.toFixed(1));
  y += 10;

  if (scene.deck) place(button(scene, 'Clear my parts', () => scene.deck.clear(), { w: half }), -half / 2 - 4);
  const end = place(button(scene, 'End game', () => { send({ t: 'end' }); close(); }, { w: half }), half / 2 + 4);
  y += 36;

  // Background last, so we know how tall the panel turned out. It swallows taps so they don't close the panel.
  const bg = scene.add.rectangle(0, y / 2, pw, y, COLORS.panel, 0.97).setStrokeStyle(1, COLORS.line).setInteractive();
  panel.addAt(bg, 0);
  panel.y = Math.max(view.safeTop + 10, (H - y) / 2);

  const sync = () => {
    neighbors.setOn(state.mode === 'neighbors');
    portals.setOn(state.mode === 'portals');
    help.setText(HELP[state.mode]);
    end.setVisible(state.game.phase !== 'lobby');
  };
  function close() {
    net.off('room', sync); net.off('game', sync);
    scene.events.off('shutdown', close);
    blocker.destroy(); panel.destroy();
  }
  net.on('room', sync); net.on('game', sync);
  scene.events.once('shutdown', close);
  blocker.on('pointerup', close);
  sync();
}
