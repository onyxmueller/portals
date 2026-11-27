// Docked: the crew gathers here before launch. Shows the crew code and who's aboard,
// everyone can practise throwing while they wait, and each phone can point out where its
// crewmates are sitting ("throw to calibrate").
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { COLORS } from '../config/settings.js';
import { net, state, send, isCaptain, captainName, others } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, icon, button, rowFromRight, hex } from '../ui/widgets.js';
import { roomIcon } from '../ui/icons.js';
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

    this.codeLabel = text(this, 0, 0, 'Crew code', { size: 13, color: COLORS.dim }).setDepth(3);
    // The code is shown as four cream tickets, one letter each.
    this.codeG = this.add.graphics().setDepth(3);
    this.codeLetters = [0, 1, 2, 3].map(() => text(this, 0, 0, '', { size: 36, weight: '900', color: COLORS.inkCss }).setDepth(3));
    this.roster = []; // everything drawn for the list of who's aboard
    this.hint = text(this, 0, 0, '', { color: COLORS.dim }).setDepth(3);
    this.point = button(this, 'Point out your crew', () => this.startPointing(), { w: 240, depth: 3, kind: 'outline' });

    // Shown instead of all that while pointing.
    this.askWhere = text(this, 0, 0, 'Which way is', { size: 20, weight: '500' }).setDepth(3);
    this.askWho = text(this, 0, 0, '', { size: 44, weight: '900', spacing: 1 }).setDepth(3);
    this.askHow = text(this, 0, 0, 'Fling the badge toward them.', { size: 15, color: COLORS.dim }).setDepth(3);

    this.invite = button(this, 'Invite', () => openInvite(this));
    this.launch = button(this, 'LAUNCH', () => send({ t: 'launch' }), { h: 44, kind: 'primary' });
    this.settings = button(this, 'Settings', () => openSettings(this));
    this.cancel = button(this, 'Cancel', () => this.stopPointing(false));

    net.on('room', this.onRoom, this);
    net.on('game', this.layout, this); // the captain may pick a different leg
    this.events.once('shutdown', () => { net.off('room', this.onRoom, this); net.off('game', this.layout, this); });
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
    this.deck.add({ id: 'badge', badge: this.pointing.queue[0], x: view.W / 2, y: view.H * 0.62 });
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
  // Wide: the crew code and what to do on the left, who's aboard on the right, parts to
  // practise with in between, and the buttons on the planet along the bottom.
  layout() {
    const { W } = view, pointing = !!this.pointing;
    const y0 = Deck.inset('T') + 66; // below any doors on the top edge
    const row = Deck.rowY(), right = W - view.safeRight - 10;

    for (const t of this.roster) t.destroy();
    this.roster = [];
    for (const o of [this.codeLabel, this.codeG, ...this.codeLetters, this.hint, this.point, this.invite, this.launch, this.settings]) o.setVisible(!pointing);
    for (const o of [this.askWhere, this.askWho, this.askHow, this.cancel]) o.setVisible(pointing);

    if (pointing) {
      const p = this.pointing.queue[0];
      this.askWhere.setPosition(W / 2, y0);
      this.askWho.setPosition(W / 2, y0 + 44).setText(p ? `${p.name.toUpperCase()}?` : '').setColor(p ? p.color : COLORS.text);
      this.askHow.setPosition(W / 2, y0 + 86);
      rowFromRight([this.cancel], right, row);
      this.deck.refresh();
      return;
    }

    // Left: the crew code as four cream tickets, then what happens next.
    const lx = W * 0.3, letters = (state.crew || '').split(''), tw = 44, th = 52, gap = 8, x0 = lx - (4 * tw + 3 * gap) / 2;
    let y = y0;
    this.codeLabel.setPosition(lx, y); y += 16;
    this.codeG.clear().fillStyle(COLORS.cream, 1);
    this.codeLetters.forEach((t, i) => {
      this.codeG.fillRect(x0 + i * (tw + gap), y, tw, th);
      t.setText(letters[i] || '').setPosition(x0 + i * (tw + gap) + tw / 2, y + th / 2);
    });
    y += th + 28;
    const alone = others().length === 0, lv = state.game.level;
    this.hint.setPosition(lx, y).setText(
      (lv ? `Next: leg ${lv.n + 1}, ${lv.name}\n` : '') +
      (alone ? 'Tap Invite to bring your crew aboard.' : isCaptain() ? 'Press Launch when everyone is aboard.' : `${captainName()} launches when everyone is aboard.`));
    this.point.setPosition(lx, y + 50).setVisible(!alone).setLabel(hasAim() ? 'Point out your crew again' : 'Point out your crew');

    // Right: who's aboard, one row each (two columns once the crew is big), with their room's
    // colour and picture, a star for the captain, "(you)" for me, dimmed if they've dropped out.
    const cols = state.players.length > 4 ? 2 : 1, rw = cols === 2 ? 150 : 220, rh = 32, rx = W * 0.7 - (cols * rw + (cols - 1) * 8) / 2;
    state.players.forEach((p, i) => {
      const left = rx + (i % cols) * (rw + 8), top = y0 - 8 + Math.floor(i / cols) * (rh + 6), cy = top + rh / 2, a = p.away ? 0.45 : 1;
      const g = this.add.graphics().setDepth(3).setAlpha(a);
      g.fillStyle(COLORS.panel, 1).fillRect(left, top, rw, rh);
      g.fillStyle(hex(p.color), 1).fillCircle(left + 18, cy, 11);
      this.roster.push(g, icon(this, left + 18, cy, roomIcon(p.name), 14).setDepth(3).setAlpha(a));
      const name = `${p.name}${p.id === state.me ? ' (you)' : ''}`;
      this.roster.push(text(this, left + 36, cy, name, { size: 15, weight: '700' }).setOrigin(0, 0.5).setDepth(3).setAlpha(a));
      if (p.away) this.roster.push(text(this, left + rw - 8, cy, 'away', { size: 13, color: COLORS.dim }).setOrigin(1, 0.5).setDepth(3));
      else if (p.id === state.captain) this.roster.push(icon(this, left + rw - 16, cy, 'star', 15, COLORS.warn).setDepth(3));
    });

    this.launch.setVisible(isCaptain());
    rowFromRight([this.invite, this.launch, this.settings], right, row);
    this.deck.refresh();
  }
}
