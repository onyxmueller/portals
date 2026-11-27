// The first screen. Tapping it also lets the browser play sound.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { state } from '../net.js';
import { text, disc } from '../ui/widgets.js';
import { initAudio } from '../audio/sfx.js';
import { sceneFor, followResize } from './route.js';

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    setupCamera(this);
    this.back = this.add.graphics();
    this.title = text(this, 0, 0, 'PORTALS', { size: 60, weight: '900', spacing: 2 });
    this.tagline = text(this, 0, 0, 'A spaceship held together by teamwork', { size: 15, color: COLORS.dim });
    this.prompt = text(this, 0, 0, 'Tap to board', { size: 20, weight: '700', color: COLORS.onPlanet });
    this.tweens.add({ targets: this.prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    followResize(this);

    // Already in a crew (back after closing the app, or arriving by invite link)? Go straight to the ship.
    const board = () => this.scene.start(state.crew ? sceneFor(state.game.phase) : 'Home');
    this.input.once('pointerup', () => { initAudio(); board(); });
    // Testing shortcut: add ?skip to the address to go straight in (no sound until the first tap).
    if (new URLSearchParams(location.search).has('skip')) this.time.delayedCall(600, board);
  }

  layout() {
    const { W, H } = view, r = W * 1.4;
    // A planet rising, an orbit, a few stars: the poster the rest of the game is cut from.
    disc(this.back.clear().lineStyle(2, COLORS.button, 1), W / 2, H * 0.5, H * 0.62, { stroke: true });
    disc(this.back.fillStyle(COLORS.planet, 1), W / 2, H * 0.72 + r, r);
    disc(this.back.fillStyle(0xd9772f, 1), W / 2 + 60, H * 0.72 + 60 + r, r);
    this.back.fillStyle(COLORS.cream, 1);
    for (const [x, y] of [[0.12, 0.13], [0.86, 0.1], [0.78, 0.5], [0.16, 0.56], [0.5, 0.07]]) this.back.fillCircle(W * x, H * y, 2);
    this.title.setPosition(W / 2, H * 0.32);
    this.tagline.setPosition(W / 2, H * 0.32 + 46);
    this.prompt.setPosition(W / 2, H * 0.72 + 34);
  }
}
