# SOTMS — Industrial Production-Readiness Audit

**System:** Smart Oil Tanker Monitoring System (Web Dashboard)
**Reviewed build:** `main` branch, working tree at `d:\Downloads\SOTMS_Web_App-main\SOTMS_Web_App-main`
**Date:** 2026-07-23
**Auditor posture:** Pre-deployment gate review — treated as a system that ships tomorrow and controls petroleum-tanker safety monitoring. No benefit of the doubt.
**Verdict:** ❌ **NOT production-ready. Do not deploy.** Multiple catastrophic security and data-integrity defects; the flagship fuel-theft feature is mathematically wrong; the "backend" runs inside a browser tab.

---

## Phase 1 — Architecture Overview

### Stack
- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind, `@vitejs/plugin-react-swc`. ~150 source files.
- **State:** React Context (`GPSContext`, `ThemeContext`, `GoogleMapsContext`) + `localStorage`. No Redux/Zustand, **no router** — navigation is a `currentPage` string switch in `App.tsx`.
- **Backend:** **None.** No Cloud Functions, no server. The client SDK talks directly to Firebase. `firebase.json` declares only hosting + rules.
- **Data:** Firebase **Realtime Database** (live device data) + **Firestore** (alerts/incidents/reports/users) + a **dead Firebase Data Connect (Postgres)** schema that is the untouched "movie review" sample.
- **Auth:** Firebase Email/Password.
- **Maps:** Google Maps JS + Leaflet/react-leaflet (both included).
- **IoT edge:** ESP32/ESP8266 devices writing GPS + ultrasonic distance + RSSI to RTDB `/devices/$id/latest`.

### Data flow (as built)
```
ESP device ──(unauthenticated write)──▶ RTDB /devices/$id/latest
                                             │
                     GPSContext.onValue('/devices')  ◀── runs ONLY in an open browser tab
                                             │
        derives tankers[], speed, status, alerts, fuel, driver-behaviour, history
                                             │
              writes back ──▶ RTDB /fleet, /tankers, /alerts  (⚠ nothing reads these)
              writes ──▶ Firestore /alerts, /incidents, /reports, /mail
                                             │
                     Dashboard / Tracking / Fuel / Alerts / Reports UI
```

### Core structural problems (drive everything else)
1. **The browser is the backend.** All ingestion, offline detection, fuel-theft logic, driver scoring, history persistence and alerting run in React effects (`GPSContext.tsx`, `FuelLoadPage.tsx`, `DriverBehaviourPage.tsx`). Close every tab at 6pm → the fleet is unmonitored overnight. Disqualifying for a safety system.
2. **3–4 competing data models.** Firestore typed collections (`types/database.ts`), RTDB live paths (`database.rules.json`), RTDB legacy paths in `firebaseService.ts` (`realtimeData`, `activeAlerts`, `tracking`), and the dead DataConnect Postgres schema. Most writes go to paths nothing reads.
3. **No device identity.** RTDB `/devices` is world-writable (`.write: true`).
4. **No CI / typecheck / lint gate**, tautological tests, broken deploy target.

---

## Phase 8 — Security Audit (most severe first)

