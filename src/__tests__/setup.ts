import '@testing-library/jest-dom';

// Mock Google Maps API
const mockLatLng = (lat: number, lng: number) => ({
  lat: () => lat,
  lng: () => lng,
});

const mockBounds = () => {
  const points: Array<{ lat: number; lng: number }> = [];
  return {
    extend: (point: { lat: number; lng: number }) => points.push(point),
    getCenter: () => mockLatLng(0, 0),
    getNorthEast: () => mockLatLng(0, 0),
    getSouthWest: () => mockLatLng(0, 0),
  };
};

globalThis.google = {
  maps: {
    Map: vi.fn(),
    LatLngBounds: vi.fn().mockImplementation(mockBounds),
    LatLng: vi.fn().mockImplementation(mockLatLng),
    Size: vi.fn().mockImplementation((w: number, h: number) => ({ width: w, height: h })),
    Point: vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
    event: {
      addListenerOnce: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    places: {
      AutocompleteService: vi.fn().mockImplementation(() => ({
        getPlacePredictions: vi.fn(),
      })),
      PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
    },
    Geocoder: vi.fn().mockImplementation(() => ({
      geocode: vi.fn(),
    })),
    GeocoderStatus: { OK: 'OK' },
  },
} as unknown as typeof globalThis.google;

// Mock Firebase
vi.mock('../firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'test-user-id', email: 'test@example.com' },
  },
  app: {},
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  query: vi.fn(),
  orderBy: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-doc-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  getFirestore: vi.fn(),
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn((_, callback) => {
    callback({ uid: 'test-user-id' });
    return vi.fn();
  }),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

// Mock window.URL.createObjectURL for CSV export
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:test-url');
  URL.revokeObjectURL = vi.fn();
}

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}
Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});
