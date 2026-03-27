
import React from 'react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isUp: boolean;
  };
  colorClass: string;
  subtitle?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  icon,
  trend,
  colorClass,
  subtitle,
}) => {
  return (
    <div className="p-6 rounded-2xl border border-[#262626] bg-[#111111] text-[#F5F5F5] flex flex-col justify-between transition-all hover:shadow-md hover:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#A3A3A3] text-sm font-medium">{title}</span>

        <div className={`p-2 rounded-lg border ${colorClass}`}>
          {icon}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-[#F5F5F5]">{value}</h3>

        {subtitle && (
          <p className="text-xs mt-1 text-[#A3A3A3]">{subtitle}</p>
        )}

        {trend && (
          <p
            className={`text-xs mt-2 font-semibold ${
              trend.isUp ? "text-[#39FF14]" : "text-[#FF3131]"
            }`}
          >
            {trend.isUp ? "↑" : "↓"} {trend.value}{" "}
            <span className="text-[#A3A3A3] font-normal">
              desde o último mês
            </span>
          </p>
        )}
      </div>
    </div>
  );
};

export default DashboardCard;
