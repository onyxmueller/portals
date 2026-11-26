// The end of a leg, either way: the crew reached the goal ('won') or the hull gave out
// ('over'). Nothing to pick up here, so it's drawn like a poster. The captain decides what
// happens next.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName, leaveCrew } from '../net.js';
import { text, icon, button } from '../ui/widgets.js';
import { sfx } from '../audio/sfx.js';
import { buzz } from '../native.js';
import { followPhase, followResize } from './route.js';

export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }

  create() {
    setupCamera(this);
    const g = state.game, lv = g.level, won = g.phase === 'won', last = lv.n === lv.of - 1;
    this.won = won;
    this.cameras.main.setBackgroundColor(won ? COLORS.background : COLORS.panel);
    this.back = this.add.graphics();
    // Won: the ship arrives over the planet. Lost: it drifts, small and far off.
    this.ship = icon(this, 0, 0, 'rocket', won ? 84 : 46, COLORS.cream).setRotation(won ? 0.66 : 2.4).setAlpha(won ? 1 : 0.7);
    this.leg = text(this, 0, 0, `Leg ${lv.n + 1} of ${lv.of} · ${lv.name}`, { size: 13, color: COLORS.dim });
    this.title = text(this, 0, 0, !won ? 'SHIP LOST' : last ? 'DELIVERED!' : 'MADE IT!',
      { size: 50, weight: '900', color: won ? COLORS.goodCss : COLORS.badCss, spacing: 1 });
    // Stars: earned ones in yellow, the rest faint.
    this.stars = won ? [0, 1, 2].map((i) => icon(this, 0, 0, 'star', 46, i < g.stars ? COLORS.warn : COLORS.line).setAlpha(i < g.stars ? 1 : 0.5)) : [];
    this.words = text(this, 0, 0, won ? lv.won : `The crew fixed ${g.score} of ${g.goal} faults. Nobody is hurt.`,
      { size: 16 }).setLineSpacing(5);
    // The manual has the last word, in its own typewriter voice.
    this.manual = text(this, 0, 0,
      won ? `HULL LEFT ........ ${g.hull}%\nFAULTS FIXED ... ${g.score}/${g.goal}` : 'Ship\'s manual, page 1:\n"In the event of losing the ship, try not to."',
      { size: 12, mono: true, italic: !won, color: COLORS.dim, align: won ? 'left' : 'center' }).setLineSpacing(5);
    // Winning: on to the next leg (after the last one, the journey starts again). Losing: try this leg again.
    this.next = button(this, !won ? 'TRY AGAIN' : last ? 'FLY IT ALL AGAIN' : 'NEXT LEG',
      () => send({ t: won ? 'launch' : 'go' }), { w: 260, h: 56, kind: 'primary' });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 170, h: 44 });
    this.waiting = text(this, 0, 0, '', { size: 15, weight: '700', color: won ? COLORS.onPlanet : COLORS.dim });
    this.leave = button(this, 'Leave crew', () => leaveCrew(), { w: 140, h: 40 });

    // Coral is only for the hull, so it's the losing flash; a win gets green.
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
    const { W, H, safeTop, safeBottom } = view, captain = isCaptain(), won = this.won, b = this.back;
    b.clear();
    if (won) {
      // The planet they were flying to fills the bottom of the poster.
      const top = H * 0.6, r = W * 1.05;
      b.fillStyle(COLORS.planet, 1).fillCircle(W / 2, top + r, r);
      b.fillStyle(0xd9772f, 1).fillCircle(W / 2 + 30, top + 110 + r * 0.8, r * 0.8);
    } else {
      b.fillStyle(0x5a4a2a, 1).fillCircle(W * 0.92, H * 0.86, W * 0.36); // far off and dim
    }
    b.fillStyle(won ? COLORS.cream : COLORS.line, 1);
    for (const [x, y] of [[0.12, 0.13], [0.86, 0.1], [0.78, 0.36], [0.16, 0.44], [0.5, 0.07]]) b.fillCircle(W * x, H * y, 2);

    let y = safeTop + H * 0.13;
    this.leg.setPosition(W / 2, y); y += 44;
    this.title.setFontSize(50).setPosition(W / 2, y);
    if (this.title.width > W - 32) this.title.setFontSize(Math.floor(50 * (W - 32) / this.title.width));
    y += 54;
    this.stars.forEach((s, i) => s.setPosition(W / 2 + (i - 1) * 58, y));
    y += this.stars.length ? 46 : 0;
    this.words.setWordWrapWidth(Math.min(W - 60, 420)).setOrigin(0.5, 0).setPosition(W / 2, y); y += this.words.height + 24;
    if (won) this.manual.setOrigin(0, 0).setPosition(40, y);
    else this.manual.setOrigin(0.5, 0).setPosition(W / 2, H * 0.6 - 30);
    this.ship.setPosition(won ? W * 0.74 : W * 0.5, won ? H * 0.53 : H * 0.44);

    this.next.setPosition(W / 2, H * 0.72).setVisible(captain);
    this.dock.setPosition(W / 2, H * 0.72 + 64).setVisible(captain);
    this.waiting.setPosition(W / 2, H * 0.72 + 30).setText(captain ? '' : `Waiting for ${captainName()} to decide…`);
    this.leave.setPosition(W / 2, H - safeBottom - 40);
  }
}
