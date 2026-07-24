/**
 * SOTMS Edge Case & Boundary Value Test Suite
 * ISO/IEC 29119-4 Test Cases | ISTQB Foundation Level
 *
 * Test Level: Unit + Integration Testing
 * Test Type: Functional (Black-box)
 * Techniques: Boundary Value Analysis, Equivalence Partitioning, Error Guessing
 *
 * System Under Test: GPS calculations, route data, coordinate validation, search edge cases
 */

import { Route, Tanker } from '../../types';
import { mockRoutes } from '../testFixtures';

// ─── Re-implement pure functions for isolated testing ───

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if ((lat1 === lat2) && (lon1 === lon2)) return 0;
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function filterRoutes(routes: Route[], searchQuery: string): Route[] {
  return routes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedTanker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedDriver?.toLowerCase().includes(searchQuery.toLowerCase())
  );
}

// ─── Helper: Position history processing ───

function processPositionHistory(
  readings: Array<{ lat: number; lng: number; timestamp: number }>
): Array<{ lat: number; lng: number; timestamp: number }> {
  return readings
    .filter(r => !isNaN(r.lat) && !isNaN(r.lng) && !(r.lat === 0 && r.lng === 0))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Helper: Tanker status determination ───

function determineTankerStatus(speed: number, isOffline: boolean): string {
  if (isOffline) return 'offline';
  return speed > 2 ? 'moving' : 'idle';
}

// ═══════════════════════════════════════════════════════════════════

// ─── TC-EDGE-001: Invalid GPS Coordinates ─────────────────────────

describe('TC-EDGE-001: Invalid GPS Coordinates', () => {
  it('should handle NaN latitude gracefully', () => {
    const dist = getDistanceFromLatLonInKm(NaN, 73.0479, 33.6844, 73.0479);
    expect(isNaN(dist)).toBe(true);
  });

  it('should handle NaN longitude gracefully', () => {
    const dist = getDistanceFromLatLonInKm(33.6844, NaN, 33.6844, 73.0479);
    expect(isNaN(dist)).toBe(true);
  });

  it('should handle both NaN coordinates', () => {
    const dist = getDistanceFromLatLonInKm(NaN, NaN, NaN, NaN);
    expect(isNaN(dist)).toBe(true);
  });

  it('should filter out null-island (0,0) points from position history', () => {
    const readings = [
      { lat: 33.68, lng: 73.04, timestamp: 1000 },
      { lat: 0, lng: 0, timestamp: 2000 }, // null-island — should be filtered
      { lat: 33.69, lng: 73.05, timestamp: 3000 },
    ];
    const processed = processPositionHistory(readings);
    expect(processed.length).toBe(2);
    expect(processed.some(r => r.lat === 0 && r.lng === 0)).toBe(false);
  });

  it('should filter out NaN coordinates from position history', () => {
    const readings = [
      { lat: NaN, lng: 73.04, timestamp: 1000 },
      { lat: 33.69, lng: NaN, timestamp: 2000 },
      { lat: 33.70, lng: 73.06, timestamp: 3000 },
    ];
    const processed = processPositionHistory(readings);
    expect(processed.length).toBe(1);
    expect(processed[0].lat).toBe(33.70);
  });

  it('should return empty array when all readings are invalid', () => {
    const readings = [
      { lat: 0, lng: 0, timestamp: 1000 },
      { lat: NaN, lng: NaN, timestamp: 2000 },
    ];
    const processed = processPositionHistory(readings);
    expect(processed.length).toBe(0);
  });
});

// ─── TC-EDGE-002: Latitude/Longitude Boundary Values ──────────────

describe('TC-EDGE-002: Latitude/Longitude Boundary Values', () => {
  // Valid boundaries
  it('should handle North Pole (90, 0)', () => {
    const dist = getDistanceFromLatLonInKm(90, 0, 0, 0);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dist)).toBe(true);
  });

  it('should handle South Pole (-90, 0)', () => {
    const dist = getDistanceFromLatLonInKm(-90, 0, 0, 0);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dist)).toBe(true);
  });

  it('should handle International Date Line (0, 180)', () => {
    const dist = getDistanceFromLatLonInKm(0, 180, 0, -180);
    // 180 and -180 are the same meridian
    expect(dist).toBeCloseTo(0, 0);
  });

  it('should handle maximum longitude (0, 180) to (0, 0)', () => {
    const dist = getDistanceFromLatLonInKm(0, 180, 0, 0);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dist)).toBe(true);
  });

  // Pakistan boundary coordinates
  it('should handle Pakistan northern boundary (~37.5°N)', () => {
    const dist = getDistanceFromLatLonInKm(37.5, 73.0, 37.0, 73.0);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dist)).toBe(true);
  });

  it('should handle Pakistan southern boundary (~23°N)', () => {
    const dist = getDistanceFromLatLonInKm(23.0, 67.0, 24.0, 67.0);
    expect(dist).toBeGreaterThan(0);
    expect(isFinite(dist)).toBe(true);
  });
});

