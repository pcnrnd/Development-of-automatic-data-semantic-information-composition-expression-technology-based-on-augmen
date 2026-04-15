import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  dim?: boolean;
}

export const Card = ({ children, className = '', noPadding = false, dim = false }: CardProps) => (
  <div
    className={`${dim ? 'bg-surface-card/30' : 'bg-surface-card'} rounded-xl border border-white/5 ${noPadding ? '' : 'p-6'} ${className}`}
  >
    {children}
  </div>
);

interface CardHeaderProps {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export const CardHeader = ({ left, right, className = '' }: CardHeaderProps) => (
  <div className={`px-5 py-3.5 bg-primary/50 flex justify-between items-center border-b border-white/5 ${className}`}>
    <div className="flex items-center gap-3">{left}</div>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </div>
);

export const CardLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-xs uppercase tracking-wide text-text-bright">{children}</span>
);
