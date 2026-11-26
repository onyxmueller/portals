// Which screen goes with which state of the ship. The server decides the state ('lobby' =
// docked, 'story' = briefing before a leg, 'run' = flying, 'won' = leg finished, 'over' = ship
// lost), and every phone follows it.
import { net, state } from '../net.js';

export const sceneFor = (phase) => ({ lobby: 'Lobby', story: 'Story', run: 'Game', won: 'Results', over: 'Results' }[phase] || 'Lobby');

// Call in a scene's create(): when the ship's state stops matching this screen, switch screens.
// If we stop being in a crew at all, go back to the Home screen.
export function followPhase(scene, own) {
  const onGame = (m) => { if (m.phase !== own) scene.scene.start(sceneFor(m.phase)); };
  const onLeft = () => scene.scene.start('Home');
  net.on('game', onGame); net.on('left', onLeft);
  scene.events.once('shutdown', () => { net.off('game', onGame); net.off('left', onLeft); });
}

// Call in a scene's create() on screens shown before you're in a crew: once aboard, go to the ship.
export function followJoin(scene) {
  // The ship's state arrives right after 'joined'; go to whichever screen matches it.
  const onGame = (m) => { if (state.crew) scene.scene.start(sceneFor(m.phase)); };
  net.on('game', onGame);
  scene.events.once('shutdown', () => net.off('game', onGame));
}

// Call in a scene's create(): run the scene's layout() now and whenever the screen changes size.
export function followResize(scene) {
  scene.scale.on('resize', scene.layout, scene);
  scene.events.once('shutdown', () => scene.scale.off('resize', scene.layout, scene));
  scene.layout();
}
