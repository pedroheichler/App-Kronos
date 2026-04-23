import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white border border-transparent',
  ghost:   'bg-transparent hover:bg-[#161616] text-[#E8E8E8] border border-[#1F1F1F]',
  danger:  'bg-transparent hover:bg-red-500/10 text-[#616161] hover:text-red-400 border border-transparent',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    />
  );
}
