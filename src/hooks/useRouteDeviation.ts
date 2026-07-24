import { useMemo } from 'react';

export function useRouteDeviation(
  tankerPosition: { lat: number; lng: number } | null,
  routePath: Array<{ lat: number; lng: number }> | null | undefined,
  thresholdMeters: number = 500
) {
  const result = useMemo(() => {
    if (!tankerPosition || !routePath || routePath.length < 2) {
      return { isDeviated: false, deviationDistance: 0 };
    }

    // Check if google.maps.geometry is available
    if (!google?.maps?.geometry?.poly || !google?.maps?.geometry?.spherical) {
      return { isDeviated: false, deviationDistance: 0 };
    }

    const position = new google.maps.LatLng(tankerPosition.lat, tankerPosition.lng);
    const path = routePath.map(p => new google.maps.LatLng(p.lat, p.lng));
    const polyline = new google.maps.Polyline({ path });

    // Convert threshold meters to degrees (approximate tolerance for isLocationOnEdge)
    // 1 degree ≈ 111,111 meters at equator
    const tolerance = thresholdMeters / 111111;

    const isOnEdge = google.maps.geometry.poly.isLocationOnEdge(
      position,
      polyline,
      tolerance
    );

    if (isOnEdge) {
      return { isDeviated: false, deviationDistance: 0 };
    }

    // Calculate distance to nearest point on route
    let minDistance = Infinity;
    for (const routePoint of path) {
      const dist = google.maps.geometry.spherical.computeDistanceBetween(position, routePoint);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    return {
      isDeviated: true,
      deviationDistance: Math.round(minDistance),
    };
  }, [tankerPosition?.lat, tankerPosition?.lng, routePath?.length, thresholdMeters]);

  return result;
}