| # | Finding | Sev | Location |
|---|---------|-----|----------|
| S1 | **RTDB `/devices` & `/readings` are world-writable** (`.write: true`) — no device auth. Anyone on the internet can inject/overwrite/delete GPS + sensor data. | 🔴 Critical | `database.rules.json:10,28` |
| S2 | **Live admin email + password hardcoded** in a committed script (`abdullah1234.`). Full account takeover; the account has broad delete rights. | 🔴 Critical | `scripts/cleanup.mjs:26` |
| S3 | **Privilege escalation — self-service admin.** `users` update rule doesn't lock the `role` field; any user sets `role:'admin'` on their own doc, and `isAdmin()` trusts that field. | 🔴 Critical | `firestore.rules:31` |
| S4 | **Self-assigned admin at registration.** `create` rule lacks `uid==auth.uid` and role constraint; a non-client request can create `users/{uid}` with `role:'admin'`. | 🔴 Critical | `firestore.rules:30` |
| S5 | **Plaintext password in `localStorage`** ("Remember me") — leaks on any XSS or shared terminal. | 🔴 Critical | `LoginPage.tsx:71` |
| S6 | **All user PII world-readable to any authenticated user** — CNIC (national ID), phone, email, company. Any self-registered account reads the whole `users` collection. | 🟠 High | `firestore.rules:29` |
| S7 | **No email verification** — anyone registers with any email and gets full access. | 🟠 High | `RegisterPage.tsx`, `App.tsx:38` |
| S8 | **Google Maps API key hardcoded** as fallback in 5 files (and in a test). Billable-quota theft if not referrer-restricted. | 🟠 High | `useSnapToRoads.ts:3`, `MapWidget.tsx:89`, `MapView.tsx:283`, `GoogleMapsContext.tsx:16` |
| S9 | **`scripts/clearFirebase.html`** — a one-click "WIPE ENTIRE RTDB" + per-collection delete tool shipped in the repo, embedding full Firebase config. | 🟠 High | `scripts/clearFirebase.html` |
| S10 | **Security controls are theater** — 2FA toggle, session timeout, change-password, login alerts do nothing (`console.log`). Operators believe they're protected. | 🟠 High | `SecuritySettings.tsx:78,109,210` |
| S11 | Weak password policy (6 chars, no complexity). | 🟡 Medium | `RegisterPage.tsx:76` |
| S12 | User/email enumeration via distinct error messages. | 🟡 Medium | `LoginPage.tsx:112`, `RegisterPage.tsx:122` |
| S13 | **`mail/` create open to any auth user** — spam/phishing sent from your trusted domain via the Trigger-Email extension. | 🟡 Medium | `firestore.rules:164` |
| S14 | No client-side role gating — every page renders for every user; TopNav hardcodes "Admin". | 🟡 Medium | `App.tsx:104`, `TopNav.tsx:58` |
| S15 | `dangerouslySetInnerHTML` in chart (dev-controlled today; latent XSS if config ever sourced from data). | 🟢 Low | `ui/chart.tsx:83` |

**Fixes (essentials):** rotate S2 password + S8 key immediately; set `.write` to `auth.uid == $deviceId` (or a device token) + `$other {.validate:false}`; lock `role` immutable in `users` create/update rules; stop persisting passwords (use `browserLocalPersistence`); restrict `users` read to owner/manager; add `sendEmailVerification` + `emailVerified` gate; enable **Firebase App Check**; delete `clearFirebase.html`/`cleanup.mjs`/`seedRTDB.ts` from the shipped tree; wire or remove every fake security control.

---

## Phase 13 — Bug Hunt (verified defects)

| # | Bug | Sev | Location |
|---|-----|-----|----------|
| B1 | **Infinite recursion.** `getFuelLevelCm` returns `getFuelLevelCm(data)` when the device sends flat `distance_cm` (the documented canonical shape) → `RangeError`, caught, fleet renders empty. **Verified.** | 🔴 Critical | `GPSContext.tsx:51` |
| B2 | **Fuel-theft math is inverted and unit-wrong.** `fuelLevel` is raw ultrasonic **cm** (distance to surface). `actualFuelLoss = 100 - fuelLevel` and `flag if fuelLevel<20`. A **full** tank (small cm) → flagged theft; a **drained** tank (large cm) → "Normal". No calibration/capacity/volume conversion. **Verified.** | 🔴 Critical | `FuelLoadPage.tsx:143-147`, `GPSContext.tsx:567` |
| B3 | **Broken deploy target.** `firebase.json` hosting `public: "public"` but Vite builds to `dist/`; no `predeploy`. `firebase deploy` ships an empty/missing dir. | 🔴 Critical | `firebase.json:4` |
| B4 | **Random collidable IDs.** `RT-${Math.random()*1000}` / `ASSIGN-…` persisted via `setDoc(doc(...,id))` → collision overwrites an existing route/assignment. | 🟠 High | `CreateRouteModal.tsx:88`, `DrawRouteModal.tsx:83`, `RouteManagementPage.tsx:140,176` |
| B5 | **`behaviour` missing from `validPages`** → refreshing the Driver Behaviour page silently bounces the operator to Dashboard. | 🟠 High | `App.tsx:25` |
| B6 | **Mobile navigation dead.** Sidebar is `hidden lg:block`; the `<lg` hamburger toggles a container that stays hidden → no way to navigate below 1024px. | 🟠 High | `App.tsx:107`, `TopNav.tsx:18` |
| B7 | **`StatusStrip` divides by zero** → "Avg Fuel NaN%" on the normal empty-fleet cold start. | 🟡 Medium | `StatusStrip.tsx:19` |
| B8 | **Dead action buttons** — "Resolve Alert" (no `onClick`), alert comment textarea (no handler), fuel/analytics Export (`console.log`), "Date Range" filter (no-op). Operators assume actions happened. | 🟠 High | `AlertDetailModal.tsx:274,249`, `FuelLoadPage.tsx:367`, `AlertFilters.tsx:98` |
| B9 | **Change Password is fake** (`console.log('Password changed')`). | 🔴 Critical | `SecuritySettings.tsx:210` |
| B10 | **Alarm/alert state is page-local.** Hatch-breach alerts + 880 Hz alarm live in `FuelLoadPage` state; navigating away destroys them. A hatch breach must survive navigation. | 🟠 High | `FuelLoadPage.tsx:47,74` |
| B11 | **Fake trust signals** — TopNav notification badge hardcoded `3`; sidebar footer hardcoded "Connected"; username hardcoded "Admin". The most trust-critical numbers are lies. | 🟠 High | `TopNav.tsx:12,58`, `Sidebar.tsx:62` |
| B12 | **`fuelLevel` rendered as both cm and %** across screens; `FuelDetailPanel` shows raw cm as "Oil Level %". | 🟠 High | `FuelDetailPanel.tsx:433` vs `FuelOverviewTable.tsx:97` |
| B13 | Empty `catch` blocks swallow `deleteDoc` failures → failed delete looks like success. | 🟡 Medium | `RouteMapView.tsx:690,694`, `FuelLoadPage.tsx:70` |
| B14 | `addTripDeviation` counter: `undefined+1 || 1` → always resets to 1; extra read. | 🟢 Low | `firebaseService.ts:453` |
| B15 | **No error boundary anywhere** — any render throw white-screens the whole monitoring dashboard. | 🟠 High | (absent) |

