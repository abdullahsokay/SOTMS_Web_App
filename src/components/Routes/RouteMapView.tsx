import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { GoogleMap, Marker, Polyline, Circle, OverlayView } from '@react-google-maps/api';
import { Route, Tanker, BlackSpot, Geofence, GeofenceType, GeofenceAlertOn } from '../../types';
import { TrackingStore } from '../../types/tracking';
import { Layers, List, AlertTriangle, MapPin, Eye, EyeOff, Target, Trash2, Navigation, ChevronDown, ChevronUp, Info, Search, Loader2, MousePointer, Route as RouteIcon, Shield, X, Save, Truck, Zap, GripVertical, PenTool, Satellite, Map as MapIcon } from 'lucide-react';
import { useGoogleMaps } from '../../contexts/GoogleMapsContext';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { darkMapStyle, containerStyle, defaultCenter, getMarkerIcon } from '../../utils/mapUtils';
import { AnimatedVehicleMarker } from '../Map/AnimatedVehicleMarker';
import { PlacesAutocompleteInput } from './PlacesAutocompleteInput';
import { AddPointModal } from './AddPointModal';
import { BlackSpotModal } from './BlackSpotModal';
import { GeofenceModal } from './GeofenceModal';

const threatColors: Record<string, string> = {
  high: '#FF4D4D',
  medium: '#FFB02E',
  low: '#FFD93D'
};

// Threat radius by level (meters)
const threatRadius: Record<string, number> = {
  high: 2000,
  medium: 1000,
  low: 500,
};

// Geofence type colors
const geofenceTypeColors: Record<GeofenceType, string> = {
  restricted_zone: '#FF4D4D',
  safe_zone: '#28B463',
  checkpoint: '#FFB02E',
  depot: '#9B59B6',
  delivery_zone: '#009FFD',
};

// Geofence type icons
const geofenceTypeIcons: Record<GeofenceType, string> = {
  restricted_zone: '🚫',
  safe_zone: '🛡️',
  checkpoint: '📍',
  depot: '🏭',
  delivery_zone: '📦',
};

// Alternative route colors
const ALT_ROUTE_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899'];
const DEVIATION_THRESHOLD_METERS = 500;

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

/** Minimum distance from a point to any point along a path (meters) */
function minDistToPath(lat: number, lng: number, path: Array<{ lat: number; lng: number }>): number {
  let min = Infinity;
  for (const p of path) {
    const d = distanceKm(lat, lng, p.lat, p.lng) * 1000;
    if (d < min) min = d;
  }
  return min;
}

