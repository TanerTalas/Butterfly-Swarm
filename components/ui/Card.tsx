import type { CSSProperties, ReactNode } from 'react';

/*
 * Kart — çayır üstündeki bütün panellerin kabuğu.
 *
 * Görünüm `app/styles/card.css`'te: masaüstünde opak krem bir kart, mobilde
 * ekranın altına oturan bir alt sayfa.
 *
 * Genişlik bir PROP, sınıf değil: her ekranın kendi ölçüsü var (440–520px)
 * ve bunlar tasarım verisi, stil kararı değil.
 *
 * Ölçü `style` yerine bir CSS DEĞİŞKENİ olarak veriliyor. `style` satır içi
 * yazılıyor ve hiçbir stil dosyası onu geçemiyor; mobilde kartın alt sayfaya
 * dönüşmesi tam olarak `max-width`i geçersiz kılmayı gerektiriyor. Değişken
 * olarak verilince kural CSS'te kalıyor, `!important` gerekmiyor.
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
      className={`card ${className}`.trim()}
      style={{ '--card-width': `${width}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
