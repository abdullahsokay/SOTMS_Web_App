# SOTMS Cloud Functions — server-side monitoring backend

This package moves fleet **detection, alerting, and history** off the browser
tab and onto Firebase Cloud Functions (2nd gen, `firebase-functions/v2`, Node 20).
Previously all monitoring ran inside `src/contexts/GPSContext.tsx` /
`FuelLoadPage`, so the fleet was unmonitored whenever no operator had the
dashboard open. These functions run 24/7 on Google's infrastructure instead.

> ⚠️ **NOT YET DEPLOYED.** This is code only. Deploying Cloud Functions
> **requires the Firebase project to be on the Blaze (pay-as-you-go) plan.**
> The current project is not on Blaze, so `firebase deploy` will fail until it
> is upgraded. See the prerequisites below.

## Functions

| Function | Trigger | Purpose |
| --- | --- | --- |
| `onDeviceData` | RTDB `onValueWritten` on `devices/{deviceId}/latest` (project default RTDB instance) | Resolve tanker identity, compute fuel %, validate GPS (Pakistan bounds), update `fleet/{tankerId}/currentStatus`, append a `sensorReadings` history doc to Firestore, and raise **hatch-open-unauthorized** (critical) and **overspeeding** (warning) alerts. |
| `sweepStaleDevices` | `onSchedule` every 1 minute | Flip any tanker whose `lastSeen` is older than `OFFLINE_THRESHOLD_MS` (15s) and still marked online to `online:false`, and raise a one-time `device_offline` alert. Replaces the browser-dependent offline detection. |
| `pruneHistory` | `onSchedule` daily | Delete Firestore `sensorReadings` docs older than the retention window (default 30 days), batched at ≤500 per commit. |

All functions run in region **`asia-southeast1`**.

## Alert idempotency

Server alerts are written to the Firestore **`alerts`** collection using the
exact schema the UI reads (`src/components/Alerts/AlertsPage.tsx`): `type`,
`tankerId`, `tankerName`, `timestamp` (ISO string), `severity`,
`location{lat,lng,address}`, `status:'unacknowledged'`, `description`,
`resolved:false`, and optional `sensorData`.

To avoid duplicates when a trigger fires repeatedly (Cloud Functions are
at-least-once), every alert uses a **deterministic document id** and is written
with `create()` (never overwritten, so operator acknowledgements are
preserved):

- Hatch: `${tankerId}_hatch_${hatchId}_${bucket}` — only raised on the
  closed→open transition, outside all authorized zones.
- Overspeed: `${tankerId}_overspeed_${bucket}`.
- Offline: `${tankerId}_offline_${lastSeen}` — one alert per offline episode.

`bucket = floor(now / ALERT_DEDUP_BUCKET_MS)` (10-minute window).

## Local build (no billing required)

```bash
cd functions
npm install
npm run build   # runs tsc → emits lib/, must exit 0
```

## Deploy runbook (requires Blaze)

```bash
cd functions
npm install
npm run build
# from the repo root (or functions/) — deploys only the functions codebase:
firebase deploy --only functions
```

`firebase.json` already wires this package in: `functions.source = "functions"`,
`codebase = "default"`, with a predeploy hook that runs the build.

## Prerequisites before this can go live

1. **Blaze plan.** 2nd-gen Cloud Functions (Cloud Run / Eventarc / Cloud
   Scheduler) require the project to be on the Blaze pay-as-you-go plan.
2. **Per-device auth tokens for the ESP boards.** The RTDB write rule was
   tightened to `auth != null` (`database.rules.json`). ESP devices currently
   write unauthenticated and will be **rejected** until each board is
   provisioned a Firebase custom token (ideally with `uid == deviceId`, matching
   the documented hardening target `auth.uid == $deviceId`). Provision these
   tokens **before** relying on the server pipeline — otherwise no device data
   reaches `onDeviceData`.
3. **RTDB instance region.** These functions declare region `asia-southeast1`.
   RTDB triggers must match the default database instance's location; adjust
   `REGION` in `src/index.ts` if the instance lives elsewhere.

## Follow-up (do NOT do as part of this task)

Once these functions are live, the browser-side detection can be removed:

- `src/contexts/GPSContext.tsx` — offline alerting, hatch/overspeed detection,
  and the `fleet/currentStatus` + history writes.
- `FuelLoadPage` monitoring logic.
- `AlertsContext` client-side alert generation.

Leave that removal as a separate change so the app keeps working during the
migration.