---

## Phase 10 — IoT Reliability

- **No device authentication** (B/S1) — the anti-theft premise is defeatable by an unauthenticated HTTP request.
- **No heartbeat / watchdog / reconnect / `onDisconnect`.** "Offline" = `now - lastSeen > 15s` using the **device-supplied** timestamp, recomputed only when *some other* device pushes. A silent fleet may never flag offline. A device with a bad RTC is permanently online/offline.
- **Alerts fire only from an open tab, de-duped in volatile RAM** (`offlineAlertedRef`). N tabs = N duplicate alerts; refresh re-fires everything; zero tabs = silence.
- **No duplicate/packet-loss/corruption handling.** History keyed by `history/${timestamp}` → same-timestamp packets overwrite; no sequence numbers, no CRC, only a Pakistan bounding-box sanity check.
- **Timestamp seconds-vs-ms guessed by magnitude** (`<1e11`) — misclassifies edge values.
- **Whole `/devices` tree re-downloaded every tick** — doesn't scale.
- **Speed computed from browser wall-clock arrival time**, not GPS fix time → burst delivery yields huge/tiny speeds (capped at 150). The NMEA ground speed is ignored.
- **Harsh-braking uses raw Δspeed with no Δt** → a normal 30 s decel scores identical to a 2 s slam; docks driver scores on noise.

**Fix:** move ingestion + staleness sweep + alerting + scoring to **Cloud Functions**; ESPs use `ServerValue.TIMESTAMP` + `onDisconnect`; per-device auth tokens; sequence numbers; use GPS-reported speed/time.

---

## Phase 7 — Database Review

- **Competing schemas.** RTDB `/devices` (real), RTDB `/fleet` + `/tankers` + `/alerts` (**written by GPSContext, read by nobody**), `firebaseService` `realtimeData`/`activeAlerts`/`tracking` (mostly dead; `tracking` is read but never written → `useVehicleTracking` is permanently empty), Firestore typed collections (`tankers`/`devices`/`trips`/`sensorReadings` — **never written**, their CRUD layer has no callers), and **DataConnect Postgres = the movie-review sample** (User/Movie/Review), shipped as a `file:` dependency, imported nowhere.
- **Alerts split across two stores** with **two different schemas** for the same hatch event (`hatch_open` vs `hatch_open_unauthorized`); RTDB-only alerts (offline, fuel hatch) **never reach the Firestore-backed Alerts page** — operators never see them.
- **Read paths never written** — `gps_history`, `sensors`, `sensorReadings` are read by path-history/analytics but written nowhere → replay, KML export and historical analytics are permanently empty.
- **No `firestore.indexes.json`** — composite queries (`FuelLoadPage` reports, `getSensorReadings`, `getActiveTrips`, incidents) throw "requires an index" at runtime.
- **No retention/TTL** — every online tick writes two RTDB history nodes forever (~86k nodes/device/day), `gpsHistoryRetentionDays` defined but never applied → unbounded cost/latency.
- **timestamp-as-node-key** antipattern.

