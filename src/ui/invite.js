// The Invite panel: the crew code in big letters, a QR code, and a Share button.
// The QR code and the shared link both open the web game already in this crew, so a friend
// who doesn't have the app can scan it with their camera and play. Tap outside to close.
import qrcode from 'qrcode-generator';
import { view } from '../view.js';
import { COLORS, SITE } from '../config/settings.js';
import { state } from '../net.js';
import { NATIVE, share } from '../native.js';
import { text, button } from './widgets.js';

// On the live site and in the apps, links point at the live site. On a test server
// (npm start / npm run dev) they point back at that server so phones on the Wi-Fi can join it.
export const inviteLink = () => `${NATIVE || location.hostname.endsWith('onyxmueller.net') ? SITE : location.origin}/?crew=${state.crew}`;

export function openInvite(scene) {
  const { W, H } = view, link = inviteLink();
  const pw = Math.min(W - 20, 340);
  const blocker = scene.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setDepth(19).setInteractive();
  const panel = scene.add.container(W / 2, 0).setDepth(20);
  let y = 26;

  panel.add(text(scene, 0, y, 'CREW CODE', { size: 12, color: COLORS.faint })); y += 40;
  panel.add(text(scene, 0, y, state.crew.split('').join(' '), { size: 46, weight: '800' })); y += 44;

  // QR code, drawn square by square on a white card.
  const qr = qrcode(0, 'M');
  qr.addData(link); qr.make();
  const n = qr.getModuleCount(), size = Math.min(pw - 80, 220), cell = size / (n + 8); // 4 cells of white border, which scanners expect
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1).fillRoundedRect(-size / 2, y, size, size, 8);
  g.fillStyle(0x000000, 1);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (qr.isDark(r, c)) g.fillRect(-size / 2 + (c + 4) * cell, y + (r + 4) * cell, cell + 0.3, cell + 0.3);
  }
  panel.add(g); y += size + 22;

  panel.add(text(scene, 0, y, 'Friends can type the code in the app,\nor scan this with their camera to play right away.',
    { size: 12, color: COLORS.dim }).setWordWrapWidth(pw - 36));
  y += 44;

  const shareBtn = button(scene, 'Share invite link', async () => {
    const result = await share(link, `Join my crew on Portals! Code: ${state.crew}`);
    if (result === 'copied') shareBtn.setLabel('Link copied');
    else if (result === 'failed') shareBtn.setLabel(link.replace(/^https?:\/\//, ''));
  }, { w: pw - 60, h: 48 });
  panel.add(shareBtn); shareBtn.setPosition(0, y); y += 44;

  const bg = scene.add.rectangle(0, y / 2, pw, y, COLORS.panel, 0.98).setStrokeStyle(1, COLORS.line).setInteractive();
  panel.addAt(bg, 0);
  panel.y = Math.max(view.safeTop + 10, (H - y) / 2);

  function close() {
    scene.events.off('shutdown', close);
    blocker.destroy(); panel.destroy();
  }
  scene.events.once('shutdown', close);
  blocker.on('pointerup', close);
}
