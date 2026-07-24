/**
 * SOTMS Integration Test Suite — Route Assignment Workflow
 * ISO/IEC 29119-4 Test Cases | ISTQB Foundation Level
 *
 * Test Level: Integration Testing
 * Test Type: Functional (Black-box)
 * Techniques: Use-Case Testing, State Transition Testing
 *
 * System Under Test: Route assignment workflow, search auto-focus, map display filtering
 */

import { Route, Tanker } from '../../types';
import { mockRoutes, mockTankers } from '../testFixtures';

// ─── Helpers: replicate integrated business logic ───

function filterRoutes(routes: Route[], searchQuery: string): Route[] {
  return routes.filter(route =>
    route.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedTanker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    route.assignedDriver?.toLowerCase().includes(searchQuery.toLowerCase())
  );
}

function getDisplayedRoutes(routes: Route[], selectedRoute: Route | null): Route[] {
  if (selectedRoute && selectedRoute.assignedTanker && selectedRoute.status !== 'unassigned') {
    return routes.filter(r => r.id === selectedRoute.id);
  }
  return routes;
}

function getAutoSelectedRoute(filteredRoutes: Route[], searchQuery: string): Route | null {
  if (!searchQuery.trim()) return null;
  return filteredRoutes.find(r => r.assignedTanker && r.status !== 'unassigned') || null;
}

function assignRoute(
  routes: Route[],
  routeId: string,
  tankerId: string,
  tankers: Tanker[]
): { updatedRoute: Route; newRoutes: Route[] } {
  const tanker = tankers.find(t => t.id === tankerId);
  const routeIndex = routes.findIndex(r => r.id === routeId);
  const updatedRoute: Route = {
    ...routes[routeIndex],
    assignedTanker: tankerId,
    assignedDriver: tanker?.driver || 'Unknown',
    status: 'active',
    lastUsed: new Date().toISOString(),
  };
  const newRoutes = [...routes];
  newRoutes[routeIndex] = updatedRoute;
  return { updatedRoute, newRoutes };
}

// ═══════════════════════════════════════════════════════════════════

// ─── TC-INT-ASSIGN-001: Full Assignment Workflow ───────────────────

describe('TC-INT-ASSIGN-001: Full Assignment Workflow', () => {
  it('should transition route from unassigned to active after assignment', () => {
    const unassignedRoute = mockRoutes.find(r => r.status === 'unassigned')!;
    const availableTanker = mockTankers.find(t => t.status !== 'offline')!;

    const { updatedRoute } = assignRoute(
      mockRoutes, unassignedRoute.id, availableTanker.id, mockTankers
    );

    expect(updatedRoute.status).toBe('active');
    expect(updatedRoute.assignedTanker).toBe(availableTanker.id);
    expect(updatedRoute.assignedDriver).toBe(availableTanker.driver);
    expect(updatedRoute.lastUsed).toBeDefined();
  });

  it('should preserve original route data after assignment', () => {
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { updatedRoute } = assignRoute(mockRoutes, unassigned.id, tanker.id, mockTankers);

    expect(updatedRoute.name).toBe(unassigned.name);
    expect(updatedRoute.company).toBe(unassigned.company);
    expect(updatedRoute.startLocation).toEqual(unassigned.startLocation);
    expect(updatedRoute.endLocation).toEqual(unassigned.endLocation);
    expect(updatedRoute.distance).toBe(unassigned.distance);
    expect(updatedRoute.waypoints).toEqual(unassigned.waypoints);
  });

  it('should not modify other routes during assignment', () => {
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { newRoutes } = assignRoute(mockRoutes, unassigned.id, tanker.id, mockTankers);

    newRoutes.forEach(route => {
      if (route.id !== unassigned.id) {
        const original = mockRoutes.find(r => r.id === route.id)!;
        expect(route.status).toBe(original.status);
        expect(route.assignedTanker).toBe(original.assignedTanker);
      }
    });
  });
});

// ─── TC-INT-ASSIGN-002: Assignment → Map Display Integration ──────

describe('TC-INT-ASSIGN-002: Assignment → Map Display Integration', () => {
  it('should show only assigned route on map after selection', () => {
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { updatedRoute, newRoutes } = assignRoute(
      mockRoutes, unassigned.id, tanker.id, mockTankers
    );

    // After assignment, user selects the assigned route
    const displayed = getDisplayedRoutes(newRoutes, updatedRoute);
    expect(displayed.length).toBe(1);
    expect(displayed[0].id).toBe(updatedRoute.id);
    expect(displayed[0].assignedTanker).toBe(tanker.id);
  });

  it('should show all routes if deselected after assignment', () => {
    const displayed = getDisplayedRoutes(mockRoutes, null);
    expect(displayed.length).toBe(mockRoutes.length);
  });
});

// ─── TC-INT-ASSIGN-003: Search → Auto-select → Map Zoom ──────────

