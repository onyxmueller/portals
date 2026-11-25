import Phaser from 'phaser';
import { DPR, view, measure } from './view.js';
import { COLORS } from './config/settings.js';
import { connect } from './net.js';
import { TitleScene } from './scenes/TitleScene.js';
import { HomeScene } from './scenes/HomeScene.js';
import { JoinScene } from './scenes/JoinScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';

measure();

// The canvas fills the whole screen at the phone's real pixel resolution, shown at 1/DPR
// so it comes out the right size. Each scene's camera zooms by DPR (see view.js), so game
// code works in screen points. The screen's real edges matter here: they are the portals.
const size = () => [Math.round(view.W * DPR), Math.round(view.H * DPR)];
const [width, height] = size();

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.background,
  scale: { mode: Phaser.Scale.NONE, width, height, zoom: 1 / DPR },
  input: { activePointers: 4 }, // several fingers can drag parts at once
  disableContextMenu: true,
  scene: [TitleScene, HomeScene, JoinScene, LobbyScene, GameScene, ResultsScene],
});

window.addEventListener('resize', () => {
  measure();
  window.game.scale.resize(...size()); // every scene re-lays itself out on this
});

connect();
