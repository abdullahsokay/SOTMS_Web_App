import { useState, useRef, useCallback } from 'react';
import { NearbyFacility } from '../types';

// Module-level cache
const placesCache: Record<string, NearbyFacility[]> = {};

function getCacheKey(lat: number, lng: number, radius: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${radius}`;
}

function getDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function useNearbyPlaces() {
  const [places, setPlaces] = useState<NearbyFacility[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);

  const search = useCallback((center: { lat: number; lng: number }, radius: number = 5000) => {
    const key = getCacheKey(center.lat, center.lng, radius);

    // Check cache
    if (placesCache[key]) {
      setPlaces(placesCache[key]);
      return;
    }

    // PlacesService needs a DOM element or map
    if (!serviceRef.current) {
      if (!mapDivRef.current) {
        mapDivRef.current = document.createElement('div');
      }
      serviceRef.current = new google.maps.places.PlacesService(mapDivRef.current);
    }

    setIsSearching(true);

    serviceRef.current.nearbySearch(
      {
        location: center,
        radius,
        type: 'gas_station',
      },
      (results, status) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const facilities: NearbyFacility[] = results
            .slice(0, 10)
            .map(place => ({
              placeId: place.place_id || '',
              name: place.name || 'Unknown',
              type: 'gas_station',
              location: {
                lat: place.geometry?.location?.lat() || 0,
                lng: place.geometry?.location?.lng() || 0,
              },
              rating: place.rating,
              isOpen: place.opening_hours?.isOpen?.(),
              distance: Math.round(getDistanceMeters(center, {
                lat: place.geometry?.location?.lat() || 0,
                lng: place.geometry?.location?.lng() || 0,
              })),
              photoReference: place.photos?.[0]?.getUrl({ maxWidth: 100, maxHeight: 100 }),
            }))
            .sort((a, b) => (a.distance || 0) - (b.distance || 0));

          placesCache[key] = facilities;
          setPlaces(facilities);
        } else {
          setPlaces([]);
        }
      }
    );
  }, []);

  const fetchDetails = useCallback((placeId: string): Promise<{ address?: string; phone?: string }> => {
    return new Promise((resolve) => {
      if (!serviceRef.current) {
        if (!mapDivRef.current) {
          mapDivRef.current = document.createElement('div');
        }
        serviceRef.current = new google.maps.places.PlacesService(mapDivRef.current);
      }

      serviceRef.current.getDetails(
        { placeId, fields: ['formatted_address', 'formatted_phone_number'] },
        (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result) {
            resolve({
              address: result.formatted_address || undefined,
              phone: result.formatted_phone_number || undefined,
            });
          } else {
            resolve({});
          }
        }
      );
    });
  }, []);

  const clear = useCallback(() => {
    setPlaces([]);
  }, []);

  return { places, isSearching, search, clear, fetchDetails };
}
