// Flying one leg of the journey: faults appear in my room, the parts to fix them appear in
// other rooms, and everyone shares one hull. Some legs put a station in one room: a tool that
// turns one part into another when you work it with your finger.
import Phaser from 'phaser';
import { view, setupCamera } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { PARTS, GOOSE } from '../config/parts.js';
import { STATIONS } from '../config/stations.js';
import { net, state, send } from '../net.js';
import { Deck } from '../deck/Deck.js';
import { text, icon, button, rowFromRight } from '../ui/widgets.js';
import { openSettings } from '../ui/settings.js';
import { sfx } from '../audio/sfx.js';
import { buzz } from '../native.js';
import { followPhase, followResize } from './route.js';

const R = SETTINGS.partRadius, SR = SETTINGS.socketRadius, AR = SETTINGS.airlockRadius;
const SLOTS = 2;           // a room has at most this many faults at once (the server sends no more)
const SPOTS = [0.2, 0.35, 0.5, 0.65, 0.8]; // where across the room a fault can appear; each new one picks a free spot at random
const RING = 14;           // how thick a fault's timer ring is
const STATION_R = 46;      // size of a station's pad
const STATION_REACH = 150; // how far from a station a finger can be and still be working it
const URGENT = 5000;       // a fault with less than this long left (ms) turns coral: the hull is about to pay
const FOG = 8;             // depth of the fog; anything that should show through it is drawn above
const LIGHT = 120;         // how far a finger lights up the fog around it
const TAU = Math.PI * 2;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    setupCamera(this);
    this.deck = new Deck(this);
    this.deck.briefStatus = true;
    this.deck.onStep = () => this.checkSockets();
    this.deck.onTap = (x, y, pointer) => { if (!this.startWork(x, y, pointer)) this.callOut(x, y); };
    this.faults = []; // faults in my room: { id, kind, ttl, deadline, spot (which of SPOTS), done }

    this.foggy = state.game.level && state.game.level.twist === 'fog';
    const over = this.foggy ? FOG + 1 : 1; // in fog, alarms and words still show
    this.geese = new Map(); // goose id -> { deadline, ttl }, as the ship last told us
    this.geeseG = this.add.graphics().setDepth(6);

    this.airlockG = this.add.graphics().setDepth(1);
    this.airlockLabel = text(this, 0, 0, 'airlock', { size: 13, color: COLORS.dim }).setOrigin(0, 0.5).setDepth(1);

    // What's drawn for each fault: a thick ring that drains (drawn every frame), the part it
    // needs ghosted inside, its name in bold capitals above (the only ones on this screen) and
    // what it needs below.
    this.ringG = this.add.graphics().setDepth(1);
    this.slots = [];
    for (let i = 0; i < SLOTS; i++) {
      this.slots.push({
        ghost: icon(this, 0, 0, 'star', R * 1.2, COLORS.cream).setAlpha(0.4).setDepth(1),
        title: text(this, 0, 0, '', { size: 26, weight: '900', spacing: 1 }).setDepth(over),
        needs: text(this, 0, 0, '', { size: 13 }).setDepth(over),
        kind: -1,
      });
    }

    // A station in my room, if this leg has one and it's mine.
    this.work = null; // the part sitting on my station: { it, done (0 to 1), finger: { id, a } | null, note }
    this.stationIcon = icon(this, 0, 0, 'bolt', STATION_R * 0.8, COLORS.cream).setAlpha(0.3).setDepth(1);
    this.stationName = text(this, 0, 0, '', { size: 18, weight: '700', color: COLORS.warnCss }).setDepth(1);
    this.stationHint = text(this, 0, 0, '', { size: 13 }).setDepth(1);
    this.input.on('pointermove', this.onWorkMove, this);
    this.input.on('pointerup', this.onWorkUp, this);
    this.input.on('pointerupoutside', this.onWorkUp, this);

    // The hull, on the planet in the middle of the bottom strip: words, a flat bar, and how many
    // faults are fixed. `hit` remembers the piece just lost so it can be shown going.
    this.hullG = this.add.graphics().setDepth(10);
    this.hullText = text(this, 0, 0, '', { size: 14, weight: '900', color: COLORS.onPlanet }).setOrigin(1, 0.5).setDepth(10);
    this.fixedText = text(this, 0, 0, '', { size: 14, weight: '700', color: COLORS.onPlanet }).setOrigin(0, 0.5).setDepth(10);
    this.hit = null; // { from (hull before), until (ms) }
    this.seenHull = state.game.hull;
    this.frameG = this.add.graphics().setDepth(15).setAlpha(0); // the coral frame that means "hull lost"
    this.buttons = [button(this, 'Settings', () => openSettings(this))];

    // Fog: a dark sheet over the room with holes of light cut in it every frame (see update).
    if (this.foggy) {
      if (!this.textures.exists('light')) {
        const c = this.textures.createCanvas('light', 256, 256), ctx = c.getContext();
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.7, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
        c.refresh();
      }
      this.lightStamp = this.make.image({ key: 'light', add: false });
    }
    this.fog = null;

    net.on('game', this.onGame, this);
    this.events.once('shutdown', () => net.off('game', this.onGame, this));
    this.syncFaults(state.game);
    this.syncGeese(state.game);
    this.shiftSeen = state.game.shift || 0;

    followPhase(this, 'run');
    followResize(this);
  }

  // Faults sit in a row across the upper part of the room, every other one a little lower so
  // it doesn't look like a grid. All of them clear the doors on the top edge.
  spotPos(i) { return { x: view.W * SPOTS[i], y: Math.max(132 + Deck.inset('T'), view.H * 0.36) + (i % 2 ? 16 : 0) }; }
  // The station, when this room has one, sits low in the middle (and takes the middle fault
  // spot). The airlock is always low on the left.
  stationPos() { return { x: view.W / 2, y: Deck.rise() - STATION_R - 16 }; }
  airlockPos() { return { x: view.W * 0.24, y: Deck.rise() - AR - 10 }; }

  // The station in my room this leg, or null.
  myStation() {
    const s = (state.game.stations || []).find((x) => x.owner === state.me);
    return s && STATIONS[s.type] ? STATIONS[s.type] : null;
  }

  layout() {
    const { W, H } = view;
    // The airlock is a hole, not a thing: dark, with a dashed rim.
    const air = this.airlockPos(), g = this.airlockG;
    g.clear();
    g.fillStyle(COLORS.shadow, 1).fillCircle(air.x, air.y, AR + 3);
    g.lineStyle(3, COLORS.line, 1);
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(air.x, air.y, AR + 3, (i / 12) * TAU, ((i + 0.55) / 12) * TAU); g.strokePath(); }
    this.airlockLabel.setPosition(air.x + AR + 12, air.y);
    this.frameG.clear().lineStyle(24, COLORS.bad, 1).strokeRect(0, 0, W, H); // half of the line is off-screen
    rowFromRight(this.buttons, W - view.safeRight - 10, Deck.rowY());
    this.layoutStation();
    this.deck.refresh();
    this.drawHull();
    if (this.foggy) {
      if (this.fog) this.fog.destroy();
      this.fog = this.add.renderTexture(0, 0, Math.ceil(W), Math.ceil(Deck.rise() + 4)).setOrigin(0).setDepth(FOG);
    }
  }

  // ---------- the ship's state ----------
  onGame(m) {
    const gone = this.syncFaults(m);
    if (m.ev === 'lost') {
      // A fault ran out somewhere: every phone gets the coral frame, and the hull bar shows
      // the piece going. Coral is only ever about the hull.
      this.hit = { from: this.seenHull, until: performance.now() + 1400 };
      this.frameG.setAlpha(1);
      this.tweens.add({ targets: this.frameG, alpha: 0, delay: 250, duration: 700 });
      this.cameras.main.shake(220, 0.006);
      sfx.damage(); buzz('MEDIUM');
      for (const f of gone) this.tooLate(f); // it was one of mine
    }
    if (m.ev === 'peck') {
      // A goose nobody threw out has pecked the hull. Same coral frame: the hull paid.
      this.hit = { from: this.seenHull, until: performance.now() + 1400 };
      this.frameG.setAlpha(1);
      this.tweens.add({ targets: this.frameG, alpha: 0, delay: 250, duration: 700 });
      this.banner('HONK!', 'A goose pecked the hull');
      sfx.damage(); buzz('MEDIUM');
    }
    this.seenHull = m.hull;
    this.syncGeese(m);
    if (m.ev === 'fault' && m.who === state.me) { sfx.fault(); buzz('LIGHT'); }
    if (m.ev === 'burst') this.asteroids();
    if (m.ev === 'goose' && m.who === state.me) { this.banner('GOOSE LOOSE!', 'Drop it on the airlock'); sfx.fault(); buzz('LIGHT'); }
    if (m.ev === 'warn') { this.banner('WORMHOLE!', 'The doors are about to move'); sfx.strike(); buzz('LIGHT'); }
    // The doors moved: redraw them, and ring each one so eyes go to where they are now.
    if ((m.shift || 0) !== this.shiftSeen) {
      this.shiftSeen = m.shift || 0;
      this.deck.refresh();
      for (const [id, d] of this.deck.doors) {
        const p = state.players.find((x) => x.id === id);
        this.deck.pulse(d.cx, d.cy, p ? Phaser.Display.Color.HexStringToColor(p.color).color : COLORS.cream);
      }
      if (m.ev === 'swap') { sfx.strike(); buzz('MEDIUM'); }
    }
    // A station moves if its crewmate drops out: redraw the doors and my own pad.
    const where = JSON.stringify(m.stations || []);
    if (where !== this.stationsSeen) { this.deck.refresh(); this.layoutStation(); }
    this.drawHull();
  }

  // Keep my list of faults in step with the server's, holding on to each one's slot.
  // Returns the ones that have just gone without my fixing them.
  syncFaults(m) {
    const now = performance.now(), old = this.faults;
    this.faults = m.faults.filter((f) => f.owner === state.me).map((f) => {
      const o = old.find((x) => x.id === f.id);
      return { id: f.id, kind: f.kind, ttl: f.ttl, deadline: now + f.left, spot: o ? o.spot : -1, done: o ? o.done : false };
    });
    // A new fault takes a free spot at random (not the middle one if my station is there).
    for (const f of this.faults) {
      if (f.spot >= 0) continue;
      const free = SPOTS.map((_, i) => i).filter((i) => !(i === 2 && this.myStation()) && !this.faults.some((x) => x.spot === i));
      f.spot = free[Math.floor(Math.random() * free.length)] ?? 0;
    }
    return old.filter((o) => !o.done && !this.faults.some((f) => f.id === o.id));
  }

  // Remember how long each loose goose has left, and lose any goose in my room that the ship
  // no longer counts (it pecked the hull and slipped away, or the leg is over).
  syncGeese(m) {
    const now = performance.now();
    this.geese = new Map((m.geese || []).map((x) => [x.id, { deadline: now + x.left, ttl: x.ttl }]));
    for (const it of [...this.deck.items]) {
      if (it.kind === GOOSE && it.state !== 'leaving' && !this.geese.has(it.id)) { this.deck.flash(it.x, it.y, COLORS.cream); this.deck.remove(it); }
    }
  }

  // Tapping one of my faults calls out for the part: crewmates see what I need in a bubble
  // on the door that points at me. (Shouting still works, and is more fun.)
  callOut(x, y) {
    for (const f of this.faults) {
      const p = this.spotPos(f.spot);
      if (f.done || Math.hypot(x - p.x, y - p.y) > SR + 12) continue;
      send({ t: 'ask', id: f.id });
      this.deck.flash(p.x, p.y, COLORS.warn);
      sfx.send(); buzz('LIGHT');
      return;
    }
  }

  // Shrink a fault's name until it fits over its own slot, clear of the one beside it.
  fit(title) {
    const room = view.W * 0.15 - 10;
    title.setFontSize(26);
    if (title.width > room) title.setFontSize(Math.max(15, Math.floor(26 * room / title.width)));
    return title;
  }

  // ---------- moments ----------
  // Something that pops up over a fault's slot for a moment: a drawing, a word and maybe a line under it.
  moment(p, draw, word, color, line) {
    const d = this.foggy ? FOG + 1 : 6;
    const g = this.add.graphics().setDepth(d);
    draw(g);
    const bits = [g, this.fit(text(this, p.x, p.y - 70, word, { size: 26, weight: '900', color, spacing: 1 }).setDepth(d))];
    if (line) bits.push(text(this, p.x, p.y + 66, line, { size: 13 }).setDepth(d));
    this.tweens.add({ targets: bits, alpha: 0, delay: 900, duration: 350, onComplete: () => bits.forEach((b) => b.destroy()) });
  }

  // Fixed: the ring snaps full and green, with a tick and a burst.
  fixed(p) {
    this.moment(p, (g) => {
      g.lineStyle(5, COLORS.good, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.lineBetween(p.x + Math.cos(a) * 58, p.y + Math.sin(a) * 58, p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70);
      }
      g.fillStyle(COLORS.panel, 1).fillCircle(p.x, p.y, SR);
      g.lineStyle(RING, COLORS.good, 1).strokeCircle(p.x, p.y, SR - 2);
      g.lineStyle(9, COLORS.good, 1).beginPath();
      g.moveTo(p.x - 19, p.y + 1); g.lineTo(p.x - 6, p.y + 14); g.lineTo(p.x + 20, p.y - 14);
      g.strokePath();
    }, 'FIXED!', COLORS.goodCss);
  }

  // Too late: a broken coral ring and a cross, and what it cost.
  tooLate(f) {
    const p = this.spotPos(f.spot);
    this.moment(p, (g) => {
      g.fillStyle(COLORS.panel, 1).fillCircle(p.x, p.y, SR);
      g.lineStyle(RING, COLORS.bad, 1);
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(p.x, p.y, SR - 2, (i / 4) * TAU + 0.15, ((i + 1) / 4) * TAU - 0.15); g.strokePath(); }
      g.lineStyle(9, COLORS.bad, 1).lineBetween(p.x - 15, p.y - 15, p.x + 15, p.y + 15).lineBetween(p.x + 15, p.y - 15, p.x - 15, p.y + 15);
    }, 'TOO LATE', COLORS.badCss, 'the hull paid for it');
  }

  // An asteroid strike opens a breach in every room. It makes work but costs no hull, so
  // nothing here is coral: rocks cross the screen and a cream banner says what to do.
  asteroids() {
    const { W, H } = view, cy = H * 0.52;
    for (let i = 0; i < 4; i++) {
      const size = 16 + Math.random() * 22, y0 = cy - 170 + i * 80 + Math.random() * 30;
      const rock = this.add.graphics().setDepth(11);
      rock.lineStyle(size * 0.45, COLORS.cream, 0.3).lineBetween(-size * 4, -size * 2, 0, 0); // its trail
      rock.fillStyle(COLORS.planet, 1);
      rock.fillPoints([[-0.7, -0.9], [0.3, -1], [1, -0.4], [0.9, 0.5], [0.2, 1], [-0.8, 0.7], [-1, -0.2]].map(([x, y]) => new Phaser.Geom.Point(x * size, y * size)), true);
      rock.setPosition(-60 - i * 50, y0 - 60);
      this.tweens.add({ targets: rock, x: W + 120, y: y0 + (W + 180) * 0.5, delay: i * 90, duration: 650, onComplete: () => rock.destroy() });
    }
    this.banner('ASTEROIDS!', 'Patch every room');
    sfx.strike(); buzz('MEDIUM');
  }

  // A cream banner slapped across the middle of the room for a couple of seconds: something
  // just happened to the whole ship, and here's what to do about it.
  banner(title, line) {
    const { W, H } = view;
    const big = text(this, 0, -12, title, { size: 34, weight: '900', color: COLORS.inkCss, spacing: 1 });
    const small = text(this, 0, 20, line, { size: 15, weight: '700', color: COLORS.inkCss });
    const bw = Math.min(W - 70, Math.max(310, big.width + 50, small.width + 50));
    const g = this.add.graphics();
    g.fillStyle(COLORS.shadow, 1).fillRect(-bw / 2 + 6, -36, bw, 84);
    g.fillStyle(COLORS.cream, 1).fillRect(-bw / 2, -42, bw, 84);
    const banner = this.add.container(W / 2, H * 0.52, [g, big, small]).setDepth(12).setRotation(-0.05).setScale(0.5);
    this.tweens.add({ targets: banner, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: banner, alpha: 0, delay: 1900, duration: 400, onComplete: () => banner.destroy() });
  }

  // ---------- my station ----------
  layoutStation() {
    this.stationsSeen = JSON.stringify(state.game.stations || []);
    const mine = this.myStation(), p = this.stationPos();
    for (const o of [this.stationIcon, this.stationName, this.stationHint]) o.setVisible(!!mine);
    if (mine) {
      this.stationIcon.setTexture(`icon-${mine.icon}`).setPosition(p.x, p.y);
      this.stationName.setText(mine.name).setPosition(p.x + STATION_R + 20, p.y - 12).setOrigin(0, 0.5);
      this.stationHint.setPosition(p.x + STATION_R + 20, p.y + 10).setOrigin(0, 0.5);
    } else if (this.work) {
      this.work.it.docked = false; this.work = null; // it moved to another room: let the part go
    }
  }

  // A finger went down on empty deck. If there's a part on my station and the finger is near
  // it, that finger works the station. What that means depends on the station (its `how`).
  startWork(x, y, pointer) {
    const p = this.stationPos(), w = this.work, mine = this.myStation();
    if (!w || !mine || Math.hypot(x - p.x, y - p.y) > STATION_REACH) return false;
    if (mine.how === 'taps') {
      // The Pump: every tap adds a little, and it drains between taps (see update).
      w.done += 1 / mine.taps;
      sfx.send(); buzz('LIGHT');
      if (w.done >= 1) this.finishWork();
      return true;
    }
    if (w.finger) return false;
    w.finger = { id: pointer.id, a: Math.atan2(y - p.y, x - p.x) };
    w.note = null;
    return true;
  }

  // The Charger: going round and round the pad cranks it. Either direction counts.
  onWorkMove(pointer) {
    const w = this.work, mine = this.myStation();
    if (!w || !mine || mine.how !== 'spin' || !w.finger || w.finger.id !== pointer.id) return;
    const p = this.stationPos(), dx = pointer.worldX - p.x, dy = pointer.worldY - p.y;
    if (Math.hypot(dx, dy) < 14) return; // too close to the middle to tell which way it's going
    const a = Math.atan2(dy, dx);
    let d = a - w.finger.a;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    w.finger.a = a;
    const before = w.done;
    w.done += Math.abs(d) / (mine.turns * TAU);
    if (Math.floor(w.done * mine.turns * 4) > Math.floor(before * mine.turns * 4)) { sfx.send(); buzz('LIGHT'); } // a click every quarter turn
    if (w.done >= 1) this.finishWork();
  }

  // The Welder: the ring heats while the finger is down. Let go in the green and it's welded;
  // let go early and nothing happens.
  onWorkUp(pointer) {
    const w = this.work, mine = this.myStation();
    if (!w || !w.finger || w.finger.id !== pointer.id) return;
    w.finger = null;
    if (!mine || mine.how !== 'hold') return;
    if (w.done >= mine.green[0] && w.done <= mine.green[1]) { this.finishWork(); return; }
    w.done = 0; w.note = 'Too soon. Hold it longer';
  }

  // The station has finished: the part on it is a new part now, and it pops off the pad.
  finishWork() {
    const w = this.work, mine = this.myStation(), p = this.stationPos();
    this.deck.setKind(w.it, mine.gives);
    w.it.docked = false;
    w.it.vx = (Math.random() - 0.5) * 200; w.it.vy = -320; // up into the room, away from the planet
    this.deck.flash(p.x, p.y, COLORS.good);
    sfx.fix(); buzz('MEDIUM');
    this.work = null;
  }

  // Stations that change with time: the Welder heats while held, the Pump drains between taps.
  stepWork(dt) {
    const w = this.work, mine = this.myStation();
    if (!w || !mine) return;
    if (mine.how === 'hold' && w.finger) {
      w.done += dt / mine.heat;
      if (w.done >= 1) { // held too long: it has to cool, and you start again
        w.done = 0; w.finger = null; w.note = 'Too hot! Let go in the green';
        this.cameras.main.shake(120, 0.003);
        sfx.airlock(); buzz('MEDIUM');
      }
    } else if (mine.how === 'taps') {
      w.done = Math.max(0, w.done - mine.drain * dt / 1000);
    }
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
        const p = this.spotPos(f.spot);
        if (Math.hypot(it.x - p.x, it.y - p.y) > SR) continue;
        f.done = true; used = true;
        send({ t: 'fix', id: f.id });
        this.fixed(p);
        sfx.fix(); buzz('MEDIUM');
        break;
      }
      if (!used && slow && Math.hypot(it.x - air.x, it.y - air.y) < AR) {
        used = true; sfx.airlock();
        if (it.kind === GOOSE) { // out it goes (it has a little helmet)
          send({ t: 'out', id: it.id });
          this.deck.flash(air.x, air.y, COLORS.good);
          buzz('MEDIUM');
        }
      }
      if (used) this.deck.remove(it);
    }
  }

  // ---------- geese ----------
  // A loose goose hops about by itself (and out through a door, if it happens to hop that
  // way), and wears a ring that drains: when it's empty, the goose pecks the hull.
  stepGeese(now) {
    const g = this.geeseG;
    g.clear();
    for (const it of this.deck.items) {
      if (it.kind !== GOOSE) continue;
      it.hopAt ??= now + 700 + Math.random() * 800;
      if (now >= it.hopAt && !it.held && it.state === 'in') {
        const a = Math.random() * TAU, sp = 380 + Math.random() * 220;
        it.vx = Math.cos(a) * sp; it.vy = Math.sin(a) * sp;
        it.hopAt = now + 900 + Math.random() * 1500;
      }
      const t = this.geese.get(it.id);
      if (!t || it.state === 'leaving') continue;
      const left = Math.max(0, t.deadline - now);
      g.lineStyle(7, left < URGENT ? COLORS.bad : COLORS.warn, 1).beginPath();
      g.arc(it.x, it.y, R + 9, -Math.PI / 2, -Math.PI / 2 + TAU * (left / t.ttl));
      g.strokePath();
    }
  }

  // ---------- fog ----------
  // Dark everywhere except: under each finger that's down, at my faults (alarms glow), and at
  // the doors, the airlock and my station (you know your own room). Parts are what get lost.
  drawFog() {
    const rt = this.fog, stamp = this.lightStamp;
    if (!rt) return;
    rt.clear();
    rt.fill(COLORS.shadow, 0.96);
    const light = (x, y, r) => { stamp.setScale((r * 2) / 256); rt.erase(stamp, x, y); };
    for (const p of this.input.manager.pointers) {
      if (!p || !p.isDown) continue;
      const at = this.cameras.main.getWorldPoint(p.x, p.y); // p.worldX is only right while a touch is being handled
      light(at.x, at.y, LIGHT);
    }
    for (const f of this.faults) if (!f.done) { const p = this.spotPos(f.spot); light(p.x, p.y, SR + 26); }
    for (const d of this.deck.doorSpots) light(d.cx, d.cy, 62);
    const air = this.airlockPos();
    light(air.x, air.y, AR + 22);
    if (this.myStation()) { const p = this.stationPos(); light(p.x, p.y, STATION_R + 30); }
  }

  // ---------- drawing ----------
  drawHull() {
    const { W } = view, g = this.hullG, game = state.game, now = performance.now();
    const y = Deck.rowY(), bw = Math.min(150, W * 0.2), bx = (W - bw) / 2, k = game.hull / 100;
    const hit = this.hit && now < this.hit.until ? this.hit : (this.hit = null);
    g.clear();
    g.fillStyle(COLORS.panel, 1).fillRect(bx - 3, y - 9, bw + 6, 18);
    g.fillStyle(COLORS.cream, 1).fillRect(bx, y - 6, bw * k, 12);
    if (hit) g.fillStyle(COLORS.bad, 1).fillRect(bx + bw * k, y - 6, bw * Math.max(0, hit.from - game.hull) / 100, 12);
    this.hullText.setPosition(bx - 12, y).setText(hit ? `Hull ${game.hull}%  −${hit.from - game.hull}%` : `Hull ${game.hull}%`);
    this.fixedText.setPosition(bx + bw + 12, y).setText(`Fixed ${game.score} of ${game.goal}`);
  }

  update() {
    const now = performance.now(), g = this.ringG;
    if (this.hit) this.drawHull(); // so the lost piece clears when its moment is over
    this.stepWork(this.game.loop.delta);
    this.stepGeese(now);
    g.clear();
    for (const s of this.slots) { s.ghost.setVisible(false); s.title.setVisible(false); s.needs.setVisible(false); }

    // My station: a pad, and a thick ring that fills as the part on it is worked.
    const mine = this.myStation();
    if (mine) {
      const p = this.stationPos(), w = this.work;
      g.fillStyle(COLORS.panel, 1).fillCircle(p.x, p.y, STATION_R + 8);
      if (w) {
        const top = -Math.PI / 2, k = Math.min(1, w.done);
        let color = COLORS.good;
        if (mine.how === 'hold') {
          // Where to let go, marked on the ring; the heat creeps round towards and past it.
          g.lineStyle(16, COLORS.good, 0.35).beginPath();
          g.arc(p.x, p.y, STATION_R, top + TAU * mine.green[0], top + TAU * mine.green[1]);
          g.strokePath();
          color = k >= mine.green[0] && k <= mine.green[1] ? COLORS.good : COLORS.cream;
        }
        if (k > 0.004) {
          g.lineStyle(mine.how === 'hold' ? 8 : 16, color, 1).beginPath();
          g.arc(p.x, p.y, STATION_R, top, top + TAU * k);
          g.strokePath();
        }
      } else {
        g.lineStyle(3, COLORS.warn, 0.8).strokeCircle(p.x, p.y, STATION_R);
      }
      this.stationIcon.setVisible(!w);
      this.stationHint.setText(w ? w.note || mine.busy : mine.empty);
    }

    let shown = 0;
    for (const f of this.faults) {
      if (f.done) continue;
      const p = this.spotPos(f.spot), part = PARTS[f.kind], s = this.slots[shown++];
      if (!s) break;
      const left = Math.max(0, f.deadline - now), urgent = left < URGENT;
      const width = urgent ? RING + 2 * Math.sin(now / 90) : RING;
      g.fillStyle(COLORS.panel, 1).fillCircle(p.x, p.y, SR + RING / 2 - 2);
      g.lineStyle(width, urgent ? COLORS.bad : COLORS.warn, 1).beginPath();
      g.arc(p.x, p.y, SR - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (left / f.ttl));
      g.strokePath();
      if (s.kind !== f.kind || s.spot !== f.spot) {
        // New fault in this slot: its picture, and its name as big as fits.
        s.kind = f.kind; s.spot = f.spot;
        s.ghost.setTexture(`icon-${part.icon}`);
        s.title.setText(part.fault.toUpperCase()).setFontSize(26);
        this.fit(s.title);
        s.needs.setText(`needs ${part.name}`);
      }
      s.ghost.setPosition(p.x, p.y).setVisible(true);
      s.title.setColor(urgent ? COLORS.badCss : COLORS.warnCss).setPosition(p.x, p.y - 70).setVisible(true);
      s.needs.setPosition(p.x, p.y + 66).setVisible(true);
    }
    if (this.foggy) this.drawFog();
  }
}
