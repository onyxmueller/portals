// The deck is the play area of one phone: the parts sliding around on it, the portals along
// its edges, and the dragging and throwing. The lobby and the game both use it.
//
// Parts are plain objects moved by our own physics (step, below); Phaser only draws them.
// That's on purpose: a part leaving through an edge and arriving on another phone is the
// heart of the game, and it isn't something a stock physics engine is built for.
import { view } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { PARTS, FIXERS } from '../config/parts.js';
import { STATIONS } from '../config/stations.js';
import { net, state, send, connected, mySelf, others } from '../net.js';
import { portals, portalAt, portalFrom, stripPos, stripPoint, edgeOf } from '../throw/edges.js';
import { text, icon, hex, disc } from '../ui/widgets.js';
import { roomIcon } from '../ui/icons.js';
import { sfx, initAudio } from '../audio/sfx.js';
import { buzz } from '../native.js';

const R = SETTINGS.partRadius;
const DOOR = 40;          // radius of the half-round "door" that pokes in from the edge for each crewmate
const PLANET = 58;        // how far the planet strip rises from the bottom of the screen (at its middle)
const DIP = 16;           // how much lower the planet's edge is at the sides of the screen than in the middle
const BADGE_SPEED = 150;  // how fast a badge must leave the screen to count as pointing (gentler than a throw)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let bannerShownFor = null; // the "Your room is..." banner shows once per room colour

export class Deck {
  constructor(scene) {
    this.scene = scene;
    this.items = [];        // { id, kind, x, y, vx, vy, state: 'in'|'entering'|'leaving', age, held, docked, view, disc, pic }
                            // a "docked" part is sitting on a station: it stays put and can't be picked up
                            // a "badge" item has .badge = a crewmate instead of .kind (see the lobby)
    this.drags = new Map(); // pointer id -> { it, ox, oy, samples: [{ x, y, t }] }
    this.onStep = null;     // the game scene hooks in here to check faults and the airlock
    this.onBadge = null;    // called with (crewmate, x, y) when a badge is flung off an edge
    this.onTap = null;      // called with (x, y, pointer) when a finger goes down on empty deck
    this.briefStatus = false; // true while flying: the status line leaves room for the hull bar
    this.hidePortals = false;

    this.backG = scene.add.graphics().setDepth(0); // the backdrop: an orbit line, and a planet along the bottom
    this.portalG = scene.add.graphics().setDepth(2);
    this.portalBits = [];   // the icons and names drawn on the portals
    this.doorSpots = [];
    this.doors = new Map(); // player id -> where their door is, for speech bubbles: { x, y, nx, ny }
    this.status = text(scene, 0, 0, '', { size: 13, weight: '700', color: COLORS.onPlanet, align: 'left' }).setOrigin(0, 0.5).setDepth(10);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);

    net.on('room', this.refresh, this);
    net.on('online', this.refreshStatus, this);
    net.on('ping', this.refreshStatus, this);
    net.on('throw', this.onThrow, this);
    net.on('spawn', this.onSpawn, this);
    net.on('bounce', this.onBounce, this);
    net.on('ask', this.onAsk, this);
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', this.destroy, this);

