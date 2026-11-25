// Things that differ between the phone apps (Capacitor) and a web browser.
const cap = window.Capacitor;

export const NATIVE = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

const Haptics = NATIVE && cap.Plugins ? cap.Plugins.Haptics : null;

// A short tap you can feel. 'LIGHT' when sending, 'MEDIUM' when receiving or fixing.
export function buzz(style) {
  if (Haptics) Haptics.impact({ style }).catch(() => {});
  else if (navigator.vibrate) navigator.vibrate(style === 'LIGHT' ? 8 : 20);
}

// Hand a link to the phone's share sheet (Messages, AirDrop...). Where there is no share
// sheet, copy it instead. Resolves to 'shared', 'copied' or 'failed'.
export async function share(url, text) {
  try {
    const Share = NATIVE && cap.Plugins ? cap.Plugins.Share : null;
    if (Share) { await Share.share({ text, url }); return 'shared'; }
    if (navigator.share) { await navigator.share({ text, url }); return 'shared'; }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (err) {
    return err && err.name === 'AbortError' ? 'shared' : 'failed'; // closing the share sheet isn't a failure
  }
}
