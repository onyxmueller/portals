import Phaser from 'phaser';
import { DPR, view, measure, pagePoint } from './view.js';
import { COLORS } from './config/settings.js';
import { connect } from './net.js';
import { drawIcons, addIcons } from './ui/icons.js';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-900.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import { TitleScene } from './scenes/TitleScene.js';
import { HomeScene } from './scenes/HomeScene.js';
import { JoinScene } from './scenes/JoinScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';

measure();

// The canvas fills the whole screen at the phone's real pixel resolution, shown at 1/DPR
// so it comes out the right size. Each scene's camera zooms by DPR (see view.js), so game
// code works in screen points. The game's edges matter here: they are the portals.
const size = () => [Math.round(view.W * DPR), Math.round(view.H * DPR)];
const [width, height] = size();

// The first scene only hands the game its pictures, then shows the title.
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() { addIcons(this.game); this.scene.start('Title'); }
}

// Text is drawn onto the canvas, so the fonts have to be loaded before anything is written,
// and the pictures drawn before anything shows them.
const fonts = ['500 16px Rubik', '700 16px Rubik', '900 16px Rubik', '400 16px "IBM Plex Mono"', 'italic 400 16px "IBM Plex Mono"', '700 16px "IBM Plex Mono"'];
Promise.all([drawIcons(), ...fonts.map((f) => document.fonts.load(f).catch(() => null))]).then(() => {
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: COLORS.background,
    scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / DPR },
    input: { activePointers: 4 }, // several fingers can drag parts at once
    disableContextMenu: true,
    scene: [BootScene, TitleScene, HomeScene, JoinScene, LobbyScene, StoryScene, GameScene, ResultsScene],
  });
  // When the game is drawn sideways (an upright phone), Phaser can't work out where a touch
  // landed by itself, so we tell it.
  const input = window.game.input, usual = input.transformPointer;
  input.transformPointer = function (pointer, pageX, pageY, wasMove) {
    if (!view.sideways) return usual.call(this, pointer, pageX, pageY, wasMove);
    const p = pagePoint(pageX, pageY);
    pointer.prevPosition.set(pointer.position.x, pointer.position.y);
    pointer.position.set(p.x * DPR, p.y * DPR);
  };
});

window.addEventListener('resize', () => {
  measure();
  if (window.game) window.game.scale.resize(...size()); // every scene re-lays itself out on this
});

connect();
