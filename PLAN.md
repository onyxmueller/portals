# The Plan: Portals

**Mission: keep the ship flying.** A co-op party game for 2 to 8 phones in the same room. Every
phone is a room on a spaceship that's falling apart, and the crew fixes it by flinging parts from
one phone to another. We build it in phases, and you can play at the end of every one. Each phase
ends with a playtest, so we can stop or change direction at any boundary.

"Portals" is a working title. It gets a new name before it goes on an app store (see Phase 7).

## Story

The crew pooled their savings and bought a second-hand cargo ship. It was cheap for a reason.

Their first job: deliver one ridiculous cargo across the galaxy. Every leg of the trip, something
else on the ship breaks, and the only way to keep flying is to shout for the part you need and
have a crewmate throw it to you.

The story is told in short, funny panels between levels. It stays light: nobody gets hurt, the
ship just complains a lot.

## What makes this game different

1. **You throw things between phones.** Fling a part off the edge of your screen and it lands on
   a crewmate's. This is the whole game, so it has to feel great.
2. **You have to talk.** The part you need is always in someone else's room, and they don't know
   you need it until you shout.
3. **Your screen knows where your crewmates are.** The edge you throw at points at the real
   person sitting there.
4. **Everyone wins or loses together.** One hull, one score, no player left out.

## More to do than fetch: stations

Fetching a part and dropping it on a fault is where the game starts, not where it stays. On its
own it would get boring. In later levels, parts have to be **worked on** before they're any use,
and the work is a hands-on action that's different for each tool.

- A **station** is a tool that lives in one room: a charger, a welder, a pump. You put a part on
  it and do something with your fingers (spin, hold, tap, trace) to turn it into a new part.
- Stations make **chains across rooms**. "I need a charged battery" means someone finds the dead
  battery, throws it to the room with the charger, that room charges it, and throws it on.
- Stations give each room a **job**. The Reactor is the room that charges things, so the crew
  learns who to shout at.
- Some work can go **wrong**: leave a patch on the welder too long and it's scrap for the airlock.
- Some faults need work **in place** too, not just a part: scrub it, hold it, twist it.

Early levels stay fetch-and-drop so new players learn throwing first. Stations arrive one at a
time, one new one per level, and later levels chain two together. The exact stations get decided
in Phase 4; see the ideas there.

## What we decided

- **Same room first.** The game is designed for people sitting together. We don't rule out playing
  remotely later, so nothing we build should make that impossible.
- **All ages, family friendly.** Early levels are forgiving. No reading-heavy screens.
- **Finding your crewmates: "throw to calibrate".** Before launch, the game asks you to fling a
  badge toward each crewmate. The direction you throw becomes where their portal sits on your
  screen. We try this first and keep it if it works with real groups.
- **Art, music and sound are made in code**, like the Blaster Adventure games: a shape-drawing
  kit for sprites and a synth for music and effects. It's cheap to change and needs no outside
  artist. We pick the look early with one finished-looking test screen.
- **Rebuild on Phaser 3 + Vite before adding more features.** The new features are mostly new
  screens, and we don't want to build them twice.
- **The throw physics stays ours.** Phaser draws and animates; our own code moves the parts,
  because parts leaving through an edge is not something its built-in physics is made for.

## Where we are

Built so far, as a prototype:

- Flinging between phones, through a server anyone can reach (https://portals.onyxmueller.net).
- Built on Phaser 3 + Vite, with separate screens for title, home, join, lobby, game and results.
- Crews: start one and share a code, QR code or link; a captain who launches; rooms held for a
  minute when a phone drops out; any number of crews at once.
- Pointing out your crew, so each door on your screen points at the real person; tap a fault to
  call out for the part.
- iOS and Android apps (Capacitor) that use the same page.
- The spaceship game: rooms, faults with timers, parts that appear in another room, a shared
  hull, a score, an airlock for junk, and difficulty that climbs.
- Automatic deploys from GitHub, with a check that two pretend players can play.

## The phases

### Phase 0: Playtest what exists

No new features. Play with as many people as we can gather (3 or 4 is ideal).

- Is shouting for parts and flinging them fun?
- Which edge mapping feels right, Neighbors or Portals?
- Does a hard throw feel like it vanishes for a moment? (The server is far away; see Phase 7.)
- Tune fault timing and throw feel from what we learn.

**Done when:** we know the loop is fun. If it isn't, the rest of this plan changes.

### Phase 1: Foundation (done)

Rebuild the page on Phaser 3 + Vite. Same game, no new features.

- Separate screens: title, lobby, game, results.
- Our throw physics carried over as is.
- The build feeds the website and both phone apps.
- The automatic check still passes.

**Done when:** the rebuilt game plays the same as the prototype on both phones.

### Phase 2: Crews (done)

Any group can start their own journey.

- Start a crew and get a short code, a QR code and a link to share. Friends join with any of them.
- A lobby that shows who's aboard. The person who started the crew launches.
- If a phone drops out, it gets its room back when it reconnects, and the game carries on.
- Lots of crews can play at once without getting in each other's way.

**Done when:** two separate groups can play at the same time without seeing each other.

Left for later, on purpose:

- **Scanning a QR code from inside the app.** Today the QR code is scanned with the phone's own
  camera and opens the web game. App-to-app joining uses the typed code.
- **Invite links that open the app** when it's installed. That needs the app-store setup from
  Phase 7; until then links always open the web game.

### Phase 3: Where is my crewmate (done)

Each portal on your screen points at the real person.

- **Throw to calibrate** in the lobby (see "What we decided").
- Each portal shows the crewmate's room icon and name, not just a colour.
- **Request ping:** tap your fault, and every crewmate sees "Engine needs a Battery" on the portal
  that points at you.
- **Experiment:** use the phone's compass so portals keep pointing at the person when you turn
  your phone. We keep it only if it works indoors.

**Done when:** a new group can sit down anywhere, calibrate, and throw to the right person
without thinking about it.

Built: throw to calibrate (called "Point out your crew" in the game), doors with room icons and
names, and the request ping (tap your fault). Pointing was tried with real people and works.
The compass experiment was built, tried on a real phone and shelved: it wasn't clear enough to
be worth keeping. Where you pointed is stored as a direction, so it could be picked up again.

### Phase 4: Levels and story (8 legs built; the last 5 not yet played on phones)

Start with 3 levels, then grow the campaign.

- A level is one leg of the journey, a few minutes long, with a goal ("fix 12 faults to reach the
  next port") and a star rating.
- Each level adds one twist that's about throwing. Ideas:
  - **Asteroid belt:** hull breaches arrive in bursts.
  - **Stowaways:** critters hop between screens and have to be flung out the airlock.
  - **Nebula:** your screen goes dark except near your finger.
  - **Wormhole:** the portals swap who they lead to.
- **Stations** come in after the first few levels (see "More to do than fetch"). Ideas:
  - **Charger:** drop a dead battery on it and spin your finger in circles to crank it full.
  - **Welder:** hold a patch on the hot plate and let go in the green zone. Too long and it burns.
  - **Pump:** tap fast to fill an empty coolant can before the pressure drops.
  - **Fabricator:** put two parts in (scrap + wire) and get a new one out (a fuse).
  - **Crates:** some parts arrive boxed, and only Cargo has the crowbar.
  - **Two-room jobs:** a big part that two crewmates each have to hold at the same moment.
  - **Work on the fault itself:** scrub off slime, hold a valve shut, twist a bolt tight.
- Levels live in a simple data file that's easy to edit.
- Difficulty scales with the size of the crew.
- Story panels between levels.

**Done when:** a crew can play 3 different levels in a row with story between them.

Built: three legs with a briefing before each and stars after (Leaving port: fetch and drop;
Asteroid belt: hull breaches in every room at once; The long dark: the Charger station, where
flat batteries are cranked full with a spinning finger). Legs live in `server/levels.js`, and
the goal grows with the crew. Played on real phones: it works, though it may be too easy, so
the numbers want tuning with a fuller crew.

Then grown to 16 parts and faults (from 8) and eight legs. The five new legs are a second job
(geese, the other way): Fog bank (dark except near a finger), The patch-up (the Welder: hold and
let go in the green), Goose trouble (loose geese to airlock before they peck the hull), Dry run
(the Pump: tap fast) and Wormhole (the doors move; with only two phones, one edge at a time
leads to the other). Checked on the server and in a browser, not yet played on real phones.
Ideas not built: fabricator, crates, two-room jobs, work on the fault itself.

### Phase 5: Art, music and sound (look built; sound and music to do)

Chosen direction: "space-age print" for the game (deep teal, cream, mustard, a planet behind the
status strip, bold capitals for fault names only, flat shapes with hard shadows), with the
"ship's manual" voice for briefings (grid, typewriter text, line drawings labelled as figures,
dry quotes from the previous owner). Rules that came out of the mocks: only things you can pick
up are cream chips with a hard shadow; timers are thick rings that drain; coral is only for the
hull (about to be lost, or lost); an asteroid strike has its own look and says what to do.
The mocks are on a design canvas: https://claude.ai/artifact/JDpet2au5uNEb1uU5MvSTo

Built: the look is in the game on every screen, with our own drawn pictures in place of emoji
and two bundled typefaces (Rubik, IBM Plex Mono). One change from the mocks: the planet along
the bottom is the colour of your room, so crewmates can match a door on their screen to your
phone. After trying it on a phone, the game was turned to landscape (wide rooms suit a ship, and
there is more space): upright phones draw it sideways, upright tablets letterbox it, and faults
now appear at one of five spots across the room, not always the same two. Still to do: sound effects and music, the Charger drawing on its briefing page, and a
check of how it all looks on real phones.

- Start as a designer, not a builder: mock up a few different visual approaches (two or three
  distinct directions, each shown on the same screen) and choose between them before anything
  is applied to the game.
- Then everything: rooms, parts, faults, portals, hull damage, the ship.
- Make cause and effect readable. Today the asteroid strike in leg 2 flashes red and plays the
  hull-damage sound although no hull is lost, and "Asteroids!" doesn't say what to do. Red and
  that sound should only ever mean hull lost; a strike needs its own look, sound and words
  ("patch every room"), and the briefing should say a breach only costs hull if left unpatched.
- Music for each level, and sound effects for throwing, catching, fixing and failing.

**Done when:** nothing on screen or in the speakers is a placeholder.

### Phase 6: Onboarding and group fun

- A first level that teaches by doing, with no instructions to read.
- Shapes and icons alongside colours, so colour-blind players can tell rooms apart.
- Big moments when things go right and wrong.
- An endless mode for after the campaign.
- A results screen with crew stats ("most parts thrown", "most airlocked").

**Done when:** someone who has never seen the game can join and be useful within a minute.

### Phase 7: Release prep

- A final name. "Portals" is too close to a well-known game series to ship under.
- App icons, store pages and a privacy policy.
- Test releases on TestFlight and Google Play.
- A server closer to players. The current one is in France, which adds about a tenth of a second
  to every throw from the US.
- Talk to a lawyer who knows games before charging money.

**Done when:** friends outside the house can install a test build from a link.

## Rules we keep along the way

- **Our own game.** The idea of throwing between phones and the idea of a spaceship crew are both
  free to use. We don't copy another game's name, art, wording or screen layout.
- **Playable at every step.** Every phase ends with something we can play on real phones.
- **Easy to tune.** Difficulty numbers, parts, faults and levels live in plain lists near the top
  of their files.
