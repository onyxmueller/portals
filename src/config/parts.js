// Parts, and the fault each one fixes. The server only deals in the position in this list
// (0 = Extinguisher, 1 = Battery...) and brings in the later ones as the game goes on,
// so add new parts at the end and raise PART_KINDS in server/server.js to match.
export const PARTS = [
  { e: '🧯', name: 'Extinguisher', fault: 'Fire' },
  { e: '🔋', name: 'Battery', fault: 'Power loss' },
  { e: '🩹', name: 'Patch', fault: 'Hull breach' },
  { e: '💧', name: 'Coolant', fault: 'Overheating' },
  { e: '🔧', name: 'Wrench', fault: 'Loose panel' },
  { e: '💡', name: 'Bulb', fault: 'Lights out' },
  { e: '💊', name: 'Medicine', fault: 'Sick crewmate' },
  { e: '🔑', name: 'Key', fault: 'Jammed door' },
];