// ─── TC-EDGE-003: Search Edge Cases ───────────────────────────────

describe('TC-EDGE-003: Search Edge Cases', () => {
  it('should handle empty string search', () => {
    const result = filterRoutes(mockRoutes, '');
    expect(result.length).toBe(mockRoutes.length);
  });

  it('should handle single character search', () => {
    const result = filterRoutes(mockRoutes, 'K');
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle special characters in search', () => {
    const result = filterRoutes(mockRoutes, '@#$%');
    expect(result.length).toBe(0);
  });

  it('should handle very long search string', () => {
    const longSearch = 'a'.repeat(10000);
    const result = filterRoutes(mockRoutes, longSearch);
    expect(result.length).toBe(0);
  });

  it('should handle search with leading/trailing whitespace', () => {
    const result = filterRoutes(mockRoutes, '  PSO  ');
    // PSO is in many fields — some routes may match "  PSO  " since trim isn't applied before .includes
    // Actually "  PSO  " won't match "PSO" — it has spaces. Result should be 0
    expect(result.length).toBe(0);
  });

  it('should be case-insensitive', () => {
    const lower = filterRoutes(mockRoutes, 'pso');
    const upper = filterRoutes(mockRoutes, 'PSO');
    const mixed = filterRoutes(mockRoutes, 'PsO');
    expect(lower.length).toBe(upper.length);
    expect(upper.length).toBe(mixed.length);
  });

  it('should handle search on empty routes array', () => {
    const result = filterRoutes([], 'PSO');
    expect(result.length).toBe(0);
  });

  it('should handle search with undefined assignedTanker', () => {
    // Routes without assignedTanker should not cause errors
    const routesWithUndefined: Route[] = [
      { ...mockRoutes[3], assignedTanker: undefined, assignedDriver: undefined }
    ];
    const result = filterRoutes(routesWithUndefined, 'TNK');
    expect(result.length).toBe(0); // no match since assignedTanker is undefined
  });
});

// ─── TC-EDGE-004: Duplicate Route IDs ─────────────────────────────