describe('TC-INT-ASSIGN-003: Search → Auto-select → Map Zoom Integration', () => {
  it('should auto-select assigned route when searching by tanker ID', () => {
    const searchQuery = 'TNK-001';
    const filtered = filterRoutes(mockRoutes, searchQuery);
    const autoSelected = getAutoSelectedRoute(filtered, searchQuery);

    expect(autoSelected).not.toBeNull();
    expect(autoSelected!.assignedTanker).toBe('TNK-001');
  });

  it('should auto-select assigned route when searching by driver name', () => {
    const searchQuery = 'John Smith';
    const filtered = filterRoutes(mockRoutes, searchQuery);
    const autoSelected = getAutoSelectedRoute(filtered, searchQuery);

    expect(autoSelected).not.toBeNull();
    expect(autoSelected!.assignedDriver).toBe('John Smith');
  });

  it('should show only the auto-selected route on map', () => {
    const searchQuery = 'TNK-001';
    const filtered = filterRoutes(mockRoutes, searchQuery);
    const autoSelected = getAutoSelectedRoute(filtered, searchQuery);
    const displayed = getDisplayedRoutes(filtered, autoSelected);

    expect(displayed.length).toBe(1);
    expect(displayed[0].assignedTanker).toBe('TNK-001');
  });

  it('should reset selection when search is cleared', () => {
    const autoSelected = getAutoSelectedRoute(mockRoutes, '');
    expect(autoSelected).toBeNull();

    const displayed = getDisplayedRoutes(mockRoutes, null);
    expect(displayed.length).toBe(mockRoutes.length);
  });
});

// ─── TC-INT-ASSIGN-004: Company-based Search → Display Chain ──────

describe('TC-INT-ASSIGN-004: Company Search → Filter → Display Chain', () => {
  it('should filter by Shell and auto-select first assigned Shell route', () => {
    const searchQuery = 'Shell';
    const filtered = filterRoutes(mockRoutes, searchQuery);
    const autoSelected = getAutoSelectedRoute(filtered, searchQuery);

    // Shell routes: RT-002 (assigned), RT-006 (unassigned)
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    if (autoSelected) {
      expect(autoSelected.company).toBe('Shell');
      expect(autoSelected.assignedTanker).toBeTruthy();
    }
  });

  it('should handle company with only unassigned routes', () => {
    // Create scenario where all routes of a company are unassigned
    const onlyUnassigned: Route[] = mockRoutes.map(r =>
      r.company === 'Hascol' ? { ...r, status: 'unassigned' as const, assignedTanker: undefined } : r
    );
    const filtered = filterRoutes(onlyUnassigned, 'Hascol');
    const autoSelected = getAutoSelectedRoute(filtered, 'Hascol');

    expect(autoSelected).toBeNull();
  });
});

// ─── TC-INT-ASSIGN-005: Post-Assignment State Consistency ─────────

describe('TC-INT-ASSIGN-005: Post-Assignment State Consistency', () => {
  it('should update route count correctly after assignment', () => {
    const initialUnassigned = mockRoutes.filter(r => r.status === 'unassigned').length;
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { newRoutes } = assignRoute(mockRoutes, unassigned.id, tanker.id, mockTankers);
    const finalUnassigned = newRoutes.filter(r => r.status === 'unassigned').length;

    expect(finalUnassigned).toBe(initialUnassigned - 1);
  });

  it('should make route searchable by new tanker ID after assignment', () => {
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { newRoutes } = assignRoute(mockRoutes, unassigned.id, tanker.id, mockTankers);
    const filtered = filterRoutes(newRoutes, tanker.id);

    expect(filtered.some(r => r.id === unassigned.id)).toBe(true);
  });

  it('should make route searchable by new driver name after assignment', () => {
    const unassigned = mockRoutes.find(r => r.status === 'unassigned')!;
    const tanker = mockTankers.find(t => t.status !== 'offline')!;

    const { newRoutes } = assignRoute(mockRoutes, unassigned.id, tanker.id, mockTankers);
    const filtered = filterRoutes(newRoutes, tanker.driver);

    expect(filtered.some(r => r.id === unassigned.id)).toBe(true);
  });
});

// ─── TC-INT-ASSIGN-006: Assign Route Modal Search Integration ─────

describe('TC-INT-ASSIGN-006: Assign Route Modal Search', () => {
  it('should filter unassigned routes by start location address', () => {
    const unassigned = mockRoutes.filter(r => r.status === 'unassigned');
    const search = 'hascol';
    const filtered = unassigned.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.id.toLowerCase().includes(search) ||
      r.company.toLowerCase().includes(search) ||
      r.startLocation.address.toLowerCase().includes(search) ||
      r.endLocation.address.toLowerCase().includes(search)
    );
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter unassigned routes by end location address', () => {
    const unassigned = mockRoutes.filter(r => r.status === 'unassigned');
    const search = 'lahore';
    const filtered = unassigned.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.id.toLowerCase().includes(search) ||
      r.company.toLowerCase().includes(search) ||
      r.startLocation.address.toLowerCase().includes(search) ||
      r.endLocation.address.toLowerCase().includes(search)
    );
    expect(filtered.length).toBeGreaterThanOrEqual(1);
  });
});
