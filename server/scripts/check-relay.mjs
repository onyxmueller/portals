// Starts the game server on a spare port and plays through the basics with pretend phones.
// GitHub runs this before every deploy, so a broken server never goes live.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';
import WebSocket from 'ws';

const PORT = 39011;
const server = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', TEST_GOAL: '2' }, // every leg is 2 faults long
  stdio: 'ignore',
});

let failed = false;
function check(label, ok) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failed = true;
}

// A pretend phone. It pings every second like a real one unless told to go quiet.
function phone() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`);
    ws.log = [];
    ws.say = (m) => ws.send(JSON.stringify(m));
    ws.last = (t) => ws.log.filter((m) => m.t === t).pop();
    ws.quiet = false;
    const pinger = setInterval(() => { if (!ws.quiet && ws.readyState === 1) ws.say({ t: 'ping', ts: 1 }); }, 1000);
    ws.on('message', (d) => ws.log.push(JSON.parse(d)));
    ws.on('close', () => clearInterval(pinger));
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}
const names = (ws) => ws.last('room').players.filter((p) => !p.away).map((p) => p.name).join(',');

try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    page = await fetch(`http://127.0.0.1:${PORT}/`).catch(() => null);
    if (!page) await wait(100);
  }
  check('page is served', !!page && page.status === 200);
  check('/version answers', (await fetch(`http://127.0.0.1:${PORT}/version`)).status === 200);

  // ---- crews ----
  const a = await phone();
  a.say({ t: 'ping', ts: 7 });
  a.say({ t: 'create' });
  await wait(200);
  const joinedA = a.last('joined');
  const code = joinedA && joinedA.code;
  check('ping is answered', a.log.some((m) => m.t === 'pong' && m.ts === 7));
  check('the server says which version it is on connecting', typeof a.last('hello')?.version === 'string');
  check('starting a crew gives a 4-letter code', /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(code || ''));
  check('whoever starts the crew is captain', a.last('room').captain === joinedA.id);
  check('each room has an icon', a.last('room').players[0].icon === '🚀');

  const b = await phone();
  b.say({ t: 'join', code: 'AAAA' });
  await wait(200);
  check('a wrong code is refused', b.last('error')?.reason === 'nocrew');
  b.say({ t: 'join', code: code.toLowerCase() });
  await wait(200);
  const idA = joinedA.id, idB = b.last('joined')?.id;
  check('a friend joins with the code', names(a) === 'Engine,Bridge' && names(b) === 'Engine,Bridge');

  // A second crew must not see or hear the first.
  const x = await phone();
  x.say({ t: 'create' });
  await wait(200);
  check('a second crew gets its own code', x.last('joined').code !== code && names(x) === 'Engine');
  const before = a.log.length;
  x.say({ t: 'throw', to: idB, mode: 'neighbors', edge: 'R', u: 0.5, vx: 900, vy: 0, item: { id: 'z', kind: 0 } });
  x.say({ t: 'launch' });
  x.say({ t: 'go' });
  await wait(300);
  check('crews cannot throw into each other', !b.log.some((m) => m.t === 'throw') && x.log.some((m) => m.t === 'bounce'));
  check("one crew launching doesn't launch another", a.last('game').phase === 'lobby' && x.last('game').phase === 'run');
  check('crews hear nothing from each other', a.log.slice(before).every((m) => m.t === 'pong'));
  x.say({ t: 'leave' });
  await wait(200);
  check('leaving a crew is confirmed', x.last('left')?.reason === 'left');

  // ---- throwing ----
  a.say({ t: 'throw', to: idB, mode: 'neighbors', edge: 'R', u: 0.4, vx: 900, vy: -50, item: { id: 'x1', kind: 3 } });
  a.say({ t: 'mode', mode: 'portals' });
  a.say({ t: 'throw', to: 9999, item: { id: 'x2', kind: 1 } });
  await wait(200);
  const got = b.last('throw');
  check('a throw reaches the target', !!got && got.from === idA && got.item.id === 'x1' && got.vx === 900);
  check('a mode change reaches everyone', b.last('room').mode === 'portals');
  check('a throw to a missing player comes back', a.log.some((m) => m.t === 'bounce' && m.item.id === 'x2'));

  // ---- the ship ----
  check('ship starts docked', a.last('game').phase === 'lobby');
  b.say({ t: 'launch' });
  await wait(200);
  check('only the captain can launch', a.last('game').phase === 'lobby');
  a.say({ t: 'launch' });
  await wait(200);
  const brief = b.last('game');
  check('launch shows the briefing for the first leg', brief.phase === 'story' && brief.level.n === 0 && brief.level.story.length > 0);
  b.say({ t: 'go' });
  await wait(200);
  check('only the captain can say go', a.last('game').phase === 'story');
  a.say({ t: 'go' });
  await wait(1600);
  const fault = a.last('game').faults[0];
  check('go starts the leg and a fault appears', b.last('game').phase === 'run' && !!fault);
  if (fault) {
    const owner = fault.owner === idA ? a : b, other = owner === a ? b : a;
    check('the part to fix it appears in the other room', other.log.some((m) => m.t === 'spawn' && m.item.kind === fault.kind));
    owner.say({ t: 'ask', id: fault.id });
    owner.say({ t: 'ask', id: fault.id });
    await wait(200);
    const asks = other.log.filter((m) => m.t === 'ask');
    check('calling out for a part reaches the crew, once', asks.length === 1 && asks[0].kind === fault.kind && !owner.log.some((m) => m.t === 'ask'));
    owner.say({ t: 'fix', id: fault.id });
    await wait(200);
    check('fixing it scores a point', other.last('game').score === 1 && !other.last('game').faults.some((f) => f.id === fault.id));
  }

  // ---- dropping out and coming back ----
  const tokenB = b.last('joined').token;
  b.quiet = true; // b's phone goes silent, as if it lost its network
  await wait(7500);
  const awayB = a.last('room').players.find((p) => p.id === idB);
  check('a silent phone is cut off but its room is held', b.readyState !== WebSocket.OPEN && !!awayB && awayB.away === true);
  check('a phone that keeps talking stays', a.readyState === WebSocket.OPEN);
  check('nobody is left holding faults for a phone that is away', !a.last('game').faults.some((f) => f.owner === idB));

  const b2 = await phone();
  b2.say({ t: 'join', code, token: tokenB });
  await wait(200);
  const back = b2.last('joined');
  check('it comes back to the same room', !!back && back.id === idB && names(a) === 'Engine,Bridge');
  check('and straight into the running game', back?.phase === 'run' && b2.last('game').phase === 'run');

  // ---- finishing a leg ----
  let last;
  for (let i = 0; i < 40 && !(last = a.last('game').faults[0]); i++) await wait(250);
  (last.owner === idA ? a : b2).say({ t: 'fix', id: last.id });
  await wait(200);
  const won = b2.last('game');
  check('reaching the goal finishes the leg with stars', won.phase === 'won' && won.stars >= 1 && won.level.n === 0);
  a.say({ t: 'launch' });
  await wait(200);
  check('the next launch briefs the next leg', b2.last('game').phase === 'story' && b2.last('game').level.n === 1);
  a.say({ t: 'end' });
  await wait(200);
  check('ending returns to dock', b2.last('game').phase === 'lobby');

  // ---- stations ----
  const seenA = a.log.length, seenB = b2.log.length; // only spawns from this leg count
  const spawned = (kind) => [[a, seenA, idA], [b2, seenB, idB]].filter(([p, from]) => p.log.slice(from).some((m) => m.t === 'spawn' && m.item.kind === kind)).map(([, , id]) => id);
  a.say({ t: 'level', n: 2 });
  a.say({ t: 'launch' });
  a.say({ t: 'go' });
  await wait(300);
  const flying = b2.last('game');
  check('the captain can pick a leg, and its station is in someone\'s room',
    flying.level.n === 2 && flying.stations.length === 1 && [idA, idB].includes(flying.stations[0].owner));
  for (let i = 0; i < 240 && !a.last('game').faults.some((f) => f.kind === 1); i++) await wait(250);
  await wait(200);
  check('a fault that needs a battery sends a flat one, away from the charger',
    spawned(8).length > 0 && !spawned(8).includes(flying.stations[0].owner) && spawned(1).length === 0);
  a.say({ t: 'end' });
  await wait(200);

  // ---- the captain leaves ----
  a.say({ t: 'leave' });
  await wait(200);
  check('when the captain leaves, someone else becomes captain', b2.last('room').captain === idB && names(b2) === 'Bridge');
  b2.say({ t: 'leave' });
  await wait(200);
  const late = await phone();
  late.say({ t: 'join', code });
  await wait(200);
  check('an empty crew is closed', late.last('error')?.reason === 'nocrew');
  late.close(); a.close(); b2.close(); x.close();
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
