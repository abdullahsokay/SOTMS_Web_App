import { AlertOctagon, AlertTriangle, Info, Bell } from 'lucide-react';

interface AlertsSummaryCardsProps {
  stats: {
    critical: number;
    warning: number;
    info: number;
    unacknowledged: number;
  };
}

export function AlertsSummaryCards({ stats }: AlertsSummaryCardsProps) {
  const cards = [
    {
      title: 'Critical Alerts',
      count: stats.critical,
      icon: AlertOctagon,
      color: '#FF3B30',
      bgGradient: 'from-red-500/20 to-red-600/10',
      borderColor: 'border-red-500/40'
    },
    {
      title: 'Warning Alerts',
      count: stats.warning,
      icon: AlertTriangle,
      color: '#FF9500',
      bgGradient: 'from-orange-500/20 to-orange-600/10',
      borderColor: 'border-orange-500/40'
    },
    {
      title: 'Info Alerts',
      count: stats.info,
      icon: Info,
      color: '#00CFFF',
      bgGradient: 'from-cyan-500/20 to-cyan-600/10',
      borderColor: 'border-cyan-500/40'
    },
    {
      title: 'Unacknowledged',
      count: stats.unacknowledged,
      icon: Bell,
      color: '#009FFD',
      bgGradient: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-[#009FFD]/40'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`bg-gradient-to-br ${card.bgGradient} border ${card.borderColor} rounded-xl p-6 neon-glow hover:scale-105 transition-all duration-300`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${card.color}30` }}
              >
                <Icon className="w-6 h-6" style={{ color: card.color }} />
              </div>
              <div className="text-right">
                <div className="text-3xl text-white mb-1 pulse-glow" style={{ color: card.color }}>
                  {card.count}
                </div>
                <div className="text-sm text-[#D9DCE1]/70">{card.title}</div>
              </div>
            </div>
            <div className="h-1 bg-[#0C1E2C] rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${Math.min((card.count / 10) * 100, 100)}%`,
                  backgroundColor: card.color
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
