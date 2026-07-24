import { AlertTriangle, MapPin, Clock } from 'lucide-react';
import { Alert } from '../../types';

interface AlertsPanelProps {
  alerts: Alert[];
  onLocateOnMap?: (tankerId: string) => void;
}

export function AlertsPanel({ alerts, onLocateOnMap }: AlertsPanelProps) {
  const activeAlerts = alerts.filter(a => !a.resolved);

  const getAlertColor = (type: Alert['type']) => {
    switch (type) {
      case 'critical': return 'text-[#FF4D4D] border-[#FF4D4D]/50 bg-[#FF4D4D]/10';
      case 'warning': return 'text-[#FFB02E] border-[#FFB02E]/50 bg-[#FFB02E]/10';
      case 'safe': return 'text-[#28B463] border-[#28B463]/50 bg-[#28B463]/10';
    }
  };

  return (
    <div className="bg-[#0C1E2C] border border-[#00E5FF]/30 rounded-xl p-4 neon-glow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg text-white">Recent Alerts</h3>
        <span className="px-3 py-1 bg-[#FF4D4D]/20 text-[#FF4D4D] rounded-full text-sm">
          {activeAlerts.length} Active
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-[#D9DCE1]/50">
            No active alerts
          </div>
        ) : (
          activeAlerts.map((alert, index) => (
            <div
              key={alert.id}
              style={{ animationDelay: `${index * 0.1}s` }}
              className={`p-4 rounded-lg border ${getAlertColor(alert.type)} animate-fade-in`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-white">{alert.tankerId}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#D9DCE1]/60">
                  <Clock className="w-3 h-3" />
                  {alert.timestamp}
                </div>
              </div>

              <p className="text-sm text-[#D9DCE1] mb-3">{alert.message}</p>

              <button
                onClick={() => onLocateOnMap?.(alert.tankerId)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#009FFD]/20 hover:bg-[#009FFD]/30 text-[#00E5FF] rounded-lg text-sm transition-all duration-200 hover:scale-105"
              >
                <MapPin className="w-4 h-4" />
                Locate on Map
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
