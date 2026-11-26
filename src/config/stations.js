// Stations: a tool that lives in one room for a leg. You leave the right part on it and do
// something with your finger to turn it into a new part. Which leg has which station, and
// what it takes and gives, is decided by the server (server/levels.js); keep `takes` and
// `gives` here the same as there. Numbers are positions in parts.js.
export const STATIONS = {
  charger: {
    icon: 'bolt', name: 'Charger', takes: 8, gives: 1,
    turns: 4, // how many times round your finger has to go
    empty: 'Leave a flat battery here',
    busy: 'Spin your finger round it!',
  },
};
