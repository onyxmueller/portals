// The Settings panel: how edges map to crewmates and which leg is next (for the whole crew),
// throw feel (this phone only), and a few housekeeping buttons. Tap outside it to close.
import { view } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, leaveCrew } from '../net.js';
import { text, button } from './widgets.js';
import { hasAim, setAim } from '../throw/edges.js';

const HELP = {
  neighbors: 'Phones in a row or circle. Your left edge leads to the room on your left, your right edge to the room on your right.',
  portals: 'Every other room owns a coloured stretch of your left, top and right edges. Fling at their colour.',
};

export function openSettings(scene) {
  const { W, H } = view;
  // Wide and short, so it's two columns: the crew's choices on the left, this phone's on the right.
  const pw = Math.min(W - view.safeLeft - view.safeRight - 20, 720), cw = (pw - 60) / 2, half = (cw - 8) / 2;
  const blocker = scene.add.rectangle(0, 0, W, H, 0x000000, 0.5).setOrigin(0).setDepth(19).setInteractive();
  const panel = scene.add.container(W / 2, 0).setDepth(20);
  let cx = 0, y = 0, tallest = 0; // the column being filled, and how far down it we are
  const column = (side) => { tallest = Math.max(tallest, y); cx = side * (cw / 2 + 15); y = 26; };
  const heading = (s) => { panel.add(text(scene, cx, y, s, { size: 12, color: COLORS.faint })); y += 26; };
  const place = (b, dx) => { panel.add(b); b.setPosition(cx + dx, y); return b; };
  // A row with a label and - / + buttons.
  const stepper = (onMinus, onPlus) => {
    const t = text(scene, cx - cw / 2, y, '', { size: 13 }).setOrigin(0, 0.5);
    panel.add(t);
    place(button(scene, '−', onMinus, { w: 44, h: 32 }), cw / 2 - 44 - 8 - 22);
    place(button(scene, '+', onPlus, { w: 44, h: 32 }), cw / 2 - 22);
    y += 40;
    return t;
  };

  // ----- left: the whole crew -----
  column(-1);
  heading('EDGE MAPPING (WHOLE CREW)');
  const neighbors = place(button(scene, 'Neighbors', () => send({ t: 'mode', mode: 'neighbors' }), { w: half, h: 40 }), -half / 2 - 4);
  const portals = place(button(scene, 'Portals', () => send({ t: 'mode', mode: 'portals' }), { w: half, h: 40 }), half / 2 + 4);
  y += 46;
  const help = text(scene, cx, y, '', { size: 12, color: COLORS.dim }).setWordWrapWidth(cw - 8);
  panel.add(help);
  y += 44;
  // If this phone has pointed out where its crewmates sit, that wins over the choice above.
  if (hasAim()) {
    panel.add(text(scene, cx, y - 6, 'This phone is using where you pointed instead.', { size: 12, color: COLORS.warnCss }));
    y += 24;
    place(button(scene, 'Forget where I pointed', () => { setAim(null); scene.deck.refresh(); close(); }, { w: cw, h: 34 }), 0);
    y += 40;
  }
  // Docked: the captain picks which leg of the journey to fly next.
  const docked = state.game.phase === 'lobby';
  let paintLeg = () => {};
  if (docked && isCaptain() && state.game.level) {
    heading('JOURNEY (CAPTAIN)');
    const pick = (d) => { const lv = state.game.level; send({ t: 'level', n: (lv.n + d + lv.of) % lv.of }); };
    const t = stepper(() => pick(-1), () => pick(1));
    paintLeg = () => { const lv = state.game.level; t.setText(`Next leg: ${lv.n + 1}, ${lv.name}`); };
  }

  // ----- right: this phone -----
  column(1);
  heading('FEEL (THIS PHONE)');
  const feel = (label, key, step, min, max, show) => {
    const nudge = (d) => { SETTINGS[key] = Math.round(Math.max(min, Math.min(max, SETTINGS[key] + d)) * 10) / 10; paint(); };
    const t = stepper(() => nudge(-step), () => nudge(step));
    const paint = () => t.setText(`${label}: ${show(SETTINGS[key])}`);
    paint();
  };
  feel('Fling speed needed', 'flingSpeed', 50, 50, 1500, (v) => v);
  feel('Arrival speed', 'arrivalSpeed', 50, 0, 1500, (v) => (v === 0 ? 'as thrown' : v));
  feel('Friction', 'friction', 0.2, 0, 5, (v) => v.toFixed(1));
  y += 6;
  // Docked: practice parts. Flying: the captain can end the game.
  if (docked) place(button(scene, '+ Practice part', () => scene.deck.spawnRandom(), { w: half, h: 40 }), -half / 2 - 4);
  else place(button(scene, 'End game', () => { send({ t: 'end' }); close(); }, { w: half, h: 40 }).setVisible(isCaptain()), -half / 2 - 4);
  place(button(scene, 'Clear my parts', () => scene.deck.clear(), { w: half, h: 40 }), half / 2 + 4);
  y += 46;
  place(button(scene, 'Leave crew', () => leaveCrew(), { w: cw, h: 40 }), 0);
  y += 34;
  column(0);
  const tall = tallest;

  // Background last, so we know how tall the panel turned out. It swallows taps so they don't close the panel.
  const bg = scene.add.rectangle(0, tall / 2, pw, tall, COLORS.panel, 0.97).setStrokeStyle(1, COLORS.line).setInteractive();
  panel.addAt(bg, 0);
  panel.y = Math.max(view.safeTop + 6, (H - tall) / 2);

  const sync = () => {
    neighbors.setOn(state.mode === 'neighbors');
    portals.setOn(state.mode === 'portals');
    help.setText(HELP[state.mode]);
    paintLeg();
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
