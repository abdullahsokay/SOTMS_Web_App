import { Navigation, Loader2 } from 'lucide-react';
import { Tanker, Route } from '../../types';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';

interface FleetETAWidgetProps {
  tankers: Tanker[];
  routes: Route[];
}

export function FleetETAWidget({ tankers, routes }: FleetETAWidgetProps) {
  const { matrix, isCalculating } = useDistanceMatrix(tankers, routes);

  if (matrix.length === 0 && !isCalculating) {
    return null; // No active routes assigned — don't show widget
  }

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-[#28B463]" />
          <h3 className="text-lg text-white">Fleet ETA Overview</h3>
        </div>
        {isCalculating && <Loader2 className="w-4 h-4 text-[#00E5FF] animate-spin" />}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#00E5FF]/20">
              <th className="text-left text-[#D9DCE1]/60 py-2 pr-4">Tanker</th>
              <th className="text-left text-[#D9DCE1]/60 py-2 pr-4">Route</th>
              <th className="text-right text-[#D9DCE1]/60 py-2 pr-4">Distance</th>
              <th className="text-right text-[#D9DCE1]/60 py-2">ETA</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map(entry => (
              <tr key={entry.tankerId} className="border-b border-[#00E5FF]/10">
                <td className="py-3 pr-4 text-white font-mono">{entry.tankerId}</td>
                <td className="py-3 pr-4 text-[#D9DCE1]/80">{entry.routeName}</td>
                <td className="py-3 pr-4 text-right text-[#00E5FF]">{entry.distanceText}</td>
                <td className="py-3 text-right text-[#28B463]">{entry.durationText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
