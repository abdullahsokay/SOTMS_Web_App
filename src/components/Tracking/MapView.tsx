
import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api';
import { MapOverlay } from '../Map/MapOverlay';
import { Tanker, Route, NearbyFacility } from '../../types';
import { TrackingStore } from '../../types/tracking';
import { Droplet, Signal, Minimize2, MapPin, Fuel, Phone, Star, X, Satellite, Map as MapIcon, Navigation, Clock, Percent, XCircle } from 'lucide-react';
import { useGoogleMaps } from '../../contexts/GoogleMapsContext';
import { darkMapStyle, containerStyle, defaultCenter, getMarkerIcon, getRelativeTime, STATUS_COLORS } from '../../utils/mapUtils';
import { AnimatedVehicleMarker } from '../Map/AnimatedVehicleMarker';
import { VehiclePathHistory } from '../Map/VehiclePathHistory';
import { AssignedRouteOverlay } from '../Map/AssignedRouteOverlay';
import { PathSegment, StopMarkerData, HistoricalGPSPoint } from '../../types/tracking';

interface MapViewProps {
  tankers: Tanker[];
  selectedTanker: Tanker | null;
  onSelectTanker: (tanker: Tanker) => void;
  onDeselectTanker?: () => void;
  zoom?: number;
  positionHistory?: Array<{ lat: number; lng: number; timestamp: number }>;
  snappedPath?: Array<{ lat: number; lng: number }>;
  showTraffic?: boolean;
  trackingData?: TrackingStore;
  pathSegments?: PathSegment[];
  pathStops?: StopMarkerData[];
  pathStartPoint?: HistoricalGPSPoint;
  pathEndPoint?: HistoricalGPSPoint;
  replayPosition?: HistoricalGPSPoint | null;
  assignedRoute?: Route | null;
  selectedFuelStation?: NearbyFacility | null;
  onClearFuelStation?: () => void;
  onMapReady?: (map: google.maps.Map) => void;
}

/** Haversine distance in km */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Sum distance along a path of lat/lng points (km) */
function pathLengthKm(path: Array<{ lat: number; lng: number }>): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += distanceKm(path[i - 1].lat, path[i - 1].lng, path[i].lat, path[i].lng);
  }
  return total;
}

