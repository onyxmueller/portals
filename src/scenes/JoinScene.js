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
    this.heading = text(this, 0, 0, 'Enter the crew code', { size: 20, weight: '700' });
    this.boxG = this.add.graphics();
    this.letters = Array.from({ length: CODE_LENGTH }, () => text(this, 0, 0, '', { size: 34, weight: '900' }));
    this.note = text(this, 0, 0, '', { size: 14, color: COLORS.warnCss });
    this.keys = [...CODE_LETTERS].map((ch) => button(this, ch, () => this.type(ch), { w: 52, h: 46 }));
    this.del = button(this, '⌫ Delete', () => this.type(null), { w: 130, h: 44 });
    this.back = button(this, 'Back', () => this.scene.start('Home'), { w: 130, h: 44 });

    const onError = (why) => {
      this.busy = false; this.code = '';
      this.note.setColor(COLORS.warnCss).setText(WHY[why] || "Couldn't join that crew.");
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

  // Where the code boxes sit (on the left half), shared by layout() and paint().
  boxes() {
    const { W, H, safeTop } = view, bw = 52, gap = 8;
    const x0 = W * 0.3 - (CODE_LENGTH * bw + (CODE_LENGTH - 1) * gap) / 2;
    return { bw, bh: 60, y: safeTop + H * 0.3, xs: Array.from({ length: CODE_LENGTH }, (_, i) => x0 + i * (bw + gap)) };
  }

  paint() {
    const { bw, bh, y, xs } = this.boxes(), g = this.boxG;
    g.clear();
    xs.forEach((x, i) => {
      // Tickets, like the crew code in the lobby: cream once filled, outlined in yellow where the next letter goes.
      g.fillStyle(this.code[i] ? COLORS.cream : COLORS.panel, 1).fillRect(x, y, bw, bh);
      if (i === this.code.length) g.lineStyle(3, COLORS.warn, 1).strokeRect(x, y, bw, bh);
      this.letters[i].setColor(COLORS.inkCss).setText(this.code[i] || '').setPosition(x + bw / 2, y + bh / 2);
    });
  }

  // Wide: the code on the left, the letter pad on the right.
  layout() {
    const { W, H } = view, { bh, y } = this.boxes(), lx = W * 0.3;
    this.heading.setPosition(lx, y - 30);
    this.note.setPosition(lx, y + bh + 22);
    this.back.setPosition(lx - 70, y + bh + 70);
    this.del.setPosition(lx + 70, y + bh + 70);
    const step = 58, rows = Math.ceil(this.keys.length / COLS), rowStep = Math.min(56, (H - 40) / rows);
    const x0 = W * 0.7 - (step * (COLS - 1)) / 2, top = H / 2 - (rowStep * (rows - 1)) / 2;
    this.keys.forEach((k, i) => k.setPosition(x0 + (i % COLS) * step, top + Math.floor(i / COLS) * rowStep));
    this.paint();
  }
}
