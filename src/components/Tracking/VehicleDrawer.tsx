import { useState } from 'react';
import { Tanker, Route, NearbyFacility } from '../../types';
import { X, Phone, MapPin, Gauge, Droplet, Weight, Clock, AlertTriangle, Thermometer, Satellite, Signal, Navigation, Fuel, Loader2 } from 'lucide-react';
import { StreetViewThumbnail } from '../Map/StreetViewThumbnail';
import { StreetViewModal } from '../Map/StreetViewModal';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useETACalculation } from '../../hooks/useETACalculation';
import { useRouteDeviation } from '../../hooks/useRouteDeviation';
import { useNearbyPlaces } from '../../hooks/useNearbyPlaces';
import { PathHistoryControls } from './PathHistoryControls';
import { PathTimeRange, PathSummary, HistoricalGPSPoint, StopMarkerData } from '../../types/tracking';

type ReplaySpeed = 1 | 2 | 5 | 10;

interface VehicleDrawerProps {
  tanker: Tanker;
  onClose: () => void;
  speedHistory?: Array<{ time: number; speed: number }>;
  routes?: Route[];
  // Path history
  pathHistoryActive?: boolean;
  onTogglePathHistory?: () => void;
  pathTimeRange?: PathTimeRange;
  onPathTimeRangeChange?: (range: PathTimeRange) => void;
  pathSummary?: PathSummary;
  pathLoading?: boolean;
  pathPoints?: HistoricalGPSPoint[];
  pathStops?: StopMarkerData[];
  // Replay
  isPlaying?: boolean;
  replaySpeed?: ReplaySpeed;
  replayProgress?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSpeedChange?: (speed: ReplaySpeed) => void;
  onScrub?: (progress: number) => void;
  onFuelStationSelect?: (station: NearbyFacility | null) => void;
}

const fallbackSpeedData = [
  { time: 0, speed: 0 },
  { time: 1, speed: 0 },
];

