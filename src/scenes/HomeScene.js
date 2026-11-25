// Not in a crew yet: start one, or join a friend's.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, createCrew, joining } from '../net.js';
import { text, button } from '../ui/widgets.js';
import { followJoin, followResize, sceneFor } from './route.js';

export class HomeScene extends Phaser.Scene {
  constructor() { super('Home'); }

  create() {
    setupCamera(this);
    if (state.crew) { this.scene.start(sceneFor(state.game.phase)); return; }

    this.title = text(this, 0, 0, 'PORTALS', { size: 44, weight: '800' });
    this.tagline = text(this, 0, 0, 'Every phone is a room on the ship.\nGet your crew together.', { size: 15, color: COLORS.dim });
    this.start = button(this, 'Start a crew', () => { createCrew(); this.refresh(); }, { w: 240, h: 56 });
    this.join = button(this, 'Join a crew', () => this.scene.start('Join'), { w: 240, h: 56 });
    this.note = text(this, 0, 0, '', { size: 13, color: COLORS.faint });

    net.on('online', this.refresh, this);
    this.events.once('shutdown', () => net.off('online', this.refresh, this));
    followJoin(this);
    followResize(this);
    this.refresh();
    // Testing shortcuts: add ?start to the address to start a crew straight away, or ?join to open the Join screen.
    const params = new URLSearchParams(location.search);
    if (params.has('start')) createCrew();
    if (params.has('join')) this.scene.start('Join');
  }

  refresh() {
    this.note.setText(!state.online ? 'Connecting to the ship…' : joining() ? 'Boarding…' : '');
  }

  layout() {
    const { W, H, safeBottom } = view;
    this.title.setPosition(W / 2, H * 0.24);
    this.tagline.setPosition(W / 2, H * 0.24 + 54);
    this.start.setPosition(W / 2, H * 0.52);
    this.join.setPosition(W / 2, H * 0.52 + 72);
    this.note.setPosition(W / 2, H - safeBottom - 40);
  }
}
