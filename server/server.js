// Game server: serves the page, groups phones into crews, forwards "throw" messages between
// crewmates, and runs each crew's ship: it decides when faults appear, where the part to fix
// them shows up, and tracks the shared hull and score. Parts themselves live only on the phones.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { LEVELS, STATIONS, GOAL_PER_EXTRA, STARS } = require('./levels');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // the live server sets 127.0.0.1 and sits behind Apache
// REVISION is written by the deploy workflow; /version reports it so a deploy can be confirmed.
// The built game page. In this repo `npm run build` puts it in ../dist (the phone apps bundle
// the same files). On the live server the deploy copies it next to this file as public/.
const PUBLIC_DIR = [path.join(__dirname, 'public'), path.join(__dirname, '..', 'dist')].find((d) => fs.existsSync(d));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};
let REVISION = 'dev';
try { REVISION = fs.readFileSync(path.join(__dirname, 'REVISION'), 'utf8').trim(); } catch {}

// ---------- crews ----------
const MAX_PLAYERS = 8;
const SILENCE_LIMIT = 6000;  // a phone that says nothing for this long (ms) is cut off; phones ping every second
const AWAY_GRACE = 60000;    // how long a cut-off phone's room is held for it to come back
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // no vowels, so codes never spell words
const CODE_LENGTH = 4;
// Each player is a room on the ship, with a colour and an icon.
const COLORS = [
  ['Engine', '#ff6b6b', '🚀'], ['Bridge', '#4dabf7', '🧭'], ['Garden', '#94d82d', '🌱'], ['Reactor', '#ffd43b', '⚡'],
  ['Lab', '#b197fc', '🔬'], ['Medbay', '#38d9a9', '🩺'], ['Cargo', '#ffa94d', '📦'], ['Hangar', '#f783ac', '🛸'],
];
const ASK_GAP = 1500; // a player can call out for a part at most this often (ms)
const MODES = ['neighbors', 'portals'];

// code -> { code, mode, captain, level (which leg of levels.js is next), players: [{ id, name, color, token, ws, away, awaySince }], game }
// A player with ws === null is "away": cut off, but their room is held for AWAY_GRACE.
const crews = new Map();
const conns = new Set(); // every open connection: { ws, crew, player, lastHeard, from, device }
let nextId = 1;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const aboard = (crew) => crew.players.filter((p) => p.ws); // players who are connected right now

function send(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function newCode() {
  let code;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => pick([...CODE_LETTERS])).join('');
  } while (crews.has(code));
  return code;
}

function broadcastRoom(crew) {
  const msg = {
    t: 'room', code: crew.code, mode: crew.mode, captain: crew.captain,
    players: crew.players.map(({ id, name, color, icon, away }) => ({ id, name, color, icon, away })),
  };
  for (const p of crew.players) send(p.ws, msg);
}

// ---------- the ship ----------
// The journey is a list of legs (levels.js). The ship moves through these states:
//   lobby  docked, the crew gathers
//   story  the briefing for the next leg; the captain says go
//   run    flying: faults appear and the crew fixes them
//   won    the leg's goal was reached
//   over   the hull gave out
// Tuning that applies to every leg. Each leg's own numbers are in levels.js.
const MAX_FAULTS_EACH = 2;   // a room never has more than this many faults at once
const HULL_DAMAGE = 15;      // hull lost when a fault runs out (hull starts at 100)
const DECOY_CHANCE = 0.25;   // chance a new fault also drops a useless spare part somewhere
const TEST_GOAL = Number(process.env.TEST_GOAL) || 0; // the check script shortens every leg with this

const newGame = (phase = 'lobby') => ({ phase, hull: 100, score: 0, goal: 0, stars: 0, faults: [], stations: [], nextFaultAt: 0, nextBurstAt: 0, seq: 1 });
// The leg the ship is on. A finished leg stays on screen while crew.level already points at the next one.
const legOf = (crew) => crew.game.level ?? crew.level;
const levelOf = (crew) => LEVELS[legOf(crew)];

// The whole ship state. `ev` says what just happened (brief, launch, fault, burst, fixed, lost,
// won, over, end) and `who` is the room it happened in.
function gameMsg(crew, ev, who) {
  const g = crew.game, now = Date.now(), lv = levelOf(crew);
  return {
    t: 'game', phase: g.phase, hull: g.hull, score: g.score, goal: g.goal, stars: g.stars, ev, who,
    level: { n: legOf(crew), of: LEVELS.length, name: lv.name, story: lv.story, tip: lv.tip, won: lv.won, station: lv.station || null },
    stations: g.stations,
    faults: g.faults.map((f) => ({ id: f.id, owner: f.owner, kind: f.kind, ttl: f.ttl, left: Math.max(0, f.deadline - now) })),
  };
}

