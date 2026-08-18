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
      /*
       * Arka plan TAM OPAK ve `background-color` olarak veriliyor.
       *
       * Önceden yalnızca `bg-card` yardımcı sınıfıydı ve kartın kenarları
       * bozuk görünüyordu: altındaki perde yarı saydam, gölge geniş ve
       * yumuşak, köşeler yuvarlak — üçü birleşince kenarda kirli bir kuşak
       * oluşuyordu. Kart sahnenin üstünde duran KAĞIT gibi olmalı, camdan
       * değil.
       *
       * GÖLGE YOK. Önce yumuşatıldı, sonra tamamen kaldırıldı: canlı ve
       * hareketli bir çayırın üstünde büyük ve bulanık bir gölge kartı
       * yüzdürmüyor, kirletiyordu. Kenarı 1px çizgi tanımlıyor ve bu yeterli —
       * kart zaten opak, perdenin üstünde net bir kağıt olarak duruyor.
       */
      className={`flex w-full flex-col gap-6 p-6 max-lg:rounded-t-[22px] lg:rounded-[20px] lg:px-[36px] lg:py-[34px] ${className}`}
      style={{
        maxWidth: `${width}px`,
        backgroundColor: '#FDF6F2',
        border: '1px solid rgba(44,34,32,0.10)',
      }}
    >
      {children}
    </div>
  );
}
