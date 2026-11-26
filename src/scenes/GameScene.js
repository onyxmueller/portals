// Flying: faults appear in my room, the parts to fix them appear in other rooms,
// and everyone shares one hull.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { PARTS } from '../config/parts.js';
import { net, state, send } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, emoji, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { sfx } from '../audio/sfx.js';
import { buzz } from '../native.js';
import { followPhase, followResize } from './route.js';

const R = SETTINGS.partRadius, SR = SETTINGS.socketRadius, AR = SETTINGS.airlockRadius;
const SLOTS = 2; // a room shows at most this many faults at once (the server sends no more)

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.deck.onStep = () => this.checkSockets();
    this.deck.onTap = (x, y) => this.callOut(x, y);
    this.faults = []; // faults in my room: { id, kind, ttl, deadline, slot, done }

    this.airlockG = this.add.graphics().setDepth(1);
    this.airlockLabel = text(this, 0, 0, 'airlock', { size: 12, color: COLORS.faint }).setDepth(1);

    // Each fault slot: a ring that drains (drawn every frame), the part it needs ghosted
    // inside, and two lines of words above.
    this.ringG = this.add.graphics().setDepth(1);
    this.slots = [];
    for (let i = 0; i < SLOTS; i++) {
      this.slots.push({
        ghost: emoji(this, 0, 0, '', R * 1.15).setAlpha(0.4).setDepth(1),
        title: text(this, 0, 0, '', { size: 15, weight: '800' }).setDepth(1),
        needs: text(this, 0, 0, '', { size: 13 }).setDepth(1),
      });
    }

    this.hullG = this.add.graphics().setDepth(10);
    this.hullText = text(this, 0, 0, '', { size: 13, weight: '600' }).setDepth(10);
    this.damage = this.add.rectangle(0, 0, 10, 10, COLORS.bad, 0).setOrigin(0).setDepth(15);
    this.buttons = [button(this, 'Settings', () => openSettings(this))];

    net.on('game', this.onGame, this);
    this.events.once('shutdown', () => net.off('game', this.onGame, this));
    this.syncFaults(state.game);

    followPhase(this, 'run');
    followResize(this);
  }

  // The hull bar sits below any doors on the top edge.
  hullY() { return Deck.topInset() + 78; }

  slotPos(slot) { return { x: view.W * (slot === 0 ? 0.3 : 0.7), y: view.safeTop + view.H * 0.27 }; }
  airlockPos() { return { x: view.W / 2, y: view.H - 135 }; }

  layout() {
    const { W, H, safeTop, safeBottom } = view;
    const air = this.airlockPos(), g = this.airlockG;
    g.clear();
    g.fillStyle(0x0b0c10, 1).fillCircle(air.x, air.y, AR);
    g.lineStyle(3, 0x495057, 1).strokeCircle(air.x, air.y, AR);
    this.airlockLabel.setPosition(air.x, air.y + AR + 12);
    this.hullText.setPosition(W / 2, this.hullY() + 18);
    this.damage.setSize(W, H);
    rowFromRight(this.buttons, W - 10, H - safeBottom - 28);
    this.deck.refresh();
    this.drawHull();
  }

  // ---------- the ship's state ----------
  onGame(m) {
    this.syncFaults(m);
    if (m.ev === 'lost') {
      // The whole ship shudders when a fault runs out anywhere.
      this.damage.setAlpha(0.4);
      this.tweens.add({ targets: this.damage, alpha: 0, duration: 500 });
      sfx.damage(); buzz('MEDIUM');
    }
    if (m.ev === 'fault' && m.who === state.me) { sfx.fault(); buzz('LIGHT'); }
    this.drawHull();
  }

  // Keep my list of faults in step with the server's, holding on to each one's slot.
  syncFaults(m) {
    const now = performance.now(), old = this.faults;
    this.faults = m.faults.filter((f) => f.owner === state.me).map((f) => {
      const o = old.find((x) => x.id === f.id);
      return { id: f.id, kind: f.kind, ttl: f.ttl, deadline: now + f.left, slot: o ? o.slot : -1, done: o ? o.done : false };
    });
    for (const f of this.faults) if (f.slot < 0) f.slot = this.faults.some((x) => x.slot === 0) ? 1 : 0;
  }

  // Tapping one of my faults calls out for the part: crewmates see what I need in a bubble
  // on the portal that points at me. (Shouting still works, and is more fun.)
  callOut(x, y) {
    for (const f of this.faults) {
      const p = this.slotPos(f.slot);
      if (f.done || Math.hypot(x - p.x, y - p.y) > SR + 12) continue;
      send({ t: 'ask', id: f.id });
      this.deck.flash(p.x, p.y, COLORS.warn);
      sfx.send(); buzz('LIGHT');
      return;
    }
  }

  // A part touching a fault it matches fixes it. A part left on the airlock is thrown away.
  checkSockets() {
    const air = this.airlockPos();
    for (const it of [...this.deck.items]) {
      if (it.state === 'leaving') continue;
      let used = false;
      for (const f of this.faults) {
        if (f.done || f.kind !== it.kind) continue;
        const p = this.slotPos(f.slot);
        if (Math.hypot(it.x - p.x, it.y - p.y) > SR) continue;
        f.done = true; used = true;
        send({ t: 'fix', id: f.id });
        this.deck.flash(p.x, p.y, COLORS.good);
        sfx.fix(); buzz('MEDIUM');
        break;
      }
      if (!used && !it.held && it.state === 'in' && Math.hypot(it.vx, it.vy) < SETTINGS.airlockMaxSpeed &&
          Math.hypot(it.x - air.x, it.y - air.y) < AR) {
        used = true; sfx.airlock();
      }
      if (used) this.deck.remove(it);
    }
  }

  // ---------- drawing ----------
  drawHull() {
    const { W } = view, g = this.hullG, game = state.game;
    const y = this.hullY(), bw = Math.min(W - 120, 260), bx = (W - bw) / 2, k = game.hull / 100;
    g.clear();
    g.fillStyle(0x343a40, 1).fillRect(bx, y - 5, bw, 10);
    g.fillStyle(k > 0.5 ? COLORS.good : k > 0.25 ? COLORS.warn : COLORS.bad, 1).fillRect(bx, y - 5, bw * k, 10);
    this.hullText.setText(`Hull ${game.hull}%  ·  Fixed ${game.score}`);
  }

  update() {
    const now = performance.now(), g = this.ringG;
    g.clear();
    for (const s of this.slots) { s.ghost.setVisible(false); s.title.setVisible(false); s.needs.setVisible(false); }
    for (const f of this.faults) {
      if (f.done) continue;
      const p = this.slotPos(f.slot), part = PARTS[f.kind], s = this.slots[f.slot];
      const left = Math.max(0, f.deadline - now), urgent = left < 5000;
      const col = urgent ? COLORS.bad : COLORS.warn, css = urgent ? '#ff6b6b' : '#ffd43b';
      const width = urgent ? 6 + 2 * Math.sin(now / 90) : 6;
      g.fillStyle(0x0b0c10, 0.65).fillCircle(p.x, p.y, SR);
      g.lineStyle(width, 0x343a40, 1).strokeCircle(p.x, p.y, SR);
      g.lineStyle(width, col, 1).beginPath();
      g.arc(p.x, p.y, SR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (left / f.ttl));
      g.strokePath();
      s.ghost.setText(part.e).setPosition(p.x, p.y + 2).setVisible(true);
      s.title.setText(part.fault).setColor(css).setPosition(p.x, p.y - SR - 30).setVisible(true);
      s.needs.setText(`needs ${part.name}`).setPosition(p.x, p.y - SR - 12).setVisible(true);
    }
  }
}
