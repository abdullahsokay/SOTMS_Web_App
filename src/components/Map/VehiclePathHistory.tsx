import { memo, useState, Fragment } from 'react';
import { Polyline, Marker, OverlayView } from '@react-google-maps/api';
import { PathSegment, StopMarkerData, HistoricalGPSPoint } from '../../types/tracking';
import { getMarkerIcon } from '../../utils/mapUtils';
import { Clock, X } from 'lucide-react';

const SEGMENT_COLORS: Record<string, string> = {
  moving: '#28B463',
  idle: '#FFB02E',
  stopped: '#FF4D4D',
};

interface VehiclePathHistoryProps {
  segments: PathSegment[];
  stops: StopMarkerData[];
  startPoint?: HistoricalGPSPoint;
  endPoint?: HistoricalGPSPoint;
  replayPosition?: HistoricalGPSPoint | null;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const VehiclePathHistory = memo(function VehiclePathHistory({
  segments,
  stops,
  startPoint,
  endPoint,
  replayPosition,
}: VehiclePathHistoryProps) {
  const [activeStop, setActiveStop] = useState<string | null>(null);

  return (
    <>
      {/* Color-coded path segments */}
      {segments.map((seg, i) => (
        <Polyline
          key={`seg-${i}`}
          path={seg.path}
          options={{
            strokeColor: SEGMENT_COLORS[seg.status] || '#00E5FF',
            strokeOpacity: 0.85,
            strokeWeight: 5,
            zIndex: 800,
          }}
        />
      ))}

      {/* Stop markers */}
      {stops.map(stop => (
        <Fragment key={stop.id}>
          <Marker
            position={{ lat: stop.lat, lng: stop.lng }}
            onClick={() => setActiveStop(activeStop === stop.id ? null : stop.id)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#FF4D4D',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
            zIndex={850}
          />
          {activeStop === stop.id && (
            <OverlayView
              position={{ lat: stop.lat, lng: stop.lng }}
              mapPaneName="floatPane"
              getPixelPositionOffset={(w, h) => ({ x: -(w / 2), y: -(h + 15) })}
            >
              <div className="bg-[#0C1E2C]/95 backdrop-blur-md border border-[#FF4D4D]/50 p-3 rounded-xl shadow-lg min-w-[180px] text-white relative animate-fade-in">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveStop(null); }}
                  title="Close"
                  className="absolute -top-2 -right-2 bg-[#0C1E2C] border border-[#FF4D4D]/50 rounded-full p-0.5 text-[#FF4D4D] hover:bg-[#FF4D4D] hover:text-white transition-colors z-50"
                >
                  <X size={12} />
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-[#FF4D4D]" />
                  <span className="text-sm font-bold text-[#FF4D4D]">Stop Point</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#D9DCE1]/60">Duration</span>
                    <span className="font-mono text-white">{formatDuration(stop.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#D9DCE1]/60">From</span>
                    <span className="font-mono text-[#D9DCE1]">{formatTime(stop.startTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#D9DCE1]/60">To</span>
                    <span className="font-mono text-[#D9DCE1]">{formatTime(stop.endTime)}</span>
                  </div>
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#FF4D4D]/50"></div>
              </div>
            </OverlayView>
          )}
        </Fragment>
      ))}

      {/* Start marker */}
      {startPoint && (
        <Marker
          position={{ lat: startPoint.lat, lng: startPoint.lng }}
          label={{
            text: 'S',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#28B463',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          }}
          zIndex={900}
        />
      )}

      {/* End marker */}
      {endPoint && (
        <Marker
          position={{ lat: endPoint.lat, lng: endPoint.lng }}
          label={{
            text: 'E',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: '#FF4D4D',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3,
          }}
          zIndex={900}
        />
      )}

      {/* Replay position marker */}
      {replayPosition && (
        <Marker
          position={{ lat: replayPosition.lat, lng: replayPosition.lng }}
          icon={{
            url: getMarkerIcon('moving', replayPosition.heading),
            scaledSize: new google.maps.Size(52, 52),
            anchor: new google.maps.Point(26, 26),
          }}
          zIndex={1100}
        />
      )}
    </>
  );
});
