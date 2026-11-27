# Portals

A prototype co-op game for 2 to 8 phones: you are the crew of a failing spaceship, and you fix it
by flinging parts from one phone to another. "Portals" is a working title.

Live at https://portals.onyxmueller.net. Open it on two or more phones (iOS or Android).

## Play

Each phone is a room on the ship (Engine, Bridge, Medbay...) with its own colour. The doors on
your screen edges show which room a part goes to if you fling it off that edge.

The game is played wide. A phone held upright shows it sideways, so you turn the phone (this
works even with rotation lock on). A tablet held upright shows a wide game across the middle;
turning it fills the screen.

**Getting a crew together.** One person taps **Start a crew** and gets a four-letter code. Others
tap **Join a crew** and type it, or scan the QR code on the **Invite** panel with their phone's
camera, which opens the game in their browser already in the crew (no app needed). Whoever started
the crew is the captain (★) and is the one who can launch. Any number of crews can play at once.

If your phone drops out (it sleeps, or switches between Wi-Fi and cellular), your room is held
for a minute and you get it back when you reconnect, even if you closed the app in between.

**Pointing out your crew.** In the lobby, tap **Point out your crew**. A badge appears for each
crewmate in turn; fling it toward where they're actually sitting. From then on that crewmate's
door is on that part of your screen's edge, so you throw at the person. Each phone does this for
itself, and remembers it. Skip it and the game uses the simpler mapping chosen in Settings.

