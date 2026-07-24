/**
 * Geo / GPS math utilities.
 *
 * Canonical implementations of the pure geospatial functions used across the
 * app (originally defined privately inside GPSContext). Extracted here so they
 * can be imported and unit-tested against the real production code.
 */

/**
 * Convert degrees to radians.
 * @param deg angle in degrees
 * @returns angle in radians
 */
export function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

/**
 * Great-circle (Haversine) distance between two lat/lon points.
 * Uses an Earth radius of 6371 km.
 * @returns distance in kilometres
 */
export function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial bearing (forward azimuth) from point 1 to point 2.
 * @returns bearing in degrees, normalized to the range [0, 360)
 */
export function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dLon = deg2rad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(deg2rad(lat2));
    const x = Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
              Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(dLon);
    return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

/**
 * Robust timestamp → epoch-ms parser.
 * Handles: epoch seconds, epoch ms, ISO strings, and Firebase Timestamps.
 * Numbers below 1e11 are treated as epoch-seconds and scaled to ms.
 * @returns epoch time in milliseconds, or 0 if unparseable
 */
export function getTime(val: unknown): number {
    if (!val) return 0;
    if (typeof val === 'number') {
        // If the number is too small to be epoch-ms, it's likely epoch-seconds
        // Epoch-ms for year 2000 ≈ 946684800000 (~1e12)
        // Epoch-sec for year 2000 ≈ 946684800 (~1e9)
        if (val > 0 && val < 1e11) return val * 1000; // seconds → ms
        return val; // already ms
    }
    if (typeof val === 'object' && val !== null && 'toDate' in val &&
        typeof (val as { toDate: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof val === 'string') {
        const date = new Date(val);
        return !isNaN(date.getTime()) ? date.getTime() : 0;
    }
    return 0;
}
