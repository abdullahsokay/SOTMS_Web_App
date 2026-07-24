import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'green' | 'yellow' | 'red' | 'blue';
  trend?: string;
}

const colorStyles = {
  green: 'from-[#28B463]/20 to-[#28B463]/5 border-[#28B463]/50',
  yellow: 'from-[#FFB02E]/20 to-[#FFB02E]/5 border-[#FFB02E]/50',
  red: 'from-[#FF4D4D]/20 to-[#FF4D4D]/5 border-[#FF4D4D]/50',
  blue: 'from-[#009FFD]/20 to-[#00E5FF]/5 border-[#00E5FF]/50'
};

const iconColors = {
  green: 'text-[#28B463]',
  yellow: 'text-[#FFB02E]',
  red: 'text-[#FF4D4D]',
  blue: 'text-[#00E5FF]'
};

export function StatCard({ title, value, icon: Icon, color, trend }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorStyles[color]} border rounded-xl p-6 neon-glow-hover transition-all duration-200 hover:-translate-y-1 hover:scale-105`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 bg-[#0C1E2C]/50 rounded-lg flex items-center justify-center ${iconColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className="text-xs text-[#D9DCE1]/60">{trend}</span>
        )}
      </div>
      <div className="text-3xl text-white mb-1">{value}</div>
      <div className="text-sm text-[#D9DCE1]/70">{title}</div>
    </div>
  );
}
