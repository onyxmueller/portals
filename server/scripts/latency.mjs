// Measures how long a throw takes to travel player A -> server -> player B.
//   npm run latency                                  (local server on port 3000)
//   npm run latency -- https://portals.onyxmueller.net [throws]
// Both pretend players run on this computer, so the number is this computer's
// round trip to the server. Two phones each pay about half of their own.
import WebSocket from 'ws';
import { setTimeout as wait } from 'node:timers/promises';

const base = (process.argv[2] || 'http://localhost:3000').replace(/^http/, 'ws').replace(/\/$/, '');
const count = Number(process.argv[3]) || 200;

// Connect, then start a crew (no code given) or join one. Resolves once we're aboard.
function board(code) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}/`);
    ws.on('error', reject);
    ws.on('open', () => ws.send(JSON.stringify(code ? { t: 'join', code } : { t: 'create' })));
    ws.on('message', function joined(d) {
      const m = JSON.parse(d);
      if (m.t === 'error') reject(new Error(`could not join: ${m.reason}`));
      if (m.t === 'joined') { ws.off('message', joined); ws.id = m.id; ws.code = m.code; resolve(ws); }
    });
  });
}

const a = await board();
const b = await board(a.code);
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
