// The ship is lost: show how the crew did, and offer another go.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { state, send } from '../net.js';
import { text, button } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { buzz } from '../native.js';
import { followPhase, followResize } from './route.js';

export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  create() {
    setupCamera(this);
    const n = state.game.score;
    this.title = text(this, 0, 0, 'Ship lost', { size: 44, weight: '800', color: '#ff6b6b' });
    this.score = text(this, 0, 0, `The crew fixed ${n} fault${n === 1 ? '' : 's'}`, { size: 18, weight: '500' });
    this.again = button(this, 'Launch again', () => send({ t: 'launch' }), { w: 200, h: 48 });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 200, h: 48 });

    const flash = this.add.rectangle(0, 0, view.W, view.H, COLORS.bad, 0.4).setOrigin(0).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    sfx.damage(); buzz('MEDIUM');

    followPhase(this, 'over');
    followResize(this);
  }

  layout() {
    const { W, H } = view;
    this.title.setPosition(W / 2, H * 0.34);
    this.score.setPosition(W / 2, H * 0.34 + 46);
    this.again.setPosition(W / 2, H * 0.58);
    this.dock.setPosition(W / 2, H * 0.58 + 60);
  }
}
