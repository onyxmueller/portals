// The connection to the game server. Scenes read `state` and listen to `net` for changes:
//   'online'  the connection came up or went down
//   'joined'  I'm aboard a crew (new, or back after a dropout)
//   'left'    I'm no longer in a crew
//   'error'   joining failed: 'nocrew' (no crew has that code) or 'full'
//   'room'    the crew or the edge-mapping mode changed
//   'game'    the ship changed (message has .ev: launch, fault, fixed, lost, over, end)
//   'throw'   a part is arriving from another phone
//   'spawn'   the server put a new part in my room
//   'bounce'  a part I threw had nowhere to go and came back
//   'ping'    a fresh round-trip time
import Phaser from 'phaser';
import { NATIVE } from './native.js';
import { RELAY } from './config/settings.js';

export const net = new Phaser.Events.EventEmitter();

const freshGame = () => ({ phase: 'lobby', hull: 100, score: 0, faults: [] });

export const state = {
  online: false,
  crew: null,          // my crew's code, or null when I'm not in one
  me: null,            // my player id
  captain: null,       // the player id who can launch
  players: [],         // everyone in the crew, in seating order: { id, name, color, away }
  mode: 'neighbors',   // how edges map to crewmates: 'neighbors' or 'portals'
  game: freshGame(),
  pingMs: null,
  pings: [],           // last 30 round trips
};

// Which crew and room this phone has, remembered so it can get the same room back after a
// dropout, or after the app is closed and reopened (the server holds a room for a minute).
const SAVE = 'portals.session';
const params = new URLSearchParams(location.search);
let session = null;       // { code, token }
let wanted = null;        // what to ask for as soon as we're connected
let ws = null;

try { if (!params.has('fresh')) session = JSON.parse(localStorage.getItem(SAVE)); } catch {}
// An invite link (or a scanned QR code) carries ?crew=CODE: join that crew straight away.
const invited = (params.get('crew') || '').toUpperCase();
if (invited && !(session && session.code === invited)) { session = null; wanted = { t: 'join', code: invited }; }

function remember(s) {
  session = s;
  try { s ? localStorage.setItem(SAVE, JSON.stringify(s)) : localStorage.removeItem(SAVE); } catch {}
}

export const connected = () => !!ws && ws.readyState === 1;
export const send = (m) => { if (connected()) ws.send(JSON.stringify(m)); };
export const mySelf = () => state.players.find((p) => p.id === state.me);
export const isCaptain = () => state.me != null && state.me === state.captain;
export const captainName = () => (state.players.find((p) => p.id === state.captain) || {}).name || 'The captain';
// True while we're waiting to hear whether a join worked (used to show "Joining...").
export const joining = () => !state.crew && !!(wanted || session);

// Everyone else, starting with the player after me in seating order.
export function others() {
  const i = state.players.findIndex((p) => p.id === state.me);
  return i < 0 ? [] : state.players.slice(i + 1).concat(state.players.slice(0, i));
}

function ask(m) { wanted = m; send(m); }
export const createCrew = () => ask({ t: 'create' });
export const joinCrew = (code) => ask({ t: 'join', code });

function leftCrew() {
  remember(null); wanted = null;
  state.crew = null; state.me = null; state.captain = null; state.players = []; state.game = freshGame();
  net.emit('left');
}
export function leaveCrew() { send({ t: 'leave' }); leftCrew(); }

// A browser tab left open keeps running whatever version it loaded. When the server says it
// is on a different version, reload to pick up the new one, but never in the middle of a game.
// The crew and room are remembered, so the tab comes straight back to where it was.
// The phone apps carry their own copy of the game, so this doesn't apply to them.
let staleFor = null; // the server version we're out of date against, if any
function reloadIfStale() {
  if (!staleFor || state.game.phase === 'run') return;
  let already = null;
  try { already = sessionStorage.getItem('portals.reloadedFor'); } catch {}
  if (already === staleFor) return; // tried that already; don't reload in a loop
  try { sessionStorage.setItem('portals.reloadedFor', staleFor); } catch { return; }
  location.reload();
}

function serverAddress() {
  if (NATIVE) return RELAY;
  // `npm run dev` serves the page from Vite, with the game server next to it on port 3000.
  if (import.meta.env.DEV) return `ws://${location.hostname}:3000`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export function connect() {
  ws = new WebSocket(`${serverAddress()}/`);
  ws.onopen = () => {
    state.online = true;
    // Back after a dropout? Ask for our old room. Otherwise send whatever was asked for meanwhile.
    if (session) send({ t: 'join', code: session.code, token: session.token });
    else if (wanted) send(wanted);
    net.emit('online');
  };
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.t === 'hello') {
      const mine = __BUILD__;
      if (!NATIVE && mine !== 'dev' && m.version !== 'dev' && m.version !== mine) staleFor = m.version;
      reloadIfStale();
    }
    else if (m.t === 'joined') {
      state.me = m.id; state.crew = m.code; state.game = { ...freshGame(), phase: m.phase };
      remember({ code: m.code, token: m.token }); wanted = null;
      net.emit('joined');
    }
    else if (m.t === 'room') {
      state.players = m.players; state.mode = m.mode; state.captain = m.captain;
      net.emit('room');
    }
    else if (m.t === 'game') { state.game = m; net.emit('game', m); reloadIfStale(); }
    else if (m.t === 'error') {
      const quiet = !wanted; // our old room is gone (the crew closed while we were away): no fuss
      leftCrew();
      if (!quiet) net.emit('error', m.reason);
    }
    else if (m.t === 'left') leftCrew();
    else if (m.t === 'pong') {
      state.pingMs = Math.round(performance.now() - m.ts);
      state.pings.push(state.pingMs);
      if (state.pings.length > 30) state.pings.shift();
      net.emit('ping');
    }
    else if (m.t === 'throw' || m.t === 'spawn' || m.t === 'bounce') net.emit(m.t, m);
  };
  ws.onclose = () => {
    state.online = false; state.pingMs = null; state.pings = [];
    net.emit('online');
    setTimeout(connect, 1000); // keep trying; phones drop connections when they sleep or change network
  };
}

setInterval(() => send({ t: 'ping', ts: performance.now() }), 1000);
