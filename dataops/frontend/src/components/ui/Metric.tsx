import React from 'react';

type MetricSize = 'sm' | 'md' | 'lg';

interface MetricProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: string;
  statusColor?: string;
  size?: MetricSize;
  className?: string;
}

const VALUE_SIZE: Record<MetricSize, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
};

export const Metric = ({
  label,
  value,
  unit,
  status,
  statusColor = 'text-text-dim',
  size = 'md',
  className = '',
}: MetricProps) => (
  <div className={`flex flex-col ${className}`}>
    <span className="text-[11px] text-surface-muted uppercase tracking-wide font-medium mb-1">{label}</span>
    <div className="flex items-baseline gap-2">
      <span className={`${VALUE_SIZE[size]} font-bold text-text-bright font-headline tabular-nums leading-tight`}>
        {value}
      </span>
      {unit && (
        <span className="text-xs font-medium text-surface-muted uppercase tracking-wide">{unit}</span>
      )}
      {status && (
        <span className={`text-[11px] font-medium ${statusColor}`}>{status}</span>
      )}
    </div>
  </div>
);