function broadcastGame(crew, ev, who) {
  const msg = gameMsg(crew, ev, who);
  for (const p of crew.players) send(p.ws, msg);
}

// Start flying the crew's current leg.
function startLeg(crew) {
  const lv = levelOf(crew), g = crew.game = newGame('run'), now = Date.now();
  g.goal = TEST_GOAL || lv.goal + Math.max(0, aboard(crew).length - 2) * GOAL_PER_EXTRA;
  g.nextFaultAt = now + 1000;
  g.nextBurstAt = lv.burst ? now + lv.burst.first : 0;
  placeStations(crew);
  broadcastGame(crew, 'launch');
}

// Every station this leg needs lives in the room of someone who is aboard. Returns true if
// anything moved (a station's crewmate dropped out, so it went to someone else).
function placeStations(crew) {
  const g = crew.game, lv = levelOf(crew), here = aboard(crew);
  if (g.phase !== 'run' || !lv.station || !here.length) return false;
  const has = g.stations[0] && here.find((p) => p.id === g.stations[0].owner);
  if (has) return false;
  const owner = here.find((p) => p.name === STATIONS[lv.station].room) || pick(here);
  g.stations = [{ type: lv.station, owner: owner.id }];
  return true;
}

function spawnPart(crew, player, kind) {
  send(player.ws, { t: 'spawn', item: { id: `s${crew.game.seq++}`, kind } });
}

// Give `owner` a fault of this kind, and put the part for it in someone else's room.
function addFaultFor(crew, owner, kind) {
  const g = crew.game, lv = levelOf(crew), here = aboard(crew);
  g.faults.push({ id: g.seq++, owner: owner.id, kind, ttl: lv.time, deadline: Date.now() + lv.time });

  // If a station makes this part, what turns up is the thing the station works on, and never
  // in the station's own room when there's a choice: it has to be thrown there.
  const station = g.stations.find((s) => STATIONS[s.type].gives === kind);
  let where = here.filter((p) => p !== owner);
  if (station) {
    const away = here.filter((p) => p.id !== station.owner);
    const best = away.filter((p) => p !== owner);
    where = best.length ? best : away.length ? away : here;
    kind = STATIONS[station.type].takes;
  }
  spawnPart(crew, where.length ? pick(where) : owner, kind);
}

const freeRooms = (crew) => aboard(crew).filter((p) => crew.game.faults.filter((f) => f.owner === p.id).length < MAX_FAULTS_EACH);

function addFault(crew) {
  const g = crew.game, lv = levelOf(crew), here = aboard(crew), free = freeRooms(crew);
  g.nextFaultAt = Date.now() + lv.gap / Math.max(1, here.length / 2); // bigger crews get faults faster
  if (!free.length) return;
  const owner = pick(free);
  addFaultFor(crew, owner, pick(lv.kinds));
  if (Math.random() < DECOY_CHANCE) {
    // A spare nobody asked for. Never one a station makes, or it would be a free pass.
    const spares = lv.kinds.filter((k) => !g.stations.some((s) => STATIONS[s.type].gives === k));
    if (spares.length) spawnPart(crew, pick(here), pick(spares));
  }
  broadcastGame(crew, 'fault', owner.id);
}

// Something hits the whole ship: every room that has space gets the same fault at once.
function addBurst(crew) {
  const g = crew.game, lv = levelOf(crew);
  g.nextBurstAt = Date.now() + lv.burst.every;
  const free = freeRooms(crew);
  if (!free.length) return;
  for (const p of free) addFaultFor(crew, p, lv.burst.kind);
  broadcastGame(crew, 'burst');
}

function tick(crew) {
  const g = crew.game, now = Date.now();
  if (g.phase !== 'run') return;
  const expired = g.faults.filter((f) => f.deadline <= now);
  if (expired.length) {
    g.faults = g.faults.filter((f) => f.deadline > now);
    g.hull = Math.max(0, g.hull - HULL_DAMAGE * expired.length);
    if (g.hull <= 0) { g.phase = 'over'; g.faults = []; broadcastGame(crew, 'over'); return; }
    broadcastGame(crew, 'lost', expired[0].owner);
  }
  if (g.nextBurstAt && now >= g.nextBurstAt) addBurst(crew);
  if (now >= g.nextFaultAt) addFault(crew);
}
setInterval(() => { for (const crew of crews.values()) tick(crew); }, 250);

