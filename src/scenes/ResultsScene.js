// The ship is lost: show how the crew did. The captain decides whether to go again.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName, leaveCrew } from '../net.js';
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
    this.waiting = text(this, 0, 0, '', { size: 15, color: COLORS.dim });
    this.leave = button(this, 'Leave crew', () => leaveCrew(), { w: 140, h: 40 });

    const flash = this.add.rectangle(0, 0, view.W, view.H, COLORS.bad, 0.4).setOrigin(0).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    sfx.damage(); buzz('MEDIUM');

    // The captain can change (if they drop out), so keep the buttons in step with the crew.
    net.on('room', this.layout, this);
    this.events.once('shutdown', () => net.off('room', this.layout, this));
    followPhase(this, 'over');
    followResize(this);
  }

  layout() {
    const { W, H, safeBottom } = view, captain = isCaptain();
    this.title.setPosition(W / 2, H * 0.3);
    this.score.setPosition(W / 2, H * 0.3 + 46);
    this.again.setPosition(W / 2, H * 0.54).setVisible(captain);
    this.dock.setPosition(W / 2, H * 0.54 + 60).setVisible(captain);
    this.waiting.setPosition(W / 2, H * 0.54 + 30).setText(captain ? '' : `Waiting for ${captainName()} to decide…`);
    this.leave.setPosition(W / 2, H - safeBottom - 44);
  }
}
