// The briefing before each leg of the journey: a little story, what's new, and the goal.
// Everyone reads it together; the captain says go.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName } from '../net.js';
import { text, button } from '../ui/widgets.js';
import { initAudio } from '../audio/sfx.js';
import { followPhase, followResize } from './route.js';

export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  create() {
    setupCamera(this);
    const lv = state.game.level;
    this.leg = text(this, 0, 0, `LEG ${lv.n + 1} OF ${lv.of}`, { size: 12, color: COLORS.faint });
    this.name = text(this, 0, 0, lv.name, { size: 34, weight: '800' });
    this.story = text(this, 0, 0, lv.story.join('\n\n'), { size: 16, color: COLORS.text }).setLineSpacing(4);
    this.tip = text(this, 0, 0, lv.tip, { size: 15, weight: '600', color: '#ffd43b' }).setLineSpacing(3);
    this.go = button(this, 'Go!', () => send({ t: 'go' }), { w: 200, h: 52 });
    this.dock = button(this, 'Back to dock', () => send({ t: 'end' }), { w: 140, h: 40 });
    this.waiting = text(this, 0, 0, '', { size: 15, color: COLORS.dim });
    this.input.once('pointerdown', initAudio);

    // The captain can change (if they drop out), so keep the buttons in step with the crew.
    net.on('room', this.layout, this);
    this.events.once('shutdown', () => net.off('room', this.layout, this));
    followPhase(this, 'story');
    followResize(this);
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view, captain = isCaptain(), wrap = Math.min(W - 48, 420);
    let y = safeTop + H * 0.12;
    this.leg.setPosition(W / 2, y); y += 36;
    this.name.setPosition(W / 2, y); y += 40;
    this.story.setWordWrapWidth(wrap).setOrigin(0.5, 0).setPosition(W / 2, y); y += this.story.height + 26;
    this.tip.setWordWrapWidth(wrap).setOrigin(0.5, 0).setPosition(W / 2, y);
    this.go.setPosition(W / 2, H - safeBottom - 130).setVisible(captain);
    this.dock.setPosition(W / 2, H - safeBottom - 60).setVisible(captain);
    this.waiting.setPosition(W / 2, H - safeBottom - 110).setText(captain ? '' : `${captainName()} says when to go…`);
  }
}
