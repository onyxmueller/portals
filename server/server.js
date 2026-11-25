// Game server: serves the page, forwards "throw" messages between players in a room,
// and runs the ship: it decides when faults appear, where the part to fix them shows up,
// and tracks the shared hull and score. Parts themselves live only on the phones.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

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
let REVISION = 'dev';
try { REVISION = fs.readFileSync(path.join(__dirname, 'REVISION'), 'utf8').trim(); } catch {}
const MAX_PLAYERS = 8;
// Each player is a room on the ship, with a colour.
const COLORS = [
  ['Engine', '#ff6b6b'], ['Bridge', '#4dabf7'], ['Garden', '#94d82d'], ['Reactor', '#ffd43b'],
  ['Lab', '#b197fc'], ['Medbay', '#38d9a9'], ['Cargo', '#ffa94d'], ['Hangar', '#f783ac'],
];
const MODES = ['neighbors', 'portals'];

const rooms = new Map(); // name -> { mode, players: [{ id, name, color, ws }], game }
let nextId = 1;

// ---------- the ship ----------
// Tuning. Times are in milliseconds.
const PART_KINDS = 8;        // how many kinds of part/fault exist (names and pictures are in the page)
const START_KINDS = 4;       // kinds in play at launch; one more joins every 4 fixes
const MAX_FAULTS_EACH = 2;   // a room never has more than this many faults at once
const HULL_DAMAGE = 15;      // hull lost when a fault runs out (hull starts at 100)
const FAULT_TIME = { start: 20000, min: 12000, perFix: 400 };  // how long you get to fix a fault
const FAULT_GAP = { start: 6000, min: 2500, perFix: 150 };     // time between new faults (for 2 players)
const DECOY_CHANCE = 0.25;   // chance a new fault also drops a useless spare part somewhere

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const newGame = () => ({ phase: 'lobby', hull: 100, score: 0, faults: [], nextFaultAt: 0, seq: 1 });

// Everyone gets the whole ship state each time it changes. `ev` says what just happened
// (launch, fault, fixed, lost, over, end) and `who` is the room it happened in.
function broadcastGame(room, ev, who) {
  const g = room.game, now = Date.now();
  const msg = {
    t: 'game', phase: g.phase, hull: g.hull, score: g.score, ev, who,
    faults: g.faults.map((f) => ({ id: f.id, owner: f.owner, kind: f.kind, ttl: f.ttl, left: Math.max(0, f.deadline - now) })),
  };
  for (const p of room.players) send(p.ws, msg);
}

function spawnPart(room, player, kind) {
  send(player.ws, { t: 'spawn', item: { id: `s${room.game.seq++}`, kind } });
}

function addFault(room) {
  const g = room.game, now = Date.now();
  const free = room.players.filter((p) => g.faults.filter((f) => f.owner === p.id).length < MAX_FAULTS_EACH);
  if (!free.length) return;
  const owner = pick(free);
  const kinds = Math.min(PART_KINDS, START_KINDS + Math.floor(g.score / 4));
  const kind = Math.floor(Math.random() * kinds);
  const ttl = Math.max(FAULT_TIME.min, FAULT_TIME.start - g.score * FAULT_TIME.perFix);
  g.faults.push({ id: g.seq++, owner: owner.id, kind, ttl, deadline: now + ttl });

  // The part that fixes it turns up in a different room, so the crew has to talk.
  const others = room.players.filter((p) => p !== owner);
  spawnPart(room, others.length ? pick(others) : owner, kind);
  if (Math.random() < DECOY_CHANCE) spawnPart(room, pick(room.players), Math.floor(Math.random() * kinds));

  const gap = Math.max(FAULT_GAP.min, FAULT_GAP.start - g.score * FAULT_GAP.perFix);
  g.nextFaultAt = now + gap / Math.max(1, room.players.length / 2); // bigger crews get faults faster
  broadcastGame(room, 'fault', owner.id);
}

function tick(room) {
  const g = room.game, now = Date.now();
  if (g.phase !== 'run') return;
  const expired = g.faults.filter((f) => f.deadline <= now);
  if (expired.length) {
    g.faults = g.faults.filter((f) => f.deadline > now);
    g.hull = Math.max(0, g.hull - HULL_DAMAGE * expired.length);
    if (g.hull <= 0) { g.phase = 'over'; g.faults = []; broadcastGame(room, 'over'); return; }
    broadcastGame(room, 'lost', expired[0].owner);
  }
  if (now >= g.nextFaultAt) addFault(room);
}
setInterval(() => { for (const room of rooms.values()) tick(room); }, 250);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(REVISION + '\n');
  } else {
    serveFile(url.pathname, res);
  }
});

const wss = new WebSocketServer({ server });

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function broadcastRoom(room) {
  const msg = {
    t: 'room',
    mode: room.mode,
    players: room.players.map(({ id, name, color }) => ({ id, name, color })),
  };
  for (const p of room.players) send(p.ws, msg);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const roomName = (url.searchParams.get('room') || 'main').slice(0, 24);
  let room = rooms.get(roomName);
  if (!room) rooms.set(roomName, (room = { mode: 'neighbors', players: [], game: newGame() }));

  if (room.players.length >= MAX_PLAYERS) {
    send(ws, { t: 'full' });
    ws.close();
    return;
  }

  const used = new Set(room.players.map((p) => p.color));
  const [name, color] = COLORS.find(([, c]) => !used.has(c));
  const player = { id: nextId++, name, color, ws };
  room.players.push(player);
  send(ws, { t: 'hello', id: player.id, room: roomName });
  broadcastRoom(room);
  broadcastGame(room);
  console.log(`[${roomName}] + ${name} (${room.players.length} players)`);

  ws.on('message', (data) => {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (m.t === 'ping') {
      send(ws, { t: 'pong', ts: m.ts });
    } else if (m.t === 'throw') {
      const target = room.players.find((p) => p.id === m.to);
      if (target && target.ws.readyState === 1) {
        send(target.ws, { ...m, from: player.id });
      } else {
        send(ws, { t: 'bounce', item: m.item }); // target vanished: give the item back
      }
    } else if (m.t === 'mode' && MODES.includes(m.mode)) {
      room.mode = m.mode;
      broadcastRoom(room);
    } else if (m.t === 'launch' && room.game.phase !== 'run') {
      room.game = newGame();
      room.game.phase = 'run';
      room.game.nextFaultAt = Date.now() + 1000;
      broadcastGame(room, 'launch');
    } else if (m.t === 'end') {
      room.game = newGame();
      broadcastGame(room, 'end');
    } else if (m.t === 'fix') {
      const g = room.game;
      const fault = g.faults.find((f) => f.id === m.id && f.owner === player.id);
      if (!fault) return; // already ran out
      g.faults = g.faults.filter((f) => f !== fault);
      g.score++;
      broadcastGame(room, 'fixed', player.id);
    }
  });

  ws.on('close', () => {
    room.players = room.players.filter((p) => p !== player);
    console.log(`[${roomName}] - ${name} (${room.players.length} players)`);
    room.game.faults = room.game.faults.filter((f) => f.owner !== player.id); // their faults leave with them
    if (room.players.length) { broadcastRoom(room); broadcastGame(room); }
    else rooms.delete(roomName);
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