**Fix:** one model — ESP → `/devices/$id/latest`; Cloud Function → derived `/fleet` + Firestore cold history with TTL sweeper; delete DataConnect + dead RTDB paths + unused CRUD; commit indexes; consolidate to one alert collection with one writer.

---

## Phases 2–5 — Code Audit, Architecture, Frontend, UX

**Duplication (consolidate):**
- `getSeverityColor`/`getStatusColor` copy-pasted **7×** (already drifted — two reds, two ambers for the same severity). → `utils/statusColors.ts`.
- CSV-export boilerplate **9×** (inconsistent escaping/BOM). → `exportCsv()` util.
- Haversine implemented **4×** (`GPSContext`, `usePathHistory`, `useETACalculation`, `useNearbyPlaces`). → `mapUtils`.
- Card shell `bg-[#0C1E2C] border … neon-glow` repeated **50+×**; toast block, toggle switch, status-color constants all duplicated. → shared `<Panel>`, `useToast`, `<Toggle>`.
- **Two conflicting `Alert` types** (`types/index.ts` vs `AlertsPage.tsx`) — no single source of truth.

**Dead code:**
- **The entire `src/components/ui/` shadcn library (~46 primitives) is unused** — zero imports outside the folder; every screen is hand-rolled. ~megabytes of bundle + audit surface. Delete or actually adopt.
- ~12 unused feature components (`FuelLoadCharts`, `SystemReliability`, `HistoricalAnalytics`, `LiveSensorFeed`, `SensorCard`, `TrendChart`, etc.) — several stuffed with fabricated data, one import away from shipping.
- DataConnect + generated SDK; management hooks (`useTankerManagement`, `useTripManagement`, `useDeviceManagement`, `useSystemConfig`); `App.tsx` `handleLogin`/`handleRegister` no-op stubs.

**Fabricated / hardcoded data in a *monitoring* product (highest-trust concern):**
- `SystemReliability.tsx` — fabricates every subsystem uptime, "98.6% Overall Uptime", "6/6 online". A health panel that invents health tells operators all-clear while blind.
- `FuelLoadCharts.tsx` — 100% mock tankers/stats.
- `FuelLoadPage.tsx:159` — `company` invented as "Attock" for any non-PSO tanker, then drives the Company filter, incident reports **and alert emails**.
- `AlertDetailModal` mini-map marker fixed to image center regardless of real lat/lng shown beside it → misleads on incident location.
- `AlertsTable` fake pagination (dead "page 2"); `AlertsSummaryCards` `/10` magic bar.

**Frontend quality / UX:**
- **Light mode is broken** — panels use hardcoded dark hex utilities that ignore the `light-mode` class → dark cards on pale page. Ship-blocking if exposed.
- **Accessibility** — icon-only buttons without names; modals lack `role="dialog"`/focus-trap/Escape; clickable `<tr>` not keyboard-reachable; color-only status (parked vs offline indistinguishable).
- **Destructive actions inconsistent** — Reports delete + bulk-ack with no confirm; Routes uses native `confirm`; Drivers uses a proper modal (the one good pattern).
- **"Refresh" = `window.location.reload()`** on live `onSnapshot` pages (×4) — tears down the session to refresh already-streaming data.
- **Settings Save/Cancel lie** — Save only `console.log`s success; Cancel doesn't revert.

---

## Phases 6, 9, 12 — Backend / Performance / Code Quality

- **Backend:** none — see Phase 1. All logic client-side; no server validation, no idempotency, no rate limiting, no audit trail.
- **Performance:** single **1.8 MB** JS chunk (no code splitting / lazy loading; warning limit raised to hide it); whole `/devices` tree re-downloaded per tick; **N² Distance-Matrix** billing for N useful results (`useDistanceMatrix.ts`); reverse-geocode inside the hot per-device loop (billing + `OVER_QUERY_LIMIT`); `GPSContext` value not memoized + 4 `setState`s per snapshot → every consumer re-renders per tick; `getFuelLevelCm`/`parseHatches` recomputed 4×/2× per device per tick.
- **Code quality:** `tsconfig` is strict **but nothing runs `tsc`** (SWC strips types) → strictness is aspirational; **`tsc --noEmit` currently FAILS** (test files lack vitest globals; `Tanker[]` used but not imported; unused `mockRoutes`). **83** `console.*`, **28** `any`, 3 empty catches. No ESLint/Prettier, **no CI (`.github/` absent)**, no pre-commit hooks. Magic thresholds scattered inline (speed cap 150, moving >2, offline 15000, geofence 50/200). README is 9 lines ending in a stray fragment.

