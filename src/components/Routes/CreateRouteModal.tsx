import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Building2, Route as RouteIcon, Navigation, Loader2 } from 'lucide-react';
import { Route } from '../../types';
import { PlacesAutocompleteInput } from './PlacesAutocompleteInput';
import { useGoogleMaps } from '../../contexts/GoogleMapsContext';
import { genId } from '../../utils/id';

interface CreateRouteModalProps {
  onClose: () => void;
  onCreate: (route: Partial<Route>) => void;
}

const companyColors = {
  PSO: '#28B463',
  Attock: '#009FFD',
  Shell: '#FFB02E',
  Hascol: '#9B59B6'
};

export function CreateRouteModal({ onClose, onCreate }: CreateRouteModalProps) {
  const { isLoaded } = useGoogleMaps();
  const [formData, setFormData] = useState({
    name: '',
    company: 'PSO' as 'PSO' | 'Attock' | 'Shell' | 'Hascol',
    startAddress: '',
    endAddress: '',
    geofenceRadius: 100,
    routeType: 'delivery' as 'delivery' | 'return' | 'mixed',
    description: '',
  });

  const [startCoords, setStartCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [endCoords, setEndCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    distance: number;
    duration: number;
    path: Array<{ lat: number; lng: number }>;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');
  const directionsService = useRef<google.maps.DirectionsService | null>(null);

  // Initialize DirectionsService
  useEffect(() => {
    if (isLoaded && !directionsService.current) {
      directionsService.current = new google.maps.DirectionsService();
    }
  }, [isLoaded]);

  // Auto-calculate route when both locations are selected
  useEffect(() => {
    if (!startCoords || !endCoords || !directionsService.current) return;

    setIsCalculating(true);
    setCalcError('');
    setRouteInfo(null);

    directionsService.current.route(
      {
        origin: startCoords,
        destination: endCoords,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setIsCalculating(false);
        if (status === google.maps.DirectionsStatus.OK && result) {
          const leg = result.routes[0].legs[0];
          const distanceKm = Math.round((leg.distance?.value || 0) / 1000);
          const durationMin = Math.round((leg.duration?.value || 0) / 60);
          const path = result.routes[0].overview_path.map(p => ({
            lat: p.lat(),
            lng: p.lng(),
          }));
          setRouteInfo({ distance: distanceKm, duration: durationMin, path });
          console.log('[CreateRoute] Directions calculated:', distanceKm, 'km,', durationMin, 'min');
        } else {
          console.error('[CreateRoute] Directions failed:', status);
          setCalcError('Could not calculate route. You can still create it with manual values.');
        }
      }
    );
  }, [startCoords, endCoords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startCoords || !endCoords) return;

    const newRoute: Partial<Route> = {
      id: genId('RT'),
      name: formData.name,
      company: formData.company,
      startLocation: {
        lat: startCoords.lat,
        lng: startCoords.lng,
        address: formData.startAddress
      },
      endLocation: {
        lat: endCoords.lat,
        lng: endCoords.lng,
        address: formData.endAddress
      },
      waypoints: [],
      status: 'unassigned',
      geofenceRadius: formData.geofenceRadius,
      routeType: formData.routeType,
      distance: routeInfo?.distance || 0,
      estimatedDuration: routeInfo?.duration || 0,
      routePath: routeInfo?.path || [],
      ...(formData.description ? { description: formData.description } : {}),
      blackSpots: [],
      createdAt: new Date().toISOString().split('T')[0]
    };

    onCreate(newRoute);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">Create New Route</h2>
              <p className="text-sm text-[#D9DCE1]/60">Define a new delivery or return route</p>
            </div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 hover:bg-[#009FFD]/20 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-[#D9DCE1]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)] custom-scrollbar">
          {/* Route Name */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-[#00E5FF]" />
              Route Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Karachi to Lahore Express"
              required
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all"
            />
          </div>

          {/* Company */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#00E5FF]" />
              Company
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['PSO', 'Attock', 'Shell', 'Hascol'] as const).map((company) => (
                <button
                  key={company}
                  type="button"
                  onClick={() => setFormData({ ...formData, company })}
                  className={`px-4 py-3 rounded-lg transition-all duration-200 hover:scale-105 ${
                    formData.company === company
                      ? 'text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                  }`}
                  style={formData.company === company ? { backgroundColor: companyColors[company] } : {}}
                >
                  {company}
                </button>
              ))}
            </div>
          </div>

          {/* Start Location */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#28B463]" />
              Start Location
              {startCoords && <span className="text-[10px] text-[#28B463] ml-auto">({startCoords.lat.toFixed(4)}, {startCoords.lng.toFixed(4)})</span>}
            </label>
            <PlacesAutocompleteInput
              value={formData.startAddress}
              onChange={(val) => {
                setFormData({ ...formData, startAddress: val });
                if (startCoords) setStartCoords(null);
              }}
              onSelect={(place) => {
                setFormData(prev => ({ ...prev, startAddress: place.address }));
                setStartCoords({ lat: place.lat, lng: place.lng });
              }}
              placeholder="e.g., PSO Terminal, Karachi Port"
              icon={<MapPin className="w-4 h-4 text-[#28B463]" />}
            />
          </div>

          {/* End Location */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#FF4D4D]" />
              End Location
              {endCoords && <span className="text-[10px] text-[#FF4D4D] ml-auto">({endCoords.lat.toFixed(4)}, {endCoords.lng.toFixed(4)})</span>}
            </label>
            <PlacesAutocompleteInput
              value={formData.endAddress}
              onChange={(val) => {
                setFormData({ ...formData, endAddress: val });
                if (endCoords) setEndCoords(null);
              }}
              onSelect={(place) => {
                setFormData(prev => ({ ...prev, endAddress: place.address }));
                setEndCoords({ lat: place.lat, lng: place.lng });
              }}
              placeholder="e.g., PSO Depot, Lahore"
              icon={<MapPin className="w-4 h-4 text-[#FF4D4D]" />}
            />
          </div>

          {/* Route Type */}
          <div>
            <label className="text-sm text-white mb-2 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#00E5FF]" />
              Route Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['delivery', 'return', 'mixed'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData({ ...formData, routeType: type })}
                  className={`px-4 py-3 rounded-lg capitalize transition-all duration-200 hover:scale-105 ${
                    formData.routeType === type
                      ? 'bg-[#009FFD] text-white neon-glow'
                      : 'bg-[#07121A] text-[#D9DCE1] border border-[#00E5FF]/20'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Geofence Radius */}
          <div>
            <label className="text-sm text-white mb-2 block">Geofence Radius (meters)</label>
            <div className="space-y-2">
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={formData.geofenceRadius}
                onChange={(e) => setFormData({ ...formData, geofenceRadius: parseInt(e.target.value) })}
                aria-label="Geofence radius"
                className="w-full accent-[#009FFD]"
              />
              <div className="flex justify-between text-sm">
                <span className="text-[#D9DCE1]/60">50m</span>
                <span className="text-[#00E5FF]">{formData.geofenceRadius}m</span>
                <span className="text-[#D9DCE1]/60">200m</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm text-white mb-2 block">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Brief description of this route..."
              className="w-full px-4 py-3 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white placeholder-[#D9DCE1]/50 focus:outline-none focus:border-[#00E5FF] neon-glow-hover transition-all resize-none"
            />
          </div>

          {/* Auto-Calculated Route Info */}
          {isCalculating && (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg">
              <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />
              <span className="text-sm text-[#D9DCE1]/70">Calculating route distance & time...</span>
            </div>
          )}

          {calcError && (
            <div className="px-4 py-3 bg-[#FF4D4D]/10 border border-[#FF4D4D]/30 rounded-lg text-sm text-[#FF4D4D]">
              {calcError}
            </div>
          )}

          {routeInfo && (
            <div className="bg-[#28B463]/10 border border-[#28B463]/30 rounded-lg p-4">
              <div className="text-xs text-[#28B463] mb-2 font-medium">Route Calculated</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#D9DCE1]/50">Distance</div>
                  <div className="text-lg text-white font-semibold">{routeInfo.distance.toLocaleString()} km</div>
                </div>
                <div>
                  <div className="text-xs text-[#D9DCE1]/50">Estimated Time</div>
                  <div className="text-lg text-white font-semibold">
                    {Math.floor(routeInfo.duration / 60)}h {routeInfo.duration % 60}m
                  </div>
                </div>
              </div>
            </div>
          )}

          {!startCoords || !endCoords ? (
            <div className="bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg p-4">
              <div className="text-sm text-[#D9DCE1]/70">
                Select both Start and End locations to auto-calculate distance and travel time.
              </div>
            </div>
          ) : null}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!startCoords || !endCoords}
              className={`flex-1 px-6 py-3 rounded-lg transition-all duration-200 ${
                startCoords && endCoords
                  ? 'bg-[#28B463] hover:bg-[#28B463]/80 text-white hover:scale-105 neon-glow'
                  : 'bg-[#28B463]/30 text-white/50 cursor-not-allowed'
              }`}
            >
              {!startCoords || !endCoords ? 'Select locations from suggestions' : 'Create Route'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-[#D9DCE1]/20 hover:bg-[#D9DCE1]/30 text-[#D9DCE1] rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
