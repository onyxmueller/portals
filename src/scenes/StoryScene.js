// The briefing before each leg of the journey, shown as a page of the ship's manual: a little
// story, what's new this leg, and the captain's Go! button. Everyone reads it together.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName } from '../net.js';
import { text, button } from '../ui/widgets.js';
import { initAudio } from '../audio/sfx.js';
import { followPhase, followResize } from './route.js';

const GRID = 26; // the manual is printed on squared paper

export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  create() {
    setupCamera(this);
    const lv = state.game.level;
    this.paper = this.add.graphics();
    this.manual = text(this, 0, 0, "SHIP'S MANUAL", { size: 11, mono: true, color: COLORS.dim, spacing: 1 }).setOrigin(0, 0.5);
    this.leg = text(this, 0, 0, `LEG ${lv.n + 1} OF ${lv.of}`, { size: 11, mono: true, color: COLORS.dim, spacing: 1 }).setOrigin(1, 0.5);
    this.name = text(this, 0, 0, lv.name.toUpperCase(), { size: 38, weight: '900', align: 'left' }).setOrigin(0, 0).setLineSpacing(-4);
    this.story = text(this, 0, 0, lv.story.join('\n\n'), { size: 14, mono: true, align: 'left' }).setOrigin(0, 0).setLineSpacing(6);
    this.newLabel = text(this, 0, 0, 'NEW THIS LEG', { size: 11, mono: true, weight: '700', color: COLORS.warnCss, spacing: 1 }).setOrigin(0, 0);
    this.tip = text(this, 0, 0, lv.tip, { size: 13, mono: true, align: 'left' }).setOrigin(0, 0).setLineSpacing(5);
    this.go = button(this, 'GO!', () => send({ t: 'go' }), { w: 170, h: 50, kind: 'primary' });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 150, h: 42, kind: 'outline' });
    this.waiting = text(this, 0, 0, '', { size: 13, mono: true, color: COLORS.dim });
    this.input.once('pointerdown', initAudio);

    // The captain can change (if they drop out), so keep the buttons in step with the crew.
    net.on('room', this.layout, this);
    this.events.once('shutdown', () => net.off('room', this.layout, this));
    followPhase(this, 'story');
    followResize(this);
  }

  // Wide: the story on the left-hand page, what's new and the captain's buttons on the right.
  layout() {
    const { W, H, safeTop, safeBottom } = view, captain = isCaptain(), g = this.paper;
    const left = view.safeLeft + 30, right = W - view.safeRight - 30, mid = (left + right) / 2;
    const lw = mid - 16 - left, rx = mid + 16, rw = right - rx;

    // Squared paper, a page frame, and a rule under the title.
    g.clear().lineStyle(1, COLORS.button, 0.7);
    for (let x = GRID; x < W; x += GRID) g.lineBetween(x, 0, x, H);
    for (let y = GRID; y < H; y += GRID) g.lineBetween(0, y, W, y);
    g.lineStyle(1.5, COLORS.line, 1).strokeRect(left - 18, safeTop + 12, right - left + 36, H - safeTop - safeBottom - 24);

    let y = safeTop + 38;
    this.manual.setPosition(left, y); this.leg.setPosition(right, y); y += 18;
    this.name.setFontSize(32).setWordWrapWidth(lw).setPosition(left, y); y += this.name.height + 10;
    g.lineBetween(left, y, mid - 16, y); y += 14;
    this.story.setFontSize(13).setWordWrapWidth(lw).setPosition(left, y);

    // What's new, in a dashed box at the top of the right-hand page.
    const top = safeTop + 62;
    this.tip.setWordWrapWidth(rw - 28);
    const boxH = this.tip.height + 48;
    for (let x = rx; x < right; x += 9) { g.lineBetween(x, top, Math.min(x + 5, right), top); g.lineBetween(x, top + boxH, Math.min(x + 5, right), top + boxH); }
    for (let yy = top; yy < top + boxH; yy += 9) { g.lineBetween(rx, yy, rx, Math.min(yy + 5, top + boxH)); g.lineBetween(right, yy, right, Math.min(yy + 5, top + boxH)); }
    this.newLabel.setPosition(rx + 14, top + 13);
    this.tip.setPosition(rx + 14, top + 32);

    const by = H - safeBottom - 54;
    this.dock.setPosition(rx + 75, by).setVisible(captain);
    this.go.setPosition(right - 85, by).setVisible(captain);
    this.waiting.setPosition(rx + rw / 2, by).setText(captain ? '' : `${captainName()} says when to go…`);
  }
}
