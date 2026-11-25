// The first screen. Tapping it also lets the browser play sound.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { state } from '../net.js';
import { text } from '../ui/widgets.js';
import { initAudio } from '../audio/sfx.js';
import { sceneFor, followResize } from './route.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    setupCamera(this);
    this.title = text(this, 0, 0, 'PORTALS', { size: 56, weight: '800' });
    this.tagline = text(this, 0, 0, 'A spaceship held together by teamwork', { size: 15, color: COLORS.dim });
    this.prompt = text(this, 0, 0, 'Tap to board', { size: 20, weight: '600', color: '#ffd43b' });
    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    followResize(this);

    // Already in a crew (back after closing the app, or arriving by invite link)? Go straight to the ship.
    const board = () => this.scene.start(state.crew ? sceneFor(state.game.phase) : 'Home');
    this.input.once('pointerup', () => { initAudio(); board(); });
    // Testing shortcut: add ?skip to the address to go straight in (no sound until the first tap).
    if (new URLSearchParams(location.search).has('skip')) this.time.delayedCall(600, board);
  }

  layout() {
    const { W, H } = view;
    this.title.setPosition(W / 2, H * 0.36);
    this.tagline.setPosition(W / 2, H * 0.36 + 48);
    this.prompt.setPosition(W / 2, H * 0.62);
  }
}
