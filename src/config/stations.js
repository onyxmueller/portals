// Stations: a tool that lives in one room for a leg. You leave the right part on it and do
// something with your finger to turn it into a new part. Which leg has which station, and
// what it takes and gives, is decided by the server (server/levels.js); keep `takes` and
// `gives` here the same as there. Numbers are positions in parts.js.
// `how` is what your finger does: 'spin' round the pad, 'hold' and let go at the right moment,
// or 'taps' as fast as you can.
export const STATIONS = {
  charger: {
    icon: 'bolt', name: 'Charger', takes: 8, gives: 1, how: 'spin',
    turns: 4, // how many times round your finger has to go
    empty: 'Leave a flat battery here',
    busy: 'Spin your finger round it!',
  },
  welder: {
    icon: 'flame', name: 'Welder', takes: 17, gives: 2, how: 'hold',
    heat: 2400,            // how long (ms) holding takes to go from cold to burnt
    green: [0.62, 0.86],   // the part of that where letting go makes a good weld
    empty: 'Leave a cold patch here',
    busy: 'Hold it, let go in the green',
  },
  pump: {
    icon: 'coolant', name: 'Pump', takes: 18, gives: 3, how: 'taps',
    taps: 14,              // taps to fill a can, if none of it drained
    drain: 0.22,           // how much of a can drains away each second
    empty: 'Leave an empty can here',
    busy: 'Tap it fast!',
  },
};
