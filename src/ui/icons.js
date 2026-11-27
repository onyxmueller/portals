// The game's pictures: one flat shape per part and per room, drawn here as SVG and turned
// into white images when the game starts, so each can be coloured where it's used
// (see icon() in widgets.js). Shapes are drawn on a 24 by 24 grid.
const W = 'fill="#fff"';
const SHAPES = {
  // parts
  extinguisher: `<rect x="7.5" y="8.5" width="9" height="13" rx="3" ${W}/><path d="M10.5 4h3v4.5h-3z" ${W}/><path d="M8 4.2h7c3 0 4.5 1.8 4.5 4.3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  battery: `<path d="M10 2h4v2.5h-4z" ${W}/><rect x="6.5" y="4.5" width="11" height="17" rx="2" ${W}/>`,
  flat: `<path d="M10 2h4v2.5h-4z" ${W}/><rect x="7.5" y="5.5" width="9" height="15" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/><rect x="9.8" y="15.8" width="4.4" height="2.4" ${W}/>`,
  patch: `<path transform="rotate(-45 12 12)" fill-rule="evenodd" d="M7 7.5h10a4.5 4.5 0 0 1 0 9H7a4.5 4.5 0 0 1 0-9zM9.8 9.8v4.4h4.4V9.8z" ${W}/>`,
  coolant: `<path d="M12 2.5c4 5 6.5 8.2 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3.3 2.500-6.500 6.500-11.500z" ${W}/>`,
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.770-3.770a6 6 0 0 1-7.940 7.940l-6.910 6.910a2.120 2.120 0 0 1-3-3l6.910-6.910a6 6 0 0 1 7.940-7.940z" ${W}/>`,
  bulb: `<path d="M12 2a7 7 0 0 0-4 12.700V17h8v-2.300A7 7 0 0 0 12 2zM9 18.500h6V20a1.500 1.500 0 0 1-1.500 1.500h-3A1.500 1.500 0 0 1 9 20z" ${W}/>`,
  medicine: `<path fill-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm4.500 4v3.500H7v3h3.500V17h3v-3.500H17v-3h-3.500V7z" ${W}/>`,
  key: `<path fill-rule="evenodd" d="M7.500 6.500a5.500 5.500 0 1 1 0 11 5.500 5.500 0 0 1 0-11zm0 3.500a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" ${W}/><path d="M12 10.500h10v3H12zM17 13.500h2V17h-2zM20.500 13.500H22V16h-1.500z" ${W}/>`,
  fuse: `<path d="M1.500 6.500h5.500v11H1.500zM17 6.500h5.500v11H17z" ${W}/><rect x="7" y="8.500" width="10" height="7" fill="none" stroke="#fff" stroke-width="1.600"/><path d="M7 12h3" fill="none" stroke="#fff" stroke-width="1.800"/><path d="M14 12h3" fill="none" stroke="#fff" stroke-width="1.800"/>`,
  airtank: `<rect x="3.500" y="7.500" width="7.500" height="14.500" rx="3.750" ${W}/><rect x="13" y="7.500" width="7.500" height="14.500" rx="3.750" ${W}/><path d="M5.500 2.500h13v2.600h-13zM6.200 4.500h2.200V8H6.200zM15.600 4.500h2.200V8h-2.200z" ${W}/>`,
  mop: `<g transform="rotate(35 12 12)"><path d="M10.900 0.500h2.200V14h-2.200z" ${W}/><path d="M6 13h12l1.500 9.500h-2.600l-.7-3.500-.9 3.500h-2.400l-.9-3.500-.9 3.500H8.700l-.9-3.500-.7 3.500H4.500z" ${W}/></g>`,
  fuel: `<path fill-rule="evenodd" d="M4 9.500 9.500 4H14v2.500h4a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 11.500V14h8v-2.500z" ${W}/><path d="M15.500 1.500H20v3.200h-4.500z" ${W}/>`,
  antenna: `<path transform="rotate(35 11 9)" d="M2.500 9a8.500 8.500 0 0 0 17 0z" ${W}/><circle cx="15.200" cy="3.600" r="2" ${W}/><path d="M10 14h2.400v6H10zM5 19.500h12.400V22H5z" ${W}/>`,
  cog: `<path fill-rule="evenodd" d="M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 4.200a2.800 2.800 0 1 1 0 5.600 2.800 2.800 0 0 1 0-5.600z" ${W}/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="10.200" y="1.500" width="3.600" height="5" rx="0.800" transform="rotate(${a} 12 12)" ${W}/>`).join('')}`,
  plunger: `<path d="M10.900 1.500h2.200V13h-2.200z" ${W}/><path d="M12 11.500c4.500 0 7.500 3 7.500 7H4.500c0-4 3-7 7.500-7zM3 19.500h18V22H3z" ${W}/>`,
  coffee: `<path d="M4 10h12.500v7.500A4.500 4.500 0 0 1 12 22H8.500A4.500 4.500 0 0 1 4 17.500z" ${W}/><path d="M16 12h1.800a2.800 2.800 0 0 1 0 5.600H16" fill="none" stroke="#fff" stroke-width="2.200"/><path d="M8 2.500c-1.600 1.600 1.600 3 0 4.800M12.500 2.500c-1.600 1.600 1.600 3 0 4.800" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round"/>`,
  coldpatch: `<rect transform="rotate(-45 12 12)" x="3.500" y="8.500" width="17" height="7" rx="3.500" fill="none" stroke="#fff" stroke-width="2"/><rect transform="rotate(-45 12 12)" x="10.300" y="10.300" width="3.400" height="3.400" ${W}/>`,
  can: `<path d="M12 4c3.500 4.500 5.500 7.200 5.500 10a5.500 5.500 0 0 1-11 0c0-2.800 2-5.500 5.500-10z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`,
  goose: `<ellipse cx="10" cy="15.500" rx="7.500" ry="5" ${W}/><path d="M14.500 14V7" fill="none" stroke="#fff" stroke-width="3.200" stroke-linecap="round"/><circle cx="15.200" cy="5.600" r="2.800" ${W}/><path d="M17.300 4.300 22.500 6l-5.200 1.700z" ${W}/><path d="M8 20v2.500M12 20v2.500" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round"/>`,
  flame: `<path d="M12.500 2c.5 4 5.500 6.500 5.500 12.500a6 6 0 0 1-12 0c0-3 1.500-4.500 2.500-7 1.500 1 2 2.500 2 4 1.500-2.500 1.500-6 2-9.500z" ${W}/>`,
  // rooms
  rocket: `<path d="M12 2c4 3 5.200 8 4.200 13H7.800C6.800 10 8 5 12 2zM7.600 13.500 4 18.500h4.600zM16.400 13.500l3.600 5h-4.600zM10 17h4v4h-4z" ${W}/>`,
  compass: `<path fill-rule="evenodd" d="M12 2.500a9.500 9.500 0 1 0 0 19 9.500 9.500 0 0 0 0-19zm4 5.500-2.200 5.800L8 16l2.200-5.800z" ${W}/>`,
  leaf: `<path d="M4.500 19.500c0-9.500 5.500-15 15-15 0 9.500-5.500 15-15 15z" ${W}/>`,
  bolt: `<path d="M13 2 4 14h7l-1 8 9-12h-7z" ${W}/>`,
  flask: `<path d="M9 2h6v2h-1v5l5.500 9.500a2 2 0 0 1-1.700 3H6.200a2 2 0 0 1-1.700-3L10 9V4H9z" ${W}/>`,
  heart: `<path d="M12 21s-8.500-5.300-8.500-11.200A4.600 4.600 0 0 1 12 7.200a4.600 4.600 0 0 1 8.500 2.600C20.500 15.700 12 21 12 21z" ${W}/>`,
  box: `<path fill-rule="evenodd" d="M3 7.500 12 3l9 4.500v9L12 21l-9-4.500zm2 2v6l6 3v-6zm14 0-6 3v6l6-3z" ${W}/>`,
  saucer: `<path d="M7 11a5 5 0 0 1 10 0z" ${W}/><ellipse cx="12" cy="13.500" rx="10" ry="3.500" ${W}/><path d="M8 17.500l-2 3.500h2.500l1.500-3zM16 17.500l2 3.500h-2.500l-1.500-3z" ${W}/>`,
  // other
  star: `<path d="m12 2.500 2.900 6 6.600.900-4.800 4.600 1.200 6.500L12 17.400l-5.900 3.100 1.200-6.500L2.500 9.400l6.600-.900z" ${W}/>`,
};

// Which picture goes with which room (the server names the rooms).
const ROOMS = { Engine: 'rocket', Bridge: 'compass', Garden: 'leaf', Reactor: 'bolt', Lab: 'flask', Medbay: 'heart', Cargo: 'box', Hangar: 'saucer' };
export const roomIcon = (name) => ROOMS[name] || 'star';

const SIZE = 192; // pixels each picture is drawn at; plenty for the biggest it's shown
let drawn = null; // name -> canvas

// Draw every picture once. Call (and wait for) this before the game starts.
export async function drawIcons() {
  drawn = {};
  await Promise.all(Object.entries(SHAPES).map(([name, shape]) => new Promise((resolve) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">${shape}</svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = SIZE;
      c.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE);
      drawn[name] = c;
      resolve();
    };
    img.onerror = resolve; // a missing picture shouldn't stop the game
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  })));
}

// Hand the pictures to Phaser (once it exists) as textures named "icon-<name>".
export function addIcons(game) {
  for (const [name, canvas] of Object.entries(drawn || {})) {
    if (!game.textures.exists(`icon-${name}`)) game.textures.addCanvas(`icon-${name}`, canvas);
  }
}
