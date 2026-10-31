# Back Pain Tracker App: Build Spec

Oct 27, 2026 · @Egg

## Overview and principles

A native iOS app that helps one person (later, the public) find and reduce their back pain triggers by logging daily factors, pain and movement, then analysing the data. Version 1 is for personal use; every decision should still allow an App Store release later.

**Goals**

1. Capture daily pain, stress, activities and recovery habits in under 60 seconds.
2. Show where pain is felt using a rotatable 3D body model.
3. Prompt movement breaks after prolonged inactivity.
4. Identify likely triggers and helpers from the data, including delayed effects (pain often appears hours to a day after the cause).
5. Export data for analysis in an AI chat now; add in-app AI analysis later.

**Principles**

- **Research-aligned measures.** Pain and stress use 0 to 10 numeric rating scales, the standard in back pain research. Monthly progress uses a short validated disability questionnaire.
- **Lagged analysis.** Compare pain against factors on the same day and the previous 1 to 2 days.
- **Single-person experiments.** Support deliberate "test a trigger" periods, modelled on n-of-1 trials.
- **Tolerance, not avoidance.** Framing follows cognitive functional therapy (CFT): the goal is rebuilding tolerance, not permanently avoiding movements. Copy should never imply bending or activity is dangerous.
- **Low friction.** Pre-fill from Apple Health and motion data wherever possible. Short check-ins beat detailed ones that get skipped.
- **No medical claims.** The app tracks and suggests habits. It never diagnoses, treats or claims to "fix" pain.

## Tech stack and architecture

Native iOS in Swift and SwiftUI, local-first storage, with clean layers so cloud sync and a backend can be added later without rewriting screens.

| Area | Choice | Notes |
| --- | --- | --- |
| Language and UI | Swift, SwiftUI | Target the latest iOS; minimum iOS 17 unless a feature needs newer |
| Storage | SwiftData | Local-first, all data on device in v1 |
| 3D body map | RealityKit (or SceneKit) | Rotatable model with tap hit-testing |
| Health data | HealthKit | Read-only in v1 |
| Motion data | Core Motion (CMMotionActivityManager, CMPedometer) | Activity history and steps |
| Notifications | UserNotifications, actionable notifications | Optional AlarmKit (iOS 26+) for alarm-style reminders |
| Background work | BackgroundTasks (BGAppRefreshTask), HealthKit background delivery | Opportunistic wake-ups for rescheduling |
| Voice (phase 3) | Speech framework (on-device transcription) | Transcript sent to an AI model for structuring |
| Backend (phase 4) | Small serverless API, e.g. Supabase or Cloudflare Workers | Holds the AI API key, sync, auth |

**Architecture rules**

- Layered: Views → ViewModels → Repositories → Storage/Services. Views never touch SwiftData or HealthKit directly.
- Each external source (HealthKit, Core Motion, notifications, AI) sits behind a protocol so it can be mocked in tests and swapped later.
- All records use UUIDs, UTC timestamps plus the user's time zone, and a schema version number.
- Nothing is hard-deleted that analysis depends on: archive instead.
- Never put an API key in the app binary.

## Data model

Triggers and helpers share one entity, Factor, distinguished by a role field. Every entity has `id` (UUID), `createdAt`, `updatedAt` (UTC) and `schemaVersion`.

| Entity | Key fields | Purpose |
| --- | --- | --- |
| Factor | name, role (trigger / helper / unsure), measureType (yes-no / minutes / count / rating), unit, category (activity / exercise / posture / lifestyle / recovery), status (suspected / testing / likely / ruled out), icon, isArchived, sortWeight, source (user / seed / AI-suggested) | Anything that might affect pain |
| FactorLog | factorId, date, timestamp (optional), value, source (manual / HealthKit / motion / voice), dailyEntryId (optional) | One occurrence of a factor |
| DailyEntry | date, painScore (0 to 10), stressScore (0 to 10), sleepQuality (0 to 10), notes, completedAt | The evening check-in |
| PainMarker | dailyEntryId or flareId, regionId, side (left / right / centre), intensity (0 to 10), quality (ache / sharp / burning / tingling / numbness / stiffness), modelPoint (x, y, z, optional) | Where pain is felt |
| Flare | timestamp, intensity (0 to 10), precedingActivity (text), suspectedFactorIds, notes | A pain spike logged in the moment |
| ReminderEvent | scheduledFor, firedAt, outcome (moved / snoozed / already moved / ignored / cancelled), stationaryMinutesBefore | Movement reminder history |
| RoutineCompletion | routineId, timestamp, completed (bool) | Mobility routine adherence |
| Routine | name, items (ordered list of exercise name + dose), schedule (times per day) | Stretch and mobility routines |
| MonthlyAssessment | date, instrument (e.g. RMDQ), answers, totalScore | Validated disability score over time |
| Experiment | factorId, mode (avoid / include), startDate, endDate, result summary | Deliberate trigger tests |
| DailyMetrics | date, steps, sleepHours, workoutMinutes, stationaryMinutes, longestStationaryBlock, drivingMinutes | Auto-collected daily totals |
| BodyRegion | regionId, displayName, side, parentRegion | Fixed reference list for the body map |

