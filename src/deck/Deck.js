// The deck is the play area of one phone: the parts sliding around on it, the coloured
// portals along its edges, and the dragging and throwing. The lobby and the game both use it.
//
// Parts are plain objects moved by our own physics (step, below); Phaser only draws them.
// That's on purpose: a part leaving through an edge and arriving on another phone is the
// heart of the game, and it isn't something a stock physics engine is built for.
import { view } from '../view.js';
import { SETTINGS, COLORS } from '../config/settings.js';
import { PARTS } from '../config/parts.js';
import { net, state, send, connected, mySelf, others } from '../net.js';
import { targetFor, segments, stripPos, stripPoint, portals } from '../throw/edges.js';
import { text, emoji, hex } from '../ui/widgets.js';
import { sfx, initAudio } from '../audio/sfx.js';
import { buzz, NATIVE } from '../native.js';

const R = SETTINGS.partRadius;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let bannerShownFor = null; // the "Your room is..." banner shows once per room colour

export class Deck {
  constructor(scene) {
    this.scene = scene;
    this.items = [];        // { id, kind, x, y, vx, vy, state: 'in'|'entering'|'leaving', age, held, view, disc }
    this.drags = new Map(); // pointer id -> { it, ox, oy, samples: [{ x, y, t }] }
    this.onStep = null;     // the game scene hooks in here to check faults and the airlock

    this.tint = scene.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setDepth(0);
    this.portalG = scene.add.graphics().setDepth(2);
    this.portalLabels = [];
    this.waiting = text(scene, 0, 0, '', { size: 15, color: COLORS.faint }).setDepth(2);
    this.dot = scene.add.circle(0, 0, 7, 0x555555).setDepth(10);
    this.status = text(scene, 0, 0, '', { size: 13, color: COLORS.dim, align: 'left' }).setOrigin(0, 0.5).setDepth(10);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);

    net.on('room', this.refresh, this);
    net.on('ping', this.refreshStatus, this);
    net.on('throw', this.onThrow, this);
    net.on('spawn', this.onSpawn, this);
    net.on('bounce', this.onBounce, this);
    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', this.destroy, this);

