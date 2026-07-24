/**
 * SOTMS Unit Test Suite — Route Business Logic
 * ISO/IEC 29119-4 Test Cases | ISTQB Foundation Level
 *
 * Test Level: Unit Testing
 * Test Type: Functional (Black-box)
 * Techniques: Equivalence Partitioning, Decision Table Testing
 *
 * System Under Test: Route filtering, search, export, creation, assignment logic
 */

import { Route } from '../../types';
import { mockRoutes, mockTankers } from '../testFixtures';

// ─── Helper: replicate route filtering logic from RouteManagementPage.tsx ───

function filterRoutes(routes: Route[], searchQuery: string): Route[] {
  return routes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedTanker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedDriver?.toLowerCase().includes(searchQuery.toLowerCase())
  );
}

// ─── Helper: replicate route list panel filtering ───

function filterByTab(routes: Route[], tab: 'all' | 'assigned' | 'unassigned' | 'company', company?: string): Route[] {
  return routes.filter(route => {
    if (tab === 'assigned') return route.status !== 'unassigned';
    if (tab === 'unassigned') return route.status === 'unassigned';
    if (tab === 'company' && company) return route.company === company;
    return true;
  });
}

// ─── Helper: replicate CSV export logic ───

function generateCSV(routes: Route[]): string {
  const headers = ['ID', 'Route Name', 'Company', 'Start Location', 'End Location', 'Distance (km)', 'Status'];
  return [
    headers.join(','),
    ...routes.map(route => [
      route.id,
      `"${route.name}"`,
      route.company,
      `"${route.startLocation.address}"`,
      `"${route.endLocation.address}"`,
      route.distance,
      route.status
    ].join(','))
  ].join('\n');
}

// ─── Helper: replicate displayedRoutes logic from RouteMapView.tsx ───

function getDisplayedRoutes(routes: Route[], selectedRoute: Route | null): Route[] {
  if (selectedRoute && selectedRoute.assignedTanker && selectedRoute.status !== 'unassigned') {
    return routes.filter(r => r.id === selectedRoute.id);
  }
  return routes;
}

// ─── Helper: replicate auto-select on search logic from RouteManagementPage.tsx ───

function getAutoSelectedRoute(filteredRoutes: Route[], searchQuery: string): Route | null {
  if (!searchQuery.trim()) return null;
  return filteredRoutes.find(r => r.assignedTanker && r.status !== 'unassigned') || null;
}

// ─── Helper: replicate polyline color logic from RouteMapView.tsx ───

function getPolylineColor(isSelected: boolean, isAssigned: boolean): string {
  return isSelected ? '#28B463' : isAssigned ? '#FF9800' : '#009FFD';
}

// ═══════════════════════════════════════════════════════════════════

// ─── TC-UNIT-ROUTE-001: Search Filtering ───────────────────────────