The journey is eight **legs**, flown in order. The captain presses **Launch** when everyone is
aboard, everyone reads a short briefing (the story so far, and what's new this leg), and the
captain presses **Go!** Then:

- **Faults** appear in your room, each at one of five spots picked at random, with a ring that
  drains as time runs out, and the part they need ("Fire, needs Extinguisher").
- The part turns up in **someone else's room**, so shout for it. You can also **tap the fault**:
  your crewmates see what you need in a bubble on the door that points at you. They fling it to you; drop it on
  the fault to fix it. A good throw can land straight on the fault.
- A fault that runs out costs the shared **hull** 15%. At zero the ship is lost and the captain
  can try the leg again.
- Fix enough faults (the bar at the top counts them) and the leg is done. The crew gets one to
  three **stars** for how much hull is left, and the next launch flies the next leg.
- Leg 2, the asteroid belt: every so often a hull breach opens in **every room at once**.
- Leg 3 has a **station**, the Charger, in one room (a ⚡ marks that room's door). Batteries turn
  up flat. Throw a flat one to the Charger's room; that crewmate leaves it on the Charger and
  spins a finger round it to crank it full, then throws it on to whoever needs it.
- Leg 4, the fog bank: your room is **dark**. Hold a finger down to light up what's under it.
- Leg 5 has the **Welder**: patches turn up cold. In the Welder's room, hold a finger on the
  patch and let go while the ring is in the green.
- Leg 6, goose trouble: **loose geese** hop about (and through doors). Drop each one on the
  airlock before its ring runs out, or it pecks 5% off the hull.
- Leg 7 has the **Pump**: coolant turns up as empty cans. In the Pump's room, tap the can fast
  until it's full.
- Leg 8, the wormhole: every so often the **doors move** to lead to different rooms, after a
  warning. It also brings back the Charger and the asteroids.
- Spare parts pile up. Leave one on the **airlock** to throw it away.

Before launch the ship is docked and you can practise throwing. To fling: drag a part and let go.
Hit an edge fast enough and it travels; too slow and it bounces back. However hard you throw, a
part arrives at a steady speed so it doesn't sail across the next phone.

For phones that haven't pointed out their crew, Settings chooses how edges map to rooms (for
everyone):

- **Neighbors**: left edge goes to the room on your left, right edge to the room on your right.
  Seating order is join order.
- **Portals**: every other room owns a coloured stretch of your left, top and right edges.

The status bar shows your round trip to the
server in milliseconds, and the worst of the last 30 seconds.

Docked, the captain can pick which leg to fly next in Settings.

## Run it on your own computer

    npm install
    npm run dev

`npm run dev` starts the game server and a page that reloads as you edit. It prints an address
for phones on the same Wi-Fi (the one on port 5173). `npm start` builds the page and runs it the
way the live server does, on port 3000.

Testing shortcuts you can add to the address (join several with `&`):

| Shortcut | What it does |
|---|---|
| `?skip` | Jump past the title screen |
| `?start` | Start a crew straight away |
| `?join` | Open the Join screen |
| `?crew=CODE` | Join that crew (this is what invite links use) |
| `?invite`, `?settings` | Open that panel in the lobby |
| `?point` | Start pointing out the crew as soon as there is one |
| `?fresh` | Forget the crew this browser was last in (handy with several tabs) |

## Native apps (iOS and Android)

The same page is wrapped with Capacitor into real apps (`ios/` and `android/`). The Android app id is
`net.onyxmueller.portals`; the iOS one is `com.softronyx.portals`, signed with the Softronyx team.
The built page is bundled inside the app and talks to the live server at
`wss://portals.onyxmueller.net`, so the apps work on any network. They are locked to landscape (an iPad can be
held either way) and use the phone's real haptics.

    npm run ios        # build the page, copy it into the iOS app and open Xcode
    npm run android    # build the page, copy it into the Android app and open Android Studio

Then press Run. Run the command again after changing the game so the apps get the new build.
Building needs Xcode, and Android Studio (its bundled Java is new enough; Java 17 is not).

## Check and measure

    npm run check                                          # two pretend players join, throw and play
    npm run latency                                        # throw travel time, local server
    npm run latency -- https://portals.onyxmueller.net     # throw travel time, live server

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: it builds the page, runs the check, rsyncs the server and the built page to
`/var/www/portals.onyxmueller.net/` on the web server, then rewrites the `REVISION` file there.
The server watches that file and restarts the relay when it changes, and the workflow finishes by
confirming https://portals.onyxmueller.net/version reports the new commit.

A browser tab that was already open notices the new version when the server restarts and reloads
itself (never in the middle of a game), coming back to the same crew and room. The phone apps
carry their own copy of the game, so they only change when a new build is installed.

The workflow needs the repo secrets `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT` and `SSH_USER`. The
deploy key is restricted on the server with `rrsync` to that one folder, which it sees as `/`, so
it can copy files but can't run commands.

The server was set up once with `server/setup-server.sh`. It creates the folder, adds the deploy
key, runs the relay as a service on `127.0.0.1:3070`, and adds the Apache site that passes web and
WebSocket traffic to it.

## Where things live

The game is built with Phaser 3 and Vite. The repo has one folder per thing that runs: `src/`
(the game page), `server/` (the game server, with its own `package.json`), and `ios/` and
`android/` (the phone apps, which bundle the built page). `npm install` at the top level also
installs the server's packages.

| File | What's in it |
|---|---|
| `src/config/settings.js` | Part size, fling speed, friction, the colour palette, the live server's address |
| `src/config/parts.js` | The parts and the fault each one fixes |
| `src/config/stations.js` | How each station looks and what you do to work it |
| `src/deck/Deck.js` | The play area: parts, portals along the edges, dragging, and the throw physics |
| `src/throw/edges.js` | Which crewmate each stretch of screen edge leads to, including where you pointed |
| `src/scenes/` | The screens: title, home (start or join a crew), join (type a code), lobby (docked), story (briefing before a leg), game (flying), results (leg finished or ship lost) |
| `src/ui/` | Buttons, sharp text, the Settings panel and the Invite panel (crew code and QR) |
| `src/ui/icons.js` | Every picture in the game (parts and rooms), drawn as simple shapes |
| `src/net.js` | The connection to the game server |
| `src/audio/sfx.js` | Sound effects, made in code (still placeholder blips) |
| `server/server.js` | The game server: serves the page, groups phones into crews, forwards throws, and runs each crew's ship (faults, hull, score) |
| `server/levels.js` | The journey: each leg's story, goal, faults, pace, twist and station. Edit this to change or add legs |
| `server/scripts/check-relay.mjs` | The check GitHub runs before every deploy |
| `server/scripts/latency.mjs` | Measures how long a throw takes to travel through a server |
| `server/setup-server.sh` | One-time server setup |
| `PLAN.md` | The phased plan for the whole game |
