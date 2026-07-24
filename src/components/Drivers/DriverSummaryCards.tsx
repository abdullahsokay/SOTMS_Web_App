import { Users, UserCheck, AlertTriangle, UserX } from 'lucide-react';

interface DriverSummaryCardsProps {
  stats: {
    total: number;
    active: number;
    expiring: number;
    suspended: number;
  };
}

const cards = [
  { key: 'total', label: 'Total Drivers', icon: Users, color: '#009FFD', gradient: 'from-[#009FFD]/20 to-[#009FFD]/5' },
  { key: 'active', label: 'Active Drivers', icon: UserCheck, color: '#28B463', gradient: 'from-[#28B463]/20 to-[#28B463]/5' },
  { key: 'expiring', label: 'License Expiring', icon: AlertTriangle, color: '#FFB02E', gradient: 'from-[#FFB02E]/20 to-[#FFB02E]/5' },
  { key: 'suspended', label: 'Suspended', icon: UserX, color: '#FF4D4D', gradient: 'from-[#FF4D4D]/20 to-[#FF4D4D]/5' },
] as const;

export function DriverSummaryCards({ stats }: DriverSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        const value = stats[card.key as keyof typeof stats];
        return (
          <div
            key={card.key}
            className={`bg-gradient-to-br ${card.gradient} border border-[${card.color}]/30 rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_${card.color}33]`}
            style={{ animationDelay: `${index * 0.1}s`, borderColor: `${card.color}33` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${card.color}20` }}
              >
                <Icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              <span className="text-3xl font-bold text-white">{value}</span>
            </div>
            <div className="text-sm text-[#D9DCE1]/70">{card.label}</div>
          </div>
        );
      })}
    </div>
  );
}