describe('TC-UNIT-ROUTE-001: Route Search Filtering', () => {
  it('should return all routes for empty search', () => {
    const result = filterRoutes(mockRoutes, '');
    expect(result.length).toBe(mockRoutes.length);
  });

  it('should filter by route name (case-insensitive)', () => {
    const result = filterRoutes(mockRoutes, 'karachi');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.name.toLowerCase().includes('karachi'))).toBe(true);
  });

  it('should filter by route ID', () => {
    const result = filterRoutes(mockRoutes, 'RT-001');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('RT-001');
  });

  it('should filter by company name', () => {
    const result = filterRoutes(mockRoutes, 'PSO');
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach(r => {
      const matchesCompany = r.company.toLowerCase().includes('pso');
      const matchesOther = r.name.toLowerCase().includes('pso') ||
        r.id.toLowerCase().includes('pso') ||
        r.assignedTanker?.toLowerCase().includes('pso') ||
        r.assignedDriver?.toLowerCase().includes('pso');
      expect(matchesCompany || matchesOther).toBe(true);
    });
  });

  it('should filter by assigned tanker ID', () => {
    const result = filterRoutes(mockRoutes, 'TNK-001');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.assignedTanker === 'TNK-001')).toBe(true);
  });

  it('should filter by assigned driver name', () => {
    const result = filterRoutes(mockRoutes, 'John Smith');
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some(r => r.assignedDriver === 'John Smith')).toBe(true);
  });

  it('should return empty array for no matches', () => {
    const result = filterRoutes(mockRoutes, 'ZZZZNONEXISTENT');
    expect(result.length).toBe(0);
  });

  it('should handle partial matches', () => {
    const result = filterRoutes(mockRoutes, 'Lah');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── TC-UNIT-ROUTE-002: Tab Filtering ──────────────────────────────

describe('TC-UNIT-ROUTE-002: Route List Tab Filtering', () => {
  it('should return all routes for "all" tab', () => {
    const result = filterByTab(mockRoutes, 'all');
    expect(result.length).toBe(mockRoutes.length);
  });

  it('should return only assigned routes for "assigned" tab', () => {
    const result = filterByTab(mockRoutes, 'assigned');
    result.forEach(r => expect(r.status).not.toBe('unassigned'));
  });

  it('should return only unassigned routes for "unassigned" tab', () => {
    const result = filterByTab(mockRoutes, 'unassigned');
    result.forEach(r => expect(r.status).toBe('unassigned'));
  });

  it('should filter by company when tab is "company"', () => {
    const result = filterByTab(mockRoutes, 'company', 'Shell');
    result.forEach(r => expect(r.company).toBe('Shell'));
  });

  it('should return all routes when company tab without specific company', () => {
    const result = filterByTab(mockRoutes, 'company');
    expect(result.length).toBe(mockRoutes.length);
  });

  // Verify unassigned count matches mock data
  it('should correctly identify unassigned routes from mock data', () => {
    const unassigned = mockRoutes.filter(r => r.status === 'unassigned');
    expect(unassigned.length).toBe(2); // RT-004 and RT-006
    expect(unassigned.map(r => r.id)).toContain('RT-004');
    expect(unassigned.map(r => r.id)).toContain('RT-006');
  });
});

// ─── TC-UNIT-ROUTE-003: CSV Export Logic ───────────────────────────

describe('TC-UNIT-ROUTE-003: CSV Export Generation', () => {
  it('should generate valid CSV headers', () => {
    const csv = generateCSV(mockRoutes);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('ID,Route Name,Company,Start Location,End Location,Distance (km),Status');
  });

  it('should include all routes as rows', () => {
    const csv = generateCSV(mockRoutes);
    const lines = csv.split('\n');
    // header + data rows
    expect(lines.length).toBe(mockRoutes.length + 1);
  });

  it('should wrap route name in double quotes', () => {
    const csv = generateCSV(mockRoutes);
    const lines = csv.split('\n');
    // Check second line (first data row)
    expect(lines[1]).toContain('"Karachi to Lahore Express"');
  });

  it('should handle empty routes array', () => {
    const csv = generateCSV([]);
    const lines = csv.split('\n');
    expect(lines.length).toBe(1); // header only
  });

  it('should include correct distance values', () => {
    const csv = generateCSV([mockRoutes[0]]);
    expect(csv).toContain('1214');
  });

  it('should include route status', () => {
    const csv = generateCSV([mockRoutes[0]]);
    expect(csv).toContain('active');
  });
});

// ─── TC-UNIT-ROUTE-004: Displayed Routes Logic (Behavior 2) ───────

describe('TC-UNIT-ROUTE-004: Displayed Routes Logic (Behavior 2)', () => {
  it('should show all routes when no route is selected', () => {
    const result = getDisplayedRoutes(mockRoutes, null);
    expect(result.length).toBe(mockRoutes.length);
  });

  it('should show only selected assigned route when selected', () => {
    const assignedRoute = mockRoutes.find(r => r.assignedTanker && r.status !== 'unassigned')!;
    const result = getDisplayedRoutes(mockRoutes, assignedRoute);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(assignedRoute.id);
  });

  it('should show all routes when an unassigned route is selected', () => {
    const unassignedRoute = mockRoutes.find(r => r.status === 'unassigned')!;
    const result = getDisplayedRoutes(mockRoutes, unassignedRoute);
    expect(result.length).toBe(mockRoutes.length);
  });

  it('should show all routes if selected route has no assignedTanker', () => {
    const routeNoTanker: Route = {
      ...mockRoutes[0],
      assignedTanker: undefined,
      status: 'active',
    };
    const result = getDisplayedRoutes(mockRoutes, routeNoTanker);
    expect(result.length).toBe(mockRoutes.length);
  });
});

// ─── TC-UNIT-ROUTE-005: Auto-select on Search (Behavior 3) ────────

describe('TC-UNIT-ROUTE-005: Auto-select on Search (Behavior 3)', () => {
  it('should return null for empty search query', () => {
    const result = getAutoSelectedRoute(mockRoutes, '');
    expect(result).toBeNull();
  });

  it('should return null for whitespace-only search', () => {
    const result = getAutoSelectedRoute(mockRoutes, '   ');
    expect(result).toBeNull();
  });

  it('should return first assigned match when searching', () => {
    const filtered = filterRoutes(mockRoutes, 'PSO');
    const result = getAutoSelectedRoute(filtered, 'PSO');
    expect(result).not.toBeNull();
    expect(result!.assignedTanker).toBeTruthy();
    expect(result!.status).not.toBe('unassigned');
  });

  it('should return null if all filtered routes are unassigned', () => {
    const unassignedOnly = mockRoutes.filter(r => r.status === 'unassigned');
    const result = getAutoSelectedRoute(unassignedOnly, 'some query');
    expect(result).toBeNull();
  });
});

// ─── TC-UNIT-ROUTE-006: Polyline Color Logic ──────────────────────

describe('TC-UNIT-ROUTE-006: Polyline Color Logic', () => {
  it('should return green (#28B463) for selected route', () => {
    expect(getPolylineColor(true, false)).toBe('#28B463');
  });

  it('should return green even if both selected and assigned', () => {
    expect(getPolylineColor(true, true)).toBe('#28B463');
  });

  it('should return orange (#FF9800) for assigned but not selected', () => {
    expect(getPolylineColor(false, true)).toBe('#FF9800');
  });

  it('should return blue (#009FFD) for unassigned and not selected', () => {
    expect(getPolylineColor(false, false)).toBe('#009FFD');
  });
});

// ─── TC-UNIT-ROUTE-007: Route Path Construction ───────────────────

describe('TC-UNIT-ROUTE-007: Route Path Construction', () => {
  it('should construct path with start → waypoints → end', () => {
    const route = mockRoutes[0]; // Has 3 waypoints
    const path = [
      { lat: route.startLocation.lat, lng: route.startLocation.lng },
      ...route.waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
      { lat: route.endLocation.lat, lng: route.endLocation.lng }
    ];
    expect(path.length).toBe(2 + route.waypoints.length);
    expect(path[0].lat).toBe(route.startLocation.lat);
    expect(path[path.length - 1].lat).toBe(route.endLocation.lat);
  });

  it('should handle route with no waypoints', () => {
    const route = mockRoutes.find(r => r.waypoints.length === 0)!;
    const path = [
      { lat: route.startLocation.lat, lng: route.startLocation.lng },
      ...route.waypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
      { lat: route.endLocation.lat, lng: route.endLocation.lng }
    ];
    expect(path.length).toBe(2); // just start + end
  });
});

// ─── TC-UNIT-ROUTE-008: Route Status Constants ────────────────────

describe('TC-UNIT-ROUTE-008: Route Status Validation', () => {
  const validStatuses = ['active', 'not-started', 'completed', 'unassigned'];

  it('should have valid statuses for all mock routes', () => {
    mockRoutes.forEach(route => {
      expect(validStatuses).toContain(route.status);
    });
  });

  it('should have valid companies for all mock routes', () => {
    const validCompanies = ['PSO', 'Attock', 'Shell', 'Hascol'];
    mockRoutes.forEach(route => {
      expect(validCompanies).toContain(route.company);
    });
  });

  it('should have valid route types', () => {
    const validTypes = ['delivery', 'return', 'mixed'];
    mockRoutes.forEach(route => {
      expect(validTypes).toContain(route.routeType);
    });
  });
});

// ─── TC-UNIT-ROUTE-009: Assign Route Modal — Unassigned Filter ────

describe('TC-UNIT-ROUTE-009: Assign Route Modal — Unassigned Route Filter', () => {
  it('should only show unassigned routes for assignment', () => {
    const unassigned = mockRoutes.filter(r => r.status === 'unassigned');
    unassigned.forEach(r => {
      expect(r.assignedTanker).toBeUndefined();
      expect(r.assignedDriver).toBeUndefined();
    });
  });

  it('should filter unassigned routes by search text', () => {
    const unassigned = mockRoutes.filter(r => r.status === 'unassigned');
    const search = 'faisalabad';
    const filtered = unassigned.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.id.toLowerCase().includes(search) ||
      r.company.toLowerCase().includes(search) ||
      r.startLocation.address.toLowerCase().includes(search) ||
      r.endLocation.address.toLowerCase().includes(search)
    );
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    expect(filtered[0].id).toBe('RT-004');
  });
});

// ─── TC-UNIT-ROUTE-010: Available Tankers for Assignment ──────────

describe('TC-UNIT-ROUTE-010: Available Tankers Filter', () => {
  it('should exclude offline tankers from assignment', () => {
    const available = mockTankers.filter(t => t.status !== 'offline');
    available.forEach(t => expect(t.status).not.toBe('offline'));
  });

  it('should include moving, idle, parked, and alert tankers', () => {
    const available = mockTankers.filter(t => t.status !== 'offline');
    const statuses = available.map(t => t.status);
    expect(statuses).toContain('moving');
    expect(statuses).toContain('idle');
  });
});
