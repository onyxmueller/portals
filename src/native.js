// Things that differ between the phone apps (Capacitor) and a web browser.
const cap = window.Capacitor;

export const NATIVE = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

const Haptics = NATIVE && cap.Plugins ? cap.Plugins.Haptics : null;

// A short tap you can feel. 'LIGHT' when sending, 'MEDIUM' when receiving or fixing.
export function buzz(style) {
  if (Haptics) Haptics.impact({ style }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(style === 'LIGHT' ? 8 : 20);
}
