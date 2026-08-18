import type { ReactNode } from 'react';

/*
 * Kart — çayır üstündeki bütün panellerin kabuğu.
 *
 * Masaüstünde solda duran, kendi gölgesi olan opak bir krem kart.
 * Mobilde ekranın altına yapışan bir alt sayfaya dönüşüyor: tam genişlik,
 * 22px köşe ve alt köşeler düz (ekran kenarına oturuyor). Handoff'un mobil
 * kalıbı bu; masaüstü kartını küçültmek değil.
 */
export function Card({
  children,
  width = 470,
  className = '',
}: {
  children: ReactNode;
  width?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex w-full flex-col gap-6 bg-card p-6 shadow-card max-lg:rounded-t-[22px] lg:rounded-[20px] lg:px-[36px] lg:py-[34px] ${className}`}
      style={{ maxWidth: `${width}px` }}
    >
      {children}
    </div>
  );
}