    this.refresh();
  }

  destroy() {
    net.off('room', this.refresh, this);
    net.off('online', this.refreshStatus, this);
    net.off('ping', this.refreshStatus, this);
    net.off('throw', this.onThrow, this);
    net.off('spawn', this.onSpawn, this);
    net.off('bounce', this.onBounce, this);
    net.off('ask', this.onAsk, this);
    this.scene.events.off('update', this.update, this);
  }

  // ---------- parts ----------
  add(it) {
    it.vx ??= 0; it.vy ??= 0; it.state ??= 'in'; it.age = 0; it.held = false;
    // Anything you can pick up is a disc with a hard shadow, and nothing else on screen is.
    // Parts are cream; a badge (pointing out the crew) is its crewmate's colour.
    it.shadow = this.scene.add.circle(5, 5, R, COLORS.shadow);
    it.disc = this.scene.add.circle(0, 0, R, it.badge ? hex(it.badge.color) : COLORS.cream);
    it.pic = icon(this.scene, 0, 0, it.badge ? roomIcon(it.badge.name) : PARTS[it.kind].icon, R * 1.15);
    it.view = this.scene.add.container(it.x, it.y, [it.shadow, it.disc, it.pic]).setDepth(5);
    this.items.push(it);
    return it;
  }

  remove(it) {
    it.view.destroy();
    this.items = this.items.filter((x) => x !== it);
    for (const [id, d] of this.drags) if (d.it === it) this.drags.delete(id);
  }

  // Turn a part into a different part (a station has finished working on it).
  setKind(it, kind) {
    it.kind = kind;
    it.pic.setTexture(`icon-${PARTS[kind].icon}`);
  }

  clear() {
    for (const it of [...this.items]) this.remove(it);
  }

  // A fresh part of a random kind, somewhere in the middle of the deck.
  spawnRandom() {
    const { W, H } = view;
    return this.add({
      id: `${state.me}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      kind: FIXERS[Math.floor(Math.random() * FIXERS.length)],
      x: W * (0.3 + Math.random() * 0.4), y: H * (0.5 + Math.random() * 0.2),
    });
  }

  // A ring that grows out of a door when something comes through it.
  pulse(x, y, color) {
    for (const delay of [0, 120]) {
      const c = this.scene.add.circle(x, y, DOOR, 0, 0).setStrokeStyle(4, color, 1).setDepth(3);
      this.scene.tweens.add({ targets: c, scale: 1.7, alpha: 0, delay, duration: 420, onComplete: () => c.destroy() });
    }
  }

  flash(x, y, color) {
    const c = this.scene.add.circle(x, y, R, color, 0.5).setDepth(6);
    this.scene.tweens.add({ targets: c, scale: 3.5, alpha: 0, duration: 400, onComplete: () => c.destroy() });
  }

  // ---------- throwing ----------
  // Called when a part hits an edge moving outward. Returns true if it left the screen.
  tryThrow(it, edge) {
    const out = edge === 'L' ? -it.vx : edge === 'R' ? it.vx : edge === 'T' ? -it.vy : it.vy;

    // A badge isn't sent anywhere: flinging it off an edge just tells us which way a crewmate is.
    if (it.badge) {
      if (edge === 'B' || out < BADGE_SPEED) return false;
      it.state = 'leaving'; it.age = 0;
      this.flash(it.x, it.y, hex(it.badge.color));
      sfx.send(); buzz('LIGHT');
      if (this.onBadge) this.onBadge(it.badge, it.x, it.y);
      return true;
    }

    if (out < SETTINGS.flingSpeed || !connected()) return false;
    const portal = portalAt(edge, it.x, it.y);
    if (!portal || portal.p.away) return false; // nobody there to catch it
    // Say where in the portal it left, and its speed split into "out through the edge" and
    // "along the edge". The other phone turns that into an arrival through its portal for me.
    const t = stripPos(edge, it.x, it.y), q = stripPoint(t);
    send({
      t: 'throw', to: portal.p.id, item: { id: it.id, kind: it.kind }, edge,
      f: (t - portal.t0) / (portal.t1 - portal.t0), n: out, s: it.vx * q.tx + it.vy * q.ty,
    });
    // The part keeps sliding off-screen here; that animation covers the network delay.
    it.state = 'leaving'; it.age = 0;
    this.flash(it.x, it.y, hex(portal.p.color));
    sfx.send(); buzz('LIGHT');
    return true;
  }

  onThrow(m) {
    const { W, H } = view;
    const it = { id: m.item.id, kind: m.item.kind || 0, state: 'entering' };
    const from = state.players.find((p) => p.id === m.from);
    const portal = portalFrom(m.from, m.edge);
    if (portal) {
      // Mirrored along the edge, as if we were facing each other through the portal. For two
      // phones side by side that keeps the part at the same height, moving the same way.
      const q = stripPoint(portal.t1 - m.f * (portal.t1 - portal.t0));
      it.x = q.x + q.nx * R; it.y = q.y + q.ny * R;
      it.vx = -q.nx * m.n - q.tx * m.s; it.vy = -q.ny * m.n - q.ty * m.s;
    } else {
      it.x = W / 2; it.y = H / 2; it.state = 'in';
    }
    // Arrive at a steady speed however hard it was thrown, keeping its direction. Otherwise
    // a hard throw sails straight across this phone and out the far side to someone else.
    const speed = Math.hypot(it.vx || 0, it.vy || 0);
    if (SETTINGS.arrivalSpeed > 0 && speed > 0) {
      it.vx *= SETTINGS.arrivalSpeed / speed; it.vy *= SETTINGS.arrivalSpeed / speed;
    }
    this.add(it);
    // A fading trail back the way it came, and a pulse on the door it came through.
    const sp = Math.hypot(it.vx, it.vy) || 1, ux = it.vx / sp, uy = it.vy / sp;
    for (let i = 1; i <= 3; i++) {
      const ghost = this.scene.add.circle(it.x - ux * i * 26, it.y - uy * i * 26, R * (1 - i * 0.13), COLORS.cream, 0.5 - i * 0.12).setDepth(4);
      this.scene.tweens.add({ targets: ghost, alpha: 0, x: ghost.x + ux * 60, y: ghost.y + uy * 60, duration: 320, onComplete: () => ghost.destroy() });
    }
    const door = this.doors.get(m.from);
    if (door) this.pulse(door.cx, door.cy, from ? hex(from.color) : COLORS.cream);
    else this.flash(clamp(it.x, 0, W), clamp(it.y, 0, H), from ? hex(from.color) : COLORS.cream);
    sfx.receive(); buzz('MEDIUM');
  }

  onSpawn(m) {
    const { W, H } = view;
    const it = this.add({ id: m.item.id, kind: m.item.kind,
      x: W * (0.25 + Math.random() * 0.5), y: H * (0.5 + Math.random() * 0.2) });
    this.flash(it.x, it.y, COLORS.cream);
  }

  onBounce(m) {
    this.add({ id: m.item.id, kind: m.item.kind || 0, x: view.W / 2, y: view.H / 2 });
  }

  // A crewmate tapped their fault: show what they need in a bubble at their door for a few seconds.
  onAsk(m) {
    const door = this.doors.get(m.from), p = state.players.find((x) => x.id === m.from), part = PARTS[m.kind];
    if (!door || !p || !part) return;
    const scene = this.scene;
    // A speech bubble in the asker's colour, growing out of their door.
    const label = text(scene, 14, 0, `${part.name}!`, { size: 18, weight: '900', color: COLORS.inkCss });
    const w = label.width + 58, h = 46;
    label.setX(-w / 2 + 44 + label.width / 2);
    const pic = icon(scene, -w / 2 + 25, 0, part.icon, 26);
    const x = clamp(door.x - door.nx * (DOOR * 0.6 + 10 + w / 2), w / 2 + 8, view.W - w / 2 - 8);
    const y = clamp(door.y - door.ny * (DOOR * 0.6 + 10 + h / 2) - (door.ny ? 0 : DOOR * 0.7), h / 2 + 8, view.H - h / 2 - 8);
    const bg = scene.add.graphics();
    bg.fillStyle(hex(p.color), 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const bubble = scene.add.container(x, y, [bg, pic, label]).setDepth(9).setScale(0.6);
    scene.tweens.add({ targets: bubble, scale: 1, duration: 160, ease: 'Back.Out' });
    scene.tweens.add({ targets: bubble, alpha: 0, delay: 3500, duration: 500, onComplete: () => bubble.destroy() });
    this.pulse(door.cx, door.cy, hex(p.color));
    sfx.fault(); buzz('LIGHT');
  }

  // ---------- physics ----------
  update(time, deltaMs) {
    this.step(Math.min(0.033, deltaMs / 1000));
  }

  step(dt) {
    const { W, H } = view;
    const decay = Math.exp(-SETTINGS.friction * dt), B = -SETTINGS.bounce;
    for (const it of this.items) {
      it.age += dt;
      if (it.held || it.docked) continue;
      it.x += it.vx * dt; it.y += it.vy * dt;
      it.vx *= decay; it.vy *= decay;

      if (it.state === 'leaving') continue;
      if (it.state === 'entering') {
        const inside = it.x >= R && it.x <= W - R && it.y >= R && it.y <= H - R;
        if (inside) it.state = 'in';
        else if (it.age > 1) { it.x = clamp(it.x, R, W - R); it.y = clamp(it.y, R, H - R); it.state = 'in'; }
      }
      // Walls only matter when moving outward. A part still entering bounces but can't be re-thrown yet.
      const can = it.state === 'in';
      if (it.x < R && it.vx < 0 && !(can && this.tryThrow(it, 'L'))) { it.x = R; it.vx *= B; }
      else if (it.x > W - R && it.vx > 0 && !(can && this.tryThrow(it, 'R'))) { it.x = W - R; it.vx *= B; }
      if (it.state === 'leaving') continue;
      if (it.y < R && it.vy < 0 && !(can && this.tryThrow(it, 'T'))) { it.y = R; it.vy *= B; }
      else if (it.y > H - R && it.vy > 0) { it.y = H - R; it.vy *= B; }
    }

    // Parts bump into each other (equal weight). A cluttered deck makes clean throws harder.
    const solid = this.items.filter((it) => it.state === 'in');
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= 2 * R || d === 0) continue;
      const nx = dx / d, ny = dy / d, push = (2 * R - d) / 2;
      const af = a.held || a.docked, bf = b.held || b.docked; // fixed in place: the other one moves
      if (!af) { a.x -= nx * push; a.y -= ny * push; }
      if (!bf) { b.x += nx * push; b.y += ny * push; }
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        if (!af) { a.vx += rel * nx; a.vy += rel * ny; }
        if (!bf) { b.vx -= rel * nx; b.vy -= rel * ny; }
      }
    }

    if (this.onStep) this.onStep();

    // Parts that have finished sliding off-screen are gone.
    for (const it of [...this.items]) {
      if (it.state === 'leaving' && (it.age > 1 || it.x < -2 * R || it.x > W + 2 * R || it.y < -2 * R || it.y > H + 2 * R)) {
        this.remove(it);
      }
    }
    for (const it of this.items) {
      it.view.setPosition(it.x, it.y).setScale(it.held ? 1.08 : 1);
      it.shadow.setPosition(it.held ? 9 : 5, it.held ? 9 : 5); // a held part lifts off the deck
    }
  }

  // ---------- touch ----------
  onDown(pointer, over) {
    initAudio();
    if (over.length) return; // the finger is on a button or a panel
    let hit = null;
    for (const it of this.items) {
      if (it.state !== 'in' || it.held || it.docked) continue;
      if (Math.hypot(pointer.worldX - it.x, pointer.worldY - it.y) <= R * 1.35) hit = it;
    }
    if (!hit) { if (this.onTap) this.onTap(pointer.worldX, pointer.worldY, pointer); return; }
    hit.held = true; hit.vx = hit.vy = 0;
    this.items.splice(this.items.indexOf(hit), 1); this.items.push(hit);
    this.scene.children.bringToTop(hit.view);
    this.drags.set(pointer.id, { it: hit, ox: hit.x - pointer.worldX, oy: hit.y - pointer.worldY,
      samples: [{ x: pointer.worldX, y: pointer.worldY, t: performance.now() }] });
  }

  onMove(pointer) {
    const d = this.drags.get(pointer.id);
    if (!d) return;
    const now = performance.now();
    d.it.x = clamp(pointer.worldX + d.ox, R, view.W - R);
    d.it.y = clamp(pointer.worldY + d.oy, R, view.H - R);
    d.samples.push({ x: pointer.worldX, y: pointer.worldY, t: now });
    while (d.samples.length > 2 && now - d.samples[0].t > 90) d.samples.shift();
  }

  onUp(pointer) {
    const d = this.drags.get(pointer.id);
    if (!d) return;
    this.drags.delete(pointer.id);
    d.it.held = false;
    // Throw speed = average finger speed over the last ~90ms.
    const a = d.samples[0], b = d.samples[d.samples.length - 1], dt = (b.t - a.t) / 1000;
    if (dt > 0.005 && performance.now() - b.t < 80) {
      let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      const sp = Math.hypot(vx, vy), max = SETTINGS.maxThrowSpeed;
      if (sp > max) { vx *= max / sp; vy *= max / sp; }
      d.it.vx = vx; d.it.vy = vy;
    }
  }

  // ---------- drawing the fixed parts ----------
  // How far in from an edge ('T', 'L' or 'R') a door must sit to clear the notch and rounded corners.
  static inset(edge) { return Math.max(0, (edge === 'T' ? view.safeTop : edge === 'L' ? view.safeLeft : view.safeRight) - 8); }
  // The planet strip along the bottom: where its top is (in the middle of the screen), and
  // the height of the row of words and buttons that sits on it.
  static rise() { return view.H - view.safeBottom - PLANET; }
  static rowY() { return view.H - view.safeBottom - 25; }

  // Call when the crew, the mode, where I pointed, the stations or the screen size changes.
  refresh() {
    const { W, H } = view, self = mySelf(), o = others();

    // Backdrop. The planet along the bottom is my room's colour, so crewmates can match the
    // door on their screen to this phone. Nothing else sits behind the play area but a faint orbit.
    const back = this.backG, rise = Deck.rise(), pr = (W * W / 4 + DIP * DIP) / (2 * DIP);
    back.clear();
    disc(back.lineStyle(2, COLORS.button, 1), W / 2, H * 0.5, H * 0.62, { stroke: true });
    disc(back.fillStyle(self ? hex(self.color) : COLORS.planet, 1), W / 2, rise + pr, pr);

    // Doors: each crewmate has a half-round door in their colour poking in from the edge at the
    // spot that points at them, with their room's picture in it, and a thin band of their colour
    // along the whole stretch of edge that leads to them.
    const g = this.portalG, T = 6, gap = 5;
    g.clear();
    for (const b of this.portalBits) b.destroy();
    this.portalBits = [];
    this.doors.clear();
    this.doorSpots = []; // every door drawn (one crewmate can have two)
    for (const { p, t0, t1, door } of this.hidePortals ? [] : portals()) {
      const color = hex(p.color), alpha = p.away ? 0.3 : 1; // a crewmate who dropped out keeps their place, dimmed
      g.fillStyle(color, alpha);
      const cuts = [t0, H, H + W, t1].filter((t) => t >= t0 && t <= t1).sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i] + (i === 0 ? gap : 0), b = cuts[i + 1] - (i === cuts.length - 2 ? gap : 0);
        if (b - a < 1) continue;
        const pa = stripPoint(a + 0.01), pb = stripPoint(b - 0.01);
        if (pa.nx !== 0) g.fillRect(pa.nx < 0 ? 0 : W - T, Math.min(pa.y, pb.y), T, Math.abs(pb.y - pa.y));
        else g.fillRect(Math.min(pa.x, pb.x), 0, Math.abs(pb.x - pa.x), T);
      }

      // The door itself: kept clear of the corners and the planet, and pushed in past the notch.
      const m = stripPoint(door), edge = edgeOf(door), top = edge === 'T', inset = Deck.inset(edge);
      const cx = top ? clamp(m.x, view.safeLeft + DOOR + 8, W - view.safeRight - DOOR - 8) : m.x - m.nx * inset;
      const cy = top ? inset : clamp(m.y, DOOR + Deck.inset('T') + 12, rise - DOOR - 26);
      if (inset > 0) top ? g.fillRect(cx - DOOR, 0, DOOR * 2, inset) : g.fillRect(m.nx < 0 ? 0 : W - inset, cy - DOOR, inset, DOOR * 2);
      g.fillCircle(cx, cy, DOOR);
      const ix = top ? cx : cx - m.nx * DOOR * 0.48, iy = top ? cy + DOOR * 0.48 : cy; // where the picture sits
      this.portalBits.push(icon(this.scene, ix, iy, roomIcon(p.name), 26).setDepth(2).setAlpha(p.away ? 0.5 : 1));
      const station = (state.game.stations || []).find((s) => s.owner === p.id);
      const words = (p.away ? `${p.name} is away` : p.name) + (station && STATIONS[station.type] ? `\n${STATIONS[station.type].name} here` : '');
      const name = text(this.scene, 0, 0, words, { size: 14, weight: '700', color: p.color, align: top ? 'left' : m.nx < 0 ? 'left' : 'right' })
        .setDepth(2).setAlpha(p.away ? 0.6 : 1);
      // The name sits beside the door: to its right on the top edge, under it on the sides.
      if (top) name.setOrigin(0, 0).setPosition(cx + DOOR + 8, inset + 8);
      else name.setOrigin(m.nx < 0 ? 0 : 1, 0).setPosition(m.nx < 0 ? inset + 10 : W - inset - 10, cy + DOOR + 5);
      this.portalBits.push(name);
      this.doors.set(p.id, { x: ix, y: iy, cx, cy, nx: m.nx, ny: m.ny });
      this.doorSpots.push({ cx, cy });
    }

    this.status.setPosition(view.safeLeft + 16, Deck.rowY()); // on the planet, at the left
    this.refreshStatus();

    for (const it of this.items) if (it.state === 'in') { it.x = clamp(it.x, R, W - R); it.y = clamp(it.y, R, H - R); }

    if (self && self.color !== bannerShownFor) { bannerShownFor = self.color; this.banner(self); }
  }

  refreshStatus() {
    const self = mySelf();
    const ping = state.pingMs != null && !this.briefStatus ? ` · ${state.pingMs}ms (worst ${Math.max(...state.pings)})` : '';
    const here = state.players.filter((p) => !p.away).length;
    this.status.setText(!state.online ? 'Reconnecting…' : self ? `${self.name} · ${here} aboard${ping}` : 'Connecting…');
  }

  // Big "Your room is Engine" for a few seconds after joining.
  banner(self) {
    const { W, H } = view;
    const a = text(this.scene, W / 2, H * 0.42, 'Your room is', { size: 20, weight: '500' }).setDepth(4);
    const b = text(this.scene, W / 2, H * 0.42 + 52, self.name.toUpperCase(), { size: 56, weight: '900', color: self.color, spacing: 2 }).setDepth(4);
    this.scene.tweens.add({ targets: [a, b], alpha: 0, delay: 3000, duration: 1000,
      onComplete: () => { a.destroy(); b.destroy(); } });
  }
}