**Test suite (Phase 12 detail):** 239 tests, but **every test re-implements the logic inside the test file and imports zero production modules** — tautologies (`expect(localCopy(x)).toBe(localCopy(x))`). The copies have **already drifted** from production (`getTime` seconds/ms branch missing; offline threshold documented as 60s/2min vs real 15s). "Security" tests assert un-neutralized CSV-injection payloads are *present* and call it a pass; the "XSS" test compares a string to itself; one test hardcodes the real API key. `TEST_REPORT.md`'s "100% pass / Full coverage / zero defects" is **inflated** — real line coverage of `GPSContext`/`firebaseService`/components/auth/rules is ~0%. One perf test also fails on a brittle wall-clock assertion (`64.9ms < 20ms`).

---

## Phase 14 — Feature Gaps (enterprise tanker platform)

Missing and expected by a Shell/PSO-grade buyer: server-side ingestion + processing; **temperature & leak monitoring have no real data source** (typed in `SensorReadingDoc` but hardware only sends distance/GPS/RSSI); real device authentication & diagnostics/health; alert acknowledgement + escalation chains; **audit trail / tamper detection / event history**; per-tank fuel calibration; predictive maintenance & maintenance schedules; geofencing enforced server-side; route-deviation via **point-to-segment** distance (currently nearest-**vertex**, overstates deviation); multi-company/tenant isolation + role hierarchy (RBAC); report scheduling & robust export; offline/redundancy/backup/disaster-recovery; localization; compliance reporting (HSE); real 2FA + session policy.

---

## Phase 15 — Scorecard

| Dimension | Score /100 | One-line justification |
|-----------|:---:|---|
| **Overall** | **19** | Catastrophic security + broken core feature + no backend. |
| Industrial Readiness | 9 | Browser-as-backend; unmonitored when tabs close; no audit/redundancy. |
| Security | 6 | World-writable devices, hardcoded admin creds, self-admin escalation, plaintext passwords. |
| Performance | 34 | Works at toy scale; 1.8 MB chunk, full-tree fetch, N² calls, per-tick re-renders. |
| Architecture | 22 | 3–4 competing data models, dead DataConnect, no router, logic in components. |
| UX | 28 | Dead buttons, fake data, broken mobile nav, alarm lost on navigation. |
| UI | 44 | Cohesive dark theme, but broken light mode, color drift, a11y gaps. |
| Backend | 12 | There is no backend. |
| Database | 22 | Competing/write-only schemas, no indexes, no retention, unbounded growth. |
| IoT | 11 | No device auth, no heartbeat/reconnect, wall-clock speed, recursion crash. |
| Maintainability | 30 | Heavy duplication, dead `ui/` lib, 83 console, 28 any, no lint/CI. |
| Scalability | 18 | Full-tree re-download, N² geocode/matrix, unbounded RTDB, single chunk. |
| Code Quality | 30 | Strict TS unenforced, typecheck fails, tautological tests. |
| Reliability | 14 | Recursion crash, no error boundary, page-local alerts, fake status. |
| Production Readiness | 9 | Deploy target broken; everything above. |

---

## Priority Table

