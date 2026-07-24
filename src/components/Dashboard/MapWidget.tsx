import { useState, useCallback, useEffect, useRef, Fragment } from 'react';
import { GoogleMap, Marker } from '@react-google-maps/api';
import { MapOverlay } from '../Map/MapOverlay';
import { Tanker } from '../../types';
import { Droplet, Maximize2, Minimize2, Signal, MapPin } from 'lucide-react';
import { useGoogleMaps } from '../../contexts/GoogleMapsContext';
import { darkMapStyle, containerStyle, defaultCenter, getMarkerIcon, getRelativeTime, STATUS_COLORS } from '../../utils/mapUtils';

interface MapWidgetProps {
  tankers: Tanker[];
  onTankerClick?: (tanker: Tanker) => void;
}

export function MapWidget({ tankers, onTankerClick }: MapWidgetProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showTraffic, setShowTraffic] = useState(false);
  const { isLoaded, loadError } = useGoogleMaps();

  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);

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

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Auto-fit bounds when tankers update
  useEffect(() => {
    if (map && tankers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      let validPoints = 0;

      tankers.forEach(tanker => {
        if (tanker.location.lat !== 0 || tanker.location.lng !== 0) {
          bounds.extend({ lat: tanker.location.lat, lng: tanker.location.lng });
          validPoints++;
        }
      });

      if (validPoints > 0) {
        map.fitBounds(bounds);

        // Prevent excessive zoom if there's only one point
        google.maps.event.addListenerOnce(map, "idle", () => {
          if (map.getZoom()! > 14) map.setZoom(14);
        });
      }
    }
  }, [map, tankers]);

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  if (loadError) {
    return (
      <div className={`bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow flex items-center justify-center text-red-500 h-[450px]`}>
        Error loading map: {loadError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow flex items-center justify-center h-[450px]`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00E5FF]"></div>
      </div>
    );
  }

  // Check API Key
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDZ0QE8_i8BorwZ1N2URBVenyqfxYPfvAg';
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className={`bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow flex items-center justify-center h-[450px] text-white`}>
        <div className="text-center">
          <p className="mb-2 text-[#00E5FF]">Google Maps Integration Required</p>
          <p className="text-xs text-gray-400">Please provide a valid API Key in .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-1 neon-glow flex flex-col relative ${isMaximized ? 'fixed inset-0 z-50 !rounded-none h-screen w-screen' : 'h-full min-h-[450px] transition-all duration-300'}`}>

      {/* Header / Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-[#0C1E2C]/80 backdrop-blur-sm p-2 rounded-lg border border-[#00E5FF]/20">
        <h3 className="text-sm font-bold text-white">Live Fleet Map</h3>
      </div>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setShowTraffic(!showTraffic)}
          className={`p-2 backdrop-blur-sm rounded-lg border transition-all ${
            showTraffic
              ? 'bg-[#28B463]/30 border-[#28B463]/50 text-[#28B463]'
              : 'bg-[#0C1E2C]/80 border-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#009FFD]/30'
          }`}
          title={showTraffic ? 'Hide Traffic' : 'Show Traffic'}
        >
          <MapPin size={18} />
        </button>
        <button
          onClick={toggleMaximize}
          className="p-2 bg-[#0C1E2C]/80 backdrop-blur-sm hover:bg-[#009FFD]/30 rounded-lg border border-[#00E5FF]/20 text-[#00E5FF] transition-all"
        >
          {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <div className="flex-1 rounded-lg overflow-hidden w-full h-full">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={defaultCenter}
          zoom={5}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            styles: darkMapStyle,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false, // We use our own maximize
            restriction: {
              latLngBounds: {
                north: 37.5,
                south: 23.0,
                east: 78.0,
                west: 60.0,
              },
              strictBounds: false,
            },
            minZoom: 5,
          }}
        >
          {tankers.map(tanker => {
            const sc = STATUS_COLORS[tanker.status] || STATUS_COLORS.default;
            return (
              <Fragment key={tanker.id}>
                <Marker
                  position={{ lat: tanker.location.lat, lng: tanker.location.lng }}
                  onClick={() => {
                    setActiveMarkerId(tanker.id);
                    onTankerClick?.(tanker);
                  }}
                  icon={{
                    url: getMarkerIcon(tanker.status, tanker.bearing ?? 0),
                    scaledSize: new google.maps.Size(48, 48),
                    anchor: new google.maps.Point(24, 24)
                  }}
                  zIndex={999}
                />

                {/* Expanded info panel */}
                {activeMarkerId === tanker.id && (
                  <MapOverlay
                    position={{ lat: tanker.location.lat, lng: tanker.location.lng }}

                    getPixelPositionOffset={(width, height) => ({
                      x: -(width / 2),
                      y: -(height + 30)
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
                      y: 28
                    })}
                  >
                    <div
                      className="relative pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMarkerId(tanker.id);
                        onTankerClick?.(tanker);
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
        </GoogleMap>
      </div>
    </div>
  );
}