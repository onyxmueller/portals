// Docked: the crew gathers here before launch and can practise throwing.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { followPhase, followResize } from './route.js';

export class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.hint = text(this, 0, 0, 'Docked. Practise throwing, then press Launch.', { color: COLORS.dim }).setDepth(10);
    this.buttons = [
      button(this, '+ Part', () => { if (state.me != null) this.deck.spawnRandom(); }),
      button(this, 'Launch', () => send({ t: 'launch' })),
      button(this, 'Settings', () => openSettings(this)),
    ];

    // Three parts to practise with, once we know who we are.
    const seed = () => {
      if (this.seeded || state.me == null) return;
      this.seeded = true;
      for (let i = 0; i < 3; i++) this.deck.spawnRandom();
    };
    this.seeded = false;
    net.on('room', seed);
    this.events.once('shutdown', () => net.off('room', seed));
    seed();

    followPhase(this, 'lobby');
    followResize(this);
    // Testing shortcut: add ?settings to the address to open the Settings panel straight away.
    if (new URLSearchParams(location.search).has('settings')) openSettings(this);
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view;
    this.hint.setPosition(W / 2, safeTop + 30);
    rowFromRight(this.buttons, W - 10, H - safeBottom - 28);
    this.deck.refresh();
  }
}
