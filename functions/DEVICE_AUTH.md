# SOTMS Device Authentication

Per-device auth so an ESP board can write **only its own** node under RTDB
`/devices/{deviceId}` and human accounts can never spoof device data.

RTDB rule now enforced:
```
".write": "auth != null && auth.token.device == true && auth.uid == $deviceId"
```

Two Cloud Functions provide it:

| Function | Type | Who calls it | Purpose |
|---|---|---|---|
| `provisionDevice` | callable (`onCall`) | admin dashboard | mint a per-device secret (returned once) |
| `mintDeviceToken` | HTTPS (`onRequest`) | the ESP device | exchange `{deviceId, secret}` for a Firebase custom token |

Secret **hashes** live in Firestore `deviceSecrets/{deviceId}` (client access denied
by rules; only the Admin SDK touches them). The plaintext secret is shown once at
provisioning and never stored.

---

## One-time setup after deploy

`createCustomToken` requires the functions' runtime service account to have the
**Service Account Token Creator** role. Grant it once:

```bash
# App-default SA (gen1-style) — usually the one gen2 uses too:
gcloud projects add-iam-policy-binding sotms-abdullah-new-2026 \
  --member="serviceAccount:sotms-abdullah-new-2026@appspot.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```
If token minting returns an IAM error, grant the same role to the gen2 compute SA
(`<PROJECT_NUMBER>-compute@developer.gserviceaccount.com`) as well.

---

## Step 1 — Provision a device (admin, once per device)

From the dashboard (admin user signed in):
```ts
import { getFunctions, httpsCallable } from 'firebase/functions';
const fns = getFunctions(app, 'asia-southeast1');
const res = await httpsCallable(fns, 'provisionDevice')({ deviceId: 'TANKER-001' });
// res.data = { deviceId, secret }  ← show `secret` ONCE, flash it to the ESP.
```
Re-provisioning the same `deviceId` rotates the secret (old one stops working).
To revoke without rotating, set `deviceSecrets/{deviceId}.revoked = true`.

---

## Step 2 — Device runtime flow (ESP)

Let `WEB_API_KEY` = the Firebase web API key (public), `DB_URL` =
`https://sotms-abdullah-new-2026-default-rtdb.asia-southeast1.firebasedatabase.app`,
and `MINT_URL` = the deployed `mintDeviceToken` URL (printed by `firebase deploy`).

**(a) Get a custom token** (do this on boot, and again if the secret changes):
```bash
curl -X POST "$MINT_URL" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"TANKER-001","secret":"<the flashed secret>"}'
# -> { "token": "<custom token>" }
```

**(b) Exchange it for an ID token + refresh token:**
```bash
curl -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=$WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"token":"<custom token>","returnSecureToken":true}'
# -> { "idToken": "...", "refreshToken": "...", "expiresIn": "3600" }
```

**(c) Write sensor data, authenticated:**
```bash
curl -X PUT \
  "$DB_URL/devices/TANKER-001/latest.json?auth=<idToken>" \
  -d '{"distance_cm":42,"rssi":-60,"uptime_ms":12345,"timestamp":1700000000,
       "gps":{"latitude":31.5,"longitude":74.3,"satellites":8,"status":"OK"}}'
```

**(d) Refresh before the ID token expires (~3600 s):**
```bash
curl -X POST "https://securetoken.googleapis.com/v1/token?key=$WEB_API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=<refreshToken>"
# -> { "id_token": "...", "refresh_token": "...", "expires_in": "3600" }
```
Cache the `refreshToken` and refresh every ~50 minutes; only re-run (a)+(b) if the
refresh token is rejected (e.g. secret rotated).

### ESP firmware sketch (pseudo-Arduino)
```
onBoot:
  customToken = POST MINT_URL {deviceId, secret}
  {idToken, refreshToken} = POST signInWithCustomToken {customToken}
  tokenExpiry = now + 3600s

everyLoop:
  if now > tokenExpiry - 300s:
     {idToken, refreshToken} = POST securetoken refresh {refreshToken}
     tokenExpiry = now + 3600s
  PUT DB_URL/devices/<id>/latest.json?auth=idToken  { ...sensor json... }
```
Use `WiFiClientSecure` + `HTTPClient` (ESP32) / `ESP8266HTTPClient`. Persist the
secret in NVS/EEPROM; never hard-code it in shared source.

---

## Notes
- The Firebase **web API key is public** by design — the secret + rules are the
  real controls, plus App Check for defense in depth.
- `mintDeviceToken` returns a generic `403` for unknown device / revoked / wrong
  secret (no oracle). Consider adding App Check or per-IP rate limiting before
  high-volume production.
- Existing dev seed scripts that wrote `/devices` with a human login will no
  longer be authorized — seed via the Admin SDK instead.
