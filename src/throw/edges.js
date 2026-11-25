// Which crewmate does each part of the screen edge lead to?
//
// Two ways of mapping, chosen for the whole crew in Settings:
//   neighbors  left edge = the player before me, right edge = the player after me
//   portals    the left, top and right edges are treated as one long strip
//              (up the left side, across the top, down the right side) and split
//              evenly between everyone else
// The bottom edge never leads anywhere.
import { view } from '../view.js';
import { state, others } from '../net.js';

// Portals mode: who owns which stretch of the strip. t runs from 0 (bottom-left) to 2H+W (bottom-right).
export function segments() {
  const o = others().reverse(), L = 2 * view.H + view.W;
  return o.map((p, i) => ({ p, t0: (i * L) / o.length, t1: ((i + 1) * L) / o.length }));
}

// Position along the strip for a point on the given edge.
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

// The crewmate a part reaches if it leaves through `edge` ('L', 'R', 'T' or 'B') at (x, y).
export function targetFor(edge, x, y) {
  const o = others();
  if (!o.length || edge === 'B') return null;
  if (state.mode === 'neighbors') {
    if (edge === 'R') return o[0];
    if (edge === 'L') return o[o.length - 1];
    return null;
  }
  const t = stripPos(edge, x, y);
  const s = segments().find((s) => t >= s.t0 && t <= s.t1);
  return s ? s.p : null;
}

// The stretches of edge to draw, as { p, t0, t1 }, for whichever mode is on.
export function portals() {
  const o = others(), { W, H } = view;
  if (!o.length) return [];
  if (state.mode === 'neighbors') {
    return [{ p: o[o.length - 1], t0: 0, t1: H }, { p: o[0], t0: H + W, t1: 2 * H + W }];
  }
  return segments();
}