| Pri | Issue | Sev | Risk | Business Impact | Est. Fix |
|-----|-------|-----|------|-----------------|----------|
| P0 | Rotate leaked admin password (S2) + Maps key (S8) | 🔴 | Extreme | Account takeover, billing theft | 1 h |
| P0 | Lock `/devices` RTDB write + device auth (S1) | 🔴 | Extreme | Spoofed data hides theft/fire | 1–2 d |
| P0 | Fix `users` role self-escalation (S3/S4) | 🔴 | Extreme | Anyone becomes admin | 2–4 h |
| P0 | Fix `getFuelLevelCm` recursion (B1) | 🔴 | Extreme | Fleet renders empty | 15 min |
| P0 | Rebuild fuel math + calibration (B2, B12) | 🔴 | Extreme | Theft missed / false alarms | 3–5 d |
| P0 | Fix deploy target `public`→`dist` (B3) | 🔴 | High | Cannot deploy | 15 min |
| P0 | Remove plaintext password localStorage (S5) | 🔴 | High | Credential leak | 1 h |
| P0 | Delete `clearFirebase.html`/`cleanup.mjs` from tree (S2/S9) | 🔴 | Extreme | Mass data destruction | 15 min |
| P1 | Move ingestion/alerting/scoring/history to Cloud Functions | 🟠 | High | Unmonitored fleet, dup alerts | 2–3 wk |
| P1 | Restrict `users` read; email verification; App Check (S6/S7) | 🟠 | High | PII breach, spoofed accounts | 1–2 d |
| P1 | Collapse to one data model; one alert store; indexes; TTL | 🟠 | High | Invisible alerts, runaway cost | 1–2 wk |
| P1 | Wire or remove fake controls/buttons (S10, B8, B9, B11) | 🟠 | High | False sense of safety | 3–5 d |
| P1 | Random-ID overwrite → Firestore auto-IDs (B4) | 🟠 | High | Route data loss | 2 h |
| P1 | Global alert/alarm provider (B10); error boundary (B15) | 🟠 | High | Missed hatch breach, white-screen | 2–3 d |
| P1 | Fix mobile nav (B6); `behaviour` restore (B5) | 🟠 | Med | Unusable on mobile | 1 d |
| P2 | CI: `tsc` + ESLint + real tests + build gate; fix type errors | 🟡 | Med | Regressions ship silently | 3–5 d |
| P2 | Rewrite tests to import real code; drop tautologies | 🟡 | Med | False safety signal | 1 wk |
| P2 | Fix light mode or remove; a11y pass; confirmations | 🟡 | Med | Unreadable UI, mis-clicks | 3–5 d |
| P2 | Code splitting / lazy load; memoize context; fix N² calls | 🟡 | Med | Slow, costly | 3–5 d |
| P3 | Delete dead `ui/` lib + ~12 unused components + DataConnect | 🟢 | Low | Bundle/maintenance | 1 d |
| P3 | Consolidate duplication (colors/CSV/haversine/cards) | 🟢 | Low | Drift, safety-signal bugs | 3–5 d |
| P3 | Real README + architecture docs; gitignore `dist/`+`build/`; pin `*` deps | 🟢 | Low | Onboarding, supply chain | 1 d |

---

## Refactoring Roadmap (by ROI + risk)

**Sprint 0 — Stop the bleeding (1–2 days).** P0 quick wins: rotate secrets, fix recursion (B1), fix deploy target (B3), delete destructive scripts + hardcoded creds, close the RTDB write rule to authenticated device writes, patch `users` role rules, remove password-in-localStorage. *No deploy until all P0 done.*

**Sprint 1 — Correctness of the core feature (1 week).** Per-tank fuel calibration (empty/full distance, capacity) → distance→volume→% ; theft = abnormal volume drop-rate while stationary/off-route; fix cm-vs-% everywhere; replace random IDs with auto-IDs; add error boundary + global alert/alarm provider.

**Sprint 2 — Real backend (2–3 weeks).** Cloud Functions for ingestion, staleness sweep, alerting (idempotent), driver scoring, history + TTL. ESPs: `ServerValue.TIMESTAMP` + `onDisconnect` + per-device auth. Collapse to one data model; one Firestore alert collection; commit `firestore.indexes.json`. Enable App Check + email verification; restrict PII reads; implement RBAC (client + rules).

**Sprint 3 — Quality gate (1 week).** GitHub Actions: `tsc → eslint → vitest → build`; make tests import production modules; add component/rules/integration tests; husky pre-commit. Pin `*` deps; gitignore artifacts.

**Sprint 4 — UX/perf polish (1 week).** Fix or remove light mode; a11y pass (roles, focus, labels, non-color status); consistent confirmations; adopt `react-router` + route-level lazy loading + vendor `manualChunks`; memoize context; fix N² geocode/matrix; delete dead `ui/` + unused components + DataConnect; consolidate duplication.

**Sprint 5+ — Enterprise features.** Real temperature/leak sensors + calibration; audit trail + tamper detection; alert escalation; geofence/deviation server-side (point-to-segment); predictive maintenance; multi-tenant; compliance reporting; backup/DR runbook.

---

*Prepared as a pre-deployment gate review. The system as reviewed should not be exposed to production traffic or real fleet data until, at minimum, all P0 items are closed and independently re-tested.*
