// Sound effects, made in code (no audio files). Placeholder blips until the sound pass.
let ac = null;

// Browsers only allow sound after a tap, so call this from a tap handler.
export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ac = new AC();
}

// A quick tone that slides from one pitch to another.
function blip(from, to) {
  if (!ac || ac.state !== 'running') return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + 0.12);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(g).connect(ac.destination);
  o.start(t); o.stop(t + 0.16);
}

export const sfx = {
  send: () => blip(520, 880),
  receive: () => blip(880, 440),
  launch: () => blip(440, 880),
  fault: () => blip(660, 330),
  fix: () => blip(660, 1320),
  damage: () => blip(200, 90),
  airlock: () => blip(300, 120),
  strike: () => { blip(160, 320); setTimeout(() => blip(320, 160), 110); }, // asteroids: a rumble, not the hull-damage sound
};
