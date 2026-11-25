# Portals

A prototype of one mechanic: fling an object off the edge of your phone and it lands on someone
else's. No game around it yet.

Live at https://portals.onyxmueller.net. Open it on two or more phones (iOS or Android).

## Play

Drag an item and let go to fling it. Hit an edge fast enough and it travels to another player;
too slow and it bounces back. Settings switches how edges map to players (for the whole room):

- **Neighbors**: left edge goes to the player on your left, right edge to the player on your
  right. Seating order is join order.
- **Portals**: every other player owns a coloured stretch of your left, top and right edges.

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

Pushing to `main` runs `.github/workflows/deploy.yml`: it runs the check, rsyncs the relay to
`/var/www/portals.onyxmueller.net/` on the web server, then rewrites the `REVISION` file there.
The server watches that file and restarts the relay when it changes, and the workflow finishes by
confirming https://portals.onyxmueller.net/version reports the new commit.

The workflow needs the repo secrets `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_PORT` and `SSH_USER`. The
deploy key is restricted on the server with `rrsync` to that one folder, which it sees as `/`, so
it can copy files but can't run commands.

The server was set up once with `deploy/setup-server.sh`. It creates the folder, adds the deploy
key, runs the relay as a service on `127.0.0.1:3070`, and adds the Apache site that passes web and
WebSocket traffic to it.

## Where things live

| File | What's in it |
|---|---|
| `public/index.html` | The whole game page: physics, touch input, edge mapping, drawing |
| `server.js` | The relay: serves the page, keeps the room roster, forwards throws |
| `scripts/check-relay.mjs` | The check GitHub runs before every deploy |
| `scripts/latency.mjs` | Measures how long a throw takes to travel through a server |
| `deploy/setup-server.sh` | One-time server setup |
