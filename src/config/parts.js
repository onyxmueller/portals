// Parts, and the fault each one fixes. The server only deals in the position in this list
// (0 = Extinguisher, 1 = Battery...), and server/levels.js says which ones each leg uses,
// so add new parts at the end. A part with no fault can't fix anything as it is: it has to
// be worked on at a station first (see stations.js). `icon` names a picture in src/ui/icons.js.
export const PARTS = [
  { icon: 'extinguisher', name: 'Extinguisher', fault: 'Fire' },
  { icon: 'battery', name: 'Battery', fault: 'Power loss' },
  { icon: 'patch', name: 'Patch', fault: 'Hull breach' },
  { icon: 'coolant', name: 'Coolant', fault: 'Overheating' },
  { icon: 'wrench', name: 'Wrench', fault: 'Loose panel' },
  { icon: 'bulb', name: 'Bulb', fault: 'Lights out' },
  { icon: 'medicine', name: 'Medicine', fault: 'Sick crewmate' },
  { icon: 'key', name: 'Key', fault: 'Jammed door' },
  { icon: 'flat', name: 'Flat battery', fault: null },
  { icon: 'fuse', name: 'Fuse', fault: 'Short circuit' },
  { icon: 'airtank', name: 'Air tank', fault: 'Air leak' },
  { icon: 'mop', name: 'Mop', fault: 'Spill' },
  { icon: 'fuel', name: 'Fuel', fault: 'Empty tank' },
  { icon: 'antenna', name: 'Antenna', fault: 'Radio silence' },
  { icon: 'cog', name: 'Cog', fault: 'Stalled engine' },
  { icon: 'plunger', name: 'Plunger', fault: 'Blocked toilet' },
  { icon: 'coffee', name: 'Coffee', fault: 'Sleepy pilot' },
  { icon: 'coldpatch', name: 'Cold patch', fault: null },
  { icon: 'can', name: 'Empty can', fault: null },
  { icon: 'goose', name: 'Goose', fault: null },
];
// The parts that fix something as they are (positions in the list above).
export const FIXERS = PARTS.map((p, i) => (p.fault ? i : -1)).filter((i) => i >= 0);
export const GOOSE = 19; // not a part at all: a loose goose, to be dropped on the airlock
