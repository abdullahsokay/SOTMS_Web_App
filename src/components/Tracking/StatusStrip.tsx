import { Tanker } from '../../types';
import { Truck, Navigation, Pause, Square, AlertTriangle, Droplet } from 'lucide-react';

interface StatusStripProps {
  tankers: Tanker[];
}

export function StatusStrip({ tankers }: StatusStripProps) {
  const stats = {
    total: tankers.length,
    moving: tankers.filter(t => t.status === 'moving').length,
    idle: tankers.filter(t => t.status === 'idle').length,
    parked: tankers.filter(t => t.status === 'parked').length,
    offline: tankers.filter(t => t.status === 'offline').length,
    alerts: tankers.filter(t => t.alerts.length > 0).length
  };

  // Calculate additional tracking details
  const avgFuel = tankers.length === 0 ? 0 : Math.round(tankers.reduce((sum, t) => sum + t.fuelLevel, 0) / tankers.length);
  const avgSpeed = Math.round(tankers.filter(t => t.status === 'moving').reduce((sum, t) => sum + t.speed, 0) / stats.moving || 0);
  const lowFuelCount = tankers.filter(t => t.fuelLevel < 30).length;

  const statItems = [
    { 
      label: 'Total Fleet', 
      value: stats.total, 
      icon: Truck, 
      color: 'bg-gradient-to-br from-[#009FFD]/20 to-[#00E5FF]/10',
      iconColor: 'text-[#00E5FF]',
      textColor: 'text-[#00E5FF]',
      sublabel: 'Active Tankers'
    },
    { 
      label: 'Moving', 
      value: stats.moving, 
      icon: Navigation, 
      color: 'bg-gradient-to-br from-[#28B463]/20 to-[#28B463]/10',
      iconColor: 'text-[#28B463]',
      textColor: 'text-[#28B463]',
      sublabel: `Avg ${avgSpeed} km/h`
    },
    { 
      label: 'Idle', 
      value: stats.idle, 
      icon: Pause, 
      color: 'bg-gradient-to-br from-[#FFB02E]/20 to-[#FFB02E]/10',
      iconColor: 'text-[#FFB02E]',
      textColor: 'text-[#FFB02E]',
      sublabel: 'Stationary'
    },
    { 
      label: 'Parked', 
      value: stats.parked, 
      icon: Square, 
      color: 'bg-gradient-to-br from-[#D9DCE1]/20 to-[#D9DCE1]/10',
      iconColor: 'text-[#D9DCE1]',
      textColor: 'text-[#D9DCE1]',
      sublabel: 'Engine Off'
    },
    { 
      label: 'Alerts', 
      value: stats.alerts, 
      icon: AlertTriangle, 
      color: 'bg-gradient-to-br from-[#FF4D4D]/20 to-[#FF4D4D]/10',
      iconColor: 'text-[#FF4D4D]',
      textColor: 'text-[#FF4D4D]',
      sublabel: 'Attention Needed'
    },
    { 
      label: 'Avg Fuel', 
      value: `${avgFuel}%`, 
      icon: Droplet, 
      color: 'bg-gradient-to-br from-[#3B82F6]/20 to-[#3B82F6]/10',
      iconColor: 'text-[#3B82F6]',
      textColor: 'text-[#3B82F6]',
      sublabel: `${lowFuelCount} Low`
    }
  ];

  return (
    <div className="bg-[#07121A] border-t border-[#00E5FF]/30 px-6 py-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              style={{ animationDelay: `${index * 0.05}s` }}
              className={`${item.color} border border-[#00E5FF]/20 rounded-xl p-4 animate-fade-in hover:scale-105 transition-all duration-300 neon-glow-hover cursor-pointer`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 bg-[#07121A]/50 rounded-lg ${item.iconColor} backdrop-blur-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className={`text-2xl font-bold ${item.textColor} neon-text`}>
                  {item.value}
                </div>
              </div>
              <div>
                <div className="text-sm text-white mb-1">{item.label}</div>
                <div className="text-xs text-[#D9DCE1]/60">{item.sublabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}