// ---------- joining, leaving, going away ----------
const log = (crew, text) => console.log(`[${crew.code}] ${text} (${aboard(crew).length} aboard, ${crews.size} crews)`);

// Give a connection a new room in a crew.
function seat(conn, crew) {
  const used = new Set(crew.players.map((p) => p.color));
  const [name, color, icon] = COLORS.find(([, c]) => !used.has(c));
  const player = { id: nextId++, name, color, icon, token: crypto.randomBytes(12).toString('hex'), ws: conn.ws, away: false };
  crew.players.push(player);
  if (crew.captain == null) crew.captain = player.id;
  welcome(conn, crew, player);
  log(crew, `+ ${name} from ${conn.from}, ${conn.device}`);
}

// Put a returning phone back in the room it had.
function reseat(conn, crew, player) {
  if (player.ws && player.ws !== conn.ws) {
    // The same phone is connected twice (say, a second browser tab). The newer one wins.
    const old = [...conns].find((c) => c.ws === player.ws);
    if (old) { old.crew = null; old.player = null; send(old.ws, { t: 'left', reason: 'elsewhere' }); }
  }
  player.ws = conn.ws; player.away = false;
  welcome(conn, crew, player);
  log(crew, `= ${player.name} is back from ${conn.from}, ${conn.device}`);
}

function welcome(conn, crew, player) {
  conn.crew = crew; conn.player = player;
  send(conn.ws, { t: 'joined', id: player.id, code: crew.code, token: player.token, phase: crew.game.phase });
  broadcastRoom(crew);
  send(conn.ws, gameMsg(crew));
}

// The captain's chair never sits empty while someone else is aboard.
function fixCaptain(crew) {
  const captain = crew.players.find((p) => p.id === crew.captain);
  if (captain && captain.ws) return;
  const next = aboard(crew)[0] || crew.players[0];
  crew.captain = next ? next.id : null;
}

// A phone was cut off. Hold its room, but take its faults away so nobody is punished for it.
function goAway(crew, player) {
  player.ws = null; player.away = true; player.awaySince = Date.now();
  crew.game.faults = crew.game.faults.filter((f) => f.owner !== player.id);
  fixCaptain(crew);
  placeStations(crew);
  broadcastRoom(crew); broadcastGame(crew);
  log(crew, `~ ${player.name} went away`);
}

// A player is gone for good: they chose to leave, or stayed away too long.
function remove(crew, player, why) {
  crew.players = crew.players.filter((p) => p !== player);
  crew.game.faults = crew.game.faults.filter((f) => f.owner !== player.id);
  fixCaptain(crew);
  if (!crew.players.length) crews.delete(crew.code);
  else { placeStations(crew); broadcastRoom(crew); broadcastGame(crew); }
  log(crew, `- ${player.name} ${why}`);
}

// Every second: cut off phones that have gone silent, and give up rooms held too long.
// A phone that switches from Wi-Fi to cellular, or goes to sleep, often vanishes without
// saying goodbye; without this its old connection would sit there as a ghost for minutes.
setInterval(() => {
  const now = Date.now();
  for (const c of conns) if (now - c.lastHeard > SILENCE_LIMIT) c.ws.terminate();
  for (const crew of crews.values()) {
    for (const p of [...crew.players]) {
      if (p.away && now - p.awaySince > AWAY_GRACE) remove(crew, p, 'did not come back');
    }
  }
}, 1000);

// ---------- web page ----------
function serveFile(pathname, res) {
  if (!PUBLIC_DIR) {
    res.writeHead(503, { 'Content-Type': 'text/plain' }).end('The game page has not been built yet. Run: npm run build\n');
    return;
  }
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = '/'; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(404).end(); return; } // no escaping the folder
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      // Built files under assets/ have a fingerprint in their name, so they can be kept forever.
      // Everything else is rechecked, so a new deploy shows up straight away.
      'Cache-Control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(REVISION + '\n');
  } else {
    serveFile(url.pathname, res);
  }
});

