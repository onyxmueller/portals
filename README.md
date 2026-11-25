# Portals

A prototype co-op game for 2 to 8 phones: you are the crew of a failing spaceship, and you fix it
by flinging parts from one phone to another. "Portals" is a working title.

Live at https://portals.onyxmueller.net. Open it on two or more phones (iOS or Android).

## Play

Each phone is a room on the ship (Engine, Bridge, Medbay...) with its own colour. The strips on
your screen edges show which room a part goes to if you fling it off that edge.

Press **Launch** when everyone is aboard. Then:

- **Faults** appear in your room with a ring that drains as time runs out, and the part they need
  ("Fire, needs Extinguisher").
- The part turns up in **someone else's room**, so shout for it. They fling it to you; drop it on
  the fault to fix it. A good throw can land straight on the fault.
- A fault that runs out costs the shared **hull** 15%. At zero the ship is lost. The score is how
  many faults the crew fixed.
- Faults come faster, give less time, and use more kinds of part as the score climbs.
- Spare parts pile up. Leave one on the **airlock** to throw it away.

Before launch the ship is docked and you can practise throwing. To fling: drag a part and let go.
Hit an edge fast enough and it travels; too slow and it bounces back. Settings switches how edges
map to rooms (for everyone):

- **Neighbors**: left edge goes to the room on your left, right edge to the room on your right.
  Seating order is join order.
- **Portals**: every other room owns a coloured stretch of your left, top and right edges.

Add `?room=name` to the address for a separate room. The status bar shows your round trip to the
server in milliseconds, and the worst of the last 30 seconds.

## Run it on your own computer

    npm install
    npm start

It prints an address and a QR code for phones on the same Wi-Fi.

## Native apps (iOS and Android)

The same page is wrapped with Capacitor into real apps (`ios/` and `android/`). The Android app id is
`net.onyxmueller.portals`; the iOS one is `com.softronyx.portals`, signed with the Softronyx team. The page is bundled inside the app and talks to the live relay at
`wss://portals.onyxmueller.net`, so the apps work on any network. They are locked to portrait and
use the phone's real haptics.

    npm run ios        # copy the page into the iOS app and open Xcode
    npm run android    # copy the page into the Android app and open Android Studio

Then press Run. After changing `public/index.html`, run the command again (or `npx cap sync`) so the apps get the
new page. Building needs Xcode, and Android Studio (its bundled Java is new enough; Java 17 is not).

## Check and measure

    npm run check                                          # two pretend players join and throw
    npm run latency                                        # throw travel time, local server
    npm run latency -- https://portals.onyxmueller.net     # throw travel time, live server

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`: it runs the check, rsyncs `server/` and `public/` to
`/var/www/portals.onyxmueller.net/` on the web server, then rewrites the `REVISION` file there.
The server watches that file and restarts the relay when it changes, and the workflow finishes by
confirming https://portals.onyxmueller.net/version reports the new commit.

The workflow needs the repo secrets `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT` and `SSH_USER`. The
deploy key is restricted on the server with `rrsync` to that one folder, which it sees as `/`, so
it can copy files but can't run commands.

The server was set up once with `server/setup-server.sh`. It creates the folder, adds the deploy
key, runs the relay as a service on `127.0.0.1:3070`, and adds the Apache site that passes web and
WebSocket traffic to it.

## Where things live

The repo has one folder per thing that runs: `server/` (the game server, with its own
`package.json`), `ios/` and `android/` (the phone apps), and `public/` (the game page, shared by
the server and both apps). `npm install` at the top level also installs the server's packages.

| File | What's in it |
|---|---|
| `public/index.html` | The whole game page: physics, touch input, edge mapping, drawing, and the list of parts and faults |
| `server/server.js` | The game server: serves the page, forwards throws, and runs the ship (faults, hull, score). The difficulty numbers are at the top |
| `server/scripts/check-relay.mjs` | The check GitHub runs before every deploy |
| `server/scripts/latency.mjs` | Measures how long a throw takes to travel through a server |
| `server/setup-server.sh` | One-time server setup |
