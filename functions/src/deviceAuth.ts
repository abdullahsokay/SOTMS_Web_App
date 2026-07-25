/**
 * functions/src/deviceAuth.ts
 *
 * Per-device authentication for ESP boards writing to RTDB.
 *
 * Flow:
 *   1. provisionDevice (admin-only, callable) generates a random secret for a
 *      deviceId, stores ONLY its SHA-256 hash at Firestore deviceSecrets/{id},
 *      and returns the plaintext secret ONCE (flash it to the device).
 *   2. mintDeviceToken (device-facing, HTTPS) verifies (deviceId, secret)
 *      against the stored hash and returns a Firebase CUSTOM TOKEN with
 *      uid == deviceId and custom claim { device: true }.
 *   3. The ESP exchanges that custom token for an ID token via the Firebase
 *      Auth REST API (signInWithCustomToken), then writes to RTDB with
 *      ?auth=<idToken>. See functions/DEVICE_AUTH.md for the device-side steps.
 *
 * RTDB rules then require:  auth != null && auth.token.device == true
 *                          && auth.uid == $deviceId
 * so a device can only write its OWN node, and human accounts cannot spoof
 * device data.
 */

import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const REGION = 'asia-southeast1';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex strings of equal length. */
function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{3,64}$/;

// ─────────────────────────────────────────────────────────────────────────
//  provisionDevice — ADMIN ONLY (callable from the dashboard)
//  Returns the plaintext secret exactly once. Store the hash only.
// ─────────────────────────────────────────────────────────────────────────
export const provisionDevice = onCall({ region: REGION }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  // Authorize: caller must be an admin (Firestore users/{uid}.role == 'admin').
  const userSnap = await admin.firestore().doc(`users/${uid}`).get();
  if (!userSnap.exists || userSnap.get('role') !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  // Multi-tenant: the device is owned by the admin's company. Every record the
  // device later generates (live status, sensorReadings, alerts) is stamped
  // with this companyId so it is scoped/shareable under firestore.rules.
  const companyId = userSnap.get('companyId');
  if (typeof companyId !== 'string' || companyId.trim() === '') {
    throw new HttpsError('failed-precondition', 'Your account has no company');
  }

  const deviceId = String(req.data?.deviceId ?? '').trim();
  if (!DEVICE_ID_RE.test(deviceId)) {
    throw new HttpsError(
      'invalid-argument',
      'deviceId must be 3–64 chars of [A-Za-z0-9_-].',
    );
  }

  // 48 hex chars of CSPRNG entropy.
  const secret = randomBytes(24).toString('hex');

  await admin.firestore().doc(`deviceSecrets/${deviceId}`).set({
    secretHash: hashSecret(secret),
    companyId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
    revoked: false,
  });

  // Mirror the mapping into RTDB so the RTDB-triggered onDeviceData handler can
  // resolve the owning company with a single fast read (no Firestore round-trip).
  await admin.database().ref(`config/deviceCompany/${deviceId}`).set(companyId);

  logger.info(
    `device provisioned: ${deviceId} by admin ${uid} for company ${companyId}`,
  );

  // Plaintext secret is returned ONCE — it is never stored and cannot be
  // recovered. Flash it to the device now; re-provision to rotate.
  return { deviceId, secret };
});

// ─────────────────────────────────────────────────────────────────────────
//  mintDeviceToken — DEVICE FACING (HTTPS)
//  POST { deviceId, secret } -> { token }  (Firebase custom token)
// ─────────────────────────────────────────────────────────────────────────
export const mintDeviceToken = onRequest(
  { region: REGION, cors: false },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const body = (req.body ?? {}) as { deviceId?: unknown; secret?: unknown };
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
    const secret = typeof body.secret === 'string' ? body.secret : '';

    if (!DEVICE_ID_RE.test(deviceId) || secret.length === 0) {
      res.status(400).json({ error: 'bad_request' });
      return;
    }

    try {
      const snap = await admin
        .firestore()
        .doc(`deviceSecrets/${deviceId}`)
        .get();

      // Generic 403 for all failure modes — do not leak whether the device
      // exists, is revoked, or the secret was simply wrong.
      if (!snap.exists || snap.get('revoked') === true) {
        res.status(403).json({ error: 'unauthorized' });
        return;
      }

      const storedHash = String(snap.get('secretHash') ?? '');
      const providedHash = hashSecret(secret);
      if (!safeEqualHex(storedHash, providedHash)) {
        res.status(403).json({ error: 'unauthorized' });
        return;
      }

      const token = await admin
        .auth()
        .createCustomToken(deviceId, { device: true });

      // Best-effort last-provisioned-use marker (non-fatal if it fails).
      await snap.ref
        .update({ lastTokenAt: admin.firestore.FieldValue.serverTimestamp() })
        .catch(() => undefined);

      res.status(200).json({ token });
    } catch (err) {
      logger.error(`mintDeviceToken failed for ${deviceId}`, err);
      res.status(500).json({ error: 'internal' });
    }
  },
);
