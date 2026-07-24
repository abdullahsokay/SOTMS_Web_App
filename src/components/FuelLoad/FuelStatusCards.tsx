import { Droplet, Weight, AlertTriangle, TrendingDown } from 'lucide-react';
import { Tanker } from '../../types';

interface FuelStatusCardsProps {
  tankers: Tanker[];
}

export function FuelStatusCards({ tankers }: FuelStatusCardsProps) {
  // Calculate metrics
  const totalFuel = tankers.reduce((sum, t) => sum + t.fuelLevel, 0);
  const avgFuel = tankers.length === 0 ? 0 : Math.round(totalFuel / tankers.length);

  const totalLoad = tankers.reduce((sum, t) => sum + t.loadWeight, 0);
  const avgLoad = tankers.length === 0 ? 0 : Math.round(totalLoad / tankers.length);
  
  const fuelAlerts = tankers.filter(t => t.fuelLevel < 30).length;
  const loadAlerts = tankers.filter(t => t.loadWeight > 30000 || t.loadWeight < 5000).length;

  const cards = [
    {
      title: 'Avg. Fuel Level',
      value: `${avgFuel > 0 ? avgFuel : '--'}%`,
      icon: Droplet,
      color: 'from-[#009FFD] to-[#00E5FF]',
      border: 'border-[#00E5FF]/50',
      sparkline: [100, 95, 90, 85, 80, 75, avgFuel],
      status: 'normal'
    },
    {
      title: 'Average Load Weight',
      value: `${(avgLoad / 1000).toFixed(1)}T`,
      icon: Weight,
      color: 'from-[#009FFD] to-[#00AFFF]',
      border: 'border-[#009FFD]/50',
      sparkline: [29, 28.5, 28.2, 27.8, 27.5, 27.2, avgLoad / 1000],
      status: 'normal'
    },
    {
      title: 'Fuel Alerts (24h)',
      value: fuelAlerts.toString(),
      icon: TrendingDown,
      color: 'from-[#FFB02E] to-[#FF8C42]',
      border: 'border-[#FFB02E]/50',
      sparkline: [1, 2, 1, 3, 2, 3, fuelAlerts],
      status: fuelAlerts === 0 ? 'normal' : fuelAlerts < 3 ? 'warning' : 'critical'
    },
    {
      title: 'Load Alerts (24h)',
      value: loadAlerts.toString(),
      icon: AlertTriangle,
      color: 'from-[#FF4D4D] to-[#FF6B6B]',
      border: 'border-[#FF4D4D]/50',
      sparkline: [0, 1, 0, 1, 2, 1, loadAlerts],
      status: loadAlerts === 0 ? 'normal' : loadAlerts < 2 ? 'warning' : 'critical'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-[#FF4D4D]';
      case 'warning': return 'bg-[#FFB02E]';
      default: return 'bg-[#28B463]';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            style={{ animationDelay: `${index * 0.1}s` }}
            className={`bg-gradient-to-br ${card.color} border ${card.border} rounded-xl p-5 neon-glow-hover transition-all duration-200 hover:scale-105 animate-fade-in relative overflow-hidden`}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }} />
            </div>

            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-white/80 mb-1">{card.title}</p>
                  <p className="text-3xl text-white">{card.value}</p>
                </div>
                <div className="p-3 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(card.status)} pulse-glow`} />
                <span className="text-xs text-white/70 capitalize">{card.status}</span>
              </div>

              {/* Sparkline */}
              <div className="flex items-end h-10 gap-1">
                {card.sparkline.map((val, idx) => {
                  const maxVal = Math.max(...card.sparkline);
                  const height = (val / maxVal) * 100;
                  return (
                    <div
                      key={idx}
                      style={{ 
                        height: `${height}%`,
                        animationDelay: `${(index * 0.1) + (idx * 0.05)}s`
                      }}
                      className="flex-1 bg-white/40 rounded-sm animate-slide-up"
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
