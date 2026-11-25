// The connection to the game server. Scenes read `state` and listen to `net` for changes:
//   'room'   the crew or the edge-mapping mode changed
//   'game'   the ship changed (message has .ev: launch, fault, fixed, lost, over, end)
//   'throw'  a part is arriving from another phone
//   'spawn'  the server put a new part in my room
//   'bounce' a part I threw had nowhere to go and came back
//   'ping'   a fresh round-trip time
import Phaser from 'phaser';
import { NATIVE } from './native.js';
import { RELAY } from './config/settings.js';

export const net = new Phaser.Events.EventEmitter();

export const state = {
  me: null,            // my player id
  players: [],         // everyone aboard, in seating order: { id, name, color }
  mode: 'neighbors',   // how edges map to crewmates: 'neighbors' or 'portals'
  roomName: 'main',
  game: { phase: 'lobby', hull: 100, score: 0, faults: [] },
  pingMs: null,
  pings: [],           // last 30 round trips
  full: false,
};

let ws = null;

export const connected = () => !!ws && ws.readyState === 1;
export const send = (m) => { if (connected()) ws.send(JSON.stringify(m)); };
export const mySelf = () => state.players.find((p) => p.id === state.me);

// Everyone else, starting with the player after me in seating order.
export function others() {
  const i = state.players.findIndex((p) => p.id === state.me);
  return i < 0 ? [] : state.players.slice(i + 1).concat(state.players.slice(0, i));
}

function serverAddress() {
  if (NATIVE) return RELAY;
  // `npm run dev` serves the page from Vite, with the game server next to it on port 3000.
  if (import.meta.env.DEV) return `ws://${location.hostname}:3000`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export function connect() {
  state.roomName = new URLSearchParams(location.search).get('room') || 'main';
  ws = new WebSocket(`${serverAddress()}/?room=${encodeURIComponent(state.roomName)}`);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') { state.me = m.id; state.full = false; }
    else if (m.t === 'room') { state.players = m.players; state.mode = m.mode; net.emit('room'); }
    else if (m.t === 'game') { state.game = m; net.emit('game', m); }
    else if (m.t === 'pong') {
      state.pingMs = Math.round(performance.now() - m.ts);
      state.pings.push(state.pingMs);
      if (state.pings.length > 30) state.pings.shift();
      net.emit('ping');
    }
    else if (m.t === 'full') { state.full = true; net.emit('room'); }
    else if (m.t === 'throw' || m.t === 'spawn' || m.t === 'bounce') net.emit(m.t, m);
  };
  ws.onclose = () => {
    state.players = []; state.pingMs = null; state.pings = [];
    net.emit('room');
    setTimeout(connect, 1000); // keep trying; phones drop connections when they sleep
  };
}

setInterval(() => send({ t: 'ping', ts: performance.now() }), 1000);
