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
];
