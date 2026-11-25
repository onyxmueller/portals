// Small building blocks every screen uses: sharp text and buttons.
import Phaser from 'phaser';
import { DPR } from '../view.js';
import { COLORS } from '../config/settings.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const EMOJI_FONT = 'system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const hex = (css) => Phaser.Display.Color.HexStringToColor(css).color;

// Text that stays sharp on high-resolution screens. `weight` is a CSS font weight.
export function text(scene, x, y, str, { size = 14, color = COLORS.text, weight = '400', align = 'center' } = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color, align })
    .setResolution(DPR).setOrigin(0.5);
}

export function emoji(scene, x, y, str, size) {
  return scene.add.text(x, y, str, { fontFamily: EMOJI_FONT, fontSize: `${size}px`, padding: { x: 4, y: 8 } })
    .setResolution(DPR).setOrigin(0.5);
}

// A rounded button. Returns a container: position it with setPosition, and use
// setOn(true) to show it as selected or setLabel('...') to change its words.
export function button(scene, label, onClick, { w, h = 40, depth = 10 } = {}) {
  const t = text(scene, 0, 0, label);
  const bw = w || Math.ceil(t.width + 28);
  const g = scene.add.graphics();
  const c = scene.add.container(0, 0, [g, t]).setDepth(depth).setSize(bw, h).setInteractive();
  c.bw = bw; c.bh = h;
  let on = false;
  const paint = (down) => {
    g.clear();
    g.fillStyle(on ? 0xe9ecef : down ? COLORS.buttonDown : COLORS.button, 1);
    g.fillRoundedRect(-bw / 2, -h / 2, bw, h, 10);
    g.lineStyle(1, on ? 0xe9ecef : COLORS.line, 1);
    g.strokeRoundedRect(-bw / 2, -h / 2, bw, h, 10);
    t.setColor(on ? '#14161c' : COLORS.text);
  };
  c.on('pointerdown', () => paint(true));
  c.on('pointerout', () => paint(false));
  c.on('pointerup', () => { paint(false); onClick(); });
  c.setOn = (v) => { on = v; paint(false); return c; };
  c.setLabel = (s) => { t.setText(s); return c; };
  paint(false);
  return c;
}

// Lay buttons out in a row that ends at `right`, vertically centred on `y`.
export function rowFromRight(buttons, right, y, gap = 8) {
  let x = right;
  for (const b of buttons.filter((b) => b.visible).reverse()) {
    b.setPosition(x - b.bw / 2, y);
    x -= b.bw + gap;
  }
}
