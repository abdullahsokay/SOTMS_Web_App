import { useState, useEffect, useRef } from 'react';
import { X, Route as RouteIcon, Building2, Navigation, MapPin, Loader2 } from 'lucide-react';
import { Route } from '../../types';
import { genId } from '../../utils/id';

interface DrawRouteModalProps {
  waypoints: Array<{ lat: number; lng: number }>;
  routePath: Array<{ lat: number; lng: number }>;
  distance: number;
  duration: number;
  onClose: () => void;
  onSave: (routeData: Partial<Route>) => void;
}

const companyColors: Record<string, string> = {
  PSO: '#28B463',
  Attock: '#009FFD',
  Shell: '#FFB02E',
  Hascol: '#9B59B6'
};

export function DrawRouteModal({
  waypoints,
  routePath,
  distance,
  duration,
  onClose,
  onSave,
}: DrawRouteModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    company: 'PSO' as 'PSO' | 'Attock' | 'Shell' | 'Hascol',
    routeType: 'delivery' as 'delivery' | 'return' | 'mixed',
    geofenceRadius: 100,
    description: '',
  });

  const [startAddress, setStartAddress] = useState('Loading...');
  const [endAddress, setEndAddress] = useState('Loading...');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Reverse geocode first and last waypoints
  useEffect(() => {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }

    if (waypoints.length >= 1) {
      geocoderRef.current.geocode({ location: waypoints[0] }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setStartAddress(results[0].formatted_address);
        } else {
          setStartAddress(`${waypoints[0].lat.toFixed(4)}, ${waypoints[0].lng.toFixed(4)}`);
        }
      });
    }

    if (waypoints.length >= 2) {
      const last = waypoints[waypoints.length - 1];
      geocoderRef.current.geocode({ location: last }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setEndAddress(results[0].formatted_address);
        } else {
          setEndAddress(`${last.lat.toFixed(4)}, ${last.lng.toFixed(4)}`);
        }
      });
    }
  }, [waypoints]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || waypoints.length < 2) return;

    const startWp = waypoints[0];
    const endWp = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1).map((wp, i) => ({
      lat: wp.lat,
      lng: wp.lng,
      name: `Waypoint ${i + 1}`,
      type: 'waypoint' as const,
    }));

    const newRoute: Partial<Route> = {
      id: genId('RT'),
      name: formData.name,
      company: formData.company,
      startLocation: {
        lat: startWp.lat,
        lng: startWp.lng,
        address: startAddress,
      },
      endLocation: {
        lat: endWp.lat,
        lng: endWp.lng,
        address: endAddress,
      },
      waypoints: intermediateWaypoints,
      status: 'unassigned',
      geofenceRadius: formData.geofenceRadius,
      routeType: formData.routeType,
      distance,
      estimatedDuration: duration,
      routePath,
      ...(formData.description ? { description: formData.description } : {}),
      blackSpots: [],
      createdAt: new Date().toISOString().split('T')[0],
    };

    onSave(newRoute);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden neon-glow animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">Save Drawn Route</h2>
              <p className="text-sm text-[#D9DCE1]/60">Confirm details for your custom-drawn route</p>
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
          {/* Route Summary */}
          <div className="bg-[#28B463]/10 border border-[#28B463]/30 rounded-lg p-4">
            <div className="text-xs text-[#28B463] mb-2 font-medium">Drawn Route Summary</div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Distance</div>
                <div className="text-lg text-white font-semibold">{distance.toLocaleString()} km</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Est. Time</div>
                <div className="text-lg text-white font-semibold">
                  {Math.floor(duration / 60)}h {duration % 60}m
                </div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/50">Waypoints</div>
                <div className="text-lg text-white font-semibold">{waypoints.length}</div>
              </div>
            </div>
          </div>

          {/* Start / End addresses */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-3 h-3 text-[#28B463]" />
                <span className="text-[10px] text-[#28B463] font-medium">START</span>
              </div>
              <div className="text-xs text-[#D9DCE1]/70 line-clamp-2">
                {startAddress === 'Loading...' ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Geocoding...</span>
                ) : startAddress}
              </div>
            </div>
            <div className="p-3 bg-[#009FFD]/10 border border-[#00E5FF]/20 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="w-3 h-3 text-[#FF4D4D]" />
                <span className="text-[10px] text-[#FF4D4D] font-medium">END</span>
              </div>
              <div className="text-xs text-[#D9DCE1]/70 line-clamp-2">
                {endAddress === 'Loading...' ? (
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Geocoding...</span>
                ) : endAddress}
              </div>
            </div>
          </div>

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
              placeholder="e.g., Custom Karachi to Lahore Route"
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

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#28B463] hover:bg-[#28B463]/80 text-white rounded-lg transition-all duration-200 hover:scale-105 neon-glow"
            >
              Save Route
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
