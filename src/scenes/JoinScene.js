// Type a friend's crew code. The game draws its own letter pad (only the letters codes can
// contain), so there's no phone keyboard to cover the screen.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS, CODE_LETTERS, CODE_LENGTH } from '../config/settings.js';
import { net, state, joinCrew } from '../net.js';
import { text, button } from '../ui/widgets.js';
import { followJoin, followResize } from './route.js';

const WHY = {
  nocrew: "No crew has that code. Check it and try again.",
  full: 'That crew is full (8 aboard).',
};
const COLS = 5;

export class JoinScene extends Phaser.Scene {
  constructor() { super('Join'); }

  create() {
    setupCamera(this);
    this.code = '';
    this.busy = false;
    this.heading = text(this, 0, 0, 'Enter the crew code', { size: 20, weight: '600' });
    this.boxG = this.add.graphics();
    this.letters = Array.from({ length: CODE_LENGTH }, () => text(this, 0, 0, '', { size: 34, weight: '800' }));
    this.note = text(this, 0, 0, '', { size: 14, color: '#ff6b6b' });
    this.keys = [...CODE_LETTERS].map((ch) => button(this, ch, () => this.type(ch), { w: 54, h: 50 }));
    this.del = button(this, '⌫ Delete', () => this.type(null), { w: 130, h: 46 });
    this.back = button(this, 'Back', () => this.scene.start('Home'), { w: 130, h: 46 });

    const onError = (why) => {
      this.busy = false; this.code = '';
      this.note.setColor('#ff6b6b').setText(WHY[why] || "Couldn't join that crew.");
      this.paint();
    };
    net.on('error', onError);
    this.events.once('shutdown', () => net.off('error', onError));
    followJoin(this);
    followResize(this);
  }

  type(ch) {
    if (this.busy) return;
    this.note.setText('');
    if (ch === null) this.code = this.code.slice(0, -1);
    else if (this.code.length < CODE_LENGTH) this.code += ch;
    if (this.code.length === CODE_LENGTH) {
      this.busy = true;
      this.note.setColor(COLORS.dim).setText(state.online ? 'Boarding…' : 'Connecting to the ship…');
      joinCrew(this.code); // if we're offline, this is sent as soon as the connection comes back
    }
    this.paint();
  }

  // Where the code boxes sit, shared by layout() and paint().
  boxes() {
    const { W, H, safeTop } = view, bw = 58, gap = 10;
    const x0 = W / 2 - (CODE_LENGTH * bw + (CODE_LENGTH - 1) * gap) / 2;
    return { bw, bh: 66, y: safeTop + H * 0.17, xs: Array.from({ length: CODE_LENGTH }, (_, i) => x0 + i * (bw + gap)) };
  }

  paint() {
    const { bw, bh, y, xs } = this.boxes(), g = this.boxG;
    g.clear();
    xs.forEach((x, i) => {
      g.fillStyle(COLORS.button, 1).fillRoundedRect(x, y, bw, bh, 10);
      g.lineStyle(2, i === this.code.length ? 0xffd43b : COLORS.line, 1).strokeRoundedRect(x, y, bw, bh, 10);
      this.letters[i].setText(this.code[i] || '').setPosition(x + bw / 2, y + bh / 2);
    });
  }

  layout() {
    const { W, H, safeBottom } = view, { bh, y } = this.boxes();
    this.heading.setPosition(W / 2, y - 34);
    this.note.setPosition(W / 2, y + bh + 26);
    const step = Math.min(64, (W - 24) / COLS), rows = Math.ceil(this.keys.length / COLS);
    const top = y + bh + 78, x0 = W / 2 - (step * (COLS - 1)) / 2;
    this.keys.forEach((k, i) => k.setPosition(x0 + (i % COLS) * step, top + Math.floor(i / COLS) * 58));
    const by = Math.min(top + rows * 58 + 14, H - safeBottom - 36);
    this.back.setPosition(W / 2 - 72, by);
    this.del.setPosition(W / 2 + 72, by);
    this.paint();
  }
}
