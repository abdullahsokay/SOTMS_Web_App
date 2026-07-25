import { useState, useEffect, useMemo, useRef } from 'react';
import { ZoomIn, ZoomOut, TrafficCone, Signal } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { Tanker, Route, NearbyFacility } from '../../types';
import { PathTimeRange } from '../../types/tracking';
import { useGPSData } from '../../hooks/useGPSData';
import { useSnapToRoads } from '../../hooks/useSnapToRoads';
import { useVehicleTracking } from '../../hooks/useVehicleTracking';
import { usePathHistory } from '../../hooks/usePathHistory';
import { usePathReplay } from '../../hooks/usePathReplay';
import { VehicleList } from './VehicleList';
import { VehicleDrawer } from './VehicleDrawer';
import { StatusStrip } from './StatusStrip';
import { MapView } from './MapView';
import { TrackingNavBar } from './TrackingNavBar';

export function LiveTrackingPage() {
  const { companyId } = useCompany();
  const { tankers, positionHistory, speedHistory, loading, error } = useGPSData();
  const { trackingData } = useVehicleTracking();
  const [selectedTanker, setSelectedTanker] = useState<Tanker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter] = useState<string>('all');

  // Filter position history by selected tanker (so each tanker gets its own trail)
  const filteredPositionHistory = useMemo(() => {
    if (!selectedTanker) return positionHistory;
    return positionHistory.filter(p => !p.tankerId || p.tankerId === selectedTanker.id);
  }, [positionHistory, selectedTanker]);

  const { snappedPath } = useSnapToRoads(filteredPositionHistory);
  const [showTankerList, setShowTankerList] = useState(true);
  const [showTraffic, setShowTraffic] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [zoom] = useState(5);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [pathHistoryActive, setPathHistoryActive] = useState(false);
  const [pathTimeRange, setPathTimeRange] = useState<PathTimeRange>('24h');
  const [selectedFuelStation, setSelectedFuelStation] = useState<NearbyFacility | null>(null);

  // Load routes for ETA/deviation context (tenant-scoped)
  useEffect(() => {
    if (!companyId) {
      setRoutes([]);
      return;
    }
    const q = query(collection(db, 'routes'), where('companyId', '==', companyId));
    const unsub = onSnapshot(q, (snap) => {
      setRoutes(snap.docs.map(d => ({ ...d.data(), id: d.id } as Route)));
    });
    return () => unsub();
  }, [companyId]);

  // GPS Path History hooks
  const {
    points: pathPoints,
    segments: pathSegments,
    stops: pathStops,
    summary: pathSummary,
    loading: pathLoading,
  } = usePathHistory(selectedTanker?.id || null, pathTimeRange, pathHistoryActive);

  const {
    replayPosition,
    progress: replayProgress,
    isPlaying,
    speed: replaySpeed,
    play,
    pause,
    reset: resetReplay,
    setSpeed: setReplaySpeed,
    scrubTo,
  } = usePathReplay(pathPoints, pathHistoryActive);

  // Compute assigned route for selected tanker
  const assignedRoute = useMemo(() => {
    if (!selectedTanker) return null;
    return routes.find(
      (r) => r.assignedTanker === selectedTanker.id && r.status === 'active'
    ) || null;
  }, [selectedTanker, routes]);

  // Keep selectedTanker in sync with live data from the microcontroller
  // (status, speed, location update automatically as new signals arrive)
  useEffect(() => {
    if (selectedTanker) {
      const updated = tankers.find(t => t.id === selectedTanker.id);
      if (updated && updated !== selectedTanker) {
        setSelectedTanker(updated);
      } else if (!updated) {
        // Tanker went offline / disappeared from feed
        setSelectedTanker(null);
      }
    }
  }, [tankers]);

  // Auto-activate path history when a tanker is selected (vehicle-focus mode)
  // Reset path history and fuel station when tanker deselected
  useEffect(() => {
    if (selectedTanker) {
      setPathHistoryActive(true);
    } else {
      setPathHistoryActive(false);
      setSelectedFuelStation(null);
    }
  }, [selectedTanker]);

  const filteredTankers = tankers.filter(tanker => {
    const matchesSearch = searchQuery === '' ||
      tanker.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tanker.driver.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tanker.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || tanker.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const movingCount = tankers.filter(t => t.status === 'moving').length;
  const idleCount = tankers.filter(t => t.status === 'idle').length;
  const alertCount = tankers.filter(t => t.status === 'alert' || t.alerts.length > 0).length;

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    if (tankers.length === 0) return;

    const headers = ['ID', 'Name', 'Status', 'Speed (km/h)', 'Location', 'Last Update'];
    const csvContent = [
      headers.join(','),
      ...tankers.map(t => [
        t.id,
        t.name,
        t.status,
        t.speed,
        `"${t.location.address}"`,
        t.lastUpdate
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'tracking_report.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.setZoom(Math.min((mapRef.current.getZoom() ?? 10) + 1, 20));
    }
  };
  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.setZoom(Math.max((mapRef.current.getZoom() ?? 10) - 1, 3));
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0C1E2C]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00E5FF] mx-auto mb-4"></div>
          <h2 className="text-xl text-white font-semibold">Connecting to Live Fleet...</h2>
          <p className="text-[#D9DCE1]/60 mt-2">Synchronizing GPS telemetry</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0C1E2C]">
        <div className="text-center p-8 border border-red-500/30 rounded-xl bg-red-500/10">
          <h2 className="text-xl text-red-500 font-bold mb-2">Connection Failed</h2>
          <p className="text-[#D9DCE1]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Navigation Bar */}
      <TrackingNavBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={handleRefresh}
        onExport={handleExport}
        totalTankers={tankers.length}
        movingCount={movingCount}
        idleCount={idleCount}
        alertCount={alertCount}
        showTankerList={showTankerList}
        onToggleTankerList={() => setShowTankerList(!showTankerList)}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Vehicle List Sidebar */}
        {showTankerList && (
          <div className="w-80 bg-[#0C1E2C] border-r border-[#00E5FF]/20 overflow-hidden flex flex-col">
            <VehicleList
              tankers={filteredTankers}
              selectedTanker={selectedTanker}
              onSelectTanker={setSelectedTanker}
            />
          </div>
        )}

        {/* Map Area */}
        <div className="flex-1 flex flex-col relative">
          <MapView
            tankers={filteredTankers}
            selectedTanker={selectedTanker}
            onSelectTanker={setSelectedTanker}
            onDeselectTanker={() => setSelectedTanker(null)}
            zoom={zoom}
            positionHistory={filteredPositionHistory}
            snappedPath={snappedPath}
            showTraffic={showTraffic}
            trackingData={trackingData}
            pathSegments={pathHistoryActive ? pathSegments : undefined}
            pathStops={pathHistoryActive ? pathStops : undefined}
            pathStartPoint={pathHistoryActive && pathPoints.length > 0 ? pathPoints[0] : undefined}
            pathEndPoint={pathHistoryActive && pathPoints.length > 0 ? pathPoints[pathPoints.length - 1] : undefined}
            replayPosition={replayPosition}
            assignedRoute={assignedRoute}
            selectedFuelStation={selectedFuelStation}
            onClearFuelStation={() => setSelectedFuelStation(null)}
            onMapReady={(map) => { mapRef.current = map; }}
          />

          {/* Waiting for signals overlay — auto-hides when tankers appear */}
          {tankers.length === 0 && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="text-center p-8 bg-[#0C1E2C]/90 border border-[#00E5FF]/30 rounded-xl backdrop-blur-sm">
                <Signal className="w-12 h-12 text-[#00E5FF] mx-auto mb-4 animate-pulse" />
                <h2 className="text-xl text-white font-semibold">Waiting for Signals...</h2>
                <p className="text-[#D9DCE1]/60 mt-2">Vehicles will appear automatically<br/>once they are online and sending data</p>
              </div>
            </div>
          )}

          {/* Map Controls Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
            <button
              onClick={() => setShowTraffic(!showTraffic)}
              className={`p-3 bg-[#0C1E2C] border rounded-lg transition-all shadow-lg hover:scale-105 ${
                showTraffic ? 'border-[#28B463]/50 text-[#28B463]' : 'border-[#00E5FF]/30 text-[#00E5FF] hover:bg-[#009FFD]/20'
              }`}
              title="Toggle Traffic"
            >
              <TrafficCone className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-3 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg text-[#00E5FF] hover:bg-[#009FFD]/20 transition-all shadow-lg hover:scale-105"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-3 bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-lg text-[#00E5FF] hover:bg-[#009FFD]/20 transition-all shadow-lg hover:scale-105"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
          </div>

          {/* Status Strip */}
          <StatusStrip tankers={tankers} />
        </div>
      </div>

      {/* Vehicle Info Drawer */}
      {selectedTanker && (
        <VehicleDrawer
          tanker={selectedTanker}
          onClose={() => setSelectedTanker(null)}
          speedHistory={speedHistory}
          routes={routes}
          pathHistoryActive={pathHistoryActive}
          onTogglePathHistory={() => setPathHistoryActive(prev => !prev)}
          pathTimeRange={pathTimeRange}
          onPathTimeRangeChange={setPathTimeRange}
          pathSummary={pathSummary}
          pathLoading={pathLoading}
          pathPoints={pathPoints}
          pathStops={pathStops}
          isPlaying={isPlaying}
          replaySpeed={replaySpeed}
          replayProgress={replayProgress}
          onPlay={play}
          onPause={pause}
          onReset={resetReplay}
          onSpeedChange={setReplaySpeed}
          onScrub={scrubTo}
          onFuelStationSelect={setSelectedFuelStation}
        />
      )}
    </div>
  );
}