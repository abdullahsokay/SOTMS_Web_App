import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Tanker } from '../../types';

interface RouteComplianceTableProps {
  tankers: Tanker[];
}

export function RouteComplianceTable({ tankers }: RouteComplianceTableProps) {
  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow">
      <h3 className="text-lg text-white mb-4">Route Compliance</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#00E5FF]/20">
              <th className="text-left py-3 px-4 text-sm text-[#D9DCE1]/70">Tanker ID</th>
              <th className="text-left py-3 px-4 text-sm text-[#D9DCE1]/70">Assigned Route</th>
              <th className="text-left py-3 px-4 text-sm text-[#D9DCE1]/70">Deviation</th>
              <th className="text-left py-3 px-4 text-sm text-[#D9DCE1]/70">Status</th>
            </tr>
          </thead>
          <tbody>
            {tankers.map((tanker, index) => (
              <tr
                key={tanker.id}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="border-b border-[#00E5FF]/10 hover:bg-[#009FFD]/5 transition-colors animate-fade-in"
              >
                <td className="py-3 px-4">
                  <span className="text-white">{tanker.name}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-[#D9DCE1]">{tanker.route || 'N/A'}</span>
                </td>
                <td className="py-3 px-4">
                  {tanker.routeDeviation ? (
                    <span className="flex items-center gap-2 text-[#FF4D4D]">
                      <XCircle className="w-4 h-4" />
                      Yes
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[#28B463]">
                      <CheckCircle className="w-4 h-4" />
                      No
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {tanker.status === 'alert' || tanker.routeDeviation ? (
                    <span className="flex items-center gap-2 px-3 py-1 bg-[#FF4D4D]/20 text-[#FF4D4D] rounded-full text-sm w-fit">
                      <AlertCircle className="w-3 h-3" />
                      Alert
                    </span>
                  ) : tanker.status === 'idle' ? (
                    <span className="flex items-center gap-2 px-3 py-1 bg-[#FFB02E]/20 text-[#FFB02E] rounded-full text-sm w-fit">
                      Warning
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 px-3 py-1 bg-[#28B463]/20 text-[#28B463] rounded-full text-sm w-fit">
                      Normal
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}