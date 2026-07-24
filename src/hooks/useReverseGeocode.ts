import { useRef, useCallback } from 'react';

interface CacheEntry {
  address: string;
  timestamp: number;
}

const CACHE_KEY = 'sotms_geocode_cache';
const MAX_CACHE = 500;

// Module-level cache shared across all hook instances
let memoryCache: Record<string, CacheEntry> = {};
let cacheHydrated = false;

// Rate-limiting queue
let lastCallTime = 0;
const MIN_INTERVAL = 1000; // 1 second between API calls

function getGeohashKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

function hydrateCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      memoryCache = JSON.parse(stored);
    }
  } catch {
    // sessionStorage unavailable or corrupted
  }
}

function persistCache() {
  try {
    // Prune to MAX_CACHE entries (keep newest)
    const entries = Object.entries(memoryCache);
    if (entries.length > MAX_CACHE) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      memoryCache = Object.fromEntries(entries.slice(0, MAX_CACHE));
    }
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function useReverseGeocode() {
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const pendingRef = useRef(false);

  const geocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    hydrateCache();

    const key = getGeohashKey(lat, lng);

    // Check cache first
    if (memoryCache[key]) {
      return memoryCache[key].address;
    }

    // Rate limiting
    const now = Date.now();
    const waitTime = Math.max(0, MIN_INTERVAL - (now - lastCallTime));
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Avoid concurrent calls
    if (pendingRef.current) {
      return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }

    pendingRef.current = true;
    lastCallTime = Date.now();

    try {
      if (!geocoderRef.current) {
        geocoderRef.current = new google.maps.Geocoder();
      }

      const result = await new Promise<string>((resolve) => {
        geocoderRef.current!.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(results[0].formatted_address);
          } else {
            resolve(`Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`);
          }
        });
      });

      // Cache the result
      memoryCache[key] = { address: result, timestamp: Date.now() };
      persistCache();

      return result;
    } catch {
      return `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    } finally {
      pendingRef.current = false;
    }
  }, []);

  return { geocode };
}
