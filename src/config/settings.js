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

export const COLORS = {
  background: 0x14161c,
  panel: 0x1f222b,
  button: 0x2b2f3a,
  buttonDown: 0x3d4250,
  line: 0x3d4250,
  text: '#e9ecef',
  dim: '#adb5bd',
  faint: '#868e96',
  good: 0x69db7c,
  warn: 0xffd43b,
  bad: 0xff6b6b,
};