/** Find closest point index on a path to a given position */
function closestPointIndex(pos: { lat: number; lng: number }, path: Array<{ lat: number; lng: number }>): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < path.length; i++) {
    const d = distanceKm(pos.lat, pos.lng, path[i].lat, path[i].lng);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

interface RemainingRouteData {
  path: Array<{ lat: number; lng: number }>;
  distance: string;
  duration: string;
  durationValue: number;
}

export function MapView({ tankers, selectedTanker, onSelectTanker, onDeselectTanker, zoom = 5, positionHistory = [], snappedPath = [], showTraffic = false, trackingData = {}, pathSegments, pathStops, pathStartPoint, pathEndPoint, replayPosition, assignedRoute, selectedFuelStation, onClearFuelStation, onMapReady }: MapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const initialFitDoneRef = useRef(false);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

  // Remaining route state (Directions API from tanker → route end)
  const [remainingRoute, setRemainingRoute] = useState<RemainingRouteData | null>(null);
  const remainingRouteRequestRef = useRef<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    onMapReady?.(map);
  }, [onMapReady]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Initialize Directions service
  useEffect(() => {
    if (isLoaded && !directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
  }, [isLoaded]);

  // Compute remaining route via Directions API when tanker is focused with an assigned route
  useEffect(() => {
    if (!selectedTanker || !assignedRoute || !directionsServiceRef.current) {
      setRemainingRoute(null);
      remainingRouteRequestRef.current = null;
      return;
    }

    const requestKey = `${selectedTanker.id}-${selectedTanker.location.lat.toFixed(4)}-${selectedTanker.location.lng.toFixed(4)}`;
    // Avoid duplicate requests for the same position
    if (remainingRouteRequestRef.current === requestKey) return;
    remainingRouteRequestRef.current = requestKey;

    const tankerPos = { lat: selectedTanker.location.lat, lng: selectedTanker.location.lng };
    const destination = assignedRoute.endLocation;

    directionsServiceRef.current.route(
      {
        origin: tankerPos,
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const leg = result.routes[0].legs[0];
          setRemainingRoute({
            path: result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })),
            distance: leg.distance?.text || '',
            duration: leg.duration?.text || '',
            durationValue: leg.duration?.value || 0,
          });
        }
      }
    );
  }, [selectedTanker, assignedRoute]);

  // Compute traveled portion and % complete
  const routeProgress = useMemo(() => {
    if (!selectedTanker || !assignedRoute?.routePath || assignedRoute.routePath.length < 2) {
      return null;
    }
    const routePath = assignedRoute.routePath;
    const tankerPos = { lat: selectedTanker.location.lat, lng: selectedTanker.location.lng };
    const closestIdx = closestPointIndex(tankerPos, routePath);
    const totalLength = pathLengthKm(routePath);
    const traveledLength = pathLengthKm(routePath.slice(0, closestIdx + 1));
    const percent = totalLength > 0 ? Math.min(100, Math.round((traveledLength / totalLength) * 100)) : 0;
    const traveledPath = routePath.slice(0, closestIdx + 1);

    return {
      percent,
      traveledPath,
      totalDistKm: totalLength,
      traveledDistKm: traveledLength,
    };
  }, [selectedTanker, assignedRoute]);

  // Update center when selectedTanker changes — fit bounds to show tanker + assigned route
  useEffect(() => {
    if (!map) return;
    if (selectedTanker) {
      setActiveMarkerId(selectedTanker.id);
      if (assignedRoute) {
        // Fit bounds to show tanker position + full assigned route
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: selectedTanker.location.lat, lng: selectedTanker.location.lng });
        bounds.extend(assignedRoute.startLocation);
        bounds.extend(assignedRoute.endLocation);
        assignedRoute.waypoints?.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
        if (assignedRoute.routePath) {
          assignedRoute.routePath.forEach(p => bounds.extend(p));
        }
        map.fitBounds(bounds, { top: 60, right: 60, bottom: 100, left: 320 });
      } else {
        map.panTo({ lat: selectedTanker.location.lat, lng: selectedTanker.location.lng });
        map.setZoom(12);
      }
    } else {
      // Deselected — zoom back to country view
      setActiveMarkerId(null);
      setRemainingRoute(null);
      remainingRouteRequestRef.current = null;
      map.setCenter(defaultCenter);
      map.setZoom(5);
    }
  }, [selectedTanker, map, assignedRoute]);

  // Handle tanker click — toggle selection (re-click deselects)
  const handleTankerClick = useCallback((tanker: Tanker) => {
    if (selectedTanker?.id === tanker.id) {
      // Re-click same tanker → deselect
      onDeselectTanker?.();
    } else {
      onSelectTanker(tanker);
    }
  }, [selectedTanker, onSelectTanker, onDeselectTanker]);

  // Click empty map to deselect tanker
  const handleMapClick = useCallback(() => {
    if (selectedTanker) {
      onDeselectTanker?.();
    }
  }, [selectedTanker, onDeselectTanker]);

  // Toggle traffic layer
  useEffect(() => {
    if (!map) return;
    if (showTraffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
    } else {
      trafficLayerRef.current?.setMap(null);
    }
  }, [map, showTraffic]);

  // Pan to selected fuel station
  useEffect(() => {
    if (map && selectedFuelStation) {
      map.panTo(selectedFuelStation.location);
      if (map.getZoom()! < 14) map.setZoom(14);
    }
  }, [map, selectedFuelStation]);

  // ONE-TIME initial fit: fit all tankers into view only on first data load
  useEffect(() => {
    if (!map || initialFitDoneRef.current || tankers.length === 0) return;
    const validTankers = tankers.filter(t => t.location.lat !== 0 || t.location.lng !== 0);
    if (validTankers.length === 0) return;

    initialFitDoneRef.current = true;

    if (validTankers.length === 1) {
      map.panTo({ lat: validTankers[0].location.lat, lng: validTankers[0].location.lng });
      map.setZoom(10);
    } else {
      const bounds = new google.maps.LatLngBounds();
      validTankers.forEach(t => bounds.extend({ lat: t.location.lat, lng: t.location.lng }));
      map.fitBounds(bounds, 60); // 60px padding
    }
  }, [map, tankers]);

  // Toggle satellite / dark map style
  useEffect(() => {
    if (!map) return;
    if (isSatellite) {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
      map.setOptions({ styles: [] }); // Remove dark style for satellite
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      map.setOptions({ styles: darkMapStyle });
    }
  }, [map, isSatellite]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#07121A] text-red-500 p-4 text-center border border-red-500/30 rounded-lg m-4">
        <div>
          <h3 className="font-bold text-lg mb-2">Map Load Error</h3>
          <p>{loadError.message}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-[#07121A]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00E5FF]"></div>
      </div>
    );
  }

  // Check if no API key is provided
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDZ0QE8_i8BorwZ1N2URBVenyqfxYPfvAg';
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#07121A] text-white p-6 text-center space-y-4">
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 p-6 rounded-xl max-w-md shadow-[0_0_30px_rgba(0,229,255,0.1)]">
          <h3 className="text-xl font-bold text-[#00E5FF] mb-2">Google Maps Integration Required</h3>
          <p className="text-gray-300 text-sm mb-4">
            To enable the live Google Map, you need to provide an API Key.
          </p>
          <div className="text-left bg-black/30 p-3 rounded border border-gray-700 font-mono text-xs mb-4">
            1. Get an API Key from Google Cloud Console.<br />
            2. Enable "Maps JavaScript API".<br />
            3. Add it to your <code>.env</code> file:<br />
            <span className="text-[#00E5FF]">VITE_GOOGLE_MAPS_API_KEY=your_key_here</span>
          </div>
          <p className="text-xs text-gray-500">Restart the dev server after adding the key.</p>
        </div>
      </div>
    );
  }

  // Determine if a tanker is selected and focused
  const isVehicleFocused = !!selectedTanker;

  return (
    <div className="flex-1 relative bg-[#07121A] overflow-hidden h-full w-full rounded-lg">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          styles: isSatellite ? [] : darkMapStyle,
          mapTypeId: isSatellite ? 'hybrid' : 'roadmap',
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {/* Tanker markers: use AnimatedVehicleMarker when RTDB data exists, else static */}
        {tankers.map(tanker => {
          const isSelected = selectedTanker?.id === tanker.id;
          // Enlarged marker size when focused
          const markerSize = isSelected ? 64 : 48;
          const markerHalf = markerSize / 2;

          // If RTDB tracking data exists for this tanker, render animated marker
          if (trackingData[tanker.id]) {
            return (
              <AnimatedVehicleMarker
                key={`rtdb-${tanker.id}`}
                data={trackingData[tanker.id]}
                onClick={() => handleTankerClick(tanker)}
              />
            );
          }

          // Fallback: original static marker
          const sc = STATUS_COLORS[tanker.status] || STATUS_COLORS.default;
          return (
            <Fragment key={tanker.id}>
              <Marker
                position={{ lat: tanker.location.lat, lng: tanker.location.lng }}
                onClick={() => handleTankerClick(tanker)}
                icon={{
                  url: getMarkerIcon(tanker.status, tanker.bearing ?? 0),
                  scaledSize: new google.maps.Size(markerSize, markerSize),
                  anchor: new google.maps.Point(markerHalf, markerHalf)
                }}
                zIndex={isSelected ? 1100 : 999}
              />

              {/* Pulsing ring around selected tanker */}
              {isSelected && (
                <MapOverlay
                  position={{ lat: tanker.location.lat, lng: tanker.location.lng }}
                  getPixelPositionOffset={() => ({ x: -40, y: -40 })}
                >
                  <div className="w-[80px] h-[80px] rounded-full border-2 border-[#00E5FF] animate-ping opacity-30 pointer-events-none" />
                </MapOverlay>
              )}

              {/* Expanded info panel (sibling of Marker, not child) */}
              {activeMarkerId === tanker.id && (
                <MapOverlay
                  position={{ lat: tanker.location.lat, lng: tanker.location.lng }}

                  getPixelPositionOffset={(width, height) => ({
                    x: -(width / 2),
                    y: -(height + 38)
                  })}
                >
                  <div className="relative pointer-events-auto min-w-[230px] animate-fade-in">
                    <div
                      className="bg-[#0C1E2C] backdrop-blur-md rounded-xl overflow-hidden"
                      style={{
                        border: `1px solid ${sc}60`,
                        boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${sc}25`,
                      }}
                    >
                      {/* Header */}
                      <div
                        className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: `linear-gradient(135deg, ${sc}25, transparent)` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm tracking-wide">{tanker.name}</span>
                          <span
                            className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
                            style={{ color: sc, backgroundColor: `${sc}20`, border: `1px solid ${sc}50` }}
                          >
                            {tanker.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          title="Close"
                          onClick={(e) => { e.stopPropagation(); setActiveMarkerId(null); }}
                          className="p-1 rounded-md hover:bg-white/10 transition-colors"
                        >
                          <Minimize2 size={14} className="text-[#D9DCE1]/60" />
                        </button>
                      </div>

                      {/* Metrics grid */}
                      <div className="px-4 py-3 grid grid-cols-3 gap-2">
                        <div className="bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                          <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-1">Speed</div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-mono font-bold" style={{ color: sc }}>{tanker.speed}</span>
                            <span className="text-[9px] text-[#D9DCE1]/40">km/h</span>
                          </div>
                        </div>
                        <div className="bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                          <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Droplet size={9} /> Fuel
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-mono font-bold text-[#00E5FF]">{tanker.fuelLevel ?? '--'}</span>
                            <span className="text-[9px] text-[#D9DCE1]/40">%</span>
                          </div>
                        </div>
                        <div className="bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                          <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Signal size={9} /> RSSI
                          </div>
                          <span className="text-lg font-mono font-bold text-[#28B463]">{tanker.rssi ?? '--'}</span>
                        </div>
                      </div>

                      {/* Address */}
                      {tanker.location.address && !tanker.location.address.startsWith('Lat:') && (
                        <div className="px-4 pb-2">
                          <div className="flex items-center gap-2 bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                            <MapPin size={12} className="text-[#28B463] flex-shrink-0" />
                            <span className="text-[11px] text-[#D9DCE1]/70 truncate">{tanker.location.address}</span>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div
                        className="px-4 py-2 flex items-center justify-between border-t"
                        style={{ borderColor: `${sc}20` }}
                      >
                        <span className="text-[10px] text-[#D9DCE1]/40">
                          Uptime: {typeof tanker.uptime === 'number' ? Math.round(tanker.uptime / 60000) : 0}m
                        </span>
                        <span className={`text-[10px] font-medium ${tanker.status === 'offline' ? 'text-[#FF4D4D]' : 'text-[#D9DCE1]/60'}`}>
                          {getRelativeTime(tanker.lastUpdate)}
                        </span>
                      </div>
                    </div>

                    {/* Arrow pointer */}
                    <div className="flex justify-center">
                      <div
                        className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px]"
                        style={{ borderTopColor: `${sc}60` }}
                      />
                    </div>
                  </div>
                </MapOverlay>
              )}

              {/* Compact label */}
              {activeMarkerId !== tanker.id && (
                <MapOverlay
                  position={{ lat: tanker.location.lat, lng: tanker.location.lng }}

                  getPixelPositionOffset={(width) => ({
                    x: -(width / 2),
                    y: isSelected ? 36 : 28
                  })}
                >
                  <div
                    className="relative pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTankerClick(tanker);
                    }}
                  >
                    {/* Arrow pointing up to marker */}
                    <div className="flex justify-center">
                      <div
                        className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px]"
                        style={{ borderBottomColor: `${sc}80` }}
                      />
                    </div>
                    {/* Card */}
                    <div
                      className="bg-[#0C1E2C] rounded-lg overflow-hidden min-w-[130px]"
                      style={{
                        border: `1px solid ${sc}60`,
                        boxShadow: `0 2px 12px rgba(0,0,0,0.4), 0 0 10px ${sc}15`,
                      }}
                    >
                      {/* Header */}
                      <div
                        className="px-3 py-1.5 flex items-center justify-between gap-2"
                        style={{ background: `linear-gradient(135deg, ${sc}30, ${sc}10)` }}
                      >
                        <span className="text-[11px] font-bold text-white tracking-wide">{tanker.name}</span>
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ color: sc, backgroundColor: `${sc}25`, border: `1px solid ${sc}40` }}
                        >
                          {tanker.status}
                        </span>
                      </div>
                      {/* Metrics */}
                      <div className="px-3 py-1.5 flex items-center justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-base font-mono font-bold text-white">{tanker.speed}</span>
                          <span className="text-[9px] text-[#D9DCE1]/50">km/h</span>
                        </div>
                        <span className="text-[9px] text-[#D9DCE1]/40">{getRelativeTime(tanker.lastUpdate)}</span>
                      </div>
                    </div>
                  </div>
                </MapOverlay>
              )}
            </Fragment>
          );
        })}

        {/* RTDB-only vehicles (not in Firestore tankers list) */}
        {Object.keys(trackingData)
          .filter(vid => !tankers.some(t => t.id === vid))
          .map(vid => (
            <AnimatedVehicleMarker key={`rtdb-only-${vid}`} data={trackingData[vid]} />
          ))
        }

        {/* Traveled path polyline (cyan) — shown when vehicle is focused and we have route progress */}
        {isVehicleFocused && routeProgress && routeProgress.traveledPath.length > 1 && (
          <Polyline
            path={routeProgress.traveledPath}
            options={{
              strokeColor: '#00E5FF',
              strokeOpacity: 0.9,
              strokeWeight: 5,
              zIndex: 20,
            }}
          />
        )}

        {/* Remaining route polyline (dashed orange) — from tanker to destination via Directions API */}
        {isVehicleFocused && remainingRoute && remainingRoute.path.length > 1 && (
          <Polyline
            path={remainingRoute.path}
            options={{
              strokeColor: '#FF6B35',
              strokeOpacity: 0,
              strokeWeight: 0,
              icons: [{
                icon: {
                  path: 'M 0,-1 0,1',
                  strokeOpacity: 0.8,
                  strokeWeight: 4,
                  strokeColor: '#FF6B35',
                  scale: 3,
                },
                offset: '0',
                repeat: '20px',
              }],
              zIndex: 15,
            }}
          />
        )}

        {/* Road-snapped trail or raw GPS trail — hidden when Path History is active (it renders its own segments) */}
        {!pathSegments && !isVehicleFocused && (() => {
          // Filter points to Pakistan bounds and remove GPS noise
          const filterPath = (pts: Array<{ lat: number; lng: number }>) => {
            const valid = pts.filter(p => p.lat >= 23 && p.lat <= 37 && p.lng >= 60 && p.lng <= 78);
            // Remove jumps: discard point if distance from previous > 50km
            const clean: Array<{ lat: number; lng: number }> = [];
            for (const pt of valid) {
              if (clean.length === 0) { clean.push(pt); continue; }
              const prev = clean[clean.length - 1];
              const d = distanceKm(prev.lat, prev.lng, pt.lat, pt.lng);
              if (d < 50) clean.push(pt);
            }
            return clean;
          };

          if (snappedPath.length > 1) {
            const cleaned = filterPath(snappedPath);
            return cleaned.length > 1 ? (
              <Polyline path={cleaned} options={{ strokeColor: '#00FF00', strokeOpacity: 0.9, strokeWeight: 5 }} />
            ) : null;
          }
          if (positionHistory.length > 1) {
            const cleaned = filterPath(positionHistory.map(p => ({ lat: p.lat, lng: p.lng })));
            return cleaned.length > 1 ? (
              <Polyline path={cleaned} options={{ strokeColor: '#00FF00', strokeOpacity: 0.7, strokeWeight: 4 }} />
            ) : null;
          }
          return null;
        })()}

        {/* GPS Path History overlay */}
        {pathSegments && pathSegments.length > 0 && (
          <VehiclePathHistory
            segments={pathSegments}
            stops={pathStops || []}
            startPoint={pathStartPoint}
            endPoint={pathEndPoint}
            replayPosition={replayPosition}
          />
        )}

        {/* Assigned route guide overlay — only when NOT vehicle-focused (focus mode shows its own polylines) */}
        {assignedRoute && !isVehicleFocused && (
          <AssignedRouteOverlay route={assignedRoute} />
        )}

        {/* Selected fuel station marker + info card */}
        {selectedFuelStation && (
          <>
            <Marker
              position={selectedFuelStation.location}
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="#FFB02E" stroke="#fff" stroke-width="2"/>
                    <text x="20" y="26" text-anchor="middle" font-size="20" fill="#0C1E2C">⛽</text>
                  </svg>`
                )}`,
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20),
              }}
              zIndex={1050}
            />
            <MapOverlay
              position={selectedFuelStation.location}
              getPixelPositionOffset={(width, height) => ({
                x: -(width / 2),
                y: -(height + 28),
              })}
            >
              <div className="relative pointer-events-auto min-w-[220px] max-w-[280px] animate-fade-in">
                <div
                  className="bg-[#0C1E2C] backdrop-blur-md rounded-xl overflow-hidden"
                  style={{
                    border: '1px solid rgba(255,176,46,0.5)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 20px rgba(255,176,46,0.2)',
                  }}
                >
                  {/* Header */}
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(255,176,46,0.2), transparent)' }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Fuel size={14} className="text-[#FFB02E] flex-shrink-0" />
                      <span className="text-white font-bold text-sm truncate">{selectedFuelStation.name}</span>
                    </div>
                    <button
                      type="button"
                      title="Close"
                      onClick={(e) => { e.stopPropagation(); onClearFuelStation?.(); }}
                      className="p-1 rounded-md hover:bg-white/10 transition-colors flex-shrink-0 ml-2"
                    >
                      <X size={14} className="text-[#D9DCE1]/60" />
                    </button>
                  </div>

                  {/* Details */}
                  <div className="px-4 py-3 space-y-2">
                    {/* Rating & Status row */}
                    <div className="flex items-center gap-3">
                      {selectedFuelStation.rating != null && (
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-[#FFB02E] fill-[#FFB02E]" />
                          <span className="text-sm font-mono font-bold text-[#FFB02E]">{selectedFuelStation.rating}</span>
                        </div>
                      )}
                      {selectedFuelStation.isOpen != null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${selectedFuelStation.isOpen ? 'text-[#28B463] bg-[#28B463]/15 border border-[#28B463]/40' : 'text-[#FF4D4D] bg-[#FF4D4D]/15 border border-[#FF4D4D]/40'}`}>
                          {selectedFuelStation.isOpen ? 'Open' : 'Closed'}
                        </span>
                      )}
                      {selectedFuelStation.distance != null && (
                        <span className="text-[10px] text-[#D9DCE1]/50">
                          {selectedFuelStation.distance < 1000 ? `${selectedFuelStation.distance}m` : `${(selectedFuelStation.distance / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>

                    {/* Address */}
                    {selectedFuelStation.address && (
                      <div className="flex items-start gap-2 bg-[#07121A] rounded-lg p-2.5 border border-[#FFB02E]/10">
                        <MapPin size={12} className="text-[#FFB02E] flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] text-[#D9DCE1]/70 leading-relaxed">{selectedFuelStation.address}</span>
                      </div>
                    )}

                    {/* Phone */}
                    {selectedFuelStation.phone && (
                      <div className="flex items-center gap-2 bg-[#07121A] rounded-lg p-2.5 border border-[#FFB02E]/10">
                        <Phone size={12} className="text-[#FFB02E] flex-shrink-0" />
                        <span className="text-[11px] text-[#D9DCE1]/70">{selectedFuelStation.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow pointer */}
                <div className="flex justify-center">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#FFB02E]/50" />
                </div>
              </div>
            </MapOverlay>
          </>
        )}
      </GoogleMap>

      {/* Vehicle Focus Info Panel — bottom-left when a tanker with a route is focused */}
      {isVehicleFocused && selectedTanker && assignedRoute && (
        <div className="absolute bottom-14 left-4 z-20 animate-fade-in">
          <div
            className="bg-[#0C1E2C]/95 backdrop-blur-xl border border-[#00E5FF]/30 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(0,229,255,0.1)] w-[320px] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#00E5FF]/15">
              <div className="flex items-center gap-2.5">
                <Navigation size={16} className="text-[#00E5FF]" />
                <div>
                  <div className="text-sm font-bold text-white">{selectedTanker.name}</div>
                  <div className="text-[10px] text-[#D9DCE1]/50">{selectedTanker.id} · {selectedTanker.driver}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeselectTanker?.(); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 text-[#FF4D4D] hover:bg-[#FF4D4D]/20 transition-all text-[10px] font-semibold"
                title="Clear Focus"
              >
                <XCircle size={12} />
                Clear Focus
              </button>
            </div>

            {/* Route Info */}
            <div className="px-4 py-3 space-y-2.5">
              {/* Origin → Destination */}
              <div className="flex items-start gap-2">
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28B463]" />
                  <div className="w-px h-4 bg-[#D9DCE1]/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF4D4D]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#D9DCE1]/50 mb-0.5">Origin</div>
                  <div className="text-[11px] text-white truncate">{assignedRoute.startLocation.address || 'Start'}</div>
                  <div className="text-[10px] text-[#D9DCE1]/50 mb-0.5 mt-1.5">Destination</div>
                  <div className="text-[11px] text-white truncate">{assignedRoute.endLocation.address || 'End'}</div>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-2">
                {/* Speed */}
                <div className="bg-[#07121A] rounded-lg p-2 border border-[#00E5FF]/10 text-center">
                  <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-0.5">Speed</div>
                  <div className="text-base font-mono font-bold text-[#00E5FF]">{selectedTanker.speed}</div>
                  <div className="text-[8px] text-[#D9DCE1]/30">km/h</div>
                </div>

                {/* ETA */}
                <div className="bg-[#07121A] rounded-lg p-2 border border-[#FF6B35]/10 text-center">
                  <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                    <Clock size={8} /> ETA
                  </div>
                  <div className="text-sm font-mono font-bold text-[#FF6B35]">
                    {remainingRoute ? remainingRoute.duration : (selectedTanker.eta ? `${selectedTanker.eta.durationRemaining}m` : '--')}
                  </div>
                  {remainingRoute && (
                    <div className="text-[8px] text-[#D9DCE1]/30">{remainingRoute.distance}</div>
                  )}
                </div>

                {/* % Complete */}
                <div className="bg-[#07121A] rounded-lg p-2 border border-[#28B463]/10 text-center">
                  <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
                    <Percent size={8} /> Done
                  </div>
                  <div className="text-base font-mono font-bold text-[#28B463]">
                    {routeProgress ? `${routeProgress.percent}%` : '--'}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {routeProgress && (
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-[#07121A] rounded-full overflow-hidden border border-[#00E5FF]/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${routeProgress.percent}%`,
                        background: 'linear-gradient(90deg, #00E5FF, #28B463)',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#D9DCE1]/40">
                    <span>{routeProgress.traveledDistKm.toFixed(1)} km traveled</span>
                    <span>{routeProgress.totalDistKm.toFixed(1)} km total</span>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-[#00E5FF]/10 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-[3px] rounded bg-[#00E5FF]" />
                <span className="text-[9px] text-[#D9DCE1]/40">Traveled</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-[3px] rounded border-t-2 border-dashed border-[#FF6B35]" />
                <span className="text-[9px] text-[#D9DCE1]/40">Remaining</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Satellite toggle — bottom-left of map (shifted right when focus panel is shown) */}
      <button
        type="button"
        onClick={() => setIsSatellite(prev => !prev)}
        className={`absolute bottom-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shadow-lg ${
          isVehicleFocused && assignedRoute ? 'left-[340px]' : 'left-4'
        } ${
          isSatellite
            ? 'bg-[#00E5FF]/20 border-[#00E5FF]/50 text-[#00E5FF]'
            : 'bg-[#0C1E2C]/90 border-[#00E5FF]/20 text-[#D9DCE1]/80 hover:bg-[#0C1E2C] hover:border-[#00E5FF]/40'
        }`}
        title={isSatellite ? 'Switch to Map view' : 'Switch to Satellite view'}
      >
        {isSatellite ? <MapIcon size={16} /> : <Satellite size={16} />}
        <span className="text-xs">{isSatellite ? 'Map' : 'Satellite'}</span>
      </button>
    </div>
  );
}
