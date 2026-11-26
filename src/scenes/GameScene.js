// Flying one leg of the journey: faults appear in my room, the parts to fix them appear in
// other rooms, and everyone shares one hull. Some legs put a station in one room: a tool that
// turns one part into another when you work it with your finger.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { PARTS } from '../config/parts.js';
import { STATIONS } from '../config/stations.js';
import { net, state, send } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, emoji, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { sfx } from '../audio/sfx.js';
import { buzz } from '../native.js';
import { followPhase, followResize } from './route.js';

const R = SETTINGS.partRadius, SR = SETTINGS.socketRadius, AR = SETTINGS.airlockRadius;
const SLOTS = 2; // a room shows at most this many faults at once (the server sends no more)
const STATION_R = 52;     // size of a station's pad
const STATION_REACH = 150; // how far from a station a finger can be and still be working it
const TAU = Math.PI * 2;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.deck.onStep = () => this.checkSockets();
    this.deck.onTap = (x, y, pointer) => { if (!this.startWork(x, y, pointer)) this.callOut(x, y); };
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

    // A station in my room, if this leg has one and it's mine.
    this.work = null; // the part sitting on my station: { it, done (radians turned so far), finger: { id, a } | null }
    this.stationIcon = emoji(this, 0, 0, '', STATION_R * 0.9).setAlpha(0.3).setDepth(1);
    this.stationName = text(this, 0, 0, '', { size: 15, weight: '800', color: '#ffd43b' }).setDepth(1);
    this.stationHint = text(this, 0, 0, '', { size: 13 }).setDepth(1);
    this.stationNote = text(this, 0, 0, '', { size: 13, color: '#ffd43b' }).setDepth(10); // "the Charger is in Reactor"
    this.input.on('pointermove', this.onWorkMove, this);
    this.input.on('pointerup', this.onWorkUp, this);
    this.input.on('pointerupoutside', this.onWorkUp, this);

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
  stationPos() { return { x: view.W / 2, y: view.safeTop + view.H * 0.5 }; }

  // The station in my room this leg, or null.
  myStation() {
    const s = (state.game.stations || []).find((x) => x.owner === state.me);
    return s && STATIONS[s.type] ? STATIONS[s.type] : null;
  }

  layout() {
    const { W, H, safeTop, safeBottom } = view;
    const air = this.airlockPos(), g = this.airlockG;
    g.clear();
    g.fillStyle(0x0b0c10, 1).fillCircle(air.x, air.y, AR);
    g.lineStyle(3, 0x495057, 1).strokeCircle(air.x, air.y, AR);
    this.airlockLabel.setPosition(air.x, air.y + AR + 12);
    this.hullText.setPosition(W / 2, this.hullY() + 18);
    this.stationNote.setPosition(W / 2, this.hullY() + 38);
    this.layoutStation();
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
    if (m.ev === 'burst') this.shout('☄️ Asteroids!');
    // A station moves if its crewmate drops out: redraw the doors and my own pad.
    const where = JSON.stringify(m.stations || []);
    if (where !== this.stationsSeen) { this.deck.refresh(); this.layoutStation(); }
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

  // Big words across the middle for a moment, when something hits the whole ship.
  shout(words) {
    const t = text(this, view.W / 2, view.H * 0.44, words, { size: 34, weight: '800', color: '#ffa94d' }).setDepth(12).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 500, onComplete: () => t.destroy() });
    this.damage.setAlpha(0.25);
    this.tweens.add({ targets: this.damage, alpha: 0, duration: 400 });
    sfx.damage(); buzz('MEDIUM');
  }

  // ---------- my station ----------
  layoutStation() {
    this.stationsSeen = JSON.stringify(state.game.stations || []);
    const mine = this.myStation(), p = this.stationPos();
    for (const o of [this.stationIcon, this.stationName, this.stationHint]) o.setVisible(!!mine);
    if (mine) {
      this.stationIcon.setText(mine.icon).setPosition(p.x, p.y + 2);
      this.stationName.setText(mine.name).setPosition(p.x, p.y - STATION_R - 30);
      this.stationHint.setPosition(p.x, p.y - STATION_R - 12);
    } else if (this.work) {
      this.work.it.docked = false; this.work = null; // it moved to another room: let the part go
    }
    // Everyone else is told which room to throw at.
    const other = (state.game.stations || []).find((s) => s.owner !== state.me && STATIONS[s.type]);
    const room = other && state.players.find((x) => x.id === other.owner);
    this.stationNote.setText(room ? `${STATIONS[other.type].icon} The ${STATIONS[other.type].name} is in ${room.name}` : '');
  }

  // A finger went down on empty deck. If there's a part on my station and the finger is near
  // it, that finger starts working the station.
  startWork(x, y, pointer) {
    const p = this.stationPos();
    if (!this.work || this.work.finger || Math.hypot(x - p.x, y - p.y) > STATION_REACH) return false;
    this.work.finger = { id: pointer.id, a: Math.atan2(y - p.y, x - p.x) };
    return true;
  }

  // The Charger: going round and round the pad cranks it. Either direction counts.
  onWorkMove(pointer) {
    const w = this.work, mine = this.myStation();
    if (!w || !mine || !w.finger || w.finger.id !== pointer.id) return;
    const p = this.stationPos(), dx = pointer.worldX - p.x, dy = pointer.worldY - p.y;
    if (Math.hypot(dx, dy) < 14) return; // too close to the middle to tell which way it's going
    const a = Math.atan2(dy, dx);
    let d = a - w.finger.a;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    w.finger.a = a;
    const before = w.done;
    w.done += Math.abs(d);
    if (Math.floor(w.done / (TAU / 4)) > Math.floor(before / (TAU / 4))) { sfx.send(); buzz('LIGHT'); } // a click every quarter turn
    if (w.done < mine.turns * TAU) return;
    // Done: it's a new part now, and it pops off the pad.
    this.deck.setKind(w.it, mine.gives);
    w.it.docked = false;
    w.it.vx = (Math.random() - 0.5) * 200; w.it.vy = 320;
    this.deck.flash(p.x, p.y, COLORS.good);
    sfx.fix(); buzz('MEDIUM');
    this.work = null;
  }

  onWorkUp(pointer) {
    if (this.work && this.work.finger && this.work.finger.id === pointer.id) this.work.finger = null;
  }

  // A part touching a fault it matches fixes it. A part left on the airlock is thrown away.
  checkSockets() {
    const air = this.airlockPos(), mine = this.myStation(), pad = this.stationPos();
    for (const it of [...this.deck.items]) {
      if (it.state === 'leaving' || it.docked) continue;
      const slow = !it.held && it.state === 'in' && Math.hypot(it.vx, it.vy) < SETTINGS.airlockMaxSpeed;
      // The right part left on my empty station sticks there, ready to be worked on.
      if (mine && !this.work && slow && it.kind === mine.takes && Math.hypot(it.x - pad.x, it.y - pad.y) < STATION_R) {
        it.docked = true; it.x = pad.x; it.y = pad.y; it.vx = it.vy = 0;
        this.work = { it, done: 0, finger: null };
        this.deck.flash(pad.x, pad.y, COLORS.warn);
        sfx.receive(); buzz('LIGHT');
        continue;
      }
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
      if (!used && slow && Math.hypot(it.x - air.x, it.y - air.y) < AR) {
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
    this.hullText.setText(`Hull ${game.hull}%  ·  Fixed ${game.score} of ${game.goal}`);
  }

  update() {
    const now = performance.now(), g = this.ringG;
    g.clear();
    for (const s of this.slots) { s.ghost.setVisible(false); s.title.setVisible(false); s.needs.setVisible(false); }

    // My station: a pad, and a ring that fills as the part on it is worked.
    const mine = this.myStation();
    if (mine) {
      const p = this.stationPos(), w = this.work;
      g.fillStyle(0x0b0c10, 0.65).fillCircle(p.x, p.y, STATION_R);
      g.lineStyle(5, w ? 0x343a40 : COLORS.warn, w ? 1 : 0.7).strokeCircle(p.x, p.y, STATION_R);
      if (w) {
        g.lineStyle(7, COLORS.good, 1).beginPath();
        g.arc(p.x, p.y, STATION_R, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, w.done / (mine.turns * TAU)));
        g.strokePath();
      }
      this.stationIcon.setVisible(!w);
      this.stationHint.setText(w ? mine.busy : mine.empty);
    }
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
