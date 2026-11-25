// Which screen goes with which state of the ship. The server decides the state
// ('lobby' = docked, 'run' = flying, 'over' = ship lost), and every phone follows it.
import { net } from '../net.js';

export const sceneFor = (phase) => ({ lobby: 'Lobby', run: 'Game', over: 'Results' }[phase] || 'Lobby');

// Call in a scene's create(): when the ship's state stops matching this screen, switch screens.
export function followPhase(scene, own) {
  const onGame = (m) => { if (m.phase !== own) scene.scene.start(sceneFor(m.phase)); };
  net.on('game', onGame);
  scene.events.once('shutdown', () => net.off('game', onGame));
}

// Call in a scene's create(): run the scene's layout() now and whenever the screen changes size.
export function followResize(scene) {
  scene.scale.on('resize', scene.layout, scene);
  scene.events.once('shutdown', () => scene.scale.off('resize', scene.layout, scene));
  scene.layout();
}
