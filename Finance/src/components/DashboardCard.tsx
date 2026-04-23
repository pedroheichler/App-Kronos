import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isUp: boolean;
  };
  accentColor?: string;
  subtitle?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  trend,
  accentColor = '#616161',
  subtitle,
}) => {
  return (
    <div className="p-4 md:p-5 rounded-xl border border-[#1F1F1F] bg-[#111111] flex flex-col gap-3 hover:border-[#2a2a2a] transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#616161] font-medium">{title}</span>
        <span style={{ color: accentColor }} className="opacity-60">{icon}</span>
      </div>

      <div>
        <h3 className="text-xl md:text-2xl font-semibold text-[#E8E8E8] tracking-tight">{value}</h3>

        {subtitle && (
          <p className="text-xs mt-0.5 text-[#616161]">{subtitle}</p>
        )}

        {trend && (
          <p className={`text-xs mt-1.5 font-medium flex items-center gap-1 ${trend.isUp ? 'text-green-400' : 'text-rose-400'}`}>
            {trend.isUp ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
