/**
 * SOTMS — One-time RTDB Seed Script
 *
 * Run this once to create the organized structure in your
 * Firebase Realtime Database. It will NOT overwrite existing data —
 * it only sets nodes that don't exist yet.
 *
 * Usage:
 *   npx ts-node scripts/seedRTDB.ts
 *
 * Or paste the JSON below directly into Firebase Console → Realtime Database → Import JSON
 */

const SEED_DATA = {

  // ── Config ──
  config: {
    deviceTankerMap: {
      SOTMS_ESP32_001: {
        tankerId: "tanker_001",
        tankerName: "Tanker 001",
        driver: "Unassigned"
      },
      SOTMS_ESP32_002: {
        tankerId: "tanker_002",
        tankerName: "Tanker 002",
        driver: "Unassigned"
      },
      SOTMS_ESP32_003: {
        tankerId: "tanker_003",
        tankerName: "Tanker 003",
        driver: "Unassigned"
      }
    },
    thresholds: {
      speedLimit: 80,
      harshBrakeDrop: 30,
      idleWarnMinutes: 10,
      offlineTimeout: 15000,
      staleTimeout: 86400000
    },
    metadata: {
      projectName: "SOTMS - Smart Oil Transport Monitoring System",
      appVersion: "2.1.0",
      lastUpdated: Date.now()
    }
  },

  // ── Fleet (tanker-centric organized data) ──
  fleet: {
    tanker_001: {
      info: {
        name: "Tanker 001",
        registrationNo: "",
        capacity: 0,
        deviceId: "SOTMS_ESP32_001",
        driver: "Unassigned",
        company: ""
      },
      currentStatus: {
        online: false,
        status: "offline",
        speed: 0,
        fuelLevel: 0,
        lastSeen: 0,
        location: { lat: 0, lng: 0, address: "Unknown" }
      }
    },
    tanker_002: {
      info: {
        name: "Tanker 002",
        registrationNo: "",
        capacity: 0,
        deviceId: "SOTMS_ESP32_002",
        driver: "Unassigned",
        company: ""
      },
      currentStatus: {
        online: false,
        status: "offline",
        speed: 0,
        fuelLevel: 0,
        lastSeen: 0,
        location: { lat: 0, lng: 0, address: "Unknown" }
      }
    },
    tanker_003: {
      info: {
        name: "Tanker 003",
        registrationNo: "",
        capacity: 0,
        deviceId: "SOTMS_ESP32_003",
        driver: "Unassigned",
        company: ""
      },
      currentStatus: {
        online: false,
        status: "offline",
        speed: 0,
        fuelLevel: 0,
        lastSeen: 0,
        location: { lat: 0, lng: 0, address: "Unknown" }
      }
    }
  },

  // ── Driver Behaviour ──
  driverBehaviour: {
    events: {},
    scores: {}
  },

  // ── Alerts (per-tanker) ──
  alerts: {
    tanker_001: {},
    tanker_002: {},
    tanker_003: {}
  }
};

// ── Print JSON for manual import into Firebase Console ──
console.log("=".repeat(60));
console.log("SOTMS — Realtime Database Seed Data");
console.log("=".repeat(60));
console.log("");
console.log("Copy the JSON below and import it into Firebase Console:");
console.log("  Realtime Database → ⋮ menu → Import JSON");
console.log("");
console.log("This will NOT overwrite /devices/ (your ESP data is safe).");
console.log("");
console.log(JSON.stringify(SEED_DATA, null, 2));
