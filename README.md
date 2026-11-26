# Ridge Runner — Alpine Courier

[![make.fun](https://make.fun/badge.svg?competition=best-flight-game-20261126-0057)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge.svg?competition=best-flight-game-20261126-0057&type=entries)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge.svg?competition=best-flight-game-20261126-0057&type=prize)](https://make.fun/bounty/best-flight-game-20261126-0057)

A bush-plane courier game for the make.fun best flight game bounty. Fly a
small prop plane through an alpine valley: deliver a parcel to Laketown
strip, fly all six sky rings, and bring her home to Pinefield before the
tank runs dry. Keyboard and mouse, offline, in a desktop browser.

- **Fly:** arrows or WASD to pitch and bank, Shift/Ctrl for throttle; the
  mouse steers too and the wheel is the throttle. C switches between the
  chase camera and the cockpit, P pauses, R restarts, M mutes.
- **The valley:** one seeded heightfield with a lake, pine forest, two
  lighted airstrips, drifting clouds and a low sun. Land gently on a strip
  to refuel; the mountains, the lake and a hard landing all end the flight.
- **The contracts:** three sorties in order — Parcel Run, Ring Route, Dusk
  Return — with fuel and hull to manage and a score that pays for rings,
  deliveries and gentle landings.

Built with Three.js (vendored under `game/vendor/`) and a hand-written
arcade flight model, HUD and synth audio. No network request, no build step:
open `game/index.html` from any static server and fly.

---
Built for the make.fun best flight game competition (best-flight-game-20261126-0057).
