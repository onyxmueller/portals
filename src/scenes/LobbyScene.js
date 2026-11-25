// Docked: the crew gathers here before launch. Shows the crew code and who's aboard,
// and everyone can practise throwing while they wait.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { openInvite } from '../ui/invite.js';
import { followPhase, followResize } from './route.js';

export class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.codeLabel = text(this, 0, 0, 'CREW CODE', { size: 12, color: COLORS.faint }).setDepth(3);
    this.code = text(this, 0, 0, '', { size: 38, weight: '800' }).setDepth(3);
    this.roster = []; // one line of text per crew member
    this.hint = text(this, 0, 0, '', { color: COLORS.dim }).setDepth(3);
    this.invite = button(this, 'Invite', () => openInvite(this));
    this.launch = button(this, 'Launch', () => send({ t: 'launch' }));
    this.settings = button(this, 'Settings', () => openSettings(this));

    // Three parts to practise with, once we know who we are.
    this.seeded = false;
    const seed = () => {
      if (this.seeded || state.me == null) return;
      this.seeded = true;
      for (let i = 0; i < 3; i++) this.deck.spawnRandom();
    };
    net.on('room', this.layout, this);
    net.on('room', seed);
    this.events.once('shutdown', () => { net.off('room', this.layout, this); net.off('room', seed); });
    seed();

    followPhase(this, 'lobby');
    followResize(this);
    // Testing shortcuts: add ?settings or ?invite to the address to open that panel straight away.
    const params = new URLSearchParams(location.search);
    if (params.has('settings')) openSettings(this);
    if (params.has('invite') && state.crew) openInvite(this);
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view;
    let y = safeTop + 46;
    this.codeLabel.setPosition(W / 2, y); y += 34;
    this.code.setPosition(W / 2, y).setText((state.crew || '').split('').join(' ')); y += 40;

    // Who's aboard: a star for the captain, "(you)" for me, dimmed if they've dropped out.
    for (const t of this.roster) t.destroy();
    this.roster = state.players.map((p) => {
      const line = `${p.id === state.captain ? '★ ' : ''}${p.name}${p.id === state.me ? ' (you)' : ''}${p.away ? ' · away' : ''}`;
      const t = text(this, W / 2, y, line, { size: 16, weight: '700', color: p.color }).setDepth(3).setAlpha(p.away ? 0.45 : 1);
      y += 24;
      return t;
    });

    const alone = state.players.length < 2;
    this.hint.setPosition(W / 2, y + 12).setText(
      alone ? '' : isCaptain() ? 'Press Launch when everyone is aboard.' : `${captainName()} launches when everyone is aboard.`);

    this.launch.setVisible(isCaptain());
    rowFromRight([this.invite, this.launch, this.settings], W - 10, H - safeBottom - 28);
    this.deck.refresh();
  }
}