**Relationships**

- DailyEntry has many FactorLogs and PainMarkers.
- Flare has many PainMarkers and references suspected Factors.
- Factor has many FactorLogs and Experiments.
- A Factor's role and status can change over time; log changes so past analysis can be reproduced.

## Features

### Daily check-in

One evening screen, completed in under 60 seconds, prompted by a notification at a user-set time (default 9pm).

1. **Pain now:** 0 to 10 slider, then the body map (with a "same as yesterday" button).
2. **Stress and sleep:** 0 to 10 sliders.
3. **Activities section:** grid of factor cards with role trigger or unsure.
4. **Recovery section:** grid of factor cards with role helper.
5. **Auto data:** pre-filled steps, sleep, workouts, stationary and driving time, shown for confirmation.
6. **Notes:** optional free text (voice in phase 3).

Rules: allow backfilling up to 3 days. A "same as yesterday" option copies factor selections. An optional morning pain rating (actionable notification) helps catch delayed effects.

### Factor cards

- Cards sorted by most used in the last 14 days.
- Tap selects a card and expands it with a horizontal drag slider to set the amount. Use a slider inside the expanded card rather than a swipe gesture, to avoid clashing with list scrolling and the iOS back gesture.
- Amount control matches measureType: minutes snap to 5 or 15 minute steps, count snaps to whole numbers, yes-no is just selected, rating is 0 to 10.
- Tap the number to type an exact value.
- **Triggers:** warm colour (orange) with a warning-style icon. **Helpers:** cool colour (teal or green) with a tick icon. **Unsure:** neutral grey. Always pair colour with icon and section header for accessibility and dark mode.

### Factor management

- Add a factor from settings, from a "+ add" card in the check-in, or from a flare log ("What do you think caused this?" creates a suspected trigger).
- Edit name, role, measure type, unit, category, status and icon.
- Archive rather than delete. Archived factors keep their history and stop appearing in check-ins.
- Each factor has a detail screen with its analysis (see Analysis) and an option to start an experiment.

### 3D pain body map

A rotatable 3D human model where the user taps to mark where pain is.

- **Model:** a licensed, neutral human model (USDZ) split into named region meshes, so a tap hit-test returns a region ID. Check the licence allows commercial App Store use.
- **Interaction:** drag to rotate, pinch to zoom, quick buttons for front, back, left and right views. Tap a region to select; tap again to deselect.
- **Per marker:** intensity (0 to 10) and quality (ache, sharp, burning, tingling, numbness, stiffness). Selected regions highlight with a colour scaled to intensity.
- **Regions (minimum):** neck; upper back left, centre, right; mid back left, centre, right; lower back left, centre, right; buttock left, right; hip left, right; groin left, right; back of thigh, front of thigh, knee, calf, shin, ankle, top of foot, sole of foot (each left and right). Leg regions matter because back problems can refer pain and tingling into the legs.
- **Storage:** region ID is the primary data (analysable). The exact tap point (x, y, z) is optional extra detail.
- **Accessibility fallback:** a 2D front and back body chart, and a VoiceOver-friendly list of regions.
- **History view:** a heatmap on the model showing how often each region was marked over a chosen period.

### Flare log

- One-tap entry from the home screen and a widget.
- Captures time, intensity, body map markers, what you were just doing, and suspected factors.
- Flares appear on the timeline and feed into analysis.

### Routines

- Routines are editable lists of exercises with doses (reps or seconds).
- Reminders at set times (default twice daily).
- Mark complete from the notification or in the app. Completion is logged as a helper factor automatically.

### Monthly assessment

- A validated disability questionnaire once a month (Roland-Morris Disability Questionnaire suggested; check licensing before public release).
- Show the score trend over time. This tracks real-world function, which matters more than day-to-day pain.

### Home and history screens

- **Home:** today's pain, time since last movement, next reminder, routine status, quick buttons for flare and check-in.
- **Timeline:** a pain line chart with factor and flare markers, filterable by factor.
- **Insights:** per-factor results (see Analysis), consistency stats for helpers, and monthly scores.

## Movement reminders

Use a "dead man's switch": exactly one reminder is always scheduled a set interval ahead (default 30 minutes, adjustable 20 to 60), and is pushed back whenever the app sees recent movement. iOS does not allow continuous background sensor monitoring, so this is the App Store-safe approach.

**Rescheduling logic (runs on every wake)**