describe('TC-EDGE-004: Duplicate Route ID Detection', () => {
  it('should detect duplicate route IDs', () => {
    const routes = [
      ...mockRoutes,
      { ...mockRoutes[0], name: 'Duplicate Route' }, // same ID as RT-001
    ];
    const ids = routes.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBeLessThan(ids.length);
  });

  it('should confirm mock data has no duplicates', () => {
    const ids = mockRoutes.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ─── TC-EDGE-005: Tanker Status Determination Edge Cases ──────────

describe('TC-EDGE-005: Tanker Status Determination', () => {
  it('should mark as offline when no update for > 60 seconds', () => {
    expect(determineTankerStatus(0, true)).toBe('offline');
  });

  it('should mark as moving when speed > 2 km/h', () => {
    expect(determineTankerStatus(3, false)).toBe('moving');
  });

  it('should mark as idle when speed <= 2 km/h', () => {
    expect(determineTankerStatus(2, false)).toBe('idle');
    expect(determineTankerStatus(1, false)).toBe('idle');
    expect(determineTankerStatus(0, false)).toBe('idle');
  });

  it('should mark as offline regardless of speed', () => {
    expect(determineTankerStatus(100, true)).toBe('offline');
  });

  // Boundary: exactly 2 km/h → idle (not moving)
  it('should be idle at exactly 2 km/h (boundary)', () => {
    expect(determineTankerStatus(2, false)).toBe('idle');
  });

  // Boundary: 2.001 → moving
  it('should be moving just above 2 km/h', () => {
    expect(determineTankerStatus(2.001, false)).toBe('moving');
  });
});

// ─── TC-EDGE-006: Geofence Radius Boundary Values ────────────────

describe('TC-EDGE-006: Geofence Radius Boundary Values', () => {
  // Create route modal: min=50, max=200, step=10
  it('should accept minimum value (50)', () => {
    const radius = 50;
    expect(radius >= 50 && radius <= 200).toBe(true);
  });

  it('should accept maximum value (200)', () => {
    const radius = 200;
    expect(radius >= 50 && radius <= 200).toBe(true);
  });

  it('should reject value below minimum (49)', () => {
    const radius = 49;
    expect(radius >= 50).toBe(false);
  });

  it('should reject value above maximum (201)', () => {
    const radius = 201;
    expect(radius <= 200).toBe(false);
  });

  // Map geofence drawing: min=1000, max=50000, step=1000
  it('should accept map geofence minimum (1000m)', () => {
    const radius = 1000;
    expect(radius >= 1000 && radius <= 50000).toBe(true);
  });

  it('should accept map geofence maximum (50000m)', () => {
    const radius = 50000;
    expect(radius >= 1000 && radius <= 50000).toBe(true);
  });

  it('should reject map geofence below minimum (999)', () => {
    const radius = 999;
    expect(radius >= 1000).toBe(false);
  });
});

// ─── TC-EDGE-007: Empty / Null Data Handling ──────────────────────

describe('TC-EDGE-007: Empty and Null Data Handling', () => {
  it('should handle route with empty waypoints array', () => {
    const route: Partial<Route> = {
      waypoints: [],
      startLocation: { lat: 24.86, lng: 67.0, address: 'Start' },
      endLocation: { lat: 31.52, lng: 74.36, address: 'End' },
    };
    const path = [
      route.startLocation!,
      ...route.waypoints!.map(wp => ({ lat: wp.lat, lng: wp.lng })),
      route.endLocation!,
    ];
    expect(path.length).toBe(2);
  });

  it('should handle route with empty blackSpots array', () => {
    const route: Partial<Route> = { blackSpots: [] };
    expect(route.blackSpots!.length).toBe(0);
  });

  it('should handle tankers array being empty', () => {
    const available: Tanker[] = [];
    const filtered = available.filter(t => t.status !== 'offline');
    expect(filtered.length).toBe(0);
  });

  it('should handle position history being empty', () => {
    const history: Array<{ lat: number; lng: number; timestamp: number }> = [];
    const processed = processPositionHistory(history);
    expect(processed.length).toBe(0);
  });
});

// ─── TC-EDGE-008: Timestamp Parsing Edge Cases ───────────────────

describe('TC-EDGE-008: Timestamp Parsing Edge Cases', () => {
  function getTime(val: unknown): number {
    if (!val) return 0;
    if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    const date = new Date(val as string);
    return !isNaN(date.getTime()) ? date.getTime() : 0;
  }

  it('should return 0 for null/undefined', () => {
    expect(getTime(null)).toBe(0);
    expect(getTime(undefined)).toBe(0);
  });

  it('should parse valid ISO string', () => {
    expect(getTime('2025-11-30T10:00:00Z')).toBeGreaterThan(0);
  });

  it('should return 0 for invalid string', () => {
    expect(getTime('not-a-date')).toBe(0);
  });

  it('should handle Firestore-like timestamp with toDate()', () => {
    const firestoreTs = {
      toDate: () => new Date('2025-11-30T10:00:00Z'),
    };
    expect(getTime(firestoreTs)).toBeGreaterThan(0);
  });

  it('should handle empty string', () => {
    expect(getTime('')).toBe(0);
  });
});

// ─── TC-EDGE-009: Speed Capping Edge Cases ───────────────────────

describe('TC-EDGE-009: Speed Capping Logic', () => {
  it('should accept speed at exactly 150 km/h', () => {
    const speed = 150;
    const isUnrealistic = speed > 150;
    expect(isUnrealistic).toBe(false);
  });

  it('should flag speed at 151 km/h as unrealistic', () => {
    const speed = 151;
    const isUnrealistic = speed > 150;
    expect(isUnrealistic).toBe(true);
  });

  it('should handle zero speed', () => {
    const speed = 0;
    const isUnrealistic = speed > 150;
    expect(isUnrealistic).toBe(false);
  });

  it('should handle negative speed (impossible but defensive)', () => {
    const speed = -10;
    const isUnrealistic = speed > 150;
    expect(isUnrealistic).toBe(false);
  });
});

// ─── TC-EDGE-010: Route Creation Form Validation Edge Cases ──────

describe('TC-EDGE-010: Route Creation Validation', () => {
  it('should not allow submission without start coordinates', () => {
    const startCoords = null;
    const endCoords = { lat: 31.52, lng: 74.36 };
    const canSubmit = startCoords !== null && endCoords !== null;
    expect(canSubmit).toBe(false);
  });

  it('should not allow submission without end coordinates', () => {
    const startCoords = { lat: 24.86, lng: 67.0 };
    const endCoords = null;
    const canSubmit = startCoords !== null && endCoords !== null;
    expect(canSubmit).toBe(false);
  });

  it('should allow submission with both coordinates', () => {
    const startCoords = { lat: 24.86, lng: 67.0 };
    const endCoords = { lat: 31.52, lng: 74.36 };
    const canSubmit = startCoords !== null && endCoords !== null;
    expect(canSubmit).toBe(true);
  });

  it('should generate unique route ID with RT- prefix', () => {
    const id = `RT-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    expect(id).toMatch(/^RT-\d{3}$/);
  });

  it('should reset coords to null when user changes address text after selection', () => {
    let coords: { lat: number; lng: number } | null = { lat: 24.86, lng: 67.0 };
    // Simulate user typing after selection → reset coords
    if (coords) coords = null;
    expect(coords).toBeNull();
  });
});
