// Parts, and the fault each one fixes. The server only deals in the position in this list
// (0 = Extinguisher, 1 = Battery...), and server/levels.js says which ones each leg uses,
// so add new parts at the end. A part with no fault can't fix anything as it is: it has to
// be worked on at a station first (see stations.js).
export const PARTS = [
  { e: '🧯', name: 'Extinguisher', fault: 'Fire' },
  { e: '🔋', name: 'Battery', fault: 'Power loss' },
  { e: '🩹', name: 'Patch', fault: 'Hull breach' },
  { e: '💧', name: 'Coolant', fault: 'Overheating' },
  { e: '🔧', name: 'Wrench', fault: 'Loose panel' },
  { e: '💡', name: 'Bulb', fault: 'Lights out' },
  { e: '💊', name: 'Medicine', fault: 'Sick crewmate' },
  { e: '🔑', name: 'Key', fault: 'Jammed door' },
  { e: '🪫', name: 'Flat battery', fault: null },
];
