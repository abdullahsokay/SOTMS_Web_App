import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Marker } from '@react-google-maps/api';
import { MapOverlay } from './MapOverlay';
import { VehicleTrackingData } from '../../types/tracking';
import { getMarkerIcon, getTrackingStatus, getRelativeTime, STATUS_COLORS } from '../../utils/mapUtils';
import { BreadcrumbTrail } from './BreadcrumbTrail';
import { Minimize2 } from 'lucide-react';

const ANIMATION_DURATION_MS = 1000;

// Ease-out cubic
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Shortest-path bearing interpolation (handles 350 -> 10 correctly)
function lerpBearing(from: number, to: number, t: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

interface AnimatedVehicleMarkerProps {
  data: VehicleTrackingData;
  onClick?: () => void;
}

export const AnimatedVehicleMarker = memo(function AnimatedVehicleMarker({
  data,
  onClick,
}: AnimatedVehicleMarkerProps) {
  const { current, trail, vehicleId } = data;

  // Displayed position (animated)
  const [pos, setPos] = useState({ lat: current.lat, lng: current.lng });
  const [bearing, setBearing] = useState(current.bearing);
  const [showInfo, setShowInfo] = useState(false);

  // Animation refs
  const rafRef = useRef<number>(0);
  const startRef = useRef<{ lat: number; lng: number; bearing: number } | null>(null);
  const targetRef = useRef({ lat: current.lat, lng: current.lng, bearing: current.bearing });
  const firstRender = useRef(true);

  // Animate toward target
  const animate = useCallback((startTime: number) => {
    const start = startRef.current;
    if (!start) return;

    const target = targetRef.current;
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / ANIMATION_DURATION_MS, 1);
    const eased = easeOutCubic(progress);

    setPos({
      lat: start.lat + (target.lat - start.lat) * eased,
      lng: start.lng + (target.lng - start.lng) * eased,
    });
    setBearing(lerpBearing(start.bearing, target.bearing, eased));

    if (progress < 1) {
      rafRef.current = requestAnimationFrame(() => animate(startTime));
    }
  }, []);

  // React to new target position
  useEffect(() => {
    const newTarget = { lat: current.lat, lng: current.lng, bearing: current.bearing };

    // First render: snap immediately, no animation
    if (firstRender.current) {
      firstRender.current = false;
      targetRef.current = newTarget;
      setPos({ lat: newTarget.lat, lng: newTarget.lng });
      setBearing(newTarget.bearing);
      return;
    }

    // Skip animation for tiny moves (<0.1m ~ 0.000001 degrees)
    const dLat = Math.abs(newTarget.lat - targetRef.current.lat);
    const dLng = Math.abs(newTarget.lng - targetRef.current.lng);
    if (dLat < 0.000001 && dLng < 0.000001) {
      targetRef.current = newTarget;
      return;
    }

    // Cancel any running animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Start from current displayed position
    startRef.current = { lat: pos.lat, lng: pos.lng, bearing };
    targetRef.current = newTarget;

    const startTime = performance.now();
    rafRef.current = requestAnimationFrame(() => animate(startTime));

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [current.lat, current.lng, current.bearing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const status = getTrackingStatus(current.speed, current.timestamp);
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.default;

  const handleClick = useCallback(() => {
    setShowInfo(prev => !prev);
    onClick?.();
  }, [onClick]);

  return (
    <>
      {/* Breadcrumb trail */}
      <BreadcrumbTrail trail={trail} status={status} />

      {/* Animated marker */}
      <Marker
        position={pos}
        onClick={handleClick}
        icon={{
          url: getMarkerIcon(status, bearing),
          scaledSize: new google.maps.Size(48, 48),
          anchor: new google.maps.Point(24, 24),
        }}
        zIndex={1000}
      />

      {/* Expanded info panel */}
      {showInfo && (
        <MapOverlay
          position={pos}
          getPixelPositionOffset={(width, height) => ({
            x: -(width / 2),
            y: -(height + 30),
          })}
        >
          <div className="relative pointer-events-auto min-w-[220px] animate-fade-in">
            <div
              className="bg-[#0C1E2C] backdrop-blur-md rounded-xl overflow-hidden"
              style={{
                border: `1px solid ${statusColor}60`,
                boxShadow: `0 4px 24px rgba(0,0,0,0.5), 0 0 20px ${statusColor}25`,
              }}
            >
              {/* Header */}
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, ${statusColor}25, transparent)` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm tracking-wide">{vehicleId}</span>
                  <span
                    className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase"
                    style={{
                      color: statusColor,
                      backgroundColor: `${statusColor}20`,
                      border: `1px solid ${statusColor}50`,
                    }}
                  >
                    {status}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInfo(false); }}
                  title="Close"
                  className="p-1 rounded-md hover:bg-white/10 transition-colors"
                >
                  <Minimize2 size={14} className="text-[#D9DCE1]/60" />
                </button>
              </div>

              {/* Metrics grid */}
              <div className="px-4 py-3 grid grid-cols-2 gap-2">
                <div className="bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                  <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-1">Speed</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-mono font-bold" style={{ color: statusColor }}>{current.speed}</span>
                    <span className="text-[10px] text-[#D9DCE1]/40">km/h</span>
                  </div>
                </div>
                <div className="bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                  <div className="text-[9px] text-[#D9DCE1]/50 uppercase tracking-wider mb-1">Bearing</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-mono font-bold text-white">{Math.round(current.bearing)}</span>
                    <span className="text-[10px] text-[#D9DCE1]/40">deg</span>
                  </div>
                </div>
              </div>

              {/* Driver row */}
              {current.driver && (
                <div className="px-4 pb-2">
                  <div className="flex items-center justify-between bg-[#07121A] rounded-lg p-2.5 border border-[#00E5FF]/10">
                    <span className="text-[10px] text-[#D9DCE1]/50 uppercase tracking-wider">Driver</span>
                    <span className="text-xs text-white font-medium truncate max-w-[130px]">{current.driver}</span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div
                className="px-4 py-2 text-center border-t"
                style={{ borderColor: `${statusColor}20` }}
              >
                <span className="text-[10px] text-[#D9DCE1]/40">Updated </span>
                <span className={`text-[10px] font-medium ${status === 'offline' ? 'text-[#FF4D4D]' : 'text-[#D9DCE1]/60'}`}>
                  {getRelativeTime(current.timestamp)}
                </span>
              </div>
            </div>

            {/* Arrow pointer */}
            <div className="flex justify-center">
              <div
                className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px]"
                style={{ borderTopColor: `${statusColor}60` }}
              />
            </div>
          </div>
        </MapOverlay>
      )}

      {/* Compact label */}
      {!showInfo && (
        <MapOverlay
          position={pos}
          getPixelPositionOffset={(width) => ({
            x: -(width / 2),
            y: 28,
          })}
        >
          <div
            className="relative pointer-events-auto cursor-pointer hover:scale-105 transition-transform"
            onClick={(e) => { e.stopPropagation(); setShowInfo(true); }}
          >
            {/* Arrow pointing up to marker */}
            <div className="flex justify-center">
              <div
                className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px]"
                style={{ borderBottomColor: `${statusColor}80` }}
              />
            </div>
            {/* Card */}
            <div
              className="bg-[#0C1E2C] rounded-lg overflow-hidden min-w-[130px]"
              style={{
                border: `1px solid ${statusColor}60`,
                boxShadow: `0 2px 12px rgba(0,0,0,0.4), 0 0 10px ${statusColor}15`,
              }}
            >
              {/* Status bar header */}
              <div
                className="px-3 py-1.5 flex items-center justify-between gap-2"
                style={{ background: `linear-gradient(135deg, ${statusColor}30, ${statusColor}10)` }}
              >
                <span className="text-[11px] font-bold text-white tracking-wide">{vehicleId}</span>
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                  style={{
                    color: statusColor,
                    backgroundColor: `${statusColor}25`,
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  {status}
                </span>
              </div>
              {/* Metrics */}
              <div className="px-3 py-1.5 flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-mono font-bold text-white">{current.speed}</span>
                  <span className="text-[9px] text-[#D9DCE1]/50">km/h</span>
                </div>
                <span className="text-[9px] text-[#D9DCE1]/40">{getRelativeTime(current.timestamp)}</span>
              </div>
            </div>
          </div>
        </MapOverlay>
      )}
    </>
  );
});
