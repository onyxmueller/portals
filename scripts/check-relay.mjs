// Starts the relay on a spare port and checks the basics with two pretend players.
// GitHub runs this before every deploy, so a broken relay never goes live.
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import WebSocket from 'ws';

const PORT = 39011;
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: 'ignore',
});

let failed = false;
function check(label, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}
function join() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?room=check`);
    ws.log = [];
    ws.on('message', (d) => ws.log.push(JSON.parse(d)));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
const lastRoom = (ws) => ws.log.filter((m) => m.t === 'room').pop();

try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    page = await fetch(`http://127.0.0.1:${PORT}/`).catch(() => null);
    if (!page) await wait(100);
  }
  check('page is served', !!page && page.status === 200);
  const version = await fetch(`http://127.0.0.1:${PORT}/version`);
  check('/version answers', version.status === 200);

  const a = await join();
  const b = await join();
  await wait(200);
  const idA = a.log.find((m) => m.t === 'hello').id;
  const idB = b.log.find((m) => m.t === 'hello').id;
  check('both players are on the roster', lastRoom(b).players.length === 2);

  a.send(JSON.stringify({ t: 'throw', to: idB, mode: 'neighbors', edge: 'R', u: 0.4, vx: 900, vy: -50, item: { id: 'x1', emoji: '⭐' } }));
  a.send(JSON.stringify({ t: 'mode', mode: 'portals' }));
  a.send(JSON.stringify({ t: 'throw', to: 9999, item: { id: 'x2', emoji: '🔥' } }));
  a.send(JSON.stringify({ t: 'ping', ts: 1 }));
  await wait(200);
  const got = b.log.find((m) => m.t === 'throw');
  check('a throw reaches the target', !!got && got.from === idA && got.item.id === 'x1' && got.vx === 900);
  check('a mode change reaches everyone', lastRoom(b).mode === 'portals');
  check('a throw to a missing player comes back', a.log.some((m) => m.t === 'bounce' && m.item.id === 'x2'));
  check('ping is answered', a.log.some((m) => m.t === 'pong' && m.ts === 1));

  b.close();
  await wait(200);
  check('leaving updates the roster', lastRoom(a).players.length === 1);
  a.close();
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
