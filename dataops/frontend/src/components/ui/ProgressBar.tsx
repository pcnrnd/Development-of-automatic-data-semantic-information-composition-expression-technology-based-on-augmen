import React from 'react';
import { motion } from 'motion/react';

interface ProgressBarProps {
  value: number;
  color?: string;
  height?: string;
  animated?: boolean;
  className?: string;
}

export const ProgressBar = ({
  value,
  color = 'bg-accent',
  height = 'h-1',
  animated = true,
  className = '',
}: ProgressBarProps) => (
  <div className={`w-full bg-white/5 ${height} rounded-full overflow-hidden ${className}`}>
    {animated ? (
      <motion.div
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${color}`}
      />
    ) : (
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    )}
  </div>
);

interface LabeledProgressBarProps extends ProgressBarProps {
  label: string;
  valueLabel: string;
}

export const LabeledProgressBar = ({ label, valueLabel, ...barProps }: LabeledProgressBarProps) => (
  <div>
    <div className="flex items-center justify-between text-xs mb-2">
      <span className="text-surface-muted">{label}</span>
      <span className="text-text-bright font-mono">{valueLabel}</span>
    </div>
    <ProgressBar {...barProps} />
  </div>
);