    this.refresh();
  }

  destroy() {
    net.off('room', this.refresh, this);
    net.off('ping', this.refreshStatus, this);
    net.off('throw', this.onThrow, this);
    net.off('spawn', this.onSpawn, this);
    net.off('bounce', this.onBounce, this);
    this.scene.events.off('update', this.update, this);
  }

  // ---------- parts ----------
  add(it) {
    it.vx ??= 0; it.vy ??= 0; it.state ??= 'in'; it.age = 0; it.held = false;
    it.disc = this.scene.add.circle(0, 0, R, COLORS.button);
    const pic = emoji(this.scene, 0, 2, PARTS[it.kind].e, R * 1.15);
    it.view = this.scene.add.container(it.x, it.y, [it.disc, pic]).setDepth(5);
    this.items.push(it);
    return it;
  }

  remove(it) {
    it.view.destroy();
    this.items = this.items.filter((x) => x !== it);
    for (const [id, d] of this.drags) if (d.it === it) this.drags.delete(id);
  }

  clear() {
    for (const it of [...this.items]) this.remove(it);
  }

  // A fresh part of a random kind, somewhere in the middle of the deck.
  spawnRandom() {
    const { W, H } = view;
    return this.add({
      id: `${state.me}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      kind: Math.floor(Math.random() * PARTS.length),
      x: W * (0.25 + Math.random() * 0.5), y: H * (0.3 + Math.random() * 0.4),
    });
  }

  flash(x, y, color) {
    const c = this.scene.add.circle(x, y, R, color, 0.5).setDepth(6);
    this.scene.tweens.add({ targets: c, scale: 3.5, alpha: 0, duration: 400, onComplete: () => c.destroy() });
  }

  // ---------- throwing ----------
  // Called when a part hits an edge moving outward. Returns true if it was handed to a crewmate.
  tryThrow(it, edge) {
    const out = edge === 'L' ? -it.vx : edge === 'R' ? it.vx : edge === 'T' ? -it.vy : it.vy;
    if (out < SETTINGS.flingSpeed || !connected()) return false;
    const p = targetFor(edge, it.x, it.y);
    if (!p) return false;
    const msg = { t: 'throw', to: p.id, mode: state.mode, item: { id: it.id, kind: it.kind } };
    if (state.mode === 'neighbors') {
      // Phones side by side: keep height and velocity, so it reads as one continuous surface.
      msg.edge = edge; msg.u = it.y / view.H; msg.vx = it.vx; msg.vy = it.vy;
    } else {
      // Send where in my portal it left, and its speed split into "out through the edge" and "along the edge".
      const s = segments().find((s) => s.p.id === p.id);
      const t = stripPos(edge, it.x, it.y), q = stripPoint(t);
      msg.f = (t - s.t0) / (s.t1 - s.t0); msg.n = out; msg.s = it.vx * q.tx + it.vy * q.ty;
    }
    send(msg);
    // The part keeps sliding off-screen here; that animation covers the network delay.
    it.state = 'leaving'; it.age = 0;
    this.flash(it.x, it.y, hex(p.color));
    sfx.send(); buzz('LIGHT');
    return true;
  }

  onThrow(m) {
    const { W, H } = view;
    const it = { id: m.item.id, kind: m.item.kind || 0, state: 'entering' };
    const from = state.players.find((p) => p.id === m.from);
    const s = m.mode === 'portals' ? segments().find((s) => s.p.id === m.from) : null;
    if (m.mode === 'neighbors') {
      it.x = m.edge === 'R' ? -R : W + R; // left their right edge, so it arrives on my left edge
      it.y = clamp(m.u * H, R, H - R);
      it.vx = m.vx; it.vy = m.vy;
    } else if (s) {
      // Mirror along the edge, as if we were facing each other across the portal.
      const q = stripPoint(s.t1 - m.f * (s.t1 - s.t0));
      it.x = q.x + q.nx * R; it.y = q.y + q.ny * R;
      it.vx = -q.nx * m.n - q.tx * m.s; it.vy = -q.ny * m.n - q.ty * m.s;
    } else {
      it.x = W / 2; it.y = H / 2; it.state = 'in';
    }
    this.add(it);
    this.flash(clamp(it.x, 0, W), clamp(it.y, 0, H), from ? hex(from.color) : 0xffffff);
    sfx.receive(); buzz('MEDIUM');
  }

  onSpawn(m) {
    const { W, H } = view;
    const it = this.add({ id: m.item.id, kind: m.item.kind,
      x: W * (0.2 + Math.random() * 0.6), y: H * (0.45 + Math.random() * 0.25) });
    this.flash(it.x, it.y, 0xffffff);
  }

  onBounce(m) {
    this.add({ id: m.item.id, kind: m.item.kind || 0, x: view.W / 2, y: view.H / 2 });
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
      if (it.held) continue;
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
      if (!a.held) { a.x -= nx * push; a.y -= ny * push; }
      if (!b.held) { b.x += nx * push; b.y += ny * push; }
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        if (!a.held) { a.vx += rel * nx; a.vy += rel * ny; }
        if (!b.held) { b.vx -= rel * nx; b.vy -= rel * ny; }
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
      it.disc.setFillStyle(it.held ? COLORS.buttonDown : COLORS.button);
    }
  }

  // ---------- touch ----------
  onDown(pointer, over) {
    initAudio();
    if (over.length) return; // the finger is on a button or a panel
    let hit = null;
    for (const it of this.items) {
      if (it.state !== 'in' || it.held) continue;
      if (Math.hypot(pointer.worldX - it.x, pointer.worldY - it.y) <= R * 1.35) hit = it;
    }
    if (!hit) return;
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
  // Call when the crew, the mode or the screen size changes.
  refresh() {
    const { W, H } = view, self = mySelf(), o = others();

    // The whole deck is tinted with my room's colour, so crewmates can match the portal on
    // their screen to this phone.
    this.tint.setSize(W, H).setFillStyle(self ? hex(self.color) : 0xffffff, self ? 0.16 : 0);

    // Portals: a coloured band along each stretch of edge, labelled with where it leads.
    const g = this.portalG, T = 12, gap = 5;
    g.clear();
    for (const l of this.portalLabels) l.destroy();
    this.portalLabels = [];
    for (const { p, t0, t1 } of portals()) {
      g.fillStyle(hex(p.color), 1);
      const cuts = [t0, H, H + W, t1].filter((t) => t >= t0 && t <= t1).sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i] + (i === 0 ? gap : 0), b = cuts[i + 1] - (i === cuts.length - 2 ? gap : 0);
        if (b - a < 1) continue;
        const pa = stripPoint(a + 0.01), pb = stripPoint(b - 0.01);
        if (pa.nx !== 0) g.fillRect(pa.nx < 0 ? 0 : W - T, Math.min(pa.y, pb.y), T, Math.abs(pb.y - pa.y));
        else g.fillRect(Math.min(pa.x, pb.x), 0, Math.abs(pb.x - pa.x), T);
      }
      const m = stripPoint((t0 + t1) / 2);
      const label = text(this.scene, m.x - m.nx * 28, m.y - m.ny * 28, `to ${p.name}`, { size: 15, weight: '700', color: p.color })
        .setRotation(m.nx < 0 ? -Math.PI / 2 : m.nx > 0 ? Math.PI / 2 : 0).setDepth(2);
      this.portalLabels.push(label);
    }

    this.waiting.setPosition(W / 2, H * 0.66)
      .setText(o.length || !self ? '' : `Waiting for more crew to join…\n${NATIVE ? 'portals.onyxmueller.net' : location.host}`);

    const sy = H - view.safeBottom - 28;
    this.dot.setPosition(19, sy).setFillStyle(self ? hex(self.color) : 0x555555);
    this.status.setPosition(34, sy);
    this.refreshStatus();

    for (const it of this.items) if (it.state === 'in') { it.x = clamp(it.x, R, W - R); it.y = clamp(it.y, R, H - R); }

    if (self && self.color !== bannerShownFor) { bannerShownFor = self.color; this.banner(self); }
  }

  refreshStatus() {
    const self = mySelf();
    const ping = state.pingMs != null ? `\n${state.pingMs}ms (worst ${Math.max(...state.pings)})` : '';
    this.status.setText(state.full ? 'The ship is full (8 crew)'
      : self ? `${self.name} · ${state.players.length} aboard${ping}` : 'Connecting…');
  }

  // Big "Your room is Engine" for a few seconds after joining.
  banner(self) {
    const { W, H } = view;
    const a = text(this.scene, W / 2, H * 0.36, 'Your room is', { size: 20, weight: '500' }).setDepth(4);
    const b = text(this.scene, W / 2, H * 0.36 + 52, self.name, { size: 64, weight: '800', color: self.color }).setDepth(4);
    this.scene.tweens.add({ targets: [a, b], alpha: 0, delay: 3000, duration: 1000,
      onComplete: () => { a.destroy(); b.destroy(); } });
  }
}
