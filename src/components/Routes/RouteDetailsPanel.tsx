import { useState, useEffect } from 'react';
import { Route, BlackSpot } from '../../types';
import { X, MapPin, Truck, User, Clock, Ruler, AlertTriangle, Save, Trash2, Building2 } from 'lucide-react';
import { StreetViewThumbnail } from '../Map/StreetViewThumbnail';
import { StreetViewModal } from '../Map/StreetViewModal';
import { useGPSData } from '../../hooks/useGPSData';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

interface RouteDetailsPanelProps {
  route: Route;
  onClose: () => void;
  onUpdate: (route: Route) => void;
}

const companyColors = {
  PSO: '#28B463',
  Attock: '#009FFD',
  Shell: '#FFB02E',
  Hascol: '#9B59B6'
};

export function RouteDetailsPanel({ route, onClose, onUpdate }: RouteDetailsPanelProps) {
  const { companyId } = useCompany();
  const { tankers } = useGPSData();
  const [isEditing, setIsEditing] = useState(false);
  const [editedRoute, setEditedRoute] = useState(route);
  const [blackSpots, setBlackSpots] = useState<BlackSpot[]>([]);
  const [streetViewModal, setStreetViewModal] = useState<{
    location: { lat: number; lng: number; address?: string };
    title: string;
  } | null>(null);

  // Load black spots from Firebase (tenant-scoped)
  useEffect(() => {
    if (!companyId) {
      setBlackSpots([]);
      return;
    }
    const unsub = onSnapshot(query(collection(db, 'blackspots'), where('companyId', '==', companyId)), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlackSpot));
      setBlackSpots(data);
    });
    return () => unsub();
  }, [companyId]);

  const assignedTanker = tankers.find(t => t.id === route.assignedTanker);
  const routeBlackSpots = blackSpots.filter(bs => (route.blackSpots ?? []).includes(bs.id));

  const handleSave = () => {
    onUpdate(editedRoute);
    setIsEditing(false);
  };

  return (
    <div className="w-96 bg-[#0C1E2C] border-l border-[#00E5FF]/20 flex flex-col animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[#00E5FF]/20 bg-gradient-to-r from-[#0C1E2C] to-[#07121A]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg text-white">Route Details</h2>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 hover:bg-[#009FFD]/20 rounded transition-all"
          >
            <X className="w-5 h-5 text-[#D9DCE1]" />
          </button>
        </div>
        <div className="text-xs text-[#D9DCE1]/60">{route.id}</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* Route Name */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-1 block">Route Name</label>
          {isEditing ? (
            <input
              type="text"
              value={editedRoute.name}
              onChange={(e) => setEditedRoute({ ...editedRoute, name: e.target.value })}
              className="w-full px-3 py-2 bg-[#07121A] border border-[#00E5FF]/30 rounded-lg text-white text-sm focus:outline-none focus:border-[#00E5FF]"
            />
          ) : (
            <div className="text-white">{route.name}</div>
          )}
        </div>

        {/* Company */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-1 block">Company</label>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" style={{ color: companyColors[route.company] }} />
            <div
              className="px-3 py-1 rounded text-sm text-white"
              style={{ backgroundColor: companyColors[route.company] }}
            >
              {route.company}
            </div>
          </div>
        </div>

        {/* Start Location */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#28B463]" />
            Start Location
          </label>
          <div className="text-sm text-white bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-3">
            {route.startLocation.address}
          </div>
          <div className="mt-2">
            <StreetViewThumbnail
              location={route.startLocation}
              size={{ width: 328, height: 185 }}
              onExpand={() => setStreetViewModal({
                location: route.startLocation,
                title: 'Start Location',
              })}
            />
          </div>
        </div>

        {/* End Location */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#FF4D4D]" />
            End Location
          </label>
          <div className="text-sm text-white bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-3">
            {route.endLocation.address}
          </div>
          <div className="mt-2">
            <StreetViewThumbnail
              location={route.endLocation}
              size={{ width: 328, height: 185 }}
              onExpand={() => setStreetViewModal({
                location: route.endLocation,
                title: 'End Location',
              })}
            />
          </div>
        </div>

        {/* Waypoints */}
        {(route.waypoints ?? []).length > 0 && (
          <div>
            <label className="text-xs text-[#D9DCE1]/60 mb-2 block">Waypoints</label>
            <div className="space-y-2">
              {(route.waypoints ?? []).map((wp, index) => {
                const wpColor = wp.type === 'delivery' ? '#FFB02E' : wp.type === 'stop' ? '#9B59B6' : '#00E5FF';
                return (
                  <div
                    key={index}
                    className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: wpColor }}></div>
                      <div className="flex-1">
                        <div className="text-xs text-white">{wp.name || `Waypoint ${index + 1}`}</div>
                        <div className="text-xs text-[#D9DCE1]/60 capitalize">{wp.type}</div>
                      </div>
                    </div>
                    <StreetViewThumbnail
                      location={{ lat: wp.lat, lng: wp.lng }}
                      size={{ width: 296, height: 167 }}
                      onExpand={() => setStreetViewModal({
                        location: { lat: wp.lat, lng: wp.lng, address: wp.name || `Waypoint ${index + 1}` },
                        title: wp.name || `Waypoint ${index + 1}`,
                      })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Assigned Tanker */}
        {route.assignedTanker && assignedTanker && (
          <div>
            <label className="text-xs text-[#D9DCE1]/60 mb-2 flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Assigned Tanker
            </label>
            <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-white">{assignedTanker.id}</div>
                <div className="text-xs text-[#D9DCE1]/60">{assignedTanker.name}</div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="text-[#D9DCE1]/60">Fuel:</div>
                  <div className="text-[#00E5FF]">{assignedTanker.fuelLevel}%</div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-[#D9DCE1]/60">Load:</div>
                  <div className="text-[#00E5FF]">{(assignedTanker.loadWeight / 1000).toFixed(1)}t</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Assigned Driver */}
        {route.assignedDriver && (
          <div>
            <label className="text-xs text-[#D9DCE1]/60 mb-2 flex items-center gap-1">
              <User className="w-3 h-3" />
              Assigned Driver
            </label>
            <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg p-3">
              <div className="text-sm text-white">{route.assignedDriver}</div>
              {(route.assignedDriverContact || assignedTanker?.driverContact) && (
                <div className="text-xs text-[#D9DCE1]/60 mt-1">{route.assignedDriverContact || assignedTanker?.driverContact}</div>
              )}
            </div>
          </div>
        )}

        {/* Geofence Radius */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-2 block">Geofence Radius</label>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={editedRoute.geofenceRadius}
                onChange={(e) => setEditedRoute({ ...editedRoute, geofenceRadius: parseInt(e.target.value) })}
                className="w-full accent-[#009FFD]"
              />
              <div className="text-right text-sm text-[#00E5FF]">{editedRoute.geofenceRadius}m</div>
            </div>
          ) : (
            <div className="text-white">{route.geofenceRadius}m</div>
          )}
        </div>

        {/* Route Type */}
        <div>
          <label className="text-xs text-[#D9DCE1]/60 mb-1 block">Route Type</label>
          <div className="text-white capitalize">{route.routeType}</div>
        </div>

        {/* Travel Estimation */}
        <div className="bg-gradient-to-r from-[#009FFD]/10 to-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-lg p-3">
          <div className="text-xs text-[#D9DCE1]/60 mb-2">Travel Estimation</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Ruler className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-[#D9DCE1]/80">Distance</span>
              </div>
              <div className="text-white">{route.distance} km</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-[#D9DCE1]/80">Duration</span>
              </div>
              <div className="text-white">{Math.floor(route.estimatedDuration / 60)}h {route.estimatedDuration % 60}m</div>
            </div>
          </div>
        </div>

        {/* Black Spots */}
        {routeBlackSpots.length > 0 && (
          <div>
            <label className="text-xs text-[#D9DCE1]/60 mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[#FF4D4D]" />
              Black Spots Detected
            </label>
            <div className="space-y-2">
              {routeBlackSpots.map((spot) => {
                const threatColor = spot.threatLevel === 'high' ? '#FF4D4D' : spot.threatLevel === 'medium' ? '#FFB02E' : '#FFD93D';
                return (
                  <div
                    key={spot.id}
                    className="bg-[#07121A] border rounded-lg p-3"
                    style={{ borderColor: `${threatColor}40` }}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="text-sm text-white">{spot.name}</div>
                      <div
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor: `${threatColor}20`,
                          color: threatColor
                        }}
                      >
                        {spot.threatLevel}
                      </div>
                    </div>
                    <div className="text-xs text-[#D9DCE1]/60">{spot.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Route History */}
        {route.lastUsed && (
          <div>
            <label className="text-xs text-[#D9DCE1]/60 mb-1 block">Last Used</label>
            <div className="text-sm text-white">{route.lastUsed}</div>
          </div>
        )}
      </div>

      {/* Street View Modal */}
      {streetViewModal && (
        <StreetViewModal
          location={streetViewModal.location}
          onClose={() => setStreetViewModal(null)}
        />
      )}

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#00E5FF]/20 bg-[#07121A]">
        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#28B463] hover:bg-[#28B463]/80 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 neon-glow"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={() => {
                setEditedRoute(route);
                setIsEditing(false);
              }}
              className="flex-1 px-4 py-2 bg-[#D9DCE1]/20 hover:bg-[#D9DCE1]/30 text-[#D9DCE1] rounded-lg transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 px-4 py-2 bg-[#009FFD] hover:bg-[#009FFD]/80 text-white rounded-lg transition-all duration-200 neon-glow"
            >
              Edit Route
            </button>
            <button
              title="Delete route"
              className="px-4 py-2 bg-[#FF4D4D]/20 hover:bg-[#FF4D4D]/30 text-[#FF4D4D] border border-[#FF4D4D]/30 rounded-lg transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
