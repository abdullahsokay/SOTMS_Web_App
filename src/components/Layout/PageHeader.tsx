import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <div className="h-20 bg-[#0C1E2C] border-b border-[#00E5FF]/20 px-8 flex items-center justify-between">
      {/* Left Section - Title */}
      <div className="flex items-center gap-4">
        {icon && (
          <div className="p-3 glass-card">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl text-[#E2E8F0] font-semibold neon-text">{title}</h1>
          {subtitle && (
            <p className="text-sm text-[#D9DCE1]/60 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right Section - Actions */}
      {actions && (
        <div className="flex items-center gap-3">
          {actions}
        </div>
      )}
    </div>
  );
}
