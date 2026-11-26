// Docked: the crew gathers here before launch. Shows the crew code and who's aboard,
// everyone can practise throwing while they wait, and each phone can point out where its
// crewmates are sitting ("throw to calibrate").
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName, others } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { openInvite } from '../ui/invite.js';
import { hasAim, setAim, angleOf } from '../throw/edges.js';
import { followPhase, followResize } from './route.js';

export class LobbyScene extends Phaser.Scene {
  constructor() { super('Lobby'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.pointing = null; // while pointing out the crew: { queue: [crewmates still to do], got: { id: angle } }

    this.codeLabel = text(this, 0, 0, 'CREW CODE', { size: 12, color: COLORS.faint }).setDepth(3);
    this.code = text(this, 0, 0, '', { size: 38, weight: '800' }).setDepth(3);
    this.roster = []; // one line of text per crew member
    this.hint = text(this, 0, 0, '', { color: COLORS.dim }).setDepth(3);
    this.point = button(this, 'Point out your crew', () => this.startPointing(), { w: 230, depth: 3 });

    // Shown instead of all that while pointing.
    this.askWhere = text(this, 0, 0, 'Which way is', { size: 20, weight: '500' }).setDepth(3);
    this.askWho = text(this, 0, 0, '', { size: 44, weight: '800' }).setDepth(3);
    this.askHow = text(this, 0, 0, 'Fling the badge toward them.', { size: 15, color: COLORS.dim }).setDepth(3);

    this.invite = button(this, 'Invite', () => openInvite(this));
    this.launch = button(this, 'Launch', () => send({ t: 'launch' }));
    this.settings = button(this, 'Settings', () => openSettings(this));
    this.cancel = button(this, 'Cancel', () => this.stopPointing(false));

    net.on('room', this.onRoom, this);
    this.events.once('shutdown', () => net.off('room', this.onRoom, this));
    this.seeded = false;
    this.seed();

    followPhase(this, 'lobby');
    followResize(this);
    // Testing shortcuts: add ?settings, ?invite or ?point to the address to open that straight away.
    const params = new URLSearchParams(location.search);
    if (params.has('settings')) openSettings(this);
    if (params.has('invite') && state.crew) openInvite(this);
    this.wantPoint = params.has('point');
    if (this.wantPoint && others().length) { this.wantPoint = false; this.startPointing(); }
  }

  // Three parts to practise with, once we know who we are.
  seed() {
    if (this.seeded || state.me == null) return;
    this.seeded = true;
    for (let i = 0; i < 3; i++) this.deck.spawnRandom();
  }

  onRoom() {
    this.seed();
    if (this.pointing) {
      // Someone we were about to point at left: drop them from the list.
      const here = new Set(state.players.map((p) => p.id));
      this.pointing.queue = this.pointing.queue.filter((p) => here.has(p.id));
      if (!this.pointing.queue.length) { this.stopPointing(Object.keys(this.pointing.got).length > 0); return; }
      if (!this.deck.items.some((it) => it.badge && here.has(it.badge.id))) this.nextBadge();
    } else if (this.wantPoint && others().length) {
      this.wantPoint = false;
      this.startPointing();
    }
    this.layout();
  }

  // ---------- pointing out the crew ----------
  // One crewmate at a time: a badge with their icon appears, and you fling it toward where
  // they're sitting. Where it leaves the screen becomes where their door goes.
  startPointing() {
    const crew = others().filter((p) => !p.away);
    if (!crew.length) return;
    this.pointing = { queue: crew, got: {} };
    this.deck.clear();
    this.deck.hidePortals = true;
    this.deck.onBadge = (p, x, y) => this.pointed(p, x, y);
    this.nextBadge();
  }

  nextBadge() {
    for (const it of this.deck.items.filter((it) => it.badge && it.state !== 'leaving')) this.deck.remove(it);
    this.deck.add({ id: 'badge', badge: this.pointing.queue[0], x: view.W / 2, y: view.H * 0.6 });
    this.layout();
  }

  pointed(p, x, y) {
    if (!this.pointing) return;
    this.pointing.got[p.id] = angleOf(x, y);
    this.pointing.queue = this.pointing.queue.filter((q) => q.id !== p.id);
    if (this.pointing.queue.length) this.time.delayedCall(350, () => { if (this.pointing) this.nextBadge(); });
    else this.time.delayedCall(350, () => this.stopPointing(true));
  }

  stopPointing(save) {
    if (!this.pointing) return;
    if (save) setAim(this.pointing.got);
    this.pointing = null;
    this.deck.hidePortals = false;
    this.deck.onBadge = null;
    this.deck.clear();
    for (let i = 0; i < 3; i++) this.deck.spawnRandom();
    this.layout();
  }

  // ---------- layout ----------
  layout() {
    const { W, H, safeBottom } = view, pointing = !!this.pointing;
    let y = Deck.topInset() + 88; // below any doors on the top edge

    for (const t of this.roster) t.destroy();
    this.roster = [];
    for (const o of [this.codeLabel, this.code, this.hint, this.point, this.invite, this.launch, this.settings]) o.setVisible(!pointing);
    for (const o of [this.askWhere, this.askWho, this.askHow, this.cancel]) o.setVisible(pointing);

    if (pointing) {
      const p = this.pointing.queue[0];
      this.askWhere.setPosition(W / 2, y);
      this.askWho.setPosition(W / 2, y + 46).setText(p ? `${p.icon} ${p.name}?` : '').setColor(p ? p.color : COLORS.text);
      this.askHow.setPosition(W / 2, y + 92);
      rowFromRight([this.cancel], W - 10, H - safeBottom - 28);
      this.deck.refresh();
      return;
    }

    this.codeLabel.setPosition(W / 2, y); y += 34;
    this.code.setPosition(W / 2, y).setText((state.crew || '').split('').join(' ')); y += 40;

    // Who's aboard: a star for the captain, "(you)" for me, dimmed if they've dropped out.
    this.roster = state.players.map((p) => {
      const line = `${p.id === state.captain ? '★ ' : ''}${p.icon} ${p.name}${p.id === state.me ? ' (you)' : ''}${p.away ? ' · away' : ''}`;
      const t = text(this, W / 2, y, line, { size: 16, weight: '700', color: p.color }).setDepth(3).setAlpha(p.away ? 0.45 : 1);
      y += 24;
      return t;
    });

    const alone = others().length === 0;
    this.hint.setPosition(W / 2, y + 12).setText(
      alone ? '' : isCaptain() ? 'Press Launch when everyone is aboard.' : `${captainName()} launches when everyone is aboard.`);
    this.point.setPosition(W / 2, y + 52).setVisible(!alone).setLabel(hasAim() ? 'Point out your crew again' : 'Point out your crew');

    this.launch.setVisible(isCaptain());
    rowFromRight([this.invite, this.launch, this.settings], W - 10, H - safeBottom - 28);
    this.deck.refresh();
  }
}
