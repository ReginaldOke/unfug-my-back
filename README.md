# Unfug My Back

A back pain tracker for iPhone (a Capacitor app, see `IOS.md`) that also runs as a website. Everything is stored on the device; nothing is sent to a server.

## Run it

```bash
npm install
npm start
```

Open http://localhost:4321. The server only answers this Mac. To try it from a phone on the same Wi-Fi, start it with `HOST=0.0.0.0 npm start` (on a network you trust) and open `http://<your-mac's-IP>:4321`.

"Analyse with AI" shares the diary file with whichever chat app you pick; the app never sends it anywhere itself.

## Use it on your phone

Live site: https://reginaldoke.github.io/unfug-my-back/ (redeploys on every push to `main`).

On iPhone, open it in **Safari → Share → Add to Home Screen**. It then opens full screen, works offline, and its data isn't cleared the way website data can be after 7 days unused. Data lives on the phone; use Settings → Export now and then as a backup.

## Tests

```bash
npm test
```

Covers the analysis maths (lag 0/1/2, thresholds, dose response, flare association), the movement reminder rules (active hours, thresholds, driving, pause), export, import (including doctored files) and reading other apps' data.

## What's where

| Path | What |
| --- | --- |
| `server.js` | Local development server (this Mac only) |
| `web/lib/store.js` | Storage: one JSON document in localStorage, UUIDs, UTC timestamps, schema version |
| `web/lib/repos.js` | Repositories: the only API the views use |
| `web/lib/analysis.js` | Per-factor with/without comparisons at lag 0–2, dose response, confidence |
| `web/lib/reminders-core.js` | Dead man's switch rules (pure); `reminders.js` runs them on every wake |
| `web/lib/motion.js` | Stand-in for Core Motion, fed by the movement simulator on the home screen |
| `web/lib/export.js` | JSON/CSV export and the built-in analysis prompt |
| `web/views/` | Screens: home dashboard, check-in, setup, factor detail, routines, flare, settings |
| `web/views/body3d.js` | 3D pain map (three.js): rotate, zoom, tap to mark; `web/lib/regions3d.js` maps a tap to a region |
| `web/views/controls.js` | Liquid-glass controls from the Figma kit: vertical fill slider, swipe tile, pill toggle |

## Prototype limits

- Data lives in this browser only. Clearing site data deletes it, so export from Settings if it matters.
- Reminders only fire while the page is open in a tab (the iOS app will use real notifications).
- No Apple Health or motion data. Use the movement simulator to test reminders.
- Voice notes use the browser's speech recognition. Chrome sends audio to Google to transcribe; the iOS app will transcribe on the device.
- The 3D body map shows a built-in stand-in figure until a real model is added (see below). The 2D chart stays available as a toggle and is the fallback where WebGL isn't supported.

## Adding the 3D body model

Browsers can't read 3ds Max `.max` files. Export the model as **glTF binary** and save it as `web/assets/body.glb` (an `.obj` saved as `web/assets/body.obj` also works):

- **3ds Max 2023 or later:** File → Export → Export… → choose *glTF Binary (*.glb)*.
- **Older 3ds Max:** export as FBX or OBJ, then convert to GLB (for example in Blender: File → Import → FBX, then File → Export → glTF 2.0).

The app scales the model to a standard height, puts the feet on the floor, turns Z-up exports upright and gives it the app's material. If it loads facing backwards, set `MODEL_YAW = Math.PI` in `web/views/body3d.js`. Regions come from where a tap lands on the body, so the mesh doesn't need to be split into parts.

Check the model's licence allows use in an App Store app before release (SPEC.md › Licensing).