// ---------- connections ----------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Where the phone is connecting from, for working out later which device was which.
  // Apache passes the real address along.
  const agent = req.headers['user-agent'] || '';
  const conn = {
    ws, crew: null, player: null, lastHeard: Date.now(),
    from: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim(),
    device: /iPhone|iPad/.test(agent) ? 'iPhone' : /Android/.test(agent) ? 'Android' : /Mozilla/.test(agent) ? 'computer' : 'script',
  };
  conns.add(conn);
  send(ws, { t: 'hello', version: REVISION }); // lets an open browser tab notice it's out of date

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    conn.lastHeard = Date.now();

    // Things any connection can do.
    if (m.t === 'ping') { send(ws, { t: 'pong', ts: m.ts }); return; }
    if (m.t === 'create' || m.t === 'join') {
      // Asking to join the crew you're already in changes nothing.
      if (m.t === 'join' && conn.player && conn.crew.code === String(m.code || '').toUpperCase()) {
        welcome(conn, conn.crew, conn.player);
        return;
      }
      if (conn.player) remove(conn.crew, conn.player, 'left for another crew');
      conn.crew = null; conn.player = null;
      if (m.t === 'create') {
        const crew = { code: newCode(), mode: 'neighbors', captain: null, level: 0, players: [], game: newGame() };
        crews.set(crew.code, crew);
        seat(conn, crew);
        return;
      }
      const crew = crews.get(String(m.code || '').toUpperCase());
      if (!crew) { send(ws, { t: 'error', reason: 'nocrew' }); return; }
      const mine = m.token && crew.players.find((p) => p.token === m.token);
      if (mine) reseat(conn, crew, mine);
      else if (crew.players.length >= MAX_PLAYERS) send(ws, { t: 'error', reason: 'full' });
      else seat(conn, crew);
      return;
    }

    // Everything else needs you to be in a crew.
    const { crew, player } = conn;
    if (!player) return;
    const captain = player.id === crew.captain;
    if (m.t === 'leave') {
      conn.crew = null; conn.player = null;
      remove(crew, player, 'left');
      send(ws, { t: 'left', reason: 'left' });
    } else if (m.t === 'throw') {
      const target = crew.players.find((p) => p.id === m.to);
      if (target && target.ws && target.ws.readyState === 1) send(target.ws, { ...m, from: player.id });
      else send(ws, { t: 'bounce', item: m.item }); // nobody there to catch it: give it back
    } else if (m.t === 'mode' && MODES.includes(m.mode)) {
      crew.mode = m.mode;
      broadcastRoom(crew);
    } else if (m.t === 'launch' && captain && ['lobby', 'won'].includes(crew.game.phase)) {
      // Show everyone the briefing for the next leg.
      crew.game = newGame('story');
      broadcastGame(crew, 'brief');
    } else if (m.t === 'go' && captain && ['story', 'over'].includes(crew.game.phase)) {
      startLeg(crew); // from the briefing, or straight back in after losing the ship
    } else if (m.t === 'level' && captain && crew.game.phase === 'lobby' && LEVELS[m.n]) {
      crew.level = m.n; // the captain picks which leg to fly next
      broadcastGame(crew);
    } else if (m.t === 'end' && captain) {
      crew.game = newGame();
      broadcastGame(crew, 'end');
    } else if (m.t === 'ask') {
      // "I need this part!" Shown to the rest of the crew on the portal that points at the asker.
      const fault = crew.game.faults.find((f) => f.id === m.id && f.owner === player.id);
      const now = Date.now();
      if (!fault || now - (player.lastAsk || 0) < ASK_GAP) return;
      player.lastAsk = now;
      for (const p of crew.players) if (p !== player) send(p.ws, { t: 'ask', from: player.id, kind: fault.kind });
    } else if (m.t === 'fix') {
      const g = crew.game;
      const fault = g.faults.find((f) => f.id === m.id && f.owner === player.id);
      if (!fault) return; // already ran out
      g.faults = g.faults.filter((f) => f !== fault);
      g.score++;
      if (g.score < g.goal) { broadcastGame(crew, 'fixed', player.id); return; }
      // Leg finished. Stars are for how much hull is left; the next launch flies the next leg.
      g.phase = 'won'; g.faults = []; g.level = crew.level;
      g.stars = g.hull >= STARS.three ? 3 : g.hull >= STARS.two ? 2 : 1;
      broadcastGame(crew, 'won', player.id);
      crew.level = (crew.level + 1) % LEVELS.length;
    }
  });

  ws.on('close', () => {
    conns.delete(conn);
    if (conn.player && conn.player.ws === ws) goAway(conn.crew, conn.player);
  });
});

server.listen(PORT, HOST, () => {
  const addrs = Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  const lan = addrs[0] ? `http://${addrs[0]}:${PORT}` : null;
  console.log(`\nOn this computer:  http://localhost:${PORT}`);
  if (lan) {
    console.log(`On phones (same Wi-Fi):  ${lan}\n`);
    try { require('qrcode-terminal').generate(lan, { small: true }); } catch {}
  }
});
