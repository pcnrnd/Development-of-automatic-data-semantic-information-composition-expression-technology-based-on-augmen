import React from 'react';

type BadgeVariant = 'accent' | 'dim' | 'danger' | 'warning';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  accent:  'bg-accent/10 text-accent border-accent/15',
  dim:     'bg-white/5 text-text-dim border-white/5',
  danger:  'bg-red-500/20 text-red-400 border-red-500/20',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
};

const VARIANT_DOT: Record<BadgeVariant, string> = {
  accent:  'bg-accent',
  dim:     'bg-text-dim',
  danger:  'bg-red-500',
  warning: 'bg-yellow-400',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

export const Badge = ({ children, variant = 'accent', dot = false, pulse = false, className = '' }: BadgeProps) => (
  <div className={`flex items-center px-3 py-1.5 rounded-full border ${VARIANT_STYLES[variant]} ${className}`}>
    {dot && (
      <span className={`w-2 h-2 rounded-full mr-2 ${VARIANT_DOT[variant]} ${pulse ? 'animate-pulse' : ''}`} />
    )}
    <span className="text-xs font-medium uppercase tracking-wide">{children}</span>
  </div>
);

interface StatusTagProps {
  active: boolean;
  label: string;
}

export const StatusTag = ({ active, label }: StatusTagProps) => (
  <span
    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide ${
      active ? 'bg-accent text-primary' : 'bg-primary text-surface-muted'
    }`}
  >
    {label}
  </span>
);

interface ChipProps {
  children: React.ReactNode;
}

export const Chip = ({ children }: ChipProps) => (
  <span className="px-2 py-1 bg-accent/10 rounded-md text-[11px] text-accent border border-accent/20 font-semibold tracking-wide">
    {children}
  </span>
);
