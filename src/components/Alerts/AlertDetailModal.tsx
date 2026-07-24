import { X, MapPin, Clock, Thermometer, Fuel, Weight, Gauge, CheckCircle, MessageSquare, AlertTriangle, DoorOpen, ShieldAlert } from 'lucide-react';
import { Alert } from './AlertsPage';
import pakistanMapImage from '../../assets/d3bc89908b6f779589df69de66b97ffe9dc496aa.png';

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: () => void;
}

export function AlertDetailModal({ alert, onClose, onAcknowledge }: AlertDetailModalProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#FF3B30';
      case 'warning':
        return '#FF9500';
      case 'info':
        return '#00CFFF';
      default:
        return '#D9DCE1';
    }
  };

  const severityColor = getSeverityColor(alert.severity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0C1E2C] border border-[#00E5FF]/40 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto neon-glow-strong shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0C1E2C] border-b border-[#00E5FF]/30 p-6 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl text-white">Alert Details</h2>
              <span
                className="px-3 py-1 rounded-lg text-sm uppercase tracking-wide"
                style={{
                  backgroundColor: `${severityColor}30`,
                  color: severityColor,
                  border: `1px solid ${severityColor}60`
                }}
              >
                {alert.severity}
              </span>
            </div>
            <p className="text-[#D9DCE1]/70 text-sm">Alert ID: {alert.id}</p>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-[#00E5FF]/10 rounded-lg transition-all duration-200 text-[#D9DCE1] hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Alert Info Section */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-lg text-[#00E5FF] mb-4">Alert Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#D9DCE1]/60 mb-1">Alert Type</div>
                <div className="text-white">{alert.type}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/60 mb-1">Status</div>
                <div className="text-white capitalize">{alert.status}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/60 mb-1">Tanker ID</div>
                <div className="text-white">{alert.tankerId}</div>
              </div>
              <div>
                <div className="text-xs text-[#D9DCE1]/60 mb-1">Tanker Name</div>
                <div className="text-white">{alert.tankerName}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-[#D9DCE1]/60 mb-1 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timestamp
                </div>
                <div className="text-white">{alert.timestamp}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-[#D9DCE1]/60 mb-1">Description</div>
                <div className="text-white bg-[#0C1E2C] p-3 rounded-lg border border-[#00E5FF]/10">
                  {alert.description}
                </div>
              </div>
            </div>
          </div>

          {/* Sensor Data Section */}
          {alert.sensorData && (
            <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
              <h3 className="text-lg text-[#00E5FF] mb-4">Sensor Readings</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {alert.sensorData.fuelLevel !== undefined && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Fuel className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-xs text-[#D9DCE1]/60">Fuel Level</span>
                    </div>
                    <div className="text-2xl text-white">{alert.sensorData.fuelLevel}%</div>
                  </div>
                )}
                {alert.sensorData.loadWeight !== undefined && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Weight className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-xs text-[#D9DCE1]/60">Load Weight</span>
                    </div>
                    <div className="text-2xl text-white">{(alert.sensorData.loadWeight / 1000).toFixed(1)}T</div>
                  </div>
                )}
                {alert.sensorData.temperature !== undefined && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Thermometer className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-xs text-[#D9DCE1]/60">Temperature</span>
                    </div>
                    <div className="text-2xl text-white">{alert.sensorData.temperature}°C</div>
                  </div>
                )}
                {alert.sensorData.speed !== undefined && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-xs text-[#D9DCE1]/60">Speed</span>
                    </div>
                    <div className="text-2xl text-white">{alert.sensorData.speed} km/h</div>
                  </div>
                )}
                {alert.sensorData.valveStatus && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#00E5FF]/10 hover:border-[#00E5FF]/30 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-[#00E5FF]" />
                      <span className="text-xs text-[#D9DCE1]/60">Valve Status</span>
                    </div>
                    <div className="text-2xl text-white">{alert.sensorData.valveStatus}</div>
                  </div>
                )}
                {alert.sensorData.hatchStatus && (
                  <div className="bg-[#0C1E2C] p-4 rounded-lg border border-[#FF3B30]/30 hover:border-[#FF3B30]/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <DoorOpen className="w-5 h-5 text-[#FF3B30]" />
                      <span className="text-xs text-[#D9DCE1]/60">{alert.sensorData.hatchLabel || 'Hatch'}</span>
                    </div>
                    <div className="text-2xl text-[#FF3B30] font-bold">{alert.sensorData.hatchStatus}</div>
                  </div>
                )}
              </div>

              {/* All Hatches Status (for hatch_open_unauthorized alerts) */}
              {alert.sensorData.allHatches && alert.sensorData.allHatches.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm text-[#00E5FF] mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    All Inlet / Hatch Status (Reed Switch)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {alert.sensorData.allHatches.map((hatch) => (
                      <div
                        key={hatch.id}
                        className={`p-3 rounded-lg border flex items-center gap-3 ${
                          hatch.open
                            ? 'bg-[#FF3B30]/10 border-[#FF3B30]/40'
                            : 'bg-[#28B463]/10 border-[#28B463]/40'
                        }`}
                      >
                        <DoorOpen className={`w-5 h-5 ${hatch.open ? 'text-[#FF3B30]' : 'text-[#28B463]'}`} />
                        <div>
                          <div className="text-white text-sm">{hatch.label}</div>
                          <div className={`text-xs font-bold ${hatch.open ? 'text-[#FF3B30]' : 'text-[#28B463]'}`}>
                            {hatch.open ? 'OPEN' : 'CLOSED'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Location Section with Mini Map */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-lg text-[#00E5FF] mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Last Known Location
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-[#D9DCE1]/60 mb-1">Address</div>
                  <div className="text-white">{alert.location?.address ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-[#D9DCE1]/60 mb-1">Coordinates</div>
                  <div className="text-white font-mono text-sm">
                    {alert.location?.lat != null ? alert.location.lat.toFixed(4) : '—'}°N, {alert.location?.lng != null ? alert.location.lng.toFixed(4) : '—'}°E
                  </div>
                </div>
              </div>
              
              {/* Mini Map */}
              <div className="relative h-48 bg-[#0C1E2C] rounded-lg overflow-hidden border border-[#00E5FF]/20">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
                  <defs>
                    <filter id="miniMapGlow">
                      <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Pakistan Map */}
                  <image
                    href={pakistanMapImage}
                    x="20"
                    y="20"
                    width="360"
                    height="260"
                    opacity="0.6"
                    filter="url(#miniMapGlow)"
                    preserveAspectRatio="xMidYMid meet"
                  />
                  
                  {/* Location Marker */}
                  <g>
                    <circle cx="200" cy="150" r="20" fill="#FF3B30" opacity="0.3" className="animate-pulse" />
                    <circle cx="200" cy="150" r="8" fill="#FF3B30" stroke="white" strokeWidth="2" />
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-[#07121A] border border-[#00E5FF]/20 rounded-xl p-4">
            <h3 className="text-lg text-[#00E5FF] mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Add Comment
            </h3>
            <textarea
              placeholder="Add notes or comments about this alert..."
              className="w-full bg-[#0C1E2C] border border-[#00E5FF]/20 rounded-lg p-3 text-white placeholder-[#D9DCE1]/40 focus:border-[#00E5FF] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/30 transition-all resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-[#0C1E2C] border-t border-[#00E5FF]/30 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#07121A] border border-[#00E5FF]/20 hover:bg-[#00E5FF]/10 text-white rounded-lg transition-all duration-200"
          >
            Close
          </button>
          {alert.status === 'unacknowledged' && (
            <button
              onClick={onAcknowledge}
              className="px-6 py-2.5 bg-gradient-to-r from-[#009FFD] to-[#00E5FF] hover:from-[#00E5FF] hover:to-[#009FFD] text-white rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 hover:shadow-[0_0_20px_rgba(0,229,255,0.5)]"
            >
              <CheckCircle className="w-5 h-5" />
              Acknowledge Alert
            </button>
          )}
          {alert.status === 'acknowledged' && (
            <button
              className="px-6 py-2.5 bg-gradient-to-r from-[#28B463] to-[#20C997] hover:from-[#20C997] hover:to-[#28B463] text-white rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105"
            >
              <CheckCircle className="w-5 h-5" />
              Resolve Alert
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
