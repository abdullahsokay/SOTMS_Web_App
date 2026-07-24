/**
 * SOTMS Unit Test Suite — GPS Calculations
 * ISO/IEC 29119-4 Test Cases | ISTQB Foundation Level
 *
 * Test Level: Unit Testing
 * Test Type: Functional (Black-box + White-box)
 * Techniques: Equivalence Partitioning, Boundary Value Analysis
 *
 * System Under Test: Haversine distance, bearing, deg2rad, getTime functions
 * Source: src/utils/geo.ts (extracted from src/contexts/GPSContext.tsx)
 */

// Import the REAL production functions so these tests exercise the actual code
// path used by GPSContext (no re-implementation / tautology).
import { deg2rad, getDistanceFromLatLonInKm, getBearing, getTime } from '../../utils/geo';

// ─── TC-UNIT-GPS-001: deg2rad conversion ───────────────────────────

describe('TC-UNIT-GPS-001: deg2rad conversion', () => {
  it('should convert 0 degrees to 0 radians', () => {
    expect(deg2rad(0)).toBe(0);
  });

  it('should convert 180 degrees to π radians', () => {
    expect(deg2rad(180)).toBeCloseTo(Math.PI, 10);
  });

  it('should convert 360 degrees to 2π radians', () => {
    expect(deg2rad(360)).toBeCloseTo(2 * Math.PI, 10);
  });

  it('should convert 90 degrees to π/2 radians', () => {
    expect(deg2rad(90)).toBeCloseTo(Math.PI / 2, 10);
  });

  it('should handle negative degrees', () => {
    expect(deg2rad(-90)).toBeCloseTo(-Math.PI / 2, 10);
  });

  it('should convert 45 degrees correctly', () => {
    expect(deg2rad(45)).toBeCloseTo(Math.PI / 4, 10);
  });

  // Boundary Value Analysis
  it('should handle very small positive value', () => {
    expect(deg2rad(0.001)).toBeCloseTo(0.001 * Math.PI / 180, 10);
  });

  it('should handle very large value (720 degrees)', () => {
    expect(deg2rad(720)).toBeCloseTo(4 * Math.PI, 10);
  });
});

// ─── TC-UNIT-GPS-002: Haversine distance calculation ───────────────

