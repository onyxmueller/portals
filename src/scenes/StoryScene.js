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
    this.go = button(this, 'GO!', () => send({ t: 'go' }), { w: 240, h: 56, kind: 'primary' });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 150, h: 42, kind: 'outline' });
    this.waiting = text(this, 0, 0, '', { size: 13, mono: true, color: COLORS.dim });
    this.input.once('pointerdown', initAudio);

    // The captain can change (if they drop out), so keep the buttons in step with the crew.
    net.on('room', this.layout, this);
    this.events.once('shutdown', () => net.off('room', this.layout, this));
    followPhase(this, 'story');
    followResize(this);
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view, captain = isCaptain();
    const left = 28, right = W - 28, wide = right - left, g = this.paper;

    // Squared paper, a page frame, and rules above and below the title.
    g.clear().lineStyle(1, COLORS.button, 0.7);
    for (let x = GRID; x < W; x += GRID) g.lineBetween(x, 0, x, H);
    for (let y = GRID; y < H; y += GRID) g.lineBetween(0, y, W, y);
    g.lineStyle(1.5, COLORS.line, 1).strokeRect(12, safeTop + 12, W - 24, H - safeTop - safeBottom - 24);

    let y = safeTop + 52;
    this.manual.setPosition(left, y); this.leg.setPosition(right, y); y += 22;
    this.name.setFontSize(38).setWordWrapWidth(wide).setPosition(left, y); y += this.name.height + 14;
    g.lineBetween(left, y, right, y); y += 18;
    this.story.setWordWrapWidth(wide).setPosition(left, y); y += this.story.height + 22;

    // What's new, in a dashed box.
    this.tip.setWordWrapWidth(wide - 28);
    const boxH = this.tip.height + 50;
    for (let x = left; x < right; x += 9) { g.lineBetween(x, y, Math.min(x + 5, right), y); g.lineBetween(x, y + boxH, Math.min(x + 5, right), y + boxH); }
    for (let yy = y; yy < y + boxH; yy += 9) { g.lineBetween(left, yy, left, Math.min(yy + 5, y + boxH)); g.lineBetween(right, yy, right, Math.min(yy + 5, y + boxH)); }
    this.newLabel.setPosition(left + 14, y + 14);
    this.tip.setPosition(left + 14, y + 34);

    this.go.setPosition(W / 2, H - safeBottom - 122).setVisible(captain);
    this.dock.setPosition(W / 2, H - safeBottom - 58).setVisible(captain);
    this.waiting.setPosition(W / 2, H - safeBottom - 96).setText(captain ? '' : `${captainName()} says when to go…`);
  }
}
