// Small building blocks every screen uses: sharp text, pictures and buttons.
import Phaser from 'phaser';
import { DPR } from '../view.js';
import { COLORS } from '../config/settings.js';

const FONT = 'Rubik, system-ui, -apple-system, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace'; // the ship's manual speaks in this

export const hex = (css) => Phaser.Display.Color.HexStringToColor(css).color;

// Text that stays sharp on high-resolution screens. `weight` is a CSS font weight (500, 700
// or 900 for the main face; 400 or 700 with `mono`). `spacing` spreads capitals out a little.
export function text(scene, x, y, str, { size = 14, color = COLORS.text, weight = '500', align = 'center', mono = false, italic = false, spacing = 0 } = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: mono ? MONO : FONT, fontSize: `${size}px`, fontStyle: `${italic ? 'italic ' : ''}${weight}`, color, align,
  }).setResolution(DPR).setOrigin(0.5);
  if (spacing) t.setLetterSpacing(spacing);
  return t;
}

// One of the game's pictures (see icons.js), `size` points across, in any colour.
export function icon(scene, x, y, name, size, color = COLORS.ink) {
  return scene.add.image(x, y, `icon-${name}`).setDisplaySize(size, size).setTint(color);
}

// A pill-shaped button. Returns a container: position it with setPosition, and use
// setOn(true) to show it as selected or setLabel('...') to change its words.
//   kind 'plain'    the everyday button
//   kind 'primary'  the one loud button on a screen (yellow, with a hard shadow)
//   kind 'outline'  a quieter choice
export function button(scene, label, onClick, { w, h = 44, depth = 10, kind = 'plain' } = {}) {
  const primary = kind === 'primary';
  const t = text(scene, 0, 0, label, primary ? { size: 19, weight: '900', spacing: 1 } : { size: 15, weight: '700' });
  const bw = w || Math.ceil(t.width + 36);
  const g = scene.add.graphics();
  const c = scene.add.container(0, 0, [g, t]).setDepth(depth).setSize(bw, h).setInteractive();
  c.bw = bw; c.bh = h;
  let on = false;
  const paint = (down) => {
    const r = h / 2, lit = on || primary, d = primary && down ? 3 : 0; // a pressed primary button sinks onto its shadow
    g.clear();
    if (primary) g.fillStyle(COLORS.shadow, 1).fillRoundedRect(-bw / 2 + 4, -h / 2 + 4, bw, h, r);
    if (kind === 'outline' && !on) {
      g.fillStyle(COLORS.buttonDown, down ? 1 : 0).fillRoundedRect(-bw / 2, -h / 2, bw, h, r);
      g.lineStyle(2, COLORS.cream, 1).strokeRoundedRect(-bw / 2, -h / 2, bw, h, r);
    } else {
      g.fillStyle(primary ? COLORS.warn : on ? COLORS.cream : down ? COLORS.buttonDown : COLORS.button, 1);
      g.fillRoundedRect(-bw / 2 + d, -h / 2 + d, bw, h, r);
    }
    t.setPosition(d, d).setColor(lit ? COLORS.inkCss : COLORS.text);
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
