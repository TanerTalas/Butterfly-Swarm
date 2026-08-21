import type { ButtonHTMLAttributes } from 'react';

/*
 * Butonlar — tasarımın en çok tekrar eden parçası.
 *
 * Görünüm ve ölçülerin tamamı `app/styles/buttons.css`'te; burada yalnızca
 * hangi sınıfın hangi prop'a düştüğü var. Hover'daki kanat gölgesi çok
 * katmanlı bir box-shadow ve tasarımın imzası.
 */

type Size = 'lg' | 'md' | 'sm';

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
  const classes = [
    'button',
    `button--${size}`,
    `button--${variant}`,
    fullWidth ? 'button--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button className={classes} {...rest} />;
}
