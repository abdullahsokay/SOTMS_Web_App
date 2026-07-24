import { Route as RouteIcon, Play, Pause, RotateCcw, Download, Loader2, MapPin } from 'lucide-react';
import { PathTimeRange, PathSummary, HistoricalGPSPoint } from '../../types/tracking';
import { generateKML, downloadKML } from '../../utils/kmlExport';

type ReplaySpeed = 1 | 2 | 5 | 10;

interface PathHistoryControlsProps {
  vehicleId: string;
  isActive: boolean;
  onToggle: () => void;
  timeRange: PathTimeRange;
  onTimeRangeChange: (range: PathTimeRange) => void;
  summary?: PathSummary;
  loading?: boolean;
  // Replay
  isPlaying?: boolean;
  replaySpeed?: ReplaySpeed;
  replayProgress?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onSpeedChange?: (speed: ReplaySpeed) => void;
  onScrub?: (progress: number) => void;
  // For KML export
  points?: HistoricalGPSPoint[];
  stops?: Array<{ id: string; lat: number; lng: number; duration: number; startTime: number; endTime: number }>;
}

const TIME_RANGES: PathTimeRange[] = ['6h', '12h', '24h', '7d'];
const SPEEDS: ReplaySpeed[] = [1, 2, 5, 10];

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

export function PathHistoryControls({
  vehicleId,
  isActive,
  onToggle,
  timeRange,
  onTimeRangeChange,
  summary,
  loading = false,
  isPlaying = false,
  replaySpeed = 1,
  replayProgress = 0,
  onPlay,
  onPause,
  onReset,
  onSpeedChange,
  onScrub,
  points = [],
  stops = [],
}: PathHistoryControlsProps) {
  const handleExportKML = () => {
    if (points.length === 0) return;
    const kml = generateKML(vehicleId, points, stops, timeRange);
    downloadKML(vehicleId, kml);
  };

  return (
    <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-lg overflow-hidden">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-3 flex items-center justify-center gap-2 text-sm transition-all ${
          isActive
            ? 'bg-[#009FFD]/20 border-b border-[#00E5FF]/30 text-[#00E5FF]'
            : 'hover:bg-[#009FFD]/10 text-[#00E5FF]/70'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RouteIcon className="w-4 h-4" />
        )}
        {isActive ? 'Hide Path History' : 'View Path History'}
      </button>

      {/* Expanded Controls */}
      {isActive && (
        <div className="p-3 space-y-3 animate-fade-in">
          {/* Time Range Selector */}
          <div>
            <div className="text-[10px] text-[#D9DCE1]/50 mb-1.5 uppercase tracking-wider">Time Range</div>
            <div className="flex gap-1">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onTimeRangeChange(r)}
                  className={`flex-1 py-1.5 text-xs rounded transition-all ${
                    timeRange === r
                      ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50'
                      : 'bg-[#0C1E2C] text-[#D9DCE1]/60 border border-[#00E5FF]/10 hover:border-[#00E5FF]/30'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Path Summary */}
          {summary && points.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#00E5FF]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Distance</div>
                <div className="text-sm text-white font-mono">{summary.totalDistance} km</div>
              </div>
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#00E5FF]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Duration</div>
                <div className="text-sm text-white font-mono">{formatDuration(summary.totalDuration)}</div>
              </div>
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#00E5FF]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Avg Speed</div>
                <div className="text-sm text-[#00E5FF] font-mono">{summary.avgSpeed} km/h</div>
              </div>
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#00E5FF]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Max Speed</div>
                <div className="text-sm text-[#FFB02E] font-mono">{summary.maxSpeed} km/h</div>
              </div>
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#FF4D4D]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Stops</div>
                <div className="text-sm text-[#FF4D4D] font-mono">{summary.stopCount}</div>
              </div>
              <div className="bg-[#0C1E2C] p-2 rounded border border-[#FF4D4D]/10">
                <div className="text-[10px] text-[#D9DCE1]/50">Stop Time</div>
                <div className="text-sm text-[#FF4D4D] font-mono">{formatDuration(summary.totalStopTime)}</div>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 text-[#00E5FF] animate-spin mx-auto mb-2" />
              <div className="text-xs text-[#D9DCE1]/50">Loading path data...</div>
            </div>
          ) : (
            <div className="text-center py-4">
              <MapPin className="w-5 h-5 text-[#D9DCE1]/30 mx-auto mb-2" />
              <div className="text-xs text-[#D9DCE1]/50">No path data available for this time range</div>
            </div>
          )}

          {/* Replay Controls */}
          {points.length >= 2 && (
            <div className="border-t border-[#00E5FF]/10 pt-3">
              <div className="text-[10px] text-[#D9DCE1]/50 mb-1.5 uppercase tracking-wider">Replay</div>

              {/* Progress Bar */}
              <div className="mb-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={replayProgress}
                  onChange={(e) => onScrub?.(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#0C1E2C] rounded-lg appearance-none cursor-pointer accent-[#00E5FF]"
                />
                <div className="flex justify-between text-[9px] text-[#D9DCE1]/40 mt-0.5 font-mono">
                  <span>{Math.round(replayProgress)}%</span>
                  <span>{replaySpeed}x</span>
                </div>
              </div>

              {/* Play/Pause/Reset + Speed */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isPlaying ? onPause : onPlay}
                  className="p-2 bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/30 rounded-lg text-[#00E5FF] transition-all"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="p-2 bg-[#0C1E2C] hover:bg-[#009FFD]/20 border border-[#00E5FF]/10 rounded-lg text-[#D9DCE1]/60 transition-all"
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>

                {/* Speed buttons */}
                <div className="flex-1 flex gap-1">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSpeedChange?.(s)}
                      className={`flex-1 py-1 text-[10px] rounded transition-all ${
                        replaySpeed === s
                          ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50'
                          : 'bg-[#0C1E2C] text-[#D9DCE1]/50 border border-[#00E5FF]/10'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legend + Export */}
          <div className="border-t border-[#00E5FF]/10 pt-3 flex items-center justify-between">
            <div className="flex gap-3 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-1 rounded bg-[#28B463]"></div>
                <span className="text-[#D9DCE1]/50">Moving</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-1 rounded bg-[#FFB02E]"></div>
                <span className="text-[#D9DCE1]/50">Idle</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-1 rounded bg-[#FF4D4D]"></div>
                <span className="text-[#D9DCE1]/50">Stopped</span>
              </div>
            </div>

            {points.length > 0 && (
              <button
                type="button"
                onClick={handleExportKML}
                className="p-1.5 bg-[#0C1E2C] hover:bg-[#009FFD]/20 border border-[#00E5FF]/10 rounded text-[#D9DCE1]/60 transition-all"
                title="Export KML"
              >
                <Download size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
