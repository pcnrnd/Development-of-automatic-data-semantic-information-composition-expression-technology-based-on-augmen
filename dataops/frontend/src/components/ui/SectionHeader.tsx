import React from 'react';

type HeaderSize = 'sm' | 'md' | 'lg';

const TITLE_SIZE: Record<HeaderSize, string> = {
  sm: 'text-2xl',
  md: 'text-2xl md:text-3xl',
  lg: 'text-3xl md:text-4xl',
};

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  right?: React.ReactNode;
  size?: HeaderSize;
  className?: string;
}

export const SectionHeader = ({
  title,
  subtitle,
  description,
  right,
  size = 'lg',
  className = '',
}: SectionHeaderProps) => (
  <div className={`flex justify-between items-end ${className}`}>
    <div>
      {subtitle && (
        <span className="text-xs font-semibold uppercase tracking-wide text-accent mb-1 block">
          {subtitle}
        </span>
      )}
      <h1 className={`font-bold tracking-tight text-text-bright font-headline ${TITLE_SIZE[size]} ${description ? 'mb-2' : ''}`}>
        {title}
      </h1>
      {description && (
        <p className="text-sm text-text-dim tracking-normal">{description}</p>
      )}
    </div>
    {right && <div>{right}</div>}
  </div>
);
