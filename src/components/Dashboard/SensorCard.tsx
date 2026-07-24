import { LucideIcon } from 'lucide-react';

interface SensorCardProps {
  title: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  sparklineData?: number[];
  status: 'normal' | 'warning' | 'critical';
}

const statusColors = {
  normal: 'border-[#28B463]/50',
  warning: 'border-[#FFB02E]/50',
  critical: 'border-[#FF4D4D]/50'
};

export function SensorCard({ title, value, unit, icon: Icon, sparklineData = [], status }: SensorCardProps) {
  const max = Math.max(...sparklineData, value);
  const min = Math.min(...sparklineData, value);
  const range = max - min || 1;

  return (
    <div className={`bg-[#0C1E2C] border ${statusColors[status]} rounded-xl p-4 neon-glow-hover transition-all duration-200 hover:scale-105`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#00E5FF]" />
          <span className="text-sm text-[#D9DCE1]">{title}</span>
        </div>
      </div>

      <div className="text-2xl text-white mb-2">
        {value} <span className="text-sm text-[#D9DCE1]/60">{unit}</span>
      </div>

      {/* Sparkline */}
      {sparklineData.length > 0 && (
        <div className="flex items-end h-8 gap-1">
          {sparklineData.map((val, idx) => {
            const height = ((val - min) / range) * 100;
            return (
              <div
                key={idx}
                style={{ 
                  height: `${height}%`,
                  animationDelay: `${idx * 0.05}s`
                }}
                className="flex-1 bg-[#00E5FF] rounded-sm opacity-70 animate-slide-up"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}