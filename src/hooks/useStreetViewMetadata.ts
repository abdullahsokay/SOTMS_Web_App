import { useState, useCallback, useRef } from 'react';

interface StreetViewMetadata {
  available: boolean;
  panoId?: string;
  date?: string;
  location?: { lat: number; lng: number };
}

// Module-level cache to avoid repeat API calls
const metadataCache: Record<string, StreetViewMetadata> = {};

export function useStreetViewMetadata() {
  const [isChecking, setIsChecking] = useState(false);
  const serviceRef = useRef<google.maps.StreetViewService | null>(null);

  const checkAvailability = useCallback(
    async (location: { lat: number; lng: number }): Promise<StreetViewMetadata> => {
      const cacheKey = `${location.lat.toFixed(4)}_${location.lng.toFixed(4)}`;

      if (metadataCache[cacheKey]) {
        return metadataCache[cacheKey];
      }

      if (!serviceRef.current) {
        serviceRef.current = new google.maps.StreetViewService();
      }

      setIsChecking(true);

      return new Promise((resolve) => {
        serviceRef.current!.getPanorama(
          { location, radius: 50 },
          (data, status) => {
            setIsChecking(false);
            const result: StreetViewMetadata = {
              available: status === google.maps.StreetViewStatus.OK,
              panoId: data?.location?.pano,
              date: data?.imageDate,
              location: data?.location?.latLng
                ? {
                    lat: data.location.latLng.lat(),
                    lng: data.location.latLng.lng(),
                  }
                : undefined,
            };
            metadataCache[cacheKey] = result;
            resolve(result);
          }
        );
      });
    },
    []
  );

  return { checkAvailability, isChecking };
}
