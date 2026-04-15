import React from 'react';

const BASE_CLASS =
  'bg-primary border border-white/10 rounded-lg px-3 py-2 text-xs text-text-bright placeholder:text-surface-muted focus:ring-1 focus:ring-accent focus:outline-none';

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const FormInput = ({ className = '', ...props }: FormInputProps) => (
  <input className={`${BASE_CLASS} ${className}`} {...props} />
);

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const FormSelect = ({ className = '', children, ...props }: FormSelectProps) => (
  <select className={`${BASE_CLASS} ${className}`} {...props}>
    {children}
  </select>
);
