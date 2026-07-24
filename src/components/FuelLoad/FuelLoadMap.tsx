import { ZoomIn, ZoomOut, Maximize2, Layers, List, Navigation } from 'lucide-react';
import { Tanker } from '../../types';
import pakistanMap from '../../assets/115851dd053067e8a3c2de80232e0b51c167cd6d.png';

interface FuelLoadMapProps {
  tankers: Tanker[];
  selectedTanker: Tanker | null;
  onSelectTanker: (tanker: Tanker) => void;
  onToggleVehicleList: () => void;
  showVehicleList: boolean;
}

export function FuelLoadMap({ tankers, selectedTanker, onSelectTanker, onToggleVehicleList, showVehicleList }: FuelLoadMapProps) {
  const statusColors = {
    moving: '#28B463',
    idle: '#FFB02E',
    parked: '#009FFD',
    alert: '#FF4D4D',
    offline: '#7F8C8D'
  };

  const getFuelColor = (fuelLevel: number) => {
    if (fuelLevel > 60) return '#28B463';
    if (fuelLevel > 30) return '#FFB02E';
    return '#FF4D4D';
  };

  return (
    <div className="relative h-full">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-[#0C1E2C] to-transparent p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg text-white neon-text">Live Fleet Map</h3>
          
          <div className="flex gap-2">
            <button
              onClick={onToggleVehicleList}
              title="Toggle vehicle list"
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 ${
                showVehicleList ? 'bg-[#009FFD]/30' : 'bg-[#009FFD]/20'
              }`}
            >
              <List className="w-5 h-5 text-[#00E5FF]" />
            </button>
            <button title="Zoom in" className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-110">
              <ZoomIn className="w-5 h-5 text-[#00E5FF]" />
            </button>
            <button title="Zoom out" className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-110">
              <ZoomOut className="w-5 h-5 text-[#00E5FF]" />
            </button>
            <button title="Map layers" className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-110">
              <Layers className="w-5 h-5 text-[#00E5FF]" />
            </button>
            <button title="Fullscreen" className="p-2 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 rounded-lg transition-all duration-200 hover:scale-110">
              <Maximize2 className="w-5 h-5 text-[#00E5FF]" />
            </button>
          </div>
        </div>
      </div>

      {/* Map Background */}
      <div className="absolute inset-0 bg-[#07121A]">
        {/* Pakistan Map Background - Full Rectangle */}
        <img
          src={pakistanMap}
          alt="Pakistan fleet map"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Subtle overlay for better visibility */}
        <div className="absolute inset-0 bg-[#07121A]/25" />

        {/* SVG Map Container */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="mapGlowFuel">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="routeGradientFuel" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0, 229, 255, 0.3)" />
              <stop offset="50%" stopColor="rgba(0, 159, 253, 0.5)" />
              <stop offset="100%" stopColor="rgba(0, 229, 255, 0.3)" />
            </linearGradient>
          </defs>
          
          {/* Major Cities */}
          <g opacity="0.7">
            <circle cx="380" cy="450" r="4" fill="#00E5FF" />
            <text x="387" y="453" fill="#D9DCE1" fontSize="11">Karachi</text>
            
            <circle cx="520" cy="280" r="4" fill="#00E5FF" />
            <text x="527" y="283" fill="#D9DCE1" fontSize="11">Lahore</text>
            
            <circle cx="540" cy="220" r="4" fill="#00E5FF" />
            <text x="547" y="223" fill="#D9DCE1" fontSize="11">Islamabad</text>
            
            <circle cx="500" cy="340" r="4" fill="#00E5FF" />
            <text x="507" y="343" fill="#D9DCE1" fontSize="11">Multan</text>
          </g>

          {/* Route Lines */}
          <path
            d="M 380 450 Q 450 365 520 280 L 540 220"
            stroke="url(#routeGradientFuel)"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="8,4"
            className="animate-dash"
            opacity="0.6"
          />
          <path
            d="M 520 280 L 500 340 L 380 450"
            stroke="url(#routeGradientFuel)"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="8,4"
            className="animate-dash"
            style={{ animationDelay: '0.3s' }}
            opacity="0.6"
          />
        </svg>

        {/* Tanker Markers */}
        {tankers.map((tanker, index) => {
          const left = 15 + (index * 16) + (index % 2 === 0 ? 8 : -3);
          const top = 25 + (index * 11) + (index % 3 === 0 ? 12 : -8);
          const isSelected = selectedTanker?.id === tanker.id;
          const fuelColor = getFuelColor(tanker.fuelLevel);

          return (
            <div
              key={tanker.id}
              style={{ 
                left: `${left}%`, 
                top: `${top}%`,
                animationDelay: `${index * 0.1}s`,
                transform: isSelected ? 'translate(-50%, -50%) scale(1.3)' : 'translate(-50%, -50%)',
                zIndex: isSelected ? 50 : 10
              }}
              className="absolute cursor-pointer transition-all duration-300 animate-fade-in"
              onClick={() => onSelectTanker(tanker)}
            >
              {/* Pulsing Ring */}
              {tanker.status === 'moving' && (
                <div
                  className="absolute inset-0 w-16 h-16 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full pulse-glow"
                  style={{ backgroundColor: statusColors[tanker.status] }}
                />
              )}

              {/* Main Marker */}
              <div
                className="relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-125 transition-transform duration-200 border-2 border-white/20"
                style={{
                  backgroundColor: statusColors[tanker.status],
                  boxShadow: `0 0 25px ${statusColors[tanker.status]}80`
                }}
              >
                <Navigation className="w-6 h-6 text-white" style={{ transform: 'rotate(45deg)' }} />
              </div>

              {/* Fuel Level Ring */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[#0C1E2C] flex items-center justify-center text-[10px] font-bold"
                style={{ backgroundColor: fuelColor }}
              >
                {tanker.fuelLevel}
              </div>

              {/* Info Tooltip */}
              <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#0C1E2C] border border-[#00E5FF]/50 rounded-lg p-3 min-w-[200px] z-20 neon-glow opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="text-sm text-white mb-1 font-bold">{tanker.name}</div>
                <div className="text-xs text-[#D9DCE1]/70 mb-2">{tanker.driver}</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#D9DCE1]/60">Speed:</span>
                    <span className="text-[#00E5FF]">{tanker.speed} km/h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#D9DCE1]/60">Fuel:</span>
                    <span style={{ color: fuelColor }}>{tanker.fuelLevel}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#D9DCE1]/60">Load:</span>
                    <span className="text-[#00E5FF]">{(tanker.loadWeight / 1000).toFixed(1)}T</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#D9DCE1]/60">Status:</span>
                    <span className="text-white capitalize">{tanker.status}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-[#0C1E2C]/90 backdrop-blur-sm border border-[#00E5FF]/30 rounded-lg p-3 neon-glow">
          <div className="text-xs text-white mb-2">Status Legend</div>
          <div className="space-y-1">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#D9DCE1]/70 capitalize">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}