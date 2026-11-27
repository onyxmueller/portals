// The campaign: one entry per leg of the journey, played in order. Edit freely.
//
//   name     shown on the briefing and results screens
//   story    the briefing before the leg (a few short lines)
//   tip      one line on what's new this leg
//   won      shown when the crew finishes the leg
//   goal     faults to fix to finish, for a crew of 2 (each extra crewmate adds GOAL_PER_EXTRA)
//   kinds    which faults can happen (positions in src/config/parts.js); repeat one to make it commoner
//   time     how long the crew gets to fix each fault (ms)
//   gap      time between new faults, for a crew of 2 (ms); bigger crews get them faster
//   burst    optional: every `every` ms (first one after `first`), every room gets a fault of `kind` at once
//   station  optional: a tool that lives in one room this leg (see STATIONS)
//   twist    optional: 'fog' (rooms are dark except near a finger; the phones do this themselves)
//   swap     optional: every `every` ms (first after `first`) the doors change which room they lead to
//   geese    optional: a loose goose turns up every `every` ms (first after `first`), at most `max`
//            at once for a crew of 2; one left aboard for `time` ms pecks the hull for `peck`
const LEVELS = [
  {
    name: 'Leaving port',
    story: [
      'You pooled your savings and bought a cargo ship. It was cheap. You are about to find out why.',
      'First job: carry 4,000 rubber ducks to the far side of the galaxy.',
    ],
    tip: 'When something breaks, the part to fix it is in someone else\'s room. Shout for it!',
    won: 'The port is behind you and almost nothing fell off.',
    goal: 8, kinds: [0, 1, 2, 3], time: 20000, gap: 6000,
  },
  {
    name: 'Asteroid belt',
    story: [
      'The shortcut on the map turns out to be an asteroid belt.',
      'The ship\'s manual has one page on asteroid belts. It says "don\'t".',
    ],
    tip: 'Asteroids punch a hole in every room at once. Keep the patches flying.',
    won: 'Through the belt, with most of the hull and all of the ducks.',
    goal: 12, kinds: [0, 1, 4, 6, 9, 11], time: 18000, gap: 5500,
    burst: { kind: 2, first: 9000, every: 21000 },
  },
  {
    name: 'The long dark',
    story: [
      'Past the belt there are no stars to charge by, and every battery aboard has gone flat.',
      'Luckily the last owner left a hand-cranked charger. Unluckily, it is hand-cranked.',
    ],
    tip: 'Flat batteries need the Charger. Throw them to the room that has it, and that crewmate spins a finger round it to crank it full.',
    won: 'The ducks are delivered. The buyer wanted geese. You are paid anyway, mostly.',
    goal: 12, kinds: [1, 1, 0, 5, 7, 12, 16], time: 26000, gap: 6500,
    station: 'charger',
  },
  {
    name: 'Fog bank',
    story: [
      'The buyer wanted geese, not ducks. So: 4,000 geese, same route, the other way.',
      'First, a cloud of space fog so thick the lights give up. The geese think this is funny.',
    ],
    tip: 'Your room is dark. Hold a finger down to light up what is under it, find the parts, and call out what you have.',
    won: 'Out of the fog. Nobody admits to being scared.',
    goal: 12, kinds: [0, 5, 9, 10, 13], time: 20000, gap: 5500,
    twist: 'fog',
  },
  {
    name: 'The patch-up',
    story: [
      'Back through the asteroid belt, because nobody found a better map.',
      'The holes are bigger this time. Patches now arrive cold, and a cold patch sticks to nothing.',
    ],
    tip: 'Cold patches need the Welder. In the room that has it, hold a finger on the patch and let go when the ring is in the green. Too long and it has to cool down.',
    won: 'The hull is now mostly patches. It is still a hull.',
    goal: 14, kinds: [0, 4, 11, 12, 14], time: 18000, gap: 5500,
    burst: { kind: 2, first: 8000, every: 24000 },
    station: 'welder',
  },
  {
    name: 'Goose trouble',
    story: [
      'Someone left the cargo door on the latch. Geese are clever with latches.',
      'A goose left to wander pecks at the wiring. They are fine in space; each one has a little helmet.',
    ],
    tip: 'Loose geese hop from room to room. Drop each one on the airlock before its ring runs out, or it pecks the hull.',
    won: 'All geese accounted for. Several look pleased with themselves.',
    goal: 14, kinds: [1, 6, 7, 13, 15, 16], time: 18000, gap: 5500,
    geese: { first: 6000, every: 14000, time: 22000, max: 2, peck: 5 },
  },
  {
    name: 'Dry run',
    story: [
      'The engines run hot when the hold is full of geese, and the coolant cans have all run dry.',
      'There is a pump. It was built for someone with faster fingers than you.',
    ],
    tip: 'Empty cans need the Pump. In the room that has it, tap the can as fast as you can until it is full. Stop and it drains.',
    won: 'Cool engines, sore fingers.',
    goal: 14, kinds: [3, 3, 9, 10, 14, 15], time: 20000, gap: 5000,
    station: 'pump',
  },
  {
    name: 'Wormhole',
    story: [
      'One last shortcut: a wormhole. Inside it, the ship cannot quite remember which room is next to which.',
      'Also the batteries are flat again, and there are rocks in here.',
    ],
    tip: 'Every so often the doors move. Look at where each crewmate\'s colour is before you throw.',
    won: 'The geese are delivered. The buyer says they asked for ducks. You have decided to keep the ship anyway.',
    goal: 16, kinds: [1, 1, 0, 4, 5, 11, 12, 16], time: 20000, gap: 5000,
    burst: { kind: 2, first: 22000, every: 27000 },
    swap: { first: 12000, every: 18000, warn: 3000 },
    station: 'charger',
  },
];

// Stations: a tool in one room that turns one part into another (the hands-on action is in
// the game page, src/config/stations.js). While a station is in play, faults that need what
// it `gives` are sent the part it `takes` instead. `room` is where it lives if that room is aboard.
const STATIONS = {
  charger: { takes: 8, gives: 1, room: 'Reactor' },
  welder: { takes: 17, gives: 2, room: 'Engine' },
  pump: { takes: 18, gives: 3, room: 'Lab' },
};

const GOAL_PER_EXTRA = 3;               // extra faults to fix for each crewmate beyond two
const STARS = { three: 85, two: 50 };   // hull left for 3 and 2 stars (finishing at all earns 1)

const GOOSE = 19;                       // the goose's position in src/config/parts.js

module.exports = { LEVELS, STATIONS, GOAL_PER_EXTRA, STARS, GOOSE };