// SVG marker helpers
const makeCircleMarker = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="${color}" stroke="white" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const makeWarningMarker = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <path d="M14 8 L10 18 L18 18 Z" fill="white"/>
    <circle cx="14" cy="16" r="1" fill="${color}"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const makePinMarker = (color: string, label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="16" y="19" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="Arial">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Planned route type
interface PlannedRoute {
  path: Array<{ lat: number; lng: number }>;
  distance: string;
  duration: string;
  distanceValue: number;
  durationValue: number;
  summary: string;
}

interface RouteMapViewProps {
  routes: Route[];
  selectedRoute: Route | null;
  onSelectRoute: (route: Route) => void;
  tankers: Tanker[];
  blackSpots: BlackSpot[];
  showBlackSpots: boolean;
  onToggleBlackSpots: (show: boolean) => void;
  onToggleRouteList: () => void;
  showRouteList: boolean;
  positionHistory?: Array<{ lat: number; lng: number; timestamp: number }>;
  onUpdateRoute?: (route: Route) => void;
  trackingData?: TrackingStore;
  onSaveRoute?: (routeData: Partial<Route>) => void;
  onAssignRoute?: () => void;
}

export function RouteMapView({
  routes,
  selectedRoute,
  onSelectRoute,
  tankers,
  blackSpots,
  showBlackSpots,
  onToggleBlackSpots,
  onToggleRouteList,
  showRouteList,
  positionHistory = [],
  onUpdateRoute,
  trackingData = {},
  onSaveRoute,
  onAssignRoute,
}: RouteMapViewProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const [showTraffic, setShowTraffic] = useState(false);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'denied' | 'limit'>('unknown');

  // Legend collapsible state
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendSections, setLegendSections] = useState<Record<string, boolean>>({
    points: true,
    geofences: false,
    routes: false,
  });

  // Traffic layer toggle
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

  // Satellite / dark map toggle
  useEffect(() => {
    if (!map) return;
    if (isSatellite) {
      map.setMapTypeId(google.maps.MapTypeId.HYBRID);
      map.setOptions({ styles: [] });
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      map.setOptions({ styles: darkMapStyle });
    }
  }, [map, isSatellite]);

  // Geofence state
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [newGeofenceRadius] = useState(5000);
  const [showGeofences, setShowGeofences] = useState(true);
  const [toolPanelCollapsed, setToolPanelCollapsed] = useState(false);

  // Geofence modal state
  const [pendingGeofence, setPendingGeofence] = useState<{ lat: number; lng: number } | null>(null);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);

  // Geofence breach tracking
  const geofenceBreachRef = useRef<Map<string, Set<string>>>(new Map());

  // Route Planning state
  const [pointAAddress, setPointAAddress] = useState('');
  const [pointA, setPointA] = useState<{ lat: number; lng: number } | null>(null);
  const [pointBAddress, setPointBAddress] = useState('');
  const [pointB, setPointB] = useState<{ lat: number; lng: number } | null>(null);
  const [plannedRoutes, setPlannedRoutes] = useState<PlannedRoute[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);

  // Interaction mode for map click
  const [interactionMode, setInteractionMode] = useState<'none' | 'selectPointA' | 'selectPointB' | 'addBlackSpot' | 'addGeofence' | 'addPoint' | 'editRoute'>('none');

  // Route corridor geofence
  const [showRouteCorridorGeofence, setShowRouteCorridorGeofence] = useState(true);
  const [corridorRadius] = useState(500); // 500m corridor

  // Route deviation state
  const [deviatingTankers, setDeviatingTankers] = useState<Map<string, number>>(new Map());

  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Add Point state
  const [pendingWaypoint, setPendingWaypoint] = useState<{ lat: number; lng: number } | null>(null);
  const [showAddPointModal, setShowAddPointModal] = useState(false);

  // Black Spot state
  const [pendingBlackSpot, setPendingBlackSpot] = useState<{ lat: number; lng: number } | null>(null);
  const [showBlackSpotModal, setShowBlackSpotModal] = useState(false);

  // Route saving state
  const [saveRouteName, setSaveRouteName] = useState('');
  const [showSaveRouteForm, setShowSaveRouteForm] = useState(false);
  const [quickAssignTankerId, setQuickAssignTankerId] = useState('');

  // Planned route waypoints
  const [plannedWaypoints, setPlannedWaypoints] = useState<Array<{ lat: number; lng: number; address: string }>>([]);

  const onLoad = useCallback((map: google.maps.Map) => { setMap(map); }, []);
  const onUnmount = useCallback(() => { setMap(null); }, []);

  // Initialize services + probe Directions API status
  useEffect(() => {
    if (!isLoaded) return;
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    // Quick probe: Karachi → Lahore to check if Directions API is enabled
    directionsServiceRef.current.route(
      {
        origin: new google.maps.LatLng(24.8607, 67.0011),
        destination: new google.maps.LatLng(31.5204, 74.3587),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (_result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setApiStatus('ok');
        } else if (status === 'REQUEST_DENIED') {
          setApiStatus('denied');
        } else if (status === 'OVER_QUERY_LIMIT') {
          setApiStatus('limit');
        } else {
          setApiStatus('ok'); // ZERO_RESULTS etc. still means API is enabled
        }
      }
    );
  }, [isLoaded]);

  // Hovered route index (for polyline hover effect)
  const [hoveredRouteIndex, setHoveredRouteIndex] = useState<number | null>(null);

  // Calculate routes between Point A and Point B
  const calculateRoutes = useCallback(() => {
    console.log('[RouteMapView] calculateRoutes called', { pointA, pointB, isLoaded, hasService: !!directionsServiceRef.current });

    if (!pointA || !pointB) {
      console.warn('[RouteMapView] Missing points, skipping', { pointA, pointB });
      return;
    }

    // Ensure DirectionsService is created
    if (!directionsServiceRef.current && isLoaded) {
      console.log('[RouteMapView] Creating DirectionsService...');
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
    if (!directionsServiceRef.current) {
      console.warn('[RouteMapView] DirectionsService not available, isLoaded:', isLoaded);
      return;
    }

    setIsCalculatingRoutes(true);
    setRouteError(null);
    setPlannedRoutes([]);

    console.log('[RouteMapView] Calling Directions API:', { origin: pointA, destination: pointB });

    directionsServiceRef.current.route(
      {
        origin: new google.maps.LatLng(pointA.lat, pointA.lng),
        destination: new google.maps.LatLng(pointB.lat, pointB.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      },
      (result, status) => {
        setIsCalculatingRoutes(false);
        console.log('[RouteMapView] Directions API response:', status, result ? `${result.routes.length} routes` : 'no result');

        if (status === google.maps.DirectionsStatus.OK && result) {
          const routes = result.routes.map(route => ({
            path: route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() })),
            distance: route.legs[0].distance?.text || '',
            duration: route.legs[0].duration?.text || '',
            distanceValue: route.legs[0].distance?.value || 0,
            durationValue: route.legs[0].duration?.value || 0,
            summary: route.summary || '',
          }));

          // Sort by duration — fastest first
          routes.sort((a, b) => a.durationValue - b.durationValue);

          console.log('[RouteMapView] Routes found:', routes.map(r => `${r.summary} (${r.duration}, ${r.distance})`));

          setPlannedRoutes(routes);
          setSelectedPlanIndex(0);

          // Fit map bounds to show all routes
          if (map) {
            const bounds = new google.maps.LatLngBounds();
            routes.forEach(r => r.path.forEach(p => bounds.extend(p)));
            map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 380 });
          }
        } else {
          console.error('[RouteMapView] Directions API failed:', status, result);
          if (status === 'REQUEST_DENIED') {
            setRouteError('Directions API access denied. Ensure the Directions API is enabled and billing is active in Google Cloud Console.');
          } else if (status === 'OVER_QUERY_LIMIT') {
            setRouteError('Rate limit exceeded. Please wait a moment and try again.');
          } else if (status === 'ZERO_RESULTS') {
            setRouteError('No driving route found between these two locations.');
          } else {
            setRouteError(`Route calculation failed: ${status}`);
          }
        }
      }
    );
  }, [pointA, pointB, map, isLoaded]);

  // Auto-calculate routes when both locations are selected
  useEffect(() => {
    console.log('[RouteMapView] Auto-calc effect:', { pointA: !!pointA, pointB: !!pointB, isLoaded });
    if (!pointA || !pointB) {
      setPlannedRoutes([]);
      setHoveredRouteIndex(null);
      return;
    }
    // Both points exist – auto-calculate routes after a short delay
    console.log('[RouteMapView] Both points set, scheduling auto-calculate in 500ms...');
    const timer = setTimeout(() => {
      console.log('[RouteMapView] Auto-calculating now...');
      calculateRoutes();
    }, 500);
    return () => clearTimeout(timer);
  }, [pointA, pointB, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reverse geocode a position to address
  const reverseGeocode = useCallback((position: { lat: number; lng: number }, callback: (address: string) => void) => {
    if (!geocoderRef.current) return;
    geocoderRef.current.geocode({ location: position }, (results, status) => {
      if (status === 'OK' && results?.[0]) {
        callback(results[0].formatted_address);
      }
    });
  }, []);

  // Add Point: recalculate full route path through all waypoints
  const recalculateRoutePath = useCallback((route: Route, newWaypoints: Route['waypoints']) => {
    if (!directionsServiceRef.current) return;

    const allPoints = [
      route.startLocation,
      ...newWaypoints.map(wp => ({ lat: wp.lat, lng: wp.lng })),
      route.endLocation,
    ];

    if (allPoints.length < 2) return;

    const origin = allPoints[0];
    const destination = allPoints[allPoints.length - 1];
    const waypoints = allPoints.slice(1, -1).map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      stopover: true,
    }));

    directionsServiceRef.current.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const path = result.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
          let totalDist = 0;
          let totalDur = 0;
          result.routes[0].legs.forEach(leg => {
            totalDist += Math.round((leg.distance?.value || 0) / 1000);
            totalDur += Math.round((leg.duration?.value || 0) / 60);
          });

          const updatedRoute: Route = {
            ...route,
            waypoints: newWaypoints,
            routePath: path,
            distance: totalDist,
            estimatedDuration: totalDur,
          };

          if (onUpdateRoute) {
            onUpdateRoute(updatedRoute);
          }
        }
      }
    );
  }, [onUpdateRoute]);

  // Handle confirming an added waypoint
  const handleConfirmAddPoint = useCallback((waypointData: { name: string; type: 'waypoint' | 'stop' | 'delivery' }) => {
    if (!pendingWaypoint || !selectedRoute) return;

    const newWaypoint = {
      lat: pendingWaypoint.lat,
      lng: pendingWaypoint.lng,
      name: waypointData.name,
      type: waypointData.type,
    };

    const updatedWaypoints = [...(selectedRoute.waypoints ?? []), newWaypoint];
    recalculateRoutePath(selectedRoute, updatedWaypoints);

    setPendingWaypoint(null);
    setShowAddPointModal(false);
    setInteractionMode('none');
  }, [pendingWaypoint, selectedRoute, recalculateRoutePath]);

  // Handle saving a new black spot
  const handleSaveBlackSpot = useCallback(async (data: {
    name: string;
    description: string;
    threatLevel: 'low' | 'medium' | 'high';
    confidenceLevel: 'low' | 'medium' | 'high';
    notes: string;
  }) => {
    if (!pendingBlackSpot) return;
    try {
      await addDoc(collection(db, 'blackspots'), {
        name: data.name,
        description: data.description,
        location: { lat: pendingBlackSpot.lat, lng: pendingBlackSpot.lng },
        threatLevel: data.threatLevel,
        confidenceLevel: data.confidenceLevel,
        notes: data.notes || undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[RouteMapView] Error saving black spot:', err);
    }
    setPendingBlackSpot(null);
    setShowBlackSpotModal(false);
    setInteractionMode('none');
  }, [pendingBlackSpot]);

  // Fetch saved geofences from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'geofences'), (snap) => {
      const data = snap.docs.map(d => {
        const raw = d.data();
        return {
          id: d.id,
          name: raw.name || 'Unnamed',
          center: raw.center,
          radius: raw.radius || 5000,
          type: raw.type || 'checkpoint',
          alertOn: raw.alertOn || 'both',
          color: raw.color || '#00E5FF',
          active: raw.active !== false,
          createdAt: raw.createdAt || '',
          notes: raw.notes,
        } as Geofence;
      });
      setGeofences(data);
    });
    return () => unsub();
  }, []);

  // ESC key to cancel any mode or pending modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInteractionMode('none');
        setPendingWaypoint(null);
        setShowAddPointModal(false);
        setPendingBlackSpot(null);
        setShowBlackSpotModal(false);
        setPendingGeofence(null);
        setShowGeofenceModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Geofence breach detection
  useEffect(() => {
    if (geofences.length === 0 || tankers.length === 0) return;

    tankers.forEach(tanker => {
      if (tanker.location.lat === 0 && tanker.location.lng === 0) return;

      const prevBreaches = geofenceBreachRef.current.get(tanker.id) || new Set<string>();
      const currentBreaches = new Set<string>();

      geofences.forEach(gf => {
        if (!gf.active) return;
        const dist = distanceKm(tanker.location.lat, tanker.location.lng, gf.center.lat, gf.center.lng) * 1000;
        const inside = dist <= gf.radius;

        if (inside) currentBreaches.add(gf.id);

        if (inside && !prevBreaches.has(gf.id) && (gf.alertOn === 'entry' || gf.alertOn === 'both')) {
          console.log(`[Geofence] ENTRY: ${tanker.id} entered "${gf.name}" (${gf.type})`);
        }
        if (!inside && prevBreaches.has(gf.id) && (gf.alertOn === 'exit' || gf.alertOn === 'both')) {
          console.log(`[Geofence] EXIT: ${tanker.id} exited "${gf.name}" (${gf.type})`);
        }
      });

      geofenceBreachRef.current.set(tanker.id, currentBreaches);
    });
  }, [tankers, geofences]);

  // Route deviation detection
  useEffect(() => {
    if (!selectedRoute || !selectedRoute.routePath || selectedRoute.routePath.length === 0) {
      setDeviatingTankers(new Map());
      return;
    }

    const newDeviating = new Map<string, number>();
    tankers.forEach(tanker => {
      if (tanker.location.lat === 0 && tanker.location.lng === 0) return;
      const dist = minDistToPath(tanker.location.lat, tanker.location.lng, selectedRoute.routePath!);
      if (dist > DEVIATION_THRESHOLD_METERS) {
        newDeviating.set(tanker.id, Math.round(dist));
        console.log(`[Deviation] ${tanker.id} is ${Math.round(dist)}m off route "${selectedRoute.name}"`);
      }
    });

    setDeviatingTankers(newDeviating);
  }, [tankers, selectedRoute]);

  // ONE-TIME initial fit: fleet overview showing all tankers + routes
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    if (!map || initialFitDoneRef.current) return;
    const validTankers = tankers.filter(t => t.location.lat !== 0 || t.location.lng !== 0);
    // Also include RTDB-only vehicles
    const rtdbPositions = Object.values(trackingData)
      .filter(td => td.current && td.current.lat !== 0)
      .map(td => ({ lat: td.current.lat, lng: td.current.lng }));

    const hasPoints = validTankers.length > 0 || routes.length > 0 || rtdbPositions.length > 0;
    if (!hasPoints) return;

    initialFitDoneRef.current = true;
    const bounds = new google.maps.LatLngBounds();
    validTankers.forEach(t => bounds.extend({ lat: t.location.lat, lng: t.location.lng }));
    rtdbPositions.forEach(p => bounds.extend(p));
    routes.forEach(r => {
      bounds.extend(r.startLocation);
      bounds.extend(r.endLocation);
    });
    map.fitBounds(bounds, 60);
  }, [map, tankers, routes, trackingData]);

  // Fit bounds when a specific route is selected
  useEffect(() => {
    if (!map || !selectedRoute) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(selectedRoute.startLocation);
    bounds.extend(selectedRoute.endLocation);
    (selectedRoute.waypoints ?? []).forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }));
    tankers.forEach(t => {
      if (t.location.lat !== 0 || t.location.lng !== 0) {
        bounds.extend({ lat: t.location.lat, lng: t.location.lng });
      }
    });
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, "idle", () => {
      if (map.getZoom()! > 14) map.setZoom(14);
    });
  }, [map, selectedRoute]);

  // Handle map click for all interaction modes
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng || interactionMode === 'none') return;
    const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };

    if (interactionMode === 'selectPointA') {
      setPointA(point);
      reverseGeocode(point, (address) => setPointAAddress(address));
      setInteractionMode('none');
      return;
    }
    if (interactionMode === 'selectPointB') {
      setPointB(point);
      reverseGeocode(point, (address) => setPointBAddress(address));
      setInteractionMode('none');
      return;
    }
    if (interactionMode === 'addBlackSpot') {
      setPendingBlackSpot(point);
      setShowBlackSpotModal(true);
      setInteractionMode('none');
      return;
    }
    if (interactionMode === 'addGeofence') {
      setPendingGeofence(point);
      setShowGeofenceModal(true);
      setInteractionMode('none');
      return;
    }
    if (interactionMode === 'addPoint' && selectedRoute) {
      setPendingWaypoint(point);
      setShowAddPointModal(true);
      setInteractionMode('none');
      return;
    }
  }, [interactionMode, reverseGeocode, selectedRoute]);

  // Save geofence from modal
  const handleSaveGeofence = useCallback(async (data: {
    name: string;
    type: GeofenceType;
    alertOn: GeofenceAlertOn;
    radius: number;
    color: string;
    notes: string;
  }) => {
    if (!pendingGeofence) return;
    try {
      await addDoc(collection(db, 'geofences'), {
        center: pendingGeofence,
        radius: data.radius,
        name: data.name,
        type: data.type,
        alertOn: data.alertOn,
        color: data.color,
        active: true,
        notes: data.notes || undefined,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[RouteMapView] Error saving geofence:', err);
    }
    setPendingGeofence(null);
    setShowGeofenceModal(false);
  }, [pendingGeofence]);

  const handleDeleteGeofence = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'geofences', id));
    } catch (err) {
      console.error('[RouteMapView] Error deleting geofence:', err);
    }
  };

  const handleDeleteBlackSpot = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'blackspots', id));
    } catch (err) {
      console.error('[RouteMapView] Error deleting black spot:', err);
    }
  };

  // Clear all map tool items
  const clearAllMapTools = useCallback(async () => {
    // Delete all geofences
    for (const gf of geofences) {
      try { await deleteDoc(doc(db, 'geofences', gf.id)); } catch {}
    }
    // Delete all black spots
    for (const bs of blackSpots) {
      try { await deleteDoc(doc(db, 'blackspots', bs.id)); } catch {}
    }
    setInteractionMode('none');
  }, [geofences, blackSpots]);

  // Route corridor points for auto-geofence visualization (sampled every Nth point)
  const corridorPoints = useMemo(() => {
    if (!selectedRoute?.routePath || selectedRoute.routePath.length === 0) return [];
    const path = selectedRoute.routePath;
    const step = Math.max(1, Math.floor(path.length / 30)); // sample ~30 points
    const points: Array<{ lat: number; lng: number }> = [];
    for (let i = 0; i < path.length; i += step) {
      points.push(path[i]);
    }
    if (points[points.length - 1] !== path[path.length - 1]) {
      points.push(path[path.length - 1]);
    }
    return points;
  }, [selectedRoute]);

  const clearRoutePlan = useCallback(() => {
    setPointA(null);
    setPointB(null);
    setPointAAddress('');
    setPointBAddress('');
    setPlannedRoutes([]);
    setSelectedPlanIndex(0);
    setPlannedWaypoints([]);
    setSaveRouteName('');
    setShowSaveRouteForm(false);
    setQuickAssignTankerId('');
    // Reset map to zoomed-out country view
    if (map) {
      map.setCenter(defaultCenter);
      map.setZoom(5);
    }
  }, [map]);

  // Save planned route as a new route in Firestore
  const handleSavePlannedRoute = useCallback(() => {
    if (!pointA || !pointB || plannedRoutes.length === 0 || !saveRouteName.trim()) return;
    const selected = plannedRoutes[selectedPlanIndex];
    if (!selected) return;

    const routeData: Partial<Route> = {
      name: saveRouteName.trim(),
      company: 'PSO',
      startLocation: { lat: pointA.lat, lng: pointA.lng, address: pointAAddress },
      endLocation: { lat: pointB.lat, lng: pointB.lng, address: pointBAddress },
      waypoints: plannedWaypoints.map((wp, i) => ({
        lat: wp.lat,
        lng: wp.lng,
        name: wp.address || `Waypoint ${i + 1}`,
        type: 'stop' as const,
      })),
      routePath: selected.path,
      distance: parseFloat(selected.distance) || 0,
      estimatedDuration: Math.round(selected.durationValue / 60),
      status: 'unassigned',
      routeType: 'delivery',
      geofenceRadius: 500,
      blackSpots: [],
      assignedTanker: quickAssignTankerId || undefined,
      assignedDriver: undefined,
      createdAt: new Date().toISOString(),
    };

    if (quickAssignTankerId) {
      routeData.status = 'active';
    }

    if (onSaveRoute) {
      onSaveRoute(routeData);
      clearRoutePlan();
    }
  }, [pointA, pointB, plannedRoutes, selectedPlanIndex, saveRouteName, pointAAddress, pointBAddress, plannedWaypoints, quickAssignTankerId, onSaveRoute, clearRoutePlan]);

  // Optimize waypoints — simple nearest-neighbor reordering
  const handleOptimizeWaypoints = useCallback(() => {
    if (plannedWaypoints.length < 2 || !pointA) return;
    const remaining = [...plannedWaypoints];
    const ordered: typeof plannedWaypoints = [];
    let current = pointA;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = distanceKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      ordered.push(remaining[nearestIdx]);
      current = remaining[nearestIdx];
      remaining.splice(nearestIdx, 1);
    }
    setPlannedWaypoints(ordered);
  }, [plannedWaypoints, pointA]);

  // Remove a planned waypoint
  const handleRemovePlannedWaypoint = useCallback((index: number) => {
    setPlannedWaypoints(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Available tankers for quick assign (unassigned ones)
  const availableTankers = useMemo(() => {
    const assignedIds = new Set(routes.filter(r => r.assignedTanker && r.status === 'active').map(r => r.assignedTanker));
    return tankers.filter(t => !assignedIds.has(t.id));
  }, [tankers, routes]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-[#07121A] text-red-500 p-4">
        <div className="text-center">
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

  // Behavior: If selected route is assigned, show only that route; otherwise show all
  const displayedRoutes = (selectedRoute && selectedRoute.assignedTanker && selectedRoute.status !== 'unassigned')
    ? routes.filter(r => r.id === selectedRoute.id)
    : routes;

  return (
    <div className="relative h-full bg-[#07121A] overflow-hidden">
      {/* Google Map */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={5}
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
          draggableCursor: interactionMode !== 'none' ? 'crosshair' : undefined,
        }}
      >
        {/* Routes as Polylines */}
        {displayedRoutes.map(route => {
          const isSelected = selectedRoute?.id === route.id;
          const isAssigned = !!route.assignedTanker && route.status !== 'unassigned';
          const path = route.routePath && route.routePath.length > 0
            ? route.routePath
            : [
                { lat: route.startLocation.lat, lng: route.startLocation.lng },
                ...(route.waypoints ?? []).map(wp => ({ lat: wp.lat, lng: wp.lng })),
                { lat: route.endLocation.lat, lng: route.endLocation.lng }
              ];

          return (
            <Fragment key={route.id}>
              {/* Route path */}
              <Polyline
                path={path}
                options={{
                  strokeColor: isSelected ? '#28B463' : isAssigned ? '#FF9800' : '#009FFD',
                  strokeOpacity: isSelected ? 1 : isAssigned ? 0.85 : 0.6,
                  strokeWeight: isSelected ? 4 : isAssigned ? 3.5 : 3,
                  clickable: true,
                  editable: isSelected && interactionMode === 'editRoute',
                  draggable: isSelected && interactionMode === 'editRoute',
                }}
                onClick={() => onSelectRoute(route)}
              />

              {/* Start marker (green) */}
              <Marker
                position={route.startLocation}
                icon={{
                  url: makeCircleMarker('#28B463'),
                  scaledSize: new google.maps.Size(16, 16),
                  anchor: new google.maps.Point(8, 8),
                }}
                title={`Start: ${route.startLocation.address}`}
                onClick={() => onSelectRoute(route)}
              />

              {/* End marker (red) */}
              <Marker
                position={route.endLocation}
                icon={{
                  url: makeCircleMarker('#FF4D4D'),
                  scaledSize: new google.maps.Size(16, 16),
                  anchor: new google.maps.Point(8, 8),
                }}
                title={`End: ${route.endLocation.address}`}
                onClick={() => onSelectRoute(route)}
              />

              {/* Waypoints */}
              {(route.waypoints ?? []).map((wp, i) => {
                const wpColor = wp.type === 'delivery' ? '#FFB02E' : wp.type === 'stop' ? '#9B59B6' : '#00E5FF';
                return (
                  <Marker
                    key={`wp-${route.id}-${i}`}
                    position={{ lat: wp.lat, lng: wp.lng }}
                    icon={{
                      url: makeCircleMarker(wpColor),
                      scaledSize: new google.maps.Size(12, 12),
                      anchor: new google.maps.Point(6, 6),
                    }}
                    title={wp.name || `Waypoint ${i + 1}`}
                  />
                );
              })}

              {/* Assigned badge at route midpoint */}
              {isAssigned && !isSelected && (() => {
                const allPoints = [
                  route.startLocation,
                  ...(route.waypoints ?? []).map(wp => ({ lat: wp.lat, lng: wp.lng })),
                  route.endLocation
                ];
                const midpoint = allPoints[Math.floor(allPoints.length / 2)];
                return (
                  <OverlayView
                    position={midpoint}
                    mapPaneName="floatPane"
                    getPixelPositionOffset={(w) => ({ x: -(w / 2), y: -12 })}
                  >
                    <div className="bg-[#FF9800]/90 border border-[#FF9800] rounded-full px-2 py-0.5 flex items-center gap-1 pointer-events-none whitespace-nowrap">
                      <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      <span className="text-[9px] text-white font-bold">
                        {route.assignedTanker}
                      </span>
                    </div>
                  </OverlayView>
                );
              })()}

              {/* Tanker icon at route start for assigned routes */}
              {isAssigned && (
                <Marker
                  position={route.startLocation}
                  icon={{
                    url: getMarkerIcon('moving', 0),
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16),
                  }}
                  title={`${route.assignedTanker} — ${route.assignedDriver || 'Unassigned'}`}
                  onClick={() => onSelectRoute(route)}
                />
              )}

              {/* Route geofence (from route's geofenceRadius) */}
              {isSelected && route.geofenceRadius > 0 && (
                <>
                  <Circle
                    center={route.startLocation}
                    radius={route.geofenceRadius}
                    options={{
                      strokeColor: '#28B463',
                      strokeOpacity: 0.4,
                      strokeWeight: 1,
                      fillColor: '#28B463',
                      fillOpacity: 0.06,
                    }}
                  />
                  <Circle
                    center={route.endLocation}
                    radius={route.geofenceRadius}
                    options={{
                      strokeColor: '#FF4D4D',
                      strokeOpacity: 0.4,
                      strokeWeight: 1,
                      fillColor: '#FF4D4D',
                      fillOpacity: 0.06,
                    }}
                  />
                </>
              )}

              {/* Auto-geofence corridor around selected route */}
              {isSelected && showRouteCorridorGeofence && corridorPoints.map((pt, i) => (
                <Circle
                  key={`corridor-${i}`}
                  center={pt}
                  radius={corridorRadius}
                  options={{
                    strokeColor: '#3B82F6',
                    strokeOpacity: 0.15,
                    strokeWeight: 1,
                    fillColor: '#3B82F6',
                    fillOpacity: 0.04,
                    clickable: false,
                  }}
                />
              ))}
            </Fragment>
          );
        })}

        {/* Planned route alternatives — render non-selected first, selected on top */}
        {plannedRoutes.map((route, i) => {
          const isSelected = i === selectedPlanIndex;
          const isHovered = i === hoveredRouteIndex;
          const color = isSelected ? '#22C55E' : (ALT_ROUTE_COLORS[i % ALT_ROUTE_COLORS.length] || '#6B7280');
          return (
            <Fragment key={`planned-group-${i}`}>
              {/* Invisible wider polyline for easier clicking */}
              <Polyline
                path={route.path}
                options={{
                  strokeColor: color,
                  strokeOpacity: 0,
                  strokeWeight: 20,
                  clickable: true,
                  zIndex: isSelected ? 11 : 4,
                }}
                onClick={() => setSelectedPlanIndex(i)}
                onMouseOver={() => setHoveredRouteIndex(i)}
                onMouseOut={() => setHoveredRouteIndex(null)}
              />
              {/* Visible polyline */}
              <Polyline
                path={route.path}
                options={{
                  strokeColor: color,
                  strokeOpacity: isSelected ? 1 : isHovered ? 0.8 : 0.45,
                  strokeWeight: isSelected ? 6 : isHovered ? 5 : 3,
                  clickable: false,
                  zIndex: isSelected ? 10 : isHovered ? 8 : 5,
                }}
              />
              {/* Glow effect for selected route */}
              {isSelected && (
                <Polyline
                  path={route.path}
                  options={{
                    strokeColor: '#22C55E',
                    strokeOpacity: 0.25,
                    strokeWeight: 12,
                    clickable: false,
                    zIndex: 9,
                  }}
                />
              )}
            </Fragment>
          );
        })}

        {/* Point A marker */}
        {pointA && (
          <Marker
            position={pointA}
            icon={{
              url: makePinMarker('#22C55E', 'A'),
              scaledSize: new google.maps.Size(32, 40),
              anchor: new google.maps.Point(16, 40),
            }}
            title={`Point A: ${pointAAddress}`}
            draggable
            onDragEnd={(e) => {
              if (e.latLng) {
                const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                setPointA(pos);
                reverseGeocode(pos, setPointAAddress);
              }
            }}
          />
        )}

        {/* Point B marker */}
        {pointB && (
          <Marker
            position={pointB}
            icon={{
              url: makePinMarker('#EF4444', 'B'),
              scaledSize: new google.maps.Size(32, 40),
              anchor: new google.maps.Point(16, 40),
            }}
            title={`Point B: ${pointBAddress}`}
            draggable
            onDragEnd={(e) => {
              if (e.latLng) {
                const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                setPointB(pos);
                reverseGeocode(pos, setPointBAddress);
              }
            }}
          />
        )}

        {/* Planned waypoint markers */}
        {plannedWaypoints.map((wp, i) => (
          <Marker
            key={`planned-wp-${i}`}
            position={{ lat: wp.lat, lng: wp.lng }}
            icon={{
              url: makePinMarker('#F59E0B', String(i + 1)),
              scaledSize: new google.maps.Size(28, 35),
              anchor: new google.maps.Point(14, 35),
            }}
            title={wp.address || `Waypoint ${i + 1}`}
            draggable
            onDragEnd={(e) => {
              if (e.latLng) {
                const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                setPlannedWaypoints(prev => prev.map((w, idx) =>
                  idx === i ? { ...w, lat: pos.lat, lng: pos.lng } : w
                ));
                reverseGeocode(pos, (address) => {
                  setPlannedWaypoints(prev => prev.map((w, idx) =>
                    idx === i ? { ...w, address } : w
                  ));
                });
              }
            }}
          />
        ))}

        {/* Green route trail — full traveled path from Firebase history */}
        {positionHistory.length > 1 && (
          <Polyline
            path={positionHistory.map(p => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor: '#00FF00',
              strokeOpacity: 0.9,
              strokeWeight: 5,
            }}
          />
        )}

        {/* Tanker markers: animated when RTDB data exists, else static */}
        {tankers.filter(t => t.location.lat !== 0 || t.location.lng !== 0).map(tanker => {
          const isDeviating = deviatingTankers.has(tanker.id);
          if (trackingData[tanker.id]) {
            return (
              <Fragment key={`rtdb-${tanker.id}`}>
                <AnimatedVehicleMarker data={trackingData[tanker.id]} />
                {isDeviating && (
                  <Circle
                    center={{ lat: trackingData[tanker.id].current.lat, lng: trackingData[tanker.id].current.lng }}
                    radius={150}
                    options={{
                      strokeColor: '#FF4D4D',
                      strokeOpacity: 0.9,
                      strokeWeight: 2,
                      fillColor: '#FF4D4D',
                      fillOpacity: 0.15,
                    }}
                  />
                )}
              </Fragment>
            );
          }
          return (
            <Fragment key={`tanker-${tanker.id}`}>
              <Marker
                position={{ lat: tanker.location.lat, lng: tanker.location.lng }}
                icon={{
                  url: getMarkerIcon(tanker.status, tanker.bearing ?? 0),
                  scaledSize: new google.maps.Size(48, 48),
                  anchor: new google.maps.Point(24, 24),
                }}
                title={`${tanker.id} - ${tanker.status} - ${tanker.speed} km/h${isDeviating ? ' ⚠ DEVIATING' : ''}`}
                zIndex={999}
              />
              {isDeviating && (
                <Circle
                  center={{ lat: tanker.location.lat, lng: tanker.location.lng }}
                  radius={150}
                  options={{
                    strokeColor: '#FF4D4D',
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    fillColor: '#FF4D4D',
                    fillOpacity: 0.15,
                  }}
                />
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

        {/* Black Spots */}
        {showBlackSpots && blackSpots.map(spot => {
          const spotColor = threatColors[spot.threatLevel] || '#FFB02E';
          const spotRadius = threatRadius[spot.threatLevel] || 500;
          return (
            <Fragment key={`bs-${spot.id}`}>
              <Marker
                position={spot.location}
                icon={{
                  url: makeWarningMarker(spotColor),
                  scaledSize: new google.maps.Size(28, 28),
                  anchor: new google.maps.Point(14, 14),
                }}
                title={`${spot.name} - ${spot.threatLevel} threat`}
              />
              <Circle
                center={spot.location}
                radius={spotRadius}
                options={{
                  strokeColor: spotColor,
                  strokeOpacity: 0.3,
                  strokeWeight: 1,
                  fillColor: spotColor,
                  fillOpacity: spot.threatLevel === 'high' ? 0.1 : 0.06,
                }}
              />
              <OverlayView
                position={spot.location}
                mapPaneName="floatPane"
                getPixelPositionOffset={(w) => ({ x: -(w / 2), y: 18 })}
              >
                <div className="bg-[#0C1E2C]/90 border rounded-lg px-2 py-1 flex items-center gap-2 pointer-events-auto whitespace-nowrap" style={{ borderColor: `${spotColor}60` }}>
                  <span className="text-[10px] font-mono" style={{ color: spotColor }}>{spot.name}</span>
                  <span className="text-[9px] text-[#D9DCE1]/40 capitalize">{spot.threatLevel}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteBlackSpot(spot.id); }}
                    className="text-[#FF4D4D] hover:text-red-400 transition-colors"
                    title="Delete black spot"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </OverlayView>
            </Fragment>
          );
        })}

        {/* User-drawn Geofences */}
        {showGeofences && geofences.map(gf => {
          const gfColor = gf.color || geofenceTypeColors[gf.type] || '#00E5FF';
          const gfIcon = geofenceTypeIcons[gf.type] || '📍';
          const isRestricted = gf.type === 'restricted_zone';

          let tankerInside = false;
          tankers.forEach(t => {
            if (t.location.lat === 0 && t.location.lng === 0) return;
            const dist = distanceKm(t.location.lat, t.location.lng, gf.center.lat, gf.center.lng) * 1000;
            if (dist <= gf.radius) tankerInside = true;
          });

          return (
            <Fragment key={`gf-${gf.id}`}>
              <Circle
                center={gf.center}
                radius={gf.radius}
                options={{
                  strokeColor: gfColor,
                  strokeOpacity: isRestricted ? 0.9 : 0.7,
                  strokeWeight: 2,
                  fillColor: gfColor,
                  fillOpacity: isRestricted ? 0.15 : 0.08,
                  editable: true,
                  draggable: true,
                }}
              />
              <OverlayView
                position={gf.center}
                mapPaneName="floatPane"
                getPixelPositionOffset={(w) => ({ x: -(w / 2), y: -30 })}
              >
                <div
                  className="bg-[#0C1E2C]/90 border rounded-lg px-2.5 py-1.5 flex items-center gap-2 pointer-events-auto"
                  style={{ borderColor: `${gfColor}70` }}
                >
                  <span className="text-xs">{gfIcon}</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium" style={{ color: gfColor }}>{gf.name}</span>
                    <span className="text-[9px] text-[#D9DCE1]/40">
                      {gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)}km` : `${gf.radius}m`}
                      {' · '}
                      {gf.alertOn === 'both' ? 'Entry/Exit' : gf.alertOn === 'entry' ? 'Entry' : 'Exit'}
                    </span>
                  </div>
                  {tankerInside && (
                    <div className="w-2 h-2 rounded-full bg-[#28B463] animate-pulse" title="Vehicle inside" />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(gf.id); }}
                    className="text-[#FF4D4D]/60 hover:text-[#FF4D4D] transition-colors ml-1"
                    title="Delete geofence"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </OverlayView>
            </Fragment>
          );
        })}

        {/* Black Spot — pending marker */}
        {pendingBlackSpot && (
          <Marker
            position={pendingBlackSpot}
            icon={{
              url: makeWarningMarker('#FF4D4D'),
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 16),
            }}
            title="New black spot"
          />
        )}

        {/* Add Point — pending waypoint marker */}
        {pendingWaypoint && (
          <Marker
            position={pendingWaypoint}
            icon={{
              url: (() => {
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                  <circle cx="16" cy="16" r="14" fill="#FFB02E" stroke="white" stroke-width="2"/>
                  <text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="Arial">+</text>
                </svg>`;
                return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
              })(),
              scaledSize: new google.maps.Size(32, 32),
              anchor: new google.maps.Point(16, 16),
            }}
            title="New waypoint"
          />
        )}

      </GoogleMap>

      {/* Floating Tool Panel */}
      <div className="absolute top-4 left-4 z-20">
        {toolPanelCollapsed ? (
          <button
            type="button"
            onClick={() => setToolPanelCollapsed(false)}
            className="animate-panel-in bg-[#0F172A]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl pl-3.5 pr-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex items-center gap-2.5 hover:bg-[#0F172A]/90 hover:border-white/[0.15] transition-all duration-200 group cursor-pointer"
            title="Expand Map Tools"
          >
            <div className="w-8 h-8 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Search className="w-4 h-4 text-[#3B82F6] group-hover:scale-110 transition-transform duration-200" />
            </div>
            <span className="text-sm text-[#94A3B8] font-medium group-hover:text-white transition-colors duration-200">Tools</span>
            {(pointA || pointB || interactionMode !== 'none') && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse" />
            )}
          </button>
        ) : (
          <div className="animate-panel-in bg-[#0F172A]/80 backdrop-blur-xl border border-white/[0.08] rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] w-[340px] overflow-hidden max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
                  <RouteIcon className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <span className="text-base text-white font-semibold">Route Planner</span>
              </div>
              <div className="flex items-center gap-2">
                {interactionMode !== 'none' && (
                  <kbd className="text-[10px] text-[#64748B] bg-[#1E293B] border border-[#334155] px-1.5 py-0.5 rounded font-mono select-none">ESC</kbd>
                )}
                <button
                  type="button"
                  onClick={() => setToolPanelCollapsed(true)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#475569] hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                  title="Minimize panel"
                >
                  <span className="text-lg leading-none font-light select-none">&minus;</span>
                </button>
              </div>
            </div>

            {/* Directions API Status Badge */}
            <div className="px-4 pt-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                apiStatus === 'ok'
                  ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                  : apiStatus === 'denied'
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                  : apiStatus === 'limit'
                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                  : 'bg-white/[0.03] border-white/[0.08] text-[#475569]'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  apiStatus === 'ok' ? 'bg-[#22C55E] animate-pulse' :
                  apiStatus === 'denied' ? 'bg-[#EF4444]' :
                  apiStatus === 'limit' ? 'bg-[#F59E0B]' :
                  'bg-[#475569] animate-pulse'
                }`} />
                {apiStatus === 'ok' && 'Directions API active'}
                {apiStatus === 'denied' && 'Directions API not enabled — check Google Cloud Console'}
                {apiStatus === 'limit' && 'Directions API rate limit reached'}
                {apiStatus === 'unknown' && 'Checking Directions API…'}
              </div>
            </div>

            {/* Route Planning — Point A */}
            <div className="px-4 pt-4 space-y-2.5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">A</span>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-medium">Start Location</span>
                  <button
                    type="button"
                    onClick={() => setInteractionMode(interactionMode === 'selectPointA' ? 'none' : 'selectPointA')}
                    className={`ml-auto p-1 rounded transition-all ${
                      interactionMode === 'selectPointA'
                        ? 'bg-[#22C55E]/20 text-[#22C55E]'
                        : 'text-[#475569] hover:text-[#22C55E] hover:bg-white/[0.04]'
                    }`}
                    title="Pick from map"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                  </button>
                </div>
                <PlacesAutocompleteInput
                  value={pointAAddress}
                  onChange={setPointAAddress}
                  onSelect={(place) => {
                    console.log('[RouteMapView] Point A selected:', place);
                    setPointAAddress(place.address);
                    setPointA({ lat: place.lat, lng: place.lng });
                    if (map && !pointB) {
                      map.panTo({ lat: place.lat, lng: place.lng });
                      map.setZoom(12);
                    }
                  }}
                  placeholder="Search start address..."
                  icon={<Search className="w-3.5 h-3.5 text-[#22C55E]" />}
                />
              </div>

              {/* Point B */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#EF4444] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">B</span>
                  </div>
                  <span className="text-xs text-[#94A3B8] font-medium">Destination</span>
                  <button
                    type="button"
                    onClick={() => setInteractionMode(interactionMode === 'selectPointB' ? 'none' : 'selectPointB')}
                    className={`ml-auto p-1 rounded transition-all ${
                      interactionMode === 'selectPointB'
                        ? 'bg-[#EF4444]/20 text-[#EF4444]'
                        : 'text-[#475569] hover:text-[#EF4444] hover:bg-white/[0.04]'
                    }`}
                    title="Pick from map"
                  >
                    <MousePointer className="w-3.5 h-3.5" />
                  </button>
                </div>
                <PlacesAutocompleteInput
                  value={pointBAddress}
                  onChange={setPointBAddress}
                  onSelect={(place) => {
                    console.log('[RouteMapView] Point B selected:', place);
                    setPointBAddress(place.address);
                    setPointB({ lat: place.lat, lng: place.lng });
                    if (map) {
                      if (pointA) {
                        // Both points exist — fit map to show both markers
                        const bounds = new google.maps.LatLngBounds();
                        bounds.extend(pointA);
                        bounds.extend({ lat: place.lat, lng: place.lng });
                        map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 380 });
                      } else {
                        map.panTo({ lat: place.lat, lng: place.lng });
                        map.setZoom(12);
                      }
                    }
                  }}
                  placeholder="Search destination..."
                  icon={<Search className="w-3.5 h-3.5 text-[#EF4444]" />}
                />
              </div>

              {/* Generate Route CTA + Clear */}
              <div className="flex gap-2">
                {pointA && pointB && (
                  <button
                    type="button"
                    onClick={calculateRoutes}
                    disabled={isCalculatingRoutes}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isCalculatingRoutes
                        ? 'bg-[#3B82F6]/20 text-[#3B82F6]/60 cursor-wait'
                        : 'bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                    }`}
                  >
                    {isCalculatingRoutes ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RouteIcon className="w-4 h-4" />
                    )}
                    {isCalculatingRoutes ? 'Calculating...' : 'Generate Route'}
                  </button>
                )}
                {(pointA || pointB) && (
                  <button
                    type="button"
                    onClick={clearRoutePlan}
                    className="px-3 py-2.5 rounded-xl text-[11px] text-[#64748B] hover:text-[#EF4444] hover:bg-[#EF4444]/[0.05] border border-white/[0.06] transition-all flex items-center gap-1"
                    title="Clear route plan"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Calculating Routes Indicator */}
            {isCalculatingRoutes && (
              <div className="px-4 py-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
                  <div>
                    <div className="text-xs font-semibold text-[#CBD5E1]">Finding routes...</div>
                    <div className="text-[10px] text-[#64748B]">Calculating best paths via road network</div>
                  </div>
                </div>
              </div>
            )}

            {/* Route Results */}
            {plannedRoutes.length > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 mb-2.5">
                  <RouteIcon className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">
                    {plannedRoutes.length} Route{plannedRoutes.length > 1 ? 's' : ''} Found
                  </span>
                  {plannedRoutes.length > 1 && (
                    <span className="text-[9px] text-[#00E5FF]/60 italic ml-auto">Click to select</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {plannedRoutes.map((route, i) => {
                    const isActive = i === selectedPlanIndex;
                    const isHovered = i === hoveredRouteIndex;
                    const color = isActive ? '#22C55E' : (ALT_ROUTE_COLORS[i % ALT_ROUTE_COLORS.length] || '#6B7280');
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedPlanIndex(i)}
                        onMouseEnter={() => setHoveredRouteIndex(i)}
                        onMouseLeave={() => setHoveredRouteIndex(null)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left ${
                          isActive
                            ? 'bg-[#22C55E]/[0.08] border border-[#22C55E]/30 shadow-[0_0_8px_rgba(34,197,94,0.1)]'
                            : isHovered
                            ? 'bg-white/[0.05] border border-white/[0.1]'
                            : 'bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06]'
                        }`}
                      >
                        {/* Color indicator bar */}
                        <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.6 }} />
                        <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: color }}>
                          {isActive && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${isActive ? 'text-[#22C55E]' : 'text-[#94A3B8]'}`}>
                              {i === 0 ? 'Fastest Route' : `Alternative ${i}`}
                            </span>
                          </div>
                          {route.summary && (
                            <div className="text-[9px] text-[#475569] truncate mt-0.5">via {route.summary}</div>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-[#CBD5E1] font-mono font-semibold">{route.duration}</span>
                            <span className="text-[10px] text-[#475569]">•</span>
                            <span className="text-[11px] text-[#475569] font-mono">{route.distance}</span>
                          </div>
                        </div>
                        {isActive && (
                          <div className="text-[8px] text-[#22C55E] font-bold uppercase tracking-wider">Selected</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Waypoints Management — shown when route is planned */}
            {plannedRoutes.length > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Waypoints</span>
                    {plannedWaypoints.length > 0 && (
                      <span className="text-[9px] bg-[#F59E0B]/15 text-[#F59E0B] px-1.5 py-0.5 rounded-full font-medium">{plannedWaypoints.length}</span>
                    )}
                  </div>
                  {plannedWaypoints.length >= 2 && (
                    <button
                      type="button"
                      onClick={handleOptimizeWaypoints}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20 transition-all text-[10px] font-medium"
                      title="Optimize waypoint order"
                    >
                      <Zap className="w-3 h-3" />
                      Optimize
                    </button>
                  )}
                </div>

                {plannedWaypoints.length > 0 ? (
                  <div className="space-y-1 mb-2">
                    {plannedWaypoints.map((wp, i) => (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] group">
                        <span className="text-[10px] text-[#F59E0B] font-bold w-4">{i + 1}</span>
                        <span className="text-[11px] text-[#94A3B8] truncate flex-1">{wp.address || `${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePlannedWaypoint(i)}
                          className="opacity-0 group-hover:opacity-100 text-[#EF4444]/50 hover:text-[#EF4444] transition-all"
                          title="Remove waypoint"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-[#475569] mb-2">No waypoints added. Use "Add Point" tool to add stops along the route.</p>
                )}
              </div>
            )}

            {/* Save Route & Quick Assign — shown when route is planned */}
            {plannedRoutes.length > 0 && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                {!showSaveRouteForm ? (
                  <button
                    type="button"
                    onClick={() => setShowSaveRouteForm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E] hover:bg-[#22C55E]/20 transition-all text-xs font-semibold"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save as New Route
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <Save className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Save Route</span>
                    </div>

                    {/* Route Name */}
                    <input
                      type="text"
                      value={saveRouteName}
                      onChange={(e) => setSaveRouteName(e.target.value)}
                      placeholder="Route name..."
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white placeholder-[#475569] focus:outline-none focus:border-[#22C55E]/40 transition-colors"
                    />

                    {/* Quick Assign Vehicle */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Truck className="w-3 h-3 text-[#3B82F6]" />
                        <span className="text-[10px] text-[#64748B] font-medium">Assign Vehicle (optional)</span>
                      </div>
                      <select
                        value={quickAssignTankerId}
                        onChange={(e) => setQuickAssignTankerId(e.target.value)}
                        className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-[#3B82F6]/40 transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#0F172A]">No assignment</option>
                        {availableTankers.map(t => (
                          <option key={t.id} value={t.id} className="bg-[#0F172A]">
                            {t.name} — {t.driver}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSaveRouteForm(false)}
                        className="flex-1 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[#94A3B8] hover:bg-white/[0.08] transition-all text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePlannedRoute}
                        disabled={!saveRouteName.trim()}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          saveRouteName.trim()
                            ? 'bg-[#22C55E] text-white hover:bg-[#16A34A]'
                            : 'bg-[#22C55E]/20 text-[#22C55E]/40 cursor-not-allowed'
                        }`}
                      >
                        <Save className="w-3 h-3" />
                        Save Route
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions — Assign existing route */}
            {selectedRoute && !selectedRoute.assignedTanker && onAssignRoute && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={onAssignRoute}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/20 transition-all text-xs font-semibold"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Assign Vehicle to Route
                </button>
              </div>
            )}

            {/* Map Tools Section — Segmented Icon Toolbar */}
            <div className="px-4 py-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8]" />
                  <span className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Map Tools</span>
                </div>
                <span className="text-[8px] text-[#475569] italic">
                  {interactionMode !== 'none' && interactionMode !== 'editRoute' ? 'Click map to place' : interactionMode === 'editRoute' ? 'Drag route to edit' : 'Select a tool'}
                </span>
              </div>

              {/* Segmented 4-tool icon bar with 44×44px touch targets */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {/* Add Point */}
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedRoute) return;
                    setInteractionMode(interactionMode === 'addPoint' ? 'none' : 'addPoint');
                  }}
                  disabled={!selectedRoute}
                  className={`w-full aspect-square min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 border-[1.5px] ${
                    interactionMode === 'addPoint'
                      ? 'bg-[#F59E0B]/[0.08] border-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                      : selectedRoute
                        ? 'bg-white/[0.02] border-white/[0.06] hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/[0.03]'
                        : 'bg-white/[0.01] border-white/[0.03] opacity-40 cursor-not-allowed'
                  }`}
                  title={selectedRoute ? 'Add waypoint on route' : 'Select a route first'}
                >
                  <MapPin size={18} className={interactionMode === 'addPoint' ? 'text-[#F59E0B]' : selectedRoute ? 'text-[#94A3B8]' : 'text-[#475569]'} />
                  <span className={`text-[8px] font-semibold leading-none ${interactionMode === 'addPoint' ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>Point</span>
                  {interactionMode === 'addPoint' && <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse absolute top-1 right-1" />}
                </button>

                {/* Black Spot */}
                <button
                  type="button"
                  onClick={() => setInteractionMode(interactionMode === 'addBlackSpot' ? 'none' : 'addBlackSpot')}
                  className={`w-full aspect-square min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 border-[1.5px] relative ${
                    interactionMode === 'addBlackSpot'
                      ? 'bg-[#EF4444]/[0.08] border-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.2)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-[#EF4444]/50 hover:bg-[#EF4444]/[0.03]'
                  }`}
                  title="Mark hazardous zone"
                >
                  <AlertTriangle size={18} className={interactionMode === 'addBlackSpot' ? 'text-[#EF4444]' : 'text-[#94A3B8]'} />
                  <span className={`text-[8px] font-semibold leading-none ${interactionMode === 'addBlackSpot' ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>Hazard</span>
                  {interactionMode === 'addBlackSpot' && <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse absolute top-1 right-1" />}
                  {blackSpots.length > 0 && interactionMode !== 'addBlackSpot' && (
                    <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-[#EF4444] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">{blackSpots.length}</span>
                  )}
                </button>

                {/* Geofence */}
                <button
                  type="button"
                  onClick={() => setInteractionMode(interactionMode === 'addGeofence' ? 'none' : 'addGeofence')}
                  className={`w-full aspect-square min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 border-[1.5px] relative ${
                    interactionMode === 'addGeofence'
                      ? 'bg-[#8B5CF6]/[0.08] border-[#8B5CF6] shadow-[0_0_8px_rgba(139,92,246,0.2)]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/[0.03]'
                  }`}
                  title="Define geofence zone"
                >
                  <Target size={18} className={interactionMode === 'addGeofence' ? 'text-[#8B5CF6]' : 'text-[#94A3B8]'} />
                  <span className={`text-[8px] font-semibold leading-none ${interactionMode === 'addGeofence' ? 'text-[#8B5CF6]' : 'text-[#64748B]'}`}>Fence</span>
                  {interactionMode === 'addGeofence' && <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse absolute top-1 right-1" />}
                  {geofences.length > 0 && interactionMode !== 'addGeofence' && (
                    <span className="absolute -top-1 -right-1 text-[7px] font-bold bg-[#8B5CF6] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">{geofences.length}</span>
                  )}
                </button>

                {/* Edit Route */}
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedRoute?.routePath || selectedRoute.routePath.length === 0) return;
                    setInteractionMode(interactionMode === 'editRoute' ? 'none' : 'editRoute');
                  }}
                  disabled={!selectedRoute?.routePath || selectedRoute.routePath.length === 0}
                  className={`w-full aspect-square min-h-[44px] rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 border-[1.5px] relative ${
                    interactionMode === 'editRoute'
                      ? 'bg-[#06B6D4]/[0.08] border-[#06B6D4] shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                      : selectedRoute?.routePath && selectedRoute.routePath.length > 0
                        ? 'bg-white/[0.02] border-white/[0.06] hover:border-[#06B6D4]/50 hover:bg-[#06B6D4]/[0.03]'
                        : 'bg-white/[0.01] border-white/[0.03] opacity-40 cursor-not-allowed'
                  }`}
                  title={selectedRoute?.routePath ? 'Edit route by dragging' : 'Select a route with a path first'}
                >
                  <PenTool size={18} className={interactionMode === 'editRoute' ? 'text-[#06B6D4]' : selectedRoute?.routePath ? 'text-[#94A3B8]' : 'text-[#475569]'} />
                  <span className={`text-[8px] font-semibold leading-none ${interactionMode === 'editRoute' ? 'text-[#06B6D4]' : 'text-[#64748B]'}`}>Edit</span>
                  {interactionMode === 'editRoute' && <div className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] animate-pulse absolute top-1 right-1" />}
                </button>
              </div>

              {/* Active tool detail sections */}
              {/* Add Point details */}
              {(interactionMode === 'addPoint' || (selectedRoute?.waypoints && selectedRoute.waypoints.length > 0)) && (
                <div className="mb-2 p-2 rounded-lg bg-white/[0.02] border border-[#F59E0B]/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[#F59E0B] font-semibold uppercase">Waypoints</span>
                    {selectedRoute?.waypoints && selectedRoute.waypoints.length > 0 && (
                      <span className="text-[8px] text-[#475569]">{selectedRoute.waypoints.length} stops</span>
                    )}
                  </div>
                  {selectedRoute?.waypoints && selectedRoute.waypoints.length > 0 ? (
                    <div className="space-y-0.5">
                      {selectedRoute.waypoints.map((wp, i) => (
                        <div key={i} className="flex items-center justify-between px-1.5 py-1 rounded bg-white/[0.03] text-[9px]">
                          <span className="text-[#F59E0B] font-semibold">Stop {i + 1}</span>
                          <span className="text-[#475569] font-mono truncate ml-2">{wp.name || `${wp.lat.toFixed(4)}°, ${wp.lng.toFixed(4)}°`}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[9px] text-[#475569]">Click map to add waypoint stops</p>
                  )}
                </div>
              )}

              {/* Black Spots details */}
              {(interactionMode === 'addBlackSpot' || blackSpots.length > 0) && blackSpots.length > 0 && (
                <div className="mb-2 p-2 rounded-lg bg-white/[0.02] border border-[#EF4444]/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[#EF4444] font-semibold uppercase">Hazard Zones</span>
                    <span className="text-[8px] text-[#475569]">{blackSpots.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {blackSpots.map((bs, i) => (
                      <div key={bs.id} className="flex items-center justify-between px-1.5 py-1 rounded bg-white/[0.03] text-[9px]">
                        <span className="text-[#EF4444] font-semibold truncate">{bs.name || `Hazard ${i + 1}`}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[#475569] capitalize">{bs.threatLevel}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteBlackSpot(bs.id); }}
                            className="text-[#EF4444]/50 hover:text-[#EF4444] transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geofence details */}
              {(interactionMode === 'addGeofence' || geofences.length > 0) && geofences.length > 0 && (
                <div className="mb-2 p-2 rounded-lg bg-white/[0.02] border border-[#8B5CF6]/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-[#8B5CF6] font-semibold uppercase">Geofence Zones</span>
                    <span className="text-[8px] text-[#475569]">{geofences.length}</span>
                  </div>
                  <div className="space-y-0.5">
                    {geofences.map((gf, i) => {
                      const gfColor = gf.color || geofenceTypeColors[gf.type] || '#8B5CF6';
                      return (
                        <div key={gf.id} className="flex items-center justify-between px-1.5 py-1 rounded bg-white/[0.03] text-[9px]">
                          <span className="font-semibold truncate" style={{ color: gfColor }}>{gf.name || `Zone ${i + 1}`}</span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[#475569] font-mono">r={gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)}km` : `${gf.radius}m`}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(gf.id); }}
                              className="text-[#EF4444]/50 hover:text-[#EF4444] transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary bar */}
              {(blackSpots.length + geofences.length) > 0 && (
                <div className="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-between text-[9px]">
                  <div className="flex gap-2">
                    {selectedRoute?.waypoints && selectedRoute.waypoints.length > 0 && (
                      <span className="text-[#F59E0B]">{selectedRoute.waypoints.length} stops</span>
                    )}
                    {blackSpots.length > 0 && <span className="text-[#EF4444]">{blackSpots.length} hazards</span>}
                    {geofences.length > 0 && <span className="text-[#8B5CF6]">{geofences.length} zones</span>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); clearAllMapTools(); }}
                    className="text-[#475569] underline hover:text-[#94A3B8] transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Route Corridor Geofence Toggle */}
            {selectedRoute?.routePath && selectedRoute.routePath.length > 0 && (
              <div className="px-4 py-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowRouteCorridorGeofence(!showRouteCorridorGeofence)}
                  className="w-full flex items-center justify-between py-1 text-[#94A3B8] hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Shield className={`w-3.5 h-3.5 ${showRouteCorridorGeofence ? 'text-[#3B82F6]' : 'text-[#475569]'}`} />
                    <span className="text-xs font-medium">Route Corridor</span>
                    <span className="text-[9px] text-[#475569]">{corridorRadius}m</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors ${showRouteCorridorGeofence ? 'bg-[#3B82F6]' : 'bg-[#334155]'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-transform ${showRouteCorridorGeofence ? 'translate-x-4.5 ml-0.5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            )}

            {/* Geofence Management */}
            {geofences.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowGeofences(!showGeofences)}
                  className="w-full flex items-center justify-between py-0.5 text-[#94A3B8] hover:text-white transition-colors duration-200"
                  title={showGeofences ? 'Hide geofences' : 'Show geofences'}
                >
                  <div className="flex items-center gap-2">
                    {showGeofences ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    <span className="text-xs font-medium">Geofences</span>
                    <span className="text-[10px] text-[#475569] bg-white/[0.06] px-1.5 py-0.5 rounded font-medium">{geofences.length}</span>
                  </div>
                  {showGeofences ? <ChevronUp className="w-3.5 h-3.5 text-[#475569]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />}
                </button>

                {showGeofences && (
                  <div className="mt-2 space-y-0.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                    {geofences.slice(0, 5).map(gf => {
                      const gfColor = gf.color || geofenceTypeColors[gf.type] || '#06B6D4';
                      const gfIcon = geofenceTypeIcons[gf.type] || '📍';
                      return (
                        <div
                          key={gf.id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors duration-200 group cursor-pointer"
                          onClick={() => {
                            if (map) {
                              map.panTo(gf.center);
                              map.setZoom(Math.max(map.getZoom() || 10, 12));
                            }
                          }}
                          title={`Pan to ${gf.name}`}
                        >
                          <span className="text-xs">{gfIcon}</span>
                          <span className="text-xs truncate flex-1 font-medium" style={{ color: gfColor }}>{gf.name}</span>
                          <span className="text-[10px] text-[#475569]">{gf.radius >= 1000 ? `${(gf.radius / 1000).toFixed(1)}k` : `${gf.radius}m`}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteGeofence(gf.id); }}
                            className="opacity-0 group-hover:opacity-100 text-[#EF4444]/50 hover:text-[#EF4444] transition-all duration-200"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {geofences.length > 5 && (
                      <div className="text-[10px] text-[#475569] text-center py-1">+{geofences.length - 5} more</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-20 animate-fade-in">
        <button
          onClick={() => setShowTraffic(!showTraffic)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-1.5 border ${
            showTraffic
              ? 'bg-[#22C55E]/20 border-[#22C55E]/60 text-[#22C55E]'
              : 'bg-[#0F172A]/80 backdrop-blur-sm text-[#94A3B8] border-white/[0.08] hover:border-white/20 hover:text-white'
          }`}
          title={showTraffic ? 'Hide Traffic' : 'Show Traffic'}
        >
          <Navigation className="w-3.5 h-3.5" />
          Traffic
        </button>

        <button
          onClick={() => onToggleBlackSpots(!showBlackSpots)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-1.5 border ${
            showBlackSpots
              ? 'bg-[#EF4444]/20 border-[#EF4444]/60 text-[#EF4444]'
              : 'bg-[#0F172A]/80 backdrop-blur-sm text-[#94A3B8] border-white/[0.08] hover:border-white/20 hover:text-white'
          }`}
          title={showBlackSpots ? 'Hide Black Spots' : 'Show Black Spots'}
        >
          {showBlackSpots ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          Hazards
        </button>

        <button
          onClick={() => setIsSatellite(s => !s)}
          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-1.5 border ${
            isSatellite
              ? 'bg-[#3B82F6]/20 border-[#3B82F6]/60 text-[#3B82F6]'
              : 'bg-[#0F172A]/80 backdrop-blur-sm text-[#94A3B8] border-white/[0.08] hover:border-white/20 hover:text-white'
          }`}
          title={isSatellite ? 'Switch to Map view' : 'Switch to Satellite view'}
        >
          {isSatellite ? <MapIcon className="w-3.5 h-3.5" /> : <Satellite className="w-3.5 h-3.5" />}
          {isSatellite ? 'Map' : 'Satellite'}
        </button>

        <button
          onClick={onToggleRouteList}
          title="Toggle route list"
          className="px-3 py-2 bg-[#0F172A]/80 backdrop-blur-sm text-[#94A3B8] border border-white/[0.08] hover:border-white/20 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 hover:scale-105 flex items-center gap-1.5"
        >
          {showRouteList ? <List className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
          Routes
        </button>
      </div>

      {/* Route Error Banner */}
      {routeError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-fade-in max-w-md w-full px-4">
          <div className="bg-[#EF4444]/10 backdrop-blur-sm border border-[#EF4444]/40 rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg">
            <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <span className="text-sm text-[#FCA5A5] flex-1">{routeError}</span>
            <button
              type="button"
              onClick={() => setRouteError(null)}
              className="text-[#EF4444]/60 hover:text-[#EF4444] transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Mode Indicator */}
      {interactionMode !== 'none' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
          <div className={`px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 shadow-lg ${
            interactionMode === 'selectPointA' ? 'bg-[#22C55E] text-white' :
            interactionMode === 'selectPointB' ? 'bg-[#EF4444] text-white' :
            interactionMode === 'addBlackSpot' ? 'bg-[#FF4D4D] text-white' :
            interactionMode === 'addGeofence' ? 'bg-[#06B6D4] text-black' :
            interactionMode === 'addPoint' ? 'bg-[#F59E0B] text-black' :
            interactionMode === 'editRoute' ? 'bg-[#06B6D4] text-white' :
            'bg-[#00E5FF] text-black'
          }`}>
            {interactionMode === 'editRoute' ? <PenTool className="w-4 h-4" /> : <MousePointer className="w-4 h-4" />}
            {interactionMode === 'selectPointA' && 'Click map to set Point A'}
            {interactionMode === 'selectPointB' && 'Click map to set Point B'}
            {interactionMode === 'addBlackSpot' && 'Click map to mark black spot'}
            {interactionMode === 'addGeofence' && 'Click map to place geofence'}
            {interactionMode === 'addPoint' && `Click map to add waypoint on "${selectedRoute?.name}"`}
            {interactionMode === 'editRoute' && `Drag route path to edit "${selectedRoute?.name}"`}
            <button
              type="button"
              onClick={() => setInteractionMode('none')}
              className="ml-2 w-5 h-5 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/40 transition-colors"
              title="Cancel (ESC)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Route Deviation Alerts */}
      {deviatingTankers.size > 0 && (
        <div className="absolute top-16 right-4 z-30 animate-fade-in">
          <div className="bg-[#FF4D4D]/90 backdrop-blur-sm border border-[#FF4D4D] rounded-xl px-4 py-3 shadow-lg max-w-[260px]">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
              <span className="text-sm font-bold text-white">Route Deviation</span>
            </div>
            {Array.from(deviatingTankers.entries()).map(([tankerId, dist]) => (
              <div key={tankerId} className="flex items-center justify-between text-xs text-white/90 py-0.5">
                <span className="font-mono">{tankerId}</span>
                <span className="font-semibold">{dist}m off route</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route Info Panel (when planned routes exist) */}
      {plannedRoutes.length > 0 && plannedRoutes[selectedPlanIndex] && (
        <div className="absolute bottom-4 right-4 z-20 animate-fade-in">
          <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-[#22C55E]/20 rounded-2xl px-5 py-4 shadow-[0_0_20px_rgba(34,197,94,0.1)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-[10px] text-[#22C55E] font-semibold uppercase tracking-wider">
                {selectedPlanIndex === 0 ? 'Fastest Route' : `Alternative ${selectedPlanIndex}`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-2xl font-bold text-white">{plannedRoutes[selectedPlanIndex].duration}</div>
                <div className="text-sm text-[#94A3B8]">{plannedRoutes[selectedPlanIndex].distance}</div>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div>
                <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1">Via</div>
                <div className="text-xs text-[#CBD5E1] max-w-[200px]">{plannedRoutes[selectedPlanIndex].summary || 'Direct route'}</div>
              </div>
            </div>
            {plannedRoutes.length > 1 && (
              <div className="mt-2 pt-2 border-t border-white/[0.06] text-[9px] text-[#475569]">
                {plannedRoutes.length} routes available — select from sidebar or click on map
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calculating overlay */}
      {isCalculatingRoutes && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 animate-fade-in">
          <div className="bg-[#0F172A]/90 backdrop-blur-xl border border-[#3B82F6]/30 rounded-2xl px-8 py-6 shadow-[0_0_30px_rgba(59,130,246,0.2)] flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            <div className="text-sm font-semibold text-white">Calculating Routes</div>
            <div className="text-[11px] text-[#94A3B8]">Finding best paths via road network...</div>
          </div>
        </div>
      )}

      {/* Map Legend — Collapsible */}
      <div className="absolute bottom-4 left-4 z-20 animate-fade-in">
        <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl neon-glow overflow-hidden transition-all duration-300" style={{ width: legendOpen ? 180 : 'auto' }}>
          <button
            type="button"
            onClick={() => setLegendOpen(!legendOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#009FFD]/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/70 font-medium">Legend</span>
            </div>
            {legendOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-[#D9DCE1]/40" />
              : <ChevronUp className="w-3.5 h-3.5 text-[#D9DCE1]/40" />
            }
          </button>

          {legendOpen && (
            <div className="px-3 pb-3 space-y-1 max-h-[45vh] overflow-y-auto custom-scrollbar">
              <button
                type="button"
                onClick={() => setLegendSections(s => ({ ...s, points: !s.points }))}
                className="w-full flex items-center justify-between py-1.5 group"
              >
                <span className="text-[9px] text-[#D9DCE1]/50 font-semibold tracking-wider uppercase">Points</span>
                {legendSections.points
                  ? <ChevronUp className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                  : <ChevronDown className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                }
              </button>
              {legendSections.points && (
                <div className="space-y-1.5 pl-1 pb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28B463]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Start</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF4D4D]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">End</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FFB02E]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Delivery</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#9B59B6]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Stop</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-2.5 h-2.5 text-[#FF4D4D]" />
                    <span className="text-[10px] text-[#D9DCE1]/70">Black Spot</span>
                  </div>
                </div>
              )}

              <div className="border-t border-[#00E5FF]/10" />

              <button
                type="button"
                onClick={() => setLegendSections(s => ({ ...s, geofences: !s.geofences }))}
                className="w-full flex items-center justify-between py-1.5 group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#D9DCE1]/50 font-semibold tracking-wider uppercase">Geofence Zones</span>
                  {geofences.length > 0 && (
                    <span className="text-[8px] bg-[#00E5FF]/15 text-[#00E5FF]/60 px-1 py-0.5 rounded-full">{geofences.length}</span>
                  )}
                </div>
                {legendSections.geofences
                  ? <ChevronUp className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                  : <ChevronDown className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                }
              </button>
              {legendSections.geofences && (
                <div className="space-y-1.5 pl-1 pb-1">
                  {([
                    { color: '#FF4D4D', label: 'Restricted', icon: '🚫' },
                    { color: '#28B463', label: 'Safe Zone', icon: '🛡️' },
                    { color: '#FFB02E', label: 'Checkpoint', icon: '📍' },
                    { color: '#9B59B6', label: 'Depot', icon: '🏭' },
                    { color: '#009FFD', label: 'Delivery', icon: '📦' },
                  ] as const).map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full border-[1.5px]" style={{ borderColor: item.color, backgroundColor: `${item.color}25` }}></div>
                      <span className="text-[10px] text-[#D9DCE1]/70">{item.icon} {item.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#00E5FF]/10" />

              <button
                type="button"
                onClick={() => setLegendSections(s => ({ ...s, routes: !s.routes }))}
                className="w-full flex items-center justify-between py-1.5 group"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#D9DCE1]/50 font-semibold tracking-wider uppercase">Routes</span>
                  {routes.length > 0 && (
                    <span className="text-[8px] bg-[#009FFD]/15 text-[#009FFD]/60 px-1 py-0.5 rounded-full">{routes.length}</span>
                  )}
                </div>
                {legendSections.routes
                  ? <ChevronUp className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                  : <ChevronDown className="w-3 h-3 text-[#D9DCE1]/30 group-hover:text-[#D9DCE1]/60 transition-colors" />
                }
              </button>
              {legendSections.routes && (
                <div className="space-y-1.5 pl-1 pb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-[2px] rounded bg-[#28B463]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-[2px] rounded bg-[#FF9800]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Assigned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-[2px] rounded bg-[#009FFD]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Unassigned</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-[2px] rounded bg-[#00FF00]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">GPS Trail</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-[2px] rounded bg-[#3B82F6] opacity-50"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Route Corridor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-[#FF4D4D]"></div>
                    <span className="text-[10px] text-[#D9DCE1]/70">Deviation</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Point Modal */}
      {showAddPointModal && pendingWaypoint && (
        <AddPointModal
          position={pendingWaypoint}
          onClose={() => {
            setShowAddPointModal(false);
            setPendingWaypoint(null);
          }}
          onConfirm={handleConfirmAddPoint}
        />
      )}

      {/* Black Spot Modal */}
      {showBlackSpotModal && pendingBlackSpot && (
        <BlackSpotModal
          position={pendingBlackSpot}
          onClose={() => {
            setShowBlackSpotModal(false);
            setPendingBlackSpot(null);
          }}
          onSave={handleSaveBlackSpot}
        />
      )}

      {/* Geofence Modal */}
      {showGeofenceModal && pendingGeofence && (
        <GeofenceModal
          position={pendingGeofence}
          initialRadius={newGeofenceRadius}
          onClose={() => {
            setShowGeofenceModal(false);
            setPendingGeofence(null);
          }}
          onSave={handleSaveGeofence}
        />
      )}
    </div>
  );
}
