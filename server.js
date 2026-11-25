// Relay server: serves the page and forwards "throw" messages between players in a room.
// The server holds no game state beyond the roster (ring order = join order) and the edge-mapping mode.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // the live server sets 127.0.0.1 and sits behind Apache
// REVISION is written by the deploy workflow; /version reports it so a deploy can be confirmed.
let REVISION = 'dev';
try { REVISION = fs.readFileSync(path.join(__dirname, 'REVISION'), 'utf8').trim(); } catch {}
const MAX_PLAYERS = 8;
const COLORS = [
  ['Coral', '#ff6b6b'], ['Sky', '#4dabf7'], ['Lime', '#94d82d'], ['Gold', '#ffd43b'],
  ['Violet', '#b197fc'], ['Mint', '#38d9a9'], ['Peach', '#ffa94d'], ['Pink', '#f783ac'],
];
const MODES = ['neighbors', 'portals'];

const rooms = new Map(); // name -> { mode, players: [{ id, name, color, ws }] }
let nextId = 1;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
  } else if (url.pathname === '/version') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(REVISION + '\n');
  } else {
    res.writeHead(404).end();
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
  if (!room) rooms.set(roomName, (room = { mode: 'neighbors', players: [] }));

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
    }
  });

  ws.on('close', () => {
    room.players = room.players.filter((p) => p !== player);
    console.log(`[${roomName}] - ${name} (${room.players.length} players)`);
    if (room.players.length) broadcastRoom(room);
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
