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
    goal: 12, kinds: [0, 1, 3, 4], time: 18000, gap: 5500,
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
    goal: 12, kinds: [1, 1, 0, 3, 5], time: 26000, gap: 6500,
    station: 'charger',
  },
];

// Stations: a tool in one room that turns one part into another (the hands-on action is in
// the game page, src/config/stations.js). While a station is in play, faults that need what
// it `gives` are sent the part it `takes` instead. `room` is where it lives if that room is aboard.
const STATIONS = {
  charger: { takes: 8, gives: 1, room: 'Reactor' },
};

const GOAL_PER_EXTRA = 3;               // extra faults to fix for each crewmate beyond two
const STARS = { three: 85, two: 50 };   // hull left for 3 and 2 stars (finishing at all earns 1)

module.exports = { LEVELS, STATIONS, GOAL_PER_EXTRA, STARS };
