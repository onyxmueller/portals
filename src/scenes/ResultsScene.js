// The end of a leg, either way: the crew reached the goal ('won') or the hull gave out
// ('over'). The captain decides what happens next.
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
    const g = state.game, lv = g.level, won = g.phase === 'won', last = lv.n === lv.of - 1;
    this.leg = text(this, 0, 0, `LEG ${lv.n + 1} OF ${lv.of} · ${lv.name.toUpperCase()}`, { size: 12, color: COLORS.faint });
    this.title = text(this, 0, 0, !won ? 'Ship lost' : last ? 'Delivered!' : 'Made it!',
      { size: 44, weight: '800', color: won ? '#69db7c' : '#ff6b6b' });
    this.stars = text(this, 0, 0, won ? '★'.repeat(g.stars) + '☆'.repeat(3 - g.stars) : '', { size: 40, color: '#ffd43b' });
    this.words = text(this, 0, 0,
      won ? `${lv.won}\n\nHull left: ${g.hull}%` : `The crew fixed ${g.score} of ${g.goal} faults.`,
      { size: 16, weight: '500' }).setLineSpacing(4);
    // Winning: on to the next leg (after the last one, the journey starts again). Losing: try this leg again.
    this.next = button(this, !won ? 'Try again' : last ? 'Fly it all again' : 'Next leg',
      () => send({ t: won ? 'launch' : 'go' }), { w: 200, h: 48 });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 200, h: 48 });
    this.waiting = text(this, 0, 0, '', { size: 15, color: COLORS.dim });
    this.leave = button(this, 'Leave crew', () => leaveCrew(), { w: 140, h: 40 });

    const flash = this.add.rectangle(0, 0, view.W, view.H, won ? COLORS.good : COLORS.bad, 0.4).setOrigin(0).setDepth(15);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    if (won) sfx.fix(); else sfx.damage();
    buzz('MEDIUM');

    // The captain can change (if they drop out), so keep the buttons in step with the crew.
    net.on('room', this.layout, this);
    this.events.once('shutdown', () => net.off('room', this.layout, this));
    followPhase(this, g.phase);
    followResize(this);
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view, captain = isCaptain();
    let y = safeTop + H * 0.16;
    this.leg.setPosition(W / 2, y); y += 44;
    this.title.setPosition(W / 2, y); y += 54;
    this.stars.setPosition(W / 2, y); y += this.stars.text ? 44 : 0;
    this.words.setWordWrapWidth(Math.min(W - 48, 420)).setOrigin(0.5, 0).setPosition(W / 2, y);
    this.next.setPosition(W / 2, H * 0.66).setVisible(captain);
    this.dock.setPosition(W / 2, H * 0.66 + 60).setVisible(captain);
    this.waiting.setPosition(W / 2, H * 0.66 + 30).setText(captain ? '' : `Waiting for ${captainName()} to decide…`);
    this.leave.setPosition(W / 2, H - safeBottom - 44);
  }
}
