import { Tanker } from '../../types';
import { AlertTriangle, TrendingDown, Navigation, MapPin, DoorOpen, DoorClosed, Droplet } from 'lucide-react';

// fuelLevel is already a calibrated percentage (converted once at ingestion in
// GPSContext via distanceToFuelPercent). No re-conversion here.
function fuelColor(pct: number): string {
  if (pct > 60) return '#28B463';
  if (pct > 25) return '#FFB02E';
  return '#FF4D4D';
}

interface ExtendedTanker extends Tanker {
  fuelLossPercent: number;
  fuelStatus: 'Normal' | 'Alert' | 'Suspicious';
  oilQuantity: number;
  route: string;
  company: string;
}

interface FuelOverviewTableProps {
  tankers: ExtendedTanker[];
  selectedTanker: Tanker | null;
  onSelectTanker: (tanker: Tanker) => void;
}

export function FuelOverviewTable({ tankers, selectedTanker, onSelectTanker }: FuelOverviewTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'text-[#28B463] bg-[#28B463]/10';
      case 'Alert': return 'text-[#FFB02E] bg-[#FFB02E]/10';
      case 'Suspicious': return 'text-[#FF4D4D] bg-[#FF4D4D]/10';
      default: return 'text-[#D9DCE1] bg-[#D9DCE1]/10';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'Suspicious') return <AlertTriangle className="w-4 h-4" />;
    if (status === 'Alert') return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  // Build hatch columns dynamically from all tankers — collect all unique hatch IDs
  const allHatchIds = new Set<string>();
  tankers.forEach(t => t.hatches?.forEach(h => allHatchIds.add(h.id)));
  // If no hatches detected from data, show default 3 columns
  const hatchColumns = allHatchIds.size > 0
    ? Array.from(allHatchIds).sort((a, b) => {
        const aNum = parseInt(a.replace(/\D/g, '')) || 0;
        const bNum = parseInt(b.replace(/\D/g, '')) || 0;
        return aNum - bNum;
      })
    : ['hatch_1', 'hatch_2', 'hatch_3'];
  const hatchLabels = hatchColumns.map(id => {
    // Find label from any tanker that has this hatch
    for (const t of tankers) {
      const h = t.hatches?.find(h => h.id === id);
      if (h) return h.label;
    }
    const num = id.replace(/\D/g, '') || id;
    return `Hatch ${num}`;
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#07121A]">
      {/* Table Header */}
      <div className="px-6 py-4 bg-[#0C1E2C] border-b border-[#00E5FF]/30">
        <h3 className="text-lg text-white">Overview Table - All Tankers</h3>
        <p className="text-sm text-[#D9DCE1]/60 mt-1">Click on any row to view detailed analytics</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-[#0C1E2C] z-10">
            <tr className="border-b border-[#00E5FF]/30">
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Tanker</th>
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Driver</th>
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Fuel Level</th>
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Ultrasonic</th>
              {hatchLabels.map(label => (
                <th key={label} className="px-3 py-3 text-center text-xs text-[#00E5FF] uppercase tracking-wider">{label}</th>
              ))}
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Fuel Loss</th>
              <th className="px-4 py-3 text-left text-xs text-[#00E5FF] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {tankers.map((tanker, index) => {
              const isSelected = selectedTanker?.id === tanker.id;
              const isHighlighted = tanker.fuelLossPercent > 3;
              const fuelPct = tanker.fuelLevel;
              const fColor = fuelColor(fuelPct);
              const hatches = tanker.hatches || [];
              const anyOpen = hatches.some(h => h.open);

              return (
                <tr
                  key={tanker.id}
                  onClick={() => onSelectTanker(tanker)}
                  className={`
                    border-b border-[#00E5FF]/10 cursor-pointer transition-all duration-200
                    ${isSelected ? 'bg-[#009FFD]/20 border-l-4 border-l-[#00E5FF]' : 'hover:bg-[#0C1E2C]/50'}
                    ${anyOpen && !isSelected ? 'bg-[#FF4D4D]/8' : ''}
                    ${isHighlighted && !isSelected && !anyOpen ? 'bg-[#FF4D4D]/5' : ''}
                  `}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Tanker */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {tanker.status === 'moving' ? (
                        <Navigation className="w-4 h-4 text-[#28B463]" style={{ transform: 'rotate(45deg)' }} />
                      ) : (
                        <MapPin className="w-4 h-4 text-[#FFB02E]" />
                      )}
                      <span className="text-white font-medium">{tanker.name}</span>
                    </div>
                  </td>

                  {/* Driver */}
                  <td className="px-4 py-3">
                    <div className="text-[#D9DCE1] text-sm">{tanker.driver}</div>
                  </td>

                  {/* Fuel Level — percentage bar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-3.5 h-3.5" style={{ color: fColor }} />
                      <span className="text-white font-bold text-sm" style={{ color: fColor }}>{fuelPct}%</span>
                    </div>
                    <div className="w-20 h-2 bg-[#07121A] rounded-full overflow-hidden mt-1.5 border border-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${fuelPct}%`, backgroundColor: fColor }}
                      />
                    </div>
                  </td>

                  {/* Ultrasonic — raw sensor reading, separate */}
                  <td className="px-4 py-3">
                    <div className="text-white font-mono text-sm">{tanker.fuelDistanceCm ?? '--'}</div>
                    <div className="text-[10px] text-[#D9DCE1]/40 mt-0.5">cm distance</div>
                  </td>

                  {/* Hatch 1, 2, 3 — each in its own column */}
                  {hatchColumns.map((hatchId) => {
                    const hatch = hatches.find(h => h.id === hatchId);
                    if (!hatch) {
                      return (
                        <td key={hatchId} className="px-3 py-3 text-center">
                          <span className="text-[#D9DCE1]/20 text-xs">—</span>
                        </td>
                      );
                    }
                    return (
                      <td key={hatchId} className="px-3 py-3 text-center">
                        <div className={`inline-flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg border ${
                          hatch.open
                            ? 'bg-[#FF4D4D]/15 border-[#FF4D4D]/50'
                            : 'bg-[#28B463]/10 border-[#28B463]/30'
                        }`}>
                          {hatch.open ? (
                            <DoorOpen className="w-4 h-4 text-[#FF4D4D] animate-pulse" />
                          ) : (
                            <DoorClosed className="w-4 h-4 text-[#28B463]" />
                          )}
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            hatch.open ? 'text-[#FF4D4D] animate-pulse' : 'text-[#28B463]'
                          }`}>
                            {hatch.open ? 'OPEN' : 'Closed'}
                          </span>
                        </div>
                      </td>
                    );
                  })}

                  {/* Fuel Loss % */}
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1 ${
                      tanker.fuelLossPercent > 3 ? 'text-[#FF4D4D]' :
                      tanker.fuelLossPercent > 1 ? 'text-[#FFB02E]' :
                      'text-[#28B463]'
                    }`}>
                      {tanker.fuelLossPercent > 2 && <TrendingDown className="w-3 h-3" />}
                      <span className="font-semibold">{tanker.fuelLossPercent}%</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tanker.fuelStatus)}`}>
                      {getStatusIcon(tanker.fuelStatus)}
                      {tanker.fuelStatus}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {tankers.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertTriangle className="w-12 h-12 text-[#D9DCE1]/30 mb-3" />
            <p className="text-[#D9DCE1]/60">No tankers found matching your filters</p>
            <p className="text-sm text-[#D9DCE1]/40 mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
