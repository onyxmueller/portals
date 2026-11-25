// Which screen goes with which state of the ship. The server decides the state
// ('lobby' = docked, 'run' = flying, 'over' = ship lost), and every phone follows it.
import { net, state } from '../net.js';

export const sceneFor = (phase) => ({ lobby: 'Lobby', run: 'Game', over: 'Results' }[phase] || 'Lobby');

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
  const onJoined = () => scene.scene.start(sceneFor(state.game.phase));
  net.on('joined', onJoined);
  scene.events.once('shutdown', () => net.off('joined', onJoined));
}

// Call in a scene's create(): run the scene's layout() now and whenever the screen changes size.
export function followResize(scene) {
  scene.scale.on('resize', scene.layout, scene);
  scene.events.once('shutdown', () => scene.scale.off('resize', scene.layout, scene));
  scene.layout();
}