1. Query Core Motion activity history and pedometer data since the last check.
2. If there was real movement (default: 2+ minutes walking or running, or 150+ steps), cancel the pending reminder and schedule a new one for the interval after that movement ended.
3. If the history shows driving, push the reminder back rather than letting it fire mid-drive.
4. Otherwise leave the pending reminder in place.
5. Record the stationary duration and outcome in ReminderEvent.

**Wake sources**

- App opened or brought to foreground.
- Actionable notification buttons: "Moving now", "Already moved", "Snooze 10 min". Handle these in the background without opening the app, run the logic above, and reschedule.
- BGAppRefreshTask (opportunistic, iOS decides timing).
- HealthKit background delivery for step count (roughly hourly at best).

**Context rules**

- Active hours only (default 8am to 10pm, adjustable per weekday).
- Respect Focus modes and a manual "pause reminders for X hours" option.
- Notification copy is neutral and short, e.g. "You've been still for about 30 minutes. Time for a quick move?" Optionally suggest one exercise from the routine.
- Optional alarm-style reminders via AlarmKit (iOS 26+), off by default.

**Personal-build option (not for App Store)**

A developer setting that enables background location updates to keep the app alive for real-time stationary detection. Expect higher battery use. Keep it behind a build flag so it is excluded from App Store builds.

## Apple Health and motion data

Auto-collected data fills DailyMetrics each evening and pre-fills the check-in, so the user types less and the analysis has objective inputs.

| Source | Data | Use |
| --- | --- | --- |
| HealthKit | Step count, walking and running distance | Daily activity, movement factor |
| HealthKit | Sleep analysis | Sleep hours alongside self-rated sleep quality |
| HealthKit | Workouts (type, duration) | Pre-fill training factors (e.g. running, strength) |
| Core Motion activity | Stationary, walking, running, automotive, cycling periods (about 7 days of history) | Stationary minutes, longest stationary block, driving minutes |
| Core Motion pedometer | Steps per interval | Movement detection for reminders |

**Notes**

- Request permissions with a clear explanation screen during onboarding; the app must work if any permission is denied.
- Read motion history at least daily, since iOS keeps only about 7 days.
- A phone left on a desk reads as stationary even if the user is moving. Show auto data as editable estimates, not facts.
- Map auto data to factors where sensible (e.g. a HealthKit run creates a FactorLog for the "running" factor with source = HealthKit), but let the user confirm.

## Analysis and AI

Simple on-device statistics run in v1; an AI chat does the deeper interpretation via export, and later in-app through a backend.

### On-device analysis (per factor)

- **With vs without:** mean pain on days the factor occurred vs days it did not, at lag 0 (same day), lag 1 (next day) and lag 2.
- **Dose response:** for minutes or count factors, pain by amount bucket (e.g. none, low, medium, high).
- **Flare association:** how often the factor occurred in the 24 hours before a logged flare.
- **Minimum data:** show a result only with at least 5 days with and 5 days without the factor; otherwise show "not enough data yet" and how many more days are needed.
- **Confidence label:** low, medium or high based on sample size and effect size. Always phrase results as associations, never causes.
- **Helpers:** the same comparisons, plus consistency (e.g. "routine done 9 of 14 days").
- **Experiments:** compare the experiment period against the preceding matched period.

### Export for AI analysis (phase 1)

- Settings → Export creates a JSON file (all entities, factor definitions, date range selectable) and shares it via the iOS share sheet.
- The export includes a ready-made analysis prompt so the user can paste both into an AI chat.
- Also offer CSV per table for spreadsheet use.

Suggested built-in prompt:

```markdown
You are analysing a personal back pain diary exported as JSON.
Pain and stress are 0 to 10. Factors have a role (trigger, helper, unsure).
1. Summarise pain trends and flare frequency over the period.
2. For each factor, compare pain on days with vs without it at same day, next day and two days later.
3. Check dose response for minute and count factors.
4. Identify factors most often present in the 24 hours before flares.
5. Note where pain was located (body map regions) and any changes.
6. Flag combinations (e.g. long sitting plus training on the same day).
7. State confidence and sample sizes. Treat findings as associations, not causes.
8. Suggest up to 3 experiments to test the strongest suspected triggers or helpers.
Do not give a diagnosis.
```

### Voice logging (phase 3)

1. On-device speech transcription (Speech framework).
2. Transcript sent to an AI model via the backend with the user's factor list.
3. The model returns structured JSON: factor logs with amounts, pain and stress scores, flare details, and suggested new factors.
4. User reviews and confirms before anything is saved.

### In-app AI (phase 4)

- A backend endpoint proxies AI API calls; the key never ships in the app.
- Weekly AI summary and on-demand "analyse my data" using the same prompt.
- Send only the data needed (summaries or a date range), and let the user opt in.

