// Measures how long a throw takes to travel player A -> server -> player B.
//   npm run latency                                  (local server on port 3000)
//   npm run latency -- https://portals.onyxmueller.net [throws]
// Both pretend players run on this computer, so the number is this computer's
// round trip to the server. Two phones each pay about half of their own.
import WebSocket from 'ws';
import { setTimeout as wait } from 'node:timers/promises';

const base = (process.argv[2] || 'http://localhost:3000').replace(/^http/, 'ws').replace(/\/$/, '');
const count = Number(process.argv[3]) || 200;
const url = `${base}/?room=latency-${Date.now().toString(36)}`;

function join() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('error', reject);
    ws.on('message', function hello(d) {
      const m = JSON.parse(d);
      if (m.t === 'hello') { ws.off('message', hello); ws.id = m.id; resolve(ws); }
    });
  });
}

const a = await join();
const b = await join();
const times = [];
let pending = null;
b.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.t === 'throw' && pending) { times.push(performance.now() - m.sent); pending(); pending = null; }
});

for (let i = 0; i < count; i++) {
  const arrived = new Promise((r) => (pending = r));
  a.send(JSON.stringify({ t: 'throw', to: b.id, mode: 'neighbors', edge: 'R', u: 0.5, vx: 900, vy: 0,
    sent: performance.now(), item: { id: `t${i}`, emoji: '⭐' } }));
  const ok = await Promise.race([arrived.then(() => true), wait(3000).then(() => false)]);
  if (!ok) { console.log(`throw ${i} never arrived (3s)`); pending = null; }
  await wait(20);
}
a.close(); b.close();

times.sort((x, y) => x - y);
const at = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))].toFixed(1);
console.log(`${base}: ${times.length}/${count} throws arrived`);
if (times.length) console.log(`fastest ${at(0)}ms · typical ${at(0.5)}ms · slowest 5% ${at(0.95)}ms · worst ${at(1)}ms`);
process.exit(times.length === count ? 0 : 1);
