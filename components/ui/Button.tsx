import type { ButtonHTMLAttributes } from 'react';

/*
 * Butonlar — tasarımın en çok tekrar eden parçası.
 *
 * Görünüm `globals.css`'te (.btn-primary / .btn-secondary), ölçüler burada.
 * Hover'daki kanat gölgesi çok katmanlı bir box-shadow; Tailwind yardımcı
 * sınıflarıyla okunaksız hale geldiği için CSS tarafında duruyor.
 */

type Size = 'lg' | 'md' | 'sm';

const HEIGHT: Record<Size, string> = {
  lg: 'h-[52px] px-7', // ana eylemler: "Release a butterfly", "Let it go"
  md: 'h-[50px] px-6', // kart içi birincil
  sm: 'h-[44px] px-5', // satır içi, tehlikeli eylemler
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  size?: Size;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth,
  className = '',
  ...rest
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2.5 rounded-full text-[15px] font-medium';
  const skin =
    variant === 'primary'
      ? `btn-primary ${size === 'sm' ? 'btn-primary-sm' : ''}`
      : 'btn-secondary';

  return (
    <button
      className={`${base} ${HEIGHT[size]} ${skin} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
