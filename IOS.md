# iOS app

The iOS app is the web app inside a [Capacitor](https://capacitorjs.com) shell (`ios/`). The same code runs in both;
`web/lib/native.js` adds what only the app can do and does nothing in a browser.

| | Browser | iOS app |
|---|---|---|
| Reminders (move, check-in, routines) | In-app banners only while open | Real notifications, with the app closed, with action buttons |
| Apple Health (steps, sleep) | Hidden | Read directly from HealthKit (`@capgo/capacitor-health`), synced on open |
| Screen rotation | Rotates | Portrait only (`Info.plist`) |
| Offline | Service worker | Files ship inside the app |

## Build and run

1. Install **Xcode** from the Mac App Store (about 10 GB). Open it once to accept the licence, then:
   `sudo xcode-select -s /Applications/Xcode.app`
2. `npm run ios`: builds `dist/`, copies it into the Xcode project and opens Xcode.
3. In Xcode: select the **App** target › Signing & Capabilities › pick your Team. Add the **HealthKit** capability if it
   isn't listed (the entitlements file is already there).
4. Pick a simulator or your iPhone (plugged in, Developer Mode on) and press ▶.

After changing web code: `npm run build:app && npx cap sync ios`, then ▶ again.

## TestFlight (friends)

Needs the Apple Developer Program ($99/yr, approval usually 1–2 days).

1. [App Store Connect](https://appstoreconnect.apple.com) › Apps › + › New App. Bundle ID `com.reginaldoke.unfugmyback`.
2. Xcode › Product › Archive › Distribute App › App Store Connect › Upload.
3. App Store Connect › TestFlight › add an External Testing group › make a **public link** and send it to friends.
   The first external build gets a light review (usually under a day). Testers send feedback with screenshots from
   the TestFlight app.

## App Store submission

- **Privacy policy URL:** https://reginaldoke.github.io/unfug-my-back/privacy.html
- **App Privacy ("nutrition label"):** Data Not Collected (everything stays on device; nothing is sent to a server).
- **Category:** Health & Fitness. **Age rating:** 4+.
- **Screenshots:** 6.9" iPhone (1320 × 2868), 3–5 of them: Today, check-in, body map, routine, calendar. iPhone only,
  so no iPad screenshots are needed.
- **Review notes:** "No account needed. Health access is optional (Settings › Apple Health) and read-only: steps and
  sleep, shown next to pain scores on the device. Notifications are local reminders to move and to check in."

### Review risks and how they're handled

- **4.2 Minimum functionality** (web wrappers get rejected): the app uses HealthKit, local actionable notifications
  and haptics, works offline and has no website login. Mention these in the review notes.
- **HealthKit (5.1.3):** usage strings explain why; data isn't used for ads or stored in iCloud; the privacy policy says so.
- **Medical claims (1.4.1):** the app tracks patterns and makes no diagnostic claims; the privacy policy and Help say so.

## Next

- Motion: a native plugin reading CoreMotion's activity history, so "still for an hour" works with the app closed.
- App icon: drawn as a vector in `design/app-icon.svg`; rendered to 1024 px (`qlmanage -t -s 1024 design/app-icon.svg`, flattened to no alpha) at `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`.