## Privacy, App Store and regulation

Build for privacy from day one, so the public release needs no rework.

- **Data stays on device in v1.** No analytics or third-party SDKs that collect health data.
- **Health data rules.** Apple restricts how HealthKit data can be used and shared (no advertising or data mining). Provide a privacy policy and accurate App Store privacy labels before release.
- **AI features are opt-in.** Clearly explain what is sent to the AI service, and send the minimum needed.
- **Export and delete.** Users can export all their data and delete everything from settings.
- **No medical claims.** Use wording like "track", "notice patterns" and "build habits". Avoid "diagnose", "treat", "cure" or "fix" in the app and store listing, since therapeutic claims can make software a regulated medical device (TGA in Australia, FDA in the US). Get advice before release if unsure.
- **Safety notice.** Onboarding and a help screen list warning signs that need prompt medical care: new numbness in the groin or saddle area, bladder or bowel changes, progressive leg weakness, or symptoms spreading to both legs.
- **Licensing.** Confirm licences for the 3D body model and the disability questionnaire before public release.
- **Background location** (personal build only) must be compiled out of App Store builds.

## Build phases

Four phases, each usable on its own. Finish and use each phase for at least a week before starting the next.

### Phase 1: Core tracking (MVP)

- [ ] Project setup, layered architecture, SwiftData models with schema versioning
- [ ] Factor management (add, edit, archive, roles, measure types) with seed factors
- [ ] Daily check-in with sliders, factor cards and drag amount control
- [ ] 3D body map with region hit-testing, intensity and quality, plus 2D fallback
- [ ] Flare log and home screen quick actions
- [ ] Routines with reminders and completion logging
- [ ] Movement reminders (dead man's switch) with actionable notifications and active hours
- [ ] JSON and CSV export with the analysis prompt

Acceptance: a full check-in takes under 60 seconds; a body map tap selects the correct region from any angle; reminders reschedule after a walk when the app is woken; export opens cleanly in an AI chat.

### Phase 2: Automatic data and insights

- [ ] HealthKit (steps, sleep, workouts) and Core Motion history into DailyMetrics
- [ ] Pre-filled check-in fields from auto data
- [ ] On-device per-factor analysis with lags, dose response and data thresholds
- [ ] Timeline chart, insights screen, body map heatmap
- [ ] Experiments
- [ ] Monthly assessment

Acceptance: insights show "not enough data" correctly below thresholds; lag 0, 1 and 2 results match a manual check on sample data.

### Phase 3: Voice logging

- [ ] On-device transcription
- [ ] Minimal backend endpoint to call an AI model for structuring
- [ ] Review-and-confirm screen before saving

Acceptance: a spoken summary of a day produces correct factor logs that the user can edit before saving.

### Phase 4: Scale and release

- [ ] Auth and optional cloud sync
- [ ] In-app AI analysis and weekly summaries
- [ ] Onboarding, privacy policy, App Store privacy labels, licence checks
- [ ] Accessibility pass (VoiceOver, Dynamic Type, colour contrast)
- [ ] TestFlight beta, then App Store submission

Acceptance: passes App Review with personal-build features compiled out.

## Seed data

New users start with a short list of common stressors and helpers switched on, more available to pick, and two starter routines (Daily mobility, and a Gym push / pull / legs split). See `web/lib/seed.js`.

**Open questions**

- Which 3D body model to license or commission? (Until decided, the 2D front/back chart is the primary body map; region IDs match so data carries over.)

## Decisions log

- **2026-10-28 · Web prototype first.** Xcode isn't installed yet, so the flows are being prototyped as a local web app (`web/`, `server.js`) before the native build. Storage, analysis, reminder rules and export mirror this spec so they port to Swift. Core Motion and HealthKit are stubbed: a movement simulator stands in for motion data, and the "Auto data" step waits for phase 2.
- **2026-10-28 · Default reminder interval is 45 minutes** (adjustable 20–60).
- **2026-10-28 · Main flows (owner's priorities):** setup with default stressors and helpers plus your own; a gamified daily survey under a minute (tap tiles, swipe for time, drag vertical bars for pain and stress, tap the body, free text with voice); a dashboard showing pain trend and activities associated with higher pain; a movement nudge after 45 minutes still; "Analyse with AI" from home (sharing the diary with an AI chat app); and defining a movement routine.
- **2026-10-28 · UI language:** triggers are called "stressors" in the UI; the data model keeps `role = trigger`.
- **2026-10-28 · Visual design:** black base with red ambient glow, liquid-glass surfaces and radii from the iOS 26 Control Center kit (tiles 30px, pill controls, vertical fill sliders), thin oversized numerals, minimal data vis (glowing area curve, tick rulers, single highlighted point). Source: the "Unfug my back inspo" Figma file.