describe('TC-UNIT-GPS-002: Haversine Distance (getDistanceFromLatLonInKm)', () => {
  // Same point → 0 distance
  it('should return 0 for identical coordinates', () => {
    expect(getDistanceFromLatLonInKm(33.6844, 73.0479, 33.6844, 73.0479)).toBe(0);
  });

  // Known distance: Karachi (24.8607, 67.0011) → Lahore (31.5204, 74.3587)
  // Real-world distance ≈ 1,013 km (straight line)
  it('should calculate Karachi to Lahore distance within 5% accuracy', () => {
    const dist = getDistanceFromLatLonInKm(24.8607, 67.0011, 31.5204, 74.3587);
    expect(dist).toBeGreaterThan(960);
    expect(dist).toBeLessThan(1060);
  });

  // Islamabad (33.6844, 73.0479) → Peshawar (34.0151, 71.5249)
  // Straight-line (great circle) distance ≈ 145 km
  it('should calculate Islamabad to Peshawar straight-line distance correctly', () => {
    const dist = getDistanceFromLatLonInKm(33.6844, 73.0479, 34.0151, 71.5249);
    expect(dist).toBeGreaterThan(138);
    expect(dist).toBeLessThan(153);
  });

  // Commutative property: dist(A,B) === dist(B,A)
  it('should be commutative (dist(A,B) === dist(B,A))', () => {
    const d1 = getDistanceFromLatLonInKm(24.8607, 67.0011, 31.5204, 74.3587);
    const d2 = getDistanceFromLatLonInKm(31.5204, 74.3587, 24.8607, 67.0011);
    expect(d1).toBeCloseTo(d2, 6);
  });

  // Equator distance: 1 degree of longitude ≈ 111.32 km at equator
  it('should approximate 111 km for 1 degree of longitude at equator', () => {
    const dist = getDistanceFromLatLonInKm(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(112);
  });

  // Null-island (0,0) to (0,0)
  it('should return 0 for null-island to null-island', () => {
    expect(getDistanceFromLatLonInKm(0, 0, 0, 0)).toBe(0);
  });

  // Edge case: Very close points (< 1 meter apart)
  it('should handle very close points correctly', () => {
    const dist = getDistanceFromLatLonInKm(33.6844, 73.0479, 33.6845, 73.0479);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(0.02); // less than 20 meters
  });

  // Edge case: Antipodal points (half the Earth ≈ 20,015 km)
  it('should handle near-antipodal points', () => {
    const dist = getDistanceFromLatLonInKm(0, 0, 0, 180);
    expect(dist).toBeGreaterThan(20000);
    expect(dist).toBeLessThan(20100);
  });

  // Negative coordinates
  it('should handle negative latitudes (Southern Hemisphere)', () => {
    const dist = getDistanceFromLatLonInKm(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(800);
  });

  // Cross-hemisphere
  it('should handle cross-hemisphere calculations', () => {
    const dist = getDistanceFromLatLonInKm(51.5074, -0.1278, -33.8688, 151.2093);
    expect(dist).toBeGreaterThan(16000);
    expect(dist).toBeLessThan(18000);
  });
});

// ─── TC-UNIT-GPS-003: Bearing calculation ──────────────────────────

describe('TC-UNIT-GPS-003: Bearing Calculation (getBearing)', () => {
  // Due North (same longitude, higher latitude) → ~0°
  it('should return ~0° for due north direction', () => {
    const bearing = getBearing(30, 70, 35, 70);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(5);
  });

  // Due East (same latitude, higher longitude) → ~90°
  it('should return ~90° for due east direction', () => {
    const bearing = getBearing(30, 70, 30, 75);
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  // Due South → ~180°
  it('should return ~180° for due south direction', () => {
    const bearing = getBearing(35, 70, 30, 70);
    expect(bearing).toBeGreaterThan(175);
    expect(bearing).toBeLessThan(185);
  });

  // Due West → ~270°
  it('should return ~270° for due west direction', () => {
    const bearing = getBearing(30, 75, 30, 70);
    expect(bearing).toBeGreaterThan(265);
    expect(bearing).toBeLessThan(275);
  });

  // Bearing should always be 0-360 (normalized)
  it('should always return bearing in range [0, 360)', () => {
    const testCases = [
      [0, 0, 45, 90],
      [45, 90, 0, 0],
      [-33, 151, 51, -0.1],
      [33.6844, 73.0479, 24.8607, 67.0011],
    ];

    for (const [lat1, lon1, lat2, lon2] of testCases) {
      const b = getBearing(lat1, lon1, lat2, lon2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });

  // Northeast direction → ~45°
  it('should return ~45° for northeast direction', () => {
    const bearing = getBearing(30, 70, 35, 75);
    expect(bearing).toBeGreaterThan(30);
    expect(bearing).toBeLessThan(60);
  });

  // Same point → result should still be a valid number
  it('should return 0 or valid number for same point', () => {
    const bearing = getBearing(33.6844, 73.0479, 33.6844, 73.0479);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThanOrEqual(360);
  });
});

// ─── TC-UNIT-GPS-004: Speed calculation logic ──────────────────────

describe('TC-UNIT-GPS-004: Speed Calculation Logic', () => {
  // Speed = distance / time
  it('should calculate speed correctly from two GPS points', () => {
    // Karachi to a point ~10km away, 10 minutes apart → ~60 km/h
    const dist = getDistanceFromLatLonInKm(24.8607, 67.0011, 24.9507, 67.0011);
    const timeDiffHours = 10 / 60; // 10 minutes in hours
    const speed = dist / timeDiffHours;
    expect(speed).toBeGreaterThan(50);
    expect(speed).toBeLessThan(70);
  });

  // Stationary (same point) → 0 speed
  it('should return 0 speed for stationary position', () => {
    const dist = getDistanceFromLatLonInKm(24.8607, 67.0011, 24.8607, 67.0011);
    expect(dist).toBe(0);
    // speed = 0 / timeDiff = 0
  });

  // Speed cap check: > 150 km/h should be flagged (as per GPSContext logic line 186)
  it('should detect unrealistic speeds (>150 km/h)', () => {
    const dist = getDistanceFromLatLonInKm(24.8607, 67.0011, 31.5204, 74.3587);
    // ~1013 km in 1 second → absurd speed
    const timeDiffHours = 1 / 3600;
    const speed = dist / timeDiffHours;
    const isUnrealistic = speed > 150;
    expect(isUnrealistic).toBe(true);
  });
});

// ─── TC-UNIT-GPS-005: Bearing threshold for movement ───────────────

describe('TC-UNIT-GPS-005: Bearing Movement Threshold', () => {
  // Only update bearing if moved > 5 meters (0.005 km) — GPSContext line 189
  it('should not update bearing for movement < 5 meters', () => {
    // 0.00001 degrees ≈ 1 meter
    const dist = getDistanceFromLatLonInKm(33.6844, 73.0479, 33.68441, 73.0479);
    const shouldUpdateBearing = dist > 0.005;
    expect(shouldUpdateBearing).toBe(false);
  });

  it('should update bearing for movement > 5 meters', () => {
    // 0.001 degrees ≈ 100 meters
    const dist = getDistanceFromLatLonInKm(33.6844, 73.0479, 33.6854, 73.0479);
    const shouldUpdateBearing = dist > 0.005;
    expect(shouldUpdateBearing).toBe(true);
  });
});

// ─── TC-UNIT-GPS-006: Timestamp parsing (getTime) ──────────────────
// Exercises the REAL getTime from src/utils/geo.ts, including the
// epoch-seconds vs epoch-ms heuristic: values in (0, 1e11) are treated
// as seconds and scaled to milliseconds; values >= 1e11 are already ms.

describe('TC-UNIT-GPS-006: Timestamp Parsing (getTime)', () => {
  it('should return 0 for falsy values', () => {
    expect(getTime(0)).toBe(0);
    expect(getTime(null)).toBe(0);
    expect(getTime(undefined)).toBe(0);
    expect(getTime('')).toBe(0);
  });

  it('should scale epoch-seconds (< 1e11) to milliseconds', () => {
    // 1700000000 s → 1700000000000 ms
    expect(getTime(1700000000)).toBe(1700000000000);
  });

  it('should leave epoch-milliseconds (>= 1e11) unchanged', () => {
    // 1700000000000 ms is already ms → returned as-is
    expect(getTime(1700000000000)).toBe(1700000000000);
  });

  it('should treat the 1e11 boundary as milliseconds (not seconds)', () => {
    // val < 1e11 is scaled; exactly 1e11 is NOT (< is strict)
    expect(getTime(1e11)).toBe(1e11);
    expect(getTime(1e11 - 1)).toBe((1e11 - 1) * 1000);
  });

  it('should parse ISO date strings to epoch-ms', () => {
    const iso = '2023-11-14T22:13:20.000Z';
    expect(getTime(iso)).toBe(Date.parse(iso));
  });

  it('should return 0 for unparseable strings', () => {
    expect(getTime('not-a-date')).toBe(0);
  });

  it('should handle Firebase Timestamp-like objects via toDate()', () => {
    const d = new Date('2023-11-14T22:13:20.000Z');
    const fakeTimestamp = { toDate: () => d };
    expect(getTime(fakeTimestamp)).toBe(d.getTime());
  });
});
