// Which crewmate does each part of the screen edge lead to?
//
// The left, top and right edges are treated as one long strip: up the left side, across the
// top, down the right side. Position t on the strip runs from 0 (bottom-left corner) to 2H+W
// (bottom-right corner). The bottom edge never leads anywhere.
//
// A "portal" is a stretch of that strip owned by one crewmate, with a "door" somewhere on it
// where their icon is drawn. There are three ways of deciding the portals:
//   pointed    this phone has pointed out where each crewmate sits (throw to calibrate in
//              the lobby). Each door goes where you pointed, and the strip is shared out so
//              every spot leads to the nearest door. Used whenever this phone has pointed.
//   neighbors  left edge = the player before me, right edge = the player after me. (crew-wide)
//   portals    the strip is split evenly between everyone else. (crew-wide)
import { view } from '../view.js';
import { state, others } from '../net.js';

const SAVE = 'portals.aim';
const stripLength = () => 2 * view.H + view.W;
export const edgeOf = (t) => (t < view.H ? 'L' : t < view.H + view.W ? 'T' : 'R');

// ---------- where I pointed ----------
// Kept as angles from the middle of the screen (so they'd still make sense if the screen
// changed shape), per crew, and remembered across reloads.
let aim = null; // { code, me, angles: { playerId: radians } }
try { aim = JSON.parse(localStorage.getItem(SAVE)); } catch {}

function angles() {
  return aim && aim.code === state.crew && aim.me === state.me ? aim.angles : null;
}
export const hasAim = () => !!angles();
export function setAim(newAngles) {
  aim = newAngles ? { code: state.crew, me: state.me, angles: newAngles } : null;
  try { aim ? localStorage.setItem(SAVE, JSON.stringify(aim)) : localStorage.removeItem(SAVE); } catch {}
}

// The direction of a point on the screen, as seen from the middle of the screen.
export const angleOf = (x, y) => Math.atan2(y - view.H / 2, x - view.W / 2);

// Where a direction meets the strip. Directions that point down and out through the bottom
// edge are bent to the bottom of the nearer side.
function stripPosOfAngle(a) {
  const { W, H } = view, cx = W / 2, cy = H / 2, dx = Math.cos(a), dy = Math.sin(a);
  if (dy < 0) {
    const x = cx + dx * (cy / -dy);
    if (x >= 0 && x <= W) return H + x; // top edge
  }
  const left = dx < 0 || (dx === 0 && dy > 0);
  const y = Math.max(0, Math.min(H, cy + dy * (cx / Math.max(1e-6, Math.abs(dx)))));
  return left ? H - y : H + W + y;
}

// ---------- the portals ----------
// Every portal on my screen: { p, t0, t1, door }.
export function portals() {
  const o = others(), { W, H } = view, L = stripLength();
  if (!o.length) return [];
  const pointed = angles();

  if (pointed) {
    const doors = [], missing = [];
    for (const p of o) {
      if (pointed[p.id] != null) doors.push({ p, door: stripPosOfAngle(pointed[p.id]) });
      else missing.push(p);
    }
    // Someone joined after I pointed: put them in the middle of the biggest gap for now.
    for (const p of missing) {
      const marks = [0, ...doors.map((d) => d.door).sort((a, b) => a - b), L];
      let best = 0;
      for (let i = 1; i < marks.length - 1; i++) if (marks[i + 1] - marks[i] > marks[best + 1] - marks[best]) best = i;
      doors.push({ p, door: (marks[best] + marks[best + 1]) / 2 });
    }
    doors.sort((a, b) => a.door - b.door);
    // Share out the strip: each boundary is halfway between two neighbouring doors.
    return doors.map((d, i) => ({
      p: d.p, door: d.door,
      t0: i === 0 ? 0 : (doors[i - 1].door + d.door) / 2,
      t1: i === doors.length - 1 ? L : (d.door + doors[i + 1].door) / 2,
    }));
  }

  if (state.mode === 'neighbors') {
    return [
      { p: o[o.length - 1], t0: 0, t1: H, door: H / 2 },
      { p: o[0], t0: H + W, t1: L, door: H + W + H / 2 },
    ];
  }
  const rev = [...o].reverse(); // so the next player in seating order ends up on my right
  return rev.map((p, i) => ({ p, t0: (i * L) / rev.length, t1: ((i + 1) * L) / rev.length, door: ((i + 0.5) * L) / rev.length }));
}

// Position along the strip for a point on the given edge ('L', 'T' or 'R').
export function stripPos(edge, x, y) {
  const { W, H } = view;
  x = Math.max(0, Math.min(W, x)); y = Math.max(0, Math.min(H, y));
  return edge === 'L' ? H - y : edge === 'T' ? H + x : H + W + y;
}

// The point at position t on the strip, the direction the strip runs there (tx, ty)
// and the direction pointing off the screen (nx, ny).
export function stripPoint(t) {
  const { W, H } = view;
  if (t < H) return { x: 0, y: H - t, tx: 0, ty: -1, nx: -1, ny: 0 };
  if (t < H + W) return { x: t - H, y: 0, tx: 1, ty: 0, nx: 0, ny: -1 };
  return { x: W, y: t - H - W, tx: 0, ty: 1, nx: 1, ny: 0 };
}

// The portal a part goes through if it leaves via `edge` ('L', 'R', 'T' or 'B') at (x, y), or null.
export function portalAt(edge, x, y) {
  if (edge === 'B') return null;
  const t = stripPos(edge, x, y);
  return portals().find((s) => t >= s.t0 && t <= s.t1) || null;
}

// The portal a part from `playerId` should arrive through. With two players in neighbors
// mode the same crewmate is on both sides: a part that left their right edge arrives on my left.
export function portalFrom(playerId, theirEdge) {
  const mine = portals().filter((s) => s.p.id === playerId);
  if (mine.length < 2) return mine[0] || null;
  const want = theirEdge === 'R' ? 'L' : theirEdge === 'L' ? 'R' : 'T';
  return mine.find((s) => edgeOf(s.door) === want) || mine[0];
}
