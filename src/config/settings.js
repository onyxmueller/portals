// Numbers that change how the game feels. Sizes are in screen points, speeds in points per second.
export const SETTINGS = {
  partRadius: 34,       // how big a part is
  flingSpeed: 350,      // how fast a part must hit an edge to travel to another phone
  arrivalSpeed: 450,    // how fast a part arrives on the other phone, however hard it was thrown.
                        // At this speed it slides about two thirds of the way across. 0 = as fast as it was thrown
  friction: 1.6,        // how quickly a sliding part slows down (bigger = stops sooner)
  bounce: 0.6,          // how much speed a part keeps when it bounces off an edge
  maxThrowSpeed: 4500,  // cap on how fast a finger can throw
  socketRadius: 46,     // size of a fault's ring
  airlockRadius: 30,    // size of the airlock
  airlockMaxSpeed: 250, // a part must be slower than this to fall into the airlock
};

// The live game server. The phone apps always use it; the website uses whichever server sent the page.
export const RELAY = 'wss://portals.onyxmueller.net';
// Where invite links and QR codes point. Opening one starts the web game already in the crew.
export const SITE = 'https://portals.onyxmueller.net';
export const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ'; // the letters crew codes are made of (matches the server)
export const CODE_LENGTH = 4;

// The look: deep teal, cream and mustard, like a space-age travel poster. Numbers (0x...) are
// for shapes, strings ('#...') are for text. Two rules the screens keep to:
//   - only things you can pick up are cream discs with a hard shadow
//   - coral (`bad`) is only ever about the hull: about to be lost, or just lost
export const COLORS = {
  background: 0x123c42,
  panel: 0x0b2a2f,      // the darker teal behind panels, rings and rows
  shadow: 0x061c20,     // hard shadows, and holes
  button: 0x1d4d54,
  buttonDown: 0x2b6168,
  line: 0x5d8f8c,
  cream: 0xf6ecd6,
  ink: 0x123c42,        // pictures and words drawn on cream or on a room's colour
  planet: 0xe9a23b,
  text: '#f6ecd6',
  dim: '#a9c9c4',
  faint: '#8fb5b0',
  inkCss: '#123c42',
  onPlanet: '#3a1a05',  // words on the planet strip at the bottom
  good: 0x7be08d,
  warn: 0xffd43b,
  bad: 0xff7a52,
  goodCss: '#7be08d',
  warnCss: '#ffd43b',
  badCss: '#ff8f6b',
};
