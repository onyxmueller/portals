// The screen, measured in points (the same units CSS uses). The canvas itself is drawn at the
// phone's full pixel resolution and every scene's camera is zoomed by DPR, so all game code
// can think in points and still look sharp.
//
// The game is always played wide (landscape):
//   - a screen that's already wide is filled
//   - a phone held upright gets the game drawn sideways, so the player turns the phone (this
//     works even when the phone's rotation lock is on)
//   - a tablet held upright gets a wide game across the middle, with bars above and below;
//     turning it just fills more of the screen
export const DPR = Math.min(window.devicePixelRatio || 1, 3);

const TABLET = 600;  // a screen whose shorter side is at least this many points counts as a tablet
const WIDE = 0.64;   // on an upright tablet, the game's height as a share of its width

// W and H are the game's size. The safe numbers are how far in from each edge of the game
// the notch, rounded corners or home bar reach. `sideways` is true when the game is drawn
// turned a quarter turn (see pagePoint).
export const view = { W: 0, H: 0, safeTop: 0, safeBottom: 0, safeLeft: 0, safeRight: 0, sideways: false };

export function measure() {
  const w = window.innerWidth, h = window.innerHeight;
  const probe = getComputedStyle(document.getElementById('probe')), box = document.getElementById('game').style;
  const inset = (side) => parseFloat(probe[`padding${side}`]) || 0;
  const top = inset('Top'), right = inset('Right'), bottom = inset('Bottom'), left = inset('Left');

  if (w >= h) {
    Object.assign(view, { W: w, H: h, sideways: false, safeTop: top, safeRight: right, safeBottom: bottom, safeLeft: left });
    Object.assign(box, { left: '0', top: '0', width: `${w}px`, height: `${h}px`, transform: 'none' });
  } else if (w >= TABLET) {
    const H = Math.round(w * WIDE);
    Object.assign(view, { W: w, H, sideways: false, safeTop: 0, safeRight: right, safeBottom: 0, safeLeft: left });
    Object.assign(box, { left: '0', top: `${Math.round((h - H) / 2)}px`, width: `${w}px`, height: `${H}px`, transform: 'none' });
  } else {
    // Drawn a quarter turn clockwise: the game's left edge is the top of the upright phone,
    // and the game's top edge is the phone's right side.
    Object.assign(view, { W: h, H: w, sideways: true, safeLeft: top, safeTop: right, safeRight: bottom, safeBottom: left });
    Object.assign(box, { left: '0', top: '0', width: `${h}px`, height: `${w}px`, transform: `translateX(${w}px) rotate(90deg)` });
  }
}

// Where a touch on the page lands in the game, when the game is drawn sideways.
export const pagePoint = (pageX, pageY) => ({ x: pageY, y: window.innerWidth - pageX });

// Call at the top of every scene's create().
export function setupCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(DPR);
}