export function VehicleDrawer({ tanker, onClose, speedHistory = [], routes = [], pathHistoryActive = false, onTogglePathHistory, pathTimeRange = '24h', onPathTimeRangeChange, pathSummary, pathLoading = false, pathPoints = [], pathStops = [], isPlaying = false, replaySpeed = 1, replayProgress = 0, onPlay, onPause, onReset, onSpeedChange, onScrub, onFuelStationSelect }: VehicleDrawerProps) {
  const [showNearby, setShowNearby] = useState(false);
  const [streetViewModalOpen, setStreetViewModalOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  // Find assigned route for this tanker
  const assignedRoute = routes.find(r => r.assignedTanker === tanker.id && r.status === 'active');

  // ETA calculation
  const { eta, isCalculating: etaLoading } = useETACalculation(
    tanker.location,
    assignedRoute ? assignedRoute.endLocation : null,
    tanker.status,
    !!assignedRoute
  );

  // Route deviation
  const { isDeviated, deviationDistance } = useRouteDeviation(
    tanker.location,
    assignedRoute?.routePath,
    assignedRoute?.geofenceRadius || 500
  );

  // Nearby places
  const { places, isSearching, search, clear, fetchDetails } = useNearbyPlaces();

  const chartData = speedHistory.length >= 2 ? speedHistory : fallbackSpeedData;

  const handleFindNearby = () => {
    if (showNearby) {
      setShowNearby(false);
      clear();
      setSelectedStationId(null);
      onFuelStationSelect?.(null);
    } else {
      setShowNearby(true);
      search(tanker.location);
    }
  };

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-[#0C1E2C] border-l border-[#00E5FF]/30 shadow-2xl z-50 overflow-y-auto neon-glow slide-in-right">
      {/* Header */}
      <div className="sticky top-0 bg-[#0C1E2C] border-b border-[#00E5FF]/20 p-4 flex items-center justify-between z-10">
        <div>
          <h2 className="text-xl text-white neon-text">{tanker.name}</h2>
        </div>
        <button
          onClick={onClose}
          title="Close"
          className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all duration-200 hover:scale-110 hover:rotate-90"
        >
          <X className="w-5 h-5 text-[#D9DCE1]" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Driver Info */}
        <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
          <h3 className="text-sm text-[#D9DCE1]/60 mb-3">Driver Information</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white">{assignedRoute?.assignedDriver || tanker.driver}</span>
              {(assignedRoute?.assignedDriverContact || tanker.driverContact !== 'N/A') && (
                <a
                  href={`tel:${assignedRoute?.assignedDriverContact || tanker.driverContact}`}
                  title="Call driver"
                  className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-105"
                >
                  <Phone className="w-4 h-4 text-[#00E5FF]" />
                </a>
              )}
            </div>
            <div className="text-sm text-[#D9DCE1]/60">
              {assignedRoute?.assignedDriverContact || tanker.driverContact}
            </div>
          </div>
        </div>

        {/* Route ETA */}
        {assignedRoute && (
          <div className="bg-[#07121A] border border-[#28B463]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="w-4 h-4 text-[#28B463]" />
              <span className="text-sm text-[#D9DCE1]/60">Route ETA</span>
              {etaLoading && <Loader2 className="w-3 h-3 text-[#28B463] animate-spin" />}
            </div>
            <div className="text-xs text-[#D9DCE1]/40 mb-2">{assignedRoute.name}</div>
            {eta ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl text-white">{eta.distanceRemaining}</div>
                  <div className="text-xs text-[#D9DCE1]/60">km remaining</div>
                </div>
                <div>
                  <div className="text-2xl text-[#28B463]">
                    {Math.floor(eta.durationRemaining / 60)}h {eta.durationRemaining % 60}m
                  </div>
                  <div className="text-xs text-[#D9DCE1]/60">ETA</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[#D9DCE1]/40">Calculating...</div>
            )}
          </div>
        )}

        {/* Route Deviation Warning */}
        {assignedRoute && isDeviated && (
          <div className="bg-[#07121A] border border-[#FF4D4D]/30 rounded-lg p-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />
              <span className="text-sm text-[#FF4D4D] font-medium">Route Deviation Detected</span>
            </div>
            <div className="text-xs text-[#D9DCE1]/60 mt-1">
              {deviationDistance}m off assigned route
            </div>
          </div>
        )}

        {/* Current Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Speed</span>
            </div>
            <div className="text-2xl text-white">{tanker.speed}</div>
            <div className="text-xs text-[#D9DCE1]/60">km/h</div>
          </div>

          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Fuel Level</span>
            </div>
            <div className={`text-2xl ${tanker.fuelLevel < 30 ? 'text-[#FF4D4D]' : 'text-white'}`}>
              {tanker.fuelLevel}%
            </div>
          </div>

          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Weight className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Load Weight</span>
            </div>
            <div className="text-2xl text-white">{(tanker.loadWeight / 1000).toFixed(1)}</div>
            <div className="text-xs text-[#D9DCE1]/60">tons</div>
          </div>

          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-[#00E5FF]" />
              <span className="text-xs text-[#D9DCE1]/60">Ignition</span>
            </div>
            <div className="text-lg text-white capitalize">{tanker.ignition}</div>
          </div>
        </div>

        {/* Sensor Data */}
        <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
          <h3 className="text-sm text-[#D9DCE1]/60 mb-3">Sensor Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0C1E2C] p-3 rounded-lg border border-[#00E5FF]/10">
              <div className="flex items-center gap-2 mb-1">
                <Thermometer className="w-4 h-4 text-[#FFB02E]" />
                <span className="text-xs text-[#D9DCE1]/60">Oil Temp</span>
              </div>
              <div className="text-lg text-white">{tanker.temperature ?? 25}°C</div>
            </div>
            <div className="bg-[#0C1E2C] p-3 rounded-lg border border-[#00E5FF]/10">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs text-[#D9DCE1]/60">Uptime</span>
              </div>
              <div className="text-lg text-white">
                {tanker.uptime ? `${(tanker.uptime / 60000).toFixed(0)} min` : '--'}
              </div>
            </div>
            <div className="bg-[#0C1E2C] p-3 rounded-lg border border-[#00E5FF]/10">
              <div className="flex items-center gap-2 mb-1">
                <Satellite className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs text-[#D9DCE1]/60">Satellites</span>
              </div>
              <div className="text-lg text-white">{tanker.satellites ?? 0}</div>
            </div>
            <div className="bg-[#0C1E2C] p-3 rounded-lg border border-[#00E5FF]/10">
              <div className="flex items-center gap-2 mb-1">
                <Signal className="w-4 h-4 text-[#28B463]" />
                <span className="text-xs text-[#D9DCE1]/60">RSSI</span>
              </div>
              <div className="text-lg text-white">{tanker.rssi ?? '--'}</div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#00E5FF]" />
            <span className="text-sm text-[#D9DCE1]/60">Current Location</span>
          </div>
          <div className="text-white">{tanker.location.address}</div>
          <div className="text-xs text-[#D9DCE1]/60 mt-1">
            {tanker.location.lat.toFixed(4)}, {tanker.location.lng.toFixed(4)}
          </div>
          <div className="mt-3">
            <StreetViewThumbnail
              location={tanker.location}
              heading={tanker.bearing || 0}
              size={{ width: 328, height: 185 }}
              onExpand={() => setStreetViewModalOpen(true)}
            />
          </div>
        </div>

        {/* Path History Controls */}
        {onTogglePathHistory && onPathTimeRangeChange && (
          <PathHistoryControls
            vehicleId={tanker.id}
            isActive={pathHistoryActive}
            onToggle={onTogglePathHistory}
            timeRange={pathTimeRange}
            onTimeRangeChange={onPathTimeRangeChange}
            summary={pathSummary}
            loading={pathLoading}
            isPlaying={isPlaying}
            replaySpeed={replaySpeed}
            replayProgress={replayProgress}
            onPlay={onPlay}
            onPause={onPause}
            onReset={onReset}
            onSpeedChange={onSpeedChange}
            onScrub={onScrub}
            points={pathPoints}
            stops={pathStops}
          />
        )}

        {/* Nearby Fuel Stations */}
        <button
          onClick={handleFindNearby}
          className={`w-full p-3 border rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${
            showNearby
              ? 'bg-[#009FFD]/20 border-[#00E5FF]/50 text-[#00E5FF]'
              : 'bg-[#009FFD]/10 hover:bg-[#009FFD]/20 border-[#00E5FF]/20 text-[#00E5FF]'
          }`}
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Fuel className="w-4 h-4" />
          )}
          {showNearby ? 'Hide Fuel Stations' : 'Find Nearby Fuel Stations'}
        </button>

        {showNearby && places.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            {places.map(place => {
              const isSelected = selectedStationId === place.placeId;
              return (
                <button
                  type="button"
                  key={place.placeId}
                  onClick={async () => {
                    if (isSelected) {
                      setSelectedStationId(null);
                      onFuelStationSelect?.(null);
                      return;
                    }
                    setSelectedStationId(place.placeId);
                    // Fetch details (address, phone) then notify parent
                    const details = await fetchDetails(place.placeId);
                    const enriched = { ...place, ...details };
                    onFuelStationSelect?.(enriched);
                  }}
                  className={`w-full text-left bg-[#07121A] border rounded-lg p-3 transition-all ${
                    isSelected
                      ? 'border-[#FFB02E]/60 ring-1 ring-[#FFB02E]/30'
                      : 'border-[#00E5FF]/10 hover:border-[#00E5FF]/30'
                  }`}
                >
                  <div className="flex gap-3">
                    {place.photoReference && (
                      <div className="flex-shrink-0">
                        <img
                          src={place.photoReference}
                          alt={place.name}
                          className="w-16 h-16 rounded-lg object-cover border border-[#00E5FF]/20"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white">{place.name}</div>
                        {place.rating && (
                          <div className="text-xs text-[#FFB02E]">{place.rating.toFixed(1)} ★</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-[#D9DCE1]/60">{place.distance}m away</span>
                        {place.isOpen !== undefined && (
                          <span className={`text-xs ${place.isOpen ? 'text-[#28B463]' : 'text-[#FF4D4D]'}`}>
                            {place.isOpen ? 'Open' : 'Closed'}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="text-[10px] text-[#FFB02E] mt-1.5">Pinned on map</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showNearby && !isSearching && places.length === 0 && (
          <div className="text-center text-sm text-[#D9DCE1]/40 py-2">
            No fuel stations found within 5km
          </div>
        )}

        {/* Speed Trend Chart */}
        <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-4">
          <h3 className="text-sm text-[#D9DCE1]/60 mb-3">
            Speed Trend
            {speedHistory.length > 0 && (
              <span className="text-[10px] text-[#00E5FF] ml-2">LIVE</span>
            )}
          </h3>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="speed"
                stroke="#00E5FF"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        {tanker.alerts.length > 0 && (
          <div className="bg-[#07121A] border border-[#FF4D4D]/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#FF4D4D]" />
              <span className="text-sm text-[#FF4D4D]">Active Alerts</span>
            </div>
            <div className="space-y-2">
              {tanker.alerts.map(alert => (
                <div key={alert.id} className="text-sm text-white bg-[#FF4D4D]/10 p-2 rounded">
                  {alert.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="text-center text-xs text-[#D9DCE1]/50">
          Last updated: {tanker.lastUpdate}
        </div>
      </div>

      {/* Street View Modal */}
      {streetViewModalOpen && (
        <StreetViewModal
          location={tanker.location}
          heading={tanker.bearing || 0}
          onClose={() => setStreetViewModalOpen(false)}
        />
      )}
    </div>
  );
}
