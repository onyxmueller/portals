// The screen, measured in points (the same units CSS uses). The canvas itself is drawn at the
// phone's full pixel resolution and every scene's camera is zoomed by DPR, so all game code
// can think in points and still look sharp.
export const DPR = Math.min(window.devicePixelRatio || 1, 3);

export const view = { W: 0, H: 0, safeTop: 0, safeBottom: 0 };

export function measure() {
  view.W = window.innerWidth;
  view.H = window.innerHeight;
  const probe = getComputedStyle(document.getElementById('probe'));
  view.safeTop = parseFloat(probe.paddingTop) || 0;       // notch
  view.safeBottom = parseFloat(probe.paddingBottom) || 0; // home bar
}

// Call at the top of every scene's create().
export function setupCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(DPR);
}
