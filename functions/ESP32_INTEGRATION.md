# ESP32 → SOTMS Integration Contract

The exact thing your device firmware must do so its data shows up on the
dashboard. Most integration failures are a field name, a path, a missing auth
token, or an unmapped device — this document removes that guesswork.

There are **4 requirements**. Miss any one and the tanker won't appear.

---

## 1. Authenticate (get a token)

The RTDB rule requires each device to write **only its own node**, authenticated:
```
".write": "auth != null && auth.token.device == true && auth.uid == $deviceId"
```
So before writing, the ESP must obtain a Firebase ID token:

1. `POST` `{deviceId, secret}` → the `mintDeviceToken` function → returns a custom token.
2. Exchange it via `signInWithCustomToken` → returns `idToken` + `refreshToken`.
3. Use `?auth=<idToken>` on every write. Refresh before it expires (~1 h).

Full flow, URLs, and an Arduino sketch: **[DEVICE_AUTH.md](DEVICE_AUTH.md)**.
Get the `secret` from the dashboard: **Settings → Device Provisioning** (admin).

> Until the firmware implements this, writes are rejected and the tanker stays
> offline. This is the #1 thing that "breaks" on first hardware connect.

---

## 2. Write to the EXACT path

```
devices/<deviceId>/latest
```
- `<deviceId>` must equal the `uid` in the device's token (they're the same value).
- Use a PUT/set on `latest` each cycle (overwrite, don't push).

Example (REST):
```
PUT https://sotms-abdullah-new-2026-default-rtdb.asia-southeast1.firebasedatabase.app/devices/TANKER-001/latest.json?auth=<idToken>
```

---

## 3. Send the EXACT JSON shape

The app reads these fields (from `src/contexts/GPSContext.tsx` / `ESPLatestData`).
Send this shape. Extra fields are ignored; wrong **types** are rejected by the
RTDB `.validate` rules.

```json
{
  "timestamp": 1721840400,
  "distance_cm": 42.5,
  "rssi": -63,
  "uptime_ms": 1234567,
  "gps": {
    "latitude": 31.5204,
    "longitude": 74.3587,
    "satellites": 9,
    "status": "OK"
  }
}
```

Field rules (all must match or the write is rejected / mis-read):

| Field | Type | Notes |
|---|---|---|
| `timestamp` | number **or** string | epoch **seconds** or **milliseconds** — both accepted (auto-detected). Prefer the device's real UTC time. |
| `distance_cm` | number | ultrasonic distance to fuel surface, in **cm**. SMALL = full tank. The app converts cm→fuel% via calibration. |
| `rssi` | number | WiFi/signal strength (e.g. −63). |
| `uptime_ms` | number | device uptime. |
| `gps.latitude` | number | decimal degrees. Must be inside Pakistan bounds (lat 23–37.5) or the point is treated as "no fix". |
| `gps.longitude` | number | decimal degrees (60–78). |
| `gps.satellites` | number | 0 is fine (no lock). |
| `gps.status` | string | e.g. `"OK"`, `"NO_FIX"`. |

**Optional** (send if you have the sensors — the app understands them):
```json
{
  "ultrasonic": { "sensor_1": 42.5, "sensor_2": 40.1 },
  "hatches":    { "hatch_1": false, "hatch_2": false },
  "reed":       { "switch_1": true },
  "temperature_c": 34.2
}
```
- If you send `ultrasonic.sensor_1`, it's used as the fuel level (preferred over flat `distance_cm`).
- `hatches`/`reed` booleans drive the unauthorized-hatch-open alert. `true` = open.

Common mistakes that "break" it:
- Sending `distance_cm` as a **string** (`"42.5"`) → rejected. Send a number.
- Sending GPS as `0,0` on no-fix → treated as no fix (fine), but the tanker shows "GPS not connected".
- Writing to `devices/<id>` instead of `devices/<id>/latest`.

---

## 4. Map the device to a tanker

A device only becomes a named tanker if it's mapped. Set once (from the app or console) at:
```
config/deviceTankerMap/<deviceId> = {
  "tankerId":   "TNK-001",
  "tankerName": "Tanker 001",
  "driver":     "Ali Khan"
}
```
Without this, the device still works but shows as the raw `deviceId` with a
default name.

---

## Quick checklist before you power on a real tanker

- [ ] Device provisioned in **Settings → Device Provisioning**, secret flashed.
- [ ] Firmware does the token flow (mint → exchange → refresh).
- [ ] Firmware writes to `devices/<deviceId>/latest` with `?auth=<idToken>`.
- [ ] JSON matches section 3 (numbers are numbers).
- [ ] `config/deviceTankerMap/<deviceId>` is set.
- [ ] Cloud Functions deployed (so offline detection + alerts run server-side).

If all six are done, the tanker appears on the dashboard within ~1–2 seconds of
its first write. If it doesn't: check the Firebase console → Realtime Database to
see whether the write landed (rules/auth issue) or the data shape is off.
